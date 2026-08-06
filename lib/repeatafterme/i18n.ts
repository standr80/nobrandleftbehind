import type { LangCode } from "./langs";

// Localised name of each LangCode, as it should read in each UI language — used to
// interpolate into phrases like "Your turn — say it in {language}".
export const LANG_NAMES: Record<LangCode, Record<LangCode, string>> = {
  en: { en: "English", fr: "French", es: "Spanish" },
  fr: { en: "anglais", fr: "français", es: "espagnol" },
  es: { en: "inglés", fr: "francés", es: "español" },
};

export interface UiStrings {
  // phase / transport state (engine-generated)
  phaseReady: string;
  promptPressPlay: string;
  phaseListen: string;
  phaseYourTurn: (langName: string) => string;
  phaseAnswer: string;
  phaseDidYouGetIt: string;
  phasePaused: string;
  phaseTestComplete: string;
  phaseDeckComplete: string;
  phaseTestReady: string;
  phaseReadyNextCard: string;
  correctOutOf: (correct: number, total: number) => string;

  // header / deck label
  starterDeck: (n: number) => string;
  deckPhrases: (label: string, n: number) => string;

  // settings panel
  nativeLanguage: string;
  language: string;
  mode: string;
  modeHint: string;
  drill: string;
  test: string;
  autoplay: string;
  autoplayHint: string;
  thinkingTime: string;
  thinkingTimeHint: string;
  speechSpeed: string;
  direction: string;
  dirTo: (short: string) => string;
  shuffle: string;
  loopDeck: string;
  showText: string;
  showTextHint: string;

  // deck section
  deckHeading: string;
  uploadCsv: string;
  pastePhrases: string;
  aiSettingsBtn: string;
  generateWithAi: string;
  generateDisabledTitle: string;
  downloadDeck: string;
  saveCurrentDeck: string;
  pasteBoxPlaceholder: string;
  loadPhrases: string;
  cancel: string;
  saveDeckNamePlaceholder: string;
  save: string;
  forgetKey: string;
  aiKeyPlaceholder: string;
  noGrammarFocus: string;
  topicPlaceholder: string;
  phrasesOption: string;
  singleWordsOption: string;
  beginner: string;
  intermediate: string;
  advanced: string;
  countOption: (n: number) => string;
  generate: string;
  generating: string;
  yourDecks: string;
  load: string;
  delete: string;

  // test mode
  knewIt: string;
  missedIt: string;
  newTest: string;
  practiseMisses: (n: number) => string;

  footer: string;

  // status messages
  statusLoadedPhrases: (n: number) => string;
  statusNoPhrasesFound: string;
  statusSwitchedTarget: (targetName: string) => string;
  statusSavedDeck: (name: string) => string;
  statusGenerating: (deckName: string) => string;
  statusGenerationFailed: (msg: string) => string;
  statusAiSettingsSaved: string;
  statusAiSettingsSavedNoKey: string;
  statusKeyForgotten: string;
  statusGenerationEmptyResponse: string;
}

const en: UiStrings = {
  phaseReady: "Ready",
  promptPressPlay: "Press play to begin",
  phaseListen: "Listen",
  phaseYourTurn: (lang) => `Your turn — say it in ${lang}`,
  phaseAnswer: "Answer",
  phaseDidYouGetIt: "Did you get it?",
  phasePaused: "Paused",
  phaseTestComplete: "Test complete",
  phaseDeckComplete: "Deck complete",
  phaseTestReady: "Test ready — press play",
  phaseReadyNextCard: "Ready for next card — press play",
  correctOutOf: (c, t) => `${c} / ${t} correct`,

  starterDeck: (n) => `Starter deck · ${n} phrases`,
  deckPhrases: (label, n) => `${label} · ${n} phrases`,

  nativeLanguage: "Native language",
  language: "Language",
  mode: "Mode",
  modeHint: "Test = mark yourself, get a score",
  drill: "Drill",
  test: "Test",
  autoplay: "Autoplay",
  autoplayHint: "Off = pause after each card, press play for the next",
  thinkingTime: "Thinking time",
  thinkingTimeHint: "Pause before the answer",
  speechSpeed: "Speech speed",
  direction: "Direction",
  dirTo: (short) => `→ ${short}`,
  shuffle: "Shuffle",
  loopDeck: "Loop deck",
  showText: "Show text",
  showTextHint: "Off = audio only",

  deckHeading: "Deck",
  uploadCsv: "Upload CSV",
  pastePhrases: "Paste phrases",
  aiSettingsBtn: "AI Settings",
  generateWithAi: "✦ Generate with AI",
  generateDisabledTitle: "Add an API key in AI Settings first",
  downloadDeck: "Download deck",
  saveCurrentDeck: "Save current deck",
  pasteBoxPlaceholder: "One phrase per line:\nWhere is the station?, Où est la gare ?\nI would like a coffee, Je voudrais un café",
  loadPhrases: "Load phrases",
  cancel: "Cancel",
  saveDeckNamePlaceholder: "Deck name",
  save: "Save",
  forgetKey: "Forget key",
  aiKeyPlaceholder: "Your API key — stored only in this browser",
  noGrammarFocus: "No grammar focus — topic only",
  topicPlaceholder: "Topic (optional), e.g. ordering wine, cycling, at the pottery studio",
  phrasesOption: "Phrases",
  singleWordsOption: "Single words",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  countOption: (n) => `${n} phrases`,
  generate: "Generate",
  generating: "Generating…",
  yourDecks: "Your decks",
  load: "Load",
  delete: "Delete",

  knewIt: "✓ Knew it",
  missedIt: "✗ Missed it",
  newTest: "New test",
  practiseMisses: (n) => `Practise ${n} ${n === 1 ? "miss" : "misses"}`,

  footer: "Connect a Bluetooth speaker and press play. Keep the screen awake while practising.",

  statusLoadedPhrases: (n) => `Loaded ${n} phrases.`,
  statusNoPhrasesFound: "No phrases found — expected two columns, one pair per line.",
  statusSwitchedTarget: (name) => `Switched to ${name} — starter deck loaded. Upload or generate a deck to replace it.`,
  statusSavedDeck: (name) => `Saved "${name}" to your decks.`,
  statusGenerating: (deckName) => `Generating: ${deckName}…`,
  statusGenerationFailed: (msg) => `Generation failed: ${msg}`,
  statusAiSettingsSaved: "AI settings saved.",
  statusAiSettingsSavedNoKey: "AI settings saved — no key set, Generate stays off until you add one.",
  statusKeyForgotten: "API key forgotten.",
  statusGenerationEmptyResponse: "couldn't read the response format",
};

