"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { RepetezEngine } from "@/lib/repeatafterme/engine";
import { LANGS, LANG_ORDER, availableTargets } from "@/lib/repeatafterme/langs";
import { getStrings } from "@/lib/repeatafterme/i18n";
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
  getSrsRecord,
  saveSrsRecord,
  listDueSrsRecords,
  exportSyncPayload,
  restoreSyncPayload,
  recordActivity,
  getActivityLog,
  computeStreak,
  getTodayMinutes,
  getLastPosition,
  saveLastPosition,
  getBookmark,
  saveBookmark,
  type SavedDeck,
  type SyncPayload,
} from "@/lib/repeatafterme/db";
import { loadAiSettings, saveAiSettings, type AiSettings } from "@/lib/repeatafterme/aiSettings";
import { buildDeckGenPrompt } from "@/lib/repeatafterme/genPrompt";
import type { AiProvider } from "@/lib/repeatafterme/providers";
import { applyReview, todayIso, hashContent } from "@/lib/repeatafterme/srs";
import { generateMagicKey, sha256Hex, encryptPayload, decryptPayload } from "@/lib/repeatafterme/vault";
import { loadMagicKey, saveMagicKey, clearMagicKey } from "@/lib/repeatafterme/syncSettings";

const SYNC_SALT = "repeatafterme-v1";

