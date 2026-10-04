import { routine } from "../domain/routine.js";
import {
  countries,
  portals,
  blank,
  localDate,
  shift,
  progress,
  streak,
} from "../domain/core.js";
export const escapeHTML = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function createViews(context) {
  const esc = escapeHTML,
    ids = routine.map((t) => t[0]);
  const day = () => context.db.days[context.date] || blank();
  const card = (title, body) => {
    const themes = {
      "Morning ritual": ["sun", "☀"],
      "Find your next role": ["blue", "↗"],
      "Build & learn": ["violet", "⌘"],
      "Recharge & reflect": ["rose", "☾"],
      "Applications & portal scans": ["blue", "◎"],
      "Meaningful connections": ["rose", "↗"],
      "Technical growth": ["violet", "⌘"],
      "Focus time": ["violet", "◷"],
      "A little less scrolling": ["sun", "◌"],
      "Close the day": ["teal", "✦"],
    };
    const [tone, icon] = themes[title] || ["blue", "✦"];
    return `<section class="card tone-${tone}"><h2><span class="card-icon" aria-hidden="true">${icon}</span>${title}</h2>${body}</section>`;
  };
  const counter = (k, label, target, step = 1) =>
    `<div class="row target"><span>${label}<small style="display:block">Daily target: ${target}</small></span><div class="counter"><button data-count="${k}" data-delta="-${step}" aria-label="Decrease ${label}">−</button><b>${day().counts[k]}</b><button data-count="${k}" data-delta="${step}" aria-label="Increase ${label}">+</button></div></div>`;
  function dashboard() {
    const { db, date } = context;
    const d = day(),
      pct = progress(d, ids),
      xp = Object.values(db.days).reduce(
        (s, d) =>
          s +
          ids.filter((i) => d.tasks[i]).length * 10 +
          Math.min(progress(d, ids), 100),
        0,
      );
    let routineHTML = "";
    for (const [name, start, end] of [
      ["Morning ritual", 0, 6],
      ["Find your next role", 6, 13],
      ["Build & learn", 13, 18],
      ["Recharge & reflect", 18, 27],
    ])
      routineHTML += card(
        name,
        routine
          .slice(start, end)
          .map(
            ([id, title, time]) =>
              `<label class="task"><input type="checkbox" data-task="${id}" ${d.tasks[id] ? "checked" : ""}><span><strong>${esc(title)}</strong><small>${esc(time)}</small></span></label>`,
          )
          .join(""),
      );
    return `<div class="grid"><div><section class="card hero"><div class="row"><div><small>${date === localDate() ? "TODAY'S" : "SELECTED DAY'S"} PROGRESS</small><h2 style="margin:8px 0">Keep your promises to yourself.</h2></div><strong>${pct}%</strong></div><div class="bar" role="progressbar" aria-label="Daily progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div class="metrics"><div><b>${ids.filter((i) => d.tasks[i]).length}/27</b><small>Routine blocks</small></div><div><b>${streak(db, localDate(), ids)} days</b><small>Current streak</small></div><div><b>Level ${Math.floor(xp / 500) + 1}</b><small>${xp} lifetime XP</small></div></div></section>${routineHTML}</div><aside>${card("Applications & portal scans", countries.map((c, i) => counter(c, ["🇮🇳 India", "🇦🇪 UAE", "🇳🇱 Netherlands"][i], "2–3") + `<details><summary>${c} portal scans · ${portals[c].filter((_, j) => d.scans[c + j]).length}/${portals[c].length}</summary><div class="portals">${portals[c].map((p, j) => `<label><input type="checkbox" data-scan="${c + j}" ${d.scans[c + j] ? "checked" : ""}>${p}</label>`).join("")}</div></details>`).join("") + (d.legacyApplications ? `<p>${d.legacyApplications} applications from your old tracker (country unspecified).</p>` : "") + '<p class="muted">Counters are your daily totals. Pipeline records are separate and do not change these counts.</p>')}${card("Meaningful connections", counter("networkCount", "Connection messages", "5 total outreach") + counter("referrals", "Referral requests", "part of 5 outreach") + counter("emails", "Cold emails", "part of 5 outreach"))}${card("Technical growth", counter("leetcodeCount", "LeetCode problems", "1–2") + counter("technicalHours", "Technical hours", "2–4", 0.5))}${card("Focus time", `<div class="timer"><label>Session<select id="duration"><option value="25">Pomodoro · 25 minutes</option><option value="50">Deep work · 50 minutes</option><option value="5">Break · 5 minutes</option></select></label><div id="clock">25:00</div><div class="actions"><button class="primary" id="timerStart">Start / resume</button><button id="timerPause">Pause</button><button id="timerReset">Reset</button></div><p id="timerState"></p><small>${d.focusMinutes + Object.values(d.focusEntries || {}).reduce((s, n) => s + n, 0)} focus minutes logged for this day</small></div>`)}${card("A little less scrolling", `<div class="fields"><label>Entertainment minutes<input data-field="phoneMinutes" type="number" min="0" max="1440" value="${d.phoneMinutes ?? ""}"></label><label>Daily limit (minutes)<input data-field="phoneTarget" type="number" min="0" max="1440" value="${d.phoneTarget}"></label></div><p>${d.phoneMinutes === null ? "Log your Screen Time at the end of the day." : d.phoneMinutes <= d.phoneTarget ? "Within your limit. Make room for what matters." : `${d.phoneMinutes - d.phoneTarget} minutes over your limit. Tomorrow is a fresh start.`}</p>`)}${card("Close the day", `<label>Biggest achievement<textarea data-field="achievement">${esc(d.achievement)}</textarea></label><label>One thing to improve<textarea data-field="improvement">${esc(d.improvement)}</textarea></label><label>Tomorrow’s first priority<textarea data-field="priority">${esc(d.priority)}</textarea></label><p>How did today feel? ${d.score ? d.score + "/10" : "Not scored yet"}</p><div class="score">${Array.from({ length: 10 }, (_, i) => `<button data-score="${i + 1}" aria-pressed="${d.score === i + 1}" class="${d.score === i + 1 ? "active" : ""}">${i + 1}</button>`).join("")}</div>`)}</aside></div>`;
  }
  function pipeline() {
    const { db, date } = context;
    return `<div class="grid"><div>${card("Your application pipeline", `<div class="metrics">${["Applied", "Interview", "Rejected", "Offer"].map((s) => `<div><b>${db.applications.filter((a) => a.stage === s).length}</b><small>${s}</small></div>`).join("")}</div><label style="margin-top:18px">Filter stage<select id="stageFilter"><option>All stages</option>${["Applied", "Interview", "Rejected", "Offer"].map((s) => `<option>${s}</option>`).join("")}</select></label><div id="applicationList">${applicationList()}</div>`)}${card("Networking & follow-ups", `<div id="contactList">${contactsList()}</div>`)}</div><aside>${card("Add an application", `<form id="applicationForm"><label>Company<input name="company" required maxlength="120"></label><label>Role<input name="role" required maxlength="160"></label><div class="fields"><label>Country<select name="country">${countries.map((c) => `<option>${c}</option>`).join("")}</select></label><label>Stage<select name="stage">${["Applied", "Interview", "Rejected", "Offer"].map((s) => `<option>${s}</option>`).join("")}</select></label></div><label>Applied on<input type="date" name="date" required value="${date}"></label><label>Portal, link & notes<textarea name="notes" maxlength="3000"></textarea></label><button class="primary">Save application</button></form>`)}${card("Add a connection", `<form id="contactForm"><label>Person / company<input name="name" required maxlength="160"></label><div class="fields"><label>Outreach type<select name="type"><option>Connection</option><option>Referral</option><option>Cold email</option></select></label><label>Status<select name="status"><option>Sent</option><option>Replied</option><option>Follow up</option><option>Closed</option></select></label></div><label>Contacted on<input name="date" type="date" required value="${date}"></label><label>Follow-up date<input name="followup" type="date"></label><label>Contact details & notes<textarea name="notes" maxlength="3000"></textarea></label><button class="primary">Save connection</button></form>`)}</aside></div>`;
  }
  function applicationList(filter = "All stages") {
    const { db } = context;
    return (
      db.applications
        .filter((a) => filter === "All stages" || a.stage === filter)
        .map(
          (a) =>
            `<article class="list-item"><h3>${esc(a.company)} · ${esc(a.role)}</h3><small>${esc(a.country)} · ${esc(a.date)}</small><p style="white-space:pre-wrap">${esc(a.notes)}</p><div class="actions"><select aria-label="Stage for ${esc(a.company)}" data-app="${esc(a.id)}">${["Applied", "Interview", "Rejected", "Offer"].map((s) => `<option ${s === a.stage ? "selected" : ""}>${s}</option>`).join("")}</select><button data-edit-app="${esc(a.id)}">Edit</button><button class="danger" data-delete-app="${esc(a.id)}">Delete</button></div></article>`,
        )
        .join("") ||
      "<p>No applications here yet. Start with one good match.</p>"
    );
  }
  function contactsList() {
    const { db } = context;
    return (
      db.contacts
        .map(
          (c) =>
            `<article class="list-item"><h3>${esc(c.name)}</h3><small>${esc(c.type)} · ${esc(c.date)}${c.followup ? " · Follow up " + esc(c.followup) : ""}</small>${c.followup && c.followup <= localDate() && c.status !== "Closed" ? '<p class="pill">Follow-up due</p>' : ""}<p style="white-space:pre-wrap">${esc(c.notes)}</p><div class="actions"><select data-contact="${esc(c.id)}" aria-label="Status for ${esc(c.name)}">${["Sent", "Replied", "Follow up", "Closed"].map((s) => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select><button data-edit-contact="${esc(c.id)}">Edit</button><button class="danger" data-delete-contact="${esc(c.id)}">Delete</button></div></article>`,
        )
        .join("") ||
      "<p>Track a connection, referral request, or cold email.</p>"
    );
  }
  function history() {
    const { db, date, month } = context;
    let stats = [7, 30]
      .map((n) => {
        const days = Array.from(
            { length: n },
            (_, i) => db.days[shift(date, i - n + 1)],
          ),
          values = days.map((d) => progress(d, ids));
        return card(
          `${n}-day momentum`,
          `<div class="metrics"><div><b>${Math.round(values.reduce((a, b) => a + b, 0) / n)}%</b><small>Average completion</small></div><div><b>${values.filter((v) => v >= 80).length}</b><small>Days at 80%+</small></div><div><b>${days.reduce((s, d) => s + (d ? countries.reduce((a, c) => a + d.counts[c], d.legacyApplications) : 0), 0)}</b><small>Applications</small></div></div><div class="chart" aria-label="Daily completion over ${n} days">${values.map((v, i) => `<div title="${shift(date, i - n + 1)}: ${v}%"><i style="height:${v}%"></i></div>`).join("")}</div><small>Ending ${date}. Unlogged days count as 0%.</small>`,
        );
      })
      .join("");
    const first = month + "-01",
      offset = (new Date(first + "T12:00:00").getDay() + 6) % 7,
      total = new Date(
        Number(month.slice(0, 4)),
        Number(month.slice(5)),
        0,
      ).getDate();
    return `<div class="grid"><div>${stats}${card("How progress works", "<p>Routine blocks contribute 60%. Applications (6), total outreach (5), LeetCode (1), and technical hours (2) each contribute 10%.</p><p>A streak day reaches 80%. An unfinished today preserves yesterday’s streak until midnight. Each checked block earns 10 XP plus the day’s progress score; every 500 XP earns a level. Editing a day recalculates XP.</p>")}</div><aside>${card(
      "Your month",
      `<div class="row"><button id="monthPrev" aria-label="Previous month">←</button><h3>${new Date(first + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3><button id="monthNext" aria-label="Next month">→</button></div><div class="calendar">${["M", "T", "W", "T", "F", "S", "S"].map((s) => `<small style="text-align:center">${s}</small>`).join("")}${"<span></span>".repeat(offset)}${Array.from(
        { length: total },
        (_, i) => {
          let key = month + "-" + String(i + 1).padStart(2, "0"),
            p = progress(db.days[key], ids);
          return `<button data-date="${key}" class="${p >= 80 ? "complete" : p > 0 ? "partial" : ""} ${key === date ? "selected" : ""}" aria-label="${key}, ${p}% completion">${i + 1}<small>${p}%</small></button>`;
        },
      ).join(
        "",
      )}</div><p class="muted">Green: 80%+ · shaded: some progress. Tap a day to review it.</p>`,
    )}</aside></div>`;
  }
  function accountPanel() {
    const { cloudState, cloud } = context;
    const state = cloudState;
    const body = !state.configured
      ? `<p>Keep your progress with you, wherever you work.</p><div class="setup-note"><strong>One-time Firebase setup needed</strong><p>Create your Firebase project, enable Email/Password sign-in and Firestore, then add the web app config. Your existing local data stays saved.</p></div><p class="muted">Setup instructions are in the project’s docs/firebase-setup.md.</p>`
      : state.user
        ? `<div class="account-summary"><span class="avatar">${esc(state.user.email?.slice(0, 1).toUpperCase() || "U")}</span><div><strong>${esc(state.user.email)}</strong><p>${esc(state.message)}</p></div></div><p>Changes appear automatically on your other signed-in devices. Each account has its own private data.</p><div class="actions"><button id="cloudRetry">Retry sync</button><button id="cloudLogout">Sign out</button></div>${cloud?.guestRecords ? `<div class="setup-note"><strong>Bring your existing progress along</strong><p>${cloud.guestRecords} local records are available. Transfer adds missing days and records; existing cloud records take precedence.</p><button id="migrateLocal" class="primary" ${state.ready ? "" : "disabled"}>Transfer local progress</button></div>` : ""}`
        : `<p>One account. All your devices. Sign in to save your next chapter.</p><form id="authForm"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><div class="actions"><button class="primary" type="submit" value="login">Sign in</button><button type="submit" value="create">Create account</button><button type="button" id="passwordReset">Reset password</button></div></form><p class="muted">Your local progress stays separate until you transfer it after signing in.</p>`;
    return `<section id="accountPanel" class="card tone-violet"><h2><span class="card-icon" aria-hidden="true">☁</span>Your cloud account</h2>${body}</section>`;
  }
  function settings() {
    const { date } = context;
    return (
      accountPanel() +
      card(
        "Your data, in your hands",
        `<p>Sign in to keep your routine, applications, contacts, reflections, and focus timer in sync across devices. A local copy keeps your work available offline. Export a backup whenever you need one.</p><div class="actions"><button id="export" class="primary">Export JSON backup</button><label>Import JSON backup<input id="import" type="file" accept=".json,application/json"></label></div><p>Import validates the file and replaces current data after confirmation. A backup of the current data is downloaded first.</p><button class="danger" id="resetDay">Reset selected day (${date})</button>`,
      ) +
      card(
        "Install on your iPhone",
        `<p>Open the deployed HTTPS address in Safari. Tap Share → Add to Home Screen → Add. Open the new icon once while online to cache the app, then use it offline.</p><p id="offlineStatus">Checking offline support…</p><p>Localhost works for testing on this computer. An iPhone needs an HTTPS site. The app works under a subfolder and has no build step.</p>`,
      ) +
      card(
        "Your original data",
        "<p>The first launch imports the original discipline_ daily records without deleting them. Old application totals remain country-unspecified. The old tracker used UTC date keys; imported dates are retained as recorded.</p>",
      )
    );
  }

  return {
    dashboard,
    pipeline,
    history,
    settings,
    applicationList,
    contactsList,
    accountPanel,
  };
}
