# Deployment, setup, test and demo runbook — normative

This document takes a newly generated Codex application from a clean repository to a working **ETHGlobal Mumbai 2026 testnet demonstration**. It is written for **Vercel Hobby + Supabase Free + public GitHub Actions** with no always-on worker. The files in this blueprint are the specification and reference snippets; **the deployable application is the `app/` directory that Codex must generate**. Do not present these instructions as evidence that it has already been deployed.

## 0. System prerequisites and accounts

Install: **Node.js 22 LTS**, npm, Git, GitHub CLI `gh` (optional), a modern EVM wallet, Foundry (`forge`, `cast`), and current official Chainlink CRE CLI. Use npm lockfile and record `node --version`, `npm --version`, `forge --version`, `cre --version` in implementation status. Need a GitHub account, a **public** central project repository, a **second public fixture repository**, a Supabase project, Vercel account, 0G Private Computer API account, Arc Studio project, wallets funded with **test-only Arc USDC** and **Arkiv Rabdi tGLM**. Some services have usage credits or limits; never infer free inference from free application hosting.

Official starting points: [ETHGlobal Mumbai bounty requirements](https://ethglobal.com/events/mumbai/prizes), [Arc Studio](https://studio.arc.io), [Arc Connect](https://docs.arc.io/arc/references/connect-to-arc), [CRE getting started](https://docs.chain.link/cre/getting-started/part-1-project-setup), [Arkiv first entity](https://docs.arkiv.network/start-here/first-entity/), [0G compute](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview), [Supabase GitHub OAuth](https://supabase.com/docs/guides/auth/social-login/auth-github), [Vercel deployments](https://vercel.com/docs/deployments/overview).

**Safety:** All deployment and recipient wallets are test-only. Never paste wallet private keys into Codex chat, commit them or use a wallet containing mainnet funds. GitHub Actions logs and sponsor demos must not print tokens. Use a strong random `PAYOUT_VOUCHER_SIGNER_KEY` from a **separate** test wallet that is not the DAO-owner wallet.

## 1. Project creation and Codex implementation

```bash
mkdir proof-of-contribution && cd proof-of-contribution
# Copy the entire blueprint (including hidden .env.example) into this directory.
git init
git branch -M main
bash scripts/check-structure.sh
# The following is an example command once Codex CLI is installed and authenticated.
codex
```

In Codex CLI, instruct it: **"Read `CODEX_TASK.md` and all linked specifications. Implement the complete application in `app/`, execute all tests available offline, and maintain `app/docs/IMPLEMENTATION_STATUS.md` with evidence. Do not fake Arc Studio/CRE/Arkiv integrations or deployed URLs."** Codex should write application code, contract tests, migrations, API route handlers and UI. This blueprint deliberately does **not** imply those generated files already exist.

Expected post-generation local structure:

```text
proof-of-contribution/
  CODEX_TASK.md, README.md, docs/, contracts/, sql/, examples/
  app/
    package.json, package-lock.json, .env.example
    src/app/, src/lib/, src/components/, src/server/
    contracts/ or foundry/, tests/, scripts/, cre/
    supabase/migrations/001_initial.sql
    supabase/migrations/002_atomic_functions.sql
    .github/workflows/evaluate.yml
    docs/IMPLEMENTATION_STATUS.md
    docs/DEPLOYED.md
```

**Mandatory initial commands** after Codex scaffolds `app/`:

```bash
cd app
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Codex must declare these npm scripts and fix failures. `npm run test:contracts` must run Foundry/Hardhat tests and not silently skip tests. Confirm no secret is committed (`git grep -nE 'ghp_|github_pat_|sk-[A-Za-z0-9]|PRIVATE_KEY=0x[0-9a-fA-F]{64}' -- ':!*.md'` is a coarse check, not a substitute for secret scanning). Place `.env.local` in gitignore.

## 2. Arc Studio and the contract (do before polishing Web2 UI)

1. Open `https://studio.arc.io` and create a new app, using the **exact Arc prompt in `docs/SMART_CONTRACT.md`**. Work through the build/test/deploy flow in Studio and keep the **shareable Studio project URL** in `app/docs/DEPLOYED.md`.
2. Reconcile the Studio-generated application with `contracts/ContributionTreasury.sol`: fundable program treasury, budget reservation, EIP-712 reward vouchers, independent claims, expiry, duplicate protection. Merely mentioning Arc in source does not satisfy the sponsor's Studio requirement.
3. Wallet → add Arc Testnet (chain ID `5042002`, RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`). Obtain test USDC/gas from `https://faucet.circle.com`, Arc Testnet selection. Check actual balances.
4. Verify the ERC-20 interface `0x3600000000000000000000000000000000000000` and `decimals() == 6` via a testnet read. Gas is denominated in native USDC with a separate 18-decimal precision. Use **micro-USDC integers** for ERC-20 contract transfers and DB accounting.
5. Compile and test the treasury. For Foundry, Codex may initialize with `forge init` and `forge install OpenZeppelin/openzeppelin-contracts`, then commit lock/remappings. Run:

```bash
forge build
forge test -vv
```

6. Deploy via the supported Arc Studio flow and record **actual chain ID, contract address, deployment tx, deployed ABI, Studio share URL**. Never invent these values. In Vercel and local `.env.local`, set `NEXT_PUBLIC_TREASURY_ADDRESS` and the public Arc variables from `.env.example`.
7. **Smoke test on live Arc Testnet:** Owner wallet calls `createProgram`; both owner and another wallet approve USDC then call `fund`; confirm two `Deposited` events; owner reserves a funded epoch; two distinct claimant wallets receive properly signed vouchers and claim; replay one claim to confirm revert; attempt overbudget reserve to confirm revert.
8. Store `PAYOUT_VOUCHER_SIGNER_KEY` only in server environment. Check the corresponding address exactly matches `programs(programId).voucherSigner` onchain. Owner wallet remains user-controlled, not server-held.

**Important trust boundary:** the Solidity reference enforces the **epoch budget**, but does not embed a Merkle root of each approved individual's amount. The backend voucher signer can allocate the reserved budget to anyone if compromised. This is acceptable only as an explicitly disclosed **trusted hackathon prototype**; for a trust-minimized implementation, upgrade to per-recipient Merkle commitments or onchain allocations. Never market it as trustlessly enforcing AI fairness.

## 3. Supabase Free — database and OAuth

1. Create a project at `https://supabase.com/dashboard`, pick a region near India, store the database password securely and wait until ready.
2. Project Settings → API: record **Project URL**, **publishable/anon key**, **service role key**. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public configuration. `SUPABASE_SERVICE_ROLE_KEY` is **server only**.
3. SQL Editor: paste `sql/001_initial.sql`, execute once. Then run the supplied `sql/002_atomic_functions.sql` for exclusive job leasing/finishing. Have Codex additionally implement the epoch-preview/approval atomic transaction or privileged RPC required by `docs/API_AND_DATA.md`. Verify RLS is enabled for all application tables and that `anon` and `authenticated` roles cannot query private tables directly. The service-role key bypasses RLS, so every Next.js route must perform its own authorization check.
4. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. Set authorization callback URL **exactly** to `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`, not `/auth/callback` on Vercel. Copy Client ID and Secret **into Supabase → Authentication → Providers → GitHub**; they do not belong in `.env.local`.
5. Supabase → Authentication → URL Configuration: Site URL `http://localhost:3000` initially and allow `http://localhost:3000/auth/callback` plus later `https://<VERCEL_APP>.vercel.app/auth/callback`. Once deployed, change Site URL to deployed domain, keep local redirect allowlisted.
6. Use server-side `@supabase/ssr` PKCE and verify `auth.getClaims()` plus the immutable GitHub provider user ID from authenticated `auth.identities`. Confirm OAuth user A sees only A's claims and never B's.
7. Add no public RLS policies for private tables; expose public program data through authenticated/authorized API handlers, and Arkiv through public read-only queries.

**Migration smoke tests:** duplicate `merge_events(provider,external_repo_id,pr_number)` fails; same `allocations(epoch,provider,user)` fails; job claim race grants one lease; failure in `finish_job` rolls back all inserted evaluations/scores; `SERVICE_ROLE_KEY` is never present in browser bundles.

## 4. GitHub repos, workflows and no-cost job processing

Create two **public** repositories: (A) central `proof-of-contribution`, containing the Next.js app and worker source; (B) `poc-demo-vault`, containing a small Solidity/TypeScript project with actual reviewed PR history. Public GitHub repositories receive standard GitHub-hosted Actions minutes at no charge within GitHub's current public-repo policy; check account restrictions and quotas. The workflows are in this blueprint under `examples/` and must be copied to the corresponding repositories.

1. Central repo: `cp examples/central-repo/.github/workflows/evaluate.yml app/.github/workflows/evaluate.yml` **if the central GitHub repository root is `app/`**. If root is the blueprint, put workflow in root `.github/workflows/evaluate.yml` instead: GitHub searches workflows only at repo root. Adjust `working-directory` and `cache-dependency-path` accordingly. This root-path distinction is a common failure.
2. Central repo Settings → Secrets and variables → Actions → Secrets:
   - `WORKER_API_SECRET`: strong random secret, identical to Vercel server secret.
   - `GITHUB_READ_TOKEN`: read-only, scope limited to fixture repo when possible.
   - `OG_API_KEY`: 0G API key.
   Variables:
   - `POC_APP_URL`: deployed `https://...vercel.app` URL, no slash.
   - `OG_MODEL`: exact model identifier shown in 0G, text-capable.
3. In GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens, create a separate token for **central** `repository_dispatch`, with **Contents: write** on central repo only. Put it in **Vercel** as `GITHUB_DISPATCH_TOKEN`, not in either repo's workflow. Set `GITHUB_WORKER_OWNER/REPO`.
4. Fixture repo: copy `examples/source-repo/.github/workflows/proof-of-contribution.yml` to `.github/workflows/proof-of-contribution.yml`. Its Actions secrets:
   - `POC_API_URL = https://<VERCEL_APP>.vercel.app`
   - `POC_MERGE_TRIGGER_SECRET = <same value as Vercel MERGE_TRIGGER_SECRET>`
   **No 0G token, service-role key, Arc private key or dispatch PAT in fixture repo.**
5. Authenticate incoming POST `/api/merge/github` with a constant-time secret compare, check configured repo ID and verify `merged=true` plus exact merge SHA through GitHub REST. Use idempotent unique constraint; insert a durable job; call GitHub `POST /repos/{owner}/{repo}/dispatches` event type `poc-evaluate` with only `jobId`. Dispatch failure leaves a retriable queued job; do not mark as evaluated.
6. Central workflow calls `npm run worker:evaluate -- --job-id "$JOB_ID"`, authenticates to `/api/internal/jobs/{id}`, leases job atomically, fetches **real** PR and review evidence from GitHub, calls 0G, validates strictly, then POSTs signed/secret-authenticated completion to same API. No source-repo code should be executed with privileged workflow secrets. The central workflow can check out only the **trusted central worker code**.
7. End-to-end test: open PR in fixture repo, ensure two attributed contributors and one real reviewer; merge PR; observe fixture notify job, central Actions run, 0G request ID and two eligible positive score rows; reviewer-only remains score zero; re-run event and verify no duplicates.

For reliability, configure a `workflow_dispatch` manual replay on central workflow (already in template) and a UI "Retry evaluation" only for authorized maintainers, reusing the same logical `jobId`. Since there is no persistent worker, a failed `repository_dispatch` needs a deliberate retry/reconcile path. Don't claim automatic retries will occur if no scheduler is installed.

## 5. 0G model and structured assessment

1. Visit `https://pc.0g.ai`, create a router API key and confirm any hackathon credits or token balance. Find an **available text-capable model**; put exact ID in `OG_MODEL` central Actions variable (no guessed default).
2. The worker uses `OG_BASE_URL=https://router-api.0g.ai/v1`, `OG_API_KEY` central Actions secret, and OpenAI-compatible chat/completions request. Apply output token/input size budgets, Zod schema, impact scores 0..100, evidence links and fixed role semantics.
3. Reviewer-only identities must receive `impactScore=0`. Real contributors can be scored for code/tests/docs; review comments are context, not payout claims. Use stable forge numeric IDs; no reliance on commit email.
4. On arbitrary code, markdown, issue descriptions and PR comments, treat content as **untrusted data**, not model instructions. Never allow the model to create a wallet address, approve a claim, or set an absolute USDC amount.
5. Persist response ID, model, evidence hash and evaluation version. Do not claim verifiable TEE processing merely because a normal API returned a request ID.
6. If 0G is unavailable, show failed job and use a clearly marked deterministic fixture **only for UI testing**, never as the claimed sponsor demo.

## 6. Period close, funding policy and contributor claims

1. **Immediate evaluation:** contributor scores persist as soon as worker completes. They are not monetary promises.
2. **Continuous mode:** period inflow is sum of *verified onchain* `Deposited` logs in `[periodStart,periodEnd)` across all donors including DAO owner. Default `spend_bps=8000`. `policyBudget=floor(inflow*8000/10000)`, `budget=min(policyBudget,onchainProgramAvailable)`. No new inflow yields no new budget in the next continuous period. Prior reserved rewards remain fixed.
3. **Campaign mode:** sponsor defines a committed funded amount and number of periods; split in integer micro-USDC with final-period remainder. To avoid promising an unfunded commitment, verify program available balance at configuration and cap each reservation onchain.
4. Aggregate eligible contributors' scores from **merged PRs assigned to this epoch**, normalize by total score and round using largest remainders with stable provider-ID tie-breaks. Reviewers are excluded from payout list. Zero-score period creates no money obligation.
5. Maintainer shows exact report/score evidence and manually approves. Produce canonical report hash, then owner signs `reserveEpoch` with exact amount/hash/expiry. Treat submitted tx as pending until receipt confirms; do not mark `RESERVED` merely because wallet popup closed.
6. Contributor authenticates with GitHub OAuth, sees **only their private claim**; links a wallet via one-time, domain/chain-bound challenge and signature. Backend issues an EIP-712 voucher for the reserved epoch and approved amount; caller may submit claim to Arc; USDC transfers only to signed recipient.
7. Confirm claim via `RewardClaimed` event, reconcile its tx hash, update UI. Replay same `claimId` must revert. Two recipients must claim independently. Show lower second-period inflow changes **only second-period unreserved** payouts.
8. Private dashboard doesn't provide onchain payout privacy. Once a reward is claimed, recipients, transaction hash, token transfers and amounts are public on Arc. Do not call payouts anonymous.

**Demo shortcut:** The organizer can click "Close current demo period now" to close a short, transparently labelled demo period. Do not fabricate historical block timestamps or pretend an artificially modified rate was observed onchain. A sandbox simulator can illustrate donation-rate changes, but for a prize demo ground actual funding values in Arc deposits.

## 7. Chainlink CRE workflow — real simulation

1. Install official current CRE CLI using the CLI page linked above and authenticate. Generate from current template with `cre init`. Commit the generated workflow sources, configuration and lockfile in `app/cre/`.
2. Use **official CRE HTTP capability** to fetch an authenticated JSON evidence report from the deployed app, e.g. `/api/cre/report/{epochUuid}`. Protect endpoint with CRE secret header; avoid auth in query strings. Validate JSON and report hash.
3. Use **official CRE EVM read capability** targeting Arc Testnet `arc-testnet` to read the actual `programs(programId)` and/or `epochs(epochId)` view on your deployed treasury; compare onchain program/epoch/report/available amounts to external report. The workflow must meaningfully consume both sources.
4. Run `cre workflow simulate --help` and follow flags of the installed CLI; example shape from official getting-started guide is `cre workflow simulate <workflow> --target staging-settings`. Save a **real successful, redacted** CLI transcript with external URL, Arc testnet address, evidence hash and evaluation result.
5. Do **not** claim this simulation produced a signed CRE report onchain or executed settlement. App's maintainer approval path is a separate trusted action unless an actual CRE report receiver is deployed.

## 8. Arkiv Rabdi entity writes and query UI

1. Fund a **separate** writer wallet with tGLM using `https://hub.arkiv.network/faucet`, and obtain access key at `https://hub.arkiv.network/access-keys`.
2. Configure `ARKIV_ACCESS_KEY`, `ARKIV_WRITER_PRIVATE_KEY` as **server or central-worker secrets only**. Install `@arkiv-network/sdk`, use official `rabdi({accessKey})` chain helper; Rabdi chain ID `7794095`. This is separate from Arc; no bridge is needed.
3. On program creation, write a public schema-tagged Program entity. On completion of approved merged contribution, write a public Contribution entity with issuer wallet, GitHub provider numeric ID, merge SHA, evidence hash, project ID and neutral summary. Capture entity keys and transaction proof.
4. Build at least one public UI route **actually querying Arkiv** by issuer owner + indexed filters and rendering records, rather than reading a Postgres mirror only. A second wallet/client should be able to query the same entity independently.
5. Implement expiration intentionally: e.g. open program listing 30 days, contribution attestation 90 days. Do not publish contributor email, OAuth tokens, unpublished amounts or private evaluator text in public entities.
6. In the generated application create the five official criteria docs:

```text
app/arkiv/schema.md
app/arkiv/friction.md
app/arkiv/reach.md
app/arkiv/why-arkiv.md
app/arkiv/how-you-use-arkiv.md
```

Document actual writer addresses, entity keys, filter query, expiry, licensing, use of AI and the exact user-facing read location. If something fails, record the failure faithfully in `friction.md` and `app/docs/IMPLEMENTATION_STATUS.md`.

## 9. Deploy Next.js app to Vercel Hobby — free within plan limits

1. Push **public central repo** to GitHub. On Vercel → Add New Project → Import repo.
2. Set **Root Directory** to `app` if the Next.js app resides in `app/`; alternatively the whole root if Codex makes app the central repo root. Framework preset Next.js; build command `npm run build`; install command `npm ci` where supported, or leave detection to Vercel; output auto-detected.
3. Vercel → Project Settings → Environment Variables. Add the **Vercel column** in `docs/ENVIRONMENT.md` (do not add `OG_API_KEY` unless Vercel itself calls 0G). Variables labeled `NEXT_PUBLIC_` are intentionally exposed to browser bundles; service-role, GitHub tokens and voucher signer must be server-only. Enable at least Production; use Preview only if configured carefully. For a hackathon, choose one stable deployment URL.
4. Redeploy after setting variables and after adding `NEXT_PUBLIC_TREASURY_ADDRESS`. Visit `https://<PROJECT>.vercel.app/api/health`; health should report db/Arc statuses without any secrets. A failing Arkiv service must be clearly shown, not silently treated as success.
5. Return to Supabase → Auth URL Configuration: update Site URL and add `https://<PROJECT>.vercel.app/auth/callback` to redirect allowlist. GitHub OAuth App's callback stays the Supabase callback.
6. Set central repository Actions variable `POC_APP_URL` and fixture repository secret `POC_API_URL` to this URL. Run OAuth, Web3 donation, merge-trigger and claim flows from the deployed UI.

**No always-on server:** Next.js route handlers on Vercel receive HTTP events. Long AI inference runs in central GitHub Actions. Supabase remains the database/auth host. Be aware free plans have throttling, inactivity behavior, workflow quotas and changing terms; have local dev and real evidence saved for the hackathon demo.

## 10. Complete five-minute judge demo

| Time | Judge-facing action | Evidence |
|---|---|---|
| 0:00–0:35 | Show public funded program, GitHub repo, Arc treasury and multiple donor deposits | `ProgramCreated` + 2 `Deposited` explorer links |
| 0:35–1:15 | Show real merged PR; merge CI event and central Actions evaluation job | GitHub Actions runs, verified merge SHA |
| 1:15–2:00 | Show 0G assessment of two developers and one unpaid reviewer | Inference request ID, diff/review citations, score JSON |
| 2:00–2:50 | Close demo funding period; show donation-rate formula and approved allocation; owner reserves on Arc | Calculated micro-USDC, signed report hash, `EpochReserved` |
| 2:50–3:45 | Log in as contributor A; wallet bind; claim. Show B's independent claim; retry A's claim fails | OAuth account isolation; 2 explorer claim transactions; revert |
| 3:45–4:20 | Show CRE CLI simulation reading both external evaluation and Arc onchain state | `CRE_VALIDATED`, actual network/result logs |
| 4:20–5:00 | Show Arkiv-backed public contributor records queried from second interface; explain lowered inflow next period | Arkiv entity keys/read query and funding policy preview |

Keep a **working local browser session** logged in as owner and separate browser profiles/incognito windows for contributors A/B; avoid swapping private keys onstage. You can demonstrate the second funding period on a separate seeded program if the first program doesn't have a second real period yet; label the scenarios honestly. Record a backup video showing **actual** transactions and outputs in case a free service cold-starts or external AI temporarily fails.

## 11. Deployment artifact manifest (never invent values)

In `app/docs/DEPLOYED.md`, maintain a table with:

```text
Source GitHub repo URL:
Fixture GitHub repo URL + merged PR number/merge SHA:
Live Vercel URL:
Supabase project ref (public; no service role key):
Arc Studio shareable project URL:
Arc chain ID:
Arc treasury contract address:
Arc deployment transaction hash:
Arc program ID:
Two donation tx hashes:
Arc reservation tx hash and epoch ID:
Two claim tx hashes:
0G selected model and real inference request ID:
Chainlink CRE CLI version, workflow path, simulation transcript location:
Arkiv Rabdi chain ID and entity writer address:
Arkiv program/contribution entity keys:
Public Arkiv query and app page using the result:
Implementation status for every acceptance gate:
```

Any blank artifact must read `BLOCKED: <exact missing prerequisite>`; never replace missing addresses with example values disguised as deployments.

## 12. Failure scenarios and exact response

| Failure | Likely cause | Correct next action |
|---|---|---|
| GitHub merge does not trigger | Workflow absent on default branch, secret not set, PR wasn't merged | Check repo Actions and settings; manually dispatch the **existing** central job, not new duplicate |
| `401` from merge route | Wrong shared secret | Compare source repo Actions secret and Vercel `MERGE_TRIGGER_SECRET`; use constant-time compare |
| `403` from GitHub REST | PAT missing read permissions or wrong repo | Restrict/recreate fine-grained read token; never use dispatch PAT as read token |
| `repository_dispatch` succeeds but no run | Workflow not on central default branch, event type mismatch | Confirm `.github/workflows/evaluate.yml` at **root**, `types: [poc-evaluate]`, Actions enabled |
| 0G call fails | Invalid key, model unavailable, insufficient compute funds/credits | Test single router request, check selected model and usage; don't replace sponsor demo with mock |
| Supabase OAuth redirect fails | GitHub callback set to Vercel instead of Supabase, redirect allowlist missing | Use `https://<ref>.supabase.co/auth/v1/callback`, allow Vercel `/auth/callback` |
| Supabase tables leak | Service-role accidentally in browser / RLS policy too broad | Stop demo, rotate key, remove browser exposure, enforce server authorization |
| ERC20 `transferFrom` fails | Insufficient approval/spendable balance or mixed native/ERC20 units | Check allowance, ERC20 6 decimals, faucet funding and spender address |
| Claim signature fails | Chain ID, EIP712 type hash, voucher signer or report hash mismatch | Compare exact typed data and onchain program signer; test `hashTypedData` in vitest + Solidity |
| Claim budget exhausted | More vouchers issued than reserved or duplicate across identities | Stop voucher issuance; reconcile per-recipient approved allocations and reserved epoch budget |
| CRE simulation cannot fetch API | Localhost unreachable or unsupported secrets setup | Use deployed Vercel HTTPS endpoint and current official CRE HTTP secrets mechanism |
| CRE Arc read fails | Wrong selector/ABI/network name/RPC support | Confirm `arc-testnet`, chain ID, call selector and official CRE supported network list |
| Arkiv write fails | Missing tGLM, invalid access key, invalid schema, wrong network | Verify Rabdi wallet balance/access key and reproduce first entity tutorial |
| Arkiv record doesn't appear | Different writer, expiry, query filters or chain configuration | Query by exact writer+schema+entity key; show pending/retry state, not fake success |
| Vercel request times out | Doing inference directly inside serverless request | Keep Vercel route short; dispatch central Actions worker and poll job status |

## 13. Final submission checks

- [ ] All acceptance tests in `docs/ACCEPTANCE.md` PASS or transparently BLOCKED.
- [ ] Sponsor selections explicitly target **Arc advanced stablecoin**, **Chainlink CRE workflow**, **Arkiv Build on Arkiv (from scratch)**, not adjacent tracks.
- [ ] Arc Studio share link, working frontend/backend, architecture diagram, live USDC transactions, repo, video and presentation included.
- [ ] CRE **real** CLI simulation with Arc + external source demonstrated, source and redacted logs included.
- [ ] Arkiv real Rabdi write and visible query, five criterion docs, wallet addresses and one rerunnable query included.
- [ ] AI use and generated/handwritten work are disclosed per ETHGlobal rules.
- [ ] Public open-source license and useful README; no fake performance numbers or future-development commitments.
- [ ] Only testnet assets used; no unverified production claims or unsafe privileged GitHub execution.
