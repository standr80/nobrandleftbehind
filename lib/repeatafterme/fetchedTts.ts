// Fetched-audio TTS (BYOK, OpenAI) — the roadmap's stated payoff for this is
// reliability: <audio> elements route over Bluetooth the same way Spotify does and
// survive screen lock, unlike the Web Speech API (see French/repetez/BRIEF.md,
// "Known issues #1/#2"). Used by EcoutezPlayer.tsx for its long-form playback, where
// that reliability matters most; simpleTts.ts's Web Speech path stays the fallback
// when no OpenAI key is configured or the fetch fails.

export async function fetchSpeech(text: string, apiKey: string, speed = 1): Promise<Blob> {
  const res = await fetch("/api/repeatafterme/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, text, speed }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.error) msg = err.error;
    } catch {
      /* ignore — keep the generic HTTP status message */
    }
    throw new Error(msg);
  }
  return res.blob();
}

/** Resolves once playback ends (or errors/is denied) — mirrors speakText()'s promise
 *  shape so callers don't need to branch on which path they took. `onAudioCreated`
 *  hands back the element so the caller can pause it early (stop/unmount). */
export function playBlob(blob: Blob, onAudioCreated?: (audio: HTMLAudioElement) => void): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    onAudioCreated?.(audio);
    const done = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}
