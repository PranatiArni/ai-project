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
      placeType: 'dentist office',
      nickname: 'Sam',
      readingLevel: 'Early reader',
      triggers: ['loud sounds'],
      copingTools: ['headphones'],
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
