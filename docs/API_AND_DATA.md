# API, persistence and identity contract — normative

All monetary numbers are **base-10 integer strings in micro-USDC**. Client cannot supply an arbitrary approved monetary amount or reward recipient. All state-changing API routes: `Cache-Control: no-store`; strict JSON schema via Zod; `Content-Type: application/json`; reject bodies >64 KiB (worker evidence can be 1 MiB by special route); check same-origin for cookie-authenticated writes; emit request ID; redact secrets. Every route uses Node.js runtime, never Edge.

## 1. Auth and server DB boundaries

Use Supabase GitHub OAuth using `@supabase/ssr` and the PKCE flow. Implement `src/lib/supabase/client.ts`, `server.ts`, and Next.js 16 `proxy.ts` from the official SSR quickstart (Next.js <=15 uses `middleware.ts` instead). For secure routes call `auth.getClaims()` to validate the JWT, then read `auth.users`/`auth.identities` **server-side** to retrieve the actual stable GitHub provider ID. Do NOT use `user_metadata.user_name`, email, commit authorship, or display name as identity. Fetch `auth.identities` only with the Supabase service-role client; protect the role key. If the user authenticated through GitHub but no stable ID is available, return 403 rather than guessing.

The SQL migration enables RLS with **no client policies**. Browser uses public/publishable Supabase key for OAuth only; server route handlers access private application tables through service-role key after verifying user/owner. Never use `SUPABASE_SERVICE_ROLE_KEY` in client components or GitHub source-repo workflows. For Vercel use `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})` in a `server-only` module, and do not cache service-role query results across identities. Verify `auth.users` ID equals submitted user's authenticated principal.

### OAuth setup

- Click **Continue with GitHub**. `supabase.auth.signInWithOAuth({provider:'github',options:{redirectTo: location.origin+'/auth/callback'}})`.
- `/auth/callback?code=...` must exchange PKCE code with Supabase server client and redirect to `/dashboard`.
- New GitHub accounts can sign in; record GitHub numeric ID only when authenticated. One account may have no contributions.
- To bind wallet, issue one-time challenge with 5-minute expiry; exact message includes app domain, Supabase authenticated user UUID, lowercased requested address, random 32-byte nonce, chain ID `5042002`, issued/expiry UTC and a purpose string. Store SHA-256 nonce hash; never log full nonce.
- Validate signature with viem `verifyMessage` against claimed address, then in one atomic update mark nonce consumed and insert `wallet_links`. One nonce cannot be reused; disallow domain mismatch and expired challenge. Bind only after GitHub OAuth.
- For owner create program, require wallet signature and onchain `ProgramCreated` event with owner = linked address.

## 2. API envelope and errors

Success: `{ "data": <payload>, "requestId": "uuid" }`. Error: `{ "error": {"code":"SOME_CODE","message":"Safe explanation"}, "requestId":"uuid" }` with 400 schema, 401 not signed in, 403 not authorized, 404 not found, 409 state conflict/duplicate mismatch, 422 invalid evidence, 429 throttled, 500 unexpected and 503 dependency failure. Idempotent duplicate event returns 200 and same IDs. Do not leak private evaluations in error messages. The stable ID used by all paths is the DB UUID, unless explicitly called `chainProgramId` or `chainEpochId`.

## 3. Public routes

| Method | Path | Input and expected result |
|---|---|---|
| GET | `/api/health` | `{db:'ok'|'down',arc:'ok'|'down',arkiv:'ok'|'down',version,requestId}`; no secrets or private keys |
| GET | `/api/programs` | Query `limit` 1..50, `cursor`, `status=ACTIVE`; return public id, name, repository count, funding policy, onchain program ID and public contract balances; never private rewards |
| GET | `/api/programs/:id` | Public name, description, policy, registered forge repos, Arc treasury values, historical *aggregate* donation volumes |
| GET | `/api/profiles/:provider/:providerUserId` | Arkiv-backed public contribution attestations and verifiable issuer links; no private allocation or claim token |
| GET | `/api/arkiv/programs` | Execute real Arkiv SDK read from Rabdi; return schema-tagged Program entities filtered by project/issuer, with entity keys |

Public profile may be pseudonymous: provider numeric ID is not inherently confidential but do not expose email or a link to financial allocations.

## 4. Authenticated user routes

| Method | Path | Request → response | Authorization |
|---|---|---|---|
| GET | `/api/me` | `{authUserId,githubUserId,linkedWallets[]}` | GitHub-authenticated session |
| POST | `/api/wallet/challenge` | `{address:'0x...'}` → `{challengeId,message,expiresAt}` | Login required; rate limit |
| POST | `/api/wallet/verify` | `{challengeId,address,signature}` → `{linked:true,address}` | Login; one-time nonce |
| GET | `/api/me/contributions` | Array of merge SHA, evaluator summary, scores associated with **this immutable provider ID** | Login |
| GET | `/api/me/allocations` | `{allocationId,epochId,amountMicro,claimStatus,expiresAt}` for own ID only | Login |
| POST | `/api/allocations/:id/voucher` | `{recipientWallet}` → EIP712 typed data, signature, immutable amount/claim/report fields | Login, matching allocation identity and verified wallet; epoch reserved, not expired; signer backend |
| POST | `/api/allocations/:id/tx` | `{txHash}` → checked onchain receipt/state | Login; tx must emit correct claim event |

