import { NextResponse } from 'next/server'
import { getAgentAccount, getUsdcBalance, getUsycBalance, publicClient, CONTRACTS } from '@/lib/arc-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const account = getAgentAccount()
    const [usdcBalance, usycBalance, blockNumber] = await Promise.all([
      getUsdcBalance(account.address),
      getUsycBalance(account.address),
      publicClient.getBlockNumber(),
    ])

    return NextResponse.json({
      success: true,
      agentAddress: account.address,
      unifiedBalance: usdcBalance + usycBalance,
      blockNumber: blockNumber.toString(),
      chains: [
        {
          chain: 'Arc Testnet',
          chainId: 5042002,
          usdcBalance,
          usycBalance,
          isLive: true,
          explorerUrl: `https://testnet.arcscan.app/address/${account.address}`,
          contracts: {
            usdc: CONTRACTS.USDC,
            usyc: CONTRACTS.USYC,
            gateway: CONTRACTS.GATEWAY_WALLET,
            cctp: CONTRACTS.CCTP_MESSENGER,
          }
        },
        {
          chain: 'Base Sepolia (via Gateway)',
          chainId: 84532,
          usdcBalance: 0,
          isLive: false,
          note: 'Deposit via Circle Gateway to unify balance across chains',
        },
        {
          chain: 'Ethereum Sepolia (via CCTP)',
          chainId: 11155111,
          usdcBalance: 0,
          isLive: false,
          note: 'Transfer via CCTP — burns on Arc, mints on destination',
        },
      ],
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}