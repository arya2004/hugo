# Task contract for Codex CLI

Build a runnable, testable, deployed-if-credentials-provided, **hackathon-only** MVP of Proof of Contribution. Read the documentation in this folder in README order before generating code. Treat `docs/PRODUCT_AND_ARCHITECTURE.md`, `docs/API_AND_DATA.md`, `sql/001_initial.sql`, both `sql/001_initial.sql` and `sql/002_atomic_functions.sql`, and `contracts/ContributionTreasury.sol` as normative specifications. Implement the complete application with no paid hosting dependency. Do not ask product-design questions already settled in the docs.

## Nonnegotiable behavior

- Funding can come from **DAO/program owner or anybody else** into a program-level Arc USDC treasury.
- After a PR merges, evaluate immediately; store per-contributor points/quality scores. Reviewer feedback is evidence but **reviewers are never paid as reviewers**.
- At period close, derive an **affordable total reward budget** from the program's onchain available balance and its funding policy. Program owners may override allocation **shares** and approve the reservation; cannot spend beyond the onchain balance.
- Continuously funded programs reduce **future payouts** when incoming donation rate drops. One-off seasonal campaigns distribute a preset funded budget across configured epochs instead of using 7-day inflows.
- Contributors see their own allocation after GitHub OAuth, bind an EVM wallet via a server-issued nonce and signed challenge, obtain an EIP-712 voucher, then claim individually. No trusted commit email or GitHub username for authentication.
- All allocations must be denominated as integer **micro-USDC** and must be backed by onchain reserved funds. Arc ledger is final for claims, Postgres is application state, Arkiv is public attribution/discovery, not private balances.
- Install/apply the post-merge GitHub workflow to a test fixture repo. Never check out or execute PR content with privileged merge-trigger secrets. Verify merge evidence with GitHub API.
- 0G is used for **actual live structured inference** in the primary evaluation path, not canned results. A deterministic fixture/mock is allowed only in explicit TEST_MODE and must be disclosed.
- Chainlink CRE must compile and **successfully simulate**, calling external evidence API and reading Arc treasury state. Do not state this yields live decentralized settlement unless a real receiver/report mechanism is implemented.
- Arkiv must store **and query** issuer-owned public program/contribution records on Rabdi, with public contributor-history UI reading Arkiv; no Git email, raw private evaluation, or sensitive claims in public entities.
- Arc Studio must be used at the beginning of the contract/application work to satisfy the Arc bounty, and its shareable project URL retained. CLI cannot create an Arc Studio project automatically: give user exact manual steps and continue with local code, recording the manual gate in README.

## Implementation phases, in order (do not skip gates)

1. **Foundation:** scaffold Next.js TypeScript app; strict TS, lint, Vitest, Supabase Auth SSR, Drizzle or Supabase SQL and `sql/001_initial.sql`; apply both supplied SQL migrations, configure `.env.example`, runtime env validation and `/api/health`.
2. **Arc contract:** integrate the supplied Solidity reference; compile with a compatible recent OpenZeppelin v5; write exhaustive tests; deploy via Arc Studio / its supported workflow; verify network, ERC-20 transfer semantics and funding/claim on real Arc Testnet.
3. **Identity/authorization:** GitHub OAuth via Supabase, immutable provider ID from `identities`, creator wallet bind, one-time signed wallet challenges, scoped server routes, all SQL tables RLS-on.
4. **GitHub merge + worker:** authenticated minimal merge workflow; backend verifies actual merged PR; persist idempotent job; trigger `repository_dispatch` on central implementation repo; GitHub Action evaluates job and posts signed result. Support GitHub public repos. GitLab adapter types only as stretch.
5. **0G evaluator:** collect real diff/commits/reviews/CI; enforce input size caps, structured schema, evidence citations, prompt-injection isolation and reviewer exclusion. Never calculate money inside LLM.
6. **Funding controller + claims:** reconcile Arc deposit events, compute budget, persist deterministic allocation preview, approval, reserve period onchain, bind wallet, privately issue vouchers and claim. Implement retry/idempotency and timeout handling.
7. **Chainlink CRE:** make real CRE project from official current CLI template. A workflow reads Arc state plus authenticated external report endpoint; simulate, capture logs and link verified evidence hash to epoch. Avoid faking CRE SDK signatures.
8. **Arkiv:** create issuer-owned Program and Contribution entities; query them from app; write `/arkiv/schema.md`, `friction.md`, `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md` with actual evidence.
9. **Deployment:** Vercel Hobby + Supabase Free + GitHub public Actions. Perform complete smoke test with deployed URLs, Arc explorer links, Arkiv entity keys and CRE simulation logs. Update full README and sample demo video script.

## Output requested from Codex

- A full functional monorepo under `app/` with all source, SQL, Solidity, CI workflows, scripts, fixtures, typed API schemas, tests, and deployment docs, not only skeletons.
- `app/.env.example` with exact field ownership; never write non-placeholder secrets to git.
- Real tests for model parsing/eligibility, budget rounding, DB job idempotency, OAuth authorization, typed voucher EIP-712 hashing, vault invariants, claims and simulation.
- `app/docs/DEPLOYED.md` containing **actual** deployed artifacts when credentials are available; otherwise a list of explicit missing user inputs rather than fake URLs/addresses.
- `app/docs/IMPLEMENTATION_STATUS.md` marking each gate PASS/BLOCKED/NOT STARTED and links to evidence.

## Precise definition of done

All checkboxes in `docs/ACCEPTANCE.md` pass. A real merged GitHub PR produces evaluation, an approved epoch reserves only affordable USDC, user A can privately claim their share, user B can independently claim theirs, reviewer receives nothing, duplicate claim fails, lower recent inflow lowers future unreserved allocations, CRE simulation succeeds, Arkiv public query works, and deployment is reachable without paid instances.

## Constraints for coding agent

- Use official current libraries and **pin resolved versions in a lockfile**; verify API shapes before codegen. Do not invent outdated CRE or Arkiv methods.
- No unsafe use of GitHub PR text or `eval`/shell interpolation. No private keys in frontend, logs, GitHub merge-trigger repo or public docs.
- Acknowledged manual gates: creating accounts, obtaining faucets, Supabase GitHub OAuth configuration, Arc Studio, Vercel deployment credentials. When blocked, code all other parts and provide exact steps.
- No real-money mainnet deployment; testnet-only.
- Execute tests and fix failures before claiming completion. If a sponsor integration is not operable, record failure precisely instead of showing fake success.
