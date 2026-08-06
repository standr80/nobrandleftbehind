import type { AiProvider } from "./providers";

// Deliberately localStorage, not the IndexedDB layer in db.ts: the API key must never
// be written to the zero-knowledge sync blob (Sprint 5) or leave this browser at all,
// so it's kept in its own, clearly-separate store.
const STORAGE_KEY = "repeatafterme:aiSettings";

export interface AiSettings {
  provider: AiProvider;
  apiKey: string;
}

const DEFAULT: AiSettings = { provider: "anthropic", apiKey: "" };

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return { provider: parsed.provider ?? DEFAULT.provider, apiKey: parsed.apiKey ?? DEFAULT.apiKey };
  } catch {
    return DEFAULT;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}
