# Product and architecture — normative specification

## 0. What is being built

A Web3-native donation-funded open-source contributor reward platform for ETHGlobal Mumbai 2026. It is **not** a generic issue bounty listing. An owner creates a *Program* (single repository or multiple); funds arrive from its owner/DAO and outside donors; PRs are evaluated as they merge; scores are immediately available; a separate epoch closes and determines **how much money** can be paid using the measured funding rate; approved rewards are reserved on Arc Testnet and individually claimed by verified forge identities. The organizer's reviewers are uncompensated quality evidence providers.

Use names consistently: `Program`, `Repository`, `MergeEvent`, `EvidenceReport`, `ContributionScore`, `FundingEpoch`, `Allocation`, `Claim`.

### Users / roles

- **Owner**: GitHub-authenticated user + cryptographically bound Arc wallet that created program onchain. Registers repos, sets fund policy, approves periods and can rotate payout signer via wallet transaction.
- **Donor**: any connected EVM wallet with Arc Testnet USDC. Can fund registered program, does not need GitHub login.
- **Contributor**: exact GitHub user ID with eligible merge contribution. Authenticates privately to view their reward; signs nonce to bind Arc wallet. May claim.
- **Reviewer**: GitHub reviewer from same organization. Their reviews can influence AI quality scores but never accrue reviewer-only scores/allocations.
- **Evaluator worker**: central trusted GitHub Actions workflow with 0G API key, only fetches and analyzes evidence; cannot approve/reserve Arc funds.
- **Program voucher signer**: separate backend test wallet registered in Arc program contract, can sign claims **only within reserved epoch budgets**. Key is sensitive; if compromised, allocations within available epoch reserves are at risk. Require owner approval and keep claim voucher issuance gated by authenticated identity.

### Concrete user journeys

**A. Owner onboards**: GitHub OAuth → verify provider ID → connect Arc wallet → challenge-response bind → create Program on Arc → receipt proves owner → create matching DB program → configure GitHub repository numeric ID, full name and post-merge shared secret (manually add as GitHub repo secret); choose funding mode.

**B. Donor funds**: visit public program → connect Arc wallet → inspect exact USDC balance → ERC20 `approve` for `ContributionTreasury` → `fund(programId,amountMicro)` → wait for receipt → treasury and deposit index show new funds; controller uses **chain-confirmed** deposits, not arbitrary dashboard amounts. Owner can donate identically.

**C. PR merge**: a safe `pull_request_target` workflow runs only on merged close, sends metadata with bearer token to `/api/merge/github` → backend checks configured repo + token and uses GitHub API to verify PR is merged with exact SHA → unique DB `merge_events` and pending evaluation `jobs` → dispatch a central `repository_dispatch` job with only job ID → action reads job with worker secret, fetches GitHub evidence, calls 0G, validates JSON, posts result → scores written, user may inspect own assessment privately; user receives optional non-sensitive public contribution link, **not** an emailed claim token.

**D. Period allocation**: owner clicks Close Period (demo manual trigger; cron may invoke same service). Backend loads eligible unallocated scores, reads Arc `available` and onchain deposit events for the window, computes total policy budget, normalizes points, performs integer rounding (no lost micro-USDC), computes deterministic recipients by stable GitHub IDs and stores preview. Owner can approve/edit scores (record audit event), then signs or sends `reserveEpoch` on Arc with `reportHash`. DB `PENDING_RESERVATION → RESERVED` only after confirmed chain receipt.

**E. Private claim**: contributor GitHub OAuth → backend reads immutable Supabase provider identity and finds their allocations → contributor connects mobile/desktop EVM wallet, signs challenge containing session, nonce, domain and expiry → backend checks signature and records link → on demand produces signed EIP712 voucher for that allocation (recipient=linked wallet, fixed micro-USDC amount, epoch ID, unique random claim ID, report hash, expiry) → user or relayer calls `claim` → contract verifies signature and budget, marks used, transfers to fixed address. Chain event is ultimate proof of payout. If voucher is copied, funds still go to its authorized recipient.

