import type { Pair } from "./langs";

export interface EcoutezPayload {
  title: string;
  article: string;
  vocab: Pair[];
  summary: string;
  questions: string[];
  keyPhrases: Pair[];
}

function isPair(v: unknown): v is Pair {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string";
}

/** AI responses occasionally wrap JSON in a markdown fence or add stray text around
 *  it despite instructions not to — extract the first {...} block before parsing,
 *  same defensive posture as deckParsing.ts's extractPairs for the plain deck case. */
export function extractEcoutezPayload(text: string): EcoutezPayload | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;

  if (typeof p.title !== "string" || typeof p.article !== "string" || typeof p.summary !== "string") return null;
  const vocab = Array.isArray(p.vocab) ? p.vocab.filter(isPair) : [];
  const keyPhrases = Array.isArray(p.keyPhrases) ? p.keyPhrases.filter(isPair) : [];
  const questions = Array.isArray(p.questions) ? p.questions.filter((q): q is string => typeof q === "string") : [];
  if (!vocab.length && !p.article) return null;

  return { title: p.title, article: p.article, vocab, summary: p.summary, questions, keyPhrases };
}
