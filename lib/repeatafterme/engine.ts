import { LANGS, type LangCode, type Pair } from "./langs";

export interface Settings {
  pause: number;
  rate: number;
  dir: "EF" | "FE";
  shuffle: boolean;
  loop: boolean;
  showText: boolean;
  mode: "drill" | "test";
  lang: LangCode;
}

export interface EngineSnapshot {
  deck: Pair[];
  order: number[];
  pos: number;
  playing: boolean;
  phaseClass: string;
  phaseLabel: string;
  promptText: string;
  answerText: string;
  revealAnswer: boolean;
  markVisible: boolean;
  summaryVisible: boolean;
  results: boolean[];
  missedCount: number;
  settings: Settings;
  deckLabel: string;
  status: string;
  statusErr: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Faithful port of repetez.html's playback engine. Kept as a plain, framework-agnostic
 * class (not hooks) on purpose: the original's async-loop-guard pattern — every `await`
 * inside runFrom() followed by a `playing`/`runToken` check — is the load-bearing bit that
 * prevents ghost audio after skip/stop, and a straight port is far lower-risk than
 * re-deriving the same behaviour as idiomatic hooks. React subscribes via
 * useSyncExternalStore (see components/repeatafterme/Player.tsx); the engine has no
 * knowledge of React.
 *
 * Thinking-bar animation and wake-lock/audio-session plumbing stay imperative (callbacks
 * set by the consumer) rather than snapshot fields, matching the original's direct style
 * manipulation — re-rendering React for a CSS transition would be the wrong tool.
 */
export class RepetezEngine {
  private deck: Pair[];
  private order: number[] = [];
  private pos = 0;
  private playing = false;
  private runToken = 0;
  private settings: Settings;
  private results: boolean[] = [];
  private missed: number[] = [];
  private markResolve: ((v: boolean | null) => void) | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private audioCtx: AudioContext | null = null;

  private phaseClass = "";
  private phaseLabel = "Ready";
  private promptText = "Press play to begin";
  private answerText = "";
  private revealAnswer = false;
  private markVisible = false;
  private summaryVisible = false;
  private deckLabel: string;
  private status = "";
  private statusErr = false;

  private listeners = new Set<() => void>();
  private snapshot: EngineSnapshot;

  onThinkStart: ((ms: number) => void) | null = null;
  onThinkStop: (() => void) | null = null;
  /** Fired whenever settings or the active deck change — the consumer's cue to persist. */
  onDeckOrSettingsChange: (() => void) | null = null;
  /** Fired when a test run finishes — the consumer's cue to record score history. */
  onTestComplete: ((result: { deckLabel: string; lang: LangCode; correct: number; total: number }) => void) | null = null;

  constructor(lang: LangCode = "fr") {
    this.settings = { pause: 1.25, rate: 0.9, dir: "EF", shuffle: false, loop: true, showText: true, mode: "drill", lang };
    this.deck = LANGS[lang].starter.slice();
    this.deckLabel = `Starter deck · ${this.deck.length} phrases`;
    this.rebuildOrder();
    this.syncCard(false);
    this.snapshot = this.buildSnapshot();
  }

  // ---------- subscription (useSyncExternalStore contract) ----------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): EngineSnapshot => this.snapshot;

  private buildSnapshot(): EngineSnapshot {
    return {
      deck: this.deck,
      order: this.order,
      pos: this.pos,
      playing: this.playing,
      phaseClass: this.phaseClass,
      phaseLabel: this.phaseLabel,
      promptText: this.promptText,
      answerText: this.answerText,
      revealAnswer: this.revealAnswer,
      markVisible: this.markVisible,
      summaryVisible: this.summaryVisible,
      results: this.results,
      missedCount: this.missed.length,
      settings: this.settings,
      deckLabel: this.deckLabel,
      status: this.status,
      statusErr: this.statusErr,
    };
  }

