// Content used by the personalization engine (personalization.js).
// Everything here is general information about kinds of places, never facts
// about a specific venue. Sentences about places use hedged words such as
// "may", "can", or "sometimes" so the plan does not promise what will happen.

export const CONCERN_LEVELS = ['not-a-concern', 'sometimes', 'often']
export const DETAIL_LEVELS = ['brief', 'standard', 'detailed']

export const CONCERN_LEVEL_LABELS = {
  'not-a-concern': 'Not a concern',
  sometimes: 'Sometimes hard',
  often: 'Often hard',
}
export const DETAIL_LEVEL_LABELS = {
  brief: 'Short',
  standard: 'Medium',
  detailed: 'Long',
}

// Maximum story sentences per section for each detail level.
export const SENTENCE_LIMITS = { brief: 2, standard: 3, detailed: 4 }

export const MAX_CHECKLIST_ITEMS = 8
export const MAX_CUSTOM_SUPPORTS = 3
export const MAX_CUSTOM_SUPPORT_LENGTH = 60

export const SENSORY_AREAS = {
  sound: {
    label: 'Loud or sudden sounds',
    because: 'Because sounds can be hard',
    title: 'Sounds I might hear',
    trigger: 'sounds feel too loud',
    generic: 'Some places can have loud or sudden sounds.',
    fallbackAction: 'cover my ears or tell my grown-up',
    oftenSentence: 'I can ask to move somewhere quieter.',
    question: 'Is there a quieter time of day to visit?',
    suggestion: {
      support: 'headphones',
      text: 'Some families find noise-reducing headphones helpful in loud places.',
    },
  },
  lighting: {
    label: 'Bright lights',
    because: 'Because bright lights can be hard',
    title: 'Lights and things to see',
    trigger: 'lights feel too bright',
    generic: 'Some places have bright lights or a lot to look at.',
    fallbackAction: 'look down or close my eyes for a moment',
    oftenSentence: 'I can ask to sit or stand somewhere less bright.',
    question: 'Is there a spot with softer lighting?',
    suggestion: {
      support: 'sunglasses',
      text: 'Some families bring sunglasses or a hat with a brim for bright places.',
    },
  },
  crowds: {
    label: 'Crowds and new places',
    because: 'Because crowds can be hard',
    title: 'People and new spaces',
    trigger: 'there are lots of people',
    generic: 'Some places can be busy, with many people moving around.',
    fallbackAction: 'stay close to my grown-up',
    oftenSentence: 'We can find a calmer corner if it gets busy.',
    question: 'When is it usually least busy?',
    suggestion: {
      support: 'comfort-item',
      text: 'Some families bring a familiar comfort item for busy places.',
    },
  },
  waiting: {
    label: 'Waiting',
    because: 'Because waiting can be hard',
    title: 'Waiting and what comes next',
    trigger: 'I have to wait',
    generic: 'Sometimes there is waiting before it is my turn.',
    fallbackAction: 'ask my grown-up what comes next',
    oftenSentence: 'My grown-up can tell me how many steps are left.',
    question: 'Can we wait somewhere quieter, or book a time with a shorter wait?',
    suggestion: {
      support: 'timer',
      text: 'Some families use a visual timer so waiting has a clear end.',
    },
  },
}

// Supports a family can choose. `helpsWith` lists the sensory areas where the
// story mentions this support as an option.
export const SUPPORTS = {
  headphones: {
    label: 'Noise-reducing headphones',
    packAs: 'headphones',
    action: 'put on my headphones',
    helpsWith: ['sound'],
  },
  sunglasses: {
    label: 'Sunglasses or a hat',
    packAs: 'sunglasses or a hat',
    action: 'wear my sunglasses or hat',
    helpsWith: ['lighting'],
  },
  'comfort-item': {
    label: 'A comfort item',
    packAs: 'a comfort item',
    action: 'hold my comfort item',
    helpsWith: ['crowds', 'waiting'],
  },
  fidget: {
    label: 'A fidget or something to hold',
    packAs: 'a fidget',
    action: 'use my fidget',
    helpsWith: ['waiting'],
  },
  timer: {
    label: 'A visual timer',
    packAs: 'a visual timer',
    action: 'watch my timer',
    helpsWith: ['waiting'],
  },
  'visual-schedule': {
    label: 'A picture schedule of the visit',
    packAs: 'the picture schedule',
    action: 'look at my picture schedule',
    helpsWith: ['waiting'],
  },
  'break-signal': {
    label: 'A break card or signal',
    packAs: 'a break card',
    action: 'show my break card',
    helpsWith: [],
  },
  snack: {
    label: 'A snack or drink',
    packAs: 'a snack or drink',
    action: 'have my snack or drink',
    helpsWith: [],
  },
}

