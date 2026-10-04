# Architecture

The browser renders a static app shell and connects directly to Firebase Authentication and Cloud Firestore. No separate application server or cloud functions are required.

## Source modules

- `src/app.js` owns UI events, selected date/view, the in-memory data model, backups and timer lifecycle.
- `src/ui/views.js` renders HTML using escaped user-supplied content and a current-state context.
- `src/domain/core.js` supplies day defaults, local dates, progress/streak calculations, backup validation and legacy migration.
- `src/domain/routine.js` preserves the original 27 routine blocks.
- `src/services/sync-core.js` contains pure record-diff, queue, merge and acknowledgement functions.
- `src/services/cloud.js` handles authentication, account-specific caches, Firestore listeners and pending writes.
- `src/services/firebase-sdk.js` limits the Firebase SDK surface bundled for the browser.

## Storage and isolation

Guest data remains under the original `job-discipline-v3` localStorage key. Each signed-in user gets a separate account cache and durable pending-write queue. Firestore documents live under `users/{uid}/records/{recordId}`. The rules reject unauthenticated requests and reads/writes to another account's path.

The UI keeps working from the account cache offline. Changes are journaled locally before cloud upload, coalesced by record, then written in batches of at most 400. Only acknowledged revisions are removed from the queue; a newer edit made during upload remains pending. Server snapshots are overlaid with pending local edits to avoid replacing unsynced work.

Local copies remain on the device to support offline return to the account. Use a trusted device for private notes and contact details; clear browser storage when you intentionally want to remove local copies. JSON exports contain the account's application data, not Firebase credentials.

## Conflicts and deletions

Separate fields on a daily record merge independently. Simultaneous edits to the same text field or numeric counter use the last server write; they are not additive. Application and contact edits replace the whole record and use the same last-write behavior.

Removals are synchronized as tombstones. Resetting a day removes that day's app data, while pipeline records remain separate. Imports deliberately replace current app data and use replacement semantics when sparse fields disappear.

Focus sessions are stored by session ID in each day. Completion on two devices writes the same entry, so the same shared session does not add minutes twice. Prior recorded focus minutes are retained separately for compatibility.

## Build and offline caching

`npm run build` bundles the browser JavaScript/CSS with esbuild, copies the public assets and HTML into `dist/`, and generates a service worker asset list. Its version derives from the built contents, so app changes automatically produce a new cache version.

The worker caches only this app's static assets. Firebase API traffic is handled by Firebase and the app's own save queue. The app shell uses network-first requests and falls back to cached assets offline. New workers wait for older app windows to close; reopen online to pick up a deployed update.

`npm start` builds and serves only `dist/` on localhost. Firebase Hosting also publishes only `dist/`, so source code, tests, logs and dependencies are not accidentally served.

## Practical limits

All record types are loaded for the signed-in account because this is a personal tracker. Stats and XP derive locally from those records. For a larger shared product, add pagination, stricter schema validation and explicit conflict-resolution interfaces.

Timers depend on the wall clock and are processed when the app runs; background alarms are not guaranteed on iOS. Phone usage is manual. Sync errors stay visible and keep pending edits locally; export a backup before clearing that storage.
