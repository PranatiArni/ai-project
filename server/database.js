import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const here = path.dirname(fileURLToPath(import.meta.url))

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

  const samplePlacesPath = path.resolve(here, '../client/src/data/samplePlaces.json')
  const samplePlaces = JSON.parse(fs.readFileSync(samplePlacesPath, 'utf8'))
  const insertPlace = db.prepare(`
    INSERT OR IGNORE INTO places (id, name, place_type, sample_calm_score)
    VALUES (@id, @name, @placeType, @calmScore)
  `)
  const seedPlaces = db.transaction((places) => {
    for (const place of places) insertPlace.run(place)
  })
  seedPlaces(samplePlaces)

  return db
}

export function serializeStory(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    placeType: row.place_type,
    nickname: row.nickname,
    readingLevel: row.reading_level,
    triggers: JSON.parse(row.triggers_json),
    copingTools: JSON.parse(row.coping_tools_json),
    pages: JSON.parse(row.pages_json),
    photos: JSON.parse(row.photos_json),
    checklist: JSON.parse(row.checklist_json),
    createdAt: row.created_at,
  }
}

export function listPlaces(db) {
  return db.prepare(`
    SELECT id, name, place_type, sample_calm_score, noise_sum, crowds_sum,
      waits_sum, rating_count
    FROM places
  `).all().map((place) => {
    const calmScore = place.rating_count
      ? Math.round(
        (6 - (place.noise_sum + place.crowds_sum + place.waits_sum)
          / (place.rating_count * 3)) * 10,
      ) / 10
      : place.sample_calm_score

    return {
      id: place.id,
      name: place.name,
      placeType: place.place_type,
      calmScore,
      ratingCount: place.rating_count,
    }
  }).sort((a, b) => b.calmScore - a.calmScore || a.name.localeCompare(b.name))
}