  private emit() {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  // ---------- voices (call once client-side, e.g. from a useEffect) ----------
  setVoices(voices: SpeechSynthesisVoice[]) {
    this.voices = voices;
  }

  private pickVoice(which: "en" | "target"): SpeechSynthesisVoice | null {
    const langCode = which === "en" ? "en" : this.settings.lang;
    const pref = this.voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(langCode));
    if (!pref.length) return null;
    const preferred = which === "en" ? ["serena", "daniel", "kate", "google uk"] : LANGS[this.settings.lang].voiceNames.concat(["google"]);
    for (const name of preferred) {
      const hit = pref.find((v) => v.name.toLowerCase().includes(name));
      if (hit) return hit;
    }
    return pref[0];
  }

  private speak(text: string, which: "en" | "target"): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = which === "en" ? "en-GB" : LANGS[this.settings.lang].tts;
      const v = this.pickVoice(which);
      if (v) u.voice = v;
      u.rate = this.settings.rate;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  // ---------- audio session keep-alive (Bluetooth routing fix) ----------
  private ensureAudioSession() {
    try {
      if (!this.audioCtx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.audioCtx = new AC();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        gain.gain.value = 0.001;
        osc.frequency.value = 30;
        osc.connect(gain).connect(this.audioCtx.destination);
        osc.start();
      }
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    } catch {
      /* no-op — best-effort Bluetooth routing nudge */
    }
  }
  private pauseAudioSession() {
    try {
      this.audioCtx?.suspend();
    } catch {
      /* no-op */
    }
  }

  private async requestWake() {
    try {
      if ("wakeLock" in navigator) this.wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      /* no-op — wake lock is best-effort */
    }
  }
  private releaseWake() {
    try {
      this.wakeLock?.release();
    } catch {
      /* no-op */
    }
    this.wakeLock = null;
  }
  reacquireWakeIfPlaying() {
    if (this.playing) void this.requestWake();
  }

  // ---------- order / card display ----------
  private rebuildOrder() {
    this.order = this.deck.map((_, i) => i);
    if (this.settings.shuffle) {
      for (let i = this.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      }
    }
  }

  private setPhase(cls: string, label: string) {
    this.phaseClass = cls;
    this.phaseLabel = label;
  }

  private syncCard(revealAnswer: boolean) {
    const [en, fr] = this.deck[this.order[this.pos]];
    const prompt = this.settings.dir === "EF" ? en : fr;
    const answer = this.settings.dir === "EF" ? fr : en;
    this.promptText = this.settings.showText ? prompt : "🎧";
    this.answerText = answer;
    this.revealAnswer = revealAnswer && this.settings.showText;
  }

  // ---------- player loop ----------
  private async runFrom(startPos: number) {
    const token = ++this.runToken;
    this.pos = startPos;
    while (this.playing && token === this.runToken) {
      const [en, fr] = this.deck[this.order[this.pos]];
      const prompt = this.settings.dir === "EF" ? en : fr;
      const answer = this.settings.dir === "EF" ? fr : en;
      const promptLang = this.settings.dir === "EF" ? "en" : "target";
      const answerLang = this.settings.dir === "EF" ? "target" : "en";

      this.syncCard(false);
      this.setPhase("speaking", "Listen");
      this.emit();
      await this.speak(prompt, promptLang);
      if (!this.playing || token !== this.runToken) break;

      const ms = Math.max(2200, answer.length * 90 * this.settings.pause);
      this.setPhase("yourturn", "Your turn — say it in " + (answerLang === "target" ? LANGS[this.settings.lang].name : "English"));
      this.emit();
      this.onThinkStart?.(ms);
      await sleep(ms);
      this.onThinkStop?.();
      if (!this.playing || token !== this.runToken) break;

      this.syncCard(true);
      this.setPhase("speaking", "Answer");
      this.emit();
      await this.speak(answer, answerLang);
      if (!this.playing || token !== this.runToken) break;

      if (this.settings.mode === "test") {
        this.setPhase("yourturn", "Did you get it?");
        this.markVisible = true;
        this.emit();
        const ok = await new Promise<boolean | null>((res) => {
          this.markResolve = res;
        });
        this.markVisible = false;
        if (ok === null || !this.playing || token !== this.runToken) {
          this.emit();
          break;
        }
        this.results.push(ok);
        if (!ok) this.missed.push(this.order[this.pos]);
        this.emit();
      } else {
        await sleep(900);
        if (!this.playing || token !== this.runToken) break;
      }

      if (this.pos + 1 >= this.order.length) {
        if (this.settings.mode === "test") {
          this.finishTest();
          return;
        }
        if (this.settings.loop) {
          if (this.settings.shuffle) this.rebuildOrder();
          this.pos = 0;
        } else {
          this.stop();
          this.setPhase("", "Deck complete");
          this.emit();
          return;
        }
      } else {
        this.pos++;
      }
    }
  }

