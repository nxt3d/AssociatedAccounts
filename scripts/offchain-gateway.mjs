import http from "node:http";
import {
  createPublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
  http as viemHttp,
  parseAbiParameters,
} from "viem";

const PORT = Number(process.env.PORT || 8787);

// Base Sepolia RPC used to read from the on-chain CCResolver that already
// returns the controlled-accounts YAML.
const BASE_SEPOLIA_RPC_URL =
  "https://base-sepolia.infura.io/v3/your_api_key";

// CCResolver on Base Sepolia that implements:
//   text(bytes32 node, string key) -> string YAML
const BASE_SEPOLIA_CC_RESOLVER_ADDRESS =
  "0x500DfEc362DB5141A6a15Be3AF380216219D3246";

const TEXT_ABI = [
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "value", type: "string" }],
  },
];

const client = createPublicClient({
  transport: viemHttp(BASE_SEPOLIA_RPC_URL),
});

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  let payload;
  try {
    payload = body ? JSON.parse(body) : {};
  } catch (err) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  // Typical CCIP-Read gateways receive:
  // {
  //   "data": "0x...",       // callData from OffchainLookup (abi.encode(node, key))
  //   "sender": "0x...",     // resolver address
  //   "extraData": "0x..."   // extraData from OffchainLookup
  // }

  const { data } = payload;
  if (typeof data !== "string") {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Missing data field in request" }));
    return;
  }

  let node, key;
  try {
    [node, key] = decodeAbiParameters(
      parseAbiParameters("bytes32, string"),
      data
    );
  } catch (err) {
    console.error("Failed to decode callData:", err);
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Invalid callData encoding" }));
    return;
  }

  console.log("CCIP-Read request for text(node, key):", {
    node,
    key,
    ccResolver: BASE_SEPOLIA_CC_RESOLVER_ADDRESS,
  });

  let yaml;
  try {
    yaml = await client.readContract({
      address: BASE_SEPOLIA_CC_RESOLVER_ADDRESS,
      abi: TEXT_ABI,
      functionName: "text",
      args: [node, key],
    });
  } catch (err) {
    console.error("Error calling Base Sepolia CCResolver:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "Failed to read from Base Sepolia CCResolver",
      })
    );
    return;
  }

  const encoded = encodeAbiParameters(parseAbiParameters("string"), [yaml]);

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ data: encoded }));
});

server.listen(PORT, () => {
  console.log(`Offchain gateway listening on http://localhost:${PORT}`);
  console.log("Base Sepolia CCResolver:", BASE_SEPOLIA_CC_RESOLVER_ADDRESS);
});
