import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { performance } from 'node:perf_hooks'
import { createDatabase } from './database.js'
import { createApp } from './index.js'

test('story creation, checklist persistence, and place ratings work through JSON endpoints', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-together-'))
  const database = createDatabase(path.join(directory, 'test.sqlite'))
  const server = createApp(database).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    database.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const healthResponse = await fetch(`${baseUrl}/api/health`)
  assert.equal(healthResponse.status, 200)
  assert.deepEqual(await healthResponse.json(), {
    status: 'ok',
    service: 'ready-together-api',
  })

  const generationStartedAt = performance.now()
  const createResponse = await fetch(`${baseUrl}/api/stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: 'the dentist',
      visitType: 'dentist',
      nickname: 'Sam',
      profile: { sound: 'sometimes', supports: ['headphones'] },
      photos: [{
        name: 'front.jpg',
        type: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,dGVzdA==',
      }],
    }),
  })
  assert.equal(createResponse.status, 201)
  const createdStory = await createResponse.json()
  assert.ok(performance.now() - generationStartedAt < 30_000)
  assert.ok(createdStory.pages.length >= 5 && createdStory.pages.length <= 10)
  assert.equal(createdStory.photos[0].name, 'front.jpg')
  assert.ok(createdStory.pages.flatMap((page) => page.sentences).join(' ').includes('headphones'))

  const savedStoryResponse = await fetch(`${baseUrl}/api/stories/${createdStory.id}`)
  const savedStory = await savedStoryResponse.json()
  assert.equal(savedStory.photos[0].dataUrl, 'data:image/jpeg;base64,dGVzdA==')
  assert.equal(savedStory.checklist[0].completed, false)

  const updatedChecklist = savedStory.checklist.map((step, index) => ({
    id: step.id,
    completed: index === 0,
  }))
  const checklistResponse = await fetch(`${baseUrl}/api/stories/${createdStory.id}/checklist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist: updatedChecklist }),
  })
  assert.equal(checklistResponse.status, 200)
  const checklist = await checklistResponse.json()
  assert.equal(checklist.checklist[0].completed, true)
  const refreshedStory = await fetch(`${baseUrl}/api/stories/${createdStory.id}`)
  assert.equal((await refreshedStory.json()).checklist[0].completed, true)

  const initialPlacesResponse = await fetch(`${baseUrl}/api/places`)
  const initialPlaces = await initialPlacesResponse.json()
  const ratedPlace = initialPlaces.find((place) => place.id === 'northside-market')
  const ratingResponse = await fetch(`${baseUrl}/api/places/${ratedPlace.id}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ noise: 1, crowds: 1, waits: 1 }),
  })
  assert.equal(ratingResponse.status, 201)
  const ratedPlaces = (await ratingResponse.json()).places
  assert.equal(ratedPlaces[0].id, 'northside-market')
  assert.equal(ratedPlaces[0].calmScore, 5)
})

test('story endpoint returns validation errors as JSON', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-together-'))
  const database = createDatabase(path.join(directory, 'test.sqlite'))
  const server = createApp(database).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    database.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const response = await fetch(`${baseUrl}/api/stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(response.status, 400)
  assert.equal(typeof (await response.json()).error, 'string')
})

