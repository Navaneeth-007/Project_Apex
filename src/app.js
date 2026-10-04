import { createCloud, friendlyError } from "./services/cloud.js";
import { createViews } from "./ui/views.js";
import {
  KEY,
  localDate,
  shift,
  blank,
  empty,
  validate,
  migrate,
} from "./domain/core.js";
const $ = (s) => document.querySelector(s);
let cloud = null,
  cloudState = {
    configured: false,
    user: null,
    state: "local",
    message: "Saved on this device",
  },
  db,
  storageError = false;
try {
  const saved = localStorage.getItem(KEY);
  db = saved ? JSON.parse(saved) : migrate(localStorage);
} catch {
  db = empty();
  storageError = true;
}
let date = localDate(),
  view = "today",
  month = date.slice(0, 7);
const day = () => db.days[date] || blank();
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
function save() {
  try {
    localStorage.setItem(cloud?.localKey || KEY, JSON.stringify(db));
    cloud?.localChanged();
    updateCloudBadge();
  } catch {
    $("#storageStatus").textContent = "Save failed — export a backup";
    toast("Storage unavailable or full. Export your data before closing.");
  }
}
function update(fn, redraw = true) {
  const d = day();
  fn(d);
  db.days[date] = d;
  save();
  if (redraw) render();
}
function updateCloudBadge() {
  const badge = $("#cloudBadge");
  if (!badge) return;
  badge.dataset.state = cloudState.state;
  $("#storageStatus").textContent = cloudState.message;
  badge.title = cloudState.message;
  badge.setAttribute("aria-label", "Cloud account: " + cloudState.message);
}
const {
  dashboard,
  pipeline,
  history,
  settings,
  applicationList,
  contactsList,
  accountPanel,
} = createViews({
  get db() {
    return db;
  },
  get date() {
    return date;
  },
  get month() {
    return month;
  },
  get cloud() {
    return cloud;
  },
  get cloudState() {
    return cloudState;
  },
});
function render() {
  updateCloudBadge();
  editingApp = editingContact = null;
  $("#date").value = date;
  $("#main").innerHTML = { today: dashboard, pipeline, history, settings }[
    view
  ]();
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (view === "today") tick(true);
  if (view === "settings")
    $("#offlineStatus").textContent = navigator.serviceWorker?.controller
      ? "Offline cache active."
      : "Offline cache will activate after the first successful online load.";
}
function exportData() {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `job-discipline-${localDate()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let editingApp = null,
  editingContact = null;
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const x = b.dataset;
  if (x.view) {
    view = x.view;
    render();
  }
  if (b.id === "cloudBadge") {
    view = "settings";
    render();
  }
  if (x.count)
    update(
      (d) =>
        (d.counts[x.count] = Math.max(
          0,
          Math.round((d.counts[x.count] + Number(x.delta)) * 10) / 10,
        )),
    );
  if (x.score) update((d) => (d.score = Number(x.score)));
  if (x.date) {
    date = x.date;
    view = "today";
    render();
  }
  if (b.id === "prev" || b.id === "next") {
    date = shift(date, b.id === "prev" ? -1 : 1);
    render();
  }
  if (b.id === "today") {
    date = localDate();
    render();
  }
  if (b.id === "monthPrev" || b.id === "monthNext") {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + (b.id === "monthPrev" ? -1 : 1));
    month = localDate(d).slice(0, 7);
    render();
  }
  if (b.id === "export") exportData();
  if (
    b.id === "resetDay" &&
    confirm(
      "Reset routine, counters, and reflection for " +
        date +
        "? Pipeline records stay saved.",
    )
  ) {
    delete db.days[date];
    save();
    render();
  }
  for (const [type, arr] of [
    ["app", db.applications],
    ["contact", db.contacts],
  ]) {
    if (
      x["delete" + (type === "app" ? "App" : "Contact")] &&
      confirm("Delete this record?")
    ) {
      const id = x["delete" + (type === "app" ? "App" : "Contact")];
      arr.splice(
        arr.findIndex((a) => a.id === id),
        1,
      );
      save();
      render();
    }
    const id = x[type === "app" ? "editApp" : "editContact"];
    if (id) {
      const item = arr.find((a) => a.id === id),
        form = $(type === "app" ? "#applicationForm" : "#contactForm");
      for (const [k, v] of Object.entries(item))
        if (form.elements[k]) form.elements[k].value = v;
      if (type === "app") editingApp = id;
      else editingContact = id;
      form.querySelector("button").textContent = "Save changes";
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  if (b.id === "cloudRetry") cloud?.retry();
  if (b.id === "cloudLogout")
    cloud?.logout().catch((err) => toast(friendlyError(err)));
  if (b.id === "migrateLocal") {
    try {
      const n = cloud.uploadGuest();
      toast(
        n
          ? `${n} local records queued for transfer.`
          : "No new local records to transfer.",
      );
    } catch (err) {
      toast(friendlyError(err));
    }
  }
  if (b.id === "passwordReset") {
    const email = $("#authForm [name=email]")?.value.trim();
    if (!email) {
      toast("Enter your email first.");
      return;
    }
    cloud
      .resetPassword(email)
      .then(() =>
        toast("If this email has an account, a reset link will arrive."),
      )
      .catch((err) => toast(friendlyError(err)));
  }
  if (b.id.startsWith("timer")) timerAction(b.id);
});
document.addEventListener("change", async (e) => {
  const t = e.target,
    x = t.dataset;
  if (t.id === "date" && t.value) {
    date = t.value;
    month = date.slice(0, 7);
    render();
  }
  if (x.task) update((d) => (d.tasks[x.task] = t.checked));
  if (x.scan) update((d) => (d.scans[x.scan] = t.checked));
  if (x.field && t.type === "number") {
    if (!t.checkValidity()) {
      t.reportValidity();
      return;
    }
    update(
      (d) =>
        (d[x.field] =
          t.value === "" && x.field === "phoneMinutes"
            ? null
            : Number(t.value)),
    );
  }
  if (x.app) {
    db.applications.find((a) => a.id === x.app).stage = t.value;
    save();
    render();
  }
  if (x.contact) {
    db.contacts.find((a) => a.id === x.contact).status = t.value;
    save();
  }
  if (t.id === "stageFilter")
    $("#applicationList").innerHTML = applicationList(t.value);
  if (t.id === "duration") {
    if (db.timer?.running) {
      toast("Pause the current session before changing duration.");
      t.value = db.timer.duration;
      return;
    }
    db.timer = {
      duration: Number(t.value),
      remaining: Number(t.value) * 60,
      running: false,
      date: localDate(),
      break: Number(t.value) === 5,
    };
    save();
    tick();
  }
  if (t.id === "import" && t.files[0]) {
    try {
      if (t.files[0].size > 10000000) throw Error("Backup is too large.");
      const incoming = validate(JSON.parse(await t.files[0].text()));
      if (
        confirm(
          "Replace your data with this backup? Your current backup will download first.",
        )
      ) {
        exportData();
        db = incoming;
        save();
        render();
        toast("Backup imported.");
      }
    } catch (err) {
      toast("Import failed: " + err.message);
    }
    t.value = "";
  }
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.field && e.target.tagName === "TEXTAREA")
    update((d) => (d[e.target.dataset.field] = e.target.value), false);
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "authForm") {
    const f = e.target,
      v = Object.fromEntries(new FormData(f)),
      create = e.submitter?.value === "create";
    f.querySelectorAll("button").forEach((b) => (b.disabled = true));
    cloud
      .login(v.email.trim(), v.password, create)
      .catch((err) => toast(friendlyError(err)))
      .finally(() =>
        f.querySelectorAll("button").forEach((b) => (b.disabled = false)),
      );
    return;
  }
  const f = e.target,
    v = Object.fromEntries(new FormData(f)),
    app = f.id === "applicationForm",
    edit = app ? editingApp : editingContact,
    arr = app ? db.applications : db.contacts;
  for (const k in v) v[k] = v[k].trim();
  if (!(app ? v.company && v.role : v.name)) {
    toast("Please enter the required details.");
    return;
  }
  if (edit)
    Object.assign(
      arr.find((a) => a.id === edit),
      v,
    );
  else arr.unshift({ id: crypto.randomUUID(), ...v });
  editingApp = editingContact = null;
  save();
  render();
  toast(edit ? "Changes saved." : "Record saved.");
});
function timerAction(action) {
  let t = db.timer || {
    duration: Number($("#duration").value),
    remaining: Number($("#duration").value) * 60,
    running: false,
    date: localDate(),
    break: Number($("#duration").value) === 5,
  };
  if (action === "timerStart" && !t.running) {
    if (t.remaining === 0) {
      t.remaining = t.duration * 60;
      t.id = crypto.randomUUID();
    }
    t.id ||= crypto.randomUUID();
    t.end = Date.now() + t.remaining * 1000;
    t.running = true;
    t.date = localDate();
  }
  if (action === "timerPause" && t.running) {
    t.remaining = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
    t.running = false;
  }
  if (action === "timerReset") {
    t.remaining = t.duration * 60;
    t.running = false;
    t.id = crypto.randomUUID();
  }
  db.timer = t;
  save();
  tick();
}
function tick(displayOnly = false) {
  const t = db.timer;
  if (!displayOnly && t?.running && Date.now() >= t.end) {
    t.running = false;
    t.remaining = 0;
    if (!t.break) {
      const d = db.days[t.date] || blank();
      d.focusEntries ||= {};
      d.focusEntries[t.id || String(t.end)] = t.duration;
      db.days[t.date] = d;
    }
    save();
    toast(
      t.break
        ? "Break complete. Ready for your next block?"
        : "Focus session complete. Take a breath.",
    );
    if (view === "today") render();
    return;
  }
  if ($("#clock")) {
    const s = t
      ? t.running
        ? Math.max(0, Math.ceil((t.end - Date.now()) / 1000))
        : t.remaining
      : 1500;
    $("#clock").textContent =
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    if (t) $("#duration").value = t.duration;
    $("#timerState").textContent = t?.running
      ? "Running · session belongs to " + t.date
      : t?.remaining === 0
        ? "Session complete"
        : t
          ? "Paused"
          : "Ready when you are";
  }
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => tick());
window.addEventListener("storage", (e) => {
  if (e.key === (cloud?.localKey || KEY) && e.newValue) {
    try {
      db = JSON.parse(e.newValue);
      render();
    } catch {}
  }
});
cloud = createCloud({
  getState: () => db,
  setState: (state) => {
    const oldEditApp = editingApp,
      oldEditContact = editingContact,
      active = document.activeElement,
      focused = active?.matches("input,textarea,select") ? active : null;
    const pendingForm = focused?.closest("form"),
      values = pendingForm
        ? Object.fromEntries(new FormData(pendingForm))
        : null,
      field = focused?.dataset.field,
      selection = focused?.selectionStart;
    db = state;
    render();
    if (values) {
      editingApp = oldEditApp;
      editingContact = oldEditContact;
      const form = document.getElementById(pendingForm.id);
      if (form)
        for (const [k, v] of Object.entries(values))
          if (form.elements[k]) form.elements[k].value = v;
    }
    const target = field
      ? document.querySelector(`[data-field="${field}"]`)
      : focused?.name
        ? document.querySelector(`[name="${focused.name}"]`)
        : null;
    if (target) {
      target.focus();
      if (
        selection !== null &&
        selection !== undefined &&
        target.setSelectionRange &&
        target.type !== "number"
      )
        try {
          target.setSelectionRange(selection, selection);
        } catch {}
    }
  },
  status: (state) => {
    const accountChanged = cloudState.user?.uid !== state.user?.uid;
    cloudState = state;
    updateCloudBadge();
    if (view === "settings" && (accountChanged || !$("#authForm :focus"))) {
      const host = $("#accountPanel");
      if (host) host.outerHTML = accountPanel();
    }
  },
  notice: toast,
});
render();
cloud.start();
if (storageError) {
  $("#storageStatus").textContent = "Storage could not be read";
  toast(
    "Saved data could not be read. Import a backup or export current work.",
  );
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("./sw.js")
    .catch(() =>
      toast("Offline support unavailable. Serve through localhost or HTTPS."),
    );
