# How Ready Together works

A guide to the code, for explaining and defending the project. Line numbers
were correct when this was written and may drift slightly as code changes.

## 1. The big picture: what happens when a plan is created

1. `client/src/pages/StoryFormPage.jsx` loads the form's choices from
   `GET /api/plan-options`, so the form never keeps its own copy of the
   options.
2. On submit it sends `POST /api/stories` with the destination, visit type,
   optional nickname, the profile, and any photos.
3. `server/index.js` runs `buildPlanFromInput()` (line 86). It checks the
   destination and visit type, then calls `buildPlan()` in the personalization
   engine.
4. The plan is saved as one row in the `stories` table. Lists and objects
   (sections, checklist, profile) are stored as JSON text in columns.
5. The server reads the row back through `serializeStory()`
   (`server/database.js:145`) and returns it, so the response to creating a
   plan has exactly the same shape as loading it later.
6. The client goes to `/stories/:id`, and `StoryPage.jsx` shows the plan.

## 2. The personalization engine

The engine is in two files, separating **what** the app can say from **how**
it chooses.

- `server/planContent.js` is mostly data:
  - `SENSORY_AREAS` (line 27): sound, lighting, crowds, and waiting, each with
    its wording, a question to ask the place, and a suggestion.
  - `SUPPORTS` (line 84): eight supports, each listing the areas it helps with.
  - `VISIT_TYPES` (line 137): general, hedged descriptions of eight kinds of
    place.
  - `CHECKLIST_RULES` (line 267): eleven rules, each with `when`, `label`,
    `reason`, `phase`, and `priority`.
  - `JOURNEY_STEPS` (line 361): the four day-of steps.
- `server/personalization.js` is the logic:
  - `normalizeProfile()` (line 44) fills in defaults and rejects unknown
    values with a `ProfileError`. Supports are sorted into catalog order, so
    the same choices in any order give the same plan.
  - `buildPlan()` (line 284) builds a `context` object (the marked areas, the
    chosen supports, the pack list, the sentence limit), then calls the
    builders below.
  - `buildSections()` (line 118) makes the story parts. `sensorySection()`
    (line 96) picks up to two of the family's supports that help with that
    area: "If sounds feel too loud, I can put on my headphones."
  - `buildChecklist()` (line 210) keeps every rule whose `when` is true. If
    more than `MAX_CHECKLIST_ITEMS` (8) match, it keeps the lowest priority
    numbers, then puts them back in their original order.
  - `buildQuestions()` (line 184) and `buildSuggestions()` (line 194) make the
    questions to ask the place and the optional ideas.
  - `buildJourney()` (line 259) turns a saved plan into the four journey
    steps.

**Why rules and not AI?** The output is predictable, testable, and cannot
invent facts about a venue. Every item records the reason it was added, which
the plan page shows.

## 3. How stories are assembled

- Each section has `core` sentences and optional `extra` sentences. The
  `section()` helper (`server/personalization.js:87`) joins them and cuts to
  the detail level's limit (`SENTENCE_LIMITS`: 2, 3, or 4).
- Sections are always in the same order: getting ready, arriving, what might
  happen, one per marked area, things that can help (if any supports), taking
  a break, and leaving.
- `sectionsToPages()` (line 248) also saves a `pages` list. Stories from the
  first version of the app only have `pages`, so the reader works for both.
- On the client, `StoryReader.jsx` shows one page at a time and
  `StoryPicture.jsx` picks the drawing: `pictureForSection()` (line 193) uses
  the visit type for "what might happen next", so a dentist plan shows a
  tooth.

## 4. State and persistence

**Database (`server/database.js`)**

- `MIGRATIONS` (line 12) is a numbered list. SQLite's `user_version` records
  how many have run, and `migrate()` (line 62) runs each new one inside a
  transaction:
  1. Personalized plan columns (all can be empty, so old stories still work)
  2. Journey progress
  3. Rebuilds the ratings table so answers can be "not sure", copying every
     old rating
  4. The reflection
- Some values are **calculated when read, not stored**. `serializeStory()`
  builds the journey from the saved sections plus stored progress, which is
  why plans made before the journey existed have one now.

**Client**

- Each page loads its own data through `requestJson()`. There is no global
  store.
- `useChecklist()` (`client/src/useChecklist.js:7`) shows a tick immediately,
  saves it, and **puts it back if the save fails** (an "optimistic update").
  The journey page does the same for "Mark as done".
- The position in the story or journey lives in the URL (`?part=3`,
  `?step=arrive`), so a refresh keeps your place and the calm break can link
  back to the same step.
- The two form routes have different React `key`s (`client/src/App.jsx`), so
  going from "Change preferences" to "Plan a visit" starts a fresh form instead
  of reusing the old plan's state.

## 5. How the client talks to the server

- `requestJson()` (`client/src/api.js:1`) sends JSON, reads JSON back, and
  turns any error response into a JavaScript `Error` with the server's
  message.
- During development, Vite forwards `/api` to the Express server
  (`client/vite.config.js`). `API_URL` changes the target, which the browser
  test uses to run its own server.

