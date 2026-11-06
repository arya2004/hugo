# Environment variables and accounts — complete setup runbook

**Never copy a real private key into the git repository or an AI chat.** Only use newly created **testnet-only wallets**. All values in `.env.example` are placeholders. If any secret is committed, rotate it and rewrite git history. The `NEXT_PUBLIC_` prefix exposes values to the browser and must **never** be used for secrets.

## 0. Local prerequisites

- Node.js **22 LTS** (Arkiv currently asks for >=22.10), npm, Git, GitHub CLI (`gh` optional), an EVM wallet extension, and a separate test-only wallet/account for voucher signing and Arkiv writes.
- A GitHub account permitted to create a public repository, a GitHub OAuth App, Vercel Hobby account, Supabase Free account, 0G account, and Chainlink CRE account.
- Install Solidity toolchain (Foundry `forge`/`cast` or current Hardhat), Chainlink CRE CLI from official install guide, and optionally Vercel CLI.
- The source repository that hosts the fixture merge trigger must be **separate from central evaluation runner repo**; secrets for external 0G live only in the central repo.

## 1. Generate shared secrets locally

```bash
# On macOS/Linux; run twice and paste each distinct value into correct secret stores:
openssl rand -hex 32   # MERGE_TRIGGER_SECRET / POC_MERGE_TRIGGER_SECRET
openssl rand -hex 32   # WORKER_API_SECRET
openssl rand -hex 32   # CRE_EXTERNAL_REPORT_TOKEN
```

Don't reuse between channels. For temporary code owner keys, prefer using wallet UI to generate a new testnet wallet and export only for the signer/Arkiv writer; **never use your real wallet seed/private key**.

## 2. Create a Supabase Free project

1. Sign in to https://supabase.com/dashboard → **New project** → choose organization, name `proof-of-contribution`, strong DB password, closest available region, Free plan.
2. Wait until ready; Project Settings → **API / Data API** (UI names vary): copy Project URL `https://<project-ref>.supabase.co`, publishable/anon key, and **secret/service-role** key. Use `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` respectively. If dashboard calls the new key *publishable*, use it for the same public client variable; adapt Supabase SDK accordingly.
3. Database → SQL Editor → run `sql/001_initial.sql`. After Codex creates `002_atomic_functions.sql`, run it in the same project. Confirm all public application tables have RLS enabled and no `anon`/`authenticated` policies granting raw table access.
4. Authentication → **Providers** → GitHub: leave disabled until completing next section.
5. Authentication → **URL Configuration**: Site URL `http://localhost:3000` in dev; add Redirect URLs `http://localhost:3000/auth/callback`, later `https://YOUR_APP.vercel.app/auth/callback`; update Site URL to production URL before deployed OAuth tests. In multi-environment usage add localhost to redirect allowlist even when production Site URL is set.

Supabase Free may pause after prolonged inactivity. Restart project before mentor demos.

## 3. Configure GitHub OAuth (for contributors and owners)

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**.
2. Name `Proof of Contribution`, homepage `http://localhost:3000` (later change homepage to deployed URL), authorization callback URL **exactly** `https://<project-ref>.supabase.co/auth/v1/callback` (NOT the Next.js route).
3. Register application → copy **Client ID** and generate **Client Secret**.
4. Supabase → Authentication → Providers → GitHub → enable it and paste Client ID and Client Secret, save. These two OAuth credentials go in **Supabase dashboard**, **not** `.env.local` or Vercel.
5. Login through app using GitHub; verify `supabase.auth.getClaims()` and immutable `auth.identities` GitHub ID. Confirm the same user ID is returned after logout/login. Test `/auth/callback` works in local and deployed environments.

Official: https://supabase.com/docs/guides/auth/social-sign-in/auth-github and https://supabase.com/docs/guides/auth/server-side/creating-a-client . For Next.js 16 use `proxy.ts`; older versions use `middleware.ts`. Do not trust cookie contents or `getSession()` for route authorization.

## 4. GitHub API and Actions tokens

