# AI Log

Date: 2026-10-13
Repository: /workspaces/ai-project

## What I asked the AI so far
- Created this log request: "can u. create an AI_LOG.md and put in there what ive asked u so far, when uve returned, what i fixed and how i tested it"
- This is the first recorded project request captured in the current workspace/session history available to me.

## What the AI returned
- I created this file, AI_LOG.md, in the repository root.
- I summarized the available request history and the current status in a simple project log.
- I did not make application code changes because the request was to document the work rather than fix a software bug.

## What I fixed
- No functional code changes were required for this task.
- The only change made was the addition of AI_LOG.md to the repository root to record the request/response history.

## How I tested it
- Verified the repository root contains the new file.
- Checked the working tree state to confirm the file was created as expected.
- No automated test suite was run because this is a documentation-only change, and no product logic was modified.

## Notes
- This log reflects the information available in the current session only.
- If additional work or prior prompts are added to the project history later, they can be appended here for a fuller timeline.

## Project specification provided
- The project is a calm, sensory-aware web app to help parents prepare children with autism or sensory sensitivities for unfamiliar places.
- Parents will provide the destination and place type, the child's nickname and reading level, sensory triggers and coping tools, and optionally photos of the place.
- The app should generate and save a 5–10 page social story (no more than 3 sentences per page), then provide a progress-tracking checklist for the visit.
- The visit experience should include a calm-break screen with pleasant colors and breathing exercises, returning to the same checklist step afterward.
- Users can rate places from 1–5 for noise, crowds, and waits; ratings update each place's overall calm score and its ranking. The app should also show local places ranked by calm scores.
- Acceptance criteria include story generation within 30 seconds, coverage of every entered trigger with at least one coping tool, and saved stories/photos persisting after refresh.
- Out of scope: user accounts/login, AI illustrations, offline mode, real GPS maps, branded characters, and languages other than English.
- The user explicitly asked not to start implementation yet and wants to proceed step by step. No application code was changed in response to this specification.
- Validation: documentation-only update to this log; no application tests were run.

## Component tree and styling preference
- The user asked for a repository file sketching the app's component tree, describing what each file does, and showing how the pieces connect.
- I created `APP_COMPONENT_TREE.md` as a proposed structure and distinguished planned files from existing starter files.
- The user clarified that styling should remain optional until further notice.
- I updated the component-tree document to mark the styles folder and `CalmLayout` as optional/deferred.
- No application code was changed. Validation: reviewed the documentation changes; no application tests were run.

## Story card props
- The user asked for one reusable `StoryCard` component that displays a story title and destination, with values passed from the Stories page, and wanted an explanation of props.
- I added `client/src/components/StoryCard.jsx`, which receives `title` and `destination` props.
- The Stories page in `client/src/App.jsx` now maps over sample story data and passes those two values into each card.
- Updated `APP_COMPONENT_TREE.md` to match the implemented component/data flow.
- Validation: `npm run lint` and `npm run build` both passed from `client/`.

## Trip checklist interaction with useState
- The user asked for sample preparation steps on the Trip page, a way to mark a step complete, and conditional feedback including a completion message or Calm Break option. They also asked for an explanation of `useState`.
- The Trip Checklist page in `client/src/App.jsx` now tracks completed step IDs with `useState`; selecting “Mark complete” updates state immutably, replaces that button with “Step complete!”, and provides a Calm Break link.
- Updated `APP_COMPONENT_TREE.md` to describe the interaction.
- Validation: `npm run lint` and `npm run build` both passed from `client/`.

## Rendering places from JSON
- The user asked for a small JSON list of places or stories, imported and rendered with `.map()`, using a stable key and passing each item's data to a reusable component.
- Added `client/src/data/samplePlaces.json` with three sample places and stable string IDs.
- Added reusable `client/src/components/PlaceCard.jsx`; the Calm Places page imports the JSON, maps places with each `id` as the key, and passes each place's name, type, and calm score as props.
- Updated `APP_COMPONENT_TREE.md` to describe the data and component flow.
- Validation: `npm run lint` and `npm run build` both passed from `client/`.

## Immutable checklist array updates
- The user asked to practice the array update rule by adding or removing completed checklist steps without mutating state.
- Updated the Trip Checklist interaction in `client/src/App.jsx` so a user can mark a step complete or undo completion. Adding uses a spread-created array; removing uses `.filter()` to create a new array.
- Updated `APP_COMPONENT_TREE.md` to describe both immutable updates.
- Validation: `npm run lint` and `npm run build` both passed from `client/`.

