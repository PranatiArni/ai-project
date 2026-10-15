# App Component Tree

This document describes the current Ready Together implementation. Styling is intentionally lightweight and limited to readability, responsive layout, and the calm-break experience.

## Front end

```text
client/src/
├── main.jsx                       # Mounts App inside BrowserRouter
├── App.jsx                        # Shared navigation and page routes
├── api.js                         # JSON request, form-list, and photo helpers
├── pages/
│   ├── HomePage.jsx               # Introduction and links to create/read stories
│   ├── StoryFormPage.jsx          # Trip inputs, triggers, coping tools, and photos
│   ├── StoriesPage.jsx            # Loads saved stories and displays an empty state
│   ├── StoryPage.jsx              # Reads a saved story and its photos
│   ├── TripChecklistPage.jsx      # Saved progress, completion count, and calm-break links
│   ├── CalmBreakPage.jsx          # Breathing activity and return to the same checklist step
│   └── PlacesPage.jsx             # Ranked place list and empty state
├── components/
│   ├── StoryCard.jsx              # Reusable link card for a saved story
│   └── PlaceCard.jsx              # Reusable place summary and rating form
├── data/
│   └── samplePlaces.json          # Initial example places and calm scores
└── App.css, index.css             # Responsive layout and calm color palette
```

## Backend

```text
server/
├── index.js                       # Express JSON API and request validation
├── database.js                    # SQLite schema, sample data, and query helpers
├── storyGenerator.js              # Self-contained story text generator
├── api.test.js                    # API, persistence, checklist, and rating tests
└── storyGenerator.test.js         # Page limits and trigger/coping coverage tests
```

## Data flow

- `main.jsx` wraps `App` in `BrowserRouter`. `App.jsx` uses `Routes`, `Route`, and `Link` for navigation.
- `StoryFormPage.jsx` collects trip information and optional images, then sends JSON to `POST /api/stories`. The server validates input, creates 5–10 pages with no more than three sentences each, pairs each trigger with a coping tool, and stores the story and image data in SQLite.
- `StoriesPage.jsx` loads saved stories from `GET /api/stories`, maps the results into `StoryCard` components, and gives an empty state when there are none.
- `StoryPage.jsx` loads the selected story from `GET /api/stories/:id` and shows its pages and any saved photos.
- `TripChecklistPage.jsx` uses immutable array updates for responsive interaction and sends completion changes to `PATCH /api/stories/:id/checklist` so progress survives navigation and refresh.
- Each checklist row links to `/calm-break/:storyId?step=...`. `CalmBreakPage.jsx` runs a breathing cycle and links back to the same checklist step.
- `PlacesPage.jsx` loads JSON place records from `GET /api/places`, maps them into `PlaceCard` components, and shows empty/error states. A card submits noise, crowds, and waits ratings to `POST /api/places/:id/ratings`. SQLite stores ratings, recalculates calm scores, and returns places sorted by score.
- `/api/health` is a simple JSON health endpoint.

## Running and checking the app

From the repository root:

```bash
npm run dev
```

This starts the Express API on port 3001 and the Vite app on port 5173. SQLite data is stored locally in `.data/app.sqlite` and is excluded from version control.

```bash
npm test
npm run lint
npm run build
```

Story generation is self-contained template-based generation. It does not call an external AI service.
