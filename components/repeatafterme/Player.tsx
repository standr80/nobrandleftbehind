"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RepetezEngine } from "@/lib/repeatafterme/engine";
import { LANGS } from "@/lib/repeatafterme/langs";
import { parseLines, deckToCsv } from "@/lib/repeatafterme/deckParsing";

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

  // Voices, thinking-bar animation hooks, and wake-lock reacquire-on-visible — all
  // client-only, wired once. Mirrors the imperative style manipulation in the
  // original repetez.html rather than re-rendering React for a CSS transition.
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
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const good = snap.results.filter(Boolean).length;
  const bad = snap.results.length - good;

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
          <button className="chip" onClick={handleDownload}>Download deck</button>
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

        <div className={"status" + (snap.statusErr ? " err" : "")}>{snap.status}</div>
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
