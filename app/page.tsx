'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { RebalanceDecision } from '@/lib/portfolio'
import { REGIME_COLORS, REGIME_LABELS } from '@/lib/portfolio'

interface Signal { id: string; symbol: string; price: number; change24h: number; change7d: number; momentum: string; volume: number }
interface AnalysisResult { success: boolean; decision: RebalanceDecision; signals: Signal[]; keyInsights: string[]; riskFactors: string[] }
interface ExecutionResult { success: boolean; agentAddress: string; executed: number; total: number; usdcBalanceBefore: number; usdcBalanceAfter: number; usycBalance: number; results: Array<{ trade: { from: string; to: string; amountUsd: number }; status: string; txHash?: string; explorerUrl?: string; blockNumber?: string }>; message: string; blockNumber: string }
interface HistoryEntry { id: string; created_at: string; regime: string; regime_confidence: number; portfolio_usd: number; trades_executed: number; tx_hashes: string[]; btc_price: number; block_number: string }
interface HistoryMetrics { totalRebalances: number; totalTrades: number; regimeCounts: Record<string, number>; btcBenchmarkReturn: number; mostCommonRegime: string }
interface GatewayData { success: boolean; agentAddress: string; unifiedBalance: number; blockNumber: string; chains: Array<{ chain: string; usdcBalance: number; usycBalance?: number; isLive: boolean; explorerUrl?: string; note?: string; contracts?: Record<string, string> }> }
interface TaxPosition { symbol: string; cost_basis: number; currentPrice: number; quantity: number; purchase_date: string; unrealizedPnl: number; unrealizedPnlPct: number }
interface HarvestOpportunity { asset: string; lossUsd: number; lossPct: number; quantity: number; costBasis: number; currentPrice: number; recommendation: string; taxSavingsEstimate: number }
interface TaxData { success: boolean; positions: TaxPosition[]; opportunities: HarvestOpportunity[]; summary: { totalPositions: number; totalUnrealizedLoss: number; totalTaxSavings: number; harvestableOpportunities: number; totalPortfolioValue: number } }
interface CCTPChain { name: string; domain: number; isSource?: boolean }
interface CCTPTransfer { id: string; created_at: string; from_chain: string; to_chain: string; amount_usdc: number; status: string; burn_tx_hash: string }
interface CCTPData { success: boolean; agentAddress: string; usdcBalance: number; supportedChains: CCTPChain[]; transfers: CCTPTransfer[]; stats: { totalTransfers: number; totalVolumeUsdc: number; avgTimeMs: number; totalFeesUsdc: number }; contracts: Record<string, string> }

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

