import type { LangCode, Pair } from "./langs";

// Pre-built decks bundled with the app (public/repeatafterme/library/*.json) that a
// learner can browse and add to their own deck library without creating or uploading
// anything themselves. Fetched on demand from the Library page — not bundled into the
// JS bundle itself, since most sessions never open it.

export interface LibraryDeckMeta {
  id: string;
  label: string; // hierarchical path, " > "-separated, e.g. "Theme 1: ... > Topic 1: ... > Foundation tier > Adjectives"
  nativeLang: LangCode;
  targetLang: LangCode;
  pairs: Pair[];
  /** Where this deck's content came from, if it has a home worth linking to — a
   *  podcast episode, for now. Carried into the learner's own deck record so the
   *  drill page can offer "listen again" next to the vocabulary. */
  sourceUrl?: string;
}

export interface LibraryManifest {
  id: string;
  title: string;
  nativeLang: LangCode;
  targetLang: LangCode;
  decks: LibraryDeckMeta[];
}

export interface LibraryMeta {
  id: string;
  title: string;
  description: string;
  nativeLang: LangCode;
  targetLang: LangCode;
  manifestUrl: string;
  deckCount: number;
  wordCount: number;
}

export const LIBRARIES: LibraryMeta[] = [
  {
    id: "fr-gcse-aqa",
    title: "GCSE French (AQA)",
    description:
      "The AQA GCSE French (8652) vocabulary list, organised by theme, topic, tier and part of speech — a close community mapping of the spec, re-chunked into decks of 20+ words.",
    nativeLang: "en",
    targetLang: "fr",
    manifestUrl: "/repeatafterme/library/fr-gcse-aqa.json",
    deckCount: 69,
    wordCount: 2822,
  },
  {
    id: "fr-alevel-aqa",
    title: "A-Level French (AQA)",
    description:
      "The AQA A-Level French vocabulary list for Year 12 and Year 13, organised by sub-theme (plus the No et Moi set-text vocabulary).",
    nativeLang: "en",
    targetLang: "fr",
    manifestUrl: "/repeatafterme/library/fr-alevel-aqa.json",
    deckCount: 14,
    wordCount: 4242,
  },
];

// ---------- podcasts ----------
// An episode is a deck with somewhere to listen. Kept separate from LibraryManifest
// rather than folded in as another taxonomy branch: browsing episodes is a flat list
// with a Listen link, not a tree of themes and tiers, and the point of the feature is
// the round trip — listen, drill the vocabulary, listen again.

export interface PodcastEpisodeMeta {
  id: string;
  title: string;
  show?: string;
  url: string;
  nativeLang: LangCode;
  targetLang: LangCode;
  pairs: Pair[];
}

export interface PodcastManifest {
  id: string;
  title: string;
  nativeLang: LangCode;
  targetLang: LangCode;
  episodes: PodcastEpisodeMeta[];
}

export interface PodcastLibraryMeta {
  id: string;
  title: string;
  targetLang: LangCode;
  manifestUrl: string;
}

export const PODCAST_LIBRARIES: PodcastLibraryMeta[] = [
  {
    id: "fr-podcasts",
    title: "French podcasts",
    targetLang: "fr",
    manifestUrl: "/repeatafterme/library/fr-podcasts.json",
  },
];

/** Stable id for a deck copied from a library into the user's own deck library — same
 *  library deck re-added always resolves to the same record (saveDeckToLibrary upserts
 *  on id) rather than piling up duplicates. */
export function libraryStableId(libraryId: string, deckId: string): string {
  return `library:${libraryId}:${deckId}`;
}
