import type { Metadata, Viewport } from 'next'
import './play.css'

export const viewport: Viewport = {
  themeColor: '#fbf3e4',
}

export const metadata: Metadata = {
  // Absolute base for og:image, which Facebook requires.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nobrandleftbehind.com'),
  robots: { index: false, follow: false },
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return children
}
