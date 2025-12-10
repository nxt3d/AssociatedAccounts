import {
  createPublicClient,
  http,
  encodeFunctionData,
  decodeFunctionResult,
  namehash,
} from 'viem'
import { sepolia } from 'viem/chains'

// Minimal ABI for ENS text(bytes32,string)
const TEXT_ABI = [
  {
    type: 'function',
    name: 'text',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: 'value', type: 'string' }],
  },
] as const

// Minimal ABI for CCResolver.resolve(bytes,bytes)
const CC_RESOLVER_ABI = [
  {
    type: 'function',
    name: 'resolve',
    stateMutability: 'view',
    inputs: [
      { name: 'name', type: 'bytes' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: 'result', type: 'bytes' }],
  },
] as const

export type ControlledAccountsResolution = {
  yaml: string
  resolver: `0x${string}`
}

/**
 * Resolve controlled accounts for an ENS profile using a Hook that points to a CCResolver.
 *
 * Hook format (string-based, per RFC 4648 hex and Hooks spec):
 *
 * hook(
 *   "text(0x<namehash(profileName)>,'eth.ecs.controlled-accounts:0')",
 *   0x<CCResolverAddress>
 * )
 *
 * The CCResolver implements text(node, "eth.ecs.controlled-accounts:0") and returns
 * an ERC‑8092 YAML document describing the parent + delegate accounts.
 */
export async function resolveControlledAccounts(params: {
  profileName: string
  rpcUrl: string
  hookKey?: string
}): Promise<ControlledAccountsResolution> {
  const { profileName, rpcUrl, hookKey = 'eth.ecs.controlled-accounts.delegates' } = params

  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  })

  // 1. Read the Hook from the profile resolver
  const hookValue = await client.getEnsText({
    name: profileName,
    key: hookKey,
  })

  if (!hookValue) {
    throw new Error(`No hook text record set for key "${hookKey}" on ${profileName}`)
  }
  if (!hookValue.trim().startsWith('hook(')) {
    throw new Error(`Text record for "${hookKey}" is not a hook(): ${hookValue}`)
  }

  const hookMatch = hookValue
    .trim()
    .match(/^hook\(\s*"([^"]+)"\s*,\s*(0x[0-9a-fA-F]{40})\s*\)\s*$/)

  if (!hookMatch) {
    throw new Error(`Unsupported hook format: ${hookValue}`)
  }

  const [, fnSpec, resolverAddrRaw] = hookMatch
  const resolver = resolverAddrRaw as `0x${string}`

  // Expect inner function spec like: text(0x<namehash>, 'eth.ecs.controlled-accounts:0')
  const keyMatch = fnSpec.match(/'([^']+)'/)
  if (!keyMatch) {
    throw new Error(`Could not parse credential key from hook function spec: ${fnSpec}`)
  }
  const credentialKey = keyMatch[1]

  // For safety, recompute namehash from profileName rather than trusting the embedded node
  const node = namehash(profileName)

  // call resolver.text(node, key) directly on CCResolver in the Sepolia deployment.
  const yaml = await client.readContract({
    address: resolver,
    abi: TEXT_ABI,
    functionName: 'text',
    args: [node, credentialKey],
  })

  return {
    yaml: yaml as string,
    resolver,
  }
}
