# Security and privacy

## Account isolation

Firebase Authentication provides email/password accounts. Firestore rules allow a signed-in user to read and write only their own `users/{uid}/records` collection. Direct deletes are denied; the app synchronizes tombstones. Rules also restrict record kinds, envelope fields, and selected payload types and values.

Unit and emulator integration tests exercise anonymous and cross-account denial, invalid records, direct deletion rejection, and account isolation. These checks are not a security audit. Nested daily payload validation is limited; expand it before adapting this into a shared or higher-trust service.

## Data on the device

Guest records, account caches, and pending edits use localStorage. Account copies remain after sign-out to support offline return. Anyone with access to the browser profile can potentially access those copies; signing out alone does not erase them. JSON exports contain application data and should be handled as personal backups.

Use trusted devices and export a backup before clearing storage. Phone-use tracking is manual. The application does not access Screen Time or automatically send networking messages.

## Credentials and configuration

Firebase web configuration is public and shipped to every browser. It does not grant Admin SDK access; authentication and rules enforce access. Never commit service-account keys, Firebase CLI tokens, passwords, or private backup files. `.gitignore` excludes local environment files, debug logs, and common generated outputs.

Forks should configure their own Firebase project. Production deployment is manual; CI runs validation only.

## Reporting an issue

For a suspected vulnerability, use the repository's GitHub **Report a vulnerability** option if private reporting is enabled. Otherwise, contact the maintainer privately through the contact details on their GitHub profile. Do not post credentials, exploit details against live accounts, or personal data in public issues.

The project does not currently offer a published support SLA or bug bounty.