const fr: UiStrings = {
  phaseReady: "Prêt",
  promptPressPlay: "Appuyez sur lecture pour commencer",
  phaseListen: "Écoutez",
  phaseYourTurn: (lang) => `À vous — dites-le en ${lang}`,
  phaseAnswer: "Réponse",
  phaseDidYouGetIt: "Vous l'aviez ?",
  phasePaused: "En pause",
  phaseTestComplete: "Test terminé",
  phaseDeckComplete: "Paquet terminé",
  phaseTestReady: "Test prêt — appuyez sur lecture",
  phaseReadyNextCard: "Prêt pour la carte suivante — appuyez sur lecture",
  correctOutOf: (c, t) => `${c} / ${t} correctes`,

  starterDeck: (n) => `Paquet de départ · ${n} phrases`,
  deckPhrases: (label, n) => `${label} · ${n} phrases`,

  nativeLanguage: "Langue maternelle",
  language: "Langue",
  mode: "Mode",
  modeHint: "Test = notez-vous et obtenez un score",
  drill: "Entraînement",
  test: "Test",
  autoplay: "Lecture automatique",
  autoplayHint: "Désactivé = pause après chaque carte, appuyez sur lecture pour continuer",
  thinkingTime: "Temps de réflexion",
  thinkingTimeHint: "Pause avant la réponse",
  speechSpeed: "Vitesse de parole",
  direction: "Sens",
  dirTo: (short) => `→ ${short}`,
  shuffle: "Mélanger",
  loopDeck: "Boucler le paquet",
  showText: "Afficher le texte",
  showTextHint: "Désactivé = audio seul",

  deckHeading: "Paquet",
  uploadCsv: "Importer un CSV",
  pastePhrases: "Coller des phrases",
  aiSettingsBtn: "Réglages IA",
  generateWithAi: "✦ Générer avec l'IA",
  generateDisabledTitle: "Ajoutez d'abord une clé API dans Réglages IA",
  downloadDeck: "Télécharger le paquet",
  saveCurrentDeck: "Enregistrer ce paquet",
  pasteBoxPlaceholder: "Une phrase par ligne :\nOù est la gare ?, Where is the station?\nJe voudrais un café, I would like a coffee",
  loadPhrases: "Charger les phrases",
  cancel: "Annuler",
  saveDeckNamePlaceholder: "Nom du paquet",
  save: "Enregistrer",
  forgetKey: "Oublier la clé",
  aiKeyPlaceholder: "Votre clé API — conservée uniquement dans ce navigateur",
  noGrammarFocus: "Aucun point de grammaire — sujet seul",
  topicPlaceholder: "Sujet (facultatif), ex. commander du vin, le vélo, à l'atelier de poterie",
  phrasesOption: "Phrases",
  singleWordsOption: "Mots isolés",
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  countOption: (n) => `${n} phrases`,
  generate: "Générer",
  generating: "Génération…",
  yourDecks: "Vos paquets",
  load: "Charger",
  delete: "Supprimer",

  knewIt: "✓ Je savais",
  missedIt: "✗ Raté",
  newTest: "Nouveau test",
  practiseMisses: (n) => `Réviser ${n} ${n === 1 ? "erreur" : "erreurs"}`,

  footer: "Connectez une enceinte Bluetooth et appuyez sur lecture. Gardez l'écran allumé pendant l'entraînement.",

  statusLoadedPhrases: (n) => `${n} phrases chargées.`,
  statusNoPhrasesFound: "Aucune phrase trouvée — deux colonnes attendues, une paire par ligne.",
  statusSwitchedTarget: (name) => `Changé pour ${name} — paquet de départ chargé. Importez ou générez un paquet pour le remplacer.`,
  statusSavedDeck: (name) => `« ${name} » enregistré dans vos paquets.`,
  statusGenerating: (deckName) => `Génération : ${deckName}…`,
  statusGenerationFailed: (msg) => `Échec de la génération : ${msg}`,
  statusAiSettingsSaved: "Réglages IA enregistrés.",
  statusAiSettingsSavedNoKey: "Réglages IA enregistrés — aucune clé définie, Générer reste désactivé tant que vous n'en ajoutez pas une.",
  statusKeyForgotten: "Clé API oubliée.",
  statusGenerationEmptyResponse: "format de réponse illisible",
};

