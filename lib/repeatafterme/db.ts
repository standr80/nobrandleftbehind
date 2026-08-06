import type { Pair } from "./langs";
import type { Settings } from "./engine";

// Thin native-IndexedDB wrapper — no dependency added for a personal side-app.
// Everything here is local-first: nothing in this file talks to the network.
// (Sprint 5's zero-knowledge sync layers on top of this, it doesn't replace it.)

const DB_NAME = "repeatafterme";
const DB_VERSION = 1;

const STORE_DECKS = "decks";
const STORE_KV = "kv";
const STORE_SCORES = "scores";

export interface SavedDeck {
  id: string;
  label: string;
  lang: Settings["lang"];
  pairs: Pair[];
  createdAt: number;
  updatedAt: number;
}

export interface ScoreRecord {
  id?: number;
  deckLabel: string;
  lang: Settings["lang"];
  date: string; // ISO
  correct: number;
  total: number;
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
    const all = await tx<SavedDeck[]>(db, STORE_DECKS, "readonly", (s) => s.getAll());
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
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
    lang: deck.lang,
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
