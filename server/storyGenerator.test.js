import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import test from 'node:test'
import { generateStory, maxStoryTriggers } from './storyGenerator.js'

function createStory(triggers) {
  return generateStory({
    destination: 'the dentist',
    placeType: 'dentist office',
    nickname: 'Sam',
    readingLevel: 'Beginning reader',
    triggers,
    copingTools: ['headphones', 'a picture card'],
    hasPhotos: true,
  })
}

test('stories have between five and ten pages with at most three sentences each', () => {
  for (const triggerCount of [0, 1, 3, 4, 12, maxStoryTriggers]) {
    const pages = createStory(Array.from({ length: triggerCount }, (_, i) => `trigger ${i + 1}`))
    assert.ok(pages.length >= 5 && pages.length <= 10)
    for (const page of pages) {
      assert.ok(page.sentences.length <= 3)
      assert.ok(page.sentences.length > 0)
    }
  }
})

test('each trigger is paired with a coping tool in a story sentence', () => {
  const triggers = ['loud sounds', 'waiting in line', 'bright lights']
  const pages = createStory(triggers)
  const storyText = pages.flatMap((page) => page.sentences).join(' ')

  for (const [index, trigger] of triggers.entries()) {
    const pairedSentence = pages
      .flatMap((page) => page.sentences)
      .find((sentence) => sentence.includes(trigger))
    assert.ok(pairedSentence)
    assert.ok(pairedSentence.includes(index % 2 ? 'a picture card' : 'headphones'))
  }
  assert.ok(storyText.includes('photos of the dentist'))
})

test('stories reject more triggers than fit the ten-page limit', () => {
  assert.throws(
    () => createStory(Array.from({ length: maxStoryTriggers + 1 }, (_, i) => `trigger ${i}`)),
    /no more than/,
  )
})

test('early and independent reading levels change the generated wording', () => {
  const earlyReaderStory = generateStory({
    destination: 'the dentist',
    placeType: 'dentist office',
    nickname: 'Sam',
    readingLevel: 'Early reader',
    triggers: ['loud sounds'],
    copingTools: ['headphones'],
    hasPhotos: false,
  })
  const independentReaderStory = generateStory({
    destination: 'the dentist',
    placeType: 'dentist office',
    nickname: 'Sam',
    readingLevel: 'Independent reader',
    triggers: ['loud sounds'],
    copingTools: ['headphones'],
    hasPhotos: false,
  })

  assert.ok(earlyReaderStory.flatMap((page) => page.sentences).join(' ').includes('I can use headphones if I notice loud sounds'))
  assert.ok(independentReaderStory.flatMap((page) => page.sentences).join(' ').includes('When I notice loud sounds'))
})

test('story generation completes in under the 30-second acceptance limit', () => {
  const startedAt = performance.now()
  createStory(Array.from({ length: maxStoryTriggers }, (_, i) => `trigger ${i + 1}`))
  assert.ok(performance.now() - startedAt < 30_000)
})
