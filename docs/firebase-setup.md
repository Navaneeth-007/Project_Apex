# Firebase setup and deployment

The showcase is live at **https://job-discipline-fa29a.web.app/**. Firebase Hosting and the private Firestore rules are deployed.

## Configuration

This repository is configured for the Firebase project `job-discipline-fa29a`. The public web settings live in `src/config/firebase.js`; `.firebaserc` selects the same project for the CLI. Never put service-account keys or Admin SDK credentials in the frontend or repository.

Forks should use a separate Firebase project; do not deploy a fork over the showcase. To use your own Firebase project, register a web app in Project settings → General → Your apps, replace the public configuration and update `.firebaserc`.

## Enable the services

1. Open [Firebase Console](https://console.firebase.google.com/project/job-discipline-fa29a/overview).
2. Build → Authentication → Get started → Sign-in method → enable **Email/Password**. Email-link sign-in is not used.
3. Build → Firestore Database → Create database → choose Standard edition and the **default** database in a suitable location.
4. Start in **Production mode**. The included `firebase/firestore.rules` grants access only to the signed-in account's own records.
5. Authentication → Settings → Authorized domains should include `localhost` for local testing and your deployed hostname. The existing project configuration includes localhost and its Firebase hosting domains.

References: [web setup](https://firebase.google.com/docs/web/setup), [email/password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Firestore setup](https://firebase.google.com/docs/firestore/quickstart).

## Publish

With the Firebase CLI installed:

```sh
firebase login
npm run deploy
```

`npm run deploy` builds the app, publishes only `dist/`, and deploys the private Firestore rules. The CLI prints the HTTPS hosting address when successful. Rules can also be published manually in Firestore → Rules by copying `firebase/firestore.rules`.

The deploy command uses the project in `.firebaserc`. If deploying a fork to another project, select that project first or explicitly pass `--project YOUR_PROJECT_ID` to the Firebase CLI.

[Firebase deployment reference](https://firebase.google.com/docs/cli).

## First sign-in and existing progress

1. Open the app → Account & backup → create an account with your email and password.
2. Choose **Transfer local progress** if original browser-only records are available. It adds missing days/applications/contacts; existing cloud records take precedence.
3. Wait for **All changes synced**.
4. Open the HTTPS URL on another device and sign in with the same account.
5. On iPhone, install from Safari and sign in inside the installed app.

Guest records remain separate and are never uploaded automatically. Signing out returns to the original local workspace; signing out is blocked while changes are still pending to reduce accidental data loss.

## Troubleshooting

- **Enable Email/Password sign-in**: turn on the password provider in Authentication.
- **Cloud access was denied**: publish the included rules and use Retry sync.
- **Offline / changes waiting**: reconnect, keep the app open, and wait for synced status.
- **Firebase CLI sign-in required**: run `firebase login` and complete Google authentication yourself.
- **Previous app version remains visible**: close all app windows, reopen online, and reload after the new worker activates.

## Local integration tests

```sh
firebase emulators:start --only auth,firestore --project demo-job-discipline
```

Then run `npm run test:firebase` in another terminal. These tests override the production configuration with a demo project and synthetic data. They do not send test records to the production Firebase project.

## Hosting-only updates

After checking the build, publish only the static app when rules have not changed:

```sh
npm run build
firebase deploy --only hosting --project job-discipline-fa29a
```

For a fork, substitute your own project ID. The full `npm run deploy` command also publishes the checked-in rules. Review rule changes before deploying them.

## Release verification and rollback

Check the live HTTPS page, manifest, service worker, and Apple touch icon after deployment. Verify sign-in and cross-device changes with your own account. Keep production data separate from emulator tests and screenshot fixtures.

Firebase Hosting's release history provides [static-site rollback](https://firebase.google.com/docs/hosting/manage-hosting-resources#rollback) in Console → Hosting. A Hosting rollback does not revert Firestore records or rules. Restore rules by reviewing and deploying the intended rules revision; restore app data only from a deliberate backup workflow.

The service worker can keep an older app open until all previous app windows close. Close those windows and reopen online when verifying a release. Deployment does not delete existing Firestore records.
