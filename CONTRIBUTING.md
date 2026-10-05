# Contributing

Project Apex keeps the internal Job Discipline package, Firebase identifiers, and storage schema. Avoid renaming those identifiers without a migration plan.

## Local workflow

1. Install Node.js 22+ and run `npm ci`.
2. Create a branch for one coherent change.
3. Run `npm start` and open localhost:8080. Restart after source edits.
4. Run `npm run format`, `npm test`, and `npm run build` before proposing a change.
5. For authentication, rules, or sync changes, also run the [Firebase integration tests](docs/testing.md).

Use an isolated demo Firebase project or your own project for testing. Never upload synthetic test records to the showcase production account.

## Conventions

Keep calculations and merge logic in the domain/services modules, UI templates in `src/ui/views.js`, and app events in `src/app.js`. Escape user-provided content when rendering HTML. Keep dependencies minimal and update the lockfile with dependency changes.

Add tests for changed business behavior and sync edge cases. Validate layout on mobile and desktop, including long text and empty states. Update relevant documentation when behavior, commands, or configuration change.

## Pull requests

Explain the concrete problem, resulting behavior, and checks performed. Include screenshots for visible UI changes, using fictional data. Note migrations or changed conflict semantics. Use the repository's pull request template.

## Repository hygiene

Do not commit `dist/`, `node_modules/`, emulator exports, credentials, private backup JSON, or debug logs. Public Firebase web settings are expected in the browser; service-account keys and CLI tokens are not. Production deployment is a separate deliberate operation and is not triggered by CI.

## Screenshot maintenance

Current captures are in `docs/images/`; [screenshot notes](docs/screenshots.md) describe their provenance. Replace captures when visible behavior changes. Keep navigation and relevant controls visible, use descriptive alt text, and exclude real emails, passwords, contacts, or application notes.
