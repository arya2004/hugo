# Verified SDK / integration references

Inspected on 2026-11-05. Versions are pinned in the two package-lock.json files. The implementation was checked against installed declaration files as well as these primary references.

| Surface | Primary reference | What was verified |
|---|---|---|
| Supabase SSR | https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs | createBrowserClient, createServerClient cookie adapters, Next.js proxy and getClaims |
| Arkiv | https://docs.arkiv.network/start-here/first-entity/ | rabdi({accessKey}), createPublicClient/createWalletClient, defineSchema, createEntity(schema,data,{expiration}), ownedBy queries |
| Arkiv package | https://github.com/Arkiv-Network/arkiv-sdk-js | Installed SDK 1.0.1 declarations successfully typecheck actual adapter calls |
| CRE | https://docs.chain.link/cre/getting-started/cli-installation/macos-linux | Official CLI download, checksum validation, `cre version`; v1.39.0 installed |
| CRE releases | https://github.com/smartcontractkit/cre-cli/releases/tag/v1.39.0 | darwin arm64 archive SHA256 `f0bfb90928cbdf3fccab6ec5420167681edb6ea566982b31016275bc77e09dfb` matched downloaded archive |
| CRE templates | https://github.com/smartcontractkit/cre-templates/tree/d0223f31182c76bc36b1cc9d47b13b18efcf2bf6 | Inspected read-data-feeds-ts, kv-store-ts HTTP/secret calls, project.yaml/workflow.yaml, official template TypeScript 5.9.3 |
| CRE SDK | https://github.com/smartcontractkit/cre-sdk-typescript | Installed 1.23.0 declarations for Runtime.getSecret, HTTPClient.sendRequest consensus wrapper, EVMClient.callContract, encodeCallMsg, finalized block helper and Runner |
| 0G | https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview | Current compute documentation; router contract also follows normative integration spec. Model ID must come from actual 0G account; no response or TEE proof fabricated |
| GitHub | https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event | Only job UUID dispatched to trusted central repo; 204 required |
| Arc | https://docs.arc.io/arc/references/connect-to-arc | Network facts cross-checked with actual RPC/USDC decimals read; see evidence/network-smoke.log |
| Hardhat 3 | https://hardhat.org/docs/reference/configuration | In-process edr-simulated network configuration; installed network.create/provider/close types checked in runner |

CRE initialization and simulation authentication failures are retained under `cre/evidence`. The failed `cre init` is not described as a successful official scaffold operation. Local SDK compilation does not substitute for sponsor live calls.
