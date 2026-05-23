import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const DEFAULT_POSITIONS = [
  { symbol: 'BTC', cost_basis: 95000, quantity: 0.05, purchase_date: '2025-10-15' },
  { symbol: 'ETH', cost_basis: 3800,  quantity: 1.5,  purchase_date: '2025-09-01' },
  { symbol: 'SOL', cost_basis: 210,   quantity: 8,    purchase_date: '2025-08-20' },
  { symbol: 'LINK', cost_basis: 22,   quantity: 50,   purchase_date: '2025-07-10' },
]

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', LINK: 'chainlink'
}

export async function GET() {
  try {
    const supabase = getSupabase()

    let { data: positions } = await supabase.from('positions').select('*')

    if (!positions || positions.length === 0) {
      const { data: seeded } = await supabase
        .from('positions')
        .insert(DEFAULT_POSITIONS)
        .select()
      positions = seeded
    }

    const ids = (positions ?? []).map(p => COINGECKO_IDS[p.symbol]).filter(Boolean).join(',')
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`,
      { next: { revalidate: 60 } }
    )
    const priceData: Array<{ symbol: string; current_price: number }> = await priceRes.json()
    const priceMap: Record<string, number> = {}
    for (const p of priceData) priceMap[p.symbol.toUpperCase()] = p.current_price

    const TAX_RATE = 0.30
    const enriched = (positions ?? []).map(p => {
      const currentPrice = priceMap[p.symbol] ?? p.cost_basis
      const unrealizedPnl = (currentPrice - p.cost_basis) * p.quantity
      const unrealizedPnlPct = ((currentPrice - p.cost_basis) / p.cost_basis) * 100
      return { ...p, currentPrice, unrealizedPnl, unrealizedPnlPct }
    })

    const opportunities = enriched
      .filter(p => p.unrealizedPnlPct < -5)
      .map(p => ({
        asset: p.symbol,
        lossUsd: Math.abs(p.unrealizedPnl),
        lossPct: Math.abs(p.unrealizedPnlPct),
        quantity: p.quantity,
        costBasis: p.cost_basis,
        currentPrice: p.currentPrice,
        taxSavingsEstimate: Math.abs(p.unrealizedPnl) * TAX_RATE,
        recommendation: `Sell ${p.quantity} ${p.symbol} to realize $${Math.abs(p.unrealizedPnl).toFixed(2)} loss. Est. tax savings: $${(Math.abs(p.unrealizedPnl) * TAX_RATE).toFixed(2)} at 30% rate. Repurchase after 30 days.`,
      }))
      .sort((a, b) => b.lossUsd - a.lossUsd)

    const totalLoss = enriched.filter(p => p.unrealizedPnl < 0).reduce((s, p) => s + Math.abs(p.unrealizedPnl), 0)
    const totalValue = enriched.reduce((s, p) => s + p.currentPrice * p.quantity, 0)

    return NextResponse.json({
      success: true,
      positions: enriched,
      opportunities,
      summary: {
        totalPositions: enriched.length,
        totalPortfolioValue: totalValue,
        totalUnrealizedLoss: totalLoss,
        totalTaxSavings: opportunities.reduce((s, o) => s + o.taxSavingsEstimate, 0),
        harvestableOpportunities: opportunities.length,
      }
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { symbol, newCostBasis } = await req.json()

    const { error } = await supabase
      .from('positions')
      .update({
        cost_basis: newCostBasis,
        purchase_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('symbol', symbol)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `Tax-loss harvest recorded for ${symbol}. Cost basis reset to $${newCostBasis.toFixed(2)}.`,
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}