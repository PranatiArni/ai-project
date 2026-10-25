// Places and family reports. Every number shown for a place comes from
// reports saved in this app; nothing is invented or verified. Places with no
// reports show "Unknown" instead of a score.
import crypto from 'node:crypto'

export const RATING_CATEGORIES = [
  { id: 'noise', label: 'Noise' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'crowds', label: 'Crowds' },
  { id: 'waits', label: 'Waiting' },
]

export const PLACE_TYPES = [
  'Dentist', 'Doctor', 'Hair salon', 'Grocery store', 'Restaurant',
  'Theme park or attraction', 'Library', 'Park or garden', 'Other',
]

const MAX_NOTE_LENGTH = 280
const NOTES_SHOWN = 3
// Below this many reports, the page says a score may not reflect most visits.
export const FEW_REPORTS = 3
// Reports older than this are flagged as possibly out of date.
export const OUTDATED_AFTER_DAYS = 365

export class PlaceInputError extends Error {}
export class DuplicatePlaceError extends Error {}

function cleanText(value) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Each category is a whole number from 1 (calm) to 5 (very challenging), or
// missing/null for "not sure". At least one answer or a note is required.
export function cleanReport(body) {
  const input = body ?? {}
  const report = {}
  for (const { id, label } of RATING_CATEGORIES) {
    const value = input[id]
    if (value === undefined || value === null) {
      report[id] = null
    } else if (Number.isInteger(value) && value >= 1 && value <= 5) {
      report[id] = value
    } else {
      throw new PlaceInputError(`${label} must be a score from 1 to 5, or left as not sure.`)
    }
  }

  const quietSpace = input.quietSpace ?? 'not-sure'
  if (!['yes', 'no', 'not-sure'].includes(quietSpace)) {
    throw new PlaceInputError('Choose yes, no, or not sure for the quiet space question.')
  }
  report.quietSpace = quietSpace === 'not-sure' ? null : quietSpace

  if (input.note === undefined || input.note === null) {
    report.note = null
  } else if (typeof input.note !== 'string') {
    throw new PlaceInputError('The note must be text.')
  } else {
    const note = cleanText(input.note)
    if (note.length > MAX_NOTE_LENGTH) {
      throw new PlaceInputError(`Keep the note to ${MAX_NOTE_LENGTH} characters or fewer.`)
    }
    report.note = note || null
  }

  const answered = RATING_CATEGORIES.some(({ id }) => report[id] !== null)
    || report.quietSpace !== null || report.note !== null
  if (!answered) throw new PlaceInputError('Answer at least one question, or add a note.')
  return report
}

export function cleanNewPlace(body, db) {
  const input = body ?? {}
  if (typeof input.name !== 'string') throw new PlaceInputError('Enter the place’s name.')
  const name = cleanText(input.name)
  if (name.length < 2 || name.length > 80) {
    throw new PlaceInputError('The place name must be between 2 and 80 characters.')
  }
  if (!PLACE_TYPES.includes(input.placeType)) {
    throw new PlaceInputError('Choose one of the available kinds of place.')
  }
  const existing = db.prepare('SELECT id FROM places WHERE lower(name) = lower(?)').get(name)
  if (existing) throw new DuplicatePlaceError('That place is already listed. You can add a report to it instead.')
  return { name, placeType: input.placeType }
}

export function addPlace(db, { name, placeType }, now = new Date()) {
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO places (id, name, place_type, sample_calm_score, origin, created_at)
    VALUES (?, ?, ?, 0, 'family', ?)
  `).run(id, name, placeType, now.toISOString())
  return id
}

export function addReport(db, placeId, report, now = new Date()) {
  db.prepare(`
    INSERT INTO ratings (id, place_id, noise, lighting, crowds, waits, quiet_space, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(), placeId, report.noise, report.lighting, report.crowds, report.waits,
    report.quietSpace, report.note, now.toISOString(),
  )
}

function roundOne(value) {
  return Math.round(value * 10) / 10
}

function summarize(average) {
  if (average <= 2) return 'Mostly calm'
  if (average <= 3.5) return 'Mixed reports'
  return 'Often challenging'
}

// `now` is a parameter so tests can check the out-of-date warning.
export function listPlaces(db, now = new Date()) {
  const places = db.prepare('SELECT id, name, place_type, origin FROM places').all()
  const totals = new Map(db.prepare(`
    SELECT place_id, COUNT(*) AS reports, MAX(created_at) AS latest,
      AVG(noise) AS noise, COUNT(noise) AS noise_reports,
      AVG(lighting) AS lighting, COUNT(lighting) AS lighting_reports,
      AVG(crowds) AS crowds, COUNT(crowds) AS crowds_reports,
      AVG(waits) AS waits, COUNT(waits) AS waits_reports,
      SUM(quiet_space = 'yes') AS quiet_yes, SUM(quiet_space = 'no') AS quiet_no
    FROM ratings GROUP BY place_id
  `).all().map((row) => [row.place_id, row]))
  const notes = new Map()
  for (const row of db.prepare(`
    SELECT place_id, note, created_at FROM ratings
    WHERE note IS NOT NULL ORDER BY created_at DESC
  `).all()) {
    const list = notes.get(row.place_id) ?? []
    if (list.length < NOTES_SHOWN) list.push({ text: row.note, reportedAt: row.created_at })
    notes.set(row.place_id, list)
  }

  return places.map((place) => {
    const total = totals.get(place.id)
    const categories = RATING_CATEGORIES.map(({ id, label }) => {
      const reports = total?.[`${id}_reports`] ?? 0
      return {
        id,
        label,
        reports,
        average: reports ? roundOne(total[id]) : null,
        summary: reports ? summarize(total[id]) : 'Unknown',
      }
    })
    const answered = categories.filter((category) => category.reports > 0)
    const latest = total?.latest ?? null
    const ageInDays = latest ? (now - new Date(latest)) / 86_400_000 : 0

    return {
      id: place.id,
      name: place.name,
      placeType: place.place_type,
      origin: place.origin,
      reportCount: total?.reports ?? 0,
      latestReportAt: latest,
      outdated: ageInDays > OUTDATED_AFTER_DAYS,
      // Higher is calmer: 6 minus the average challenge across answered categories.
      calmScore: answered.length
        ? roundOne(6 - answered.reduce((sum, category) => sum + category.average, 0) / answered.length)
        : null,
      categories,
      quietSpace: {
        yes: total?.quiet_yes ?? 0,
        no: total?.quiet_no ?? 0,
      },
      notes: notes.get(place.id) ?? [],
    }
  }).sort((a, b) => (
    // Places with a score come first, calmest first; then the rest by name.
    (b.calmScore ?? -1) - (a.calmScore ?? -1) || a.name.localeCompare(b.name)
  ))
}