`voucher` must be issued from DB-approved amount and report hash (never browser input). It may be regenerated for the **same bound wallet, claim ID, amount and expiry**; never permit arbitrary recipient replacement after voucher issued. To switch wallets before first voucher, explicit revoke/rebind and invalidate old voucher is not possible without rotating epoch signer; for MVP lock recipient after first issuance and document it.

## 5. Maintainer routes

| Method | Path | Request → response | Requirements |
|---|---|---|---|
| POST | `/api/programs` | `{name,description,policy,spendBps,epochDays,ownerWallet,chainCreateTxHash, campaignCommitmentMicro?,campaignPeriods?}` → program | Auth GitHub + bound owner wallet; validate onchain ProgramCreated id and signer; do NOT take user-provided owner as authority |
| POST | `/api/programs/:id/repos` | `{provider:'github',fullName,externalRepoId,defaultBranch}` → repo record | Owner; GitHub API fetch repo and confirm immutable numeric ID + access/permissions |
| POST | `/api/programs/:id/epochs/preview` | `{periodIndex, periodStart,periodEnd}` → deterministic preview with scores, inflows, available, budgetMicro, per-contributor shares, reportHash | Owner; period cannot overlap, completed merges limited to period |
| POST | `/api/programs/:id/epochs/:epochId/approve` | `{reportHash}` → unsigned `reserveEpoch` tx call payload, DB status APPROVED | Owner; one approved canonical report; authorizing wallet transaction still required |
| POST | `/api/programs/:id/epochs/:epochId/confirm-reserve` | `{txHash}` → verify chain receipt, epoch id, owner, amount, report hash; set RESERVED only after receipt | Owner; idempotent |
| POST | `/api/programs/:id/epochs/:epochId/reconcile` | `{}` → refresh onchain status, claims and DB | Owner |

Donor funds directly using wallet `approve()` and vault `fund()`, client subscribes to receipt or page re-fetches. No API key that could withdraw funds is required for deposits.

## 6. Machine-to-machine routes

| Method | Path | Authentication | Processing |
|---|---|---|---|
| POST | `/api/merge/github` | `Authorization: Bearer MERGE_TRIGGER_SECRET`; constant-time comparison | Validate payload `{provider:'github',repository:string,repositoryId:string,prNumber:integer,mergeSha:string}`; query GitHub REST merged PR, immutable repo ID, canonical SHA; upsert merge event+job uniquely; dispatch only job ID |
| GET | `/api/internal/jobs/:jobId` | `Authorization: Bearer WORKER_API_SECRET` | Atomically claim lease; return repo, PR, merge SHA, **no keys**; 409 if already processing/completed |
| POST | `/api/internal/jobs/:jobId/complete` | `WORKER_API_SECRET` | Validate exact evaluation schema, merge/evidence hash and all source evidence identifiers; write evaluation/scores in one DB transaction; complete lease idempotently |
| POST | `/api/internal/jobs/:jobId/fail` | `WORKER_API_SECRET` | Mark retryable failure with sanitized reason and bounded backoff, max 3 attempts |
| GET | `/api/cre/report/:epochId` | `Authorization: Bearer CRE_EXTERNAL_REPORT_TOKEN` | Return approved report hash, program/epoch id, merged PR reference, funding snapshot, scores hash, network+contract address; no emails/private allocations/signatures |

Do not include confidential AI evidence or private allocation recipients in the CRE report unless required and approved; CRE simulation may log results.

### Example post-merge request

```json
{"provider":"github","repository":"org/demo-vault","repositoryId":"123456789","prNumber":42,"mergeSha":"a123456789012345678901234567890123456789"}
```

### Example evaluation result

```json
{
  "version":"poc-eval-v1",
  "mergeSha":"a123456789012345678901234567890123456789",
  "evidenceHash":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "model":"ACTUAL_MODEL_ID",
  "inferenceRequestId":"ACTUAL_0G_RESPONSE_ID",
  "scores":[
    {"provider":"github","providerUserId":"1001","role":"CONTRIBUTOR","impactScore":85,"evidenceKeys":["commit:a123456"],"justification":"Implementation linked to file diff"},
    {"provider":"github","providerUserId":"1002","role":"CONTRIBUTOR","impactScore":60,"evidenceKeys":["commit:b123456"],"justification":"Added corresponding tests"},
    {"provider":"github","providerUserId":"1003","role":"REVIEWER_ONLY","impactScore":0,"evidenceKeys":["review:987"],"justification":"Reviewed, but review-only is not paid"}
  ]
}
```