// General expectations for kinds of places. `areaNotes` replaces the generic
// sensory sentence when a family marks that area as a concern.
export const VISIT_TYPES = {
  dentist: {
    label: 'Dentist',
    place: 'a dentist office',
    arriving: ['We may check in at a front desk.', 'There may be a waiting room with chairs.'],
    happens: [
      'I may sit in a big chair that can move up and down.',
      'The dentist may look at my teeth with a small mirror.',
      'I can ask to see a tool before it is used.',
    ],
    areaNotes: {
      sound: 'Some dental tools can buzz or whir.',
      lighting: 'There is often a bright light above the dentist chair.',
      waiting: 'Sometimes we wait in the waiting room before it is my turn.',
    },
    questions: ['Can the dentist show and explain tools before using them?'],
  },
  doctor: {
    label: 'Doctor',
    place: "a doctor's office",
    arriving: ['We may check in at a front desk.', 'There may be a waiting room with chairs.'],
    happens: [
      'A nurse may check how tall I am and how much I weigh.',
      'The doctor may listen to my heartbeat with a stethoscope.',
      'I can ask what will happen next.',
    ],
    areaNotes: {
      sound: 'There may be beeping machines or people talking in the hallway.',
      lighting: 'Exam rooms often have bright lights overhead.',
      waiting: 'Sometimes we wait in the waiting room and again in the exam room.',
    },
    questions: ['Can we wait somewhere other than the main waiting room?'],
  },
  'hair-salon': {
    label: 'Hair salon',
    place: 'a hair salon',
    arriving: ['We may check in and wait for a chair to be ready.'],
    happens: [
      'I may sit in a tall chair and wear a cape.',
      'The stylist may spray water on my hair.',
      'I can ask for a break or to look in the mirror.',
    ],
    areaNotes: {
      sound: 'Hair dryers and clippers can be loud or buzz.',
      crowds: 'Other people may be getting their hair cut nearby.',
      waiting: 'Sometimes there is a wait before a chair is ready.',
    },
    questions: ['Can scissors be used instead of clippers if needed?'],
  },
  'grocery-store': {
    label: 'Grocery store',
    place: 'a grocery store',
    arriving: ['We may get a cart or a basket near the door.'],
    happens: [
      'We may walk down aisles to find the things on our list.',
      'I can help find something on the list.',
      'At the end, we may pay at a checkout.',
    ],
    areaNotes: {
      sound: 'There may be beeping at checkout and announcements.',
      lighting: 'Stores often have bright lights and colorful shelves.',
      crowds: 'Aisles can be busy at some times of day.',
      waiting: 'Sometimes there is a line at checkout.',
    },
    questions: [],
  },
  restaurant: {
    label: 'Restaurant',
    place: 'a restaurant',
    arriving: ['Someone may show us to a table.'],
    happens: [
      'We may look at a menu and choose food.',
      'Food can take some time to arrive.',
      'I can bring something to do while we wait.',
    ],
    areaNotes: {
      sound: 'Restaurants can have music, talking, and clinking dishes.',
      crowds: 'Other people may be eating at tables nearby.',
      waiting: 'There may be a wait for a table or for food.',
    },
    questions: ['Is there a quieter table we could ask for?'],
  },
  'theme-park': {
    label: 'Theme park or attraction',
    place: 'a theme park or attraction',
    arriving: ['We may wait in line to go through the entrance.'],
    happens: [
      'There may be rides, shows, or things to look at.',
      'We can choose which things to try and which to skip.',
      'We can look at a map to plan where to go.',
    ],
    areaNotes: {
      sound: 'There may be music, rides, and people cheering.',
      lighting: 'Some rides or shows have flashing lights.',
      crowds: 'Theme parks can be very busy.',
      waiting: 'Lines for rides can be long.',
    },
    questions: ['Do you offer any accessibility or ride-return options for waiting?'],
  },
  library: {
    label: 'Library',
    place: 'a library',
    arriving: ['We may walk past a front desk.'],
    happens: [
      'We may look at shelves of books.',
      'People usually use quiet voices.',
      'We may check out books at a desk.',
    ],
    areaNotes: {
      sound: 'Libraries are often quiet, but there may be story times or beeping machines.',
      crowds: 'Some library events can be busy.',
    },
    questions: [],
  },
  other: {
    label: 'Somewhere else',
    place: null,
    arriving: ['When we get there, we can look around first.'],
    happens: [
      'I may see new things and new people.',
      'My grown-up can tell me what is happening.',
    ],
    areaNotes: {},
    questions: [],
  },
}

