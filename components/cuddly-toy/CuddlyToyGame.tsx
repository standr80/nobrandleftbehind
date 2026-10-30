'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Belt, BeltItem, Decoy } from '@/lib/bruce/types'
import { createSounds, type Sounds } from './sounds'

type LevelId = 'gentle' | 'classic'

const LEVELS: Record<LevelId, { label: string; blurb: string; items: number; secondsPerItem: number; recallSeconds: number | null }> = {
  gentle: { label: 'Gentle', blurb: '8 prizes, nice and slow, no clock', items: 8, secondsPerItem: 4, recallSeconds: null },
  classic: { label: 'Classic', blurb: '12 prizes, 60 seconds to remember', items: 12, secondsPerItem: 3, recallSeconds: 60 },
}

const MEMORY_TIPS = [
  'Try making up a little story as the prizes go by. "The teapot fell on the cuddly toy…"',
  'Picture each prize in a room of your house: the toaster in the hall, the radio on the stairs.',
  'Say each prize out loud as it goes past. Hearing it helps it stick.',
  'Try grouping the prizes as they arrive: things to eat, things to drink, things for the table.',
]

type Phase = 'start' | 'tip' | 'watch' | 'stopped' | 'recall' | 'results'
type Tile = (BeltItem | Decoy) & { onBelt: boolean }

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** A fresh round: the cuddly toy plus random prizes, and an equal number of decoys. */
function dealRound(belt: Belt, count: number) {
  const cuddly = belt.items.find(i => i.isCuddlyToy)
  const others = shuffle(belt.items.filter(i => !i.isCuddlyToy)).slice(0, cuddly ? count - 1 : count)
  const items = shuffle(cuddly ? [...others, cuddly] : others)
  const decoys = shuffle(belt.decoys).slice(0, count)
  const tiles: Tile[] = shuffle([
    ...items.map(i => ({ ...i, onBelt: true })),
    ...decoys.map(d => ({ ...d, onBelt: false })),
  ])
  return { items, tiles }
}

