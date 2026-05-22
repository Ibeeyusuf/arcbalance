export type Regime = 'BULL' | 'BEAR' | 'SIDEWAYS' | 'HIGH_VOLATILITY'

export interface Allocation {
  asset: string      // e.g. 'BTC', 'ETH', 'SOL', 'LINK', 'USYC'
  target: number     // 0–100 percent
  current: number    // 0–100 percent
  usdValue: number
  reason: string
}

export interface RebalanceDecision {
  regime: Regime
  regimeConfidence: number       // 0–1
  allocations: Allocation[]
  tradesPending: Trade[]
  reasoning: string              // Claude's full trace
  usycAllocation: number         // % to park in USYC (idle capital)
  totalPortfolioUsd: number
  timestamp: string
  blockNumber?: string
}

export interface Trade {
  from: string
  to: string
  amountUsd: number
  rationale: string
}

// Default regime-based target allocations
// USYC absorbs idle capital in high-risk regimes
export const REGIME_ALLOCATIONS: Record<Regime, Record<string, number>> = {
  BULL: {
    BTC: 35, ETH: 30, SOL: 20, LINK: 10, USYC: 5,
  },
  BEAR: {
    BTC: 15, ETH: 10, SOL: 5, LINK: 5, USYC: 65,
  },
  SIDEWAYS: {
    BTC: 30, ETH: 25, SOL: 15, LINK: 10, USYC: 20,
  },
  HIGH_VOLATILITY: {
    BTC: 20, ETH: 15, SOL: 5, LINK: 5, USYC: 55,
  },
}

export const REGIME_COLORS: Record<Regime, string> = {
  BULL: '#22c55e',
  BEAR: '#ef4444',
  SIDEWAYS: '#f59e0b',
  HIGH_VOLATILITY: '#8b5cf6',
}

export const REGIME_LABELS: Record<Regime, string> = {
  BULL: '↑ Bull Market',
  BEAR: '↓ Bear Market',
  SIDEWAYS: '↔ Sideways',
  HIGH_VOLATILITY: '⚡ High Volatility',
}