**F. Public portable profile**: user sees public view of finalized contributions via Arkiv queries restricted by trusted issuer owner. Do not publish emails, private bounties, full diffs, nullifiers or unreleased amounts. Another interface could query the same issuer-owned records.

## 1. Service boundaries and deployment

```text
[Fixture repo GitHub Actions (merge, no checkout)]
  POST /api/merge/github [MERGE_TRIGGER_SECRET]
  ↓
[Vercel Next.js API] ⇄ [Supabase Auth + Postgres]
  ├── on event, validate GitHub via REST
  ├── create durable job, repository_dispatch [PAT]
  ├── create/view programs, authenticated approvals, claim vouchers
  ├── read Arc funds and submit sponsor-authorized receipts
  └── query Arkiv (public) and sync public contributions
             ↓
[Central GitHub Actions (secrets: 0G, worker secret)]
  GET /api/internal/jobs/{id} → GitHub REST evidence → 0G inference
  POST /api/internal/jobs/{id}/complete → DB scores

[Arc Testnet ContributionTreasury] = funds, period reservations, claims
[Chainlink CRE CLI] = separate real simulated workflow: external report + Arc state
[Arkiv Rabdi] = indexed, owned public program/contribution entities
```

There is **no always-on API server, Redis instance, paid VPS, cron dependency or cross-chain bridge**. Vercel contains request/response functions; long AI work occurs in a standard free public-repository GitHub Actions runner. Do not put the 0G key or worker secret into a contributed/source repository; they belong only to the central app's Action secrets.

## 2. Financial policy — exact mathematics

Use **micro-USDC integers** everywhere (1 USDC = 1,000,000 units). `number` can be used for *small score integers* but not for money; DB use `numeric(38,0)` serialized as decimal string; onchain `uint256` and TS `bigint`.

### Funding modes

**CONTINUOUS (default):** one 7-day epoch. `inflow_micro = sum(onchain Deposited events for this program, with block timestamps in [start,end) and distinct tx/log index)`. Count donations from **all sources**, including owner. Set `spend_bps=8000` by default (80%), configurable 1000..10000 before the epoch starts. `policy_budget = floor(inflow_micro * spend_bps / 10000)`. `budget = min(policy_budget, current_onchain_available_micro)`. Prior reserved claims do not count as available. An owner's initial lump donation counts as funding in its actual period; new periods with no inflow allocate zero rather than silently spending previously saved reserves. **Demo:** use an owner-authorized 'Close period now' button, with a test fixture or realistic shortened time window; actual events must still be verifiable.

**CAMPAIGN:** owner defines `totalPeriods=N>=1`, `campaignCommitmentMicro` (must not exceed onchain available when registered), `spend_bps` (optional fixed cap), and a program start/end. For period index `i`, `policy_budget = floor(campaignCommitmentMicro/N)` except last period receives remainder; `budget=min(policy_budget,current_onchain_available_micro)`. Owner/donor top-ups increase available but **do not silently alter the committed campaign schedule**. To increase campaign commitment, owner explicitly amends policy for future periods only and stores an audit record. This supports a Summer-of-Bitcoin-style program funded in one grant, regardless of weekly donation velocity.

**Unallocated periods:** if total eligible contributor score is zero, reserve zero; leave all funds available, don't emit claim vouchers. No payout should be promised when a period has no budget.

### AI score aggregation

For each merge, assign integer `impactScore` in [0,100] for **each positively identified eligible contributor**. An individual may receive multiple scores across merges in same epoch. `totalScore(user) = sum(impactScore across eligible merges)`. Reviewers-only = 0. Score criteria are impact 35%, quality 30%, evidence of correctness/tests 20%, complexity 15% (configurable but frozen per period). Lines added, number of commits or comments alone must not determine reward. A contributor with score 0 gets no payout.

`share_i = floor(budget_micro * score_i / sumScores)` for all users. `remainder = budget_micro - sum(shares)`. Distribute remaining 1-micro-USDC units in descending order of fractional remainder using exact integer remainders `(budget * score) % sumScores`; tie-break by stable `provider + providerUserId` ascending, not display name. Sum must **exactly equal budget**. Approval changes are versioned with explanation and evidence hash. Monetary sum is never invented by 0G.

