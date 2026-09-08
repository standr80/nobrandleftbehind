"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/repeatafterme/AppNav";
import IntroCard from "@/components/repeatafterme/IntroCard";
import { LANGS, type LangCode } from "@/lib/repeatafterme/langs";
import { getStrings } from "@/lib/repeatafterme/i18n";
import { getSettings, listDecks, saveDeckToLibrary } from "@/lib/repeatafterme/db";
import {
  LIBRARIES,
  PODCAST_LIBRARIES,
  libraryStableId,
  type LibraryManifest,
  type LibraryDeckMeta,
  type PodcastManifest,
  type PodcastEpisodeMeta,
} from "@/lib/repeatafterme/libraryData";
import { buildLibraryTree, type LibraryTreeNode } from "@/lib/repeatafterme/libraryTree";

type Strings = ReturnType<typeof getStrings>;

/** A browsable collection in the library — a deck library or a podcast feed. */
interface Collection {
  id: string;
  title: string;
  kind: "decks" | "podcasts";
  subtitle: string;
}

export default function LibraryBrowser() {
  const [native, setNative] = useState<LangCode>("en");
  const t = getStrings(native);

  const availableTargetLangs = Array.from(new Set(LIBRARIES.map((l) => l.targetLang)));
  const [targetLang, setTargetLang] = useState<LangCode>(availableTargetLangs[0] ?? "fr");
  const librariesForLang = LIBRARIES.filter((l) => l.targetLang === targetLang);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(librariesForLang[0]?.id ?? null);

  const [manifest, setManifest] = useState<LibraryManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestError, setManifestError] = useState(false);

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");

  const podcastLibrary = useMemo(() => PODCAST_LIBRARIES.find((l) => l.targetLang === targetLang) ?? null, [targetLang]);
  const [podcasts, setPodcasts] = useState<PodcastManifest | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      if (s) setNative(s.nativeLang);
    });
    refreshAdded();
  }, []);

  function refreshAdded() {
    listDecks().then((decks) => setAddedIds(new Set(decks.map((d) => d.id))));
  }

  useEffect(() => {
    const meta = LIBRARIES.find((l) => l.id === activeCollectionId);
    if (!meta) {
      setManifest(null);
      return;
    }
    setManifestLoading(true);
    setManifestError(false);
    fetch(meta.manifestUrl)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data: LibraryManifest) => setManifest(data))
      .catch(() => setManifestError(true))
      .finally(() => setManifestLoading(false));
  }, [activeCollectionId]);

  useEffect(() => {
    if (!podcastLibrary) {
      setPodcasts(null);
      return;
    }
    let cancelled = false;
    fetch(podcastLibrary.manifestUrl)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data: PodcastManifest) => !cancelled && setPodcasts(data))
      // A missing or broken podcast manifest shouldn't take the deck library down
      // with it — the section just doesn't render.
      .catch(() => !cancelled && setPodcasts(null));
    return () => {
      cancelled = true;
    };
  }, [podcastLibrary]);

  async function handleAddEpisode(libraryId: string, episode: PodcastEpisodeMeta) {
    await saveDeckToLibrary({
      id: libraryStableId(libraryId, episode.id),
      label: episode.title,
      nativeLang: episode.nativeLang,
      targetLang: episode.targetLang,
      pairs: episode.pairs,
      sourceUrl: episode.url,
    });
    refreshAdded();
    setStatus(t.statusLibraryDeckAdded(episode.title));
  }

  async function handleAdd(libraryId: string, deck: LibraryDeckMeta) {
    await saveDeckToLibrary({
      id: libraryStableId(libraryId, deck.id),
      label: deck.label,
      nativeLang: deck.nativeLang,
      targetLang: deck.targetLang,
      pairs: deck.pairs,
    });
    refreshAdded();
    setStatus(t.statusLibraryDeckAdded(deck.label));
  }

  // Deck libraries and podcasts presented as one list of collections. Podcasts used
  // to sit in their own section between the chooser and the tree it controls, which
  // split the browser in two; as a peer it's chosen the same way as everything else.
  // Episode counts come from the fetched manifest rather than a hand-maintained
  // number on PODCAST_LIBRARIES, so they can't drift as episodes are added.
  const collections = useMemo(() => {
    const list: Collection[] = LIBRARIES.filter((l) => l.targetLang === targetLang).map((l) => ({
      id: l.id,
      title: l.title,
      kind: "decks",
      subtitle: `${t.libraryDeckCount(l.deckCount)} · ${t.libraryWordCount(l.wordCount)}`,
    }));
    if (podcastLibrary) {
      const episodes = podcasts?.episodes ?? [];
      list.push({
        id: podcastLibrary.id,
        title: podcastLibrary.title,
        kind: "podcasts",
        subtitle: episodes.length
          ? `${t.podcastEpisodeCount(episodes.length)} · ${t.libraryWordCount(episodes.reduce((n, e) => n + e.pairs.length, 0))}`
          : "",
      });
    }
    return list;
  }, [targetLang, podcastLibrary, podcasts, t]);

  const showingPodcasts = collections.find((c) => c.id === activeCollectionId)?.kind === "podcasts";
  const tree = manifest ? buildLibraryTree(manifest.decks) : [];

  return (
    <div className="repeatafterme">
      <div className="tricolore"><span></span><span></span><span></span></div>
      <header>
        <h1>
          {t.libraryNavLink}
          <em>.</em>
        </h1>
        <span className="deck-label">
          {showingPodcasts
            ? podcasts
              ? t.podcastEpisodeCount(podcasts.episodes.length)
              : ""
            : manifest
              ? t.libraryDeckCount(manifest.decks.length)
              : ""}
        </span>
      </header>

      <AppNav native={native} />

      <main>
        <IntroCard id="library" native={native}>
          <p>{t.libraryIntro}</p>
        </IntroCard>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="row">
            <label>{t.libraryLanguageLabel}</label>
            <div className="seg">
              {availableTargetLangs.map((lc) => (
                <button
                  key={lc}
                  className={targetLang === lc ? "on" : ""}
                  onClick={() => {
                    setTargetLang(lc);
                    const first = LIBRARIES.find((l) => l.targetLang === lc);
                    setActiveCollectionId(first?.id ?? null);
                  }}
                >
                  {LANGS[lc].name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {collections.length > 1 && (
          <div className="panel" style={{ marginTop: 10 }}>
            {collections.map((c) => (
              <div className="row" key={c.id}>
                <label onClick={() => setActiveCollectionId(c.id)} style={{ cursor: "pointer" }}>
                  {c.title}
                  {c.subtitle && <span className="hint">{c.subtitle}</span>}
                </label>
                <button
                  className={"chip" + (activeCollectionId === c.id ? " primary" : "")}
                  onClick={() => setActiveCollectionId(c.id)}
                >
                  {t.libraryBrowseBtn}
                </button>
              </div>
            ))}
          </div>
        )}

        {showingPodcasts && podcasts && podcasts.episodes.length > 0 && (
          <>
            <h2>{podcasts.title}</h2>
            <div className="hint" style={{ margin: "0 4px 8px" }}>{t.podcastsIntro}</div>
            <div className="lib-tree">
              {podcasts.episodes.map((ep) => {
                const added = addedIds.has(libraryStableId(podcasts.id, ep.id));
                return (
                  <div className="podcast-row" key={ep.id}>
                    <div className="podcast-meta">
                      <span className="deck-name">{ep.title}</span>
                      <span className="grp-count">
                        {ep.show ? `${ep.show} · ` : ""}
                        {t.libraryWordCount(ep.pairs.length)}
                      </span>
                    </div>
                    <div className="podcast-actions">
                      <a className="chip" href={ep.url} target="_blank" rel="noopener noreferrer">
                        {t.podcastListen}
                      </a>
                      <button
                        className={"chip" + (added ? "" : " primary")}
                        onClick={() => handleAddEpisode(podcasts.id, ep)}
                      >
                        {added ? t.libraryAddedBtn : t.libraryAddBtn}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!showingPodcasts && manifestLoading && <div className="status">{t.libraryLoading}</div>}
        {!showingPodcasts && manifestError && <div className="status err">{t.libraryLoadFailed}</div>}

        {!showingPodcasts && manifest && (
          <>
            <h2>{manifest.title}</h2>
            <div className="lib-tree">
              {tree.map((node) => (
                <LibraryTreeGroup key={node.path} node={node} libraryId={manifest.id} addedIds={addedIds} onAdd={handleAdd} t={t} />
              ))}
            </div>
          </>
        )}

        <div className="status">{status}</div>
      </main>
    </div>
  );
}

function LibraryTreeGroup({
  node,
  libraryId,
  addedIds,
  onAdd,
  t,
}: {
  node: LibraryTreeNode;
  libraryId: string;
  addedIds: Set<string>;
  onAdd: (libraryId: string, deck: LibraryDeckMeta) => void;
  t: Strings;
}) {
  if (node.children.length === 0 && node.deck) {
    return <LibraryDeckRow deck={node.deck} libraryId={libraryId} addedIds={addedIds} onAdd={onAdd} t={t} name={node.name} />;
  }

  return (
    <details className="lib-group">
      <summary>
        <span className="grp-name">{node.name}</span>
        <span className="grp-count">{t.libraryWordCount(node.total)}</span>
      </summary>
      <div className="lib-group-body">
        {node.deck && (
          <LibraryDeckRow deck={node.deck} libraryId={libraryId} addedIds={addedIds} onAdd={onAdd} t={t} name={t.libraryMixedGroup} />
        )}
        {node.children.map((child) => (
          <LibraryTreeGroup key={child.path} node={child} libraryId={libraryId} addedIds={addedIds} onAdd={onAdd} t={t} />
        ))}
      </div>
    </details>
  );
}

function LibraryDeckRow({
  deck,
  libraryId,
  addedIds,
  onAdd,
  t,
  name,
}: {
  deck: LibraryDeckMeta;
  libraryId: string;
  addedIds: Set<string>;
  onAdd: (libraryId: string, deck: LibraryDeckMeta) => void;
  t: Strings;
  name: string;
}) {
  const added = addedIds.has(libraryStableId(libraryId, deck.id));
  return (
    <div className="lib-deck-row">
      <span>
        <span className="deck-name">{name}</span>
        <span className="grp-count">{t.libraryWordCount(deck.pairs.length)}</span>
      </span>
      <button className={"chip" + (added ? "" : " primary")} onClick={() => onAdd(libraryId, deck)}>
        {added ? t.libraryAddedBtn : t.libraryAddBtn}
      </button>
    </div>
  );
}
