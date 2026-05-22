import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ArcBalance — AI Portfolio Manager on Arc',
  description: 'Autonomous portfolio rebalancing agent. Detects market regimes, rebalances USDC allocations, and parks idle capital in USYC — settled on Arc with sub-second finality.',
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