  private resetTest() {
    this.results = [];
    this.missed = [];
    this.summaryVisible = false;
    this.markVisible = false;
  }

  private finishTest() {
    this.playing = false;
    this.runToken++;
    this.releaseWake();
    const good = this.results.filter(Boolean).length;
    this.setPhase("", "Test complete");
    this.promptText = `${good} / ${this.results.length} correct`;
    this.answerText = "";
    this.revealAnswer = false;
    this.summaryVisible = true;
    this.emit();
    this.onTestComplete?.({ deckLabel: this.deckLabel, lang: this.settings.lang, correct: good, total: this.results.length });
  }

  // ---------- transport ----------
  play() {
    if (!this.deck.length) return;
    this.ensureAudioSession();
    if (this.settings.mode === "test" && this.pos === 0 && !this.results.length) this.resetTest();
    this.summaryVisible = false;
    this.playing = true;
    void this.requestWake();
    this.emit();
    void this.runFrom(this.pos);
  }

  stop() {
    this.playing = false;
    this.runToken++;
    if (this.markResolve) {
      const r = this.markResolve;
      this.markResolve = null;
      r(null);
    }
    this.markVisible = false;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.onThinkStop?.();
    this.setPhase("", "Paused");
    this.pauseAudioSession();
    this.releaseWake();
    this.emit();
  }

  toggle() {
    if (this.playing) this.stop();
    else this.play();
  }

  next() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.pos = (this.pos + 1) % this.order.length;
    if (this.playing) void this.runFrom(this.pos);
    else {
      this.syncCard(false);
      this.emit();
    }
  }

