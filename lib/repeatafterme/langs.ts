// Ported verbatim from French/repetez/repetez.html — do not restructure without
// checking the original; adding a language is meant to stay a ~30 minute job
// (see French/repetez/BRIEF.md, "Nice-to-haves").

export type Pair = [string, string];

export type LangCode = "fr" | "es";

export interface LangConfig {
  name: string;
  tts: string;
  short: string;
  title: string;
  voiceNames: string[];
  articles: string;
  styleNote: string;
  focuses: [string, string][];
  starter: Pair[];
}

export const LANGS: Record<LangCode, LangConfig> = {
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
    starter: [
      ["Good morning, how are you?", "Bonjour, comment allez-vous ?"],
      ["I would like a coffee, please.", "Je voudrais un café, s'il vous plaît."],
      ["Where is the train station?", "Où est la gare ?"],
      ["How much does it cost?", "Combien ça coûte ?"],
      ["I don't understand.", "Je ne comprends pas."],
      ["Could you speak more slowly?", "Pourriez-vous parler plus lentement ?"],
      ["What time is it?", "Quelle heure est-il ?"],
      ["The bill, please.", "L'addition, s'il vous plaît."],
      ["I'm learning French.", "J'apprends le français."],
      ["It's a beautiful day.", "C'est une belle journée."],
      ["I live near the coast.", "J'habite près de la côte."],
      ["Do you have a table for two?", "Avez-vous une table pour deux ?"],
      ["I'd like a glass of red wine.", "Je voudrais un verre de vin rouge."],
      ["Where are the toilets?", "Où sont les toilettes ?"],
      ["Can you help me?", "Pouvez-vous m'aider ?"],
      ["I'm going to the market tomorrow.", "Je vais au marché demain."],
      ["This bread is delicious.", "Ce pain est délicieux."],
      ["We visited the cathedral yesterday.", "Nous avons visité la cathédrale hier."],
      ["My dog is very lazy.", "Mon chien est très paresseux."],
      ["I ride my bike every weekend.", "Je fais du vélo tous les week-ends."],
      ["Could I have the menu?", "Puis-je avoir le menu ?"],
      ["I'll take this one.", "Je prends celui-ci."],
      ["What do you recommend?", "Qu'est-ce que vous recommandez ?"],
      ["See you tomorrow.", "À demain."],
      ["I need to buy some cheese.", "Je dois acheter du fromage."],
      ["The weather is lovely today.", "Il fait très beau aujourd'hui."],
      ["We're going swimming this afternoon.", "Nous allons nager cet après-midi."],
      ["Excuse me, I'm looking for the bakery.", "Excusez-moi, je cherche la boulangerie."],
      ["That was a wonderful meal.", "C'était un repas magnifique."],
      ["Thank you very much, goodbye.", "Merci beaucoup, au revoir."],
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
    starter: [
      ["Good morning, how are you?", "Buenos días, ¿cómo está usted?"],
      ["I would like a coffee, please.", "Quisiera un café, por favor."],
      ["Where is the train station?", "¿Dónde está la estación de tren?"],
      ["How much does it cost?", "¿Cuánto cuesta?"],
      ["I don't understand.", "No entiendo."],
      ["Could you speak more slowly?", "¿Puede hablar más despacio?"],
      ["What time is it?", "¿Qué hora es?"],
      ["The bill, please.", "La cuenta, por favor."],
      ["I'm learning Spanish.", "Estoy aprendiendo español."],
      ["It's a beautiful day.", "Hace un día precioso."],
      ["I live near the coast.", "Vivo cerca de la costa."],
      ["Do you have a table for two?", "¿Tiene una mesa para dos?"],
      ["I'd like a glass of red wine.", "Quisiera una copa de vino tinto."],
      ["Where are the toilets?", "¿Dónde están los servicios?"],
      ["Can you help me?", "¿Puede ayudarme?"],
      ["I'm going to the market tomorrow.", "Voy al mercado mañana."],
      ["This bread is delicious.", "Este pan está delicioso."],
      ["We visited the cathedral yesterday.", "Ayer visitamos la catedral."],
      ["My dog is very lazy.", "Mi perro es muy perezoso."],
      ["I ride my bike every weekend.", "Monto en bici todos los fines de semana."],
      ["Could I have the menu?", "¿Me trae la carta, por favor?"],
      ["I'll take this one.", "Me llevo este."],
      ["What do you recommend?", "¿Qué me recomienda?"],
      ["See you tomorrow.", "Hasta mañana."],
      ["I need to buy some cheese.", "Tengo que comprar queso."],
      ["The weather is lovely today.", "Hoy hace muy buen tiempo."],
      ["We're going swimming this afternoon.", "Vamos a nadar esta tarde."],
      ["Excuse me, I'm looking for the bakery.", "Perdone, busco la panadería."],
      ["That was a wonderful meal.", "La comida estaba estupenda."],
      ["Thank you very much, goodbye.", "Muchas gracias, adiós."],
    ],
  },
};
