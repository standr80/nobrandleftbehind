// The magic key lives in localStorage only, same rationale as aiSettings.ts's API
// key: whoever holds it can read and overwrite your synced data, so it stays put on
// this device rather than living in the IndexedDB store that itself gets synced.
const STORAGE_KEY = "repeatafterme:syncMagicKey";

export function loadMagicKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveMagicKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // best-effort
  }
}

export function clearMagicKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}
