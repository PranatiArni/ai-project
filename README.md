# Ready Together

Ready Together helps parents prepare sensory-sensitive children for unfamiliar places with a personalized trip story, a saved day-of checklist, a breathing break, and family-rated place information.

## Run locally

Requires Node.js 20 or later. From the repository root:

```bash
npm install
npm --prefix client install
npm run dev
```

Open the Vite URL printed in the terminal (usually http://localhost:5173). The Express API runs on port 3001 and is proxied through Vite. No external AI key or user account is required.

Stories, photos, checklist progress, and ratings are stored in a local SQLite database at `.data/app.sqlite`. The database is created automatically and is ignored by Git.

## Check the app

```bash
npm test
npm run lint
npm run build
```

The story writer is a self-contained template generator. It creates 5–10 short pages and pairs each entered trigger with a coping tool; it does not call a hosted AI model.

See [APP_COMPONENT_TREE.md](./APP_COMPONENT_TREE.md) for the component layout and API data flow.
