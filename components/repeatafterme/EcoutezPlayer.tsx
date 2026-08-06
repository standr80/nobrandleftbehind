"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LANGS, type LangCode } from "@/lib/repeatafterme/langs";
import { getStrings } from "@/lib/repeatafterme/i18n";
import { getSettings, saveDeckToLibrary } from "@/lib/repeatafterme/db";
import { loadAiSettings } from "@/lib/repeatafterme/aiSettings";
import { buildEcoutezPrompt } from "@/lib/repeatafterme/ecoutezPrompt";
import { extractEcoutezPayload, type EcoutezPayload } from "@/lib/repeatafterme/ecoutezParsing";
import { speakText } from "@/lib/repeatafterme/simpleTts";

type Phase = "setup" | "preview" | "listening" | "complete";

export default function EcoutezPlayer() {
  const [native, setNative] = useState<LangCode>("en");
  const [target, setTarget] = useState<LangCode>("fr");
  const t = getStrings(native);

  const [mode, setMode] = useState<"topic" | "paste">("topic");
  const [topic, setTopic] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");

  const [phase, setPhase] = useState<Phase>("setup");
  const [generating, setGenerating] = useState(false);
  const [episode, setEpisode] = useState<EcoutezPayload | null>(null);
  const [pass, setPass] = useState<1 | 2 | null>(null);
  const [status, setStatus] = useState("");
  const [statusErr, setStatusErr] = useState(false);
  const [exported, setExported] = useState(false);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const stopTokenRef = useRef(0);

  useEffect(() => {
    getSettings().then((s) => {
      if (s) {
        setNative(s.nativeLang);
        setTarget(s.targetLang);
      }
    });
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const load = () => (voicesRef.current = window.speechSynthesis.getVoices());
      load();
      window.speechSynthesis.onvoiceschanged = load;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Stop any in-flight playback on unmount — same ghost-audio concern as the drill
  // engine's runToken guard, scaled down for this page's simpler linear flow.
  useEffect(() => {
    return () => {
      stopTokenRef.current++;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function setErr(msg: string) {
    setStatus(msg);
    setStatusErr(true);
  }
  function setOk(msg: string) {
    setStatus(msg);
    setStatusErr(false);
  }

  async function handleGenerate() {
    const ai = loadAiSettings();
    if (!ai.apiKey.trim()) {
      setErr(t.statusEcoutezNeedsKey);
      return;
    }
    setGenerating(true);
    setStatus("");
    try {
      const prompt = buildEcoutezPrompt({ native, target, level, topic, sourceText: mode === "paste" ? pasteText : "" });
      const res = await fetch("/api/repeatafterme/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: ai.provider, apiKey: ai.apiKey, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const payload = extractEcoutezPayload(data.text);
      if (!payload) throw new Error(t.statusGenerationEmptyResponse);
      setEpisode(payload);
      setExported(false);
      setPhase("preview");
    } catch (err) {
      setErr(t.statusEcoutezGenerationFailed(String((err as Error)?.message || err)));
    } finally {
      setGenerating(false);
    }
  }

  async function handlePreviewVocab() {
    if (!episode) return;
    const token = ++stopTokenRef.current;
    for (const [nativeText, targetText] of episode.vocab) {
      if (token !== stopTokenRef.current) return;
      await speakText(targetText, target, 0.9, voicesRef.current);
      if (token !== stopTokenRef.current) return;
      await speakText(nativeText, native, 1, voicesRef.current);
      if (token !== stopTokenRef.current) return;
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  async function handleStartListening() {
    if (!episode) return;
    const token = ++stopTokenRef.current;
    setPhase("listening");
    setPass(1);
    await speakText(episode.article, target, 0.8, voicesRef.current);
    if (token !== stopTokenRef.current) return;
    await new Promise((r) => setTimeout(r, 600));
    if (token !== stopTokenRef.current) return;
    setPass(2);
    await speakText(episode.article, target, 1, voicesRef.current);
    if (token !== stopTokenRef.current) return;
    setPass(null);
    setPhase("complete");
  }

  async function handleExport() {
    if (!episode) return;
    const pairs = [...episode.vocab, ...episode.keyPhrases];
    const label = `Écoutez: ${episode.title}`;
    await saveDeckToLibrary({ label, nativeLang: native, targetLang: target, pairs });
    setExported(true);
    setOk(t.statusEcoutezExported(label));
  }

  function handleNewEpisode() {
    stopTokenRef.current++;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setEpisode(null);
    setExported(false);
    setStatus("");
    setPass(null);
    setPhase("setup");
  }

  return (
    <div className="repeatafterme">
      <div className="tricolore"><span></span><span></span><span></span></div>
      <header>
        <h1>
          {t.ecoutezNavLink}
          <em>.</em>
        </h1>
        <span className="deck-label">
          {LANGS[native].short} → {LANGS[target].short}
        </span>
      </header>

      <main>
        <Link href="/repeatafterme" className="hint" style={{ display: "inline-block", marginBottom: 10 }}>
          {t.ecoutezBackLink}
        </Link>

        <div className="card" style={{ minHeight: "auto", textAlign: "left", alignItems: "stretch" }}>
          <div className="hint">{t.ecoutezIntro}</div>
        </div>

        {phase === "setup" && (
          <>
            <div className="panel">
              <div className="row">
                <label>{t.ecoutezLevelLabel}</label>
                <div className="seg">
                  <button className={level === "beginner" ? "on" : ""} onClick={() => setLevel("beginner")}>{t.beginner}</button>
                  <button className={level === "intermediate" ? "on" : ""} onClick={() => setLevel("intermediate")}>{t.intermediate}</button>
                  <button className={level === "advanced" ? "on" : ""} onClick={() => setLevel("advanced")}>{t.advanced}</button>
                </div>
              </div>
              <div className="row">
                <label>{t.deckHeading}</label>
                <div className="seg">
                  <button className={mode === "topic" ? "on" : ""} onClick={() => setMode("topic")}>{t.ecoutezModeTopic}</button>
                  <button className={mode === "paste" ? "on" : ""} onClick={() => setMode("paste")}>{t.ecoutezModePaste}</button>
                </div>
              </div>
            </div>

            {mode === "topic" ? (
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t.ecoutezTopicPlaceholder}
                style={{ marginTop: 10 }}
              />
            ) : (
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t.ecoutezPastePlaceholder}
                style={{ marginTop: 10, minHeight: 120 }}
              />
            )}

            <div className="deck-actions" style={{ marginTop: 10 }}>
              <button className="chip primary" onClick={handleGenerate} disabled={generating}>
                {generating ? t.ecoutezGenerating : t.ecoutezGenerate}
              </button>
            </div>
          </>
        )}

        {episode && phase !== "setup" && (
          <>
            <h2>{episode.title}</h2>

            {phase === "preview" && (
              <>
                <h2>{t.ecoutezVocabHeading}</h2>
                <div className="panel">
                  {episode.vocab.map(([nativeText, targetText], i) => (
                    <div className="row" key={i}>
                      <span>{targetText}</span>
                      <span className="hint">{nativeText}</span>
                    </div>
                  ))}
                </div>
                <div className="deck-actions" style={{ marginTop: 10 }}>
                  <button className="chip" onClick={handlePreviewVocab}>{t.ecoutezPreviewVocab}</button>
                  <button className="chip primary" onClick={handleStartListening}>{t.ecoutezStartListening}</button>
                </div>
              </>
            )}

            {phase === "listening" && (
              <div className="card">
                <span className="phase-tag speaking">
                  <span className="dot"></span>
                  <span>{pass === 1 ? t.ecoutezPass1 : t.ecoutezPass2}</span>
                </span>
                <div className="en-line">{episode.article}</div>
              </div>
            )}

            {phase === "complete" && (
              <>
                <h2>{t.ecoutezSummaryHeading}</h2>
                <div className="card" style={{ minHeight: "auto", textAlign: "left", alignItems: "stretch" }}>
                  <div className="en-line" style={{ fontSize: 16 }}>{episode.summary}</div>
                </div>

                {episode.questions.length > 0 && (
                  <>
                    <h2>{t.ecoutezQuestionsHeading}</h2>
                    <div className="panel">
                      {episode.questions.map((q, i) => (
                        <div className="row" key={i}>
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {episode.keyPhrases.length > 0 && (
                  <>
                    <h2>{t.ecoutezKeyPhrasesHeading}</h2>
                    <div className="panel">
                      {episode.keyPhrases.map(([nativeText, targetText], i) => (
                        <div className="row" key={i}>
                          <span>{targetText}</span>
                          <span className="hint">{nativeText}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="deck-actions" style={{ marginTop: 10 }}>
                  <button className="chip" onClick={handlePreviewVocab}>{t.ecoutezPreviewVocab}</button>
                  {!exported && (
                    <button className="chip primary" onClick={handleExport}>{t.ecoutezExportDeck}</button>
                  )}
                  {exported && (
                    <Link href="/repeatafterme" className="chip primary">{t.ecoutezGoToDrill}</Link>
                  )}
                  <button className="chip" onClick={handleNewEpisode}>{t.ecoutezNewEpisode}</button>
                </div>
              </>
            )}
          </>
        )}

        <div className={"status" + (statusErr ? " err" : "")}>{status}</div>
      </main>

      <footer>{t.footer}</footer>
    </div>
  );
}