The server accepts only `providerUserId`s present in an independently collected GitHub evidence identity roster. If contributors cannot be linked to verified GitHub identities, record them as unmatched evidence and do not create financial allocations. Reject duplicate payout IDs and any score outside integer 0..100. Source PR text is untrusted.

## 7. SQL migrations and atomicity

Use `sql/001_initial.sql` **and** `sql/002_atomic_functions.sql` as supplied. The latter implements three `SECURITY DEFINER` Supabase RPCs: `claim_job` (atomic lease with retry cap), `finish_job` (insert evidence + evaluation + scores + state transitions in one transaction), and `fail_job` (record failure). All `EXECUTE` permissions are revoked from `public`, `anon`, and `authenticated`, then granted to `service_role` only. API handlers must authenticate the worker secret *before* calling these RPCs. Never expose the service-role key to the browser. Use the exact argument names and return values in migration 002.

The backend **must** independently validate scores, known forge identities and evidence keys before `finish_job`: SQL validates basic data types, uniqueness and reviewer-zero rules, but it **does not** reconstruct GitHub evidence and is not an authorization layer. Lease execution with service-role `rpc('claim_job', ...)`, validate the resulting `acquired` flag, then evaluate; after 0G success call `rpc('finish_job', ...)`. On failure call `rpc('fail_job', ...)`. Retrying the same already-completed logical job must not insert a second evaluation.

Epoch preview/approval needs a **separate atomic DB transaction or privileged RPC** created by Codex: lock the program and period rows, reject periods already approved/reserved, verify no eligible score has already been committed to an earlier period, and atomically store the resulting allocation preview. With Supabase PostgREST, implement another carefully permissioned RPC or use direct Postgres in a single transaction; **do not** simulate atomicity with successive REST writes. Donation rows are sourced from verified Arc `Deposited` logs with unique transaction hash/log index, not user-supplied amounts.

Index `allocations(identity_provider,provider_user_id)`, `merge_events(provider,external_repo_id,pr_number)` and `donations(program_id,block_timestamp)` as in migration 001. Use paginated GitHub file/review retrieval and reject incomplete evidence rather than score truncated PRs.

## 8. Deterministic budget module — reference code

```ts
export type ClaimShare = { identity: string; score: bigint; amount: bigint };
export function epochBudget(
  fundingMode: 'CONTINUOUS'|'CAMPAIGN',
  onchainAvailableMicro: bigint,
  periodInflowMicro: bigint,
  spendBps: bigint,
  campaignCommitmentMicro: bigint,
  campaignPeriods: bigint,
  periodIndex: bigint
): bigint {
  if (onchainAvailableMicro < 0n || periodInflowMicro < 0n || spendBps < 0n || spendBps > 10000n) throw Error('Invalid budget input');
  const policy = fundingMode === 'CONTINUOUS'
    ? periodInflowMicro * spendBps / 10000n
    : (periodIndex === campaignPeriods-1n
        ? campaignCommitmentMicro - (campaignCommitmentMicro / campaignPeriods)*(campaignPeriods-1n)
        : campaignCommitmentMicro / campaignPeriods);
  return policy < onchainAvailableMicro ? policy : onchainAvailableMicro;
}
export function allocate(budget: bigint, scores: {identity: string; score: bigint}[]): ClaimShare[] {
  if (budget < 0n) throw Error('Negative budget');
  const ss = scores.filter(s=>s.score>0n).sort((a,b)=>a.identity.localeCompare(b.identity));
  const total=ss.reduce((n,s)=>n+s.score,0n);
  if (total===0n) return [];
  const rows=ss.map(s=>({identity:s.identity, score:s.score, amount:budget*s.score/total, residue:budget*s.score%total}));
  let rem=budget-rows.reduce((n,r)=>n+r.amount,0n);
  const order=[...rows].sort((a,b)=>a.residue===b.residue ? a.identity.localeCompare(b.identity) : a.residue>b.residue?-1:1);
  for(let i=0;rem>0n;i++,rem--) order[i].amount++;
  return rows.map(({identity,score,amount})=>({identity,score,amount}));
}
```

Contributors with `amount=0` may show score but no claim voucher. `claimId` should be generated only for positive allocations. Test 100000001 micro across 80/50/20 with exact sum and deterministic tie-break.

## 9. UI page contract

`/` landing/demo; `/programs` public discovery; `/programs/[id]` program + Arc deposits (public); `/dashboard` owner programs and contributor inbox; `/programs/new` owner wizard with wallet binding; `/programs/[id]/manage` repo onboarding, epoch preview, approve, reserve; `/claim` logged-in private claims; `/contributors/[provider]/[id]` Arkiv public profile. All private pages must server-check auth and avoid static rendering/caching. Place Arc explorer transaction links prominently for live fund/reserve/claim steps.
