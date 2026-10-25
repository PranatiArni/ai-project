import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { createDatabase, schemaVersion } from './database.js'
import {
  addPlace,
  addReport,
  cleanNewPlace,
  cleanReport,
  DuplicatePlaceError,
  listPlaces,
  PlaceInputError,
} from './places.js'

function temporaryDatabase(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-together-places-'))
  const db = createDatabase(path.join(directory, 'app.sqlite'))
  context.after(() => {
    db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return db
}

const find = (places, id) => places.find((place) => place.id === id)

test('example places are labeled and start with no invented scores', (context) => {
  const places = listPlaces(temporaryDatabase(context))
  assert.equal(places.length, 3)
  for (const place of places) {
    assert.equal(place.origin, 'example')
    assert.equal(place.calmScore, null)
    assert.equal(place.reportCount, 0)
    assert.ok(place.categories.every((category) => category.summary === 'Unknown' && category.average === null))
  }
})

test('"not sure" answers are left out of averages instead of counted', (context) => {
  const db = temporaryDatabase(context)
  addReport(db, 'riverside-library', cleanReport({ noise: 1, crowds: 2 }))
  addReport(db, 'riverside-library', cleanReport({ noise: 3, lighting: 5, quietSpace: 'yes' }))
  addReport(db, 'riverside-library', cleanReport({ quietSpace: 'no', note: 'Story time was loud.' }))
  const library = find(listPlaces(db), 'riverside-library')

  assert.equal(library.reportCount, 3)
  const byId = Object.fromEntries(library.categories.map((category) => [category.id, category]))
  assert.deepEqual(byId.noise, { id: 'noise', label: 'Noise', reports: 2, average: 2, summary: 'Mostly calm' })
  assert.equal(byId.lighting.average, 5)
  assert.equal(byId.lighting.summary, 'Often hard')
  assert.equal(byId.crowds.reports, 1)
  assert.equal(byId.waits.summary, 'Unknown')
  assert.deepEqual(library.quietSpace, { yes: 1, no: 1 })
  // 6 minus the average of the answered categories: (2 + 5 + 2) / 3 = 3
  assert.equal(library.calmScore, 3)
})

test('places with reports are ranked first, calmest first', (context) => {
  const db = temporaryDatabase(context)
  addReport(db, 'greenway-garden', cleanReport({ noise: 4 }))
  addReport(db, 'northside-market', cleanReport({ noise: 1 }))
  const places = listPlaces(db)
  assert.deepEqual(places.map((place) => place.id), ['northside-market', 'greenway-garden', 'riverside-library'])
})

test('notes are newest first, limited to three, and reports age out', (context) => {
  const db = temporaryDatabase(context)
  const day = (n) => new Date(Date.UTC(2025, 0, n))
  for (const n of [1, 2, 3, 4]) addReport(db, 'greenway-garden', cleanReport({ note: `Visit ${n}` }), day(n))
  const garden = (now) => find(listPlaces(db, now), 'greenway-garden')

  assert.deepEqual(garden(day(10)).notes.map((note) => note.text), ['Visit 4', 'Visit 3', 'Visit 2'])
  assert.equal(garden(day(10)).latestReportAt, day(4).toISOString())
  assert.equal(garden(day(10)).outdated, false)
  assert.equal(garden(new Date(Date.UTC(2026, 0, 20))).outdated, true)
})

test('reports are validated', () => {
  const invalid = [
    {},
    { noise: 0 },
    { noise: 6 },
    { noise: 2.5 },
    { noise: '3' },
    { quietSpace: 'maybe' },
    { note: 42 },
    { note: 'x'.repeat(281) },
    { note: '   ' },
  ]
  for (const body of invalid) assert.throws(() => cleanReport(body), PlaceInputError, JSON.stringify(body))
  assert.deepEqual(cleanReport({ waits: 5, quietSpace: 'not-sure', note: ' Line one\nline two ' }), {
    noise: null, lighting: null, crowds: null, waits: 5, quietSpace: null, note: 'Line one line two',
  })
})

test('families can add a place, and duplicates are refused', (context) => {
  const db = temporaryDatabase(context)
  const id = addPlace(db, cleanNewPlace({ name: '  Maple   Street Dental ', placeType: 'Dentist' }, db))
  const added = find(listPlaces(db), id)
  assert.equal(added.name, 'Maple Street Dental')
  assert.equal(added.origin, 'family')
  assert.equal(added.calmScore, null)

  assert.throws(() => cleanNewPlace({ name: 'maple street dental', placeType: 'Dentist' }, db), DuplicatePlaceError)
  assert.throws(() => cleanNewPlace({ name: 'X', placeType: 'Dentist' }, db), PlaceInputError)
  assert.throws(() => cleanNewPlace({ name: 'A new place', placeType: 'Castle' }, db), PlaceInputError)
  assert.throws(() => cleanNewPlace({ placeType: 'Dentist' }, db), PlaceInputError)
})

test('migration 3 keeps old ratings and marks seeded places as examples', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-together-places-'))
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const databasePath = path.join(directory, 'app.sqlite')

  // The places and ratings tables exactly as they were before this migration.
  const original = new Database(databasePath)
  original.exec(`
    CREATE TABLE places (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, place_type TEXT NOT NULL,
      sample_calm_score REAL NOT NULL, noise_sum INTEGER NOT NULL DEFAULT 0,
      crowds_sum INTEGER NOT NULL DEFAULT 0, waits_sum INTEGER NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE ratings (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      noise INTEGER NOT NULL CHECK(noise BETWEEN 1 AND 5),
      crowds INTEGER NOT NULL CHECK(crowds BETWEEN 1 AND 5),
      waits INTEGER NOT NULL CHECK(waits BETWEEN 1 AND 5),
      created_at TEXT NOT NULL
    );
    INSERT INTO places VALUES ('riverside-library', 'Riverside Library', 'Library', 4.8, 2, 2, 2, 1);
    INSERT INTO ratings VALUES ('r1', 'riverside-library', 2, 2, 2, '2026-10-01T00:00:00.000Z');
  `)
  original.close()

  const db = createDatabase(databasePath)
  context.after(() => db.close())
  assert.equal(db.pragma('user_version', { simple: true }), schemaVersion)
  const library = find(listPlaces(db), 'riverside-library')
  assert.equal(library.origin, 'example')
  assert.equal(library.reportCount, 1)
  assert.equal(library.calmScore, 4)
  assert.equal(library.categories.find((category) => category.id === 'lighting').summary, 'Unknown')
  // New reports can now leave categories as "not sure".
  addReport(db, 'riverside-library', cleanReport({ lighting: 1 }))
  assert.equal(find(listPlaces(db), 'riverside-library').reportCount, 2)
})
