'use client'

interface Point {
  date: string
  position: number | null
}

/**
 * Tiny inline SVG sparkline of keyword rank over time.
 * Rank is inverted on the Y axis (position 1 = top), and non-ranking
 * snapshots (null / outside top 100) are clamped to the bottom.
 */
export default function RankSparkline({
  history,
  width = 96,
  height = 24,
}: {
  history: Point[]
  width?: number
  height?: number
}) {
  // Need at least two points to draw a trend.
  if (!history || history.length < 2) {
    return <span className="text-slate-300 text-xs">—</span>
  }

  const FLOOR = 100 // non-ranking / >100 clamps here
  const positions = history.map((h) =>
    h.position === null ? FLOOR : Math.min(h.position, FLOOR),
  )

  const pad = 2
  const n = positions.length
  const stepX = (width - pad * 2) / (n - 1)

  // Y scale: best rank seen at top, FLOOR at bottom. Lower position = higher on chart.
  const best = Math.min(...positions)
  const worst = Math.max(...positions)
  const range = worst - best || 1

  const y = (pos: number) =>
    pad + ((pos - best) / range) * (height - pad * 2)
  const x = (i: number) => pad + i * stepX

  const points = positions.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`)
  const path = `M ${points.join(' L ')}`

  // Colour by overall direction: ending better (lower) than start = green.
  const first = positions[0]
  const last = positions[n - 1]
  const stroke = last < first ? '#16a34a' : last > first ? '#dc2626' : '#94a3b8'

  const lastX = x(n - 1)
  const lastY = y(last)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={stroke} />
    </svg>
  )
}
