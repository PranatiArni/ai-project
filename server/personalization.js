// Rule-based personalization engine. It turns a destination, a visit type,
// and an optional sensory-preference profile into a preparation plan.
// The same input always produces the same plan; nothing here is random or
// uses a language model.

import {
  CHECKLIST_RULES,
  CONCERN_LEVEL_LABELS,
  CONCERN_LEVELS,
  DETAIL_LEVEL_LABELS,
  DETAIL_LEVELS,
  JOURNEY_STEPS,
  MAX_CHECKLIST_ITEMS,
  MAX_CUSTOM_SUPPORT_LENGTH,
  MAX_CUSTOM_SUPPORTS,
  SENSORY_AREAS,
  SENTENCE_LIMITS,
  SUPPORTS,
  VISIT_TYPES,
} from './planContent.js'

export class ProfileError extends Error {}

const AREA_IDS = Object.keys(SENSORY_AREAS)
const SUPPORT_IDS = Object.keys(SUPPORTS)

export function joinList(items) {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function cleanCustomSupport(value) {
  if (typeof value !== 'string') throw new ProfileError('Each extra support must be text.')
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (cleaned.length > MAX_CUSTOM_SUPPORT_LENGTH) {
    throw new ProfileError(`Each extra support must be ${MAX_CUSTOM_SUPPORT_LENGTH} characters or fewer.`)
  }
  return cleaned
}

// Fills in defaults for anything missing and rejects values the engine does
// not understand, so a typo never silently changes a plan.
export function normalizeProfile(raw) {
  const input = raw ?? {}
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ProfileError('Preferences must be an object.')
  }

  const profile = {}
  for (const area of AREA_IDS) {
    const level = input[area] ?? 'not-a-concern'
    if (!CONCERN_LEVELS.includes(level)) {
      throw new ProfileError(`Choose a valid option for ${SENSORY_AREAS[area].label.toLowerCase()}.`)
    }
    profile[area] = level
  }

  profile.detailLevel = input.detailLevel ?? 'standard'
  if (!DETAIL_LEVELS.includes(profile.detailLevel)) {
    throw new ProfileError('Choose brief, standard, or detailed explanations.')
  }

  const supports = input.supports ?? []
  if (!Array.isArray(supports)) throw new ProfileError('Supports must be a list.')
  const unknownSupport = supports.find((id) => !SUPPORT_IDS.includes(id))
  if (unknownSupport !== undefined) throw new ProfileError('One of the chosen supports is not recognized.')
  // Catalog order, so the same choices in a different order give the same plan.
  profile.supports = SUPPORT_IDS.filter((id) => supports.includes(id))

  const customSupports = input.customSupports ?? []
  if (!Array.isArray(customSupports)) throw new ProfileError('Extra supports must be a list.')
  const seen = new Set()
  profile.customSupports = customSupports.map(cleanCustomSupport).filter((support) => {
    const key = support.toLowerCase()
    if (!support || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (profile.customSupports.length > MAX_CUSTOM_SUPPORTS) {
    throw new ProfileError(`Add no more than ${MAX_CUSTOM_SUPPORTS} extra supports.`)
  }

  return profile
}

function section(id, title, core, extra, limit, reason) {
  return {
    id,
    title,
    sentences: [...core, ...extra].filter(Boolean).slice(0, limit),
    reason,
  }
}

function sensorySection(area, context) {
  const details = SENSORY_AREAS[area]
  const level = context.profile[area]
  const helpers = context.supports.filter((support) => support.helpsWith.includes(area)).slice(0, 2)
  const coping = helpers.length > 0
    ? `If ${details.trigger}, I can ${helpers.map((support) => support.action).join(' or ')}.`
    : `If ${details.trigger}, I can ${details.fallbackAction}.`

  return section(
    area,
    details.title,
    [
      context.visitType.areaNotes[area] ?? details.generic,
      coping,
      level === 'often' ? details.oftenSentence : null,
    ],
    [],
    context.limit,
    details.because,
  )
}

function buildSections(context) {
  const { destination, visitType, limit } = context
  const sections = [
    section(
      'getting-ready',
      'Getting ready',
      [`I am going to ${destination}.`, visitType.place ? `It is ${visitType.place}.` : null],
      [
        context.hasSupport('visual-schedule') ? 'I can look at my picture schedule to see the steps.' : null,
        'Reading this story can help me know what might happen.',
      ],
      limit,
      'Included in every plan',
    ),
    section('arriving', 'Arriving', visitType.arriving, ['My grown-up can stay with me.'], limit, 'Included in every plan'),
    section('what-might-happen', 'What might happen next', visitType.happens, [], limit, 'Included in every plan'),
    ...context.concerns.map((area) => sensorySection(area, context)),
  ]

  const packList = context.packList
  if (packList.length > 0) {
    sections.push({
      ...section(
        'supports',
        'Things that can help me',
        [`I can bring ${joinList(packList)}.`, 'I can choose to use them, or not.'],
        [],
        limit,
        'Because you picked these',
      ),
      // Lets the story show a picture for each support. Family-added supports
      // have no picture of their own, so their supportId is null.
      items: [
        ...context.profile.supports.map((id) => ({ supportId: id, label: SUPPORTS[id].packAs })),
        ...context.profile.customSupports.map((label) => ({ supportId: null, label })),
      ],
    })
  }

  sections.push(
    section(
      'taking-a-break',
      'Taking a break',
      [
        context.hasSupport('break-signal')
          ? 'I can show my break card when I need a break.'
          : 'I can tell my grown-up when I need a break.',
        'Taking a break is okay.',
      ],
      ['After a break, we can decide together what to do next.'],
      limit,
      'Included in every plan',
    ),
    section(
      'leaving',
      'Leaving',
      [`When it is time to go, we will leave ${destination} together.`, 'Later, we can talk about what helped.'],
      [],
      limit,
      'Included in every plan',
    ),
  )

  return sections
}

function buildQuestions(context) {
  if (context.concerns.length === 0) return []
  const questions = [
    ...context.concerns.map((area) => SENSORY_AREAS[area].question),
    ...context.visitType.questions,
    'Is there a quiet place where we could take a break?',
  ]
  return [...new Set(questions)]
}

function buildSuggestions(context) {
  const suggestions = []
  for (const area of context.concerns) {
    const helped = context.supports.some((support) => support.helpsWith.includes(area))
    const { support, text } = SENSORY_AREAS[area].suggestion
    if (helped || context.hasSupport(support)) continue
    if (suggestions.some((suggestion) => suggestion.id === `suggest-${support}`)) continue
    suggestions.push({
      id: `suggest-${support}`,
      text,
      reason: `You marked ${SENSORY_AREAS[area].label.toLowerCase()} without choosing a support for it`,
    })
  }
  return suggestions
}

function buildChecklist(context) {
  const matched = CHECKLIST_RULES
    .map((rule, order) => ({ rule, order }))
    .filter(({ rule }) => rule.when(context))
  const kept = [...matched]
    .sort((a, b) => a.rule.priority - b.rule.priority || a.order - b.order)
    .slice(0, MAX_CHECKLIST_ITEMS)
    .sort((a, b) => a.order - b.order)

  return kept.map(({ rule }) => ({
    id: rule.id,
    label: rule.label(context),
    phase: rule.phase,
    reason: rule.reason(context),
  }))
}

// The choices a visit-setup form can offer, so the client never keeps its own copy.
export function getPlanOptions() {
  return {
    visitTypes: Object.entries(VISIT_TYPES).map(([id, type]) => ({ id, label: type.label })),
    sensoryAreas: AREA_IDS.map((id) => ({ id, label: SENSORY_AREAS[id].label })),
    concernLevels: CONCERN_LEVELS.map((id) => ({ id, label: CONCERN_LEVEL_LABELS[id] })),
    detailLevels: DETAIL_LEVELS.map((id) => ({ id, label: DETAIL_LEVEL_LABELS[id] })),
    supports: SUPPORT_IDS.map((id) => ({ id, label: SUPPORTS[id].label })),
    limits: {
      maxCustomSupports: MAX_CUSTOM_SUPPORTS,
      maxCustomSupportLength: MAX_CUSTOM_SUPPORT_LENGTH,
    },
  }
}

export function isVisitType(id) {
  return Object.hasOwn(VISIT_TYPES, id)
}

// Saved stories keep a `pages` list so the story reader works for both older
// stories and personalized plans.
export function sectionsToPages(sections) {
  return sections.map((section, index) => ({
    number: index + 1,
    title: section.title,
    sentences: section.sentences,
  }))
}

// Builds the day-of journey from a saved plan's sections and checklist.
// `progress` maps step ids to true when a step is done. Stories saved before
// personalization have no sections, so they have no journey (null).
export function buildJourney({ sections, checklist }, progress = {}) {
  if (!Array.isArray(sections)) return null
  const sectionsById = new Map(sections.map((section) => [section.id, section]))
  const checklistIds = new Set(checklist.map((item) => item.id))
  // The second sentence of a sensory section is its coping sentence.
  const copingIdeas = sections
    .filter((section) => AREA_IDS.includes(section.id))
    .map((section) => ({
      id: section.id,
      title: section.title,
      text: section.sentences[1] ?? section.sentences[0],
    }))

  return JOURNEY_STEPS.map((step) => ({
    id: step.id,
    title: step.title,
    pictureSection: step.section,
    sentences: sectionsById.get(step.section)?.sentences ?? [],
    checklistIds: step.checklist.filter((id) => checklistIds.has(id)),
    copingIdeas: step.showCopingIdeas ? copingIdeas : [],
    alternative: step.alternative,
    completed: progress[step.id] === true,
  }))
}

export function buildPlan({ destination, visitType, profile } = {}) {
  const normalized = normalizeProfile(profile)
  const visitTypeId = isVisitType(visitType) ? visitType : 'other'
  const type = VISIT_TYPES[visitTypeId]
  const place = typeof destination === 'string' && destination.trim()
    ? destination.trim()
    : 'this place'
  const supports = normalized.supports.map((id) => SUPPORTS[id])

  const context = {
    destination: place,
    visitType: type,
    profile: normalized,
    limit: SENTENCE_LIMITS[normalized.detailLevel],
    supports,
    concerns: AREA_IDS.filter((area) => normalized[area] !== 'not-a-concern'),
    packList: [...supports.map((support) => support.packAs), ...normalized.customSupports],
    hasSupport: (id) => normalized.supports.includes(id),
    joinList,
  }
  context.questions = buildQuestions(context)

  return {
    visitType: visitTypeId,
    profile: normalized,
    sections: buildSections(context),
    checklist: buildChecklist(context),
    suggestions: buildSuggestions(context),
    questionsForVenue: context.questions,
    generalInfoNotice: `This is based on what ${type.place ? `visiting ${type.place} is` : 'new places are'} usually like. It doesn’t know anything specific about ${place}, so call ahead about anything important.`,
  }
}
