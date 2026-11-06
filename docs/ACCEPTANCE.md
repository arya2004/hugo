# Exact acceptance tests and demo gates

Mark PASS only after actually running the test. For tests requiring credentials, mark BLOCKED and list which secrets or faucet funds are missing.

## A. Unit tests

- [ ] Continuous budget: inflow 100 USDC, spendBps 8000, available 200 → 80 USDC.
- [ ] Continuous budget: inflow 25, spendBps 8000, available 10 → 10 USDC.
- [ ] Funding drops: second period inflow 25 vs first 100 → future budget drops 80→20 (if enough available); first period reserved unchanged.
- [ ] Campaign: commitment 100, 3 periods -> 33.333333, 33.333333, 33.333334 USDC, subject to available funds.
- [ ] Exact integer payout: scores 80/50/20 distribute all 100000001 micro-USDC with deterministic remainder.
- [ ] Zero scores/zero available -> no allocation and no claimable funds.
- [ ] Review-only identity receives no reward; reviewer comments can affect contributor evaluation only.
- [ ] Same identity across multiple merged PRs aggregates; distinct GitHub identities never merge merely by matching username or email.
- [ ] AI malformed JSON, invented evidence key, negative score, prompt-injection text -> rejected, no allocation.
- [ ] Duplicate merge trigger -> one stored merge event and one logical evaluation.
- [ ] Unauthorized program owner/mismatched verified GitHub ID -> 403; no other user's private claims disclosed.

## B. Smart contract tests

- [ ] Owner creates program with nonzero signer; duplicate program ID reverts.
- [ ] Two wallets donate; deposit events show donor, program, token amount and can be reconciled.
- [ ] Nonowner cannot reserve or rotate signer.
- [ ] Reserve more than available reverts; reserved + available equals intended remaining ledger.
- [ ] Valid EIP-712 voucher pays fixed recipient from specified epoch, decrements epoch remaining, emits event.
- [ ] Voucher's caller can be **any** relayer, but recipient cannot be changed.
- [ ] Duplicate claim ID, wrong recipient/amount, wrong epoch, report hash, signer, chain or verifying contract, expired claim all revert.
- [ ] Payout exceeding epoch remaining reverts atomically.
- [ ] After deadline, owner releases unclaimed epoch budget, and old vouchers fail.
- [ ] Use SafeERC20; no unexpected payment from caller after failed signature.

## C. End-to-end GitHub → 0G

- [ ] Fixture repo has real PR with two GitHub-identified contributors and one reviewer.
- [ ] Its merged close event triggers secure workflow without checkout/exec of PR code.
- [ ] Vercel authenticates trigger and independently confirms `merged=true` and exact `merge_commit_sha`.
- [ ] Central public GitHub Actions workflow is invoked by `repository_dispatch` and contains 0G key **only in Action secret**.
- [ ] 0G call returns actual inference ID, model, structured scores with evidence references; all verified against fetched evidence.
- [ ] Invalid event secret or a fake merge SHA fails; job retry doesn't double-score.

## D. Funding → private claim

- [ ] Owner and external donor can both fund a program on Arc Testnet USDC.
- [ ] Owner closes an epoch; console shows verified onchain available, inflows, score sum, budget formula and remainder handling.
- [ ] Owner approves; onchain `reserveEpoch` creates a budget with nonzero `reportHash`.
- [ ] User A logs in with matching GitHub OAuth, sees only user A allocation; no emailed bearer link needed.
- [ ] User B sees only their allocation; reviewer-only user sees none.
- [ ] User A links wallet by signing nonce; copied claim link to other session cannot redirect recipient.
- [ ] User A and user B independently claim USDC on Arc; explorer events confirm amounts and claim IDs.
- [ ] Second claim with same ID fails; backend reflects canonical chain state on refresh.

## E. Sponsors

- [ ] Arc Studio project URL is shareable and Studio is shown in demo. Contract deployed and verified/tested on chain 5042002; architecture diagram, video and repo links submitted.
- [ ] CRE CLI simulation succeeds with at least one real Arc read and one real external API/AI report call. Log shows IDs and report hash. No false claim that simulation signed the actual onchain payout.
- [ ] Arkiv Rabdi wallet writes Program and Contribution entities; frontend makes at least one real SDK query restricted to issuer owner and displays result. Docs at required `/arkiv/*.md` paths, writer wallet and reproducible query included.
- [ ] 0G inference is real and essential to evaluation; no claim of consumer prize qualification absent separate consumer-app feature.

## F. Deployment

- [ ] Next.js is deployed to Vercel Hobby, Supabase project active and GitHub Actions central repo public.
- [ ] GitHub OAuth works via `https://<SUPABASE_REF>.supabase.co/auth/v1/callback` and allowed Vercel `/auth/callback` URL.
- [ ] `.env.example` placeholders; no exposed `SUPABASE_SERVICE_ROLE_KEY`, tokens or private keys; no secrets in screenshot/video.
- [ ] `/api/health` returns db+chain connectivity flags without leaking secrets.
- [ ] Owner demonstrates lowering funding rate affecting **new** allocation only.
- [ ] Five-minute demonstration can be replayed without waiting seven days by closing a short demo period, but explicitly identifies testnet funds and demo fixtures.
