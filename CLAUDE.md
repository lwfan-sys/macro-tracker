# CLAUDE.md — Macro Tracker

This file provides context and conventions for AI assistants working on the Macro Tracker codebase.

## What This App Does

Macro Tracker is a **progressive web app (PWA)** for logging daily food intake with AI-powered food recognition. Users can photograph food to have Google Gemini estimate macros (calories, protein, carbs, fat), or log entries manually. Data is stored entirely in the browser's LocalStorage — there is no backend.

## Technology Stack

- **Vanilla JavaScript** (ES6 modules, no framework)
- **Vite 6** for bundling (`npm run dev`, `npm run build`, `npm run preview`)
- **Pure CSS3** with mobile-first design
- **Google Generative AI API** (Gemini) for food recognition
- **Service Worker** for offline/PWA support
- **Vercel** for deployment

## Project Structure

```
macro-tracker/
├── index.html          # Single-page app shell; contains navigation and modal templates
├── style.css           # All styles (~943 lines); mobile-first; no preprocessor
├── vite.config.js      # Vite build config (root: ., public: public/, out: dist/)
├── vercel.json         # Rewrites all routes → index.html (SPA support)
├── public/
│   ├── sw.js           # Service Worker (network-first caching; skips Gemini API calls)
│   └── manifest.json   # PWA manifest (icons, theme, display mode)
└── js/
    ├── main.js         # Entry point: initializes app, registers SW, runs legacy data migration
    ├── router.js       # Hash-based client-side routing (#/ dashboard ↔ #/settings)
    ├── state.js        # Simple pub/sub state store (event emitter pattern)
    ├── storage.js      # LocalStorage abstraction (read/write/clear/export/import)
    ├── settings.js     # Settings persistence: API key validation, goals, data export
    ├── gemini.js       # Google Generative AI integration (model fallback + retry logic)
    ├── camera.js       # Image capture: reads file/capture, resizes to max 512px, base64 encodes
    └── ui.js           # All DOM rendering and event handling (~573 lines)
```

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `main.js` | Bootstrap only; no business logic |
| `router.js` | Route on hash change; trigger view renders |
| `state.js` | Single state object; `setState()`, `getState()`, `subscribe()` |
| `storage.js` | All LocalStorage reads/writes; key prefix `macroTracker_*` |
| `settings.js` | Validate API key, persist goals, export/import JSON |
| `gemini.js` | Call Gemini API; parse JSON food response; handle errors |
| `camera.js` | Resize images to ≤512px before sending to Gemini |
| `ui.js` | Render dashboard/settings views, handle all user events |

## Data Model

All data is stored in LocalStorage as JSON — there is no backend or database.

**Food entry (per-day key: `macroTracker_foods_YYYY-MM-DD`):**
```js
{
  id: number,          // Date.now() timestamp
  name: string,
  calories: number,
  protein: number,     // grams
  carbs: number,       // grams
  fat: number,         // grams
  meal: "breakfast" | "lunch" | "dinner" | "snacks",
  timestamp: string    // ISO 8601
}
```

**Settings key: `macroTracker_settings`**
```js
{ geminiApiKey: string }
```

**Goals key: `macroTracker_goals`**
```js
{ calories: 2000, protein: 150, carbs: 250, fat: 65 }  // defaults
```

## Gemini API Integration

- **Primary model:** `gemini-2.0-flash`
- **Fallback model:** `gemini-1.5-flash`
- **Retry logic:** On HTTP 429 (rate limit), retry up to 3 times with exponential backoff (3s, 6s, 9s). On 404, try next model. On 403, return `INVALID_API_KEY`.
- **Image constraint:** Images are resized to max 512px before sending to stay within free-tier limits.
- **Response format:** Gemini returns a JSON object with `name`, `calories`, `protein`, `carbs`, `fat`, `confidence`, `portion`.
- **API key:** Entered by user in Settings; stored in LocalStorage. Never hardcoded.

## Development Workflow

```bash
npm install       # Install dependencies (only devDependency: vite)
npm run dev       # Start dev server with hot reload (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

There are **no tests** and **no linter** configured. The build is the only automated check.

## Coding Conventions

- **Function names:** camelCase (`renderDashboard`, `analyzeFood`)
- **CSS classes:** kebab-case (`.food-item`, `.macro-bar`, `.ai-loading`)
- **Storage keys:** always prefixed with `macroTracker_`
- **One concern per module:** UI logic stays in `ui.js`, API logic in `gemini.js`, persistence in `storage.js`
- **Event delegation:** `ui.js` uses `[data-action]` and `[data-id]` attribute selectors rather than per-element listeners
- **No external UI libraries:** All rendering is done with `innerHTML` / DOM APIs
- **CSS base font:** 16px minimum to prevent iOS auto-zoom on inputs

## Key Patterns

**State updates:**
```js
import { setState, getState, subscribe } from './state.js';
setState({ currentDate: '2024-01-15' });
subscribe(() => renderDashboard());
```

**Storage read/write:**
```js
import { getFoods, saveFoods } from './storage.js';
const foods = getFoods('2024-01-15');   // returns [] if none
saveFoods('2024-01-15', [...foods, newEntry]);
```

**Adding a food item flow:**
1. User taps "Add Food" → modal opens (`ui.js`)
2. Optional: user taps camera → `camera.js` resizes image → `gemini.js` calls API → populates form fields
3. User confirms → `storage.js` saves entry → `state.js` triggers re-render → `ui.js` updates dashboard

## Routing

Hash-based SPA routing:
- `#/` or `#` → Dashboard view
- `#/settings` → Settings view

`router.js` listens on `hashchange` and calls the appropriate render function from `ui.js`.

## PWA / Service Worker

`public/sw.js` uses a **network-first** strategy:
- Attempts fetch from network first; falls back to cache
- Explicitly skips caching requests to `generativelanguage.googleapis.com`
- On navigation failure, serves cached `/` (offline fallback)

## Deployment

Vercel automatically deploys from the git remote. `vercel.json` rewrites all paths to `index.html` for SPA routing. Build command: `npm run build`. Output directory: `dist/`.

## What to Avoid

- Do not add a backend or database — the app is intentionally client-only
- Do not add heavy dependencies or UI frameworks; keep bundle size minimal
- Do not hardcode the Gemini API key anywhere in the source
- Do not cache Gemini API responses in the service worker
- Do not break the model fallback chain in `gemini.js`
