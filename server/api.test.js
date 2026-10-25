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

test('journey step progress is saved and validated', async (context) => {
  const api = await startTestServer(context)
  const plan = await (await api.send('POST', '/api/stories', {
    destination: 'the dentist',
    visitType: 'dentist',
    profile: { sound: 'often', supports: ['headphones'] },
  })).json()
  assert.deepEqual(plan.journey.map((step) => step.id), ['get-ready', 'arrive', 'during', 'leave'])
  assert.ok(plan.journey.every((step) => step.completed === false))

  const marked = await api.send('PATCH', `/api/stories/${plan.id}/journey`, { stepId: 'arrive', completed: true })
  assert.equal(marked.status, 200)
  assert.equal((await marked.json()).journey.find((step) => step.id === 'arrive').completed, true)

  const reloaded = await (await api.get(`/api/stories/${plan.id}`)).json()
  assert.deepEqual(reloaded.journey.map((step) => step.completed), [false, true, false, false])

  await api.send('PATCH', `/api/stories/${plan.id}/journey`, { stepId: 'arrive', completed: false })
  const undone = await (await api.get(`/api/stories/${plan.id}`)).json()
  assert.equal(undone.journey.find((step) => step.id === 'arrive').completed, false)

  for (const body of [{ stepId: 'fly', completed: true }, { stepId: 'arrive', completed: 'yes' }, {}]) {
    const response = await api.send('PATCH', `/api/stories/${plan.id}/journey`, body)
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal(typeof (await response.json()).error, 'string')
  }
  assert.equal((await api.send('PATCH', '/api/stories/missing/journey', { stepId: 'arrive', completed: true })).status, 404)
})

test('caregivers can edit story wording, and the journey uses the edits', async (context) => {
  const api = await startTestServer(context)
  const plan = await (await api.send('POST', '/api/stories', {
    destination: 'the library',
    visitType: 'library',
  })).json()
  const edits = plan.sections.map((section) => ({ id: section.id, sentences: section.sentences }))
  edits[0] = { id: 'getting-ready', sentences: ['We are going to the big library  ', '', 'Is it far?', 'It is near Grandma’s house!'] }

  const response = await api.send('PUT', `/api/stories/${plan.id}/sections`, { sections: edits })
  assert.equal(response.status, 200)
  const edited = await response.json()
  assert.deepEqual(edited.sections[0].sentences, [
    'We are going to the big library.', 'Is it far?', 'It is near Grandma’s house!',
  ])
  assert.equal(edited.sections[0].edited, true)
  assert.equal(edited.sections[1].edited, false)
  assert.deepEqual(edited.pages[0].sentences, edited.sections[0].sentences)
  assert.deepEqual(edited.journey[0].sentences, edited.sections[0].sentences)

  const reloaded = await (await api.get(`/api/stories/${plan.id}`)).json()
  assert.deepEqual(reloaded.sections, edited.sections)
})

test('story edits are validated', async (context) => {
  const api = await startTestServer(context)
  const plan = await (await api.send('POST', '/api/stories', { destination: 'X', visitType: 'other' })).json()
  const valid = plan.sections.map((section) => ({ id: section.id, sentences: section.sentences }))
  const withFirst = (sentences) => [{ ...valid[0], sentences }, ...valid.slice(1)]
  const cases = [
    { sections: valid.slice(1), error: /same parts/ },
    { sections: [...valid].reverse(), error: /in order/ },
    { sections: withFirst(['', '  ']), error: /at least one sentence/ },
    { sections: withFirst(Array.from({ length: 7 }, (_, i) => `Line ${i}`)), error: /at most 6/ },
    { sections: withFirst(['x'.repeat(201)]), error: /200 characters/ },
    { sections: withFirst([42]), error: /must be text/ },
    { sections: undefined, error: /same parts/ },
  ]
  for (const { sections, error } of cases) {
    const response = await api.send('PUT', `/api/stories/${plan.id}/sections`, { sections })
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, error)
  }
  const unchanged = await (await api.get(`/api/stories/${plan.id}`)).json()
  assert.deepEqual(unchanged.sections, plan.sections)
  assert.equal((await api.send('PUT', '/api/stories/missing/sections', { sections: valid })).status, 404)
})

