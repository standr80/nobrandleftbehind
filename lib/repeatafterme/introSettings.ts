// Whether each page's intro note has been dismissed. localStorage rather than the
// IndexedDB layer in db.ts for two reasons: it's a per-device UI preference with no
// business being in the synced blob, and it reads synchronously — an async read would
// let a dismissed note flash in on every page load, which defeats dismissing it.
const STORAGE_KEY = "repeatafterme:introDismissed";

export type IntroId = "repetez" | "ecoutez" | "library";

function loadAll(): Partial<Record<IntroId, boolean>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadIntroDismissed(id: IntroId): boolean {
  return loadAll()[id] === true;
}

export function saveIntroDismissed(id: IntroId, dismissed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadAll(), [id]: dismissed }));
  } catch {
    // best-effort
  }
}
