# Anabasis

A personal, offline-first workout tracker inspired by Hevy, built as an installable PWA for iPhone.
No backend, no accounts, no analytics: every byte stays on your device.

**Stack:** Vite · React · TypeScript · React Router · Dexie (IndexedDB) · vite-plugin-pwa · Recharts · Vitest + React Testing Library.

## Features

- **Exercise library** — 109 seeded exercises (name, primary muscle, equipment), search + muscle filter, custom exercises (create/edit/delete).
- **Routines** — create/edit routines, reorder exercises, target sets with reps, weight and set type.
- **Active workout** — start empty or from a routine; per set: weight, reps, optional RPE, set type (warm-up / normal / drop / failure), tick to complete. The previous session's values are shown inline (tap to copy; an empty field takes them when you tick). Add/remove sets and exercises mid-workout, workout timer, screen wake lock. Every edit is written to IndexedDB immediately, so closing the app never loses a workout.
- **Rest timer** — auto-starts when you tick a set, per-exercise duration (remembered), ±15 s / skip, timestamp-based so it's correct after iOS suspends the app, in-app beep (Web Audio) when it ends.
- **History** — workouts with duration, volume and sets; tap to view, edit (sets, name, start time, duration) or delete.
- **Progress** — per-exercise charts (best set weight, estimated 1RM via Epley, session volume), all-time bests, PR history, PR badges in history.
- **Settings** — kg/lb, default rest time, JSON backup export/restore (validated), CSV export, delete all data, persistent-storage status, last backup date with a reminder after 14 days.

### Calculation rules

| Metric | Definition |
| --- | --- |
| Estimated 1RM | Epley: `weight × (1 + reps / 30)`; a single rep returns the weight itself. |
| Volume | Σ `weight × reps` over **completed, non-warm-up** sets. |
| PRs | Heaviest weight, best e1RM, best set volume, best session volume. A PR must strictly beat every earlier session. The first session of an exercise is the baseline and earns no badge. |

Weights are always stored in kg; switching to lb only changes display and input.

## Getting started

Requires Node 20.19+ (CI uses Node 24).

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>. The service worker is only generated in production builds, so test offline behaviour with `npm run build` then `npm run preview`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on localhost |
| `npm run dev:host` | Dev server reachable from your local network |
| `npm test` | Unit + integration tests (Vitest, jsdom, fake-indexeddb) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Typecheck + production build into `dist/` (includes service worker + manifest) |
| `npm run preview` / `npm run preview:host` | Serve `dist/` locally / on the LAN |
| `npm run icons` | Regenerate the PNG icons in `public/` (dependency-free script) |

## Testing on an iPhone over the local network

1. Put the Mac and the iPhone on the same Wi-Fi.
2. Find the Mac's IP address:

   ```bash
   ipconfig getifaddr en0
   ```

3. Start the dev server exposed on the network:

   ```bash
   npm run dev:host
   ```

4. On the iPhone, open Safari at `http://<that-ip>:5173`. If it doesn't load, allow incoming connections for Node in *System Settings → Network → Firewall*.

**Limitation:** `http://192.168.x.x` is not a *secure context*, so iOS disables the service worker (offline mode, install), the Wake Lock API and `navigator.storage.persist()` there. The UI, IndexedDB, timers and sound all work, which covers most testing. To test the real PWA (offline, install, wake lock), use the HTTPS GitHub Pages deployment below.

## Deploying to GitHub Pages

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests, builds with the right base path and publishes `dist/`.

1. Create a GitHub repository and push this project to the `main` branch.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).
4. The app is served at `https://<user>.github.io/<repo>/`.

The base path is derived from the repository name (`BASE_PATH=/<repo>/`), or `/` for a `<user>.github.io` repository. To build for a different path locally:

```bash
BASE_PATH=/anabasis/ npm run build
```

The app uses hash-based URLs (`#/history`), so deep links work on GitHub Pages without a 404 redirect hack.

## Installing on iPhone

1. Open the deployed HTTPS URL in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Launch it from the Home Screen icon. It runs full-screen, respects the notch and home indicator, and works offline after the first load.

When a new version is deployed, the app shows an **Update** prompt the next time it's opened online.

## Where your data lives

- Everything is stored in **IndexedDB** (database `anabasis`) in the browser on that device: exercises, routines, workouts, settings and the running rest timer.
- On iOS, **the Home Screen app and a Safari tab have separate storage.** Data logged in a Safari tab won't appear in the installed app; use export/restore to move it.
- Safari can delete storage for websites that haven't been used for a while. Home Screen apps are exempt from that, and the app also requests persistent storage (Settings shows whether it was granted). Deleting the app from the Home Screen deletes its data.
- Nothing is sent over the network. There's no telemetry, analytics or account.

## Backup and restore

- **Export:** *Settings → Export backup (JSON)*. On iPhone this opens the share sheet, so pick **Save to Files** (or AirDrop/email it to yourself). The export date is saved, and a reminder appears when the last backup is more than 14 days old.
- **Restore:** *Settings → Restore from backup…* and pick the `.json` file. The file is checked before anything changes (app id, version, types, ranges, references between workouts/routines and exercises, duplicate ids). You then see a summary and confirm. A restore **replaces** all current data in a single transaction, so a failed import leaves your data untouched.
- **CSV:** *Settings → Export workouts (CSV)* writes one row per set (date, workout, exercise, set type, weight in your unit, reps, RPE, est. 1RM) for spreadsheets. CSV is export-only; use JSON for backups.
- **Delete all data:** *Settings → Delete all data* (asks twice), then reseeds the exercise library.

## Project layout

```
src/
  db/          Dexie schema, seed exercises, types, data actions (all writes go through here)
  lib/         Pure logic: calc (1RM, volume), prs, backup (validate/export/restore), csv, units, sound, storage
  hooks/       Live queries, ticking clock, wake lock
  components/  Workout editor, number steppers, exercise picker, rest timer, layout
  pages/       Screens (one per route)
  test/        Test setup, factories, integration test
scripts/       Icon generator
```

## Tests

```bash
npm test
```

- `src/lib/calc.test.ts` covers Epley 1RM, volume rules and per-session history.
- `src/lib/prs.test.ts` covers PR detection (baseline, ties, warm-ups, ordering, per-exercise tracking).
- `src/lib/backup.test.ts` covers validation errors, the export → wipe → import round trip, atomic restore, and CSV.
- `src/test/workout.integration.test.tsx` logs a full workout through the UI: start, add exercise, log sets, simulate closing/reopening the app, add/remove sets, finish, then check history.