## Full app implementation toward acceptance criteria
- The user clarified that the goal is a functional app meeting the original acceptance criteria, not just a plan. They chose a self-contained story generator rather than an external AI service.
- Added an Express JSON API with a SQLite database for stories, photo data, checklist progress, places, and ratings. Added `/api/health`, story, checklist, and place-rating endpoints.
- Replaced the placeholder views with a story form, 5–10 page trigger-aware story reader, saved story list, persistent checklist, breathing break that returns to the same step, and ranked places with rating forms.
- Added API validation and server-side tests, responsive/calm styling, root development scripts, and local setup documentation.
- Acceptance review: automated tests verify 5–10 story pages, at most three sentences per page, trigger-to-tool pairing, and generation under 30 seconds. API tests verify story/photo retrieval from SQLite, checklist progress across a later GET, and rating updates that change calm scores and ranking. The calm-break route carries the story and step back to the checklist. The seeded places are example data; real GPS-based discovery remains out of scope.
- Validation: `npm test` passes all 7 tests; `npm run lint` and `npm run build` pass. Live checks returned JSON from `/api/health` and `/api/places`, and HTTP 200 for Vite and its deep-link routes. A browser was not available in this environment, so visual interaction and the browser console still need a manual check.

---

## Rebuilding the app with Claude Code (October 22–25, 2026)

The entries above came from an earlier AI-assisted session in a GitHub
Codespace (`/workspaces/ai-project`). They do not name the assistant used.
This section covers a later session on my own computer.

**Tool:** Claude Code, using the Claude Opus 5.5 model. It read the
repository, ran commands, and wrote code, tests, and documentation. I
reviewed each step before it was committed.

The finished app does not use AI. Plans come from fixed rules in
`server/planContent.js` and `server/personalization.js`.

### What I did

- Gave the product vision and requirements for the rebuild, and asked to work
  through it one step at a time so I understood each change.
- Reviewed each step, decided whether to continue, and approved every commit.
- Tested the app myself by creating a dentist plan with photos, and gave
  feedback on what I saw:
  - The plan page "looks kinda ugly", which led to the plan page redesign.
  - Showing the whole story at once could be overstimulating, so I asked for
    the story to show one part at a time with a Next button. That became the
    story reader and quiet view.
  - I asked for visuals and not just words, which led to the picture for each
    story part and support.
- Asked for the end-to-end browser test to be kept in the project.

### What Claude did

- Audited the existing code and proposed the step-by-step plan.
- Wrote the code, tests, and documentation for each step, in these commits:
  - `db106a0`: personalization engine and its tests
  - `45c80df`: saving plans, with database migrations
  - `ce11014`: the visit setup form
  - `172aa65`: plan page redesign, one-part-at-a-time reader, and pictures
  - `2b00f38`: the visit journey
  - `a704081`: the browser test
  - `c2e72be`: editing, rebuilding, and read aloud
  - `fc3f537`: trustworthy place information
  - `ebf6e84`: post-visit reflection
  - The final commit adds the README, this log, and the code guide.
- Proposed these design choices, which I accepted:
  - Rules instead of an AI model.
  - Hedged wording about places.
  - No invented place scores.
  - Reflections that never change the rules automatically.
  - Not using my test plan (which had a child's name and downloaded photos)
    in the README screenshots.

### How the work was checked

- On October 25, 2026:
  - `npm test`: 42 of 42 tests passed.
  - `npm run test:browser`: 57 of 57 checks passed.
  - `npm run lint`: no errors.
  - `npm run build`: succeeded.
- The browser test was checked by deliberately breaking a feature and
  confirming that the test failed.
- Layouts were checked with screenshots at desktop width and at a 390-pixel
  phone width.
- Not done:
  - Testing with families.
  - A formal accessibility audit or screen reader testing.
  - Listening to read aloud. The test only confirms the right words are sent
    to the browser's voice.

### Problems found and fixed along the way

- At first the tests failed only because packages were not installed on this
  computer.
- A first version of story editing would have removed question marks. It was
  caught before testing.
- Going from "Change preferences" to "Plan a visit" could have kept the old
  plan in the form. Each form route now has its own React key.
- Typed text was bold, and link buttons were taller than other buttons. Both
  were CSS fixes.
- Several failures were in the browser test script itself, not the app: an
  incomplete Enter key press, page elements that could not be returned as
  values, and a straight versus curly apostrophe.
- Claude once misreported a browser test count ("40 of 41") and corrected it
  to 39 of 40.
