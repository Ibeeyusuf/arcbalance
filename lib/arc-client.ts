import { createPublicClient, createWalletClient, http, defineChain, parseUnits, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL || 'https://placeholder.rpc'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
})

export const CONTRACTS = {
  USDC:             '0x3600000000000000000000000000000000000000' as `0x${string}`,
  EURC:             '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as `0x${string}`,
  USYC:             '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`,
  USYC_TELLER:      '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`,
  CCTP_MESSENGER:   '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`,
  CCTP_TRANSMITTER: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as `0x${string}`,
  GATEWAY_WALLET:   '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`,
  GATEWAY_MINTER:   '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B' as `0x${string}`,
  PERMIT2:          '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
}

export const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

export function getPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL),
  })
}

export const publicClient = {
  getBlockNumber: () => getPublicClient().getBlockNumber(),
  getBalance: (args: { address: `0x${string}` }) => getPublicClient().getBalance(args),
  readContract: (args: Parameters<ReturnType<typeof createPublicClient>['readContract']>[0]) => getPublicClient().readContract(args),
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) => getPublicClient().waitForTransactionReceipt(args),
}

export function getAgentAccount() {
  const pk = process.env.AGENT_PRIVATE_KEY as `0x${string}`
  if (!pk) throw new Error('AGENT_PRIVATE_KEY not set')
  return privateKeyToAccount(pk)
}

export function getWalletClient() {
  const account = getAgentAccount()
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL),
  })
}

export async function getUsdcBalance(address: `0x${string}`): Promise<number> {
  const raw = await getPublicClient().readContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  })
  return Number(formatUnits(raw as bigint, 6))
}

export async function getUsycBalance(address: `0x${string}`): Promise<number> {
  try {
    const raw = await getPublicClient().readContract({
      address: CONTRACTS.USYC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    })
    return Number(formatUnits(raw as bigint, 6))
  } catch { return 0 }
}

export async function getBlockNumber(): Promise<bigint> {
  return getPublicClient().getBlockNumber()
}

export const toUsdc = (amount: number) => parseUnits(amount.toFixed(6), 6)