type Tab = 'dashboard' | 'execute' | 'history' | 'gateway' | 'tax' | 'cctp'

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [portfolioUsd, setPortfolioUsd] = useState(10000)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [execution, setExecution] = useState<ExecutionResult | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyMetrics, setHistoryMetrics] = useState<HistoryMetrics | null>(null)
  const [gateway, setGateway] = useState<GatewayData | null>(null)
  const [taxData, setTaxData] = useState<TaxData | null>(null)
  const [cctpData, setCctpData] = useState<CCTPData | null>(null)
  const [cctpForm, setCctpForm] = useState({ toChain: 'Base Sepolia', amount: 0.1 })
  const [cctpSending, setCctpSending] = useState(false)
  const [cctpResult, setCctpResult] = useState<{ message: string; txHash: string; explorerUrl: string } | null>(null)
  const [cctpError, setCctpError] = useState<string | null>(null)
  const [harvestingAsset, setHarvestingAsset] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([
    '> ArcBalance v0.3.0 initialized',
    '> Arc Testnet connected (Chain ID: 5042002)',
    '> USDC contract: 0x3600000000000000000000000000000000000000',
    '> USYC contract: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
    '> CCTP TokenMessenger: 0x8FE6B999...',
    '> Ready.',
  ])

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-30), `> ${msg}`])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history')
      const data = await res.json()
      if (data.success) { setHistory(data.history ?? []); setHistoryMetrics(data.metrics) }
    } catch { /* non-fatal */ }
  }, [])

  const loadGateway = useCallback(async () => {
    try {
      const res = await fetch('/api/gateway')
      const data = await res.json()
      if (data.success) setGateway(data)
    } catch { /* non-fatal */ }
  }, [])

  const loadTax = useCallback(async () => {
    try {
      const res = await fetch('/api/taxharvest')
      const data = await res.json()
      if (data.success) setTaxData(data)
    } catch { /* non-fatal */ }
  }, [])

  const loadCCTP = useCallback(async () => {
    try {
      const res = await fetch('/api/cctp')
      const data = await res.json()
      if (data.success) setCctpData(data)
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    loadHistory(); loadGateway(); loadTax(); loadCCTP()
  }, [loadHistory, loadGateway, loadTax, loadCCTP])

  const runAnalysis = useCallback(async () => {
    setLoading(true); setError(null); setExecution(null)
    addLog(`Fetching market data — portfolio: ${usd(portfolioUsd)} USDC`)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioUsd }),
      })
      const data: AnalysisResult = await res.json()
      if (!data.success) throw new Error(String(data))
      setResult(data)
      setLastRun(new Date().toLocaleTimeString())
      addLog(`Regime: ${data.decision.regime} (${Math.round(data.decision.regimeConfidence * 100)}% confidence)`)
      addLog(`USYC allocation: ${data.decision.usycAllocation}%`)
      addLog(`${data.decision.tradesPending.length} trade(s) queued`)
      addLog(`Arc block: ${data.decision.blockNumber}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg); addLog(`ERROR: ${msg}`)
    } finally { setLoading(false) }
  }, [portfolioUsd])

  const executeTrades = async () => {
    if (!result?.decision.tradesPending.length) return
    setExecuting(true)
    addLog(`Executing ${result.decision.tradesPending.length} real USDC trade(s) on Arc...`)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: result.decision.tradesPending, portfolioUsd }),
      })
      const data: ExecutionResult = await res.json()
      if (!data.success) throw new Error((data as unknown as { error: string }).error)
      setExecution(data)
      addLog(`✓ ${data.executed}/${data.total} trades executed on Arc`)
      addLog(`USDC balance: ${data.usdcBalanceBefore.toFixed(4)} → ${data.usdcBalanceAfter.toFixed(4)}`)
      addLog(`Block: ${data.blockNumber}`)

      const btcPrice = result.signals.find(s => s.id === 'bitcoin')?.price ?? 0
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regime: result.decision.regime,
          regimeConfidence: result.decision.regimeConfidence,
          portfolioUsd,
          tradesExecuted: data.executed,
          txHashes: data.results.filter(r => r.txHash).map(r => r.txHash!),
          btcPriceAtRebalance: btcPrice,
          blockNumber: data.blockNumber,
          allocations: Object.fromEntries(result.decision.allocations.map(a => [a.asset, a.target])),
        }),
      })
      await loadHistory()
      await loadGateway()
      setTab('execute')
    } catch (e) {
      addLog(`Execution error: ${String(e)}`)
      setError(String(e))
    } finally { setExecuting(false) }
  }

  const harvestLoss = async (asset: string, currentPrice: number) => {
    setHarvestingAsset(asset)
    addLog(`Harvesting tax loss for ${asset} at $${currentPrice.toFixed(2)}...`)
    try {
      const res = await fetch('/api/taxharvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: asset, newCostBasis: currentPrice }),
      })
      const data = await res.json()
      if (data.success) {
        addLog(`✓ ${data.message}`)
        await loadTax()
      } else throw new Error(data.error)
    } catch (e) { addLog(`Harvest error: ${String(e)}`) }
    finally { setHarvestingAsset(null) }
  }

  const sendCCTP = async () => {
    setCctpSending(true); setCctpResult(null); setCctpError(null)
    addLog(`CCTP: burning ${cctpForm.amount} USDC on Arc → ${cctpForm.toChain}`)
    try {
      const res = await fetch('/api/cctp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toChain: cctpForm.toChain, amountUsdc: cctpForm.amount }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setCctpResult({ message: data.message, txHash: data.burnTxHash, explorerUrl: data.explorerUrl })
      addLog(`✓ CCTP burn tx: ${data.burnTxHash}`)
      addLog(`Block: ${data.blockNumber}`)
      await loadCCTP()
    } catch (e) {
      const msg = String(e); setCctpError(msg); addLog(`CCTP error: ${msg}`)
    } finally { setCctpSending(false) }
  }

  const d = result?.decision

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'execute', label: 'Execute' },
    { id: 'history', label: 'History', badge: history.length > 0 ? String(history.length) : undefined },
    { id: 'gateway', label: 'Gateway' },
    { id: 'tax', label: 'Tax Harvest', badge: taxData?.summary.harvestableOpportunities ? String(taxData.summary.harvestableOpportunities) : undefined },
    { id: 'cctp', label: 'CCTP' },
  ]

  return (
    <div className="relative min-h-screen z-10">
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-800 tracking-tight text-white">
            Arc<span style={{ color: 'var(--usdc)' }}>Balance</span>
          </h1>
          <p className="text-xs text-[var(--dim)] mt-0.5">AI Portfolio Manager · Arc Testnet · USDC Settlement</p>
        </div>
        <div className="flex items-center gap-3">
          {d && <RegimeBadge regime={d.regime} />}
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener"
            className="text-xs px-3 py-1.5 rounded border border-[var(--border)] text-[var(--dim)] hover:text-[var(--usdc)] transition-all">
            ArcScan ↗
          </a>
        </div>
      </header>

      <div className="border-b border-[var(--border)] px-6 flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-mono transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${tab === t.id ? 'border-[var(--usdc)] text-white' : 'border-transparent text-[var(--dim)] hover:text-white'}`}>
            {t.label}
            {t.badge && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--usdc)33', color: 'var(--usdc)' }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--surface)]">
                <label className="text-xs text-[var(--dim)] uppercase tracking-widest">Portfolio Size</label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[var(--usdc)] text-lg">$</span>
                  <input type="number" value={portfolioUsd} onChange={e => setPortfolioUsd(Number(e.target.value))}
                    className="flex-1 bg-transparent text-2xl font-mono text-white outline-none" min={100} step={100} />
                  <span className="text-[var(--dim)] text-sm">USDC</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {[1000, 5000, 10000, 50000].map(v => (
                    <button key={v} onClick={() => setPortfolioUsd(v)}
                      className={`text-xs px-2 py-1 rounded border transition-all ${portfolioUsd === v ? 'border-[var(--usdc)] text-[var(--usdc)]' : 'border-[var(--border)] text-[var(--dim)]'}`}>
                      ${(v / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 justify-center border border-[var(--border)] rounded-lg p-5 bg-[var(--surface)]">
                <button onClick={runAnalysis} disabled={loading}
                  className="w-full py-3 rounded font-display font-bold text-lg transition-all"
                  style={{ background: loading ? 'var(--surface-2)' : 'var(--usdc)', color: loading ? 'var(--dim)' : 'white' }}>
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing...</span>
                    : '⚡ Run Analysis'}
                </button>
                {d && d.tradesPending.length > 0 && (
                  <button onClick={executeTrades} disabled={executing}
                    className="w-full py-2 rounded font-mono text-sm border transition-all"
                    style={{ borderColor: 'var(--usyc)', color: executing ? 'var(--dim)' : 'var(--usyc)', background: 'var(--usyc)11' }}>
                    {executing
                      ? <span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />Executing on Arc...</span>
                      : `▶ Execute ${d.tradesPending.length} Trade(s) on Arc`}
                  </button>
                )}
                {lastRun && <p className="text-xs text-[var(--dim)] text-center">Last run: {lastRun}</p>}
              </div>

              <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--surface)]">
                <label className="text-xs text-[var(--dim)] uppercase tracking-widest">Regime</label>
                <div className="mt-3">
                  {d ? (
                    <>
                      <RegimeBadge regime={d.regime} />
                      <div className="mt-2 text-xs text-[var(--dim)]">
                        Confidence: <span className="text-white">{Math.round(d.regimeConfidence * 100)}%</span>
                        <div className="mt-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${d.regimeConfidence * 100}%`, background: REGIME_COLORS[d.regime as keyof typeof REGIME_COLORS] }} />
                        </div>
                      </div>
                      <p className="text-xs text-[var(--dim)] mt-1">Block: {d.blockNumber}</p>
                    </>
                  ) : <p className="text-[var(--dim)] text-sm mt-2">Run analysis to detect regime</p>}
                </div>
              </div>
            </div>

            {error && <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4 text-red-400 text-sm font-mono">⚠ {error}</div>}

            {d && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                  <h2 className="font-display font-bold text-white mb-4">Target Allocations</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={d.allocations} margin={{ left: -20 }}>
                      <XAxis dataKey="asset" tick={{ fill: '#5a6080', fontSize: 11, fontFamily: 'Space Mono' }} />
                      <YAxis tick={{ fill: '#5a6080', fontSize: 10 }} unit="%" />
                      <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', fontFamily: 'Space Mono', fontSize: 11 }}
                        formatter={(v: number, n: string) => [`${v}%`, n === 'target' ? 'Target' : 'Current']} />
                      <Bar dataKey="current" fill="#2a2a3e" radius={[2, 2, 0, 0]} name="current" />
                      <Bar dataKey="target" radius={[2, 2, 0, 0]} name="target">
                        {d.allocations.map(e => <Cell key={e.asset} fill={e.asset === 'USYC' ? 'var(--usyc)' : e.target > e.current ? 'var(--bull)' : e.target < e.current ? 'var(--bear)' : 'var(--usdc)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                  <h2 className="font-display font-bold text-white mb-4">Positions</h2>
                  <div className="space-y-2">
                    {d.allocations.map(a => (
                      <div key={a.asset} className="flex items-center gap-3 p-2 rounded" style={{ background: 'var(--surface-2)' }}>
                        <span className="font-bold text-sm w-10" style={{ color: a.asset === 'USYC' ? 'var(--usyc)' : 'var(--text)' }}>{a.asset}</span>
                        <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${a.target}%`, background: a.asset === 'USYC' ? 'var(--usyc)' : a.target > a.current ? 'var(--bull)' : a.target < a.current ? 'var(--bear)' : 'var(--usdc)' }} />
                        </div>
                        <span className="text-sm font-mono text-white w-8 text-right">{a.target}%</span>
                        <span className="text-xs text-[var(--dim)] w-20 text-right">{usd(a.usdValue)}</span>
                        <span className="text-xs w-4">{a.target > a.current ? '↑' : a.target < a.current ? '↓' : '–'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 border border-[var(--usdc)]/30 rounded-lg p-6 bg-[var(--surface)]">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-display font-bold text-white">Agent Reasoning Trace</h2>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--usdc)22', color: 'var(--usdc)', border: '1px solid var(--usdc)44' }}>llama-3.3-70b</span>
                  </div>
                  <div className="font-mono text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap p-4 rounded" style={{ background: 'var(--bg)', borderLeft: '2px solid var(--usdc)' }}>
                    {d.reasoning}
                  </div>
                </div>

                {result?.signals && (
                  <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                    <h2 className="font-display font-bold text-white mb-4">Live Market Signals</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {result.signals.map(s => (
                        <div key={s.id} className="p-3 rounded border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white text-sm">{s.symbol}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: s.change24h > 0 ? '#22c55e22' : '#ef444422', color: s.change24h > 0 ? 'var(--bull)' : 'var(--bear)' }}>{pct(s.change24h)}</span>
                          </div>
                          <p className="text-base font-mono text-white">${fmt(s.price)}</p>
                          <p className="text-xs text-[var(--dim)]">7d: {pct(s.change7d)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result?.keyInsights && (
                  <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                    <h2 className="font-display font-bold text-white mb-4">Intelligence</h2>
                    <p className="text-xs text-[var(--usyc)] uppercase tracking-widest mb-2">Key Insights</p>
                    <ul className="space-y-1 mb-4">
                      {result.keyInsights.map((ins, idx) => <li key={idx} className="text-xs text-[var(--text)] flex gap-2"><span style={{ color: 'var(--bull)' }}>✓</span>{ins}</li>)}
                    </ul>
                    <p className="text-xs text-[var(--bear)] uppercase tracking-widest mb-2">Risk Factors</p>
                    <ul className="space-y-1">
                      {(result.riskFactors ?? []).map((r, idx) => <li key={idx} className="text-xs text-[var(--text)] flex gap-2"><span style={{ color: 'var(--bear)' }}>⚠</span>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* EXECUTE */}
        {tab === 'execute' && (
          <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
            <h2 className="font-display font-bold text-white mb-2">On-Chain Execution</h2>
            <p className="text-xs text-[var(--dim)] mb-6">Real USDC transfers on Arc Testnet · ~$0.01/tx · Sub-second finality</p>
            {!result ? (
              <div className="text-center py-12">
                <p className="text-[var(--dim)]">Run an analysis on the Dashboard first.</p>
                <button onClick={() => setTab('dashboard')} className="mt-4 text-[var(--usdc)] text-sm hover:underline">Go to Dashboard →</button>
              </div>
            ) : execution ? (
              <div className="space-y-4">
                <div className="p-4 rounded border border-green-500/30 bg-green-500/10">
                  <p className="text-green-400 font-bold">✓ {execution.message}</p>
                  <p className="text-xs text-[var(--dim)] mt-1">Agent: {execution.agentAddress}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-[var(--dim)]">USDC before: <span className="text-white">{execution.usdcBalanceBefore?.toFixed(4)}</span></span>
                    <span className="text-[var(--dim)]">USDC after: <span className="text-white">{execution.usdcBalanceAfter?.toFixed(4)}</span></span>
                    <span className="text-[var(--dim)]">USYC: <span style={{ color: 'var(--usyc)' }}>{execution.usycBalance?.toFixed(4)}</span></span>
                    <span className="text-[var(--dim)]">Block: <span className="text-white">{execution.blockNumber}</span></span>
                  </div>
                </div>
                {execution.results.map((r, i) => (
                  <div key={i} className="p-3 rounded border text-sm" style={{ background: 'var(--surface-2)', borderColor: r.status === 'executed' ? 'var(--bull)33' : 'var(--bear)33' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-white">{r.trade.from} → {r.trade.to} · {usd(r.trade.amountUsd)}</span>
                      <span className={r.status === 'executed' ? 'text-green-400' : 'text-red-400'}>{r.status === 'executed' ? '✓' : '✗'} {r.status}</span>
                    </div>
                    {r.txHash && (
                      <div className="flex gap-4 mt-1 text-xs text-[var(--dim)]">
                        <span>Block: {r.blockNumber}</span>
                        <a href={r.explorerUrl} target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--usdc)' }}>View on ArcScan ↗</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(d?.tradesPending ?? []).length === 0
                  ? <p className="text-[var(--dim)]">Portfolio balanced — no trades needed.</p>
                  : (d?.tradesPending ?? []).map((trade, i) => (
                    <div key={i} className="p-3 rounded border flex items-center justify-between text-sm" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <span className="font-mono text-white">{trade.from} → {trade.to}</span>
                      <span style={{ color: 'var(--usdc)' }}>{usd(trade.amountUsd)}</span>
                    </div>
                  ))}
                {d && d.tradesPending.length > 0 && (
                  <button onClick={executeTrades} disabled={executing}
                    className="w-full py-3 rounded font-display font-bold mt-2"
                    style={{ background: 'var(--usyc)', color: 'white' }}>
                    {executing ? 'Executing...' : '▶ Execute All on Arc Testnet'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div className="space-y-4">
            {historyMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Rebalances', value: historyMetrics.totalRebalances },
                  { label: 'Total Trades', value: historyMetrics.totalTrades },
                  { label: 'Top Regime', value: historyMetrics.mostCommonRegime ?? 'N/A' },
                  { label: 'BTC Benchmark Δ', value: historyMetrics.btcBenchmarkReturn ? pct(historyMetrics.btcBenchmarkReturn) : 'N/A' },
                ].map(m => (
                  <div key={m.label} className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface)]">
                    <p className="text-xs text-[var(--dim)] uppercase tracking-widest">{m.label}</p>
                    <p className="text-2xl font-mono text-white mt-1">{m.value}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
              <h2 className="font-display font-bold text-white mb-4">Rebalance History</h2>
              {history.length === 0
                ? <p className="text-[var(--dim)] text-sm">No rebalances yet. Run analysis and execute trades.</p>
                : (
                  <div className="space-y-2">
                    {history.map(entry => (
                      <div key={entry.id} className="p-3 rounded border flex items-center gap-4 text-sm" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <RegimeBadge regime={entry.regime} />
                        <div className="flex-1">
                          <p className="text-xs text-[var(--dim)]">{new Date(entry.created_at).toLocaleString()}</p>
                          <p className="text-xs text-white mt-0.5">{entry.trades_executed} trades · {usd(entry.portfolio_usd)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[var(--dim)]">BTC at rebalance</p>
                          <p className="text-xs font-mono text-white">${fmt(entry.btc_price)}</p>
                        </div>
                        {(entry.tx_hashes ?? [])[0] && (
                          <a href={`https://testnet.arcscan.app/tx/${entry.tx_hashes[0]}`} target="_blank" rel="noopener"
                            className="text-xs hover:underline" style={{ color: 'var(--usdc)' }}>ArcScan ↗</a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* GATEWAY */}
        {tab === 'gateway' && (
          <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
            <h2 className="font-display font-bold text-white mb-2">Circle Gateway — Unified Balance</h2>
            <p className="text-xs text-[var(--dim)] mb-6">Real on-chain balances. Sub-500ms cross-chain USDC via Gateway.</p>
            {gateway ? (
              <>
                <div className="p-4 rounded border mb-6" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                  <p className="text-xs text-[var(--dim)]">Agent Wallet</p>
                  <p className="font-mono text-sm text-white mt-1 break-all">{gateway.agentAddress}</p>
                  <div className="flex gap-6 mt-3">
                    <div>
                      <p className="text-xs text-[var(--dim)]">USDC Balance</p>
                      <p className="text-2xl font-mono mt-0.5" style={{ color: 'var(--usdc)' }}>
                        {usd(gateway.unifiedBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--dim)]">Arc Block</p>
                      <p className="text-2xl font-mono text-white mt-0.5">{gateway.blockNumber}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {(gateway.chains ?? []).map(chain => (
                    <div key={chain.chain} className="p-4 rounded border flex items-center justify-between"
                      style={{ background: 'var(--surface-2)', borderColor: chain.isLive ? 'var(--usdc)33' : 'var(--border)' }}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${chain.isLive ? 'bg-green-400' : 'bg-[var(--dim)]'}`} />
                          <span className="text-sm text-white">{chain.chain}</span>
                        </div>
                        {chain.note && <p className="text-xs text-[var(--dim)] mt-1 ml-4">{chain.note}</p>}
                        {chain.contracts && (
                          <div className="mt-1 ml-4 space-y-0.5">
                            {Object.entries(chain.contracts).map(([k, v]) => (
                              <p key={k} className="text-xs text-[var(--dim)]">
                                {k}: <a href={`https://testnet.arcscan.app/address/${v}`} target="_blank" rel="noopener"
                                  className="hover:underline" style={{ color: 'var(--usdc)' }}>{v.slice(0, 10)}...↗</a>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm" style={{ color: chain.isLive ? 'var(--usdc)' : 'var(--dim)' }}>
                          {fmt(chain.usdcBalance, 4)} USDC
                        </p>
                        {chain.usycBalance !== undefined && chain.usycBalance > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--usyc)' }}>{fmt(chain.usycBalance, 4)} USYC</p>
                        )}
                        {chain.explorerUrl && (
                          <a href={chain.explorerUrl} target="_blank" rel="noopener"
                            className="text-xs hover:underline" style={{ color: 'var(--usdc)' }}>View ↗</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-[var(--dim)]">Loading real balances from Arc...</p>}
          </div>
        )}

        {/* TAX HARVEST */}
        {tab === 'tax' && (
          <div className="space-y-4">
            {taxData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Portfolio Value', value: usd(taxData.summary.totalPortfolioValue) },
                    { label: 'Unrealized Losses', value: usd(taxData.summary.totalUnrealizedLoss), color: 'var(--bear)' },
                    { label: 'Est. Tax Savings', value: usd(taxData.summary.totalTaxSavings), color: 'var(--usyc)' },
                    { label: 'Opportunities', value: String(taxData.summary.harvestableOpportunities) },
                  ].map(m => (
                    <div key={m.label} className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface)]">
                      <p className="text-xs text-[var(--dim)] uppercase tracking-widest">{m.label}</p>
                      <p className="text-xl font-mono mt-1" style={{ color: m.color ?? 'var(--text)' }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {taxData.opportunities.length > 0 && (
                  <div className="border border-[var(--bear)]/30 rounded-lg p-6 bg-[var(--surface)]">
                    <h2 className="font-display font-bold text-white mb-1">Harvest Opportunities</h2>
                    <p className="text-xs text-[var(--dim)] mb-4">Realise losses to offset gains. Repurchase after 30 days to maintain exposure.</p>
                    <div className="space-y-3">
                      {taxData.opportunities.map(opp => (
                        <div key={opp.asset} className="p-4 rounded border" style={{ background: 'var(--surface-2)', borderColor: 'var(--bear)22' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-bold text-white">{opp.asset}</span>
                              <span className="text-xs ml-2" style={{ color: 'var(--bear)' }}>-{fmt(opp.lossPct)}% loss</span>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-sm" style={{ color: 'var(--bear)' }}>-{usd(opp.lossUsd)}</p>
                              <p className="text-xs" style={{ color: 'var(--usyc)' }}>saves {usd(opp.taxSavingsEstimate)} in tax</p>
                            </div>
                          </div>
                          <p className="text-xs text-[var(--dim)] mb-3">{opp.recommendation}</p>
                          <div className="flex items-center justify-between text-xs text-[var(--dim)]">
                            <span>Cost basis: ${fmt(opp.costBasis)} → Now: ${fmt(opp.currentPrice)}</span>
                            <button onClick={() => harvestLoss(opp.asset, opp.currentPrice)}
                              disabled={harvestingAsset === opp.asset}
                              className="px-3 py-1 rounded font-mono transition-all"
                              style={{ background: 'var(--bear)22', color: 'var(--bear)', border: '1px solid var(--bear)44' }}>
                              {harvestingAsset === opp.asset ? 'Harvesting...' : `Harvest ${opp.asset}`}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                  <h2 className="font-display font-bold text-white mb-4">All Positions (Live Prices)</h2>
                  <div className="space-y-2">
                    {(taxData.positions ?? []).map(p => (
                      <div key={p.symbol} className="p-3 rounded border flex items-center gap-4 text-sm"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <span className="font-bold text-white w-12">{p.symbol}</span>
                        <div className="flex-1 text-xs text-[var(--dim)] flex gap-4">
                          <span>Cost: ${fmt(p.cost_basis)}</span>
                          <span>Now: ${fmt(p.currentPrice)}</span>
                          <span>Qty: {p.quantity}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm" style={{ color: p.unrealizedPnl >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                            {p.unrealizedPnl >= 0 ? '+' : ''}{usd(p.unrealizedPnl)}
                          </p>
                          <p className="text-xs" style={{ color: p.unrealizedPnlPct >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                            {pct(p.unrealizedPnlPct)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : <p className="text-[var(--dim)]">Loading positions...</p>}
          </div>
        )}

        {/* CCTP */}
        {tab === 'cctp' && (
          <div className="space-y-4">
            {cctpData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Transfers', value: String(cctpData.stats.totalTransfers) },
                    { label: 'Total Volume', value: usd(cctpData.stats.totalVolumeUsdc) },
                    { label: 'Agent USDC', value: `${fmt(cctpData.usdcBalance, 4)}` },
                    { label: 'Fee per Transfer', value: '$0.01' },
                  ].map(m => (
                    <div key={m.label} className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface)]">
                      <p className="text-xs text-[var(--dim)] uppercase tracking-widest">{m.label}</p>
                      <p className="text-xl font-mono text-white mt-1">{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                  <h2 className="font-display font-bold text-white mb-2">Burn USDC via CCTP</h2>
                  <p className="text-xs text-[var(--dim)] mb-1">Native USDC — no wrapping. Burns on Arc, mints on destination via Circle attestation.</p>
                  <p className="text-xs text-[var(--dim)] mb-4">
                    TokenMessenger: <a href={`https://testnet.arcscan.app/address/${cctpData.contracts?.tokenMessenger}`} target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--usdc)' }}>{cctpData.contracts?.tokenMessenger?.slice(0, 20)}...↗</a>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-[var(--dim)] uppercase tracking-widest">Destination Chain</label>
                      <select value={cctpForm.toChain} onChange={e => setCctpForm(f => ({ ...f, toChain: e.target.value }))}
                        className="w-full mt-1 p-2 rounded border text-sm font-mono text-white"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        {(cctpData.supportedChains ?? []).filter(c => !c.isSource).map(c => (
                          <option key={c.name} value={c.name}>{c.name} (Domain {c.domain})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--dim)] uppercase tracking-widest">Amount (USDC)</label>
                      <input type="number" value={cctpForm.amount}
                        onChange={e => setCctpForm(f => ({ ...f, amount: Number(e.target.value) }))}
                        className="w-full mt-1 p-2 rounded border text-sm font-mono text-white"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                        min={0.01} step={0.01} />
                    </div>
                  </div>
                  <button onClick={sendCCTP} disabled={cctpSending}
                    className="w-full py-3 rounded font-display font-bold transition-all"
                    style={{ background: cctpSending ? 'var(--surface-2)' : 'var(--usdc)', color: cctpSending ? 'var(--dim)' : 'white' }}>
                    {cctpSending ? 'Burning USDC on Arc...' : `Burn ${cctpForm.amount} USDC → ${cctpForm.toChain}`}
                  </button>

                  {cctpResult && (
                    <div className="mt-3 p-4 rounded border border-green-500/30 bg-green-500/10 space-y-1">
                      <p className="text-green-400 font-bold text-sm">✓ {cctpResult.message}</p>
                      <a href={cctpResult.explorerUrl} target="_blank" rel="noopener"
                        className="text-xs hover:underline block" style={{ color: 'var(--usdc)' }}>
                        View burn tx on ArcScan ↗
                      </a>
                    </div>
                  )}
                  {cctpError && (
                    <div className="mt-3 p-3 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-sm">⚠ {cctpError}</div>
                  )}
                </div>

                {(cctpData.transfers ?? []).length > 0 && (
                  <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--surface)]">
                    <h2 className="font-display font-bold text-white mb-4">Transfer History</h2>
                    <div className="space-y-2">
                      {(cctpData.transfers ?? []).map(t => (
                        <div key={t.id} className="p-3 rounded border flex items-center gap-4 text-sm"
                          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                          <div className="flex-1">
                            <p className="text-white font-mono">{t.from_chain} → {t.to_chain}</p>
                            <p className="text-xs text-[var(--dim)]">{new Date(t.created_at).toLocaleString()}</p>
                          </div>
                          <p className="font-mono" style={{ color: 'var(--usdc)' }}>{fmt(t.amount_usdc, 4)} USDC</p>
                          <span className="text-xs text-green-400">{t.status}</span>
                          {t.burn_tx_hash && (
                            <a href={`https://testnet.arcscan.app/tx/${t.burn_tx_hash}`} target="_blank" rel="noopener"
                              className="text-xs hover:underline" style={{ color: 'var(--usdc)' }}>↗</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <p className="text-[var(--dim)]">Loading CCTP data...</p>}
          </div>
        )}

        {/* Terminal */}
        <section className="border border-[var(--border)] rounded-lg bg-[var(--bg)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="ml-2 text-xs text-[var(--dim)]">arcbalance — agent log</span>
          </div>
          <div className="space-y-0.5 font-mono text-xs text-[var(--dim)] max-h-32 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i}>
                <span style={{ color: 'var(--usdc)' }}>arcbalance</span>
                <span className="text-[var(--border-bright)]"> % </span>
                <span>{log.replace('> ', '')}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="text-center text-xs text-[var(--dim)] pb-8">
          <p>ArcBalance · Agora Agents Hackathon · Canteen × Circle × Arc</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="https://arc.network" target="_blank" className="hover:text-[var(--usdc)] transition-colors">Arc ↗</a>
            <a href="https://developers.circle.com" target="_blank" className="hover:text-[var(--usdc)] transition-colors">Circle ↗</a>
            <a href="https://testnet.arcscan.app" target="_blank" className="hover:text-[var(--usdc)] transition-colors">Explorer ↗</a>
          </div>
        </footer>
      </main>
    </div>
  )
}