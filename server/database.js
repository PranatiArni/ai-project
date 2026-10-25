import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { buildJourney } from './personalization.js'

const here = path.dirname(fileURLToPath(import.meta.url))

// Each migration runs once, in order. SQLite's `user_version` records how many
// have been applied. Only add new migrations to the end; never edit old ones.
const MIGRATIONS = [
  // 1: Personalized plans. New columns are nullable so older saved stories
  // keep working unchanged.
  `
    ALTER TABLE stories ADD COLUMN visit_type TEXT;
    ALTER TABLE stories ADD COLUMN profile_json TEXT;
    ALTER TABLE stories ADD COLUMN sections_json TEXT;
    ALTER TABLE stories ADD COLUMN plan_details_json TEXT;
    ALTER TABLE stories ADD COLUMN updated_at TEXT;
  `,
  // 2: Which visit-journey steps are done. The steps themselves are built
  // from the saved plan, so only progress is stored.
  `
    ALTER TABLE stories ADD COLUMN journey_progress_json TEXT;
  `,
  // 3: Trustworthy place reports. Places record whether they are examples
  // (every place before this migration was a seeded example) or added by a
  // family. Ratings are rebuilt so each answer can be left as "not sure"
  // (NULL), with lighting, quiet space, and a short note added. Existing
  // ratings are copied across unchanged.
  `
    ALTER TABLE places ADD COLUMN origin TEXT NOT NULL DEFAULT 'family';
    ALTER TABLE places ADD COLUMN created_at TEXT;
    UPDATE places SET origin = 'example';

    CREATE TABLE ratings_v3 (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      noise INTEGER CHECK(noise BETWEEN 1 AND 5),
      lighting INTEGER CHECK(lighting BETWEEN 1 AND 5),
      crowds INTEGER CHECK(crowds BETWEEN 1 AND 5),
      waits INTEGER CHECK(waits BETWEEN 1 AND 5),
      quiet_space TEXT CHECK(quiet_space IN ('yes', 'no')),
      note TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO ratings_v3 (id, place_id, noise, crowds, waits, created_at)
      SELECT id, place_id, noise, crowds, waits, created_at FROM ratings;
    DROP TABLE ratings;
    ALTER TABLE ratings_v3 RENAME TO ratings;
    CREATE INDEX ratings_by_place ON ratings(place_id, created_at);
  `,
]

export const schemaVersion = MIGRATIONS.length

function migrate(db) {
  const applied = db.pragma('user_version', { simple: true })
  for (let version = applied; version < MIGRATIONS.length; version += 1) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version])
      db.pragma(`user_version = ${version + 1}`)
    })()
  }
}

export function createDatabase(databasePath = path.resolve(here, '../.data/app.sqlite')) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const db = new Database(databasePath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
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

    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      place_type TEXT NOT NULL,
      sample_calm_score REAL NOT NULL,
      noise_sum INTEGER NOT NULL DEFAULT 0,
      crowds_sum INTEGER NOT NULL DEFAULT 0,
      waits_sum INTEGER NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      noise INTEGER NOT NULL CHECK(noise BETWEEN 1 AND 5),
      crowds INTEGER NOT NULL CHECK(crowds BETWEEN 1 AND 5),
      waits INTEGER NOT NULL CHECK(waits BETWEEN 1 AND 5),
      created_at TEXT NOT NULL
    );
  `)
  migrate(db)

  // Example places for trying the app. They are not real venues and start with
  // no reports. sample_calm_score is an old required column that is no longer
  // used, so it is set to 0.
  const examplePlaces = JSON.parse(fs.readFileSync(path.resolve(here, 'data/examplePlaces.json'), 'utf8'))
  const insertPlace = db.prepare(`
    INSERT OR IGNORE INTO places (id, name, place_type, sample_calm_score, origin)
    VALUES (@id, @name, @placeType, 0, 'example')
  `)
  const seedPlaces = db.transaction((places) => {
    for (const place of places) insertPlace.run(place)
  })
  seedPlaces(examplePlaces)

  return db
}

function parseJson(value, fallback) {
  return value ? JSON.parse(value) : fallback
}

function checklistProgress(checklist) {
  return {
    completed: checklist.filter((step) => step.completed).length,
    total: checklist.length,
  }
}

// Stories saved before personalization have null visit_type, profile_json,
// sections_json, and plan_details_json; those fields come back as null or [].
export function serializeStory(row) {
  if (!row) return null
  const details = parseJson(row.plan_details_json, {})
  const sections = parseJson(row.sections_json, null)
  const checklist = JSON.parse(row.checklist_json)
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    placeType: row.place_type,
    visitType: row.visit_type ?? null,
    nickname: row.nickname || null,
    readingLevel: row.reading_level || null,
    profile: parseJson(row.profile_json, null),
    triggers: JSON.parse(row.triggers_json),
    copingTools: JSON.parse(row.coping_tools_json),
    sections,
    pages: JSON.parse(row.pages_json),
    photos: JSON.parse(row.photos_json),
    checklist,
    journey: buildJourney({ sections, checklist }, parseJson(row.journey_progress_json, {})),
    suggestions: details.suggestions ?? [],
    questionsForVenue: details.questionsForVenue ?? [],
    generalInfoNotice: details.generalInfoNotice ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  }
}

// Lightweight rows for the saved-visits list; leaves out photos and story text.
export function listStorySummaries(db) {
  return db.prepare(`
    SELECT id, title, destination, place_type, visit_type, checklist_json,
      created_at, updated_at
    FROM stories ORDER BY created_at DESC
  `).all().map((row) => ({
    id: row.id,
    title: row.title,
    destination: row.destination,
    placeType: row.place_type,
    visitType: row.visit_type ?? null,
    checklistProgress: checklistProgress(JSON.parse(row.checklist_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  }))
}
