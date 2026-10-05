# Testing and release verification

## Standard checks

```sh
npm ci
npm run format:check
npm test
npm run build
```

The GitHub Actions workflow runs formatting, 12 unit tests, and the production build. The lockfile supplies repeatable npm installs. A successful workflow validates these checks; it does not deploy or certify device behavior.

| Suite                            | Coverage                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `tests/core.test.js`             | Weighted progress, calendar boundaries, streaks, backup validation, legacy migration                                             |
| `tests/sync.test.js`             | Independent-field merges, offline overlays, revision acknowledgement, deletion, import replacement, shared session deduplication |
| `tests/firebase.integration.mjs` | Real local Auth/Firestore behavior, rules enforcement, two clients, offline replay, migration, removals, account isolation       |

## Firebase integration tests

Install the Firebase CLI and Java 21+. Firebase documents its Java upgrade requirement in the [Firestore emulator guide](https://firebase.google.com/docs/emulator-suite/connect_firestore). Start the isolated emulators in one terminal:

```sh
firebase emulators:start --only auth,firestore --project demo-job-discipline
```

In another terminal:

```sh
npm run test:firebase
```

Ports are 9099 for Auth and 8081 for Firestore, both bound to localhost. The two integration tests override production settings with a demo project and synthetic records. Do not change them to run against production. Stop emulators after testing.

An automated local run can use:

```sh
firebase emulators:exec --only auth,firestore --project demo-job-discipline "npm run test:firebase"
```

Integration tests are separate from the current GitHub Actions workflow and require local emulator prerequisites.

## Browser and device checks

Before releasing UI or sync changes, verify:

- Today checkboxes/counters survive a reload; date navigation keeps daily records separate.
- Application stages, stage filters, and networking follow-ups behave as expected.
- Insights and calendar reflect edited records; unlogged dates count as zero.
- Timer pause/resume persists and completed focus sessions are not credited twice.
- Export/import succeeds with a valid backup and rejects malformed data.
- Two signed-in devices exchange changes; offline edits replay after reconnecting.
- The installed app opens after a previous online cache, and a new version activates after closing old app windows.
- Mobile layouts avoid horizontal overflow, forms remain usable, and system dark mode is readable.

The current showcase captures include a 390×844 mobile viewport check without horizontal overflow. A desktop browser emulation is not a substitute for testing installation, storage behavior, or background suspension on a physical iPhone.

## Release sequence

Run the standard checks, run emulators for changes affecting authentication/rules/sync, review the diff, then follow [deployment](firebase-setup.md). Confirm the hosted header, manifest, service worker, icon, and account flow after release. Use only synthetic data for public screenshots.
