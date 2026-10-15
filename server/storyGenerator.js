const MAX_TRIGGERS = 21

function sentenceForTrigger(trigger, copingTool, readingLevel) {
  if (readingLevel === 'Early reader') {
    return `I can use ${copingTool} if I notice ${trigger}.`
  }
  if (readingLevel === 'Independent reader') {
    return `When I notice ${trigger}, I can choose ${copingTool} and tell my grown-up what might help.`
  }
  return `When I notice ${trigger}, I can use ${copingTool} and tell a grown-up what I need.`
}

export function generateStory({
  destination,
  placeType,
  nickname,
  readingLevel,
  triggers,
  copingTools,
  hasPhotos,
}) {
  if (triggers.length > MAX_TRIGGERS) {
    throw new Error(`Enter no more than ${MAX_TRIGGERS} triggers.`)
  }

  const triggerSentences = triggers.map((trigger, index) =>
    sentenceForTrigger(trigger, copingTools[index % copingTools.length], readingLevel),
  )
  const place = placeType.toLowerCase()
  const pages = [
    readingLevel === 'Early reader'
      ? [`${nickname} is going to ${destination}.`, `It is a ${place}.`]
      : readingLevel === 'Independent reader'
        ? [
          `${nickname} will visit ${destination} today.`,
          `It is okay to have questions about a new ${place}.`,
        ]
        : [
        `Today, ${nickname} is going to ${destination}, a ${place}.`,
        'I can take one step at a time.',
        ],
    [
      hasPhotos
        ? `I can look at the photos of ${destination} before I go.`
        : 'Before we leave, I can ask what may happen next.',
      `I can bring ${copingTools[0]} to help me feel ready.`,
      ...triggerSentences.splice(0, 1),
    ],
    [
      `At ${destination}, I can stay near my grown-up and take my time.`,
      ...triggerSentences.splice(0, 2),
    ],
  ]

  while (triggerSentences.length > 0) {
    pages.push(triggerSentences.splice(0, 3))
  }

  pages.push([
    `When it is time to leave ${destination}, my grown-up will help me.`,
    'I can feel proud of every step I try.',
  ])

  if (pages.length < 5) {
    pages.splice(pages.length - 1, 0, [
      'New places can feel different, and that is okay.',
      'I can tell my grown-up what I need.',
    ])
  }

  return pages.map((sentences, index) => ({
    number: index + 1,
    sentences,
  }))
}

export const maxStoryTriggers = MAX_TRIGGERS
