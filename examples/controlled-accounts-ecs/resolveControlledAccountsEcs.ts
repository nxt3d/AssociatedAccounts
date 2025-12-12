import {
  createECSClient,
  getResolverAge,
  getResolverInfo,
  resolveCredential,
  sepolia,
} from '@nxt3d/ecsjs'

export type ControlledAccountsEcsResolution = {
  yaml: string
  resolver: `0x${string}`
  label: string
  ensName: string
  ageInDays: number
  review: string
}

export type ParsedGenericTextHook = {
  resolver: `0x${string}`
}

export function parseGenericTextHook(hookValue: string): ParsedGenericTextHook {
  const trimmed = hookValue.trim()

  if (!trimmed.startsWith('hook(')) {
    throw new Error(`Text record is not a hook(): ${hookValue}`)
  }

  const match = trimmed.match(
    /^hook\(\s*"text\((0x[0-9a-fA-F]{64}),'([^']+)'\)"\s*,\s*(0x[0-9a-fA-F]{40})\s*\)\s*$/,
  )
  if (!match) {
    throw new Error(`Unsupported ECS hook format: ${hookValue}`)
  }

  const resolverAddrRaw = match[3] as string
  const resolver = resolverAddrRaw as `0x${string}`

  return { resolver }
}

/**
 * Resolve controlled accounts for an ENS profile using ECS:
 *
 * 1. Read a generic Hook from the profile resolver:
 *    hook("text(bytes32,string)", 0x<ResolverAddress>)
 * 2. Use ECS to look up the resolver label and metadata.
 * 3. Enforce optional trust / age constraints and expected label.
 * 4. Resolve the YAML credential for:
 *    key = "eth.ecs.controlled-accounts:<associationId>"
 *    on the ENS name "<label>.ecs.eth" (e.g. "controlled-accounts.ecs.eth").
 */
export async function resolveControlledAccountsViaEcs(params: {
  profileName: string
  associationId: number
  rpcUrl: string
  hookKey?: string
  /** Expected ECS label for the resolver (default: "controlled-accounts"). */
  expectedLabel?: string
  /** Optional minimum resolver age in days for trust checks (default: 0 = no check). */
  minResolverAgeDays?: number
}): Promise<ControlledAccountsEcsResolution> {
  const {
    profileName,
    associationId,
    rpcUrl,
    hookKey = 'eth.ecs.controlled-accounts.delegates',
    expectedLabel = 'controlled-accounts-base',
    minResolverAgeDays = 0,
  } = params

  const client = createECSClient({
    chain: sepolia,
    rpcUrl,
  })

  // 1. Read the Hook from the profile resolver
  const hookValue = await client.getEnsText({
    name: profileName,
    key: hookKey,
  })

  if (!hookValue) {
    throw new Error(
      `No ECS hook text record set for key "${hookKey}" on ${profileName}`,
    )
  }

  // 2. Parse the generic Hook into a resolver address
  const { resolver } = parseGenericTextHook(hookValue)

  // 3. Look up resolver metadata in ECS
  const { label, resolverUpdated, review } = await getResolverInfo(
    client,
    resolver,
  )

  const ageInDays = Math.floor(getResolverAge(resolverUpdated) / 86400)

  if (expectedLabel && label !== expectedLabel) {
    throw new Error(
      `Unexpected ECS label "${label}" for resolver ${resolver} (expected "${expectedLabel}")`,
    )
  }

  if (minResolverAgeDays > 0 && ageInDays < minResolverAgeDays) {
    throw new Error(
      `ECS resolver "${label}.ecs.eth" (${resolver}) is too new: ${ageInDays} days old (minimum ${minResolverAgeDays} days required)`,
    )
  }

  const ensName = `${label}.ecs.eth`
  const credentialKey = `eth.ecs.controlled-accounts:${associationId}`

  // 4. Resolve the credential via ECS (resolver → text(node,key))
  const resolved = await resolveCredential(client, resolver, credentialKey)

  if (!resolved) {
    throw new Error(
      `No credential found for key "${credentialKey}" on ECS resolver "${ensName}" (${resolver})`,
    )
  }

  return {
    yaml: resolved,
    resolver,
    label,
    ensName,
    ageInDays,
    review,
  }
}
