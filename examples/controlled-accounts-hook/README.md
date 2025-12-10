# Controlled Accounts Hook Example

This example shows how to resolve **ERC‑8092 controlled accounts** for an ENS profile using:

- A Hook text record on the profile resolver; and
- A `CCResolver` implementation that:
  - Reads associations from an `AssociationsStore` (ERC‑8092);
  - Enforces the signing rules; and
  - Returns a YAML payload describing the controlled accounts.

There is **no ECS registry in the critical path** here — just ENS + a resolver that understands ERC‑8092.

## On‑chain setup (Sepolia example)

Assume you have:

- `CCResolver` deployed on Sepolia at some address, e.g.:
  - `0xAE5A879A021982B65A691dFdcE83528e8e13dFd3`
- An `AssociationsStore` deployed and wired into `CCResolver`
- A controlled accounts set registered as ID `0` for some profile account

On the profile `test-user.eth` you set this Hook text record on its resolver:

- **Key on the profile resolver:**

  ```text
  eth.ecs.controlled-accounts.delegates
  ```

- **Value on the profile resolver (string-based Hook):**

  ```text
  hook("text(0x1c47e8962cdc72f81e30c1feb8e83ff7381bd09b6112397e4881e05aae201a56,'eth.ecs.controlled-accounts:0')",0xAE5A879A021982B65A691dFdcE83528e8e13dFd3)
  ```

Where:

- `0x1c47…1a56` is `namehash("test-user.eth")`.
- The inner key is exactly: `eth.ecs.controlled-accounts:0`.
- The resolver address is your `CCResolver` contract on Sepolia.

The `CCResolver` implements:

- `text(node, "eth.ecs.controlled-accounts:0") -> string`

and returns a YAML payload like:

```yaml
id: 0
registeredAt: 1765325040
parent: "0x0001000003aa36a7144d45cd7472f2c46e81734c561a2d0b4b66c8fefe"
children:
  - "0x0001000003aa36a714f935f966a073746a9ee0f6a685a41da23a64e1d1"
  - "0x0001000003aa36a714cc8d7b159eafa8a2c4ca5c88c3f6b760761dbf28"
```

where `parent` and `children` are ERC‑7930 interoperable addresses for the profile and its delegates.

## Client flow

Given a profile ENS name `profileName` (e.g. `test-user.eth`), the client:

1. Resolves the Hook text record:

   ```ts
   const hookKey = 'eth.ecs.controlled-accounts.delegates'
   const hookValue = await client.getEnsText({ name: profileName, key: hookKey })
   ```

2. Parses the Hook value:

   - Confirms it starts with `hook(`.
   - Extracts:
     - The inner function spec, e.g. `text(0x<namehash>,'eth.ecs.controlled-accounts:0')`
     - The resolver address, e.g. `0xAE5A…Fd3`.
   - Extracts the inner credential key: `eth.ecs.controlled-accounts:0`.

3. Recomputes `node = namehash(profileName)` (for safety).

4. Calls the resolver’s `text` method:

   ```ts
   const yaml = await client.readContract({
     address: ccResolverAddress,
     abi: TEXT_ABI,
     functionName: 'text',
     args: [node, 'eth.ecs.controlled-accounts:0'],
   })
   ```

5. Interprets the YAML as the controlled account set for that profile (parent + children).

## Example helper (viem)

`resolveControlledAccounts.ts` contains a minimal viem helper:

```ts
import { resolveControlledAccounts } from './resolveControlledAccounts'

const { yaml, resolver } = await resolveControlledAccounts({
  profileName: 'test-user.eth',
  rpcUrl: process.env.SEPOLIA_RPC_URL!,
})

console.log('Controlled accounts YAML:\n', yaml)
console.log('Resolved via CCResolver:', resolver)
```

This helper:

- Reads the Hook at `eth.ecs.controlled-accounts.delegates`.
- Parses the Hook to find:
  - The CCResolver address
  - The ERC‑8092 credential key (e.g. `eth.ecs.controlled-accounts:0`)
- Calls `text(node, key)` on `CCResolver`.
- Returns the YAML string and the resolver address.

You can adapt this into a wallet, dapp, or indexer to surface controlled/associated accounts for ENS profiles that opt into this pattern. The only requirement is that the resolver at the Hook address implements `text(bytes32,string)` and understands the controlled‑accounts key you specify.

