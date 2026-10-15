import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createDatabase, listPlaces, serializeStory } from './database.js'
import { generateStory, maxStoryTriggers } from './storyGenerator.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const databasePath = process.env.DATABASE_PATH || path.resolve(here, '../.data/app.sqlite')

function cleanText(value, field, maxLength) {
  if (typeof value !== 'string') throw new Error(`${field} is required.`)
  const cleaned = value.trim().replace(/[.!?]+/g, '').replace(/\s+/g, ' ')
  if (!cleaned || cleaned.length > maxLength) {
    throw new Error(`${field} must be between 1 and ${maxLength} characters.`)
  }
  return cleaned
}

function cleanList(value, field, maxItems, required = false) {
  if (!Array.isArray(value)) throw new Error(`${field} must be a list.`)
  const list = value.map((item) => cleanText(item, field, 120))
  if (list.length > maxItems) throw new Error(`${field} can contain at most ${maxItems} items.`)
  if (required && list.length === 0) throw new Error(`Add at least one ${field.toLowerCase()}.`)
  return list
}

function cleanPhotos(value) {
  if (!Array.isArray(value)) throw new Error('Photos must be a list.')
  if (value.length > 4) throw new Error('Upload no more than four photos.')
  let totalCharacters = 0
  const photos = value.map((photo) => {
    if (!photo || typeof photo !== 'object') throw new Error('A photo could not be read.')
    if (typeof photo.name !== 'string') throw new Error('A photo needs a file name.')
    const name = path.basename(photo.name).replace(/[\u0000-\u001f\u007f]/g, '').trim()
    if (!name || name.length > 200) throw new Error('Photo name must be under 200 characters.')
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(photo.type)) {
      throw new Error('Photos must be JPEG, PNG, or WEBP images.')
    }
    if (typeof photo.dataUrl !== 'string'
      || !photo.dataUrl.startsWith(`data:${photo.type};base64,`)) {
      throw new Error('A photo could not be read as an image.')
    }
    if (photo.dataUrl.length > 3_000_000) {
      throw new Error('Each photo must be smaller than 2 MB.')
    }
    totalCharacters += photo.dataUrl.length
    return { name, type: photo.type, dataUrl: photo.dataUrl }
  })
  if (totalCharacters > 10_000_000) throw new Error('The combined photo size is too large.')
  return photos
}

function createChecklist(copingTools) {
  return [
    { id: 'read-story', label: 'Read my story before we go', completed: false },
    {
      id: 'pack-coping-tools',
      label: `Pack my coping tools: ${copingTools.join(', ')}`,
      completed: false,
    },
    { id: 'travel', label: 'Travel to the place with my grown-up', completed: false },
    { id: 'look-around', label: 'Look around and take one step at a time', completed: false },
    { id: 'finish-visit', label: 'Finish the visit and celebrate trying', completed: false },
  ]
}

