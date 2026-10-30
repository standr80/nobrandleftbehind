import type { Metadata } from 'next'
import CuddlyToyGame from '@/components/cuddly-toy/CuddlyToyGame'
import { DEMO_BELT } from '@/lib/bruce/demo-belt'

const title = `Cuddly Toy! ${DEMO_BELT.title}`
const description = 'Watch the prizes go by on the conveyor belt. How many can you remember?'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website' },
}

export default function CuddlyToyDemoPage() {
  return <CuddlyToyGame belt={DEMO_BELT} brandName="No Brand Left Behind" />
}