async function startTestServer(context, databaseFile = 'test.sqlite') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-together-'))
  const database = createDatabase(path.join(directory, databaseFile))
  const server = createApp(database).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    database.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return {
    get: (route) => fetch(`${baseUrl}${route}`),
    send: (method, route, body) => fetch(`${baseUrl}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  }
}

test('personalized plans are created, saved, and reloaded without a nickname', async (context) => {
  const api = await startTestServer(context)
  const createResponse = await api.send('POST', '/api/stories', {
    destination: "Dr. Lee's office.",
    visitType: 'dentist',
    profile: { sound: 'often', supports: ['headphones'] },
  })
  assert.equal(createResponse.status, 201)
  const created = await createResponse.json()

  assert.equal(created.destination, "Dr. Lee's office")
  assert.equal(created.nickname, null)
  assert.equal(created.visitType, 'dentist')
  assert.equal(created.profile.sound, 'often')
  assert.ok(created.sections.some((section) => section.id === 'sound'))
  assert.equal(created.pages.length, created.sections.length)
  assert.equal(created.pages[0].title, 'Getting ready')
  assert.ok(created.checklist.every((item) => item.completed === false && item.reason && item.phase))
  assert.ok(created.questionsForVenue.length > 0)
  assert.match(created.generalInfoNotice, /does not include verified details/)

  const reloaded = await (await api.get(`/api/stories/${created.id}`)).json()
  assert.deepEqual(reloaded, created)

  const checklist = created.checklist.map((item) => ({ id: item.id, completed: item.id === 'read-story' }))
  assert.equal((await api.send('PATCH', `/api/stories/${created.id}/checklist`, { checklist })).status, 200)
  const afterPatch = await (await api.get(`/api/stories/${created.id}`)).json()
  assert.equal(afterPatch.checklist.find((item) => item.id === 'read-story').completed, true)
  assert.equal(afterPatch.checklist[0].reason, created.checklist[0].reason)
  assert.ok(afterPatch.updatedAt >= created.updatedAt)
})

test('different preferences produce different saved checklists through the API', async (context) => {
  const api = await startTestServer(context)
  const create = async (profile) => (await api.send('POST', '/api/stories', {
    destination: 'Main Street Market',
    visitType: 'grocery-store',
    profile,
  })).json()
  const soundPlan = await create({ sound: 'often' })
  const crowdPlan = await create({ crowds: 'often', supports: ['comfort-item'] })
  const checklistIds = (plan) => plan.checklist.map((item) => item.id)

  assert.ok(checklistIds(soundPlan).includes('preview-sounds'))
  assert.ok(!checklistIds(crowdPlan).includes('preview-sounds'))
  assert.ok(checklistIds(crowdPlan).includes('plan-quiet-time'))
  assert.ok(checklistIds(crowdPlan).includes('pack-supports'))
})

test('invalid personalized requests return clear JSON errors', async (context) => {
  const api = await startTestServer(context)
  const cases = [
    { body: { visitType: 'dentist' }, error: /Destination is required/ },
    { body: { destination: 'X', visitType: 'castle' }, error: /visit types/ },
    { body: { destination: 'X', visitType: 'dentist', profile: { sound: 'extreme' } }, error: /valid option/ },
    { body: { destination: 'X', profile: { supports: ['jetpack'] } }, error: /not recognized/ },
    { body: { destination: 'x'.repeat(101), visitType: 'other' }, error: /100 characters/ },
  ]
  for (const { body, error } of cases) {
    const response = await api.send('POST', '/api/stories', body)
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.match((await response.json()).error, error)
  }
  assert.deepEqual(await (await api.get('/api/stories')).json(), [])
})

test('the saved-visits list is lightweight and shows checklist progress', async (context) => {
  const api = await startTestServer(context)
  const created = await (await api.send('POST', '/api/stories', {
    destination: 'Library',
    visitType: 'library',
    photos: [{ name: 'door.png', type: 'image/png', dataUrl: 'data:image/png;base64,dGVzdA==' }],
  })).json()

  const [summary] = await (await api.get('/api/stories')).json()
  assert.equal(summary.id, created.id)
  assert.equal(summary.photos, undefined)
  assert.equal(summary.pages, undefined)
  assert.deepEqual(summary.checklistProgress, { completed: 0, total: created.checklist.length })
})

test('plan options list the choices the form can offer', async (context) => {
  const api = await startTestServer(context)
  const options = await (await api.get('/api/plan-options')).json()
  assert.ok(options.visitTypes.some((type) => type.id === 'dentist'))
  assert.deepEqual(options.sensoryAreas.map((area) => area.id), ['sound', 'lighting', 'crowds', 'waiting'])
  assert.ok(options.supports.some((support) => support.id === 'headphones'))
  assert.equal(options.limits.maxCustomSupports, 3)
})