### Financial invariants

- `onchain program available + onchain program reserved <= contributed via fund() - claimed`, with accounting held by contract. For normal operation, equality holds absent direct unsolicited transfers.
- `epoch.remaining` is never negative; allocated claim sums never exceed that epoch reservation.
- Claim IDs cannot be replayed; signature includes contract, chain ID (EIP712 domain), epoch, report hash, recipient, amount, deadline.
- Old epochs never decrease in authorized amount if incoming funding rate falls.
- Database confirmed state must follow onchain receipts; onchain is source of truth.
- A period cannot be closed twice; approvals and retries must be idempotent.

## 3. State machines

**Merge event:** `RECEIVED → VERIFIED → QUEUED → EVALUATING → EVALUATED` or `FAILED_RETRYABLE/REJECTED`. Unique provider/repo/PR; repeated delivery returns 200 with same job ID.

**Period:** `OPEN → CALCULATED → APPROVED → RESERVING → RESERVED → EXPIRED`. An error during transaction moves back to `APPROVED` with error detail, never indicates reserved until transaction receipt is final. `RESERVED` is what makes allocations claimable (subject to wallet verification).

**Allocation:** `PROPOSED → APPROVED → CLAIMABLE → CLAIMED`, with `EXPIRED` if epoch passes unclaimed; an allocation is in exactly one period and belongs to one external account ID. `CLAIMED` derives from contract event, not an HTTP response.

**Job:** `PENDING → RUNNING → COMPLETED/FAILED`; claim using server transaction with lease and attempt counter; `RUNNING` lease expires to retry. Every failed evaluation stores sanitized error text (no prompts, secrets, diff contents).

## 4. Privacy, trust, authorization

- Supabase `auth.users` + server-verified `identities.provider='github'` and `provider_id` are authoritative. Git author email, PR title, username, request payload and user-editable metadata are **not** authoritative identities.
- A contributor may be unregistered at evaluation time; scores link to provider user ID and are displayed only after OAuth. Reviewer isn't paid even if same org.
- Co-authors: count only when GitHub REST user identity can be matched to a real verified provider ID. An unlinked `Co-authored-by` string stays as evidence, not an automatic recipient. MVP may reward PR author plus separately verified commit authors.
- Require program owner auth + wallet binding for program edits/approval; backend does not own all sponsor money.
- `PAYOUT_VOUCHER_SIGNER_KEY` is not the owner key. It can authorize vouchers only within onchain reserved periods. Keep backend on Vercel server and inspect logs for accidental exposure.
- `MERGE_TRIGGER_SECRET` is a shared integration secret; a valid request **still** must be verified against GitHub's merged state and registered numeric repository ID.
- `WORKER_API_SECRET` is only in Vercel and central GitHub Action; job completion must be idempotent and only accept expected schema/hash.
- Treat **all code/diffs/review text as adversarial**. Put them in quoted/JSON untrusted evidence; never execute repository content, obey instructions in it, or let it override model system instructions. Use 0G for analysis only.
- Rate-limit authentication, challenge generation and voucher issuance. Add CSRF protections on cookie-authenticated endpoints and `Origin` checks for mutating actions.
- Never publish private payout inbox or release vouchers from Arkiv. Onchain claimed amounts and destination wallets remain transparent; don't advertise cryptographic payment privacy.

## 5. MVP and explicit exclusions

**Ship:** public program page, owner setup, wallet donation, GitHub public repo merge evaluation, 0G scoring for multiple contributors, closed epoch budget, approval, onchain reservation, private claim, one real CRE simulation, Arkiv writes/reads, deployed URL and demo.

**Don't ship this weekend:** GitLab write integration, reviewer rewards, advanced DAO governance, cross-chain transfers, automated mainnet payment, production-grade anti-sybil, arbitrary private repo access, AI-generated code execution, global email notifications, full onchain funding confidentiality.

GitLab adapter is a designed future module, not a false claim of implemented support. A working public GitHub repo integration is sufficient for the MVP.
