import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { createDatabase, listStorySummaries, schemaVersion, serializeStory } from './database.js'

// The stories table exactly as it was before personalization (commit 6fa22ea).
const ORIGINAL_STORIES_TABLE = `
  CREATE TABLE stories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    place_type TEXT NOT NULL,
    nickname TEXT NOT NULL,
    reading_level TEXT NOT NULL,
    triggers_json TEXT NOT NULL,
    coping_tools_json TEXT NOT NULL,
    pages_json TEXT NOT NULL,
    photos_json TEXT NOT NULL,
    checklist_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`

function temporaryDatabasePath(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-together-db-'))
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return path.join(directory, 'app.sqlite')
}

test('an existing database from before personalization upgrades without losing stories', (context) => {
  const databasePath = temporaryDatabasePath(context)
  const original = new Database(databasePath)
  original.exec(ORIGINAL_STORIES_TABLE)
  original.prepare(`
    INSERT INTO stories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'old-story',
    'A visit to the dentist',
    'the dentist',
    'Dentist',
    'Sam',
    'Early reader',
    JSON.stringify(['loud sounds']),
    JSON.stringify(['headphones']),
    JSON.stringify([{ number: 1, sentences: ['Sam is going to the dentist.'] }]),
    '[]',
    JSON.stringify([{ id: 'read-story', label: 'Read my story before we go', completed: true }]),
    '2026-10-01T12:00:00.000Z',
  )
  assert.equal(original.pragma('user_version', { simple: true }), 0)
  original.close()

  const upgraded = createDatabase(databasePath)
  context.after(() => upgraded.close())
  assert.equal(upgraded.pragma('user_version', { simple: true }), schemaVersion)

  const story = serializeStory(upgraded.prepare('SELECT * FROM stories WHERE id = ?').get('old-story'))
  assert.equal(story.nickname, 'Sam')
  assert.equal(story.readingLevel, 'Early reader')
  assert.deepEqual(story.triggers, ['loud sounds'])
  assert.equal(story.pages[0].sentences[0], 'Sam is going to the dentist.')
  assert.equal(story.checklist[0].completed, true)
  assert.equal(story.visitType, null)
  assert.equal(story.profile, null)
  assert.equal(story.sections, null)
  assert.deepEqual(story.suggestions, [])
  assert.equal(story.updatedAt, '2026-10-01T12:00:00.000Z')

  assert.deepEqual(listStorySummaries(upgraded)[0].checklistProgress, { completed: 1, total: 1 })
})

test('opening the same database again does not re-run migrations', (context) => {
  const databasePath = temporaryDatabasePath(context)
  createDatabase(databasePath).close()
  const reopened = createDatabase(databasePath)
  context.after(() => reopened.close())
  assert.equal(reopened.pragma('user_version', { simple: true }), schemaVersion)
  const columns = reopened.prepare('PRAGMA table_info(stories)').all().map((column) => column.name)
  assert.equal(columns.filter((name) => name === 'profile_json').length, 1)
})
