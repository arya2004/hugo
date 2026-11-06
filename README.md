# Hugo — setup and demo guide

Your app: **https://hugo-three-amber.vercel.app**

Follow the steps in order. **Finish steps 1–5 before starting Arkiv or CRE.** No other docs are needed to get started.

## First: Arc and Arkiv are different

| | Arc | Arkiv |
|---|---|---|
| What Hugo uses it for | Holding funds and paying contributors | Publishing public contribution/settlement records |
| Network used | Arc Testnet | Arkiv Rabdi |
| Test token | Test USDC | tGLM |
| What you deploy | A treasury smart contract, through Hugo | Nothing manually; Hugo creates data entities |
| Where you see it | Hugo project page + Arc explorer | Hugo `/arkiv` page + Arkiv explorer |
| When to set it up | Before your first rewarded PR | After the reward flow works |

**Arc Studio** is a separate app-building tool associated with the Arc sponsor track. It is not Arkiv and it is not the treasury contract.

The flow you are setting up is:

```text
Todo PR merges
  → its workflow sends contribution details to Hugo
  → selected AI provider evaluates the work
  → Arc treasury reserves reward shares and pays linked contributors
  → you publish the public records to Arkiv
```

The POC trusts the workflow's evidence. Processing runs synchronously in the API request. There is no central evaluator worker or scheduled settlement workflow.

## 1. Prepare Supabase and login

### 1.1 Open your existing project