export default function Player() {
  const engineRef = useRef<RepetezEngine | null>(null);
  if (!engineRef.current) engineRef.current = new RepetezEngine("en");
  const engine = engineRef.current;

  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const native = snap.settings.nativeLang;
  const target = snap.settings.targetLang;
  const L = LANGS[target]; // target-language config (voice/focuses/etc.)
  const t = getStrings(native); // interface follows the learner's native language

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

  const [dueCount, setDueCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [minutesToday, setMinutesToday] = useState(0);

  const [goToOpen, setGoToOpen] = useState(false);
  const [goToValue, setGoToValue] = useState("");
  const [bookmarkDeckIndex, setBookmarkDeckIndex] = useState<number | null>(null);

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncMagicKey, setSyncMagicKey] = useState<string | null>(null);
  const [syncKeyRevealed, setSyncKeyRevealed] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncRestoreValue, setSyncRestoreValue] = useState("");

  function refreshSavedDecks() {
    listDecks().then(setSavedDecks);
  }
  function refreshDueCount() {
    listDueSrsRecords(native, target, todayIso()).then((items) => setDueCount(items.length));
  }
  function refreshStats() {
    getActivityLog().then((log) => {
      setStreak(computeStreak(log));
      setMinutesToday(getTodayMinutes(log));
    });
  }
  function refreshBookmark() {
    const current = engine.getCurrentDeck();
    getBookmark(hashContent(current.pairs)).then((b) => setBookmarkDeckIndex(b ? b.deckIndex : null));
  }
  function handleGoTo() {
    const n = parseInt(goToValue, 10);
    if (!Number.isNaN(n)) engine.goToPosition(n);
    setGoToValue("");
    setGoToOpen(false);
  }
  async function handleSetBookmark() {
    const current = engine.getCurrentDeck();
    const deckIndex = engine.getCurrentDeckIndex();
    await saveBookmark(hashContent(current.pairs), deckIndex);
    setBookmarkDeckIndex(deckIndex);
    engine.setStatus(t.statusBookmarkSet(snap.pos + 1));
  }
  function handleGoToBookmark() {
    if (bookmarkDeckIndex !== null) engine.goToDeckIndex(bookmarkDeckIndex);
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
    engine.setStatus(next.apiKey ? t.statusAiSettingsSaved : t.statusAiSettingsSavedNoKey);
  }
  function handleForgetKey() {
    const next: AiSettings = { provider: aiDraftProvider, apiKey: "" };
    saveAiSettings(next);
    setAiSettings(next);
    setAiDraftApiKey("");
    engine.setStatus(t.statusKeyForgotten);
  }

  async function handleSyncNow(keyOverride?: string) {
    const key = keyOverride ?? syncMagicKey;
    if (!key) return;
    setSyncBusy(true);
    try {
      const [lookupHash, payload] = await Promise.all([sha256Hex(key), exportSyncPayload()]);
      const encrypted = await encryptPayload(key, payload, SYNC_SALT);
      const res = await fetch("/api/repeatafterme/save-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupHash, ...encrypted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      engine.setStatus(t.statusSyncSaved);
    } catch (err) {
      engine.setStatus(t.statusSyncFailed(String((err as Error)?.message || err)), true);
    } finally {
      setSyncBusy(false);
    }
  }
  async function handleGenerateKey() {
    const key = generateMagicKey();
    saveMagicKey(key);
    setSyncMagicKey(key);
    setSyncKeyRevealed(true); // shown in the clear right away — the whole point is to write it down
    await handleSyncNow(key);
  }
  function handleStopSync() {
    clearMagicKey();
    setSyncMagicKey(null);
    setSyncKeyRevealed(false);
    engine.setStatus(t.statusSyncStopped);
  }
  async function handleCopyKey() {
    if (!syncMagicKey) return;
    try {
      await navigator.clipboard.writeText(syncMagicKey);
      engine.setStatus(t.statusSyncCopied);
    } catch {
      // Clipboard API can be denied (permissions, non-HTTPS, etc.) — fall back to
      // just revealing the key so the user can select-and-copy manually.
      setSyncKeyRevealed(true);
    }
  }
  async function handleRestore() {
    const key = syncRestoreValue.trim();
    if (!key) {
      engine.setStatus(t.statusSyncNeedsKey, true);
      return;
    }
    setSyncBusy(true);
    try {
      const lookupHash = await sha256Hex(key);
      const res = await fetch("/api/repeatafterme/load-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const payload = await decryptPayload<SyncPayload>(key, data, SYNC_SALT);
      await restoreSyncPayload(payload);
      saveMagicKey(key);
      setSyncMagicKey(key);
      setSyncRestoreValue("");
      const restoredSettings = await getSettings();
      engine.hydrate({ settings: restoredSettings });
      refreshSavedDecks();
      refreshDueCount();
      engine.setStatus(t.statusSyncRestored);
    } catch (err) {
      engine.setStatus(t.statusSyncFailed(String((err as Error)?.message || err)), true);
    } finally {
      setSyncBusy(false);
    }
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
      refreshBookmark();
    };
    engine.onTestComplete = (result) => {
      void addScore({ ...result, date: new Date().toISOString() });
      refreshDueCount();
    };
    engine.onItemReviewed = (info) => {
      void (async () => {
        const existing = await getSrsRecord(info.itemKey);
        const next = applyReview(existing, info.correct);
        await saveSrsRecord({ itemKey: info.itemKey, deckLabel: info.deckLabel, nativeLang: info.nativeLang, targetLang: info.targetLang, pair: info.pair, ...next });
      })();
    };
    engine.onSessionTime = (seconds) => {
      void recordActivity(seconds).then(refreshStats);
    };
    engine.onPositionChange = (deckIndex) => {
      const current = engine.getCurrentDeck();
      void saveLastPosition(hashContent(current.pairs), deckIndex);
    };

    // Resume where you left off: restore persisted settings + last-used deck +
    // position (if it still matches this deck's content), then load the saved-deck
    // library list. Silent — hydrate() doesn't re-trigger a save.
    Promise.all([getSettings(), getLastDeck(), getLastPosition()]).then(([settings, lastDeck, lastPos]) => {
      if (settings || lastDeck) {
        const deckIndex = lastDeck && lastPos && lastPos.deckKey === hashContent(lastDeck.pairs) ? lastPos.deckIndex : undefined;
        engine.hydrate({ settings, deck: lastDeck, deckIndex });
      }
      refreshBookmark();
    });
    refreshSavedDecks();
    refreshStats();
    setAiSettings(loadAiSettings());
    setSyncMagicKey(loadMagicKey());

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Due count is scoped to the current native/target pairing (see db.ts's
  // listDueSrsRecords) — recompute whenever either changes, including the initial
  // hydrate-from-IndexedDB update after mount.
  useEffect(() => {
    refreshDueCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, target]);

  const good = snap.results.filter(Boolean).length;
  const bad = snap.results.length - good;

  // Grammar-focus values are target-language-specific (LANGS[target].focuses) — clear
  // a stale selection when the target changes so it doesn't silently no-op.
  useEffect(() => {
    setGenFocus("");
  }, [target]);

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
    a.download = `${LANGS[native].short.toLowerCase()}-${L.name.toLowerCase()}-deck.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openSaveBox() {
    setSaveName(engine.getCurrentDeck().label);
    setSaveBoxOpen(true);
  }
  async function handleSaveCurrent() {
    const current = engine.getCurrentDeck();
    const label = saveName.trim() || current.label;
    await saveDeckToLibrary({ label, nativeLang: current.nativeLang, targetLang: current.targetLang, pairs: current.pairs });
    refreshSavedDecks();
    setSaveBoxOpen(false);
    engine.setStatus(t.statusSavedDeck(label));
  }
  function handleLoadSaved(deck: SavedDeck) {
    engine.loadSavedDeck(deck.pairs, deck.label, deck.nativeLang, deck.targetLang);
  }
  async function handleStartDueQueue() {
    const items = await listDueSrsRecords(native, target, todayIso());
    if (!items.length) {
      engine.setStatus(t.statusNothingDue);
      return;
    }
    engine.loadDueQueue(items, t.dueQueueLabel(items.length));
  }
  async function handleDeleteSaved(id: string) {
    await deleteDeckFromLibrary(id);
    refreshSavedDecks();
  }
  async function handleGenerate() {
    const focusLabel = genFocus ? L.focuses.find((f) => f[1] === genFocus)?.[0] ?? "" : "";
    const { prompt, deckName } = buildDeckGenPrompt({
      native,
      target,
      genType,
      level: genLevel,
      count: genCount,
      topic: genTopic,
      focus: genFocus,
      focusLabel,
    });
    engine.setStatus(t.statusGenerating(deckName));
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
      if (!rows.length) throw new Error(t.statusGenerationEmptyResponse);
      engine.loadDeck(rows, "AI: " + deckName);
      setGenOpen(false);
    } catch (err) {
      engine.setStatus(t.statusGenerationFailed(String((err as Error)?.message || err)), true);
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
        <span className="deck-label">
          <Link href="/repeatafterme/ecoutez" className="hint" style={{ marginRight: 10 }}>
            {t.ecoutezNavLink}
          </Link>
          {snap.deckLabel}
        </span>
      </header>

      <main>
        {(streak > 0 || minutesToday > 0) && (
          <div className="hint" style={{ marginBottom: 8 }}>
            {streak > 0 && t.statsStreak(streak)}
            {streak > 0 && minutesToday > 0 && " · "}
            {minutesToday > 0 && t.statsMinutesToday(minutesToday)}
          </div>
        )}
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
          <div className={"fr-line" + (snap.revealAnswer ? "" : " hidden-answer")}>{snap.answerText || " "}</div>

          <div className={"markrow" + (snap.markVisible ? " show" : "")}>
            <button className="mark good" onClick={() => engine.markKnew()}>{t.knewIt}</button>
            <button className="mark bad" onClick={() => engine.markMissed()}>{t.missedIt}</button>
          </div>
          <div className={"summaryrow" + (snap.summaryVisible ? " show" : "")}>
            {snap.missedCount > 0 && (
              <button className="mark bad" onClick={() => engine.practiseMisses()}>
                {t.practiseMisses(snap.missedCount)}
              </button>
            )}
            <button className="mark good" onClick={() => engine.restartTest()}>{t.newTest}</button>
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
            <label>{t.nativeLanguage}</label>
            <div className="seg">
              {LANG_ORDER.map((code) => (
                <button key={code} className={native === code ? "on" : ""} onClick={() => native !== code && engine.setNativeLang(code)}>
                  {LANGS[code].short}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <label>{t.language}</label>
            <div className="seg">
              {availableTargets(native).map((code) => (
                <button key={code} className={target === code ? "on" : ""} onClick={() => target !== code && engine.setTargetLang(code)}>
                  {LANGS[code].short}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <label>
              {t.mode}<span className="hint">{t.modeHint}</span>
            </label>
            <div className="seg">
              <button className={snap.settings.mode === "drill" ? "on" : ""} onClick={() => engine.setMode("drill")}>{t.drill}</button>
              <button className={snap.settings.mode === "test" ? "on" : ""} onClick={() => engine.setMode("test")}>{t.test}</button>
            </div>
          </div>
          {snap.settings.mode === "drill" && (
            <div className="row">
              <label>
                {t.autoplay}<span className="hint">{t.autoplayHint}</span>
              </label>
              <Toggle on={snap.settings.autoplay} onClick={() => engine.toggleAutoplay()} />
            </div>
          )}
          <div className="row">
            <label>
              {t.thinkingTime}<span className="hint">{t.thinkingTimeHint}</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={0.5} max={3} step={0.25} value={snap.settings.pause} onChange={(e) => engine.setPause(+e.target.value)} />
              <span className="val">{snap.settings.pause}×</span>
            </div>
          </div>
          <div className="row">
            <label>{t.speechSpeed}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={0.6} max={1.2} step={0.05} value={snap.settings.rate} onChange={(e) => engine.setRate(+e.target.value)} />
              <span className="val">{snap.settings.rate}×</span>
            </div>
          </div>
          <div className="row">
            <label>{t.direction}</label>
            <div className="seg">
              <button className={snap.settings.dir === "EF" ? "on" : ""} onClick={() => engine.setDir("EF")}>
                {LANGS[native].short} → {LANGS[target].short}
              </button>
              <button className={snap.settings.dir === "FE" ? "on" : ""} onClick={() => engine.setDir("FE")}>
                {LANGS[target].short} → {LANGS[native].short}
              </button>
            </div>
          </div>
          <div className="row">
            <label>{t.shuffle}</label>
            <Toggle on={snap.settings.shuffle} onClick={() => engine.toggleShuffle()} />
          </div>
          <div className="row">
            <label>{t.loopDeck}</label>
            <Toggle on={snap.settings.loop} onClick={() => engine.toggleLoop()} />
          </div>
          <div className="row">
            <label>
              {t.showText}<span className="hint">{t.showTextHint}</span>
            </label>
            <Toggle on={snap.settings.showText} onClick={() => engine.toggleShowText()} />
          </div>
        </div>

        {dueCount > 0 && (
          <div className="deck-actions">
            <button className="chip primary" onClick={handleStartDueQueue}>{t.dueToday(dueCount)}</button>
          </div>
        )}

        {snap.settings.mode === "drill" && (
          <>
            <div className="deck-actions">
              <button className="chip" onClick={() => setGoToOpen((v) => !v)}>{t.goToCard}</button>
              <button className="chip" onClick={handleSetBookmark}>{t.bookmarkSet}</button>
              {bookmarkDeckIndex !== null && (
                <button className="chip" onClick={handleGoToBookmark}>{t.bookmarkGo(snap.order.indexOf(bookmarkDeckIndex) + 1)}</button>
              )}
            </div>
            <div className={"paste-box" + (goToOpen ? " open" : "")}>
              <div className="gen-row">
                <input
                  type="number"
                  min={1}
                  max={snap.order.length}
                  value={goToValue}
                  onChange={(e) => setGoToValue(e.target.value)}
                  placeholder={t.goToCardPlaceholder}
                  style={{ width: 80 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleGoTo();
                  }}
                />
                <button className="chip primary" onClick={handleGoTo}>{t.goToBtn}</button>
                <button className="chip" onClick={() => setGoToOpen(false)}>{t.cancel}</button>
              </div>
            </div>
          </>
        )}

        <h2>{t.deckHeading}</h2>
        <div className="deck-actions">
          <button className="chip" onClick={() => fileInputRef.current?.click()}>{t.uploadCsv}</button>
          <button className="chip" onClick={() => setPasteOpen((v) => !v)}>{t.pastePhrases}</button>
          <button className="chip" onClick={openAiSettings}>{t.aiSettingsBtn}</button>
          <button
            className="chip primary"
            onClick={() => setGenOpen((v) => !v)}
            disabled={!aiSettings.apiKey.trim()}
            title={aiSettings.apiKey.trim() ? undefined : t.generateDisabledTitle}
          >
            {t.generateWithAi}
          </button>
          <button className="chip" onClick={handleDownload}>{t.downloadDeck}</button>
          <button className="chip" onClick={openSaveBox}>{t.saveCurrentDeck}</button>
        </div>
        <input ref={fileInputRef} id="csvfile" type="file" accept=".csv,.txt,.tsv" onChange={handleFile} />

        <div className={"paste-box" + (pasteOpen ? " open" : "")}>
          <textarea
            placeholder={t.pasteBoxPlaceholder}
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
              {t.loadPhrases}
            </button>
            <button className="chip" onClick={() => setPasteOpen(false)}>{t.cancel}</button>
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
            placeholder={t.aiKeyPlaceholder}
          />
          <div className="gen-row">
            <button className="chip primary" onClick={handleSaveAiSettings}>{t.save}</button>
            <button className="chip" onClick={handleForgetKey}>{t.forgetKey}</button>
            <button className="chip" onClick={() => setAiSettingsOpen(false)}>{t.cancel}</button>
          </div>
        </div>

        <div className={"gen-box" + (genOpen ? " open" : "")}>
          <select value={genFocus} onChange={(e) => setGenFocus(e.target.value)}>
            <option value="">{t.noGrammarFocus}</option>
            {L.focuses.map(([label, val]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
            placeholder={t.topicPlaceholder}
          />
          <div className="gen-row">
            <select value={genType} onChange={(e) => setGenType(e.target.value as "phrases" | "words")}>
              <option value="phrases">{t.phrasesOption}</option>
              <option value="words">{t.singleWordsOption}</option>
            </select>
            <select value={genLevel} onChange={(e) => setGenLevel(e.target.value as "beginner" | "intermediate" | "advanced")}>
              <option value="beginner">{t.beginner}</option>
              <option value="intermediate">{t.intermediate}</option>
              <option value="advanced">{t.advanced}</option>
            </select>
            <select value={genCount} onChange={(e) => setGenCount(e.target.value)}>
              <option value="10">{t.countOption(10)}</option>
              <option value="20">{t.countOption(20)}</option>
              <option value="30">{t.countOption(30)}</option>
            </select>
            <button className="chip primary" onClick={handleGenerate} disabled={genLoading}>
              {genLoading ? t.generating : t.generate}
            </button>
          </div>
        </div>

        <div className={"paste-box" + (saveBoxOpen ? " open" : "")}>
          <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={t.saveDeckNamePlaceholder} />
          <div className="gen-row">
            <button className="chip primary" onClick={handleSaveCurrent}>{t.save}</button>
            <button className="chip" onClick={() => setSaveBoxOpen(false)}>{t.cancel}</button>
          </div>
        </div>

        <div className={"status" + (snap.statusErr ? " err" : "")}>{snap.status}</div>

        {savedDecks.length > 0 && (
          <>
            <h2>{t.yourDecks}</h2>
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
                        {LANGS[deck.nativeLang].short} → {LANGS[deck.targetLang].short} · {deck.pairs.length}
                      </span>
                    </label>
                  )}
                  <div className="gen-row">
                    <button className="chip primary" onClick={() => handleLoadSaved(deck)}>{t.load}</button>
                    <button className="chip" onClick={() => handleDeleteSaved(deck.id)}>{t.delete}</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2>{t.saveAndSync}</h2>
        <div className="deck-actions">
          <button className="chip" onClick={() => setSyncOpen((v) => !v)}>{t.saveAndSync}</button>
        </div>
        <div className={"paste-box" + (syncOpen ? " open" : "")}>
          {!syncMagicKey ? (
            <>
              <div className="hint">{t.syncIntro}</div>
              <div className="gen-row">
                <button className="chip primary" onClick={handleGenerateKey} disabled={syncBusy}>{t.syncGenerateKey}</button>
              </div>
            </>
          ) : (
            <>
              <label>{t.syncYourKey}</label>
              <div className="gen-row">
                <input
                  type={syncKeyRevealed ? "text" : "password"}
                  readOnly
                  value={syncMagicKey}
                  onFocus={(e) => e.target.select()}
                  style={{ flex: 1 }}
                />
                <button className="chip" onClick={() => setSyncKeyRevealed((v) => !v)}>{syncKeyRevealed ? t.syncHide : t.syncReveal}</button>
                <button className="chip" onClick={handleCopyKey}>{t.syncCopy}</button>
              </div>
              <div className="hint">{t.syncKeyHint}</div>
              <div className="gen-row">
                <button className="chip primary" onClick={() => handleSyncNow()} disabled={syncBusy}>{t.syncNow}</button>
                <button className="chip" onClick={handleStopSync} disabled={syncBusy}>{t.syncStop}</button>
              </div>
            </>
          )}
          <label>{t.syncRestoreLabel}</label>
          <input
            type="text"
            value={syncRestoreValue}
            onChange={(e) => setSyncRestoreValue(e.target.value)}
            placeholder={t.syncRestorePlaceholder}
          />
          <div className="gen-row">
            <button className="chip primary" onClick={handleRestore} disabled={syncBusy}>{t.syncRestoreBtn}</button>
            <button className="chip" onClick={() => setSyncOpen(false)}>{t.cancel}</button>
          </div>
        </div>
      </main>

      <footer>{t.footer}</footer>
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
