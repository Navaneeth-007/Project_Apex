import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blank,
  empty,
  progress,
  shift,
  localDate,
  streak,
  validate,
  migrate,
} from "../src/domain/core.js";
import { routine } from "../src/domain/routine.js";
const ids = routine.map((t) => t[0]);
test("full routine and targets reach 100%, overcounts capped", () => {
  let d = blank();
  ids.forEach((t) => (d.tasks[t] = true));
  Object.assign(d.counts, {
    India: 6,
    networkCount: 5,
    leetcodeCount: 2,
    technicalHours: 8,
  });
  assert.equal(progress(d, ids), 100);
  assert.equal(progress(blank(), ids), 0);
  assert.equal(ids.length, 27);
});
test("local calendar dates handle month and year boundaries", () => {
  assert.equal(shift("2026-01-01", -1), "2025-12-31");
  assert.equal(shift("2024-02-28", 1), "2024-02-29");
  assert.equal(localDate(new Date(2026, 9, 4, 0, 5)), "2026-10-04");
});
test("streak permits unfinished today and breaks at missing day", () => {
  let db = empty();
  let d = blank();
  ids.forEach((t) => (d.tasks[t] = true));
  Object.assign(d.counts, { India: 6, networkCount: 5 });
  db.days["2026-10-03"] = d;
  db.days["2026-10-02"] = d;
  assert.equal(streak(db, "2026-10-04", ids), 2);
  db.days["2026-10-04"] = d;
  assert.equal(streak(db, "2026-10-04", ids), 3);
});
test("backup roundtrip and malformed rejection", () => {
  let db = empty();
  db.days["2026-10-04"] = blank();
  assert.deepEqual(validate(JSON.parse(JSON.stringify(db))), db);
  assert.throws(() =>
    validate({ version: 3, days: [], applications: [], contacts: [] }),
  );
  db.days["2026-10-04"].counts.India = -1;
  assert.throws(() => validate(db));
});
test("legacy data keeps country-unspecified totals and routine", () => {
  const storage = {
    length: 1,
    key: () => "discipline_2026-10-04",
    getItem: () =>
      JSON.stringify({
        tasks: { yoga: true },
        applications: 7,
        networkCount: 2,
        achievement: "Built a feature",
      }),
  };
  let db = migrate(storage);
  assert.equal(db.days["2026-10-04"].legacyApplications, 7);
  assert.equal(db.days["2026-10-04"].tasks.yoga, true);
  assert.equal(db.days["2026-10-04"].counts.India, 0);
});
