import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabase()
    const { data: rebalances, error } = await supabase
      .from('rebalances')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const total = rebalances?.length ?? 0
    const regimeCounts: Record<string, number> = {}
    let totalTrades = 0

    for (const r of rebalances ?? []) {
      regimeCounts[r.regime] = (regimeCounts[r.regime] || 0) + 1
      totalTrades += r.trades_executed
    }

    let btcBenchmarkReturn = 0
    if ((rebalances?.length ?? 0) >= 2) {
      const first = rebalances![rebalances!.length - 1].btc_price
      const latest = rebalances![0].btc_price
      btcBenchmarkReturn = ((latest - first) / first) * 100
    }

    const mostCommonRegime = Object.entries(regimeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'

    return NextResponse.json({
      success: true,
      history: rebalances ?? [],
      metrics: {
        totalRebalances: total,
        totalTrades,
        regimeCounts,
        btcBenchmarkReturn,
        mostCommonRegime,
      }
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await req.json()

    const { error } = await supabase.from('rebalances').insert({
      regime: body.regime,
      regime_confidence: body.regimeConfidence,
      portfolio_usd: body.portfolioUsd,
      trades_executed: body.tradesExecuted,
      tx_hashes: body.txHashes ?? [],
      btc_price: body.btcPriceAtRebalance,
      block_number: body.blockNumber,
      allocations: body.allocations,
    })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}