// Originally ported from French/repetez/repetez.html, since extended to support any
// native/target pairing across English, French and Spanish (not just "English is
// always the native language"). Adding a fourth language means: add a LangCode, a
// LANGS entry (voice/TTS/focuses), a STARTER_PHRASES column, and a UiStrings
// dictionary in i18n.ts.

export type Pair = [string, string];

export type LangCode = "en" | "fr" | "es";

/** Fixed canonical ordering used for "available targets" and UI seg controls. */
export const LANG_ORDER: LangCode[] = ["en", "fr", "es"];

export function availableTargets(native: LangCode): LangCode[] {
  return LANG_ORDER.filter((c) => c !== native);
}

export interface LangConfig {
  name: string;
  tts: string;
  short: string;
  title: string;
  voiceNames: string[];
  articles: string;
  styleNote: string;
  focuses: [string, string][];
}

export const LANGS: Record<LangCode, LangConfig> = {
  en: {
    name: "English",
    tts: "en-GB",
    short: "EN",
    title: "Repeat!",
    voiceNames: ["serena", "daniel", "kate", "google uk"],
    articles: "a, an, or the",
    styleNote: "Natural, clear, everyday spoken English.",
    focuses: [
      ["Present perfect vs past simple", "contrasting the present perfect and past simple in the same sentences (e.g. 'I have lived here for years' vs 'I lived there last year')"],
      ["Past continuous", "the past continuous for actions in progress, often interrupted (e.g. 'I was cooking when the phone rang')"],
      ["Going to vs will", "contrasting 'going to' (plans) and 'will' (spontaneous decisions, predictions)"],
      ["Third person -s", "the third person singular -s in the present simple, a common error source"],
      ["Irregular past tense verbs", "common irregular past tense verbs (went, saw, had, took, made...)"],
      ["Modal verbs", "modal verbs: can, could, should, must, might, for ability, advice, obligation, possibility"],
      ["Comparatives and superlatives", "comparatives and superlatives: bigger, the biggest, more expensive, the most expensive"],
      ["Prepositions of time and place", "prepositions of time and place: in, on, at, since, for"],
      ["Question formation", "question formation with auxiliary do/does/did and question words"],
      ["Conditionals", "first and second conditionals: if-clauses for real and hypothetical situations"],
      ["Phrasal verbs", "common everyday phrasal verbs (look for, get up, turn off, run out of...)"],
      ["Passive voice", "the passive voice in everyday contexts (e.g. 'the bill was paid', 'it was made in...')"],
      ["Countable and uncountable nouns", "countable vs uncountable nouns and the quantifiers that go with them (some, any, much, many, a few, a little)"],
    ],
  },
  fr: {
    name: "French",
    tts: "fr-FR",
    short: "FR",
    title: "Répétez",
    voiceNames: ["amélie", "amelie", "thomas", "audrey", "daniel"],
    articles: "le, la, l', les, un or une",
    styleNote: "Natural, useful, spoken French (vous form where a stranger is addressed).",
    focuses: [
      ["Passé composé", "the passé composé (perfect tense), mixing avoir and être auxiliaries"],
      ["Imparfait", "the imparfait (imperfect tense) for habits and descriptions"],
      ["Passé composé vs imparfait", "contrasting passé composé and imparfait in the same sentences (e.g. 'I was doing X when Y happened')"],
      ["Futur proche", "the futur proche (aller + infinitive)"],
      ["Futur simple", "the futur simple"],
      ["Conditionnel", "the conditionnel (je voudrais, j'aimerais, polite requests and hypotheticals)"],
      ["Subjonctif", "the subjonctif after il faut que, je veux que, bien que"],
      ["Reflexive verbs", "reflexive verbs (se lever, se souvenir, s'amuser...)"],
      ["Object pronouns", "object pronouns: le, la, les, lui, leur, y, en"],
      ["Negation", "negation: ne...pas, ne...jamais, ne...rien, ne...plus"],
      ["Asking questions", "asking questions: est-ce que, inversion, and question words"],
      ["Comparatives", "comparatives and superlatives: plus...que, moins...que, le plus..."],
      ["Avoir expressions", "avoir expressions: avoir envie de, avoir besoin de, avoir peur de, avoir l'intention de"],
    ],
  },
  es: {
    name: "Spanish",
    tts: "es-ES",
    short: "ES",
    title: "¡Repite!",
    voiceNames: ["mónica", "monica", "jorge", "paulina", "marisol"],
    articles: "el, la, los, las, un or una",
    styleNote: "Natural, useful, spoken European Spanish (usted where a stranger is addressed).",
    focuses: [
      ["Pretérito indefinido", "the pretérito indefinido (simple past): hablé, comí, fui"],
      ["Pretérito imperfecto", "the pretérito imperfecto for habits and descriptions: hablaba, comía, era"],
      ["Indefinido vs imperfecto", "contrasting pretérito indefinido and imperfecto in the same sentences (e.g. 'I was doing X when Y happened')"],
      ["Ir a + infinitive", "the near future with ir a + infinitive: voy a comer"],
      ["Futuro simple", "the futuro simple: hablaré, comerá"],
      ["Condicional", "the condicional: me gustaría, querría, polite requests and hypotheticals"],
      ["Subjuntivo", "the presente de subjuntivo after quiero que, es importante que, cuando referring to the future"],
      ["Ser vs estar", "choosing correctly between ser and estar"],
      ["Por vs para", "choosing correctly between por and para"],
      ["Reflexive verbs", "reflexive verbs (levantarse, acordarse, divertirse...)"],
      ["Object pronouns", "object pronouns: lo, la, los, las, le, les, se"],
      ["Gustar-type verbs", "gustar-type verbs: gustar, encantar, interesar, doler"],
      ["Asking questions", "asking questions with question words and natural word order"],
      ["Comparatives", "comparatives and superlatives: más...que, menos...que, el más..."],
    ],
  },
};

