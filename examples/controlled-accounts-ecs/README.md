# Controlled Accounts ECS Example

This example shows how to resolve **[ERC‑8092](https://ethereum-magicians.org/t/erc-8092-associated-accounts/26858) controlled accounts** using:

- A Hook text record on an ENS profile that points to a **known ECS credential resolver** behind `controlled-accounts-base.ecs.eth`; and
- The [`@nxt3d/ecsjs`](https://www.npmjs.com/package/@nxt3d/ecsjs) client to:
  - Look up resolver metadata in the ECS Registry,
  - Apply basic trust / freshness checks, and
  - Resolve a YAML credential from the `controlled-accounts-base` resolver (e.g. `controlled-accounts-base.ecs.eth`) that may serve its data offchain via **[ERC‑3668](https://eips.ethereum.org/EIPS/eip-3668) / CCIP‑Read**.

Compared to the onchain-only Hook example in `examples/controlled-accounts-hook`, this flow goes through **ECS** and can resolve via a credential resolver that itself uses CCIP‑Read (for example, to read from a CCResolver on Base Sepolia).

## Running this example

1. Configure the example as described in the **Configuration** section below.
2. From the `AssociatedAccounts` repo root, run:

   ```sh
   npm install
   npm run example:controlled-accounts-ecs
   ```

`npm run example:controlled-accounts-ecs` runs `examples/controlled-accounts-ecs/test-ecs.ts`, which:

- Connects to Sepolia using a configured RPC URL.
- Reads a Hook text record from an ENS profile (e.g. `test-user.eth`).
- Parses a Hook of the form:

  ```text
  hook("text(0x<namehash>,'eth.ecs.controlled-accounts-base:<id>')",0xResolverAddress)
  ```

  to recover the credential resolver address.

- Uses ECS to:
  - Map the resolver address to its registered label (expected: `controlled-accounts-base`),
  - Check when that resolver was last updated, and
  - Optionally enforce a minimum resolver age.
- Constructs the ENS name `${label}.ecs.eth` (e.g. `controlled-accounts-base.ecs.eth`).
- Resolves a controlled-accounts credential key of the form:

  ```text
  eth.ecs.controlled-accounts:<associationId>
  ```

  where `<associationId>` is the ERC‑8092 controlled accounts set ID.

### Configuration

Edit `examples/controlled-accounts-ecs/test-ecs.ts` and update:

- `profileName` — ENS name whose resolver has a Hook text record pointing to a **controlled-accounts ECS resolver**.
- `associationId` — ERC‑8092 controlled accounts ID to resolve.
- `rpcUrl` — Valid Sepolia RPC endpoint. This must be set to a working Sepolia RPC URL before running the example.
- `hookKey` (optional) — Text record key on the profile resolver that stores the Hook. Defaults to:

  ```ts
  const hookKey = 'eth.ecs.controlled-accounts.delegates'
  ```

The following conditions must hold:

- The controlled-accounts resolver is registered in the ECS Registry with label `controlled-accounts-base`.
- The resolver for `controlled-accounts-base.ecs.eth` is the same address that the Hook on the profile points to.
- The resolver defines a text record at:

  ```text
  key = eth.ecs.controlled-accounts:<associationId>
  ```

that returns a YAML payload as described in `CCResolver-README.md`.

## Example output

When configured correctly, running the example prints:

- The resolved YAML describing the controlled accounts (parent + children), and
- Information about the ECS resolver (label, address, age in days, and review status).

## Demo deployments

The current demo setup uses the following contracts:

- **L1 CCIP-Read offchain resolver (Sepolia):**  
  `0xb7D2F686f261777eb19f4A28B75dD24A876f420e` ✅  
  [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xb7D2F686f261777eb19f4A28B75dD24A876f420e)  
  Resolves `text(bytes32,string)` for controlled-accounts keys and emits `OffchainLookup`.

- **Base Sepolia CCResolver (AssociationsStore-backed):**  
  `0x500DfEc362DB5141A6a15Be3AF380216219D3246` ✅  
  [View on Base Sepolia Explorer](https://sepolia.basescan.org/address/0x500DfEc362DB5141A6a15Be3AF380216219D3246)  
  Implements `text(node, "eth.ecs.controlled-accounts:<id>") -> YAML` for controlled-accounts sets.

## Offchain gateway (demo)

For local testing, an HTTP gateway that bridges the L1 offchain resolver to the Base Sepolia CCResolver is provided at:

- `scripts/offchain-gateway.mjs`

The gateway:

- Accepts CCIP-Read POST requests from `ControlledAccountsOffchainResolver` (payload containing `data`, `sender`, and `extraData`).
- Decodes `(node, key)` from the `data` field.
- Calls `text(node, key)` on the Base Sepolia CCResolver at `0x500DfEc362DB5141A6a15Be3AF380216219D3246`.
- Returns the YAML credential ABI-encoded as `(string)` for the resolver callback.

Run the gateway with:

```bash
BASE_SEPOLIA_RPC_URL="https://base-sepolia.infura.io/v3/YOUR_PROJECT_ID" \
BASE_SEPOLIA_CC_RESOLVER_ADDRESS="0x500DfEc362DB5141A6a15Be3AF380216219D3246" \
npm run gateway
```

The L1 `ControlledAccountsOffchainResolver` should be configured with its `url` pointing at the public URL.
