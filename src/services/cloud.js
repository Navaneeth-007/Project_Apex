import { firebaseConfig, useEmulators } from "../config/firebase.js";
import { KEY, empty } from "../domain/core.js";
import {
  diffRecords,
  coalesce,
  applyOps,
  fromDocuments,
  migrationOps,
  acknowledge,
} from "./sync-core.js";
const copy = (v) => JSON.parse(JSON.stringify(v));
export const accountKey = (uid) => `${KEY}:account:${uid}`;
export function createCloud({
  getState,
  setState,
  status,
  notice,
  storage = localStorage,
  config = firebaseConfig,
  emulators = useEmulators,
  loadSDK = () => import("./firebase-sdk.js"),
}) {
  let sdk,
    auth,
    firestore,
    user = null,
    unsubscribe = null,
    baseline = empty(),
    queue = [],
    ready = false,
    busy = false,
    flushTimer,
    epoch = 0,
    lastGuest = getState(),
    isStarting = false;
  let current = {
    configured: !!config,
    user: null,
    state: config ? "loading" : "local",
    message: config ? "Connecting…" : "Saved on this device",
    ready: false,
    pending: 0,
  };
  function publish(state, message) {
    current = {
      configured: !!config,
      user: user ? { uid: user.uid, email: user.email } : null,
      state,
      message,
      ready,
      pending: queue.length,
    };
    status(current);
  }
  function persistQueue() {
    storage.setItem(accountKey(user.uid) + ":pending", JSON.stringify(queue));
  }
  function cache() {
    storage.setItem(
      user ? accountKey(user.uid) : KEY,
      JSON.stringify(getState()),
    );
  }
  function schedule() {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 700);
  }
  function localChanged() {
    if (!user) return;
    const next = getState(),
      ops = diffRecords(baseline, next);
    baseline = copy(next);
    if (!ops.length) return;
    try {
      queue = coalesce(queue, ops);
      persistQueue();
      cache();
      publish(
        "pending",
        navigator.onLine
          ? "Saving to cloud…"
          : "Offline · changes waiting to sync",
      );
      schedule();
    } catch (err) {
      publish("error", "Could not save changes locally");
      notice("Storage is full or unavailable. Export a backup before closing.");
    }
  }
  async function flush() {
    if (!user || !ready || busy || !queue.length || !navigator.onLine) return;
    busy = true;
    const myEpoch = epoch,
      myUser = user,
      sent = copy(queue.slice(0, 400));
    publish("pending", "Saving to cloud…");
    try {
      const batch = sdk.writeBatch(firestore);
      for (const op of sent) {
        const ref = sdk.doc(
            firestore,
            "users",
            myUser.uid,
            "records",
            encodeURIComponent(op.kind + ":" + op.key),
          ),
          value = {
            kind: op.kind,
            key: op.key,
            deleted: op.deleted,
            updatedAt: sdk.serverTimestamp(),
          };
        if (!op.deleted) value.data = op.data;
        batch.set(
          ref,
          value,
          op.kind === "day" && !op.deleted && !op.replace
            ? { merge: true }
            : {},
        );
      }
      await batch.commit();
      if (myEpoch !== epoch) return;
      queue = acknowledge(queue, sent);
      persistQueue();
      publish(
        queue.length ? "pending" : "synced",
        queue.length ? "Saving to cloud…" : "All changes synced",
      );
    } catch (err) {
      if (myEpoch === epoch) {
        publish("error", "Sync paused · changes saved on this device");
        notice(friendlyError(err));
      }
    } finally {
      if (myEpoch === epoch) {
        busy = false;
        if (queue.length && current.state !== "error") schedule();
      }
    }
  }
  async function changedUser(next) {
    const myEpoch = ++epoch;
    unsubscribe?.();
    unsubscribe = null;
    clearTimeout(flushTimer);
    busy = false;
    ready = false;
    queue = [];
    if (!user) lastGuest = copy(getState());
    user = next;
    try {
      const saved = storage.getItem(user ? accountKey(user.uid) : KEY);
      setState(saved ? JSON.parse(saved) : empty());
      baseline = copy(getState());
      if (!user) {
        publish("local", "Saved on this device");
        return;
      }
      queue = JSON.parse(
        storage.getItem(accountKey(user.uid) + ":pending") || "[]",
      );
      setState(applyOps(getState(), queue));
      baseline = copy(getState());
      publish(
        "loading",
        navigator.onLine
          ? "Loading your cloud data…"
          : "Offline · using saved account data",
      );
      unsubscribe = sdk.onSnapshot(
        sdk.collection(firestore, "users", user.uid, "records"),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (
            myEpoch !== epoch ||
            snapshot.metadata.fromCache ||
            snapshot.metadata.hasPendingWrites
          )
            return;
          ready = true;
          const remote = fromDocuments(snapshot.docs.map((d) => d.data())),
            merged = applyOps(remote, queue);
          setState(merged);
          baseline = copy(merged);
          cache();
          publish(
            queue.length ? "pending" : "synced",
            queue.length ? "Saving to cloud…" : "All changes synced",
          );
          schedule();
        },
        (err) => {
          if (myEpoch === epoch) {
            ready = false;
            publish("error", "Cloud unavailable · using saved data");
            notice(friendlyError(err));
          }
        },
      );
    } catch (err) {
      publish("error", "Account storage could not be loaded");
      notice(
        "Could not load account data. Export any current work before changing accounts.",
      );
    }
  }
  async function start() {
    if (!config) {
      publish("local", "Saved on this device");
      return;
    }
    if (isStarting) return;
    isStarting = true;
    try {
      sdk = await loadSDK();
      const app = sdk.initializeApp(config);
      auth = sdk.getAuth(app);
      firestore = sdk.initializeFirestore(app, {
        localCache: sdk.memoryLocalCache(),
      });
      if (emulators) {
        if (!["localhost", "127.0.0.1"].includes(location.hostname))
          throw Error("Emulators may only run on localhost.");
        sdk.connectAuthEmulator(auth, "http://127.0.0.1:9099", {
          disableWarnings: true,
        });
        sdk.connectFirestoreEmulator(firestore, "127.0.0.1", 8081);
      }
      sdk.onAuthStateChanged(auth, changedUser);
      window.addEventListener("online", () => {
        if (user) {
          publish("pending", "Reconnecting…");
          if (!ready) changedUser(user);
          else schedule();
        }
      });
      window.addEventListener("offline", () => {
        if (user) publish("offline", "Offline · changes saved on this device");
      });
    } catch (err) {
      publish("error", "Cloud connection failed · local mode available");
      notice(friendlyError(err));
    } finally {
      isStarting = false;
    }
  }
  async function login(email, password, create = false) {
    if (!auth) throw Error("Set up Firebase before signing in.");
    await (
      create
        ? sdk.createUserWithEmailAndPassword
        : sdk.signInWithEmailAndPassword
    )(auth, email, password);
  }
  async function logout() {
    if (queue.length)
      throw Error(
        "Wait for pending changes to sync before signing out. You can export a backup while offline.",
      );
    await sdk.signOut(auth);
  }
  async function resetPassword(email) {
    if (!auth) throw Error("Set up Firebase first.");
    await sdk.sendPasswordResetEmail(auth, email);
  }
  function uploadGuest() {
    if (!user || !ready)
      throw Error(
        "Wait until cloud data has loaded before transferring local records.",
      );
    const ops = migrationOps(lastGuest, getState());
    if (!ops.length) return 0;
    queue = coalesce(queue, ops);
    persistQueue();
    const merged = applyOps(getState(), ops);
    setState(merged);
    baseline = copy(merged);
    cache();
    publish("pending", "Transferring local records…");
    schedule();
    return ops.length;
  }
  return {
    start,
    login,
    logout,
    resetPassword,
    uploadGuest,
    localChanged,
    retry: () => (user && !ready ? changedUser(user) : flush()),
    get status() {
      return current;
    },
    get localKey() {
      return user ? accountKey(user.uid) : KEY;
    },
    get guestRecords() {
      return (
        Object.keys(lastGuest.days).length +
        lastGuest.applications.length +
        lastGuest.contacts.length
      );
    },
  };
}
export function friendlyError(err) {
  const code = err?.code || "";
  if (
    code.includes("invalid-credential") ||
    code.includes("wrong-password") ||
    code.includes("user-not-found")
  )
    return "Email or password is incorrect.";
  if (code.includes("email-already-in-use"))
    return "That email already has an account. Choose Sign in.";
  if (code.includes("weak-password"))
    return "Use a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("network-request-failed") || code === "unavailable")
    return "Network unavailable. Local changes will sync when the connection returns.";
  if (code === "permission-denied")
    return "Cloud access was denied. Check the Firestore rules and sign-in configuration.";
  if (code.includes("operation-not-allowed"))
    return "Enable Email/Password sign-in in Firebase Authentication.";
  if (code.includes("too-many-requests"))
    return "Too many attempts. Try again later.";
  return err?.message || "Cloud request failed. Try again.";
}
