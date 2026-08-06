import { LANGS, type LangCode } from "./langs";

export interface DeckGenOptions {
  lang: LangCode;
  genType: "phrases" | "words";
  level: "beginner" | "intermediate" | "advanced";
  count: string;
  topic: string;
  focus: string; // value from LangConfig.focuses, "" for none
  focusLabel: string; // matching label, for the deck name
}

// Ported verbatim from repetez.html's btnGenGo handler — the prompt-building logic
// that decides what to ask the model for. Server-side just forwards the finished
// prompt string (see lib/repeatafterme/providers.ts); building it client-side keeps
// the API route generic across generation tasks (this, and later Écoutez articles).
export function buildDeckGenPrompt(opts: DeckGenOptions): { prompt: string; deckName: string } {
  const L = LANGS[opts.lang];
  const deckName = [opts.genType === "words" ? "Vocab" : "", opts.focusLabel, opts.topic].filter(Boolean).join(" · ") || "everyday conversation";

  let brief: string;
  if (opts.genType === "words") {
    brief = `Generate ${opts.count} ${opts.level}-level English-to-${L.name} single-word vocabulary pairs`;
    if (opts.topic) brief += ` about: ${opts.topic}`;
    brief +=
      ". Each item must be ONE word or minimal lexical item — no full sentences. " +
      `${L.name} nouns MUST include their article (${L.articles}) so the learner absorbs the gender. ` +
      "Mix word classes where sensible: nouns, verbs (infinitive), adjectives, useful adverbs. ";
  } else {
    brief = `Generate ${opts.count} ${opts.level}-level English-to-${L.name} practice phrase pairs`;
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
    L.styleNote +
    " Keep each sentence short enough to say in one breath. " +
    "Respond ONLY with a compact JSON array of arrays, no markdown, no preamble, no other text: " +
    `[["English","${L.name}"],["English","${L.name}"]]`;

  return { prompt, deckName };
}
