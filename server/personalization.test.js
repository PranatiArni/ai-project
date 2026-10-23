import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPlan, normalizeProfile, ProfileError } from './personalization.js'
import { MAX_CHECKLIST_ITEMS, SENTENCE_LIMITS, SUPPORTS, VISIT_TYPES } from './planContent.js'

const ids = (items) => items.map((item) => item.id)
const storyText = (plan) => plan.sections.flatMap((section) => section.sentences).join(' ')

test('two families visiting the same dentist get different plans', () => {
  const soundFamily = buildPlan({
    destination: 'Smile Dental',
    visitType: 'dentist',
    profile: { sound: 'often', supports: ['headphones'] },
  })
  const waitingFamily = buildPlan({
    destination: 'Smile Dental',
    visitType: 'dentist',
    profile: { crowds: 'often', waiting: 'often', supports: ['timer', 'visual-schedule'] },
  })

  assert.ok(ids(soundFamily.sections).includes('sound'))
  assert.ok(!ids(soundFamily.sections).includes('waiting'))
  assert.ok(ids(waitingFamily.sections).includes('waiting'))
  assert.ok(ids(waitingFamily.sections).includes('crowds'))
  assert.ok(!ids(waitingFamily.sections).includes('sound'))

  assert.ok(ids(soundFamily.checklist).includes('preview-sounds'))
  assert.ok(!ids(waitingFamily.checklist).includes('preview-sounds'))
  for (const id of ['practice-waiting', 'plan-quiet-time', 'make-schedule']) {
    assert.ok(ids(waitingFamily.checklist).includes(id), id)
    assert.ok(!ids(soundFamily.checklist).includes(id), id)
  }

  assert.match(storyText(soundFamily), /If sounds feel too loud, I can put on my headphones\./)
  assert.match(storyText(waitingFamily), /If I have to wait, I can watch my timer or look at my picture schedule\./)
})

test('an empty profile gives a short, useful default plan', () => {
  const plan = buildPlan({ destination: 'the library', visitType: 'library' })
  assert.deepEqual(ids(plan.sections), [
    'getting-ready', 'arriving', 'what-might-happen', 'taking-a-break', 'leaving',
  ])
  assert.deepEqual(ids(plan.checklist), ['read-story', 'reflect'])
  assert.deepEqual(plan.questionsForVenue, [])
  assert.deepEqual(plan.suggestions, [])
  assert.equal(plan.profile.detailLevel, 'standard')
})

test('the same input always gives the same plan, regardless of support order', () => {
  const profile = { sound: 'sometimes', lighting: 'often', supports: ['sunglasses', 'headphones'] }
  const first = buildPlan({ destination: 'the store', visitType: 'grocery-store', profile })
  const second = buildPlan({
    destination: 'the store',
    visitType: 'grocery-store',
    profile: { ...profile, supports: ['headphones', 'sunglasses'] },
  })
  assert.deepEqual(first, second)
})

test('choosing everything still gives a capped checklist with no duplicates', () => {
  const plan = buildPlan({
    destination: 'Fun Park',
    visitType: 'theme-park',
    profile: {
      sound: 'often',
      lighting: 'often',
      crowds: 'often',
      waiting: 'often',
      detailLevel: 'detailed',
      supports: Object.keys(SUPPORTS),
      customSupports: ['a favorite book'],
    },
  })
  assert.ok(plan.checklist.length <= MAX_CHECKLIST_ITEMS)
  assert.equal(new Set(ids(plan.checklist)).size, plan.checklist.length)
  assert.equal(new Set(plan.checklist.map((item) => item.label)).size, plan.checklist.length)
  assert.equal(new Set(plan.questionsForVenue).size, plan.questionsForVenue.length)
  assert.ok(ids(plan.checklist).includes('read-story'))
  assert.ok(ids(plan.checklist).includes('reflect'))
  assert.equal(plan.checklist.at(-1).phase, 'after')
})

