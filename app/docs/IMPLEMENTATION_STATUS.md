# Hugo implementation status

Current architecture: this repository's post-merge workflow calls the hosted `/api/merge/github` synchronously. The backend verifies GitHub evidence, runs real 0G inference, persists evaluation and contributor scores, and processes Arc reservations and linked-wallet payouts in the request. Unregistered recipients claim their reserved shares separately.

Removed central evaluator workflow, dispatch code, worker script, job routes/table/functions, recovery endpoints/scripts and obsolete job tests. Fresh POC database setup is one file: `supabase/migrations/001_hugo.sql`. This replaces earlier POC setup files, not an existing database upgrade.

| Item | Status | Evidence |
|---|---|---|
| Production build | PASS | `/tmp/hugo-sync-build.log` |
| Fresh database setup and mixed-recipient reservation | PASS | Two focused checks, `/tmp/hugo-sync-db.log` |
| Typecheck | PASS | `/tmp/hugo-sync-types.log` |
| Live merge → inference → payment | BLOCKED | Needs hosted API, registered repository and funded treasury, Supabase configuration, actual 0G model/key, GitHub read token, and workflow secrets POC_API_URL/POC_MERGE_TRIGGER_SECRET. |
| thirdweb login and Arc deployment | BLOCKED | Real thirdweb app credentials, manual Arc Studio project and testnet deployment/funding required. |
| Arkiv / CRE live evidence | BLOCKED | Existing integration code remains; configured accounts/keys, funded issuer, real report/treasury and CRE login required. No external write or simulation fabricated. |

The route requests a 300-second host runtime. The deployed host must allow sufficient execution time for synchronous inference and chain confirmations. Private setup instructions are in ignored `SETUP.local.md`.

## GitHub publication cleanup

Removed the unused root blueprint SQL, reference allocator and test, reference contract, blueprint structure checker, duplicate env template, old example workflows, duplicate app workflow and generated CRE JS/WASM. Markdown documents are preserved. The active root post-merge workflow, app schema/contract, dependency lockfiles, tests and integration configuration remain. This cleanup did not change application behavior.

## Trusted workflow payload for POC

The post-merge workflow now gathers contribution details and sends them directly to the hosted API. The backend treats that payload as source of truth and no longer refetches or verifies merges/evidence with GitHub. One shared merge API secret remains. Registration still uses GitHub API to select the owner repository, while contributor wallet login remains separate. 0G inference and payout processing stay synchronous. No live workflow invocation claimed.
