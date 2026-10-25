import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createDatabase, listStorySummaries, serializeStory } from './database.js'
import {
  buildPlan,
  getPlanOptions,
  isVisitType,
  ProfileError,
  sectionsToPages,
} from './personalization.js'
import {
  addPlace,
  addReport,
  cleanNewPlace,
  cleanReport,
  DuplicatePlaceError,
  FEW_REPORTS,
  listPlaces,
  PLACE_TYPES,
  PlaceInputError,
  RATING_CATEGORIES,
} from './places.js'
import { cleanReflection, previousVisitNotes, ReflectionError } from './reflection.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const databasePath = process.env.DATABASE_PATH || path.resolve(here, '../.data/app.sqlite')

// Problems with what the user sent. These become 400 responses; any other
// error is a server bug and goes to the 500 handler.
class ValidationError extends Error {}

// Keeps punctuation inside names such as "Dr. Lee's office" and only removes
// end punctuation that would clash with the sentence around it.
function cleanName(value, field, maxLength, required) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} is required.`)
    return ''
  }
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text.`)
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?,;:]+$/, '')
  if (required && !cleaned) throw new ValidationError(`${field} is required.`)
  if (cleaned.length > maxLength) {
    throw new ValidationError(`${field} must be ${maxLength} characters or fewer.`)
  }
  return cleaned
}

function cleanPhotos(value) {
  if (!Array.isArray(value)) throw new ValidationError('Photos must be a list.')
  if (value.length > 4) throw new ValidationError('Upload no more than four photos.')
  let totalCharacters = 0
  const photos = value.map((photo) => {
    if (!photo || typeof photo !== 'object') throw new ValidationError('A photo could not be read.')
    if (typeof photo.name !== 'string') throw new ValidationError('A photo needs a file name.')
    const name = path.basename(photo.name).replace(/[\u0000-\u001f\u007f]/g, '').trim()
    if (!name || name.length > 200) throw new ValidationError('Photo name must be under 200 characters.')
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(photo.type)) {
      throw new ValidationError('Photos must be JPEG, PNG, or WEBP images.')
    }
    if (typeof photo.dataUrl !== 'string'
      || !photo.dataUrl.startsWith(`data:${photo.type};base64,`)) {
      throw new ValidationError('A photo could not be read as an image.')
    }
    if (photo.dataUrl.length > 3_000_000) {
      throw new ValidationError('Each photo must be smaller than 2 MB.')
    }
    totalCharacters += photo.dataUrl.length
    return { name, type: photo.type, dataUrl: photo.dataUrl }
  })
  if (totalCharacters > 10_000_000) throw new ValidationError('The combined photo size is too large.')
  return photos
}

// A plan needs a destination and visit type; the profile is optional.
// Stories saved by the earlier template generator are still read and shown,
// but new stories are always created this way.
// Checks the visit details and builds the plan. Used both when a plan is
// created and when a caregiver changes its preferences.
function buildPlanFromInput(body) {
  const destination = cleanName(body.destination, 'Destination', 100, true)
  const visitType = body.visitType ?? 'other'
  if (!isVisitType(visitType)) throw new ValidationError('Choose one of the available visit types.')
  const nickname = cleanName(body.nickname, 'Nickname', 40, false)
  const plan = buildPlan({ destination, visitType, profile: body.profile })
  return {
    title: `A visit to ${destination}`,
    destination,
    placeType: getPlanOptions().visitTypes.find((type) => type.id === visitType).label,
    visitType,
    nickname,
    profile: plan.profile,
    sections: plan.sections,
    pages: sectionsToPages(plan.sections),
    checklist: plan.checklist.map((item) => ({ ...item, completed: false })),
    planDetails: {
      suggestions: plan.suggestions,
      questionsForVenue: plan.questionsForVenue,
      generalInfoNotice: plan.generalInfoNotice,
    },
  }
}

function createPersonalizedStory(body) {
  const photos = cleanPhotos(body.photos ?? [])
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    ...buildPlanFromInput(body),
    readingLevel: '',
    triggers: [],
    copingTools: [],
    photos,
    createdAt: now,
    updatedAt: now,
  }
}

const MAX_SENTENCES_PER_SECTION = 6
const MAX_SENTENCE_LENGTH = 200