  prev() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.pos = (this.pos - 1 + this.order.length) % this.order.length;
    if (this.playing) void this.runFrom(this.pos);
    else {
      this.syncCard(false);
      this.emit();
    }
  }

  repeatCurrent() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    if (this.playing) void this.runFrom(this.pos);
    else {
      this.playing = true;
      this.emit();
      void this.runFrom(this.pos);
    }
  }

  // ---------- test marking ----------
  markKnew() {
    if (this.markResolve) {
      const r = this.markResolve;
      this.markResolve = null;
      r(true);
    }
  }
  markMissed() {
    if (this.markResolve) {
      const r = this.markResolve;
      this.markResolve = null;
      r(false);
    }
  }
  practiseMisses() {
    this.order = this.missed.slice();
    this.pos = 0;
    this.resetTest();
    this.play();
  }
  restartTest() {
    this.rebuildOrder();
    this.pos = 0;
    this.resetTest();
    this.play();
  }

  // ---------- settings ----------
  setPause(v: number) {
    this.settings.pause = v;
    this.emit();
    this.onDeckOrSettingsChange?.();
  }
  setRate(v: number) {
    this.settings.rate = v;
    this.emit();
    this.onDeckOrSettingsChange?.();
  }
  setDir(dir: "EF" | "FE") {
    this.settings.dir = dir;
    this.syncCard(false);
    this.emit();
    this.onDeckOrSettingsChange?.();
  }
  setMode(mode: "drill" | "test") {
    this.stop();
    this.settings.mode = mode;
    this.resetTest();
    this.rebuildOrder();
    this.pos = 0;
    this.syncCard(false);
    if (mode === "test") this.setPhase("", "Test ready — press play");
    this.emit();
    this.onDeckOrSettingsChange?.();
  }
  setLang(code: LangCode) {
    this.stop();
    this.settings.lang = code;
    this.deck = LANGS[code].starter.slice();
    this.pos = 0;
    this.rebuildOrder();
    this.resetTest();
    this.syncCard(false);
    this.deckLabel = `Starter deck · ${this.deck.length} phrases`;
    this.status = `Switched to ${LANGS[code].name} — starter deck loaded. Upload or generate a deck to replace it.`;
    this.statusErr = false;
    this.emit();
    this.onDeckOrSettingsChange?.();
  }
  toggleShuffle() {
    this.settings.shuffle = !this.settings.shuffle;
    this.rebuildOrder();
    this.pos = 0;
    this.syncCard(false);
    this.emit();
    this.onDeckOrSettingsChange?.();
  }
  toggleLoop() {
    this.settings.loop = !this.settings.loop;
    this.emit();
    this.onDeckOrSettingsChange?.();
  }
  toggleShowText() {
    this.settings.showText = !this.settings.showText;
    this.syncCard(this.revealAnswer);
    this.emit();
    this.onDeckOrSettingsChange?.();
  }

  // ---------- deck loading ----------
  loadDeck(rows: Pair[], label: string, opts: { silent?: boolean } = {}) {
    if (!rows.length) {
      this.status = "No phrases found — expected: english, french (one per line).";
      this.statusErr = true;
      this.emit();
      return;
    }
    this.stop();
    this.deck = rows;
    this.pos = 0;
    this.rebuildOrder();
    this.resetTest();
    this.syncCard(false);
    this.deckLabel = `${label} · ${this.deck.length} phrases`;
    if (!opts.silent) {
      this.status = `Loaded ${this.deck.length} phrases.`;
      this.statusErr = false;
    }
    this.emit();
    if (!opts.silent) this.onDeckOrSettingsChange?.();
  }

  /** Restore persisted settings + last-used deck on mount. Silent — no status message,
   *  no onDeckOrSettingsChange echo (we're loading what was already saved, not changing it). */
  hydrate(opts: { settings?: Partial<Settings>; deck?: { pairs: Pair[]; label: string } }) {
    if (opts.settings) this.settings = { ...this.settings, ...opts.settings };
    if (opts.deck?.pairs.length) {
      this.deck = opts.deck.pairs;
      this.deckLabel = opts.deck.label;
    } else if (opts.settings?.lang) {
      this.deck = LANGS[this.settings.lang].starter.slice();
      this.deckLabel = `Starter deck · ${this.deck.length} phrases`;
    }
    this.pos = 0;
    this.rebuildOrder();
    this.resetTest();
    this.syncCard(false);
    this.emit();
  }

  /** Load a saved deck, switching the active language first if it was saved under a
   *  different one (so TTS uses the right voice) — used by the deck library's "Load". */
  loadDeckForLang(pairs: Pair[], label: string, lang: LangCode) {
    if (lang !== this.settings.lang) this.settings.lang = lang;
    this.loadDeck(pairs, label);
  }

  /** Current deck's content, for the consumer to persist (last-used or save-to-library). */
  getCurrentDeck(): { pairs: Pair[]; label: string; lang: LangCode } {
    // Strip any " · N phrases" suffix so re-saving doesn't accumulate labels.
    const label = this.deckLabel.replace(/\s*·\s*\d+\s*phrases?$/i, "");
    return { pairs: this.deck, label, lang: this.settings.lang };
  }

  setStatus(msg: string, err = false) {
    this.status = msg;
    this.statusErr = err;
    this.emit();
  }
}
