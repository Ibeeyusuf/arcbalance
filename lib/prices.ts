export type AssetId = 'bitcoin' | 'ethereum' | 'usd-coin' | 'solana' | 'chainlink'

export interface PriceData {
  id: AssetId
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  price_change_percentage_7d_in_currency?: number
  market_cap: number
  total_volume: number
  ath: number
  atl: number
}

export interface MarketSnapshot {
  prices: PriceData[]
  fetchedAt: string
  btcDominance?: number
}

// Assets tracked in the portfolio
export const PORTFOLIO_ASSETS: AssetId[] = ['bitcoin', 'ethereum', 'solana', 'chainlink']

export async function fetchMarketData(): Promise<MarketSnapshot> {
  const ids = PORTFOLIO_ASSETS.join(',')
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=7d&order=market_cap_desc`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 }, // cache 60s in Next.js
  })

  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)
  const data: PriceData[] = await res.json()

  // Fetch BTC dominance from global endpoint
  let btcDominance: number | undefined
  try {
    const globalRes = await fetch('https://api.coingecko.com/api/v3/global')
    const globalData = await globalRes.json()
    btcDominance = globalData?.data?.market_cap_percentage?.btc
  } catch { /* non-fatal */ }

  return { prices: data, fetchedAt: new Date().toISOString(), btcDominance }
}

// Derive simple momentum signals per asset
export function computeSignals(prices: PriceData[]) {
  return prices.map(p => ({
    id: p.id,
    symbol: p.symbol.toUpperCase(),
    price: p.current_price,
    change24h: p.price_change_percentage_24h,
    change7d: p.price_change_percentage_7d_in_currency ?? 0,
    momentum: p.price_change_percentage_24h > 2
      ? 'strong_up'
      : p.price_change_percentage_24h > 0
      ? 'up'
      : p.price_change_percentage_24h > -2
      ? 'flat'
      : p.price_change_percentage_24h > -5
      ? 'down'
      : 'strong_down',
    volume: p.total_volume,
  }))
}