test('"often" adds more support than "sometimes"', () => {
  const sometimes = buildPlan({ destination: 'Cafe', visitType: 'restaurant', profile: { sound: 'sometimes' } })
  const often = buildPlan({ destination: 'Cafe', visitType: 'restaurant', profile: { sound: 'often' } })
  const soundSection = (plan) => plan.sections.find((section) => section.id === 'sound')

  assert.ok(soundSection(often).sentences.length > soundSection(sometimes).sentences.length)
  assert.ok(ids(often.checklist).includes('preview-sounds'))
  assert.ok(!ids(sometimes.checklist).includes('preview-sounds'))
})

test('detail level controls how much each section says', () => {
  const profile = { sound: 'often', supports: ['visual-schedule'] }
  const brief = buildPlan({ destination: 'Dr. Lee', visitType: 'doctor', profile: { ...profile, detailLevel: 'brief' } })
  const detailed = buildPlan({ destination: 'Dr. Lee', visitType: 'doctor', profile: { ...profile, detailLevel: 'detailed' } })

  for (const section of brief.sections) {
    assert.ok(section.sentences.length >= 1 && section.sentences.length <= SENTENCE_LIMITS.brief, section.id)
  }
  assert.ok(storyText(detailed).length > storyText(brief).length)
})

test('chosen supports are kept even when no matching area is marked', () => {
  const plan = buildPlan({ destination: 'Cuts', visitType: 'hair-salon', profile: { supports: ['headphones'] } })
  assert.ok(!ids(plan.sections).includes('sound'))
  assert.ok(ids(plan.sections).includes('supports'))
  assert.match(storyText(plan), /I can bring headphones\./)
  assert.equal(plan.checklist.find((item) => item.id === 'pack-supports').label, 'Pack headphones')
})

test('suggestions appear only for marked areas that have no chosen support', () => {
  const withoutSupport = buildPlan({ destination: 'Cafe', visitType: 'restaurant', profile: { sound: 'often' } })
  const withSupport = buildPlan({
    destination: 'Cafe',
    visitType: 'restaurant',
    profile: { sound: 'often', supports: ['headphones'] },
  })
  assert.deepEqual(ids(withoutSupport.suggestions), ['suggest-headphones'])
  assert.deepEqual(withSupport.suggestions, [])
})

test('a break card changes the break section', () => {
  const withCard = buildPlan({ destination: 'X', visitType: 'other', profile: { supports: ['break-signal'] } })
  const withoutCard = buildPlan({ destination: 'X', visitType: 'other' })
  const breakText = (plan) => plan.sections.find((section) => section.id === 'taking-a-break').sentences[0]
  assert.equal(breakText(withCard), 'I can show my break card when I need a break.')
  assert.equal(breakText(withoutCard), 'I can tell my grown-up when I need a break.')
  assert.ok(ids(withCard.checklist).includes('practice-break-signal'))
})

test('invalid preferences are rejected with a clear error', () => {
  assert.throws(() => normalizeProfile({ sound: 'very' }), ProfileError)
  assert.throws(() => normalizeProfile({ supports: ['jetpack'] }), ProfileError)
  assert.throws(() => normalizeProfile({ detailLevel: 'huge' }), ProfileError)
  assert.throws(() => normalizeProfile('loud'), ProfileError)
  assert.throws(() => normalizeProfile({ customSupports: ['a', 'b', 'c', 'd'] }), ProfileError)
  assert.throws(() => normalizeProfile({ customSupports: ['x'.repeat(61)] }), ProfileError)
})

test('extra supports are cleaned and de-duplicated', () => {
  const profile = normalizeProfile({ customSupports: ['  blue   blanket ', 'Blue blanket', '', 'book\u0007'] })
  assert.deepEqual(profile.customSupports, ['blue blanket', 'book'])
})

test('unknown visit types and missing destinations fall back safely', () => {
  const plan = buildPlan({ destination: '   ', visitType: 'moon-base' })
  assert.equal(plan.visitType, 'other')
  assert.match(storyText(plan), /I am going to this place\./)
  assert.match(plan.generalInfoNotice, /does not include verified details/)
})

test('general place descriptions use hedged wording, not promises', () => {
  const hedge = /\b(may|might|can|some|sometimes|often|usually)\b/i
  for (const [id, type] of Object.entries(VISIT_TYPES)) {
    for (const sentence of [...type.arriving, ...type.happens, ...Object.values(type.areaNotes)]) {
      assert.match(sentence, hedge, `${id}: "${sentence}"`)
    }
  }
})