// Keeps the sentence's own ending (., ?, or !) and adds a full stop if it has none.
function cleanSentence(value, sectionTitle) {
  if (typeof value !== 'string') throw new ValidationError(`Each sentence in “${sectionTitle}” must be text.`)
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (cleaned.length > MAX_SENTENCE_LENGTH) {
    throw new ValidationError(`Sentences in “${sectionTitle}” must be ${MAX_SENTENCE_LENGTH} characters or fewer.`)
  }
  if (!cleaned) return ''
  return /[.!?]["”')]*$/.test(cleaned) ? cleaned : `${cleaned}.`
}

// Checks a caregiver's edited story wording. The parts must stay the same and
// in the same order; only their sentences change.
function cleanEditedSections(value, savedSections) {
  if (!Array.isArray(value) || value.length !== savedSections.length) {
    throw new ValidationError('The edited story must keep the same parts.')
  }
  return savedSections.map((saved, index) => {
    const edit = value[index]
    if (!edit || edit.id !== saved.id) throw new ValidationError('The edited story must keep the same parts in order.')
    if (!Array.isArray(edit.sentences)) throw new ValidationError(`“${saved.title}” must be a list of sentences.`)
    const sentences = edit.sentences.map((sentence) => cleanSentence(sentence, saved.title)).filter(Boolean)
    if (sentences.length === 0) throw new ValidationError(`“${saved.title}” needs at least one sentence.`)
    if (sentences.length > MAX_SENTENCES_PER_SECTION) {
      throw new ValidationError(`“${saved.title}” can have at most ${MAX_SENTENCES_PER_SECTION} sentences.`)
    }
    const changed = sentences.join('\n') !== saved.sentences.join('\n')
    return { ...saved, sentences, edited: saved.edited === true || changed }
  })
}

function createApp(database = createDatabase(databasePath)) {
  const app = express()
  app.use(express.json({ limit: '16mb' }))

  const findStory = (id) => serializeStory(
    database.prepare('SELECT * FROM stories WHERE id = ?').get(id),
  )

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'ready-together-api' })
  })

  app.get('/api/plan-options', (_request, response) => {
    response.json(getPlanOptions())
  })

  app.get('/api/stories', (_request, response) => {
    response.json(listStorySummaries(database))
  })

  app.post('/api/stories', (request, response) => {
    const body = request.body ?? {}
    let story
    try {
      story = createPersonalizedStory(body)
      // Only when the caregiver chose to bring notes forward from a past visit.
      if (body.carryNotesFrom !== undefined) {
        if (typeof body.carryNotesFrom !== 'string') throw new ValidationError('Choose a past visit from the list.')
        story.planDetails.previousVisit = previousVisitNotes(findStory(body.carryNotesFrom))
      }
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ProfileError || error instanceof ReflectionError) {
        return response.status(400).json({ error: error.message })
      }
      throw error
    }

    database.prepare(`
      INSERT INTO stories (
        id, title, destination, place_type, visit_type, nickname, reading_level,
        profile_json, triggers_json, coping_tools_json, sections_json, pages_json,
        photos_json, checklist_json, plan_details_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      story.id,
      story.title,
      story.destination,
      story.placeType,
      story.visitType,
      story.nickname,
      story.readingLevel,
      story.profile && JSON.stringify(story.profile),
      JSON.stringify(story.triggers),
      JSON.stringify(story.copingTools),
      story.sections && JSON.stringify(story.sections),
      JSON.stringify(story.pages),
      JSON.stringify(story.photos),
      JSON.stringify(story.checklist),
      story.planDetails && JSON.stringify(story.planDetails),
      story.createdAt,
      story.updatedAt,
    )

    return response.status(201).json(serializeStory(
      database.prepare('SELECT * FROM stories WHERE id = ?').get(story.id),
    ))
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
    database.prepare('UPDATE stories SET checklist_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(checklist), new Date().toISOString(), story.id)
    return response.json({ checklist })
  })

  // Saves a caregiver's edits to the story wording.
  app.put('/api/stories/:id/sections', (request, response) => {
    const story = findStory(request.params.id)
    if (!story) return response.status(404).json({ error: 'Story not found.' })
    if (!story.sections) {
      return response.status(400).json({ error: 'This story was saved before editable plans. Change its preferences to rebuild it first.' })
    }
    let sections
    try {
      sections = cleanEditedSections(request.body?.sections, story.sections)
    } catch (error) {
      if (error instanceof ValidationError) return response.status(400).json({ error: error.message })
      throw error
    }
    database.prepare('UPDATE stories SET sections_json = ?, pages_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(sections), JSON.stringify(sectionsToPages(sections)), new Date().toISOString(), story.id)
    return response.json(findStory(story.id))
  })

  // Rebuilds the plan from changed preferences. Checklist ticks are kept for
  // items that are still in the plan; journey progress and photos are kept.
  // Wording edits are replaced, and the form warns about that first.
  app.put('/api/stories/:id/plan', (request, response) => {
    const story = findStory(request.params.id)
    if (!story) return response.status(404).json({ error: 'Story not found.' })
    let rebuilt
    try {
      rebuilt = buildPlanFromInput(request.body ?? {})
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ProfileError) {
        return response.status(400).json({ error: error.message })
      }
      throw error
    }
    // Notes brought forward from a past visit stay with the plan.
    if (story.previousVisit) rebuilt.planDetails.previousVisit = story.previousVisit
    const wasCompleted = new Map(story.checklist.map((item) => [item.id, item.completed]))
    const checklist = rebuilt.checklist.map((item) => ({ ...item, completed: wasCompleted.get(item.id) === true }))

    database.prepare(`
      UPDATE stories SET title = ?, destination = ?, place_type = ?, visit_type = ?, nickname = ?,
        profile_json = ?, sections_json = ?, pages_json = ?, checklist_json = ?,
        plan_details_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      rebuilt.title,
      rebuilt.destination,
      rebuilt.placeType,
      rebuilt.visitType,
      rebuilt.nickname,
      JSON.stringify(rebuilt.profile),
      JSON.stringify(rebuilt.sections),
      JSON.stringify(rebuilt.pages),
      JSON.stringify(checklist),
      JSON.stringify(rebuilt.planDetails),
      new Date().toISOString(),
      story.id,
    )
    return response.json(findStory(story.id))
  })

  // Saves the caregiver's post-visit reflection, and ticks the checklist item
  // that asks them to note what helped.
  app.put('/api/stories/:id/reflection', (request, response) => {
    const story = findStory(request.params.id)
    if (!story) return response.status(404).json({ error: 'Story not found.' })
    let reflection
    try {
      reflection = cleanReflection(request.body, story)
    } catch (error) {
      if (error instanceof ReflectionError) return response.status(400).json({ error: error.message })
      throw error
    }
    const checklist = story.checklist.map((item) => (item.id === 'reflect' ? { ...item, completed: true } : item))
    database.prepare('UPDATE stories SET reflection_json = ?, checklist_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(reflection), JSON.stringify(checklist), reflection.updatedAt, story.id)
    return response.json(findStory(story.id))
  })

  app.patch('/api/stories/:id/journey', (request, response) => {
    const story = findStory(request.params.id)
    if (!story) return response.status(404).json({ error: 'Story not found.' })
    if (!story.journey) {
      return response.status(400).json({ error: 'This story was saved before visit journeys and does not have one.' })
    }

    const { stepId, completed } = request.body ?? {}
    if (typeof stepId !== 'string' || typeof completed !== 'boolean') {
      return response.status(400).json({ error: 'Each journey update needs a stepId and a completed value.' })
    }
    if (!story.journey.some((step) => step.id === stepId)) {
      return response.status(400).json({ error: 'That step is not part of this plan.' })
    }

    const progress = Object.fromEntries(story.journey.map((step) => [
      step.id,
      step.id === stepId ? completed : step.completed,
    ]))
    database.prepare('UPDATE stories SET journey_progress_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(progress), new Date().toISOString(), story.id)
    return response.json({ journey: findStory(story.id).journey })
  })

  app.get('/api/place-options', (_request, response) => {
    response.json({ placeTypes: PLACE_TYPES, categories: RATING_CATEGORIES, fewReports: FEW_REPORTS })
  })

  app.get('/api/places', (_request, response) => {
    response.json(listPlaces(database))
  })

  app.post('/api/places', (request, response) => {
    let place
    try {
      place = cleanNewPlace(request.body, database)
    } catch (error) {
      if (error instanceof PlaceInputError) return response.status(400).json({ error: error.message })
      if (error instanceof DuplicatePlaceError) return response.status(409).json({ error: error.message })
      throw error
    }
    const id = addPlace(database, place)
    const places = listPlaces(database)
    return response.status(201).json({ place: places.find((item) => item.id === id), places })
  })

  app.post('/api/places/:id/ratings', (request, response) => {
    const place = database.prepare('SELECT id FROM places WHERE id = ?').get(request.params.id)
    if (!place) return response.status(404).json({ error: 'Place not found.' })
    let report
    try {
      report = cleanReport(request.body)
    } catch (error) {
      if (error instanceof PlaceInputError) return response.status(400).json({ error: error.message })
      throw error
    }
    addReport(database, place.id, report)
    return response.status(201).json({
      places: listPlaces(database),
      message: 'Thank you. Your report was saved.',
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