function readBest(key: string): number | null {
  try {
    const v = window.localStorage.getItem(key)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

function writeBest(key: string, score: number) {
  try {
    window.localStorage.setItem(key, String(score))
  } catch {
    // Storage can be blocked in in-app browsers; best score is a nicety only.
  }
}

export default function CuddlyToyGame({ belt, brandName, endLink }: {
  belt: Belt
  brandName: string
  endLink?: { label: string; url: string }
}) {
  const [phase, setPhase] = useState<Phase>('start')
  const [levelId, setLevelId] = useState<LevelId>('gentle')
  const [round, setRound] = useState<ReturnType<typeof dealRound> | null>(null)
  const [tip, setTip] = useState(MEMORY_TIPS[0])
  const [beltIndex, setBeltIndex] = useState(0)
  const [won, setWon] = useState<string[]>([])
  const [missTap, setMissTap] = useState<{ id: string; n: number } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [best, setBest] = useState<number | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const soundsRef = useRef<Sounds | null>(null)

  const level = LEVELS[levelId]
  const bestKey = `cuddly-toy:best:${belt.slug}:${levelId}`

  // A ref, so toggling sound mid-belt doesn't restart the current prize's timer.
  const mutedRef = useRef(false)
  mutedRef.current = muted
  const play = useCallback((name: keyof Sounds) => {
    if (!mutedRef.current) soundsRef.current?.[name]()
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [phase])

  function start() {
    // First tap: the only safe moment to unlock audio in in-app browsers.
    if (!soundsRef.current) soundsRef.current = createSounds()
    setRound(dealRound(belt, level.items))
    setTip(MEMORY_TIPS[Math.floor(Math.random() * MEMORY_TIPS.length)])
    setBeltIndex(0)
    setWon([])
    setMissTap(null)
    setShareNote(null)
    setPhase('tip')
  }

  // The belt: advance one prize every secondsPerItem, then stop.
  useEffect(() => {
    if (phase !== 'watch' || !round) return
    play('ding')
    const t = window.setTimeout(() => {
      if (beltIndex + 1 < round.items.length) setBeltIndex(beltIndex + 1)
      else setPhase('stopped')
    }, level.secondsPerItem * 1000)
    return () => window.clearTimeout(t)
  }, [phase, beltIndex, round, level.secondsPerItem, play])

  const finish = useCallback(() => setPhase('results'), [])

  // Recall clock (Classic only).
  useEffect(() => {
    if (phase !== 'recall' || secondsLeft === null) return
    if (secondsLeft <= 0) {
      finish()
      return
    }
    const t = window.setTimeout(() => setSecondsLeft(s => (s === null ? null : s - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [phase, secondsLeft, finish])

  // Results: fanfare and best score, once per round.
  useEffect(() => {
    if (phase !== 'results') return
    play('fanfare')
    const previous = readBest(bestKey)
    setNewBest(previous !== null && won.length > previous)
    if (previous === null || won.length > previous) writeBest(bestKey, won.length)
    setBest(previous === null ? won.length : Math.max(previous, won.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function startRecall() {
    setSecondsLeft(level.recallSeconds)
    setPhase('recall')
  }

  function tapTile(tile: Tile) {
    if (won.includes(tile.id)) return
    if (tile.onBelt) {
      play('win')
      const next = [...won, tile.id]
      setWon(next)
      if (round && next.length === round.items.length) window.setTimeout(finish, 700)
    } else {
      play('nope')
      setMissTap(m => ({ id: tile.id, n: (m?.n ?? 0) + 1 }))
    }
  }

  async function share() {
    if (!round) return
    const url = window.location.origin + window.location.pathname
    const cuddly = round.items.some(i => i.isCuddlyToy && won.includes(i.id))
    const text = `I remembered ${won.length} of ${round.items.length} prizes on Cuddly Toy!${cuddly ? ' 🧸' : ''} Can you beat me?`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cuddly Toy!', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setShareNote('Copied! Paste it into a post or a message.')
    } catch {
      setShareNote(`Share this link: ${url}`)
    }
  }

  const header = (
    <div className="ct-topbar">
      <span className="ct-wordmark">🧸 Cuddly Toy!</span>
      <button
        type="button"
        className="ct-mute"
        onClick={() => setMuted(m => !m)}
        aria-pressed={muted}
      >
        {muted ? '🔇 Sound off' : '🔊 Sound on'}
      </button>
    </div>
  )

  const footer = (
    <footer className="ct-footer">
      <p>Brought to you by {brandName}</p>
      <p className="ct-smallprint">A fun memory game inspired by the classic TV conveyor belt.</p>
    </footer>
  )

  if (phase === 'start') {
    return (
      <main className="ct-root">
        {header}
        <section className="ct-panel">
          <p className="ct-eyebrow">This week&apos;s belt</p>
          <h1 className="ct-title">{belt.title}</h1>
          <ol className="ct-steps">
            <li><span>1</span>Watch the prizes go by on the conveyor belt.</li>
            <li><span>2</span>Tap the ones you remember.</li>
            <li><span>3</span>Everything you remember, you win!</li>
          </ol>
          <fieldset className="ct-levels">
            <legend>Choose your level</legend>
            {(Object.keys(LEVELS) as LevelId[]).map(id => (
              <label key={id} className={`ct-level ${levelId === id ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="level"
                  value={id}
                  checked={levelId === id}
                  onChange={() => setLevelId(id)}
                />
                <strong>{LEVELS[id].label}</strong>
                <span>{LEVELS[id].blurb}</span>
              </label>
            ))}
          </fieldset>
          <button type="button" className="ct-button" onClick={start}>Play</button>
        </section>
        {footer}
      </main>
    )
  }

  if (phase === 'tip') {
    return (
      <main className="ct-root">
        {header}
        <section className="ct-panel ct-center">
          <p className="ct-eyebrow">Memory tip</p>
          <p className="ct-tip">{tip}</p>
          <button type="button" className="ct-button" onClick={() => setPhase('watch')}>Start the belt</button>
        </section>
      </main>
    )
  }

  if (phase === 'watch' && round) {
    const item = round.items[beltIndex]
    return (
      <main className="ct-root">
        {header}
        <section className="ct-panel ct-center" aria-live="polite">
          <p className="ct-eyebrow">Prize {beltIndex + 1} of {round.items.length}</p>
          <div className="ct-belt" style={{ ['--ct-item-ms' as string]: `${level.secondsPerItem * 1000}ms` }}>
            <div key={item.id} className="ct-belt-item">
              <span className="ct-belt-emoji" aria-hidden="true">{item.emoji}</span>
            </div>
            <div className="ct-belt-surface" aria-hidden="true" />
          </div>
          <div key={`label-${item.id}`} className="ct-belt-label">
            <p className="ct-item-name">{item.name}</p>
            <p className="ct-patter">{item.patter}</p>
          </div>
        </section>
      </main>
    )
  }

  if (phase === 'stopped') {
    return (
      <main className="ct-root">
        {header}
        <section className="ct-panel ct-center">
          <p className="ct-big-emoji" aria-hidden="true">🎁</p>
          <h1 className="ct-title">The belt has stopped!</h1>
          <p className="ct-lead">
            Now, which prizes do you remember?
            {level.recallSeconds ? ` You have ${level.recallSeconds} seconds.` : ' Take your time.'}
          </p>
          <button type="button" className="ct-button" onClick={startRecall}>I&apos;m ready</button>
        </section>
      </main>
    )
  }

  if (phase === 'recall' && round) {
    return (
      <main className="ct-root">
        {header}
        <section className="ct-panel">
          <div className="ct-recall-sticky">
            <div className="ct-recall-head">
              <p className="ct-lead">Tap the prizes you saw on the belt.</p>
              <p className="ct-won-count">Won: <strong>{won.length}</strong> of {round.items.length}</p>
            </div>
            {secondsLeft !== null && level.recallSeconds && (
              <div className="ct-clock" role="timer" aria-label={`${secondsLeft} seconds left`}>
                <div className="ct-clock-bar" style={{ width: `${(secondsLeft / level.recallSeconds) * 100}%` }} />
                <span>{secondsLeft}s</span>
              </div>
            )}
          </div>
          <div className="ct-grid">
            {round.tiles.map(tile => {
              const isWon = won.includes(tile.id)
              const isMiss = missTap?.id === tile.id
              return (
                <button
                  key={isMiss ? `${tile.id}-${missTap.n}` : tile.id}
                  type="button"
                  className={`ct-tile ${isWon ? 'is-won' : ''} ${isMiss ? 'is-miss' : ''}`}
                  onClick={() => tapTile(tile)}
                  aria-pressed={isWon}
                >
                  <span className="ct-tile-emoji" aria-hidden="true">{tile.emoji}</span>
                  <span className="ct-tile-name">{tile.name}</span>
                  {isWon && <span className="ct-tile-badge">✓ Won</span>}
                  {isMiss && <span className="ct-tile-note">Not on the belt</span>}
                </button>
              )
            })}
          </div>
          <button type="button" className="ct-button" onClick={finish}>I&apos;ve finished</button>
        </section>
      </main>
    )
  }

  if (phase === 'results' && round) {
    const wonItems = round.items.filter(i => won.includes(i.id))
    const missed = round.items.filter(i => !won.includes(i.id))
    const gotCuddly = wonItems.some(i => i.isCuddlyToy)
    const headline =
      missed.length === 0 ? 'A clean sweep!' :
      wonItems.length >= round.items.length / 2 ? 'What a haul!' :
      'Lovely effort!'
    return (
      <main className="ct-root">
        {header}
        <section className="ct-panel ct-center">
          <p className="ct-big-emoji" aria-hidden="true">🎉</p>
          <h1 className="ct-title">{headline}</h1>
          <p className="ct-score">You remembered <strong>{wonItems.length}</strong> of {round.items.length} prizes</p>
          {gotCuddly && <p className="ct-cuddly-badge">🧸 You got the cuddly toy!</p>}
          {newBest && <p className="ct-best">That&apos;s your best score yet!</p>}
          {!newBest && best !== null && <p className="ct-best-quiet">Your best at {level.label}: {best}</p>}
        </section>
        {wonItems.length > 0 && (
          <section className="ct-panel">
            <h2 className="ct-h2">Your prizes</h2>
            <ul className="ct-prize-list">
              {wonItems.map(i => <li key={i.id}><span aria-hidden="true">{i.emoji}</span>{i.name}</li>)}
            </ul>
          </section>
        )}
        {missed.length > 0 && (
          <section className="ct-panel">
            <h2 className="ct-h2">These got away this time</h2>
            <ul className="ct-prize-list is-missed">
              {missed.map(i => <li key={i.id}><span aria-hidden="true">{i.emoji}</span>{i.name}</li>)}
            </ul>
          </section>
        )}
        <section className="ct-panel ct-actions">
          <button type="button" className="ct-button" onClick={() => setPhase('start')}>Play again</button>
          <button type="button" className="ct-button is-secondary" onClick={share}>Share my score</button>
          {shareNote && <p className="ct-share-note" role="status">{shareNote}</p>}
          {endLink && <a className="ct-end-link" href={endLink.url}>{endLink.label}</a>}
        </section>
        {footer}
      </main>
    )
  }

  return null
}
