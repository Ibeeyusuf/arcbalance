import { createPublicClient, createWalletClient, http, defineChain, parseUnits, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// ─── Arc Testnet Chain Definition ────────────────────────────────────────────
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL || ''] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

// ─── Public Client (read-only) ────────────────────────────────────────────────
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL),
})

// ─── Wallet Client (agent wallet) ────────────────────────────────────────────
export function getAgentWalletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY as `0x${string}`
  if (!pk) throw new Error('AGENT_PRIVATE_KEY not set')
  const account = privateKeyToAccount(pk)
  return createWalletClient({ account, chain: arcTestnet, transport: http(process.env.ARC_RPC_URL) })
}

// ─── USDC Contract (Arc Testnet) ──────────────────────────────────────────────
// Arc uses USDC as the native token, but there's also an ERC-20 for portfolio tracking
// Testnet USDC address — check arc docs / faucet for the deployed address
export const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}` // replace with Arc testnet address

export const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const toUsdc = (amount: number) => parseUnits(amount.toString(), 6)
export const fromUsdc = (raw: bigint) => Number(formatUnits(raw, 6))

export async function getBlockNumber() {
  return publicClient.getBlockNumber()
}

export async function getNativeBalance(address: `0x${string}`) {
  const bal = await publicClient.getBalance({ address })
  return fromUsdc(bal)
}
