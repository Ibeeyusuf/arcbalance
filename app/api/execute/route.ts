import { NextRequest, NextResponse } from 'next/server'
import { getWalletClient, getAgentAccount, getUsdcBalance, getUsycBalance, publicClient, CONTRACTS, ERC20_ABI, toUsdc } from '@/lib/arc-client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { trades } = await req.json()
    const account = getAgentAccount()
    const walletClient = getWalletClient()

    const usdcBefore = await getUsdcBalance(account.address)
    const results = []

    for (const trade of trades) {
      try {
        const tradeAmount = Math.min(trade.amountUsd, usdcBefore * 0.1)
        const safeAmount = Math.max(tradeAmount, 0.01)

        const hash = await walletClient.writeContract({
          address: CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [account.address, toUsdc(safeAmount)],
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        results.push({
          trade,
          status: receipt.status === 'success' ? 'executed' : 'failed',
          txHash: hash,
          explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          executedAt: new Date().toISOString(),
          amountUsdc: safeAmount,
        })
      } catch (tradeErr) {
        results.push({
          trade,
          status: 'failed',
          error: String(tradeErr),
          executedAt: new Date().toISOString(),
        })
      }
    }

    const usdcAfter = await getUsdcBalance(account.address)
    const usycBalance = await getUsycBalance(account.address)
    const blockNumber = await publicClient.getBlockNumber()
    const successCount = results.filter(r => r.status === 'executed').length

    return NextResponse.json({
      success: true,
      agentAddress: account.address,
      usdcBalanceBefore: usdcBefore,
      usdcBalanceAfter: usdcAfter,
      usycBalance,
      executed: successCount,
      total: trades.length,
      results,
      blockNumber: blockNumber.toString(),
      message: `${successCount}/${trades.length} trades executed on Arc Testnet`,
    })
  } catch (err) {
    console.error('[execute] error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}