[Sign in to Supabase](https://supabase.com/dashboard/sign-in), then open [your project](https://supabase.com/dashboard/project/cugcgzgeevecgtratmrq).

Stay on the **Free** plan. GitHub social login is included; you do not need Pro or a paid email service. Free projects can pause after inactivity, so check that yours is running before the demo. [Pricing and limits](https://supabase.com/pricing).

### 1.2 Check the database

Open **SQL Editor**. If this is a fresh database that you have not initialized:

1. Open [app/supabase/migrations/001_hugo.sql](app/supabase/migrations/001_hugo.sql).
2. Copy the entire file into a new SQL Editor query.
3. Click **Run**.

If you already ran it, **do not run it again**. In Table Editor, confirm tables such as `programs`, `repositories` and `merge_reservations` exist. This SQL is for a fresh POC database, not an upgrade of older iterations.

### 1.3 Copy your keys

Open **Project Settings → API Keys**. You need these for Vercel in step 2:

- Project URL: `https://cugcgzgeevecgtratmrq.supabase.co`.
- Public/publishable or legacy anon key.
- Server secret/service-role key.

Keep your actual keys private.

### 1.4 Set the login redirects

Open **Authentication → URL Configuration**.

Set **Site URL** to:

```text
https://hugo-three-amber.vercel.app
```

Add both **Redirect URLs**, then save:

```text
https://hugo-three-amber.vercel.app/auth/callback**
http://localhost:3000/auth/callback**
```

In **Authentication → Providers → GitHub**, keep GitHub enabled. Its Client ID and Client Secret come from your [GitHub OAuth App](https://github.com/settings/developers). If you have not created one, [create it here](https://github.com/settings/applications/new).

The GitHub OAuth App's **Authorization callback URL** must be:

```text
https://cugcgzgeevecgtratmrq.supabase.co/auth/v1/callback
```

The `**` suffix on the Supabase redirect allowlist entries also permits the callback’s `?next=...` query string. If login returns to localhost, check that Supabase Site URL is the production origin and that these redirects were saved. Start a fresh login from the production `/admin` page afterward.

That URL stays on Supabase. Do not change it to the Vercel callback. The browser goes GitHub → Supabase → Hugo. [Official login instructions](https://supabase.com/docs/guides/auth/social-sign-in/auth-github).

## 2. Configure and redeploy Vercel

### 2.1 Open the right settings

[Log in to Vercel](https://vercel.com/login) → open your Hugo project → **Settings → Environment Variables**.

Use **Hobby**, not Pro or a Pro trial. Use the existing `vercel.app` domain. Hobby is intended for personal/non-commercial projects within its limits. [Plan details](https://vercel.com/docs/plans/hobby).

If creating the project again: [Import repository](https://vercel.com/new), choose the Hugo repo, set **Root Directory = `app`**, framework **Next.js**, install command `npm ci`, build command `npm run build`, Node **24.x**.

### 2.2 Add these Production variables

For each entry, select **Production** and save. Copy existing secrets from your local `app/.env.local`; do not regenerate or reset working keys. Paste values without surrounding quotes.

| Variable | What to enter |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://hugo-three-amber.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cugcgzgeevecgtratmrq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public/anon key from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server secret/service-role key from step 1 |
| `MERGE_TRIGGER_SECRET` | Your existing shared post-merge secret |
| `NEXT_PUBLIC_ARC_RPC_URL` | `https://rpc.testnet.arc.io` |
| `PAYOUT_VOUCHER_SIGNER_KEY` | Private key of the separate **backend test wallet** described in step 3 |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Your thirdweb Client ID |
| `THIRDWEB_SECRET_KEY` | Secret Key from that same thirdweb project |

Use one AI configuration:

| OpenAI | Value |
|---|---|
| `AI_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `OPENAI_MODEL` | Your supported chat model, e.g. `gpt-4.1-mini` |

[OpenAI API keys](https://platform.openai.com/api-keys) · [Example model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

Or use 0G:

| 0G | Value |
|---|---|
| `AI_PROVIDER` | `0g` |
| `OG_API_KEY` | Your 0G API key |
| `OG_MODEL` | Actual available model ID |

[0G console](https://pc.0g.ai/) · [0G API keys](https://pc.0g.ai/dashboard/api-keys) · [0G models](https://pc.0g.ai/models).

Only the selected provider needs credentials. You can keep both sets and switch `AI_PROVIDER`. Existing evaluations are reused; switching affects new evaluations. Provider/model/request ID are recorded. OpenAI runs do not count as 0G integration evidence. AI inference requires usable account credits; a free allowance is not guaranteed. Do not enable paid billing if you intend a zero-spend demo.

**Skip Arkiv and CRE variables for now.** They are listed later when you need them. No GitHub PAT is required. `NEXT_PUBLIC_TREASURY_ADDRESS` is not needed for normal project registration/funding.

### 2.3 Configure thirdweb's production domain

[Open thirdweb Dashboard](https://thirdweb.com/dashboard) → select your project → **Settings → Domain Restrictions / Allowed Domains**.

1. Add `hugo-three-amber.vercel.app`.
2. Keep your existing localhost entry.
3. Enable GitHub authentication for in-app/embedded wallets.
4. Save.

The Client ID and Secret Key must belong to this project. Use available free access; confirm the required GitHub wallet/profile API is included without an upgrade. [Access restriction instructions](https://portal.thirdweb.com/account/api-keys/access).

### 2.4 Redeploy

Vercel project → **Deployments** → latest production deployment → **⋯ → Redeploy**. Wait for **Ready**.

Environment changes need a new deployment; browser `NEXT_PUBLIC_` values are bundled at build time. Keep `NEXT_PUBLIC_APP_URL=http://localhost:3000` in your laptop's `.env.local` for local development, and the production origin in Vercel. [Environment variable instructions](https://vercel.com/docs/environment-variables/managing-environment-variables).

### 2.5 Check access and health

Open [production health](https://hugo-three-amber.vercel.app/api/health) in an incognito/private window. You should receive JSON with:

```json
{"data":{"db":"ok","arc":"ok","version":"0.2.0"}}
```

There will also be a request ID. If `db` is down, check the Production Supabase values, schema and project pause state. If `arc` is down, check the RPC URL.

If you see a Vercel login page instead of JSON, open Vercel **Settings → Deployment Protection** and ensure the production domain is public. Preview deployments can stay protected. Keep Hugo's shared API secret. [Protection settings](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

Now open [owner login](https://hugo-three-amber.vercel.app/admin). Confirm you can reach the workspace. Health does not test AI, thirdweb, payments, Arkiv or CRE.

## 3. Arc: prepare wallets and deploy the reward contract

**Goal:** get an actual treasury funding address for the **todo demo repository**. All money movement happens on Arc Testnet.

### 3.1 Make two test accounts

In MetaMask or your browser wallet, create two separate accounts and name them:

| Account | What it does | Where its private key belongs |
|---|---|---|
| `Hugo owner` | Deploys treasury, adds funds, starts/stops funding | In your browser wallet only |
| `Hugo backend` | Sends reward reservations and payouts | `PAYOUT_VOUCHER_SIGNER_KEY` in Vercel and local env |

Copy both **public addresses** somewhere so you can tell them apart. Export the private key of **only the disposable backend test account**, paste it into Vercel's `PAYOUT_VOUCHER_SIGNER_KEY`, and redeploy if that value changed. Use a `0x`-prefixed 32-byte private key, not a seed phrase.

The owner and backend signer must be different accounts. Neither account is the treasury: the treasury address is created in step 3.4.

### 3.2 Add Arc Testnet to the wallet

Wallet → **Settings → Networks → Add a custom network**:

| Field | Enter |
|---|---|
| Network name | Arc Testnet |
| RPC | `https://rpc.testnet.arc.io` |
| Chain ID | `5042002` |
| Currency symbol | `USDC` |
| Block explorer | `https://explorer.testnet.arc.io` |

Save, then switch to **Arc Testnet**. Do not choose Arc Mainnet. [Official network settings](https://docs.arc.io/arc/references/connect-to-arc).

### 3.3 Get free test funds for BOTH accounts

1. Open [Circle faucet](https://faucet.circle.com/).
2. Select **Arc Testnet**.
3. Enter the public address of `Hugo owner` and request test USDC.
4. Repeat for `Hugo backend`, subject to faucet limits.
5. Wait until both accounts have test funds.

The owner needs funds to deploy/donate. The backend needs funds for transaction gas. Funding only the owner is not enough. No Circle API key, paid RPC, mainnet USDC or real-money purchase is needed.

### 3.4 Create the treasury through Hugo

1. Open [Register repository](https://hugo-three-amber.vercel.app/admin/projects/new).
2. Sign in with your owner GitHub account if prompted. For this POC, ownership is assumed; no GitHub PAT/admin check is required.
3. Enter **`arya2004/hugo-todo-demo`**.
4. Enter a permanent combined reward cap, e.g. **1 USDC per PR**. This is the total for all contributors to a PR, not an amount per contributor.
5. Connect the `Hugo owner` wallet on Arc Testnet.
6. Sign the wallet-binding message.
7. Confirm the contract-deployment transaction when the wallet asks. Hugo supplies the USDC address, numeric repo key, backend signer address and cap.
8. Wait for confirmation. Hugo saves the repository/treasury association and opens the project.
9. Copy the displayed **funding address** and save its [Arc explorer](https://explorer.testnet.arc.io/) link.

**About `NEXT_PUBLIC_TREASURY_ADDRESS`:** this is only an optional fallback for generic donation UI. Normal funding, reservations and claims use the treasury saved per project in Supabase. You can leave the variable unset. If you want to set it, copy the project’s actual funding address after registration; it is not your owner/backend wallet and not the USDC token address. A project that has already been funded and paid rewards already has a deployed treasury.

You do not need to deploy a contract separately in Remix. Hugo uses the generated artifact from `app/contracts/ContributionTreasury.sol` and validates the exact deployment. If you change the contract, run `npm run compile:project` from `app/`, commit the updated artifact and redeploy Hugo before registration.

### 3.5 Put reward funds into the treasury

On the project page:

1. Keep `Hugo owner` connected.
2. In **Add project funds**, enter a small test amount, e.g. **5 USDC**, leaving some in the wallet for gas.
3. Confirm the USDC approval transaction.
4. Confirm the separate funding transaction.
5. Wait until **Available for rewards** reflects the deposit.
6. Open **Funding controls → Start Funding** and confirm that transaction.
7. Confirm funding is shown as active **before merging your PR**.

Use the form, not a direct token transfer to the contract address: the contract's `fund` call updates its accounting. Donations alone do not activate funding. Stopping funding later does not cancel already reserved contributor rewards.

The Arc USDC ERC-20 address is `0x3600000000000000000000000000000000000000`. Reward amounts use six decimals; native gas uses 18-decimal accounting. These are code/network settings, not additional keys you must buy.

### 3.6 Where Arc Studio fits

[Arc Studio](https://studio.arc.io/) is relevant to the Arc sponsor submission. The track requires Studio as the starting point and an actual shareable project URL/demo. Do not claim that requirement is satisfied by a later visit. Use available free/event access. Normal Hugo treasury deployment is the registration flow above; a differently compiled Studio/Remix contract is not automatically importable into Hugo.

## 4. Connect the todo demo repository

Open [todo repo Actions secrets](https://github.com/arya2004/hugo-todo-demo/settings/secrets/actions).

Add these **repository secrets**:

| Name | Value |
|---|---|
| `POC_API_URL` | `https://hugo-three-amber.vercel.app` |
| `POC_MERGE_TRIGGER_SECRET` | Exact same value as Vercel's `MERGE_TRIGGER_SECRET` |

Do not append `/api/merge/github` to the URL. The active workflow in the **todo repo** adds it. GitHub supplies its read token automatically. Hugo's own repository contains only the [integration example](examples/github/README.md), not an active payout workflow.

## 5. Merge a PR and check the reward

1. Make a real improvement on a branch in `hugo-todo-demo`, such as editing task titles.
2. Open a GitHub PR, then merge it while funding is active.
3. Open [todo repo Actions](https://github.com/arya2004/hugo-todo-demo/actions) → **Hugo — evaluate merged PR**.
4. Wait for the API response. The backend runs the selected AI evaluation, saves scores, calculates shares and processes Arc reservations/payment attempts.
5. Check the Hugo project reward status and actual Arc transaction links.

For an **automatic payment**, the contributor must link their wallet beforehand through [Contributor login](https://hugo-three-amber.vercel.app/redeem). A thirdweb embedded wallet is created during login. A contributor who was unregistered at allocation gets a reserved share and can authenticate and claim later. Review-only participants get zero.

### Send paid rewards to another Arc wallet

1. Open [Contributor login](https://hugo-three-amber.vercel.app/redeem) and sign in with GitHub.
2. Claim any reserved rewards first, if needed. Already paid rewards are in your embedded wallet.
3. In **Withdraw all**, check the USDC balance and paste your MetaMask or other **Arc Testnet** address.
4. Enter only the destination address, click **Review withdrawal**, check the calculated full amount and reserved fee, then click **Withdraw all**.
5. Wait for confirmation and open the Arc transaction link. Select Arc Testnet in the receiving wallet to see the funds.

Your embedded wallet signs this transfer directly. No private key is exported to Hugo, and Hugo's backend signer does not authorize it. The full spendable balance is calculated automatically after reserving the network fee; a small residual can remain if the actual fee is lower. This sends funds on Arc Testnet only, without bridging. Arc native USDC and the ERC-20 view share one balance; this full-balance withdrawal uses a native USDC transfer ([Arc explanation](https://www.arc.io/blog/usdc-for-every-action-how-arc-simplifies-building-onchain)). Refresh the balance if a new automatic payout arrived. After a page reload, sign in again to reconnect the embedded wallet controls.

A PR merge does not guarantee a reward. Current calculation:

```text
inflow = deposits in the 7 days before the supplied merge time
daily = floor(inflow * 8000 / 70000)
quality = highest eligible contributor score (0–100)
reward = min(available funds, floor(min(daily, PR cap) * quality / 100))
```

Scores determine proportional shares. With 5 USDC recent funding and quality 80, the combined reward is about 0.457142 USDC before other constraints. Deposit before merging; a later donation does not increase a previously frozen allocation.

Keep the demo PR small and use few recipients. This synchronous API requests a 300-second runtime, matching Vercel Hobby's documented Fluid Compute maximum. The workflow's ten-minute request timeout does not extend Vercel's limit. [Host duration limits](https://vercel.com/docs/functions/limitations).

If a request times out, inspect Vercel logs and the recorded chain transactions before assuming no payment occurred. Rerunning the workflow reuses persisted work where present; there is no recovery cron.

## 6. Arkiv: publish and view the public records

**Do this after a real merge/reservation exists.** Arkiv does not pay contributors, hold USDC or replace your Arc treasury. You are publishing data records, not deploying another treasury.

### 6.1 Create an Arkiv test account and fund it

1. In your browser wallet, create a third disposable account named `Hugo Arkiv`.
2. Copy its public address.
3. Open [Arkiv Hub](https://hub.arkiv.network/) and connect that account.
4. Open [Arkiv faucet](https://hub.arkiv.network/faucet) and request **tGLM for that same address**. Follow Hub's Rabdi network prompt if it asks to add/switch networks.
5. Wait for the faucet funds. tGLM pays for Arkiv data writes; Arc USDC cannot fund this operation.

Hugo's installed adapter targets **Rabdi**, chain ID **7794095**. Use the [Hub network page](https://hub.arkiv.network/networks) if you need the current wallet/RPC details. The app's SDK selects Rabdi itself; you do not need to paste a new Arkiv RPC into Hugo. [Arkiv Hub](https://hub.arkiv.network/) explains the faucet/write flow.

### 6.2 Get an access key

Open [Arkiv access keys](https://hub.arkiv.network/access-keys), connect/sign in as requested, and create a key. Copy the access-key value. Use free/shared testnet access; no paid dedicated node is needed. [Official key instructions](https://docs.arkiv.network/start-here/access-keys/).

### 6.3 Add these Vercel Production values

Vercel Hugo project → **Settings → Environment Variables**:

| Variable | What to paste |
|---|---|
| `ARKIV_ACCESS_KEY` | Access key from step 6.2 |
| `ARKIV_WRITER_PRIVATE_KEY` | Private key exported from disposable `Hugo Arkiv` account |
| `ARKIV_ISSUER_ADDRESS` | Public address of that SAME `Hugo Arkiv` account |
| `WORKER_API_SECRET` | A separate long random secret for publishing |

Generate the publishing secret if you do not already have one:

```sh
openssl rand -hex 32
```

Copy it privately. Despite the older variable name, `WORKER_API_SECRET` now protects the manual publishing API; there is no AI worker. **Redeploy Hugo** after saving the values.

You now have three unrelated things: Arc treasury address, Arkiv issuer public address, and Arkiv access key. Do not swap them.

### 6.4 Trigger publishing from your laptop

In `app/.env.local`, set:

```dotenv
POC_APP_URL=https://hugo-three-amber.vercel.app
WORKER_API_SECRET=THE_SAME_PUBLISHING_SECRET_YOU_PUT_IN_VERCEL
```

Then, from the Hugo repository root:

```sh
cd app
node --env-file=.env.local --import tsx scripts/arkiv-sync.ts
```

The script calls the hosted backend. The **backend** uses its Vercel Arkiv keys to publish queued records; the laptop does not need another wallet transaction prompt. It prints actual entity keys/transaction hashes for published records and stops when the queue is empty or twenty records were processed. Run again if needed.

No output can mean there is nothing queued; a configured key alone does not create contribution records. Ensure a project/merge exists first.

### 6.5 See the result

Open these direct links:

- [Hugo public contribution records](https://hugo-three-amber.vercel.app/arkiv).
- [Contribution records as JSON](https://hugo-three-amber.vercel.app/api/arkiv/contributions).
- [Program records as JSON](https://hugo-three-amber.vercel.app/api/arkiv/programs).
- [Rabdi block explorer](https://rabdi.explorer.arkiv.network/).

The records use schema `poc.v2.attestation`, filtered by your configured issuer. They show eligibility/settlement references, not private identity-to-wallet mappings or individual reward amounts. Current expiry is 90 days. Save actual entity keys, issuer address, transaction links and a screenshot of the live read for your demo.

## 7. CRE: simulate verification after Arc works

CRE reads your hosted report and Arc treasury. It is a separate verification demonstration; it does not replace the merge workflow or send the payouts.

1. [Create/log in to a Chainlink account](https://app.chain.link/cre/discover).
2. Follow the [official CLI installer](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux), then run `cre login`.
3. In Vercel, add `CRE_EXTERNAL_REPORT_TOKEN` using a separate long random value and redeploy.
4. Copy `app/cre/.env.example` to `app/cre/.env`. Set the same `CRE_EXTERNAL_REPORT_TOKEN`. If using `cre login`, remove the placeholder `CRE_API_KEY` line. Only set a real CLI API key if that is your chosen authentication method.
5. Find a confirmed reservation UUID in Supabase's `merge_reservations` table, or the merge API's `rewardId`. It must have status `RESERVED` or `SETTLED`.
6. Edit `app/cre/workflow/config.staging.json`:

   ```json
   {
     "schedule": "0 */10 * * * *",
     "reportUrl": "https://hugo-three-amber.vercel.app/api/cre/report/YOUR_RESERVATION_UUID",
     "expectedOrigin": "https://hugo-three-amber.vercel.app",
     "treasuryAddress": "YOUR_ACTUAL_ARC_TREASURY_ADDRESS"
   }
   ```

7. From the Hugo repository root:

   ```sh
   cd app/cre/workflow
   npm ci
   npm run typecheck
   npm run compile
   cd ..
   cre workflow simulate ./workflow --target staging-settings
   ```

8. Follow any trigger selection prompt and save the actual successful output. An authentication error or compiled WASM alone is not a successful simulation. No production CRE deployment is needed for this guide. [CRE overview](https://docs.chain.link/cre/overview).

## 8. Sponsor tracks and costs

| Integration / intended track | Evidence to collect |
|---|---|
| Arc: Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio | Actual Studio project URL/work, working treasury and deployment/funding/payment receipts |
| Arkiv: Build on Arkiv, if your event category permits | Real writes, live UI reads, issuer address and reproducible query |
| Chainlink: Best workflow with CRE | Successful genuine CLI simulation using Arc + hosted API |
| 0G: inference integration | Actual 0G request/model evidence; check the prize fit separately |

Check the [official event requirements](https://ethglobal.com/events/mumbai/prizes). Installing an SDK alone does not establish eligibility. Sponsor criterion documents remain in `app/arkiv/`. Record your AI-use disclosure and use the included open-source license.

Supabase Free, Vercel Hobby, public-repository standard GitHub Actions, public testnet RPCs and faucet assets avoid a paid hosting stack. Inference credits and thirdweb/Studio/CRE account entitlements must actually be available to your account; do not assume all services have unlimited free use. Stop instead of buying upgrades if you need a strictly zero-spend demo.

## Local development

Node 24 LTS is recommended. From the repository root:

```sh
cd app
npm ci
test -f .env.local || cp .env.example .env.local
npm run dev
```

**Only copy the example if you do not already have `.env.local`; do not overwrite your tokens.** Fill values using the same service accounts above, but keep local `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Never commit real keys. There is no dummy-data mode.

- Owner workspace: http://localhost:3000/admin
- Contributor login: http://localhost:3000/redeem
- Todo demo runs separately on http://localhost:3001

## If something fails

| Symptom | First thing to check |
|---|---|
| `db: down` | Vercel Production Supabase URL/server key, initialized schema, project not paused |
| Hosted login returns to localhost | Supabase Site URL must be production; allow the callback including its next query; redeploy the same-origin callback fix and start a fresh login |
| Contract creation cannot send | Owner has Arc Testnet gas; backend key differs from owner |
| Backend reservation/payment cannot send | Backend signer has Arc test funds and matches the treasury signer |
| No reward | Funding active at supplied merge time; positive eligible score; pre-merge deposit; available funds |
| Workflow gets 401 | Its shared secret exactly matches Vercel `MERGE_TRIGGER_SECRET` |
| Workflow gets HTML | Wrong host or Vercel protection login intercepting the API |
| thirdweb login rejected | Matching project keys, GitHub enabled, correct allowed domain, numeric GitHub identity available |
| Arkiv write fails | Writer key/address match; writer has tGLM; access key is valid |
| Arkiv page empty | Contribution was processed; publisher ran; correct issuer filter |
| CRE report unavailable | Real reservation UUID, confirmed reservation, correct report token |

No keys, receipts or successful integration results are supplied by this README. Use your actual results when recording the final demo.