**`GITHUB_READ_TOKEN`:** GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens → generate token with access to the specific *public demo source repository* and **Contents: read**, **Pull requests: read**, **Issues: read**, **Metadata: read**. Use documented minimum scopes for needed review/commit endpoints; update only if an actual endpoint returns 403. If all repo data is public, unauthenticated reads are technically possible but hit tighter rate limits. Store in **Vercel server env** for merge verification and in **central Action secret** for evidence fetching.

**`GITHUB_DISPATCH_TOKEN`:** generate a **different** fine-grained PAT with access restricted to the **central implementation repo**, **Contents: write**. GitHub dispatch REST endpoint requires that permission. Put token in **Vercel environment only**. Never in source/fixture repo Actions.

**`GITHUB_WORKER_OWNER` and `GITHUB_WORKER_REPO`:** literal owner name and central repository name; e.g. `myhandle` and `proof-of-contribution`. Put in **Vercel env**.

**`MERGE_TRIGGER_SECRET`:** random 64 hex characters. Put in Vercel as `MERGE_TRIGGER_SECRET`; also put SAME value in the *source/fixture repository* Settings → Secrets and variables → Actions as `POC_MERGE_TRIGGER_SECRET`. Add `POC_API_URL=https://YOUR_APP.vercel.app` as an **Actions secret** or repo variable depending on workflow template (template expects `secrets.POC_API_URL`). No trailing slash.

**`WORKER_API_SECRET`:** second random secret. Put SAME value in **Vercel env** and **central repository Actions secret** `WORKER_API_SECRET`. Do not use in source repo.

**`POC_APP_URL`:** central repository Settings → Secrets and variables → Actions → **Variables** (`vars`), set to `https://YOUR_APP.vercel.app`. The central workflow references this to call `/api/internal/jobs/...`.

**`OG_MODEL`:** central Actions **Variable** (`vars`), exact model identifier shown by the 0G account, not a guessed name.

### Secret placement matrix

| Name | Local `.env.local` | Vercel | Source-repo Actions | Central-repo Actions |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | localhost | deployed URL | — | — |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | — | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **server env** | — | — |
| `GITHUB_READ_TOKEN` | yes | **server env** | — | **secret** |
| `GITHUB_DISPATCH_TOKEN` | yes | **server env** | — | — |
| `GITHUB_WORKER_OWNER/REPO` | yes | yes | — | — |
| `MERGE_TRIGGER_SECRET` | yes | **server env** | `POC_MERGE_TRIGGER_SECRET` | — |
| `WORKER_API_SECRET` | yes | **server env** | — | **secret** |
| `OG_API_KEY` | optional local evaluator only | **omit** unless actually used server-side | **never** | **secret** |
| `OG_MODEL` | yes | omit | — | **variable** |
| `OG_BASE_URL` | default | omit | — | workflow default |
| `PAYOUT_VOUCHER_SIGNER_KEY` | **test only** | **server env** | — | — |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | after deployment | public value | — | — |
| `NEXT_PUBLIC_ARC_*` | values from template | public values | — | — |
| `ARKIV_ACCESS_KEY` | yes | only if backend writes/reads | — | optional writer secret |
| `ARKIV_WRITER_PRIVATE_KEY` | **test only** | only if backend writes | — | optional writer secret |
| `CRE_EXTERNAL_REPORT_TOKEN` | local CRE | **server env** | — | — |
| `CLAIM_RELAYER_PRIVATE_KEY` | optional | optional server env | — | — |

If Arkiv writes happen only via central worker, keep the private writer key in central Actions secrets instead of Vercel; never duplicate unnecessarily.

## 5. 0G account

1. Open https://pc.0g.ai; use hackathon compute credits if available.
2. Create a compute/router API key. Put it in **central repository → Settings → Secrets and variables → Actions → New repository secret** named `OG_API_KEY`.
3. Identify a live text-capable model and store its exact identifier as Actions **Variable** `OG_MODEL`. A text-capable model is mandatory; image-only models aren't suitable.
4. The central worker uses `OG_BASE_URL=https://router-api.0g.ai/v1`. Test a minimal completions call locally, check billing/credits and record actual request ID.
5. Local evaluation can use `.env.local` / a temporary shell environment, but don't run `env` dump in recorded demo.

