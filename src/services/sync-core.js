// Pure record-level synchronization helpers. Different daily fields merge independently.
import { blank, empty } from "../domain/core.js";
const clone = (value) => JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function mergePatch(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) continue;
    out[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? mergePatch(base?.[key] || {}, value)
        : value;
  }
  return out;
}
function removed(a, b) {
  return Object.entries(a || {}).some(
    ([k, v]) =>
      !(k in (b || {})) ||
      (v && typeof v === "object" && !Array.isArray(v) && removed(v, b?.[k])),
  );
}
function changed(before, after) {
  const out = {};
  for (const [key, value] of Object.entries(after)) {
    if (!equal(before?.[key], value))
      out[key] =
        value && typeof value === "object" && !Array.isArray(value)
          ? changed(before?.[key] || {}, value)
          : value;
  }
  return out;
}
export function records(state) {
  const out = new Map();
  for (const [key, data] of Object.entries(state.days))
    out.set("day:" + key, { kind: "day", key, data });
  for (const [kind, items] of [
    ["application", state.applications],
    ["contact", state.contacts],
  ])
    for (const data of items)
      out.set(kind + ":" + data.id, { kind, key: data.id, data });
  out.set("timer:current", {
    kind: "timer",
    key: "current",
    data: state.timer,
  });
  return out;
}
export function diffRecords(before, after) {
  const a = records(before),
    b = records(after),
    ops = [];
  for (const [id, r] of b) {
    if (!equal(a.get(id)?.data, r.data)) {
      const previous = a.get(id),
        replace =
          r.kind === "day" && previous && removed(previous.data, r.data);
      ops.push({
        ...r,
        data:
          r.kind === "day" && previous && !replace
            ? changed(previous.data, r.data)
            : clone(r.data),
        deleted: false,
        replace: !!replace,
      });
    }
  }
  for (const [id, r] of a)
    if (!b.has(id)) ops.push({ kind: r.kind, key: r.key, deleted: true });
  return ops;
}
export function coalesce(queue, ops) {
  const out = clone(queue);
  for (const op of ops) {
    const i = out.findIndex((o) => o.kind === op.kind && o.key === op.key),
      old = out[i];
    const next = { ...op, revision: globalThis.crypto.randomUUID() };
    if (
      old &&
      !old.deleted &&
      !op.deleted &&
      op.kind === "day" &&
      !op.replace
    ) {
      next.data = mergePatch(old.data, op.data);
      next.replace = !!old.replace;
    }
    if (i < 0) out.push(next);
    else out[i] = next;
  }
  return out;
}
export function applyOps(state, ops) {
  const out = clone(state);
  for (const op of ops) {
    if (op.kind === "day") {
      if (op.deleted) delete out.days[op.key];
      else
        out.days[op.key] = mergePatch(
          op.replace ? blank() : out.days[op.key] || blank(),
          op.data,
        );
    } else if (op.kind === "timer") {
      out.timer = op.deleted ? null : op.data;
    } else {
      const name = op.kind === "application" ? "applications" : "contacts";
      const i = out[name].findIndex((r) => r.id === op.key);
      if (op.deleted) {
        if (i >= 0) out[name].splice(i, 1);
      } else if (i >= 0) out[name][i] = clone(op.data);
      else out[name].unshift(clone(op.data));
    }
  }
  return out;
}
export function fromDocuments(docs) {
  return applyOps(
    empty(),
    docs.filter(
      (d) =>
        ["day", "application", "contact", "timer"].includes(d.kind) &&
        typeof d.key === "string" &&
        (d.deleted || d.data !== undefined),
    ),
  );
}
export function migrationOps(guest, account) {
  const existing = records(account);
  return [...records(guest)]
    .filter(([id, r]) => r.kind !== "timer" && !existing.has(id))
    .map(([, r]) => ({ ...r, deleted: false }));
}
export function acknowledge(queue, sent) {
  return queue.filter(
    (op) =>
      !sent.some(
        (s) =>
          s.kind === op.kind && s.key === op.key && s.revision === op.revision,
      ),
  );
}
