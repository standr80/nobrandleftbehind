import type { Pair } from "./langs";
import type { Settings } from "./engine";
import type { SrsState } from "./srs";

// Thin native-IndexedDB wrapper — no dependency added for a personal side-app.
// Everything here is local-first: nothing in this file talks to the network.
// (Sprint 5's zero-knowledge sync layers on top of this, it doesn't replace it.)

const DB_NAME = "repeatafterme";
const DB_VERSION = 2;

const STORE_DECKS = "decks";
const STORE_KV = "kv";
const STORE_SCORES = "scores";
const STORE_SRS = "srs";

export interface SavedDeck {
  id: string;
  label: string;
  nativeLang: Settings["nativeLang"];
  targetLang: Settings["targetLang"];
  pairs: Pair[];
  createdAt: number;
  updatedAt: number;
}

export interface ScoreRecord {
  id?: number;
  deckLabel: string;
  targetLang: Settings["targetLang"];
  date: string; // ISO
  correct: number;
  total: number;
}

/** One item's spaced-repetition state. `pair`/`deckLabel` are denormalised (duplicated
 *  from whichever deck the item came from) so the due-today queue can be built and
 *  played without re-resolving back through possibly-deleted or ad-hoc decks. */
export interface SrsRecord extends SrsState {
  itemKey: string; // `${contentHashOfDeck}:${indexInDeck}` — see srs.ts hashContent()
  deckLabel: string;
  nativeLang: Settings["nativeLang"];
  targetLang: Settings["targetLang"];
  pair: Pair;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DECKS)) {
        db.createObjectStore(STORE_DECKS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_SCORES)) {
        db.createObjectStore(STORE_SCORES, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_SRS)) {
        db.createObjectStore(STORE_SRS, { keyPath: "itemKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- settings + "resume where I left off" ----------
export async function loadKv<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    const row = await tx<{ key: string; value: T } | undefined>(db, STORE_KV, "readonly", (s) => s.get(key));
    return row?.value;
  } catch {
    return undefined;
  }
}

export async function saveKv<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await tx(db, STORE_KV, "readwrite", (s) => s.put({ key, value }));
  } catch {
    // best-effort — persistence failing shouldn't break the app
  }
}

export const getSettings = () => loadKv<Settings>("settings");
export const saveSettings = (settings: Settings) => saveKv("settings", settings);

export const getLastDeck = () => loadKv<{ label: string; pairs: Pair[] }>("lastDeck");
export const saveLastDeck = (label: string, pairs: Pair[]) => saveKv("lastDeck", { label, pairs });

