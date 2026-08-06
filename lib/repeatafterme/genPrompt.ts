import { LANGS, type LangCode } from "./langs";

export interface DeckGenOptions {
  native: LangCode;
  target: LangCode;
  genType: "phrases" | "words";
  level: "beginner" | "intermediate" | "advanced";
  count: string;
  topic: string;
  focus: string; // value from LangConfig.focuses, "" for none
  focusLabel: string; // matching label, for the deck name
}

// Ported from repetez.html's btnGenGo handler — the prompt-building logic that
// decides what to ask the model for. Server-side just forwards the finished prompt
// string (see lib/repeatafterme/providers.ts); building it client-side keeps the API
// route generic across generation tasks (this, and later Écoutez articles).
//
// The instruction sent to the model stays in English regardless of the UI language —
// it's an implementation detail the learner never sees, and keeping prompt-engineering
// in one language keeps quality consistent. Only the *generated content* (and its
// column order) follows native/target.
export function buildDeckGenPrompt(opts: DeckGenOptions): { prompt: string; deckName: string } {
  const nativeL = LANGS[opts.native];
  const targetL = LANGS[opts.target];
  const deckName = [opts.genType === "words" ? "Vocab" : "", opts.focusLabel, opts.topic].filter(Boolean).join(" · ") || "everyday conversation";

  let brief: string;
  if (opts.genType === "words") {
    brief = `Generate ${opts.count} ${opts.level}-level ${nativeL.name}-to-${targetL.name} single-word vocabulary pairs`;
    if (opts.topic) brief += ` about: ${opts.topic}`;
    brief += ". Each item must be ONE word or minimal lexical item — no full sentences. ";
    if (opts.target !== "en") {
      brief += `${targetL.name} nouns MUST include their article (${targetL.articles}) so the learner absorbs the gender. `;
    }
    brief += "Mix word classes where sensible: nouns, verbs (infinitive), adjectives, useful adverbs. ";
  } else {
    brief = `Generate ${opts.count} ${opts.level}-level ${nativeL.name}-to-${targetL.name} practice phrase pairs`;
    if (opts.topic) brief += ` about: ${opts.topic}`;
    brief += ". ";
  }
  if (opts.focus) {
    brief +=
      `GRAMMAR FOCUS: every single phrase must actively practise ${opts.focus}. ` +
      "Vary the subject and the verbs across the deck so the pattern is drilled from many angles, progressing from simpler to more complex sentences. ";
  }

  const prompt =
    brief +
    targetL.styleNote +
    " Keep each sentence short enough to say in one breath. " +
    `Each pair's first item must be in ${nativeL.name}, the second in ${targetL.name} — never the other way round. ` +
    "Respond ONLY with a compact JSON array of arrays, no markdown, no preamble, no other text: " +
    `[["${nativeL.name} text","${targetL.name} text"],["${nativeL.name} text","${targetL.name} text"]]`;

  return { prompt, deckName };
}
