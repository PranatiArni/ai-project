// Post-visit reflection: a caregiver's own notes about what helped. They are
// stored with the plan and only shown back to the caregiver. Nothing here
// analyzes them or changes the personalization rules.
import { SUPPORTS } from './planContent.js'

const MAX_TEXT_LENGTH = 500

// Parts of the preparation a caregiver can say helped, besides story parts.
const OTHER_HELPFUL_PARTS = [
  { id: 'journey', title: 'The visit journey' },
  { id: 'checklist', title: 'The checklist' },
  { id: 'calm-break', title: 'The calm break' },
]

export class ReflectionError extends Error {}

// The choices offered for one plan: its own story parts and its own supports.
export function reflectionChoices({ sections, profile }) {
  return {
    helped: [
      ...(sections ?? []).map((section) => ({ id: section.id, title: section.title })),
      ...OTHER_HELPFUL_PARTS,
    ],
    supports: profile
      ? [...profile.supports.map((id) => SUPPORTS[id].label), ...profile.customSupports]
      : [],
  }
}

function cleanList(value, allowed, message) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.some((item) => !allowed.includes(item))) {
    throw new ReflectionError(message)
  }
  // Keep the order the choices are offered in, without duplicates.
  return allowed.filter((item) => value.includes(item))
}

function cleanNote(value, label) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new ReflectionError(`${label} must be text.`)
  // Keep line breaks; remove other control characters and extra spaces.
  const cleaned = value
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/ +/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (cleaned.length > MAX_TEXT_LENGTH) {
    throw new ReflectionError(`${label} must be ${MAX_TEXT_LENGTH} characters or fewer.`)
  }
  return cleaned
}

export function cleanReflection(body, story, now = new Date()) {
  const input = body ?? {}
  const choices = reflectionChoices(story)
  const reflection = {
    helped: cleanList(input.helped, choices.helped.map((part) => part.id), 'Choose parts from this plan.'),
    supportsUsed: cleanList(input.supportsUsed, choices.supports, 'Choose supports from this plan.'),
    changeNextTime: cleanNote(input.changeNextTime, 'What you would change'),
    notesForNextVisit: cleanNote(input.notesForNextVisit, 'Notes for a future visit'),
    updatedAt: now.toISOString(),
  }
  const empty = reflection.helped.length === 0 && reflection.supportsUsed.length === 0
    && !reflection.changeNextTime && !reflection.notesForNextVisit
  if (empty) throw new ReflectionError('Add at least one answer or note before saving.')
  return reflection
}

// What a new plan shows from an earlier visit, when the caregiver asks for it.
export function previousVisitNotes(story) {
  if (!story?.reflection) throw new ReflectionError('That past visit has no notes to bring forward.')
  return {
    fromStoryId: story.id,
    title: story.title,
    reflectedAt: story.reflection.updatedAt,
    changeNextTime: story.reflection.changeNextTime,
    notesForNextVisit: story.reflection.notesForNextVisit,
  }
}
