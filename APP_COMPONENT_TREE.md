# App Component Tree

The current file layout. For how the pieces work together, see
[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md).

## Front end

```text
client/src/
├── main.jsx                       # Mounts App inside BrowserRouter
├── App.jsx                        # Navigation and page routes
├── api.js                         # requestJson() and file-reading helpers
├── useChecklist.js                # Saves checklist ticks; undoes them if a save fails
├── useSpeech.js                   # Read aloud with the browser's built-in speech
├── reflection.js                  # Shared helper for after-visit notes
├── pages/
│   ├── HomePage.jsx               # What the app does and how it works
│   ├── StoryFormPage.jsx          # Plan a visit, or change a plan's preferences
│   ├── StoriesPage.jsx            # Saved plans with checklist progress
│   ├── StoryPage.jsx              # The plan: choices, story, checklist, questions, notes
│   ├── ReadTogetherPage.jsx       # Quiet view: the story only, in larger text
│   ├── VisitJourneyPage.jsx       # Four day-of steps (route /trip/:id)
│   ├── CalmBreakPage.jsx          # Breathing activity; returns to the same step
│   └── PlacesPage.jsx             # Places, family reports, and adding a place
└── components/
    ├── StoryReader.jsx            # One story part at a time, with read aloud
    ├── StoryPicture.jsx           # Line drawings for story parts and supports
    ├── StoryEditor.jsx            # Edit story wording
    ├── ChecklistItem.jsx          # One saved checklist checkbox
    ├── ReflectionSection.jsx      # "After the visit" notes
    ├── StoryCard.jsx              # One saved plan in the list
    └── PlaceCard.jsx              # One place, its reports, and the report form
```

## Back end

```text
server/
├── index.js                       # Express routes and request validation
├── database.js                    # SQLite schema, numbered migrations, serializeStory()
├── planContent.js                 # What plans can say: areas, supports, places, rules
├── personalization.js             # Builds the plan and journey from a profile
├── places.js                      # Place reports: validation, summaries, ranking
├── reflection.js                  # After-visit notes and carrying them forward
├── data/examplePlaces.json        # Example places (not real venues)
└── *.test.js                      # Server tests (npm test)

scripts/
└── browser-test.mjs               # End-to-end test in headless Chrome

docs/
├── HOW_IT_WORKS.md                # Guide to the code
└── screenshots/                   # Screenshots used in the README
```

## Routes

| Path | Page |
| --- | --- |
| `/` | Home |
| `/create-story` | Plan a visit |
| `/stories` | Saved plans |
| `/stories/:id` | The plan (`?reflect=1` opens the after-visit notes) |
| `/stories/:id/read` | Quiet story view (`?part=` remembers the part) |
| `/stories/:id/preferences` | Change preferences and rebuild |
| `/trip/:id` | Visit journey (`?step=` remembers the step) |
| `/calm-break/:id` | Calm break, returning to `?step=` |
| `/places` | Places and family reports |
