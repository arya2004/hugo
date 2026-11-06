# Hugo

Hugo rewards open-source contributors after a pull request is merged. A repository owner funds a dedicated Arc Testnet treasury; Hugo evaluates contribution evidence, reserves a capped reward, and pays linked contributor wallets. Contributors can also claim reserved rewards after signing in. Arkiv provides public attestations, and a Chainlink CRE workflow verifies a reward report against Arc.

This is a testnet proof of concept. The backend trusts the post-merge workflow's submitted evidence and assumes the registrant owns the repository.

## Run locally

Requires Node.js 24 and npm.

```sh
cd app
npm ci
cp -n .env.example .env.local
npm run dev
```

Fill in `app/.env.local` using the keys below, then open [localhost:3000](http://localhost:3000). The schema for a fresh Supabase database is in `app/supabase/migrations/001_hugo.sql`. Deploy the app from the `app` directory on Vercel. Configure GitHub OAuth redirects and thirdweb's allowed domains for each app origin.

## API keys and configuration

| Service | Where to get it | Environment variables |
|---|---|---|
| Supabase | [Dashboard](https://supabase.com/dashboard): create a project, then open **Project Settings → API Keys**. Enable GitHub under **Authentication → Providers** using a [GitHub OAuth app](https://github.com/settings/developers). | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| thirdweb | [Dashboard](https://thirdweb.com/dashboard): create a project and API keys; enable GitHub login for embedded wallets and add your app's domains. | `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `THIRDWEB_SECRET_KEY` |
| AI inference | Choose [0G Private Computer](https://pc.0g.ai/dashboard/api-keys) or [OpenAI](https://platform.openai.com/api-keys); choose an available model. | `AI_PROVIDER=0g` with `OG_API_KEY` and `OG_MODEL`, or `AI_PROVIDER=openai` with `OPENAI_API_KEY` and `OPENAI_MODEL` |
| Arc Testnet | Create a separate backend test wallet and fund it with test USDC from the [Circle faucet](https://faucet.circle.com/). The owner creates the treasury through Hugo. | `PAYOUT_VOUCHER_SIGNER_KEY`, `NEXT_PUBLIC_ARC_RPC_URL`; `NEXT_PUBLIC_TREASURY_ADDRESS` is optional |
| Arkiv Rabdi | Create an [access key](https://hub.arkiv.network/access-keys), create a test writer wallet, and fund it through the [Arkiv faucet](https://hub.arkiv.network/faucet). | `ARKIV_ACCESS_KEY`, `ARKIV_WRITER_PRIVATE_KEY`, `ARKIV_ISSUER_ADDRESS` |
| Chainlink CRE | [Create an account](https://app.chain.link/cre/discover), install the [CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux), and run `cre login`. Set the same report token in Vercel and `app/cre/.env`; browser login needs no `CRE_API_KEY`. | `CRE_EXTERNAL_REPORT_TOKEN` |

Set `NEXT_PUBLIC_APP_URL` to the app origin. Generate distinct random values for `MERGE_TRIGGER_SECRET`, `WORKER_API_SECRET`, and `CRE_EXTERNAL_REPORT_TOKEN`, for example with `openssl rand -hex 32`. Set the matching GitHub Actions secrets in the registered repository as described in [the integration example](examples/github/README.md). No GitHub PAT is required by Hugo.

Set the required values in Vercel's environment settings and redeploy after changes. Keep server keys and wallet private keys out of Git and browser-side variables. Free tiers and testnet faucets have limits; AI inference requires available credits.

## Verify

- `/api/health` checks database and Arc connectivity.
- `/arkiv` displays live public attestations when Arkiv is configured and records have been published.
- The CRE workflow in `app/cre` can be simulated with the Chainlink CLI; network deployment requires Chainlink access approval.

Use your project's Arc Testnet and Arkiv Rabdi explorer links to inspect deployed contracts and transactions. The contract and assets are for testnet only.

## Demo commands

Run each block from the repository root.

**Publish queued Arkiv attestations:**

```sh
cd app
node --env-file=.env.local --import tsx scripts/arkiv-sync.ts
cd ..
```

`app/.env.local` must contain `POC_APP_URL` for the hosted app and the matching `WORKER_API_SECRET`. The hosted app needs its Arkiv settings. The script prints entity keys and transaction hashes, or says the queue is up to date. See the live records at `/arkiv`.

**Simulate CRE verification:**

```sh
cd app/cre
cre workflow simulate ./workflow --target staging-settings
cd ../..
```

Install Bun and the CRE CLI, run `cre login`, and set `CRE_EXTERNAL_REPORT_TOKEN` in `app/cre/.env` to match Vercel. `app/cre/workflow/config.staging.json` must point to a confirmed reservation report and its Arc treasury. Select the cron trigger if prompted. A successful run prints `CRE_VALIDATED`; it is a local simulation that reads the hosted API and Arc, not a hosted CRE deployment.
