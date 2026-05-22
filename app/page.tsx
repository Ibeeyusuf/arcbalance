'use client'

import { useState, useEffect, useCallback } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import type { RebalanceDecision } from '@/lib/portfolio'
import { REGIME_COLORS, REGIME_LABELS } from '@/lib/portfolio'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Signal {
  id: string; symbol: string; price: number
  change24h: number; change7d: number; momentum: string; volume: number
}
interface AnalysisResult {
  success: boolean
  decision: RebalanceDecision
  signals: Signal[]
  keyInsights: string[]
  riskFactors: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number, d = 2) => n?.toLocaleString('en-US', { maximumFractionDigits: d }) ?? '–'
const pct = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}%`
const usd = (n: number) => `$${fmt(n, 0)}`

function RegimeBadge({ regime }: { regime: string }) {
  const color = REGIME_COLORS[regime as keyof typeof REGIME_COLORS] ?? '#64748b'
  const label = REGIME_LABELS[regime as keyof typeof REGIME_LABELS] ?? regime
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded text-sm font-bold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
      {label}
    </span>
  )
}

function TerminalLine({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t) }, [delay])
  return <div className={`transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>{children}</div>
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const [portfolioUsd, setPortfolioUsd] = useState(10000)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<RebalanceDecision[]>([])
  const [autoMode, setAutoMode] = useState(false)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([
    '> ArcBalance v0.1.0 initialized',
    '> Connected to Arc Testnet (Chain ID: 5042002)',
    '> USDC-native settlement: active',
    '> Waiting for analysis command...',
  ])

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-20), `> ${msg}`])

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    addLog(`Fetching market data — portfolio: ${usd(portfolioUsd)} USDC`)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioUsd }),
      })
      const data: AnalysisResult = await res.json()
      if (!data.success) throw new Error(data as unknown as string)
      setResult(data)
      setHistory(prev => [data.decision, ...prev].slice(0, 10))
      setLastRun(new Date().toLocaleTimeString())
      addLog(`Regime detected: ${data.decision.regime} (${Math.round(data.decision.regimeConfidence * 100)}% confidence)`)
      addLog(`USYC allocation: ${data.decision.usycAllocation}% — idle capital parked`)
      addLog(`${data.decision.tradesPending.length} rebalance trade(s) queued`)
      addLog(`Block: ${data.decision.blockNumber} — Arc Testnet`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      addLog(`ERROR: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [portfolioUsd])

  // Auto-run every 5 minutes when enabled
  useEffect(() => {
    if (!autoMode) return
    const interval = setInterval(() => {
      addLog('Auto-rebalance triggered (5m interval)')
      runAnalysis()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [autoMode, runAnalysis])

  const d = result?.decision

  return (
    <div className="relative min-h-screen z-10">
      {/* ── Header ── */}
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-800 tracking-tight text-white">
            Arc<span style={{ color: 'var(--usdc)' }}>Balance</span>
          </h1>
          <p className="text-xs text-[var(--dim)] mt-0.5">
            AI Portfolio Manager · Arc Testnet · USDC Settlement
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto mode toggle */}
          <button
            onClick={() => { setAutoMode(a => !a); addLog(autoMode ? 'Auto-rebalance: OFF' : 'Auto-rebalance: ON (5m interval)') }}
            className={`text-xs px-3 py-1.5 rounded border transition-all font-mono ${autoMode
              ? 'border-green-500/50 bg-green-500/10 text-green-400'
              : 'border-[var(--border)] text-[var(--dim)] hover:border-[var(--border-bright)]'
              }`}
          >
            {autoMode ? '⟳ AUTO: ON' : '⟳ AUTO: OFF'}
          </button>
          {/* Arc badge */}
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener"
            className="text-xs px-3 py-1.5 rounded border border-[var(--border)] text-[var(--dim)] hover:text-[var(--usdc)] hover:border-[var(--usdc)]/30 transition-all">
            ArcScan ↗
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Control Panel ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Portfolio Size */}
          <div className="col-span-1 border border-[var(--border)] rounded-lg p-5 bg-[var(--surface)]">
            <label className="text-xs text-[var(--dim)] uppercase tracking-widest">Portfolio Size</label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[var(--usdc)] text-lg">$</span>
              <input
                type="number"
                value={portfolioUsd}
                onChange={e => setPortfolioUsd(Number(e.target.value))}
                className="flex-1 bg-transparent text-2xl font-mono text-white outline-none"
                min={100} step={500}
              />
              <span className="text-[var(--dim)] text-sm">USDC</span>
            </div>
            <div className="flex gap-2 mt-3">
              {[1000, 5000, 10000, 50000].map(v => (
                <button key={v} onClick={() => setPortfolioUsd(v)}
                  className={`text-xs px-2 py-1 rounded border transition-all ${portfolioUsd === v
                    ? 'border-[var(--usdc)] text-[var(--usdc)]'
                    : 'border-[var(--border)] text-[var(--dim)] hover:border-[var(--border-bright)]'}`}>
                  ${(v / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <div className="col-span-1 flex flex-col justify-center items-center border border-[var(--border)] rounded-lg p-5 bg-[var(--surface)]">
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="w-full py-3 rounded font-display font-bold text-lg transition-all relative overflow-hidden"
              style={{
                background: loading ? 'var(--surface-2)' : 'var(--usdc)',
                color: loading ? 'var(--dim)' : 'white',
                border: '1px solid transparent',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </span>
              ) : '⚡ Run Analysis'}
            </button>
            {lastRun && <p className="text-xs text-[var(--dim)] mt-2">Last run: {lastRun}</p>}
          </div>

          {/* Regime Status */}
          <div className="col-span-1 border border-[var(--border)] rounded-lg p-5 bg-[var(--surface)]">
            <label className="text-xs text-[var(--dim)] uppercase tracking-widest">Current Regime</label>
            <div className="mt-3">
              {d ? (
                <>
                  <RegimeBadge regime={d.regime} />
                  <div className="mt-2 text-xs text-[var(--dim)]">
                    Confidence: <span className="text-white">{Math.round(d.regimeConfidence * 100)}%</span>
                    <div className="mt-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${d.regimeConfidence * 100}%`, background: REGIME_COLORS[d.regime] }} />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--dim)] mt-2">Block: {d.blockNumber}</p>
                </>
              ) : (
                <p className="text-[var(--dim)] text-sm mt-2">Run analysis to detect regime</p>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4 text-red-400 text-sm font-mono">
            ⚠ {error}
          </div>
        )}

        {/* ── Main Grid ── */}
        {d && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Allocation Chart */}
            <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
              <h2 className="font-display font-bold text-white mb-1">Target Allocations</h2>
              <p className="text-xs text-[var(--dim)] mb-4">
                {d.tradesPending.length > 0
                  ? `${d.tradesPending.length} trade(s) needed to rebalance`
                  : 'Portfolio is balanced — no trades needed'}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.allocations} margin={{ left: -20 }}>
                  <XAxis dataKey="asset" tick={{ fill: '#5a6080', fontSize: 11, fontFamily: 'Space Mono' }} />
                  <YAxis tick={{ fill: '#5a6080', fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'Space Mono', fontSize: 11 }}
                    labelStyle={{ color: 'var(--text)' }}
                    formatter={(v: number, name: string) => [`${v}%`, name === 'target' ? 'Target' : 'Current']}
                  />
                  <Bar dataKey="current" fill="#2a2a3e" radius={[2, 2, 0, 0]} name="current" />
                  <Bar dataKey="target" radius={[2, 2, 0, 0]} name="target">
                    {d.allocations.map((entry) => (
                      <Cell key={entry.asset}
                        fill={entry.asset === 'USYC' ? 'var(--usyc)'
                          : entry.target > entry.current ? 'var(--bull)'
                            : entry.target < entry.current ? 'var(--bear)'
                              : 'var(--usdc)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-3 mt-2 text-xs text-[var(--dim)]">
                <span><span className="inline-block w-2 h-2 bg-[#2a2a3e] rounded mr-1" />Current</span>
                <span><span className="inline-block w-2 h-2 rounded mr-1" style={{ background: 'var(--bull)' }} />↑ Increase</span>
                <span><span className="inline-block w-2 h-2 rounded mr-1" style={{ background: 'var(--bear)' }} />↓ Reduce</span>
                <span><span className="inline-block w-2 h-2 rounded mr-1" style={{ background: 'var(--usyc)' }} />USYC</span>
              </div>
            </div>

            {/* Allocation Table */}
            <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
              <h2 className="font-display font-bold text-white mb-1">Position Details</h2>
              <p className="text-xs text-[var(--dim)] mb-4">USYC = {d.usycAllocation}% idle capital parked for yield</p>
              <div className="space-y-2">
                {d.allocations.map(a => (
                  <div key={a.asset} className="flex items-center gap-3 p-2 rounded"
                    style={{ background: 'var(--surface-2)' }}>
                    <span className="font-bold text-sm w-10"
                      style={{ color: a.asset === 'USYC' ? 'var(--usyc)' : 'var(--text)' }}>
                      {a.asset}
                    </span>
                    <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${a.target}%`,
                          background: a.asset === 'USYC' ? 'var(--usyc)'
                            : a.target > a.current ? 'var(--bull)'
                              : a.target < a.current ? 'var(--bear)'
                                : 'var(--usdc)'
                        }} />
                    </div>
                    <span className="text-sm font-mono text-white w-8 text-right">{a.target}%</span>
                    <span className="text-xs text-[var(--dim)] w-20 text-right">{usd(a.usdValue)}</span>
                    <span className="text-xs w-6 text-center">
                      {a.target > a.current ? '↑' : a.target < a.current ? '↓' : '–'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Trades */}
            {d.tradesPending.length > 0 && (
              <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                <h2 className="font-display font-bold text-white mb-1">Rebalance Queue</h2>
                <p className="text-xs text-[var(--dim)] mb-4">
                  Settled on Arc · ~$0.01/tx · sub-second finality
                </p>
                <div className="space-y-2">
                  {d.tradesPending.map((trade, i) => (
                    <div key={i} className="p-3 rounded border text-sm"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-white font-mono">
                          {trade.from} → {trade.to}
                        </span>
                        <span style={{ color: 'var(--usdc)' }} className="font-bold">
                          {usd(trade.amountUsd)}
                        </span>
                      </div>
                      <p className="text-[var(--dim)] text-xs mt-1">{trade.rationale}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2 rounded text-xs text-[var(--dim)] border border-[var(--border)]"
                  style={{ background: 'var(--bg)' }}>
                  💡 On mainnet, these trades would settle on Arc in &lt;1 second for ~${(d.tradesPending.length * 0.01).toFixed(2)} in USDC fees via Circle Paymaster
                </div>
              </div>
            )}

            {/* Key Insights & Risks */}
            <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
              <h2 className="font-display font-bold text-white mb-4">Intelligence Summary</h2>
              {result?.keyInsights && (
                <div className="mb-4">
                  <p className="text-xs text-[var(--usyc)] uppercase tracking-widest mb-2">Key Insights</p>
                  <ul className="space-y-1">
                    {result.keyInsights.map((insight, i) => (
                      <li key={i} className="text-xs text-[var(--text)] flex gap-2">
                        <span style={{ color: 'var(--bull)' }}>✓</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result?.riskFactors && (
                <div>
                  <p className="text-xs text-[var(--bear)] uppercase tracking-widest mb-2">Risk Factors</p>
                  <ul className="space-y-1">
                    {result.riskFactors.map((risk, i) => (
                      <li key={i} className="text-xs text-[var(--text)] flex gap-2">
                        <span style={{ color: 'var(--bear)' }}>⚠</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Claude Reasoning Trace — the star of the show */}
            <div className="lg:col-span-2 border border-[var(--usdc)]/30 rounded-lg p-6 bg-[var(--surface)] glow-usdc">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display font-bold text-white">Agent Reasoning Trace</h2>
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'var(--usdc)22', color: 'var(--usdc)', border: '1px solid var(--usdc)44' }}>
                  claude-sonnet-4
                </span>
                <span className="text-xs text-[var(--dim)]">{new Date(d.timestamp).toLocaleString()}</span>
              </div>
              <div className="font-mono text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap p-4 rounded"
                style={{ background: 'var(--bg)', borderLeft: '2px solid var(--usdc)', paddingLeft: 16 }}>
                {d.reasoning}
              </div>
            </div>

            {/* Signal Heatmap */}
            {result?.signals && (
              <div className="lg:col-span-2 border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                <h2 className="font-display font-bold text-white mb-4">Live Market Signals</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {result.signals.map(s => (
                    <div key={s.id} className="p-4 rounded border"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-white">{s.symbol}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: s.change24h > 0 ? '#22c55e22' : '#ef444422',
                            color: s.change24h > 0 ? 'var(--bull)' : 'var(--bear)'
                          }}>
                          {pct(s.change24h)}
                        </span>
                      </div>
                      <p className="text-lg font-mono text-white">${fmt(s.price)}</p>
                      <p className="text-xs text-[var(--dim)] mt-1">7d: {pct(s.change7d)}</p>
                      <p className="text-xs mt-1" style={{
                        color: s.momentum.includes('up') ? 'var(--bull)'
                          : s.momentum.includes('down') ? 'var(--bear)'
                            : 'var(--sideways)'
                      }}>{s.momentum.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Terminal Log ── */}
        <section className="border border-[var(--border)] rounded-lg bg-[var(--bg)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="ml-2 text-xs text-[var(--dim)]">arcbalance — agent log</span>
          </div>
          <div className="space-y-0.5 font-mono text-xs text-[var(--dim)] max-h-40 overflow-y-auto">
            {logs.map((log, i) => (
              <TerminalLine key={i} delay={i * 50}>
                <span style={{ color: 'var(--usdc)' }}>arcbalance</span>
                <span className="text-[var(--border-bright)]"> % </span>
                <span>{log.replace('> ', '')}</span>
              </TerminalLine>
            ))}
            <div className="cursor" />
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center text-xs text-[var(--dim)] pb-8 space-y-1">
          <p>ArcBalance · Built for Agora Agents Hackathon by Canteen × Circle × Arc</p>
          <p>USDC-native settlement · ~$0.01/tx · Sub-second finality on Arc Testnet</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="https://arc.network" target="_blank" className="hover:text-[var(--usdc)] transition-colors">Arc ↗</a>
            <a href="https://developers.circle.com" target="_blank" className="hover:text-[var(--usdc)] transition-colors">Circle Docs ↗</a>
            <a href="https://testnet.arcscan.app" target="_blank" className="hover:text-[var(--usdc)] transition-colors">Explorer ↗</a>
          </div>
        </footer>
      </main>
    </div>
  )
}
