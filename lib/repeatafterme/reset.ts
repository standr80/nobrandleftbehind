import { DB_NAME, closeDb } from "./db";

// Wipes every trace of this device's state, so the app comes back up exactly as a
// first-time visitor sees it. Kept out of db.ts because it reaches past IndexedDB
// into localStorage, Cache Storage and the service worker registration — the four
// places the app persists anything.
//
// It deliberately does NOT touch the synced copy on Supabase: that blob is encrypted
// under the magic key and restoring it is the whole point of being able to reset.
// The UI warns that the key goes with everything else, so write it down first.

const LOCAL_STORAGE_KEYS = [
  "repeatafterme:aiSettings", // aiSettings.ts
  "repeatafterme:syncMagicKey", // syncSettings.ts
  "repeatafterme:introDismissed", // introSettings.ts
];

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      // Another tab still holds a connection despite the onversionchange handler in
      // db.ts. Nothing useful to wait for — the delete stays queued and completes
      // when that tab lets go, and the caller reloads regardless. A database that
      // gets recreated in the meantime comes back empty, which is the state we
      // were after anyway.
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function resetDevice(): Promise<void> {
  // Ours has to go first or the delete blocks on it.
  closeDb();
  await deleteDatabase(DB_NAME);

  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // best-effort
    }
  }

  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("repeatafterme-")).map((k) => caches.delete(k)));
  } catch {
    // Cache Storage unavailable (private browsing, older browsers)
  }

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.scope.includes("/repeatafterme")).map((r) => r.unregister()));
  } catch {
    // no service worker support
  }
}
