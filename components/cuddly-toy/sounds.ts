/**
 * Tiny Web Audio sound effects, so the game needs no audio files.
 *
 * Browsers (and Facebook's in-app browser in particular) only allow audio after
 * a user gesture, so create this from inside a tap handler.
 */
export interface Sounds {
  ding(): void
  win(): void
  nope(): void
  fanfare(): void
}

export function createSounds(): Sounds | null {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null

  const ctx = new Ctx()
  void ctx.resume()

  function tone(freq: number, startIn: number, duration: number, type: OscillatorType = 'sine', volume = 0.12) {
    const t = ctx.currentTime + startIn
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  return {
    ding: () => tone(880, 0, 0.35),
    win: () => {
      tone(660, 0, 0.15, 'triangle')
      tone(990, 0.1, 0.25, 'triangle')
    },
    nope: () => tone(220, 0, 0.2, 'sine', 0.06),
    fanfare: () => {
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, i === 3 ? 0.6 : 0.2, 'triangle'))
    },
  }
}
