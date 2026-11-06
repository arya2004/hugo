# Hugo — complete setup and deployment README

This is the only setup guide you need. Paths below are relative to the repository root unless a command first enters `app/`.

**Current state:** integration code exists, but no hosted app, deployed treasury, live inference, Arkiv write or successful CRE simulation is supplied. Use testnet assets only. This README is included in the repository; keep actual secrets in local environment files and hosting settings.

## 1. What you are deploying

- **Vercel:** Next.js frontend and API from `app/`.
- **Supabase:** application database and GitHub owner login.
- **Arc Testnet:** one treasury contract per registered repository.
- **0G Private Computer:** AI evaluates contribution evidence.
- **thirdweb:** contributors authenticate with GitHub and receive an embedded wallet.
- **GitHub Actions:** this repo's post-merge workflow sends contribution details to your hosted API and waits for its response.
- **Arkiv and CRE:** public attestations and an independent verification simulation; configure these after the core flow works.

The backend trusts the evidence sent by the authenticated workflow, as requested for this POC. It calls 0G and processes funding/reservations/payment attempts synchronously. There is no central worker, dispatch queue or scheduled settlement workflow.

## 2. Sponsor tracks

These are the intended tracks, not claims that the project already qualifies:

| Sponsor / intended track | Hugo integration | Evidence you must produce |
|---|---|---|
| Arc — Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio | Capped USDC treasury, funding controls, reservations and contributor payouts | Real Arc Studio project URL, demo of Studio, actual contract/funding/payment receipts and architecture diagram |
| Arkiv — Build on Arkiv (from scratch), if your event category permits | Public eligibility and settlement attestations queried from `/arkiv` | Actual entity writes, live UI reads, issuer address and reproducible query; required criterion documents and license |
| Chainlink — Best workflow with CRE | Workflow reads external Hugo report plus Arc contract state | Successful genuine CRE CLI simulation; compilation alone is insufficient |
| 0G — technology used; prize fit must be checked separately | Real Private Computer inference | Actual model/request metadata and evaluation demo |

