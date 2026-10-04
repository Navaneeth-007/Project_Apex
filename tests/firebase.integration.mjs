import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import * as appSDK from "firebase/app";
import * as authSDK from "firebase/auth";
import * as storeSDK from "firebase/firestore";
import { createCloud } from "../src/services/cloud.js";
import { blank, empty, KEY } from "../src/domain/core.js";
const projectId = "demo-job-discipline";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check) {
  const end = Date.now() + 20000;
  while (!check()) {
    if (Date.now() > end) throw Error("Timed out waiting for cloud state");
    await sleep(50);
  }
}
class Storage {
  items = new Map();
  getItem(k) {
    return this.items.get(k) || null;
  }
  setItem(k, v) {
    this.items.set(k, v);
  }
}
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
globalThis.window = new EventTarget();
globalThis.location = { hostname: "localhost" };
const config = {
  apiKey: "fake-api-key",
  projectId,
  authDomain: projectId + ".firebaseapp.com",
  appId: "demo-app",
};
function client(initial = empty()) {
  let state = initial,
    status,
    app;
  const storage = new Storage();
  storage.setItem(KEY, JSON.stringify(initial));
  const cloud = createCloud({
    getState: () => state,
    setState: (v) => (state = v),
    status: (v) => (status = v),
    notice: () => {},
    storage,
    config,
    emulators: true,
    loadSDK: async () => ({
      ...appSDK,
      ...authSDK,
      ...storeSDK,
      initializeApp: (c) =>
        (app = appSDK.initializeApp(c, "test-" + crypto.randomUUID())),
    }),
  });
  return {
    cloud,
    storage,
    get state() {
      return state;
    },
    get status() {
      return status;
    },
    get app() {
      return app;
    },
  };
}
test("Firebase owner-only rules reject anonymous and cross-account access", async () => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8081,
      rules: await readFile("firebase/firestore.rules", "utf8"),
    },
  });
  try {
    const alice = env.authenticatedContext("alice").firestore(),
      bob = env.authenticatedContext("bob").firestore(),
      anon = env.unauthenticatedContext().firestore(),
      path = "users/alice/records/day%3A2026-10-04",
      value = {
        kind: "day",
        key: "2026-10-04",
        deleted: false,
        data: blank(),
        updatedAt: storeSDK.serverTimestamp(),
      };
    await assertSucceeds(storeSDK.setDoc(storeSDK.doc(alice, path), value));
    await assertFails(storeSDK.getDoc(storeSDK.doc(bob, path)));
    await assertFails(storeSDK.getDoc(storeSDK.doc(anon, path)));
    await assertFails(storeSDK.setDoc(storeSDK.doc(bob, path), value));
    await assertFails(storeSDK.deleteDoc(storeSDK.doc(alice, path)));
    await assertFails(
      storeSDK.setDoc(storeSDK.doc(alice, "users/alice/records/invalid"), {
        ...value,
        kind: "invalid",
      }),
    );
  } finally {
    await env.cleanup();
  }
});
test("real auth, two-device sync, offline queue, migration and account isolation", async () => {
  const guest = empty();
  guest.days["2026-10-02"] = blank();
  guest.days["2026-10-02"].achievement = "Original guest work";
  const a = client(guest),
    b = client(),
    email = `test-${Date.now()}@example.com`,
    password = "Test-password-123";
  try {
    await a.cloud.start();
    await a.cloud.login(email, password, true);
    await until(() => a.status?.ready);
    assert.equal(a.state.days["2026-10-02"], undefined);
    assert.equal(a.cloud.uploadGuest(), 1);
    await until(() => a.status.state === "synced" && a.status.pending === 0);
    await b.cloud.start();
    await b.cloud.login(email, password);
    await until(() => b.status?.ready && b.state.days["2026-10-02"]);
    a.state.days["2026-10-04"] = blank();
    a.state.days["2026-10-04"].tasks.yoga = true;
    a.cloud.localChanged();
    await until(() => b.state.days["2026-10-04"]?.tasks.yoga);
    b.state.days["2026-10-04"].counts.India = 3;
    b.cloud.localChanged();
    await until(() => a.state.days["2026-10-04"]?.counts.India === 3);
    assert.equal(a.state.days["2026-10-04"].tasks.yoga, true);
    navigator.onLine = false;
    a.state.days["2026-10-04"].priority = "Offline priority";
    a.cloud.localChanged();
    await sleep(800);
    assert.equal(a.status.pending, 1);
    await assert.rejects(() => a.cloud.logout());
    navigator.onLine = true;
    window.dispatchEvent(new Event("online"));
    await until(
      () =>
        b.state.days["2026-10-04"].priority === "Offline priority" &&
        a.status.pending === 0,
    );
    a.state.applications.push({
      id: "app-one",
      company: "Test Co",
      role: "ML Engineer",
      country: "India",
      stage: "Applied",
      date: "2026-10-04",
      notes: "",
    });
    a.cloud.localChanged();
    await until(() => b.state.applications.length === 1);
    b.state.applications[0].stage = "Interview";
    b.cloud.localChanged();
    await until(() => a.state.applications[0].stage === "Interview");
    delete a.state.days["2026-10-04"];
    a.cloud.localChanged();
    await until(() => !b.state.days["2026-10-04"] && a.status.pending === 0);
    await a.cloud.logout();
    await until(() => !a.status.user);
    assert.equal(a.state.days["2026-10-02"].achievement, "Original guest work");
    await a.cloud.login(`second-${Date.now()}@example.com`, password, true);
    await until(() => a.status.ready);
    assert.equal(a.state.applications.length, 0);
    assert.equal(Object.keys(a.state.days).length, 0);
  } finally {
    for (const c of [a, b])
      if (c.app) {
        await authSDK.signOut(authSDK.getAuth(c.app));
        await storeSDK.terminate(storeSDK.getFirestore(c.app));
        await appSDK.deleteApp(c.app);
      }
  }
});
