import { LANGS, type LangCode } from "./langs";

// Deliberately independent of engine.ts's speak()/pickVoice() — that pair is tightly
// scoped to the card-by-card drill loop's private voice-list state. Écoutez's playback
// shape (vocab preview, then a two-pass listen) is different enough, and simple
// enough, that a small self-contained helper here is lower-risk than threading a new
// use case through the engine class. Some duplication of the voice-matching logic is
// the deliberate trade-off.
export function pickVoice(voices: SpeechSynthesisVoice[], lang: LangCode): SpeechSynthesisVoice | null {
  const pref = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(lang));
  if (!pref.length) return null;
  const preferred = LANGS[lang].voiceNames.concat(["google"]);
  for (const name of preferred) {
    const hit = pref.find((v) => v.name.toLowerCase().includes(name));
    if (hit) return hit;
  }
  return pref[0];
}

export function speakText(text: string, lang: LangCode, rate: number, voices: SpeechSynthesisVoice[]): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGS[lang].tts;
    const v = pickVoice(voices, lang);
    if (v) u.voice = v;
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