0G Router is inference-only; using it doesn't deploy a model on your own blockchain, and compute credits may not be an unlimited always-free resource.

## 6. Arc wallets and contract

1. Set up **three independent test-only EVM wallets**: (A) program owner, (B) donor/contributor, (C) voucher signing service (private key stored only in Vercel). An optional (D) relayer if desired.
2. Add Arc Testnet: chain ID `5042002`, RPC `https://rpc.testnet.arc.io`, symbol USDC, explorer `https://explorer.testnet.arc.io`.
3. Obtain Arc Testnet USDC from https://faucet.circle.com. Validate token's ERC20 interface is `0x3600000000000000000000000000000000000000` with **6 decimals**; native gas uses 18-digit representation, so do not confuse it with the ERC20 balance.
4. Open https://studio.arc.io, initiate a project using the treasury/voucher brief in `docs/SMART_CONTRACT.md`, generate/test there and save its shareable URL. Adapt reference Solidity to Studio workflow; keep a reproducible copy/test suite in repo. Studio step is mandatory for prize.
5. Deploy treasury constructor with USDC ERC20 address; collect deployed address, explorer deployment transaction and ABI. Set `NEXT_PUBLIC_TREASURY_ADDRESS` locally and in Vercel, redeploy.
6. Program owner links wallet through message challenge, creates program onchain with voucher signer C address; verify `ProgramCreated`. Donors approve then fund, owner reserves period budgets, verified recipients claim.

**Do not set `PAYOUT_VOUCHER_SIGNER_KEY` to wallet A owner key**; the owner should approve via wallet, and server signing key should issue only bounded vouchers.

## 7. Arkiv Rabdi

1. Create an **entirely separate test wallet**; fund with tGLM: https://hub.arkiv.network/faucet.
2. Get an access key: https://hub.arkiv.network/access-keys. Store `ARKIV_ACCESS_KEY` where writer runs.
3. Store `ARKIV_WRITER_PRIVATE_KEY` with `0x` prefix only in selected backend/worker secret store. The writer wallet address is public and must be documented in the README for prize qualification.
4. SDK uses `rabdi({accessKey})` for chain `7794095`. Reference public RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network` and explorer `https://rabdi.explorer.arkiv.network`.
5. Write one Program and one Contribution, retrieve `entityKey`, query by schema+owner from another session, display. Keep personal email/private amounts out of data.

## 8. Chainlink CRE

1. Create account at https://app.chain.link/cre/discover, install official CLI from https://docs.chain.link/cre/getting-started/cli-installation/macos-linux (macOS/Linux) and log in.
2. Run `cre --version`, `cre init`; select current TypeScript template, follow official current examples to add HTTP and EVM read capabilities for Arc Testnet.
3. Local CRE secrets: `CRE_EXTERNAL_REPORT_TOKEN` same value as server env, only in CLI's **supported secrets format**. Report URL `https://YOUR_APP.vercel.app/api/cre/report/UUID` must be publicly reachable, authenticated and deliver a real report.
4. Execute `cre workflow simulate <workflow-name> --target staging-settings`; save output showing HTTP + Arc reads and validation. CLI flags and SDK versions can evolve: get `cre workflow simulate --help` and pin working version. **Simulation is eligible**, deployment is not needed for this prize.

## 9. Environment sanity checklist

- [ ] `node --version` >=22.10, `npm --version` works.
- [ ] `NEXT_PUBLIC_` variables contain no secrets.
- [ ] Supabase GitHub OAuth returns immutable numeric GitHub ID.
- [ ] Source repo has only merge API secret, not 0G or dispatch PAT.
- [ ] Central Actions has 0G key and worker secret, NOT Arc owner wallet key.
- [ ] Voucher signing test-wallet key only in backend and matches contract's voucherSigner.
- [ ] Arkiv writer funded with tGLM; can create and query Rabdi entity.
- [ ] CRE report auth token private; no query-string tokens.
- [ ] All service endpoints use HTTPS after deploying.
