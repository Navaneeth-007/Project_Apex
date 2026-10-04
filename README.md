# Job Discipline

A dependency-free personal PWA for your daily job search, technical growth, health, and reflection. Original files are preserved in `legacy/`. No build step or backend is required.

## Run locally

```sh
cd /Users/navaneeth/Developer/job-discipline
python3 -m http.server 8080
```

Open http://localhost:8080 in your browser. Alternatively use `npm start`. Do not open index.html directly: JavaScript modules and offline support require an HTTP server. Stop with Ctrl+C.

## Deploy over HTTPS and install on iPhone

Upload only `index.html`, `styles.css`, `app.js`, `core.js`, `routine.js`, `manifest.json`, `sw.js`, and the `icons/` folder to any HTTPS static host. For GitHub Pages, commit those files to a repository, then enable Pages for that branch in Settings → Pages. The relative paths support a repository subfolder. Do not publish backups or personal job-search records. There are no environment variables or build commands.

Open the resulting HTTPS URL in Safari on your iPhone → Share → Add to Home Screen → Add. If shown, keep “Open as Web App” enabled. Launch once online to cache the complete app; subsequent launches work offline. A LAN address using plain HTTP is insufficient for a service worker; localhost is trusted only on the device running the server.

Apple installation guide: https://support.apple.com/guide/iphone/iphea86e5236/ios
Service worker requirements: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

Changing host, port, or browser creates a separate storage area. Use Export/Import to transfer data. Safari and the installed Home Screen app may have separate storage; perform imports from the installed app when that is where you intend to track progress.

## Included

- Original 27 daily blocks, 5:30 AM–10:30 PM; date navigation and automatic saving.
- India/UAE/Netherlands counters and all 16 portal-source checklists from your routine.
- Application pipeline with Applied, Interview, Rejected, Offer; add, edit, delete, stage filter, dates and notes.
- Connections/referrals/cold-email records, follow-up dates and statuses.
- Daily networking counters, LeetCode and technical-hours counters.
- Weighted progress, 7/30-day averages, application totals and monthly completion calendar.
- Current streak (80%+ days), XP and levels.
- 25-minute Pomodoro, 50-minute deep work, 5-minute break; pause/resume/reset and persisted deadline.
- Daily manual phone entertainment usage and target, default 45 minutes.
- End-of-day score, achievement, improvement and tomorrow priority.
- Validated JSON import, export and selected-day reset.
- Responsive light/dark layout, safe-area spacing, iPhone icon and offline app shell.

## Data and calculations

Daily counters are deliberately separate from detailed pipeline/contact records: logging a record does not increment counters, and updating a stage does not change daily application totals. Portal scans are checklists; scanning all sources is not an application quota.

Progress = routine completion × 60% + applications toward 6 × 10% + total outreach toward 5 × 10% + LeetCode toward 1 × 10% + technical hours toward 2 × 10%. Every target is capped. Phone logging, scans, reflections and timer minutes are tracked separately from this inherited scoring formula. Unlogged days count as zero in rolling statistics, which end on the selected date.

Streaks use today in your device's local time, regardless of the selected date. An unfinished today preserves a streak ending yesterday; a missing or sub-80% prior day breaks it. XP is 10 per checked block plus each day's progress percentage; 500 XP per level. Undoing entries recalculates XP. Calendar green means 80% or higher.

A timer uses a wall-clock deadline, so returning from a backgrounded app or reload catches up. Completed focus sessions credit their full duration once to their start day. Breaks do not count. Pausing/resetting a partial session does not log time. Resume after midnight credits the resumed session's day. The app must be opened again to process completion: iOS does not guarantee background execution or an alarm. No push notifications are implemented.

Data stays in browser localStorage under `job-discipline-v3`; it is not synced or encrypted by this app. Phone usage is entered manually (there is no Screen Time integration). Export periodically: browser storage can be cleared or evicted. Import replaces current data after validation and confirmation and initiates a pre-import backup download. Verify that download before importing if browser downloads are restricted.

Original `discipline_YYYY-MM-DD` records migrate on first launch. The old country-unspecified applications remain separately counted rather than being assigned to an invented country. Original storage keys remain intact. The original app used UTC date keys; migration retains dates as recorded. Use the same origin as your old app for automatic migration; otherwise transfer through a backup workflow before changing origin.

## Tests

```sh
npm test
```

Five unit tests cover capped progress, local dates including leap/year boundaries, streak gaps, backup validation, and legacy migration.

Browser verification performed in the Codex browser: daily checkbox/counter/reflection persistence through reload; creation and persisted Interview stage of an application; referral record persistence; 7/30-day stats and calendar; responsive 390×844 timer view; timer start/pause; service worker active; successful page reload and use with the HTTP server stopped.

Physical iPhone installation, dark-mode device rendering, and JSON file-picker import/export round-trip still need device checks. The backup schema is covered by automated round-trip validation tests. A headless browser launch was blocked by the host environment, so interactive browser verification was used instead.

Manual checks before regular use:
1. Install from your HTTPS URL on the iPhone and verify opening offline.
2. Export a backup, confirm the file exists, import it and confirm entries remain.
3. Start a focus session, background/reopen it, and verify the elapsed deadline.
4. Switch dates and confirm each day retains its own checkboxes, counters and notes.

## Updates

The worker fetches network-first and falls back to cache offline. Increase the `CACHE` version in `sw.js` when publishing app changes. New workers wait for existing app windows to close, avoiding mixed-version forced updates. Reopen online after closing all app windows. Cache cleanup only removes this app's cache prefixes.
