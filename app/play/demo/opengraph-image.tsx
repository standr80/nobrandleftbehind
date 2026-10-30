import { ImageResponse } from 'next/og'
import { DEMO_BELT } from '@/lib/bruce/demo-belt'

export const alt = 'Cuddly Toy! A conveyor belt memory game'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** The Facebook preview card: the title, a belt of prizes, and the challenge. */
export default function OpengraphImage() {
  const cuddly = DEMO_BELT.items.find(i => i.isCuddlyToy)
  const shown = [...DEMO_BELT.items.filter(i => !i.isCuddlyToy).slice(0, 4), ...(cuddly ? [cuddly] : [])]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fbf3e4',
          color: '#2b1a10',
          paddingTop: 48,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 96, fontWeight: 800, color: '#b4410f' }}>Cuddly Toy!</div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>{DEMO_BELT.title}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 48, fontSize: 120 }}>
            {shown.map(i => <span key={i.id}>{i.emoji}</span>)}
          </div>
          <div
            style={{
              height: 56,
              background: '#3d2b20',
              borderTop: '8px solid #6b4a36',
              borderBottom: '8px solid #6b4a36',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '22px 0 30px',
              background: '#b4410f',
              color: '#ffffff',
              fontSize: 46,
              fontWeight: 800,
            }}
          >
            Can you remember all the prizes?
          </div>
        </div>
      </div>
    ),
    { ...size, emoji: 'twemoji' },
  )
}
