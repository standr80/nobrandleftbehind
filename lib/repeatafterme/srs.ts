import type { Pair } from "./langs";

export interface SrsState {
  ease: number;
  interval: number; // days
  reps: number;
  dueDate: string; // ISO date, YYYY-MM-DD
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_STATE: SrsState = { ease: 2.5, interval: 0, reps: 0, dueDate: todayIso() };

/**
 * SM-2-lite: the classic SM-2 spacing algorithm, simplified to binary
 * correct/incorrect grading (Test mode only has ✓/✗, not a 0–5 quality scale).
 * Correct: reps up, interval grows (1 → 6 → interval×ease), ease nudges up slightly.
 * Incorrect: reps reset, interval back to 1 day, ease nudges down (floor 1.3, SM-2's own floor).
 */
export function applyReview(existing: SrsState | undefined, correct: boolean): SrsState {
  const prev = existing ?? DEFAULT_STATE;
  if (correct) {
    const reps = prev.reps + 1;
    const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(prev.interval * prev.ease);
    const ease = Math.min(prev.ease + 0.1, 3.0);
    return { ease, interval, reps, dueDate: addDays(interval) };
  }
  return { ease: Math.max(prev.ease - 0.2, 1.3), interval: 1, reps: 0, dueDate: addDays(1) };
}

/**
 * Deterministic content hash (FNV-1a, 32-bit) — gives a deck a stable identity
 * derived purely from its content, so per-item SRS state survives reloads without
 * needing explicit IDs threaded through every deck (starter/saved/pasted/generated
 * decks all get one "for free"). Two decks with identical content intentionally
 * share history; if a deck's content changes, its items start fresh — both correct.
 */
export function hashContent(deck: Pair[]): string {
  const text = deck.map(([a, b]) => `${a}|${b}`).join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
