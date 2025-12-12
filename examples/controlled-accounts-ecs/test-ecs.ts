import { resolveControlledAccountsViaEcs } from './resolveControlledAccountsEcs'

async function main() {
  // ENS name whose resolver:
  //  - has a generic ECS Hook text record set at `eth.ecs.controlled-accounts.delegates`
  //  - and whose Hook value points to a controlled-accounts ECS resolver
  const profileName = 'test-user.eth'

  // ERC-8092 ControlledAccounts ID to resolve for this profile
  const associationId = 0

  // Sepolia RPC endpoint used by ecsjs / viem to:
  //  - read the Hook text record on the profile resolver
  //  - query the ECS Registry and the controlled-accounts resolver (including CCIP-Read if used)
  const rpcUrl = 'https://sepolia.infura.io/v3/your_api_key'

  const result = await resolveControlledAccountsViaEcs({
    profileName,
    associationId,
    rpcUrl,
    // For high-security profiles you might set this to 90 (days) or more:
    // minResolverAgeDays: 90,
  })

  console.log('Controlled accounts YAML:')
  process.stdout.write(result.yaml + '\n')
  console.log('Resolved via ECS resolver:', result.resolver)
  console.log('ECS label:', result.label)
  console.log('ECS ENS name:', result.ensName)
  console.log('Resolver age (days):', result.ageInDays)
  console.log('Resolver review status:', result.review || 'None')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