test('changing preferences rebuilds the plan and keeps progress where it still applies', async (context) => {
  const api = await startTestServer(context)
  const plan = await (await api.send('POST', '/api/stories', {
    destination: 'the dentist',
    visitType: 'dentist',
    profile: { sound: 'often', supports: ['headphones'] },
    photos: [{ name: 'door.png', type: 'image/png', dataUrl: 'data:image/png;base64,dGVzdA==' }],
  })).json()
  await api.send('PATCH', `/api/stories/${plan.id}/checklist`, {
    checklist: plan.checklist.map((item) => ({ id: item.id, completed: ['read-story', 'preview-sounds'].includes(item.id) })),
  })
  await api.send('PATCH', `/api/stories/${plan.id}/journey`, { stepId: 'get-ready', completed: true })
  const edits = plan.sections.map((section) => ({ id: section.id, sentences: section.sentences }))
  edits[0].sentences = ['A sentence I wrote.']
  await api.send('PUT', `/api/stories/${plan.id}/sections`, { sections: edits })

  const response = await api.send('PUT', `/api/stories/${plan.id}/plan`, {
    destination: 'Dr. Lee’s office',
    visitType: 'dentist',
    profile: { waiting: 'often', supports: ['timer'] },
  })
  assert.equal(response.status, 200)
  const rebuilt = await response.json()
  const sectionIds = rebuilt.sections.map((section) => section.id)
  const checklistIds = rebuilt.checklist.map((item) => item.id)

  assert.equal(rebuilt.id, plan.id)
  assert.equal(rebuilt.title, 'A visit to Dr. Lee’s office')
  assert.ok(sectionIds.includes('waiting') && !sectionIds.includes('sound'))
  assert.ok(checklistIds.includes('practice-waiting') && !checklistIds.includes('preview-sounds'))
  assert.equal(rebuilt.checklist.find((item) => item.id === 'read-story').completed, true)
  assert.equal(rebuilt.checklist.find((item) => item.id === 'practice-waiting').completed, false)
  assert.equal(rebuilt.journey.find((step) => step.id === 'get-ready').completed, true)
  assert.equal(rebuilt.photos[0].name, 'door.png')
  assert.notEqual(rebuilt.sections[0].sentences[0], 'A sentence I wrote.')
  assert.ok(rebuilt.sections.every((section) => !section.edited))
  assert.equal(rebuilt.createdAt, plan.createdAt)

  const invalid = await api.send('PUT', `/api/stories/${plan.id}/plan`, { destination: 'X', profile: { sound: 'loud' } })
  assert.equal(invalid.status, 400)
  assert.equal((await api.get(`/api/stories/${plan.id}`).then((r) => r.json())).title, rebuilt.title)
  assert.equal((await api.send('PUT', '/api/stories/missing/plan', { destination: 'X' })).status, 404)
})

test('place reports and new places go through the API with clear errors', async (context) => {
  const api = await startTestServer(context)
  const options = await (await api.get('/api/place-options')).json()
  assert.ok(options.placeTypes.includes('Dentist'))
  assert.deepEqual(options.categories.map((category) => category.id), ['noise', 'lighting', 'crowds', 'waits'])

  const reported = await api.send('POST', '/api/places/greenway-garden/ratings', {
    lighting: 2, quietSpace: 'yes', note: '<b>Shady</b> benches near the pond',
  })
  assert.equal(reported.status, 201)
  const garden = (await reported.json()).places.find((place) => place.id === 'greenway-garden')
  assert.equal(garden.reportCount, 1)
  assert.equal(garden.notes[0].text, '<b>Shady</b> benches near the pond')

  const empty = await api.send('POST', '/api/places/greenway-garden/ratings', {})
  assert.equal(empty.status, 400)
  assert.match((await empty.json()).error, /at least one/)
  assert.equal((await api.send('POST', '/api/places/nowhere/ratings', { noise: 1 })).status, 404)

  const added = await api.send('POST', '/api/places', { name: 'Elm Park', placeType: 'Park or garden' })
  assert.equal(added.status, 201)
  const { place } = await added.json()
  assert.equal(place.origin, 'family')
  assert.equal((await api.send('POST', '/api/places', { name: 'ELM PARK', placeType: 'Other' })).status, 409)
  assert.equal((await api.send('POST', '/api/places', { name: 'Elm', placeType: 'Spaceport' })).status, 400)
})