function createApp(database = createDatabase(databasePath)) {
  const app = express()
  app.use(express.json({ limit: '16mb' }))

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'ready-together-api' })
  })

  app.get('/api/stories', (_request, response) => {
    const stories = database.prepare('SELECT * FROM stories ORDER BY created_at DESC')
      .all().map(serializeStory)
    response.json(stories)
  })

  app.post('/api/stories', (request, response) => {
    let story
    try {
      const destination = cleanText(request.body.destination, 'Destination', 100)
      const placeType = cleanText(request.body.placeType, 'Place type', 80)
      const nickname = cleanText(request.body.nickname, "Child's nickname", 40)
      const readingLevel = cleanText(request.body.readingLevel, 'Reading level', 40)
      if (!['Early reader', 'Beginning reader', 'Independent reader'].includes(readingLevel)) {
        throw new Error('Choose one of the available reading levels.')
      }
      const triggers = cleanList(request.body.triggers, 'Triggers', maxStoryTriggers)
      const copingTools = cleanList(request.body.copingTools, 'Coping tools', 12, true)
      const photos = cleanPhotos(request.body.photos ?? [])
      const pages = generateStory({
        destination,
        placeType,
        nickname,
        readingLevel,
        triggers,
        copingTools,
        hasPhotos: photos.length > 0,
      })
      story = {
        id: crypto.randomUUID(),
        title: `A visit to ${destination}`,
        destination,
        placeType,
        nickname,
        readingLevel,
        triggers,
        copingTools,
        pages,
        photos,
        checklist: createChecklist(copingTools),
        createdAt: new Date().toISOString(),
      }
    } catch (error) {
      return response.status(400).json({ error: error.message })
    }

    database.prepare(`
      INSERT INTO stories (
        id, title, destination, place_type, nickname, reading_level, triggers_json,
        coping_tools_json, pages_json, photos_json, checklist_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      story.id,
      story.title,
      story.destination,
      story.placeType,
      story.nickname,
      story.readingLevel,
      JSON.stringify(story.triggers),
      JSON.stringify(story.copingTools),
      JSON.stringify(story.pages),
      JSON.stringify(story.photos),
      JSON.stringify(story.checklist),
      story.createdAt,
    )

    return response.status(201).json(story)
  })

  app.get('/api/stories/:id', (request, response) => {
    const story = serializeStory(
      database.prepare('SELECT * FROM stories WHERE id = ?').get(request.params.id),
    )
    if (!story) return response.status(404).json({ error: 'Story not found.' })
    return response.json(story)
  })

  app.patch('/api/stories/:id/checklist', (request, response) => {
    const story = serializeStory(
      database.prepare('SELECT * FROM stories WHERE id = ?').get(request.params.id),
    )
    if (!story) return response.status(404).json({ error: 'Story not found.' })
    if (!Array.isArray(request.body.checklist)) {
      return response.status(400).json({ error: 'Checklist must be a list.' })
    }

    const updates = new Map()
    for (const item of request.body.checklist) {
      if (!item || typeof item.id !== 'string' || typeof item.completed !== 'boolean') {
        return response.status(400).json({ error: 'Each checklist update needs an id and completed value.' })
      }
      updates.set(item.id, item.completed)
    }
    if (updates.size !== story.checklist.length
      || story.checklist.some((step) => !updates.has(step.id))) {
      return response.status(400).json({ error: 'Checklist steps do not match this story.' })
    }

    const checklist = story.checklist.map((step) => ({
      ...step,
      completed: updates.get(step.id),
    }))
    database.prepare('UPDATE stories SET checklist_json = ? WHERE id = ?')
      .run(JSON.stringify(checklist), story.id)
    return response.json({ checklist })
  })

  app.get('/api/places', (_request, response) => {
    response.json(listPlaces(database))
  })

  app.post('/api/places/:id/ratings', (request, response) => {
    const place = database.prepare('SELECT id FROM places WHERE id = ?').get(request.params.id)
    if (!place) return response.status(404).json({ error: 'Place not found.' })

    const { noise, crowds, waits } = request.body ?? {}
    if (![noise, crowds, waits].every(
      (score) => Number.isInteger(score) && score >= 1 && score <= 5,
    )) {
      return response.status(400).json({ error: 'Noise, crowds, and waits must each be a score from 1 to 5.' })
    }

    const addRating = database.transaction(() => {
      database.prepare(`
        INSERT INTO ratings (id, place_id, noise, crowds, waits, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), place.id, noise, crowds, waits, new Date().toISOString())
      database.prepare(`
        UPDATE places
        SET noise_sum = noise_sum + ?, crowds_sum = crowds_sum + ?,
          waits_sum = waits_sum + ?, rating_count = rating_count + 1
        WHERE id = ?
      `).run(noise, crowds, waits, place.id)
    })
    addRating()

    return response.status(201).json({
      places: listPlaces(database),
      message: 'Rating saved. Place rankings updated.',
    })
  })

  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.too.large') {
      return response.status(413).json({ error: 'The request is too large. Try fewer or smaller photos.' })
    }
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'The request body must contain valid JSON.' })
    }
    console.error(error)
    return response.status(500).json({ error: 'The server could not complete that request.' })
  })

  return app
}

const port = Number(process.env.PORT || 3001)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp(createDatabase(databasePath)).listen(port, '0.0.0.0', () => {
    console.log(`Ready Together API listening on port ${port}`)
  })
}

export { createApp }
