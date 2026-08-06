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

  // spaced repetition
  dueToday: (n: number) => string;
  dueQueueLabel: (n: number) => string;

  // save & sync
  saveAndSync: string;
  syncIntro: string;
  syncGenerateKey: string;
  syncYourKey: string;
  syncKeyHint: string;
  syncReveal: string;
  syncHide: string;
  syncCopy: string;
  statusSyncCopied: string;
  syncNow: string;
  syncStop: string;
  syncRestoreLabel: string;
  syncRestorePlaceholder: string;
  syncRestoreBtn: string;

  // Écoutez (listening mode)
  ecoutezNavLink: string;
  ecoutezBackLink: string;
  ecoutezIntro: string;
  ecoutezModeTopic: string;
  ecoutezModePaste: string;
  ecoutezTopicPlaceholder: string;
  ecoutezPastePlaceholder: string;
  ecoutezLevelLabel: string;
  ecoutezGenerate: string;
  ecoutezGenerating: string;
  ecoutezVocabHeading: string;
  ecoutezPreviewVocab: string;
  ecoutezStartListening: string;
  ecoutezPass1: string;
  ecoutezPass2: string;
  ecoutezSummaryHeading: string;
  ecoutezQuestionsHeading: string;
  ecoutezKeyPhrasesHeading: string;
  ecoutezExportDeck: string;
  ecoutezGoToDrill: string;
  ecoutezNewEpisode: string;

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
  statusNothingDue: string;
  statusSyncSaved: string;
  statusSyncRestored: string;
  statusSyncFailed: (msg: string) => string;
  statusSyncStopped: string;
  statusSyncNeedsKey: string;
  statusEcoutezGenerationFailed: (msg: string) => string;
  statusEcoutezExported: (name: string) => string;
  statusEcoutezNeedsKey: string;
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
  language: "Study Language",
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

  dueToday: (n) => `Due today (${n})`,
  dueQueueLabel: (n) => `Due today · ${n} ${n === 1 ? "phrase" : "phrases"}`,

  saveAndSync: "Save & Sync",
  syncIntro: "Get your decks and progress on another device. Generates a key on this device — no account, no email.",
  syncGenerateKey: "Generate a key",
  syncYourKey: "Your key",
  syncKeyHint: "Write this down — there's no password reset. Anyone with this key can read and overwrite this data.",
  syncReveal: "Show",
  syncHide: "Hide",
  syncCopy: "Copy",
  statusSyncCopied: "Key copied to clipboard.",
  syncNow: "Sync now",
  syncStop: "Stop syncing on this device",
  syncRestoreLabel: "Already have a key from another device?",
  syncRestorePlaceholder: "XXXX-XXXX-XXXX-XXXX-XXXX",
  syncRestoreBtn: "Restore",

  ecoutezNavLink: "Écoutez",
  ecoutezBackLink: "← Back to drills",
  ecoutezIntro: "Listen to a short passage at your level, twice — slow, then natural — with vocab before and a recap after.",
  ecoutezModeTopic: "Topic",
  ecoutezModePaste: "Paste text to simplify",
  ecoutezTopicPlaceholder: "Topic (optional), e.g. a trip to the market, weekend plans",
  ecoutezPastePlaceholder: "Paste authentic text and it'll be simplified to your level",
  ecoutezLevelLabel: "Level",
  ecoutezGenerate: "Generate episode",
  ecoutezGenerating: "Writing your episode…",
  ecoutezVocabHeading: "Vocab preview",
  ecoutezPreviewVocab: "Play vocab preview",
  ecoutezStartListening: "Start listening",
  ecoutezPass1: "Listening — slow pass",
  ecoutezPass2: "Listening — natural pass",
  ecoutezSummaryHeading: "Summary",
  ecoutezQuestionsHeading: "Comprehension questions",
  ecoutezKeyPhrasesHeading: "Key phrases",
  ecoutezExportDeck: "Export vocab as a deck",
  ecoutezGoToDrill: "Go practise this deck",
  ecoutezNewEpisode: "New episode",

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
  statusNothingDue: "Nothing due right now — nice work.",
  statusSyncSaved: "Synced.",
  statusSyncRestored: "Restored from sync.",
  statusSyncFailed: (msg) => `Sync failed: ${msg}`,
  statusSyncStopped: "Sync stopped on this device — your data stays here, nothing was deleted.",
  statusSyncNeedsKey: "Enter a key first.",
  statusEcoutezGenerationFailed: (msg) => `Couldn't generate that episode: ${msg}`,
  statusEcoutezExported: (name) => `Exported as "${name}" — find it in Your decks.`,
  statusEcoutezNeedsKey: "Add an API key in AI Settings on the main page first.",
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
  language: "Langue étudiée",
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

  dueToday: (n) => `À réviser (${n})`,
  dueQueueLabel: (n) => `À réviser · ${n} phrases`,

  saveAndSync: "Enregistrer et synchroniser",
  syncIntro: "Retrouvez vos paquets et votre progression sur un autre appareil. Génère une clé sur cet appareil — pas de compte, pas d'e-mail.",
  syncGenerateKey: "Générer une clé",
  syncYourKey: "Votre clé",
  syncKeyHint: "Notez-la — il n'y a pas de récupération de mot de passe. Toute personne avec cette clé peut lire et écraser ces données.",
  syncReveal: "Afficher",
  syncHide: "Masquer",
  syncCopy: "Copier",
  statusSyncCopied: "Clé copiée dans le presse-papiers.",
  syncNow: "Synchroniser",
  syncStop: "Arrêter la synchronisation sur cet appareil",
  syncRestoreLabel: "Vous avez déjà une clé d'un autre appareil ?",
  syncRestorePlaceholder: "XXXX-XXXX-XXXX-XXXX-XXXX",
  syncRestoreBtn: "Restaurer",

  ecoutezNavLink: "Écoutez",
  ecoutezBackLink: "← Retour aux exercices",
  ecoutezIntro: "Écoutez un court passage à votre niveau, deux fois — lentement, puis normalement — avec le vocabulaire avant et un résumé après.",
  ecoutezModeTopic: "Sujet",
  ecoutezModePaste: "Coller un texte à simplifier",
  ecoutezTopicPlaceholder: "Sujet (facultatif), ex. une sortie au marché, les projets du week-end",
  ecoutezPastePlaceholder: "Collez un texte authentique, il sera simplifié à votre niveau",
  ecoutezLevelLabel: "Niveau",
  ecoutezGenerate: "Générer l'épisode",
  ecoutezGenerating: "Rédaction de votre épisode…",
  ecoutezVocabHeading: "Aperçu du vocabulaire",
  ecoutezPreviewVocab: "Écouter l'aperçu du vocabulaire",
  ecoutezStartListening: "Commencer l'écoute",
  ecoutezPass1: "Écoute — passage lent",
  ecoutezPass2: "Écoute — passage normal",
  ecoutezSummaryHeading: "Résumé",
  ecoutezQuestionsHeading: "Questions de compréhension",
  ecoutezKeyPhrasesHeading: "Phrases clés",
  ecoutezExportDeck: "Exporter le vocabulaire en paquet",
  ecoutezGoToDrill: "Aller pratiquer ce paquet",
  ecoutezNewEpisode: "Nouvel épisode",

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
  statusNothingDue: "Rien à réviser pour l'instant — bravo.",
  statusSyncSaved: "Synchronisé.",
  statusSyncRestored: "Restauré depuis la synchronisation.",
  statusSyncFailed: (msg) => `Échec de la synchronisation : ${msg}`,
  statusSyncStopped: "Synchronisation arrêtée sur cet appareil — vos données restent ici, rien n'a été supprimé.",
  statusSyncNeedsKey: "Entrez d'abord une clé.",
  statusEcoutezGenerationFailed: (msg) => `Impossible de générer cet épisode : ${msg}`,
  statusEcoutezExported: (name) => `Exporté sous « ${name} » — retrouvez-le dans Vos paquets.`,
  statusEcoutezNeedsKey: "Ajoutez d'abord une clé API dans Réglages IA sur la page principale.",
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
  language: "Idioma de estudio",
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

  dueToday: (n) => `Para repasar (${n})`,
  dueQueueLabel: (n) => `Para repasar · ${n} frases`,

  saveAndSync: "Guardar y sincronizar",
  syncIntro: "Accede a tus mazos y tu progreso en otro dispositivo. Genera una clave en este dispositivo — sin cuenta, sin correo.",
  syncGenerateKey: "Generar una clave",
  syncYourKey: "Tu clave",
  syncKeyHint: "Anótala — no hay recuperación de contraseña. Cualquiera con esta clave puede leer y sobrescribir estos datos.",
  syncReveal: "Mostrar",
  syncHide: "Ocultar",
  syncCopy: "Copiar",
  statusSyncCopied: "Clave copiada al portapapeles.",
  syncNow: "Sincronizar",
  syncStop: "Dejar de sincronizar en este dispositivo",
  syncRestoreLabel: "¿Ya tienes una clave de otro dispositivo?",
  syncRestorePlaceholder: "XXXX-XXXX-XXXX-XXXX-XXXX",
  syncRestoreBtn: "Restaurar",

  ecoutezNavLink: "Écoutez",
  ecoutezBackLink: "← Volver a los ejercicios",
  ecoutezIntro: "Escucha un texto breve a tu nivel, dos veces — lento y luego natural — con vocabulario antes y un resumen después.",
  ecoutezModeTopic: "Tema",
  ecoutezModePaste: "Pegar texto para simplificar",
  ecoutezTopicPlaceholder: "Tema (opcional), p. ej. una salida al mercado, planes de fin de semana",
  ecoutezPastePlaceholder: "Pega un texto auténtico y se simplificará a tu nivel",
  ecoutezLevelLabel: "Nivel",
  ecoutezGenerate: "Generar episodio",
  ecoutezGenerating: "Redactando tu episodio…",
  ecoutezVocabHeading: "Vista previa del vocabulario",
  ecoutezPreviewVocab: "Escuchar vista previa del vocabulario",
  ecoutezStartListening: "Empezar a escuchar",
  ecoutezPass1: "Escuchando — pasada lenta",
  ecoutezPass2: "Escuchando — pasada natural",
  ecoutezSummaryHeading: "Resumen",
  ecoutezQuestionsHeading: "Preguntas de comprensión",
  ecoutezKeyPhrasesHeading: "Frases clave",
  ecoutezExportDeck: "Exportar vocabulario como mazo",
  ecoutezGoToDrill: "Ir a practicar este mazo",
  ecoutezNewEpisode: "Nuevo episodio",

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
  statusNothingDue: "Nada que repasar por ahora — bien hecho.",
  statusSyncSaved: "Sincronizado.",
  statusSyncRestored: "Restaurado desde la sincronización.",
  statusSyncFailed: (msg) => `Error al sincronizar: ${msg}`,
  statusSyncStopped: "Sincronización detenida en este dispositivo — tus datos permanecen aquí, no se ha eliminado nada.",
  statusSyncNeedsKey: "Introduce primero una clave.",
  statusEcoutezGenerationFailed: (msg) => `No se pudo generar el episodio: ${msg}`,
  statusEcoutezExported: (name) => `Exportado como "${name}" — encuéntralo en Tus mazos.`,
  statusEcoutezNeedsKey: "Añade primero una clave API en Ajustes de IA en la página principal.",
};

const DICTS: Record<LangCode, UiStrings> = { en, fr, es };

export function getStrings(uiLang: LangCode): UiStrings {
  return DICTS[uiLang];
}
