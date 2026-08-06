import { LANGS, type LangCode } from "./langs";

export interface EcoutezGenOptions {
  native: LangCode;
  target: LangCode;
  level: "beginner" | "intermediate" | "advanced";
  topic: string; // used when sourceText is empty
  sourceText: string; // pasted authentic text to simplify, if provided
}

// Same reasoning as genPrompt.ts: the instruction to the model stays in English
// regardless of UI language (never shown to the learner); only the generated
// content follows native/target. Design decisions baked in here are carried over
// from French/repetez/BRIEF.md's "Écoutez" section: comprehensibility comes from
// short clauses and clean sentence boundaries, not from slowing TTS down — the
// playback side (EcoutezPlayer.tsx) does a slow-then-natural two-pass instead.
export function buildEcoutezPrompt(opts: EcoutezGenOptions): string {
  const nativeL = LANGS[opts.native];
  const targetL = LANGS[opts.target];

  let brief: string;
  if (opts.sourceText.trim()) {
    brief =
      `Simplify this authentic ${targetL.name} text into a graded ${opts.level}-level listening passage, ` +
      "keeping the core content and meaning but rewriting the sentences to be shorter and clearer. " +
      `Source text: """${opts.sourceText.trim().slice(0, 4000)}"""`;
  } else {
    brief = `Write a graded ${opts.level}-level ${targetL.name} listening passage`;
    if (opts.topic.trim()) brief += ` about: ${opts.topic.trim()}`;
    brief += ".";
  }

  return (
    brief +
    ` Write it as natural ${targetL.name} for LISTENING, not reading: short clauses, clean sentence boundaries, ` +
    "no complex subordinate clauses, plain punctuation, no headings or bullet points — flowing prose only. " +
    `Aim for roughly 120-180 words. ${targetL.styleNote} ` +
    "Respond ONLY with a single compact JSON object, no markdown, no preamble, no other text, in exactly this shape " +
    `(every "native"/"target" pair has the ${nativeL.name} text first, ${targetL.name} text second — never the other way round):\n` +
    "{\n" +
    `  "title": "short title in ${targetL.name}",\n` +
    `  "article": "the graded passage, in ${targetL.name}",\n` +
    `  "vocab": [["${nativeL.name} translation","${targetL.name} term"], ...8 to 10 entries — the most useful words from the passage, single words or short set phrases],\n` +
    `  "summary": "a 1-2 sentence summary of the passage, written in ${nativeL.name}",\n` +
    `  "questions": ["a comprehension question in ${targetL.name}, answerable from the passage", ...2 to 3 entries, for the learner to answer aloud],\n` +
    `  "keyPhrases": [["${nativeL.name} translation","${targetL.name} phrase"], ...3 to 5 entries — useful phrases from the passage beyond the core vocab list]\n` +
    "}"
  );
}