const es: UiStrings = {
  phaseReady: "Listo",
  promptPressPlay: "Pulsa reproducir para empezar",
  phaseListen: "Escucha",
  phaseYourTurn: (lang) => `Tu turno — dilo en ${lang}`,
  phaseAnswer: "Respuesta",
  phaseDidYouGetIt: "¿Lo sabías?",
  phasePaused: "En pausa",
  phaseTestComplete: "Test completado",
  phaseDeckComplete: "Mazo completado",
  phaseTestReady: "Test listo — pulsa reproducir",
  phaseReadyNextCard: "Listo para la siguiente tarjeta — pulsa reproducir",
  correctOutOf: (c, t) => `${c} / ${t} correctas`,

  starterDeck: (n) => `Mazo inicial · ${n} frases`,
  deckPhrases: (label, n) => `${label} · ${n} frases`,

  nativeLanguage: "Idioma nativo",
  language: "Idioma",
  mode: "Modo",
  modeHint: "Test = evalúate y obtén una puntuación",
  drill: "Práctica",
  test: "Test",
  autoplay: "Reproducción automática",
  autoplayHint: "Desactivado = pausa tras cada tarjeta, pulsa reproducir para continuar",
  thinkingTime: "Tiempo de reflexión",
  thinkingTimeHint: "Pausa antes de la respuesta",
  speechSpeed: "Velocidad de voz",
  direction: "Dirección",
  dirTo: (short) => `→ ${short}`,
  shuffle: "Aleatorio",
  loopDeck: "Repetir mazo",
  showText: "Mostrar texto",
  showTextHint: "Desactivado = solo audio",

  deckHeading: "Mazo",
  uploadCsv: "Subir CSV",
  pastePhrases: "Pegar frases",
  aiSettingsBtn: "Ajustes de IA",
  generateWithAi: "✦ Generar con IA",
  generateDisabledTitle: "Añade primero una clave API en Ajustes de IA",
  downloadDeck: "Descargar mazo",
  saveCurrentDeck: "Guardar mazo actual",
  pasteBoxPlaceholder: "Una frase por línea:\n¿Dónde está la estación?, Where is the station?\nQuisiera un café, I would like a coffee",
  loadPhrases: "Cargar frases",
  cancel: "Cancelar",
  saveDeckNamePlaceholder: "Nombre del mazo",
  save: "Guardar",
  forgetKey: "Olvidar clave",
  aiKeyPlaceholder: "Tu clave API — guardada solo en este navegador",
  noGrammarFocus: "Sin enfoque gramatical — solo tema",
  topicPlaceholder: "Tema (opcional), p. ej. pedir vino, ciclismo, en el taller de cerámica",
  phrasesOption: "Frases",
  singleWordsOption: "Palabras sueltas",
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  countOption: (n) => `${n} frases`,
  generate: "Generar",
  generating: "Generando…",
  yourDecks: "Tus mazos",
  load: "Cargar",
  delete: "Eliminar",

  knewIt: "✓ Lo sabía",
  missedIt: "✗ Fallé",
  newTest: "Nuevo test",
  practiseMisses: (n) => `Practicar ${n} ${n === 1 ? "fallo" : "fallos"}`,

  footer: "Conecta un altavoz Bluetooth y pulsa reproducir. Mantén la pantalla encendida mientras practicas.",

  statusLoadedPhrases: (n) => `${n} frases cargadas.`,
  statusNoPhrasesFound: "No se encontraron frases — se esperan dos columnas, un par por línea.",
  statusSwitchedTarget: (name) => `Cambiado a ${name} — mazo inicial cargado. Sube o genera un mazo para reemplazarlo.`,
  statusSavedDeck: (name) => `"${name}" guardado en tus mazos.`,
  statusGenerating: (deckName) => `Generando: ${deckName}…`,
  statusGenerationFailed: (msg) => `Error al generar: ${msg}`,
  statusAiSettingsSaved: "Ajustes de IA guardados.",
  statusAiSettingsSavedNoKey: "Ajustes de IA guardados — sin clave definida, Generar seguirá desactivado hasta que añadas una.",
  statusKeyForgotten: "Clave API olvidada.",
  statusGenerationEmptyResponse: "no se pudo leer el formato de la respuesta",
};

const DICTS: Record<LangCode, UiStrings> = { en, fr, es };

export function getStrings(uiLang: LangCode): UiStrings {
  return DICTS[uiLang];
}
