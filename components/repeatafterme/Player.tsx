"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RepetezEngine } from "@/lib/repeatafterme/engine";
import { LANGS } from "@/lib/repeatafterme/langs";
import { parseLines, deckToCsv, extractPairs } from "@/lib/repeatafterme/deckParsing";
import {
  getSettings,
  saveSettings,
  getLastDeck,
  saveLastDeck,
  listDecks,
  saveDeckToLibrary,
  renameDeckInLibrary,
  deleteDeckFromLibrary,
  addScore,
  type SavedDeck,
} from "@/lib/repeatafterme/db";
import { loadAiSettings, saveAiSettings, type AiSettings } from "@/lib/repeatafterme/aiSettings";
import { buildDeckGenPrompt } from "@/lib/repeatafterme/genPrompt";
import type { AiProvider } from "@/lib/repeatafterme/providers";

export default function Player() {
  const engineRef = useRef<RepetezEngine | null>(null);
  if (!engineRef.current) engineRef.current = new RepetezEngine("fr");
  const engine = engineRef.current;

  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const L = LANGS[snap.settings.lang];

  const thinkbarRef = useRef<HTMLDivElement | null>(null);
  const thinkfillRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [saveBoxOpen, setSaveBoxOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [genOpen, setGenOpen] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genFocus, setGenFocus] = useState("");
  const [genType, setGenType] = useState<"phrases" | "words">("phrases");
  const [genLevel, setGenLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [genCount, setGenCount] = useState("20");

  // Saved AI settings (the source of truth for whether Generate is enabled) vs. the
  // draft being edited in the AI Settings box — kept separate so typing a key doesn't
  // take effect until "Save" is clicked.
  const [aiSettings, setAiSettings] = useState<AiSettings>({ provider: "anthropic", apiKey: "" });
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiDraftProvider, setAiDraftProvider] = useState<AiProvider>("anthropic");
  const [aiDraftApiKey, setAiDraftApiKey] = useState("");

  function refreshSavedDecks() {
    listDecks().then(setSavedDecks);
  }
  function openAiSettings() {
    setAiDraftProvider(aiSettings.provider);
    setAiDraftApiKey(aiSettings.apiKey);
    setAiSettingsOpen((v) => !v);
  }
  function handleSaveAiSettings() {
    const next: AiSettings = { provider: aiDraftProvider, apiKey: aiDraftApiKey.trim() };
    saveAiSettings(next);
    setAiSettings(next);
    setAiSettingsOpen(false);
    engine.setStatus(next.apiKey ? "AI settings saved." : "AI settings saved — no key set, Generate stays off until you add one.");
  }
  function handleForgetKey() {
    const next: AiSettings = { provider: aiDraftProvider, apiKey: "" };
    saveAiSettings(next);
    setAiSettings(next);
    setAiDraftApiKey("");
    engine.setStatus("API key forgotten.");
  }

  // Voices, thinking-bar animation hooks, wake-lock reacquire-on-visible, and
  // IndexedDB persistence hooks — all client-only, wired once. Mirrors the imperative
  // style manipulation in the original repetez.html rather than re-rendering React for
  // a CSS transition.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => engine.setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;

    engine.onThinkStart = (ms) => {
      thinkbarRef.current?.classList.add("active");
      const el = thinkfillRef.current;
      if (el) {
        el.style.transition = "none";
        el.style.transform = "scaleX(1)";
        void el.offsetWidth;
        el.style.transition = `transform ${ms}ms linear`;
        el.style.transform = "scaleX(0)";
      }
    };
    engine.onThinkStop = () => {
      thinkbarRef.current?.classList.remove("active");
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") engine.reacquireWakeIfPlaying();
    };
    document.addEventListener("visibilitychange", onVisible);

    engine.onDeckOrSettingsChange = () => {
      const snapshot = engine.getSnapshot();
      void saveSettings(snapshot.settings);
      const current = engine.getCurrentDeck();
      void saveLastDeck(snapshot.deckLabel, current.pairs);
    };
    engine.onTestComplete = (result) => {
      void addScore({ ...result, date: new Date().toISOString() });
    };

    // Resume where you left off: restore persisted settings + last-used deck, then
    // load the saved-deck library list. Silent — hydrate() doesn't re-trigger a save.
    Promise.all([getSettings(), getLastDeck()]).then(([settings, lastDeck]) => {
      if (settings || lastDeck) {
        engine.hydrate({ settings, deck: lastDeck });
      }
    });
    refreshSavedDecks();
    setAiSettings(loadAiSettings());

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const good = snap.results.filter(Boolean).length;
  const bad = snap.results.length - good;

  // Grammar-focus values are language-specific (LANGS[lang].focuses) — clear a
  // stale selection when the language changes so it doesn't silently no-op.
  useEffect(() => {
    setGenFocus("");
  }, [snap.settings.lang]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => engine.loadDeck(parseLines(String(r.result)), f.name);
    r.readAsText(f);
    e.target.value = "";
  }

  function handleDownload() {
    const csv = deckToCsv(snap.deck);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = L.name.toLowerCase() + "-deck.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openSaveBox() {
    setSaveName(engine.getCurrentDeck().label);
    setSaveBoxOpen(true);
  }
  async function handleSaveCurrent() {
    const current = engine.getCurrentDeck();
    await saveDeckToLibrary({ label: saveName.trim() || current.label, lang: current.lang, pairs: current.pairs });
    refreshSavedDecks();
    setSaveBoxOpen(false);
    engine.setStatus(`Saved "${saveName.trim() || current.label}" to your decks.`);
  }
  function handleLoadSaved(deck: SavedDeck) {
    engine.loadDeckForLang(deck.pairs, deck.label, deck.lang);
  }
  async function handleDeleteSaved(id: string) {
    await deleteDeckFromLibrary(id);
    refreshSavedDecks();
  }
  async function handleGenerate() {
    const focusLabel = genFocus ? L.focuses.find((f) => f[1] === genFocus)?.[0] ?? "" : "";
    const { prompt, deckName } = buildDeckGenPrompt({
      lang: snap.settings.lang,
      genType,
      level: genLevel,
      count: genCount,
      topic: genTopic,
      focus: genFocus,
      focusLabel,
    });
    engine.setStatus(`Generating ${genCount} phrases: ${deckName}…`);
    setGenLoading(true);
    try {
      const res = await fetch("/api/repeatafterme/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiSettings.provider, apiKey: aiSettings.apiKey, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const rows = extractPairs(data.text);
      if (!rows.length) throw new Error("couldn't read the response format");
      engine.loadDeck(rows, "AI: " + deckName);
      setGenOpen(false);
    } catch (err) {
      engine.setStatus(`Generation failed: ${String((err as Error)?.message || err)}`, true);
    } finally {
      setGenLoading(false);
    }
  }

  function startRename(deck: SavedDeck) {
    setRenamingId(deck.id);
    setRenameValue(deck.label);
  }
  async function commitRename() {
    if (renamingId && renameValue.trim()) {
      await renameDeckInLibrary(renamingId, renameValue.trim());
      refreshSavedDecks();
    }
    setRenamingId(null);
  }

  return (
    <div className="repeatafterme">
      <div className="tricolore"><span></span><span></span><span></span></div>
      <header>
        <h1>
          {L.title}
          <em>.</em>
        </h1>
        <span className="deck-label">{snap.deckLabel}</span>
      </header>

      <main>
        <div className="card" role="status" aria-live="polite">
          <span className="counter">{snap.pos + 1} / {snap.order.length}</span>
          <span className="score">
            {snap.results.length > 0 && (
              <>
                <b>✓ {good}</b> · <i>✗ {bad}</i>
              </>
            )}
          </span>
          <span className={"phase-tag" + (snap.phaseClass ? " " + snap.phaseClass : "")}>
            <span className="dot"></span>
            <span>{snap.phaseLabel}</span>
          </span>
          <div className="en-line">{snap.promptText}</div>
          <div className="thinkbar" ref={thinkbarRef}>
            <div ref={thinkfillRef}></div>
          </div>
          <div className={"fr-line" + (snap.revealAnswer ? "" : " hidden-answer")}>{snap.answerText || " "}</div>

          <div className={"markrow" + (snap.markVisible ? " show" : "")}>
            <button className="mark good" onClick={() => engine.markKnew()}>✓ Knew it</button>
            <button className="mark bad" onClick={() => engine.markMissed()}>✗ Missed it</button>
          </div>
          <div className={"summaryrow" + (snap.summaryVisible ? " show" : "")}>
            {snap.missedCount > 0 && (
              <button className="mark bad" onClick={() => engine.practiseMisses()}>
                Practise {snap.missedCount} {snap.missedCount === 1 ? "miss" : "misses"}
              </button>
            )}
            <button className="mark good" onClick={() => engine.restartTest()}>New test</button>
          </div>
        </div>

        <div className="transport">
          <button className="btn-round" aria-label="Previous phrase" onClick={() => engine.prev()}>⏮</button>
          <button className="btn-play" aria-label={snap.playing ? "Pause" : "Play"} onClick={() => engine.toggle()}>
            {snap.playing ? "⏸" : "▶"}
          </button>
          <button className="btn-round" aria-label="Next phrase" onClick={() => engine.next()}>⏭</button>
          <button className="btn-round" aria-label="Replay this phrase" style={{ fontSize: 16 }} onClick={() => engine.repeatCurrent()}>↻</button>
        </div>

        <div className="panel">
          <div className="row">
            <label>Language</label>
            <div className="seg">
              <button className={snap.settings.lang === "fr" ? "on" : ""} onClick={() => snap.settings.lang !== "fr" && engine.setLang("fr")}>Français</button>
              <button className={snap.settings.lang === "es" ? "on" : ""} onClick={() => snap.settings.lang !== "es" && engine.setLang("es")}>Español</button>
            </div>
          </div>
          <div className="row">
            <label>
              Mode<span className="hint">Test = mark yourself, get a score</span>
            </label>
            <div className="seg">
              <button className={snap.settings.mode === "drill" ? "on" : ""} onClick={() => engine.setMode("drill")}>Drill</button>
              <button className={snap.settings.mode === "test" ? "on" : ""} onClick={() => engine.setMode("test")}>Test</button>
            </div>
          </div>
          {snap.settings.mode === "drill" && (
            <div className="row">
              <label>
                Autoplay<span className="hint">Off = pause after each card, press play for the next</span>
              </label>
              <Toggle on={snap.settings.autoplay} onClick={() => engine.toggleAutoplay()} />
            </div>
          )}
          <div className="row">
            <label>
              Thinking time<span className="hint">Pause before the answer</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={0.5} max={3} step={0.25} value={snap.settings.pause} onChange={(e) => engine.setPause(+e.target.value)} />
              <span className="val">{snap.settings.pause}×</span>
            </div>
          </div>
          <div className="row">
            <label>Speech speed</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={0.6} max={1.2} step={0.05} value={snap.settings.rate} onChange={(e) => engine.setRate(+e.target.value)} />
              <span className="val">{snap.settings.rate}×</span>
            </div>
          </div>
          <div className="row">
            <label>Direction</label>
            <div className="seg">
              <button className={snap.settings.dir === "EF" ? "on" : ""} onClick={() => engine.setDir("EF")}>EN → {L.short}</button>
              <button className={snap.settings.dir === "FE" ? "on" : ""} onClick={() => engine.setDir("FE")}>{L.short} → EN</button>
            </div>
          </div>
          <div className="row">
            <label>Shuffle</label>
            <Toggle on={snap.settings.shuffle} onClick={() => engine.toggleShuffle()} />
          </div>
          <div className="row">
            <label>Loop deck</label>
            <Toggle on={snap.settings.loop} onClick={() => engine.toggleLoop()} />
          </div>
          <div className="row">
            <label>
              Show text<span className="hint">Off = audio only</span>
            </label>
            <Toggle on={snap.settings.showText} onClick={() => engine.toggleShowText()} />
          </div>
        </div>

        <h2>Deck</h2>
        <div className="deck-actions">
          <button className="chip" onClick={() => fileInputRef.current?.click()}>Upload CSV</button>
          <button className="chip" onClick={() => setPasteOpen((v) => !v)}>Paste phrases</button>
          <button className="chip" onClick={openAiSettings}>AI Settings</button>
          <button
            className="chip primary"
            onClick={() => setGenOpen((v) => !v)}
            disabled={!aiSettings.apiKey.trim()}
            title={aiSettings.apiKey.trim() ? undefined : "Add an API key in AI Settings first"}
          >
            ✦ Generate with AI
          </button>
          <button className="chip" onClick={handleDownload}>Download deck</button>
          <button className="chip" onClick={openSaveBox}>Save current deck</button>
        </div>
        <input ref={fileInputRef} id="csvfile" type="file" accept=".csv,.txt,.tsv" onChange={handleFile} />

        <div className={"paste-box" + (pasteOpen ? " open" : "")}>
          <textarea
            placeholder={"One phrase per line:\nWhere is the station?, Où est la gare ?\nI would like a coffee, Je voudrais un café"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="gen-row">
            <button
              className="chip primary"
              onClick={() => {
                engine.loadDeck(parseLines(pasteText), "Pasted deck");
                setPasteOpen(false);
              }}
            >
              Load phrases
            </button>
            <button className="chip" onClick={() => setPasteOpen(false)}>Cancel</button>
          </div>
        </div>

        <div className={"paste-box" + (aiSettingsOpen ? " open" : "")}>
          <select value={aiDraftProvider} onChange={(e) => setAiDraftProvider(e.target.value as AiProvider)}>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="google">Google (Gemini)</option>
          </select>
          <input
            type="password"
            autoComplete="off"
            value={aiDraftApiKey}
            onChange={(e) => setAiDraftApiKey(e.target.value)}
            placeholder="Your API key — stored only in this browser"
          />
          <div className="gen-row">
            <button className="chip primary" onClick={handleSaveAiSettings}>Save</button>
            <button className="chip" onClick={handleForgetKey}>Forget key</button>
            <button className="chip" onClick={() => setAiSettingsOpen(false)}>Cancel</button>
          </div>
        </div>

        <div className={"gen-box" + (genOpen ? " open" : "")}>
          <select value={genFocus} onChange={(e) => setGenFocus(e.target.value)}>
            <option value="">No grammar focus — topic only</option>
            {L.focuses.map(([label, val]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
            placeholder="Topic (optional), e.g. ordering wine, cycling, at the pottery studio"
          />
          <div className="gen-row">
            <select value={genType} onChange={(e) => setGenType(e.target.value as "phrases" | "words")}>
              <option value="phrases">Phrases</option>
              <option value="words">Single words</option>
            </select>
            <select value={genLevel} onChange={(e) => setGenLevel(e.target.value as "beginner" | "intermediate" | "advanced")}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select value={genCount} onChange={(e) => setGenCount(e.target.value)}>
              <option value="10">10 phrases</option>
              <option value="20">20 phrases</option>
              <option value="30">30 phrases</option>
            </select>
            <button className="chip primary" onClick={handleGenerate} disabled={genLoading}>
              {genLoading ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>

        <div className={"paste-box" + (saveBoxOpen ? " open" : "")}>
          <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Deck name" />
          <div className="gen-row">
            <button className="chip primary" onClick={handleSaveCurrent}>Save</button>
            <button className="chip" onClick={() => setSaveBoxOpen(false)}>Cancel</button>
          </div>
        </div>

        <div className={"status" + (snap.statusErr ? " err" : "")}>{snap.status}</div>

        {savedDecks.length > 0 && (
          <>
            <h2>Your decks</h2>
            <div className="panel">
              {savedDecks.map((deck) => (
                <div className="row" key={deck.id}>
                  {renamingId === deck.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      style={{ maxWidth: 220 }}
                    />
                  ) : (
                    <label onClick={() => startRename(deck)} style={{ cursor: "text" }}>
                      {deck.label}
                      <span className="hint">
                        {LANGS[deck.lang].short} · {deck.pairs.length} phrases
                      </span>
                    </label>
                  )}
                  <div className="gen-row">
                    <button className="chip primary" onClick={() => handleLoadSaved(deck)}>Load</button>
                    <button className="chip" onClick={() => handleDeleteSaved(deck.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <footer>Connect a Bluetooth speaker and press play. Keep the screen awake while practising.</footer>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      className={"toggle" + (on ? " on" : "")}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <i></i>
    </div>
  );
}