// Each rule adds one checklist item when `when(context)` is true. Rules are
// listed in the order items appear (before, during, then after the visit).
// Lower `priority` numbers are kept first if the checklist would be too long.
export const CHECKLIST_RULES = [
  {
    id: 'read-story',
    phase: 'before',
    priority: 0,
    when: () => true,
    label: () => 'Read the story together before the visit',
    reason: () => 'Included in every plan',
  },
  {
    id: 'ask-venue',
    phase: 'before',
    priority: 1,
    when: (context) => context.questions.length > 0,
    label: (context) => `Call ${context.destination} with your questions`,
    reason: () => 'Based on the areas you marked',
  },
  {
    id: 'pack-supports',
    phase: 'before',
    priority: 1,
    when: (context) => context.packList.length > 0,
    label: (context) => `Pack ${context.joinList(context.packList)}`,
    reason: () => 'Based on the supports you chose',
  },
  {
    id: 'make-schedule',
    phase: 'before',
    priority: 2,
    when: (context) => context.hasSupport('visual-schedule'),
    label: () => 'Make or print a picture schedule of the visit steps',
    reason: () => 'You chose a picture schedule',
  },
  {
    id: 'practice-break-signal',
    phase: 'before',
    priority: 2,
    when: (context) => context.hasSupport('break-signal'),
    label: () => 'Practice the break card or signal together at home',
    reason: () => 'You chose a break card or signal',
  },
  {
    id: 'practice-waiting',
    phase: 'before',
    priority: 3,
    when: (context) => context.profile.waiting === 'often',
    label: () => 'Practice a short wait at home, using a timer if that helps',
    reason: () => 'You said waiting is often hard',
  },
  {
    id: 'preview-sounds',
    phase: 'before',
    priority: 3,
    when: (context) => context.profile.sound === 'often',
    label: () => 'Listen to recordings of sounds you might hear, if that helps',
    reason: () => 'You said sound is often hard',
  },
  {
    id: 'plan-quiet-time',
    phase: 'before',
    priority: 3,
    when: (context) => context.profile.crowds === 'often',
    label: () => 'Plan to visit at a less busy time if you can',
    reason: () => 'You said crowds are often hard',
  },
  {
    id: 'find-quiet-spot',
    phase: 'during',
    priority: 2,
    when: (context) => context.concerns.length > 0,
    label: () => 'When you arrive, look for a quieter spot you could use for a break',
    reason: () => 'You marked at least one area as sometimes or often hard',
  },
  {
    id: 'avoid-bright-spot',
    phase: 'during',
    priority: 4,
    when: (context) => context.profile.lighting === 'often',
    label: () => 'Pick a spot away from bright or flashing lights',
    reason: () => 'You said lighting is often hard',
  },
  {
    id: 'reflect',
    phase: 'after',
    priority: 0,
    when: () => true,
    label: () => 'Afterward, write down what helped',
    reason: () => 'Included in every plan',
  },
]

// The day-of visit journey. Each step reuses one story section for its
// picture and words, shows the matching checklist items, and offers a
// caregiver-facing alternative if the step is not working.
export const JOURNEY_STEPS = [
  {
    id: 'get-ready',
    title: 'Get ready to go',
    section: 'getting-ready',
    checklist: ['read-story', 'pack-supports'],
    alternative: 'If you’re rushed, it’s okay to skip something or leave a bit later.',
  },
  {
    id: 'arrive',
    title: 'Arrive',
    section: 'arriving',
    checklist: ['find-quiet-spot', 'avoid-bright-spot'],
    alternative: 'If going in is too much, wait outside or in the car for a few minutes first.',
  },
  {
    id: 'during',
    title: 'During the visit',
    section: 'what-might-happen',
    checklist: [],
    showCopingIdeas: true,
    alternative: 'Take a break, or stop for today. That’s okay too.',
  },
  {
    id: 'leave',
    title: 'Leave and head home',
    section: 'leaving',
    checklist: ['reflect'],
    alternative: 'If leaving is hard, try counting down together or saying the same goodbye each time.',
  },
]
