# Proof of Contribution — Implementation Change Request

Apply this as a **delta to the existing project and Codex blueprint**, not as a rewrite. Keep the product name **Proof of Contribution** throughout. Inspect the current code, migrations, contracts, and tests first; preserve working integrations unless a change below requires otherwise.

## New product behavior

1. **Owner-controlled funding:** A program/repository owner can **Start Funding** and **Stop Funding**. Only PRs/MRs merged while funding was active qualify for rewards. A merge during a stopped interval never becomes eligible retroactively. Determine eligibility from the forge-verified merge timestamp and an auditable history of funding-state transitions—not webhook arrival or AI completion time. A merge that occurred during an active interval remains eligible if processing finishes after funding stops.
2. **Immediate evaluation and allocation:** A verified post-merge event triggers 0G evaluation and automatic reward calculation **immediately**, followed by an onchain reservation for eligible contributors. Remove periodic/epoch-based allocation and mandatory maintainer approval from the payout path. Asynchronous processing and retries are fine; never promise a reward until the reservation is confirmed.
3. **Donation-aware payouts:** Both program-owner/DAO funding and public donations count toward the funding rate. AI scores contribution quality and, when needed, allocates shares among eligible code contributors. A deterministic, documented formula converts the score and funding rate to a reward, bounded by spendable treasury funds and a **hard total reward cap per PR/MR set at project creation**. Lower incoming funding reduces *future* rewards; it must never modify already reserved rewards. Use fixed-point/integer arithmetic for money. If funding is insufficient, record the contribution but do not create an unfunded claim.
4. **No reviewer rewards:** Reviews and maintainer feedback may inform scoring, but organizational reviewers/maintainers are not payout recipients merely for reviewing. Only authenticated eligible code contributors receive shares; the sum of all shares for one PR/MR must fit the single per-PR cap.
5. **Claim without pre-registration:** Attribute rewards to stable, provider-qualified forge user IDs at merge time. Contributors need no account or wallet beforehand. At claim time, use **thirdweb GitHub login and an automatically provisioned embedded wallet**. Verify the provider identity on the server against the forge account used for reward attribution; do not trust a username, email, or client-supplied user ID. Authorize a single-use, recipient-bound Arc payout. Keep private reward amounts off public profile records where possible (onchain transfers remain public).
6. **Already earned rewards survive stop:** Stopping funding blocks *new* eligible merges, not previously reserved claims. Donations may still enter the treasury while funding is stopped, but they do not automatically turn rewards back on.

## Integrations to preserve

- **Arc Testnet:** Owner-authorized funding state, custody, immutable per-PR cap, reservation of funded allocations, individually claimable payouts, replay protection and solvency checks. Distinguish spendable from reserved balance.
- **0G:** Real inference on verified merged diffs/tests/review evidence; persist evidence hash, score, explanation, and request metadata. AI cannot directly transfer funds or override hard limits.
- **Chainlink CRE:** Adapt the external-merge-evidence/onchain-treasury verification workflow to the immediate allocation lifecycle; keep a reproducible, genuine CRE simulation.
- **Arkiv:** Keep publicly queryable program and contribution attestations, including eligible/ineligible status and settlement references, without exposing private claimant identity mappings.
- **Web2:** Retain the existing free Vercel + Supabase + GitHub Actions approach, and the existing forge adapters where feasible.

## Required changes

- Replace periodic reward allocation UI, jobs, schemas, and docs with per-merge evaluation/reservation states. Migrate existing schema safely rather than deleting unrelated data.
- Add owner-only Start/Stop controls, persisted funding-transition history, and tests for delayed/out-of-order webhooks and merge-time eligibility.
- Add the project-creation per-PR cap and enforce it **onchain**, including combined payouts to multiple contributors. Preserve one-time claim semantics.
- Refactor the claim flow around verified thirdweb GitHub identity + embedded wallet, with server-side authorization and no public wallet-request comments or emails.
- Update diagrams, README, environment-variable template, deployment instructions and judge demo to reflect this final behavior.

## Acceptance tests

- Active merge → one 0G evaluation → one capped, funded reservation; repeated event cannot allocate again.
- Stopped merge → no reward, even after restart; active merge evaluated after stop → still eligible.
- Decreasing donation rate reduces subsequent allocations, never existing reservations.
- Two code contributors can split one PR reward; reviewer receives zero; combined amount never exceeds the PR cap.
- Insufficient funds → no unfunded promise; claim remains unavailable.
- thirdweb GitHub identity matches the eligible forge ID; a different account cannot claim. Valid embedded-wallet claim succeeds exactly once.
- Arc events/transactions, CRE simulation, and Arkiv write-and-read are demonstrable; no mocked integration is presented as live.

## Engineering expectations

Keep the implementation **simple, elegant and idiomatic**. Prefer small, cohesive modules and existing project conventions over new frameworks, unnecessary abstractions, extra services, or premature generalization. Enforce security-critical invariants in contracts and the backend, not just in UI or LLM prompts. Make handlers idempotent; validate external inputs; keep credentials server-side; use explicit state transitions, structured logs, minimal dependencies, and focused tests. Avoid duplicated reward logic. If current code conflicts with these requirements, make the smallest sound change, document any unavoidable trade-off, and run relevant tests. Do not claim deployment or bounty eligibility without verifiable evidence.