Arc requires Studio as the starting point. Creating a Studio project after building elsewhere does not establish that requirement. thirdweb, Vercel and Supabase are supporting services; do not imply a selected sponsor track merely because their SDK is installed. Check the [official Mumbai prize requirements](https://ethglobal.com/events/mumbai/prizes) before submission.

## 3. Accounts and tools

Create accounts at:

- [Supabase](https://supabase.com/dashboard)
- [Vercel](https://vercel.com/new)
- [0G Private Computer](https://pc.0g.ai/)
- [thirdweb](https://thirdweb.com/dashboard)
- [Arc Studio](https://studio.arc.io/)
- [Arkiv Hub](https://hub.arkiv.network/) for attestations
- [Chainlink CRE](https://app.chain.link/cre/discover) for simulation

Install Node.js **24 LTS**, npm, Git and MetaMask or another supported browser EVM wallet. The project requires Node >=22.10. Use a public GitHub repository for the current POC; registration rejects private repositories.

```sh
cd app
npm ci
cp .env.example .env.local
```

Edit `.env.local` with the values below. Never commit real secrets. Vercel will need the same runtime values in its Environment Variables settings; it does not automatically receive your local file.

## 4. Supabase: database and owner GitHub login

1. Create a Supabase project. Save its database password somewhere private.
2. Open **SQL Editor**. Paste and run the entire `app/supabase/migrations/001_hugo.sql` file **once** on this fresh project. There is only one setup SQL file. It is not an upgrade script for old iterations.
3. From the project's connection/API settings, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`.
   - Publishable or legacy anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Server secret/service-role key → `SUPABASE_SERVICE_ROLE_KEY`.
4. In Supabase **Authentication → Providers → GitHub**, enable GitHub and copy the callback URL shown there.
5. In GitHub **Settings → Developer settings → OAuth Apps → New OAuth App**, set a name such as Hugo Owner Login, a homepage URL, and that **Supabase callback URL**, normally `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
6. Copy the OAuth Client ID and generate a Client Secret. Put both into the Supabase GitHub provider settings. These are not the post-merge API secret or the GitHub read token.
7. In Supabase **Authentication → URL Configuration**, set Site URL to your app origin and allow both `http://localhost:3000/auth/callback` and `https://YOUR_APP.vercel.app/auth/callback`. After deployment, make the hosted origin the Site URL.

Owner login uses Supabase; contributor login uses thirdweb. Official reference: [Supabase GitHub login setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-github).

## 5. GitHub token and workflow secrets

### Backend registration token

In GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**, create a token scoped to the repository you will register. Grant repository **Administration: read** and **Metadata: read** so the backend can check collaborator admin permission during registration. Organization repositories may require organization approval.

Set it as backend `GITHUB_READ_TOKEN`. It is used for owner registration, not backend re-verification of post-merge evidence. Never put this token into browser variables.

### Shared post-merge secret

Generate a random value locally:

```sh
openssl rand -hex 32
```

Copy it into backend `MERGE_TRIGGER_SECRET`.

In **this GitHub repository → Settings → Secrets and variables → Actions → New repository secret**, add:

| Actions secret | Value |
|---|---|
| `POC_API_URL` | Hosted app origin, e.g. `https://YOUR_APP.vercel.app` |
| `POC_MERGE_TRIGGER_SECRET` | Exact same value as backend `MERGE_TRIGGER_SECRET` |

The active `.github/workflows/post-merge.yml` is already installed. It runs when a PR is merged, fetches contribution details using GitHub's automatic workflow token, and posts them to `/api/merge/github`. No `GITHUB_DISPATCH_TOKEN`, central worker repository or manually created workflow token is needed.

The repository still needs to be registered and funded in Hugo before merging your demo PR. Pushing directly to the default branch does not trigger this PR-merge workflow.

## 6. Get the 0G inference key

1. Open [Private Computer](https://pc.0g.ai/) and sign in.
2. Open its [API keys dashboard](https://pc.0g.ai/dashboard/api-keys) and create a key.
3. Set backend `OG_API_KEY` to that key.
4. Open the [model catalog](https://pc.0g.ai/models), choose an available text/chat model, and copy its **actual model ID** into `OG_MODEL`.
5. Ensure the account/key has usable credits or billing. Free hosting does not provide inference credits.

The implementation uses the OpenAI-compatible endpoint `https://router-api.0g.ai/v1`. It is fixed in `src/server/evaluation.ts`; setting another `OG_BASE_URL` does not change this implementation. [Official 0G overview](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview).

## 7. thirdweb contributor wallets

1. In [thirdweb Dashboard](https://thirdweb.com/dashboard), create a project.
2. Copy its **Client ID** to `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`.
3. Copy the **Secret Key** from the same project to backend-only `THIRDWEB_SECRET_KEY`.
4. Enable in-app/embedded wallets and GitHub as an authentication method. Complete any provider configuration the dashboard requests.
5. Allow `localhost:3000` and your deployed domain in the project's allowed-domain settings.

Hugo creates an embedded wallet when a contributor chooses GitHub login at `/redeem`. The backend gets that wallet's linked profile from thirdweb and requires a numeric GitHub ID. Usernames/emails are not accepted as the identity. If the live thirdweb profile does not expose the required ID, login will fail explicitly; do not replace it with an invented ID.

A contributor linked before allocation can receive automatic payments. Otherwise the share stays reserved until they log in and claim. The backend signer pays transaction gas. [thirdweb API key documentation](https://portal.thirdweb.com/account/api-keys).

## 8. Arc Testnet wallets and faucet

Add this network to your browser wallet:

| Setting | Value |
|---|---|
| Network | Arc Testnet |
| RPC | `https://rpc.testnet.arc.io` |
| Chain ID | `5042002` |
| Native currency | `USDC` |
| Explorer | `https://explorer.testnet.arc.io` |
| USDC ERC-20 contract | `0x3600000000000000000000000000000000000000` |

Use [Circle's faucet](https://faucet.circle.com/), select **Arc Testnet**, and request test funds. You do not need a Circle API key for this app's direct wallet/contract flow. Native gas accounting uses 18 decimals; the app's USDC token amounts use 6. [Official Arc connection details](https://docs.arc.io/arc/references/connect-to-arc).

Prepare two different test-only wallet accounts:

1. **Owner account:** connects in the browser, deploys the treasury, donates and starts/stops funding.
2. **Backend signer account:** a separate account whose exported private key becomes `PAYOUT_VOUCHER_SIGNER_KEY` in `.env.local` and Vercel. Fund this address from the faucet too: it sends reservation and payout transactions.

Do not use the owner address as the backend signer; contract deployment rejects that configuration. Export only a disposable test account's private key. Keep the owner key in your wallet; Hugo does not need it on the backend.

## 9. Run locally, then deploy the app

Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local development. Core runtime values are:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_KEY
GITHUB_READ_TOKEN=YOUR_REGISTRATION_TOKEN
MERGE_TRIGGER_SECRET=YOUR_RANDOM_SHARED_SECRET
OG_API_KEY=YOUR_0G_KEY
OG_MODEL=ACTUAL_CHAT_MODEL_ID
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=YOUR_THIRDWEB_CLIENT_ID
THIRDWEB_SECRET_KEY=YOUR_THIRDWEB_SECRET
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.io
PAYOUT_VOUCHER_SIGNER_KEY=YOUR_SEPARATE_TEST_ACCOUNT_PRIVATE_KEY
```

Replace every placeholder before using the relevant feature. Then:

```sh
npm run dev
```

Open `http://localhost:3000/admin` and sign in with GitHub. There is no dummy-data mode.

For the hosted app:

1. Push the repository to GitHub, including the root `.github/workflows/post-merge.yml`.
2. In Vercel, import the repository and set **Root Directory = `app`**, framework **Next.js**, install `npm ci`, build `npm run build`. Use Node 24.x.
3. Add the core environment values above. Add Arkiv/CRE values from the next sections when using those features.
4. Deploy once to obtain the domain. Set `NEXT_PUBLIC_APP_URL` to that exact `https://...` origin and redeploy. Public variables are bundled during build, so changes require redeployment.
5. Update Supabase redirects and thirdweb allowed domains. Set GitHub Actions `POC_API_URL` to the hosted origin.
6. Ensure the API is reachable by the workflow, without a Vercel deployment-protection login page blocking it.
7. Visit `/api/health`. `db` and `arc` should be `ok` when configured. This endpoint does not prove 0G, thirdweb, Arkiv or CRE work.

The merge handler requests `maxDuration=300`. Vercel's documented Hobby limit with Fluid Compute is 300 seconds. The pipeline waits up to ten minutes, but that does not extend the server's five-minute limit. Use a small PR and few recipients for the synchronous POC demo. [Vercel duration limits](https://vercel.com/docs/functions/limitations).

## 10. Deploy the treasury contract on Arc Testnet

**Use Hugo's registration screen for the contract that this app will manage.** Registration validates the exact generated deployment bytecode and constructor arguments. A separately modified Remix/Studio deployment is not automatically importable.

1. For the Arc sponsor requirement, start in [Arc Studio](https://studio.arc.io/) and retain the actual shareable project URL. Describe a repository USDC treasury with an immutable total PR cap, owner-controlled funding and separate contributor shares. Keep Studio work/demo evidence; do not claim it happened if it did not.
2. In your checkout, generate the deployment artifact from the current contract:

   ```sh
   cd app
   npm run compile:project
   ```

   If already inside `app/`, omit `cd app`. If this changes the generated artifact, commit it and redeploy Vercel before registration so the browser and backend agree on bytecode.
3. Open your deployed Hugo app → **Admin → Register repository**.
4. Enter this repository as `OWNER/REPO` and choose the permanent **combined reward cap per PR** in USDC. The cap covers all recipients together and cannot be changed after deployment.
5. Connect the **owner** browser-wallet account on Arc Testnet. Sign the wallet-binding message.
6. Confirm the contract-creation transaction. The UI deploys `app/contracts/ContributionTreasury.sol` using the compiled artifact and these arguments:

   | Argument | Value supplied by Hugo |
   |---|---|
   | `token` | Arc USDC ERC-20 address above |
   | `repo` | `keccak256("github:repository:<numeric repository ID>")` |
   | `signer` | Address derived from backend `PAYOUT_VOUCHER_SIGNER_KEY` |
   | `maximum` | Your chosen cap converted to integer micro-USDC |

7. Wait for confirmation. The backend verifies the deployment and stores the treasury/repository association. If the page is interrupted, use **Continue registration** with the same wallet.
8. Open the project and copy its **funding address**. This is the actual deployed treasury. Save its explorer URL and deployment receipt for the demo.
9. Add funds using **Add project funds**. Confirm the exact USDC approval, then the `fund` transaction. Directly sending tokens to the treasury bypasses its accounting; use this form or the contract's `fund` method.
10. Open **Funding controls → Start Funding** and confirm the transaction. New treasuries begin stopped. Depositing money alone does not start funding.

`NEXT_PUBLIC_TREASURY_ADDRESS` is an optional fallback for generic donation UI. Normal project registration, funding and payouts use the treasury saved per project; you do not need to redeploy the app each time you register a repository.

## 11. Run your first real merge/payout demo

1. Verify the deployed app, workflow secrets, owner/donor funds and backend signer gas balance.
2. Donate **before** the PR merge, and Start Funding. Keep the first PR small.
3. For automatic payment, have the contributor sign in once at `/redeem` using thirdweb GitHub before the merge. For the unregistered path, leave them unlinked.
4. Open and merge a PR in this repository. In GitHub **Actions**, open **Hugo — evaluate merged PR**.
5. The workflow sends contribution details; the API runs 0G, persists the assessment, calculates shares, confirms a reservation and attempts payments to already linked contributors. Inspect the action response and real Arc receipts.
6. An unregistered contributor can now visit `/redeem`, log in with GitHub and claim their reserved share. Stopping funding does not cancel it.

Funding eligibility uses the merge timestamp supplied by the workflow and confirmed onchain funding transitions. Reviews alone earn zero. The current deterministic policy is:

```text
inflow = confirmed deposits in the seven days before the merge
daily = floor(inflow * 8000 / 70000)
quality = highest positive code-contributor score, from 0 to 100
reward = min(available, floor(min(daily, immutable_PR_cap) * quality / 100))
```

Positive code-contributor scores determine proportional shares. For example, 700 USDC recent funding and top score 80 yields 64 USDC before availability/cap constraints. No funds means no funded claim. Shares are fixed once calculated; a later donation does not increase that PR's allocation.

There is no automated recovery cron. For an interrupted merge request, rerun the GitHub workflow; persisted evaluation/reservation/transaction records are reused where present. A pending payment can be checked through its existing claim flow. Never infer a failed transfer solely from an HTTP timeout; inspect the stored transaction/explorer.

## 12. Arkiv: get keys, publish, and show live reads

1. Open [Arkiv Hub access keys](https://hub.arkiv.network/access-keys), create an access key, and set backend `ARKIV_ACCESS_KEY`.
2. Use a separate test wallet for the issuer. Set its private key as backend `ARKIV_WRITER_PRIVATE_KEY` and its public address as `ARKIV_ISSUER_ADDRESS`.
3. Fund that address with tGLM using the [Arkiv faucet](https://hub.arkiv.network/faucet). The current adapter uses **Rabdi**, chain ID `7794095`.
4. Generate another random secret and set backend `WORKER_API_SECRET`. Despite its older name, it now protects the manual Arkiv publishing endpoint; no evaluation worker exists.
5. Redeploy after adding those values. In your local `app/.env.local`, also set `POC_APP_URL` to your hosted origin and `WORKER_API_SECRET` to the same publishing token.
6. After registering a project or processing a contribution, run from `app/`:

   ```sh
   node --env-file=.env.local --import tsx scripts/arkiv-sync.ts
   ```

   The script publishes queued changes through the hosted API and prints actual entity keys/transaction hashes. It stops when the queue is empty or after twenty publications; run again if needed.
7. Open your hosted `/arkiv` page. It queries issuer-owned contribution records live. You can also query `/api/arkiv/contributions` and `/api/arkiv/programs` in your browser; these read the SDK's `poc.v2.attestation` schema with the configured issuer filter.
8. Save the actual issuer address, entity keys, query URLs and a screenshot of the live page for submission. The records currently expire after 90 days.

Private claimant mappings and individual amounts are omitted from these entities; Arc transfers remain public. Access-key setup reference: [Arkiv documentation](https://docs.arkiv.network/start-here/access-keys/).

## 13. Chainlink CRE: install and run a genuine simulation

Do this after one real reservation exists. CRE validates a reservation; it does not replace the post-merge API or send the payments.

1. Follow the [official CLI installation guide](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux). For macOS/Linux the documented installer is:

   ```sh
   curl -sSL https://app.chain.link/cre/install.sh | bash
   cre version
   cre login
   ```

   Authenticate with your Chainlink platform account. For non-interactive use, obtain `CRE_API_KEY` from your account if available; it is a local CLI credential, not a browser key. [CLI login reference](https://docs.chain.link/cre/guides/cli/cli-login).
2. Create backend `CRE_EXTERNAL_REPORT_TOKEN` using `openssl rand -hex 32` and redeploy.
3. Copy `app/cre/.env.example` to `app/cre/.env`. Set `CRE_EXTERNAL_REPORT_TOKEN` to the exact backend value. Set a real `CRE_API_KEY` only if using that auth method; remove the placeholder line if using `cre login`.
4. Get the reservation UUID from the merge API response's `rewardId` or from Supabase's `merge_reservations` table. It must be a confirmed `RESERVED` or `SETTLED` record, not a PR number, claim ID or old epoch ID.
5. Edit `app/cre/workflow/config.staging.json`:

   ```json
   {
     "schedule": "0 */10 * * * *",
     "reportUrl": "https://YOUR_APP.vercel.app/api/cre/report/YOUR_RESERVATION_UUID",
     "expectedOrigin": "https://YOUR_APP.vercel.app",
     "treasuryAddress": "YOUR_ACTUAL_PROJECT_TREASURY_ADDRESS"
   }
   ```

   Replace all placeholders. The existing `app/cre/project.yaml` supplies Arc Testnet RPC; `app/cre/secrets.yaml` maps the report token.
6. Install and compile:

   ```sh
   cd app/cre/workflow
   npm ci
   npm run typecheck
   npm run compile
   cd ..
   cre workflow simulate ./workflow --target staging-settings
   ```

   From `app/cre`, the CLI finds `project.yaml`, `workflow/workflow.yaml` and the `.env` secrets. Follow any CLI prompt to choose the cron trigger.
7. Save the actual successful simulation output. It should fetch the authenticated report, read finalized Arc state, and validate repository, reservation, merge-time funding eligibility and immutable cap. An auth error or compiled WASM alone is not a successful simulation.

A simulation makes real network calls. Live decentralized CRE deployment is not implemented or claimed here. [CRE overview](https://docs.chain.link/cre/overview).

## 14. Which values go where?

| Where | Values |
|---|---|
| Vercel + local app environment | Core values in section 9; Arkiv fields and report/publishing tokens when used |
| GitHub repository Actions secrets | Only `POC_API_URL` and `POC_MERGE_TRIGGER_SECRET` for the merge workflow |
| Supabase GitHub provider settings | GitHub OAuth Client ID and Client Secret |
| thirdweb Dashboard | GitHub authentication configuration and allowed domains |
| Local `app/cre/.env` | CRE report token and optional real CRE API key |
| Browser wallet | Owner account; never upload its private key to Vercel |

Only values prefixed `NEXT_PUBLIC_` may reach the browser. No payout signer, service-role key, thirdweb secret or 0G key belongs in GitHub's source code or public variables. `ALLOW_DEMO_FIXTURES` and `OG_BASE_URL` in the example file do not enable dummy data or change the current evaluator endpoint.

## 15. Fast troubleshooting

| Symptom | What to check |
|---|---|
| Owner login fails | Supabase GitHub provider credentials, Supabase callback in GitHub OAuth App, app callback in Supabase redirect allowlist, exact app origin |
| Repository registration denied | Public repository, signed-in user is its admin, backend token can read collaborator permissions, organization token approval |
| Contract deployment rejected | Arc chain 5042002, funded owner, owner differs from backend signer, current artifact and matching deployed app build |
| Reservation/payment cannot send | Backend signer has Arc testnet gas; project was funded through `fund`; signer key matches the treasury's signer |
| No reward | Funding was active at supplied merge time, deposit occurred before merge, 0G returned eligible positive scores, sufficient available funds |
| Action gets 401 | Workflow's shared secret exactly matches backend `MERGE_TRIGGER_SECRET` |
| Action gets HTML instead of API JSON | Wrong API origin or deployment protection intercepting the request |
| Action gets 413 | Evidence exceeds the API's current 1 MiB cap; use a small demo PR |
| Request times out | Check Vercel logs and transaction receipts; synchronous inference + multiple chain confirmations may exceed hosting duration |
| thirdweb login rejected | Same thirdweb project for both keys, GitHub enabled, domain allowed, verified profile exposes numeric GitHub ID |
| Arkiv page empty | Credentials/issuer match, issuer has tGLM, queue was published, entity has not expired |
| CRE authentication error | `cre login` or a real `CRE_API_KEY`; no placeholder key in `.env` |
| CRE report unavailable | Correct reservation UUID and token, actual confirmed reservation, exact HTTPS report origin |

## 16. What to collect for your final demo

- Hosted app URL and public GitHub repository.
- Actual Arc Studio project URL and a demo showing your Studio work.
- Treasury deployment, funding, reservation and payout explorer links.
- Actual 0G request/model metadata and stored evaluation.
- Both registered auto-pay and unregistered claim flows if demonstrating both.
- Actual Arkiv issuer/entity keys and a live read from `/arkiv`.
- Successful CRE simulation output.
- Your AI-use disclosure, license and the sponsor criterion documents already present in the repo, updated with real evidence.

Nothing in this README is evidence that a deployment or integration already ran. Fill the above with your actual results as you execute these steps.