// One canonical set of 30 everyday concepts, translated into all three languages.
// Any native/target pairing is derived from this at runtime via getStarterDeck() —
// there's no separate "starter deck" per language anymore.
const STARTER_PHRASES: Record<LangCode, string[]> = {
  en: [
    "Good morning, how are you?",
    "I would like a coffee, please.",
    "Where is the train station?",
    "How much does it cost?",
    "I don't understand.",
    "Could you speak more slowly?",
    "What time is it?",
    "The bill, please.",
    "I'm learning a new language.",
    "It's a beautiful day.",
    "I live near the coast.",
    "Do you have a table for two?",
    "I'd like a glass of red wine.",
    "Where are the toilets?",
    "Can you help me?",
    "I'm going to the market tomorrow.",
    "This bread is delicious.",
    "We visited the cathedral yesterday.",
    "My dog is very lazy.",
    "I ride my bike every weekend.",
    "Could I have the menu?",
    "I'll take this one.",
    "What do you recommend?",
    "See you tomorrow.",
    "I need to buy some cheese.",
    "The weather is lovely today.",
    "We're going swimming this afternoon.",
    "Excuse me, I'm looking for the bakery.",
    "That was a wonderful meal.",
    "Thank you very much, goodbye.",
  ],
  fr: [
    "Bonjour, comment allez-vous ?",
    "Je voudrais un café, s'il vous plaît.",
    "Où est la gare ?",
    "Combien ça coûte ?",
    "Je ne comprends pas.",
    "Pourriez-vous parler plus lentement ?",
    "Quelle heure est-il ?",
    "L'addition, s'il vous plaît.",
    "J'apprends une nouvelle langue.",
    "C'est une belle journée.",
    "J'habite près de la côte.",
    "Avez-vous une table pour deux ?",
    "Je voudrais un verre de vin rouge.",
    "Où sont les toilettes ?",
    "Pouvez-vous m'aider ?",
    "Je vais au marché demain.",
    "Ce pain est délicieux.",
    "Nous avons visité la cathédrale hier.",
    "Mon chien est très paresseux.",
    "Je fais du vélo tous les week-ends.",
    "Puis-je avoir le menu ?",
    "Je prends celui-ci.",
    "Qu'est-ce que vous recommandez ?",
    "À demain.",
    "Je dois acheter du fromage.",
    "Il fait très beau aujourd'hui.",
    "Nous allons nager cet après-midi.",
    "Excusez-moi, je cherche la boulangerie.",
    "C'était un repas magnifique.",
    "Merci beaucoup, au revoir.",
  ],
  es: [
    "Buenos días, ¿cómo está usted?",
    "Quisiera un café, por favor.",
    "¿Dónde está la estación de tren?",
    "¿Cuánto cuesta?",
    "No entiendo.",
    "¿Puede hablar más despacio?",
    "¿Qué hora es?",
    "La cuenta, por favor.",
    "Estoy aprendiendo un idioma nuevo.",
    "Hace un día precioso.",
    "Vivo cerca de la costa.",
    "¿Tiene una mesa para dos?",
    "Quisiera una copa de vino tinto.",
    "¿Dónde están los servicios?",
    "¿Puede ayudarme?",
    "Voy al mercado mañana.",
    "Este pan está delicioso.",
    "Ayer visitamos la catedral.",
    "Mi perro es muy perezoso.",
    "Monto en bici todos los fines de semana.",
    "¿Me trae la carta, por favor?",
    "Me llevo este.",
    "¿Qué me recomienda?",
    "Hasta mañana.",
    "Tengo que comprar queso.",
    "Hoy hace muy buen tiempo.",
    "Vamos a nadar esta tarde.",
    "Perdone, busco la panadería.",
    "La comida estaba estupenda.",
    "Muchas gracias, adiós.",
  ],
};

export function getStarterDeck(native: LangCode, target: LangCode): Pair[] {
  const nativeCol = STARTER_PHRASES[native];
  const targetCol = STARTER_PHRASES[target];
  return nativeCol.map((text, i) => [text, targetCol[i]] as Pair);
}

export function starterDeckSize(): number {
  return STARTER_PHRASES.en.length;
}
