import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Portfolio Manager on Arc',
  description: 'Autonomous portfolio rebalancing agent.',
  openGraph: {
    title: 'ArcBalance',
    description: 'AI-powered portfolio manager on Arc by Circle',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