| Endpoint | What it does |
| --- | --- |
| `GET /api/plan-options` | Choices for the visit form |
| `GET /api/stories` | Saved plans list (no photos or story text) |
| `POST /api/stories` | Create a plan; optional `carryNotesFrom` |
| `GET /api/stories/:id` | One plan, with journey and reflection |
| `PATCH /api/stories/:id/checklist` | Save checklist ticks |
| `PUT /api/stories/:id/sections` | Save edited story wording |
| `PUT /api/stories/:id/plan` | Rebuild from changed preferences |
| `PATCH /api/stories/:id/journey` | Mark a journey step done or not |
| `PUT /api/stories/:id/reflection` | Save after-visit notes |
| `GET /api/place-options` | Place types and report categories |
| `GET /api/places` | Places with report summaries |
| `POST /api/places` | Add a place (duplicates return 409) |
| `POST /api/places/:id/ratings` | Add a family report |

## 6. How errors are handled

- **Server.** Each kind of input problem has its own error class:
  `ValidationError` (`server/index.js:32`), `ProfileError`, `PlaceInputError`,
  `ReflectionError`, and `DuplicatePlaceError`. Routes turn these into `400`
  (or `409` for duplicates) with a plain-language message. Unknown ids return
  `404`.
- Any other error is treated as a bug. It reaches the error handler
  (`server/index.js:407`), which returns `500` without leaking details. The
  same handler returns clear messages for oversized requests (`413`) and
  broken JSON (`400`).
- **Client.** Errors appear in a `role="alert"` message, so screen readers
  announce them. Failed saves are undone on screen and say "That change was
  not saved."
- **Safety of user text.** Names, notes, and sentences are cleaned of control
  characters and length-limited on the server. React escapes all text when it
  displays it, so a note containing HTML shows as plain text.

## 7. Tests that show it works

Run `npm test` (server) and `npm run test:browser` (real browser).

- **Personalization** (`server/personalization.test.js`)
  - "two families visiting the same dentist get different plans": the core
    claim.
  - "choosing everything still gives a capped checklist with no duplicates"
  - "the same input always gives the same plan, regardless of support order"
  - "general place descriptions use hedged wording, not promises"
  - "invalid preferences are rejected with a clear error"
- **Database** (`server/database.test.js`, `server/places.test.js`)
  - "an existing database from before personalization upgrades without losing
    stories"
  - "migration 3 keeps old ratings and marks seeded places as examples"
- **API** (`server/api.test.js`)
  - "changing preferences rebuilds the plan and keeps progress where it still
    applies"
  - "story edits are validated"
  - "notes from a past visit appear in a new plan only when the caregiver asks"
- **Places** (`server/places.test.js`)
  - "example places are labeled and start with no invented scores"
  - "'not sure' answers are left out of averages instead of counted"
- **Browser** (`scripts/browser-test.mjs`): the whole flow in Chrome, including
  keyboard-only reading, a deliberately failed save, and a second family whose
  plan comes out different.

## 8. Questions judges might ask

- **"Does it use AI?"** The app does not. It uses fixed rules so its advice is
  predictable and cannot make up facts. AI coding assistants helped write the
  code; see `AI_LOG.md`.
- **"How do you know the advice is right for a child?"** The app does not
  claim to know. It offers general, hedged preparation that families choose
  and can edit, and it says it is not medical or therapy advice.
- **"Where do the place ratings come from?"** Only from families using the
  app. Nothing is invented, and every place says whether its information is
  reported by families or unknown.
- **"What happens to an old database when you add features?"** Numbered
  migrations upgrade it, and tests build the original tables and check that
  nothing is lost.
- **"What would you do next?"** Testing with families, deleting plans and
  reports, moderating place reports, accounts if it were hosted publicly, and
  more kinds of places and languages.

## 9. Manual demo checklist

Start with `npm run dev` and open http://localhost:5173.

1. On the home page, choose **Plan a visit**.
2. Enter "the dentist", choose **Dentist**, and mark **Loud or sudden sounds: Often hard**.
   Tick **Noise-reducing headphones**, then create the plan.
3. On the plan, point out **Your answers** and the green "Because sounds can be hard"
   tag on the sounds part. Click **Next** through a few parts.
4. Click **Open reading view**. Try **Read aloud**, then
   **Stop**.
5. Back on the plan, tick a checklist item. Refresh the page and show that it
   stayed ticked.
6. Click **Edit wording**, change a sentence, and save it. Show the "You
   edited this part" tag.
7. Click **Open the steps for the day**. Go to **During the visit** and show the
   family's coping line. Click **Take a break**, then **Go back to the same
   step**.
8. On **Leave and head home**, mark it done and choose **Note what helped**.
   Save a short note.
9. Plan a second visit to the same dentist with **Crowds** and **Waiting**
   marked instead. Under **Use notes from a past visit**, choose the first plan and
   show its notes. Compare the two plans: different story parts and different
   checklist items.
10. Open **Places**. Show the source labels and that example places have no
    scores. Click **Add a report** and show how it appears.