// ---------- named deck library ----------
export async function listDecks(): Promise<SavedDeck[]> {
  try {
    const db = await openDb();
    const all = await tx<(SavedDeck & { lang?: string })[]>(db, STORE_DECKS, "readonly", (s) => s.getAll());
    // Backfill for decks saved before native/target split existed — they were all
    // native=English at the time (it's all the app supported), and what's now
    // `targetLang` used to be stored under the field name `lang`.
    const withDefaults = all.map((d) => ({
      ...d,
      nativeLang: d.nativeLang ?? "en",
      targetLang: d.targetLang ?? (d.lang as SavedDeck["targetLang"] | undefined) ?? "fr",
    }));
    return withDefaults.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveDeckToLibrary(deck: Omit<SavedDeck, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<SavedDeck> {
  const db = await openDb();
  const id = deck.id ?? `deck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const existing = deck.id ? await tx<SavedDeck | undefined>(db, STORE_DECKS, "readonly", (s) => s.get(deck.id!)) : undefined;
  const record: SavedDeck = {
    id,
    label: deck.label,
    nativeLang: deck.nativeLang,
    targetLang: deck.targetLang,
    pairs: deck.pairs,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await tx(db, STORE_DECKS, "readwrite", (s) => s.put(record));
  return record;
}

export async function renameDeckInLibrary(id: string, label: string): Promise<void> {
  const db = await openDb();
  const existing = await tx<SavedDeck | undefined>(db, STORE_DECKS, "readonly", (s) => s.get(id));
  if (!existing) return;
  await tx(db, STORE_DECKS, "readwrite", (s) => s.put({ ...existing, label, updatedAt: Date.now() }));
}

export async function deleteDeckFromLibrary(id: string): Promise<void> {
  const db = await openDb();
  await tx(db, STORE_DECKS, "readwrite", (s) => s.delete(id));
}

// ---------- score history ----------
export async function addScore(record: ScoreRecord): Promise<void> {
  try {
    const db = await openDb();
    await tx(db, STORE_SCORES, "readwrite", (s) => s.add(record));
  } catch {
    // best-effort
  }
}

export async function listScores(): Promise<ScoreRecord[]> {
  try {
    const db = await openDb();
    const all = await tx<ScoreRecord[]>(db, STORE_SCORES, "readonly", (s) => s.getAll());
    return all.sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

// ---------- spaced repetition ----------
export async function getSrsRecord(itemKey: string): Promise<SrsRecord | undefined> {
  try {
    const db = await openDb();
    return await tx<SrsRecord | undefined>(db, STORE_SRS, "readonly", (s) => s.get(itemKey));
  } catch {
    return undefined;
  }
}

export async function saveSrsRecord(record: SrsRecord): Promise<void> {
  try {
    const db = await openDb();
    await tx(db, STORE_SRS, "readwrite", (s) => s.put(record));
  } catch {
    // best-effort
  }
}

/** Due items for the current native/target pairing — the due-today queue is scoped
 *  to one language pairing at a time (mixing pairings would need per-item TTS
 *  language switching mid-session, which the engine doesn't support — see engine.ts). */
export async function listDueSrsRecords(nativeLang: Settings["nativeLang"], targetLang: Settings["targetLang"], todayIso: string): Promise<SrsRecord[]> {
  try {
    const db = await openDb();
    const all = await tx<SrsRecord[]>(db, STORE_SRS, "readonly", (s) => s.getAll());
    return all.filter((r) => r.nativeLang === nativeLang && r.targetLang === targetLang && r.dueDate <= todayIso);
  } catch {
    return [];
  }
}

export async function listAllSrsRecords(): Promise<SrsRecord[]> {
  try {
    const db = await openDb();
    return await tx<SrsRecord[]>(db, STORE_SRS, "readonly", (s) => s.getAll());
  } catch {
    return [];
  }
}

// ---------- zero-knowledge sync: export / restore everything ----------
// This is the payload lib/repeatafterme/vault.ts encrypts before it ever leaves the
// browser (see the Sync panel in components/repeatafterme/Player.tsx). Deliberately
// excludes the AI key (lib/repeatafterme/aiSettings.ts) — that must never leave this
// browser at all, synced or not.
export interface SyncPayload {
  settings: Settings | undefined;
  decks: SavedDeck[];
  srs: SrsRecord[];
  scores: ScoreRecord[];
  exportedAt: string;
}

export async function exportSyncPayload(): Promise<SyncPayload> {
  const [settings, decks, srs, scores] = await Promise.all([getSettings(), listDecks(), listAllSrsRecords(), listScores()]);
  return { settings, decks, srs, scores, exportedAt: new Date().toISOString() };
}

/** Overwrites local decks/srs/scores/settings with the synced payload — this is a
 *  restore, not a merge. Each store is cleared and repopulated in its own
 *  transaction; a failure partway through leaves earlier stores already restored
 *  (acceptable for a personal app — re-running restore is idempotent). */
export async function restoreSyncPayload(payload: SyncPayload): Promise<void> {
  const db = await openDb();
  if (payload.settings) await saveSettings(payload.settings);

  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_DECKS, "readwrite");
    const store = t.objectStore(STORE_DECKS);
    store.clear();
    for (const deck of payload.decks) store.put(deck);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });

  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_SRS, "readwrite");
    const store = t.objectStore(STORE_SRS);
    store.clear();
    for (const rec of payload.srs) store.put(rec);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });

  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_SCORES, "readwrite");
    const store = t.objectStore(STORE_SCORES);
    store.clear();
    // Drop the old auto-incremented `id` explicitly rather than setting it to
    // undefined — IndexedDB's handling of an undefined keyPath property varies less
    // predictably across browsers than the property simply being absent.
    for (const rec of payload.scores) {
      const rest: Partial<ScoreRecord> = { ...rec };
      delete rest.id;
      store.put(rest);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ---------- session stats (streak, minutes practised) ----------
// Kept deliberately simple: one entry per calendar day (device-local date) with
// accumulated seconds of active playback, fed by engine.ts's onSessionTime hook.
// Not part of SyncPayload — this is "how much have I used the app" telemetry for the
// learner's own eyes, not learning content worth carrying across devices.
export interface ActivityEntry {
  date: string; // YYYY-MM-DD, device-local
  seconds: number;
}

const MAX_ACTIVITY_DAYS = 120;
const ACTIVITY_KEY = "activityLog";

function localDateStr(d: Date): string {
  // Local calendar date, not UTC — a streak shouldn't break at midnight UTC for
  // someone practising in the evening in a UTC+ timezone.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function recordActivity(seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const log = (await loadKv<ActivityEntry[]>(ACTIVITY_KEY)) || [];
  const today = localDateStr(new Date());
  const idx = log.findIndex((e) => e.date === today);
  if (idx >= 0) log[idx] = { date: today, seconds: log[idx].seconds + seconds };
  else log.push({ date: today, seconds });
  await saveKv(ACTIVITY_KEY, log.slice(-MAX_ACTIVITY_DAYS));
}

export const getActivityLog = () => loadKv<ActivityEntry[]>(ACTIVITY_KEY).then((log) => log || []);

/** Consecutive days with any activity, counting back from today. Today not having
 *  activity yet doesn't break an existing streak — it just hasn't extended it yet. */
export function computeStreak(log: ActivityEntry[]): number {
  const dates = new Set(log.map((e) => e.date));
  const d = new Date();
  if (!dates.has(localDateStr(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (dates.has(localDateStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getTodayMinutes(log: ActivityEntry[]): number {
  const entry = log.find((e) => e.date === localDateStr(new Date()));
  return entry ? Math.round(entry.seconds / 60) : 0;
}
