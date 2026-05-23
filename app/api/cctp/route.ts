import { NextRequest, NextResponse } from 'next/server'
import { getAgentAccount, getUsdcBalance, publicClient, CONTRACTS, ERC20_ABI } from '@/lib/arc-client'
import { createWalletClient, http } from 'viem'
import { arcTestnet } from '@/lib/arc-client'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const CCTP_MESSENGER_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
  },
] as const

const CCTP_DOMAINS: Record<string, number> = {
  'Ethereum Sepolia': 0,
  'Base Sepolia': 6,
  'Arbitrum Sepolia': 3,
}

export async function GET() {
  try {
    const account = getAgentAccount()
    const usdcBalance = await getUsdcBalance(account.address)
    const blockNumber = await publicClient.getBlockNumber()
    const supabase = getSupabase()

    const { data: transfers } = await supabase
      .from('cctp_transfers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    const stats = {
      totalTransfers: transfers?.length ?? 0,
      totalVolumeUsdc: (transfers ?? []).reduce((s: number, t: { amount_usdc: number }) => s + t.amount_usdc, 0),
      avgTimeMs: 500,
      totalFeesUsdc: (transfers?.length ?? 0) * 0.01,
    }

    return NextResponse.json({
      success: true,
      agentAddress: account.address,
      usdcBalance,
      blockNumber: blockNumber.toString(),
      supportedChains: Object.keys(CCTP_DOMAINS).map(name => ({
        name,
        domain: CCTP_DOMAINS[name],
        isSource: false,
      })),
      contracts: {
        tokenMessenger: CONTRACTS.CCTP_MESSENGER,
        messageTransmitter: CONTRACTS.CCTP_TRANSMITTER,
      },
      transfers: transfers ?? [],
      stats,
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { toChain, amountUsdc } = await req.json()
    if (!toChain || !amountUsdc) throw new Error('Missing toChain or amountUsdc')
    if (amountUsdc < 0.01) throw new Error('Minimum 0.01 USDC')

    const account = getAgentAccount()
    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(process.env.ARC_RPC_URL),
    })

    const destinationDomain = CCTP_DOMAINS[toChain]
    if (destinationDomain === undefined) throw new Error(`Unsupported chain: ${toChain}`)

    const usdcBalance = await getUsdcBalance(account.address)
    if (usdcBalance < amountUsdc + 0.01) throw new Error(`Insufficient USDC. Have ${usdcBalance.toFixed(4)}, need ${(amountUsdc + 0.01).toFixed(4)}`)

    const approveHash = await walletClient.writeContract({
      address: CONTRACTS.USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.CCTP_MESSENGER, BigInt(Math.floor(amountUsdc * 1e6))],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveHash })

    const mintRecipient = `0x000000000000000000000000${account.address.slice(2)}` as `0x${string}`

    const burnHash = await walletClient.writeContract({
      address: CONTRACTS.CCTP_MESSENGER,
      abi: CCTP_MESSENGER_ABI,
      functionName: 'depositForBurn',
      args: [
        BigInt(Math.floor(amountUsdc * 1e6)),
        destinationDomain,
        mintRecipient,
        CONTRACTS.USDC,
        `0x${'0'.repeat(64)}` as `0x${string}`,
        BigInt(0),
        2000,
      ],
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash: burnHash })

    const supabase = getSupabase()
    await supabase.from('cctp_transfers').insert({
      from_chain: 'Arc Testnet',
      to_chain: toChain,
      amount_usdc: amountUsdc,
      status: receipt.status === 'success' ? 'burned' : 'failed',
      burn_tx_hash: burnHash,
      destination_domain: destinationDomain,
    })

    return NextResponse.json({
      success: true,
      burnTxHash: burnHash,
      explorerUrl: `https://testnet.arcscan.app/tx/${burnHash}`,
      blockNumber: receipt.blockNumber.toString(),
      message: `${amountUsdc} USDC burned on Arc Testnet for CCTP transfer to ${toChain}. Circle attestation will process minting on destination.`,
    })
  } catch (err) {
    console.error('[cctp] error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}