import { NextRequest, NextResponse } from 'next/server'
import { fetchMarketData, computeSignals } from '@/lib/prices'
import { REGIME_ALLOCATIONS, type Regime, type RebalanceDecision } from '@/lib/portfolio'
import { getBlockNumber } from '@/lib/arc-client'
export const dynamic = 'force-dynamic'

async function callAI(prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const portfolioUsd: number = body.portfolioUsd ?? 10000

    const snapshot = await fetchMarketData()
    const signals = computeSignals(snapshot.prices)

    let blockNumber = 'unknown'
    try {
      blockNumber = (await getBlockNumber()).toString()
    } catch { /* testnet may be down */ }

    const prompt = `You are ArcBalance, an autonomous AI portfolio manager running on Arc blockchain (a USDC-native L1 by Circle). You analyze real-time market signals and decide optimal portfolio allocations.

## Current Market Snapshot
Timestamp: ${snapshot.fetchedAt}
Arc Block: ${blockNumber}
BTC Dominance: ${snapshot.btcDominance?.toFixed(1) ?? 'N/A'}%

## Asset Signals
${signals.map(s => `
**${s.symbol}** — $${s.price.toLocaleString()}
  24h change: ${s.change24h > 0 ? '+' : ''}${s.change24h.toFixed(2)}%
  7d change: ${s.change7d > 0 ? '+' : ''}${s.change7d.toFixed(2)}%
  Momentum: ${s.momentum}
  24h Volume: $${(s.volume / 1e9).toFixed(2)}B
`).join('')}

## Portfolio
Total value: $${portfolioUsd.toLocaleString()} USDC
Settlement: Arc Testnet (USDC-native, ~$0.01/tx, sub-second finality)

## USYC
USYC is a tokenized money market fund on Arc. It earns yield on idle capital. You MUST allocate a portion to USYC based on risk — more USYC in bearish/volatile regimes.

## Your Task
1. Detect the current market regime: BULL, BEAR, SIDEWAYS, or HIGH_VOLATILITY
2. State your confidence (0.0-1.0)
3. Recommend target allocations for: BTC, ETH, SOL, LINK, USYC (must sum to 100)
4. Write a detailed reasoning trace referencing exact price data
5. List 3 key insights and 2 risk factors

Respond ONLY with valid JSON, no markdown fences:
{"regime":"BULL","regimeConfidence":0.8,"reasoning":"full reasoning here","allocations":{"BTC":35,"ETH":30,"SOL":20,"LINK":10,"USYC":5},"keyInsights":["insight 1","insight 2","insight 3"],"riskFactors":["risk 1","risk 2"]}`

    const rawText = await callAI(prompt)
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let aiResponse: {
      regime: Regime
      regimeConfidence: number
      reasoning: string
      allocations: Record<string, number>
      keyInsights: string[]
      riskFactors: string[]
    }

    try {
      aiResponse = JSON.parse(cleaned)
    } catch {
      aiResponse = {
        regime: 'SIDEWAYS',
        regimeConfidence: 0.5,
        reasoning: rawText,
        allocations: REGIME_ALLOCATIONS.SIDEWAYS,
        keyInsights: ['Market data analyzed'],
        riskFactors: ['Parse error — using default allocations'],
      }
    }

    const regime = aiResponse.regime
    const targetAllocs = aiResponse.allocations
    const totalPct = Object.values(targetAllocs).reduce((a, b) => a + b, 0)

    const normalized: Record<string, number> = {}
    for (const [asset, pct] of Object.entries(targetAllocs)) {
      normalized[asset] = Math.round((pct / totalPct) * 100)
    }

    const currentAllocs: Record<string, number> = { BTC: 25, ETH: 25, SOL: 20, LINK: 15, USYC: 15 }

    const allocations = Object.entries(normalized).map(([asset, target]) => ({
      asset,
      target,
      current: currentAllocs[asset] ?? 0,
      usdValue: (target / 100) * portfolioUsd,
      reason: `${regime} regime — ${target > (currentAllocs[asset] ?? 0) ? 'increase' : target < (currentAllocs[asset] ?? 0) ? 'reduce' : 'hold'} exposure`,
    }))

    const tradesPending = allocations
      .filter(a => Math.abs(a.target - a.current) > 3)
      .map(a => ({
        from: a.target > a.current ? 'USDC' : a.asset,
        to: a.target > a.current ? a.asset : 'USDC',
        amountUsd: Math.abs(a.target - a.current) / 100 * portfolioUsd,
        rationale: a.reason,
      }))

    const decision: RebalanceDecision = {
      regime,
      regimeConfidence: aiResponse.regimeConfidence,
      allocations,
      tradesPending,
      reasoning: aiResponse.reasoning,
      usycAllocation: normalized['USYC'] ?? 0,
      totalPortfolioUsd: portfolioUsd,
      timestamp: new Date().toISOString(),
      blockNumber,
    }

    return NextResponse.json({
      success: true,
      decision,
      marketSnapshot: snapshot,
      signals,
      keyInsights: aiResponse.keyInsights,
      riskFactors: aiResponse.riskFactors,
    })

  } catch (err) {
    console.error('[analyze] error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}