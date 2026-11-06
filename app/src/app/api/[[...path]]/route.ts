import { mergePayload } from '../../../lib/merge-payload';
import { evaluateMerge } from '../../../server/evaluation';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { verifyMessage } from 'viem';
import { address, bytes32, fullName } from '../../../lib/core';
import { db, one, query, rpc } from '../../../server/db';
import { principal, owner, throttle } from '../../../server/auth';
import { AppError, appOrigin } from '../../../server/env';
import { body, envelope, bearer, sameOrigin } from '../../../server/http';
import { arc } from '../../../server/arc';
import { projectReceipt, projectState } from '../../../server/project-chain';
import { prepareProject, registerProject, projectDetail } from '../../../server/projects';
import { syncPublication } from '../../../server/publications';
import { arkivPrograms, arkivContributions } from '../../../server/arkiv';
import {
  contributorChallenge,
  verifyContributor,
  contributorSession,
} from '../../../server/contributor-auth';
import { claimAllocation } from '../../../server/rewards';
import { processReward, rewardDto } from '../../../server/rewards';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export const maxDuration = 300;
const uuid = z.uuid();
const txSchema = z.object({ txHash: bytes32 }).strict();
const empty = z.object({}).strict();

async function route(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.slice(5).split('/').filter(Boolean);
  if (path[0] === 'programs') {
    path[0] = 'projects';
  }
  const key = path.join('/');
  const get = req.method === 'GET';
  if (get && key === 'health') {
    const results = await Promise.allSettled([
      Promise.resolve().then(() => query(db().from('programs').select('id').limit(1))),
      arc().getChainId(),
    ]);
    return {
      db: results[0].status === 'fulfilled' ? 'ok' : 'down',
      arc: results[1].status === 'fulfilled' ? 'ok' : 'down',
      version: '0.2.0',
    };
  }
  if (get && key === 'arkiv/programs') {
    return arkivPrograms();
  }
  if (get && key === 'arkiv/contributions') {
    return arkivContributions();
  }
  if (path[0] === 'contributor') {
    if (!get) {
      sameOrigin(req);
    }
    if (!get && key === 'contributor/challenge') {
      const input = await body(req, z.object({ address }).strict());
      await throttle(input.address, 'contributor-challenge', 5);
      return contributorChallenge(input.address);
    }
    if (!get && key === 'contributor/verify') {
      const input = await body(
        req,
        z
          .object({
            challengeId: uuid,
            address,
            signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
          })
          .strict(),
      );
      await throttle(input.address, 'contributor-verify', 10);
      return verifyContributor(
        input.challengeId,
        input.address,
        input.signature as `0x${string}`,
      );
    }
    const session = await contributorSession();
    if (get && key === 'contributor/allocations') {
      const rows = await query<any[]>(
        db()
          .from('merge_allocations_safe')
          .select('*')
          .eq('provider', session.provider)
          .eq('provider_user_id', session.provider_user_id)
          .neq('status', 'PAID')
          .limit(100),
      );
      const confirmed = [];
      for (const row of rows) {
        const reservation = await one('merge_reservations', row.reservation_id);
        if (reservation.status === 'RESERVED') {
          confirmed.push({
            id: row.id,
            amountMicro: row.amount_micro,
            status: row.status,
          });
        }
      }
      return { wallet: session.wallet_address, allocations: confirmed };
    }
    if (!get && path[1] === 'allocations' && path[3] === 'claim' && path.length === 4) {
      await body(req, empty);
      await throttle(session.wallet_address, 'claims', 20);
      return claimAllocation(uuid.parse(path[2]), session);
    }
    throw new AppError(404, 'NOT_FOUND', 'Endpoint not found');
  }
  if (!get && key === 'merge/github') {
    bearer(req, 'MERGE_TRIGGER_SECRET');
    const input = await body(req, mergePayload, 1048576);
    const r = await query(
      db()
        .from('repositories')
        .select('*')
        .eq('provider', 'github')
        .eq('external_repo_id', input.repositoryId)
        .eq('is_active', true)
        .maybeSingle(),
    );
    if (!r || r.full_name.toLowerCase() !== input.repository.toLowerCase()) {
      throw new AppError(403, 'REPOSITORY_UNREGISTERED', 'Repository not registered');
    }
    await query(
      db().from('merge_events').upsert(
        {
          repository_id: r.id,
          provider: 'github',
          external_repo_id: input.repositoryId,
          pr_number: input.prNumber,
          merge_sha: input.mergeSha,
          merged_at: input.mergedAt,
        },
        { onConflict: 'provider,external_repo_id,pr_number', ignoreDuplicates: true },
      ),
    );
    const saved = await query<any>(
      db()
        .from('merge_events')
        .select('*')
        .eq('provider', 'github')
        .eq('external_repo_id', input.repositoryId)
        .eq('pr_number', input.prNumber)
        .single(),
    );
    if (saved.merge_sha !== input.mergeSha) {
      throw new AppError(
        409,
        'MERGE_MISMATCH',
        'Merge already recorded with another SHA',
      );
    }
    await evaluateMerge(saved, input);
    return processReward(saved.id);
  }
  if (!get && key === 'internal/arkiv/sync') {
    bearer(req, 'WORKER_API_SECRET');
    await body(req, empty);
    return syncPublication();
  }
  if (get && path[0] === 'cre' && path[1] === 'report' && path.length === 3) {
    bearer(req, 'CRE_EXTERNAL_REPORT_TOKEN');
    const reservation = await one('merge_reservations', uuid.parse(path[2]));
    if (!['RESERVED', 'SETTLED'].includes(reservation.status)) {
      throw new AppError(409, 'REWARD_PENDING', 'Reservation not confirmed');
    }
    const project = await one('programs', reservation.program_id);
    const report = reservation.report_json;
    return {
      chainId: 5042002,
      treasuryAddress: project.treasury_address,
      repositoryKey: report.repositoryKey,
      mergeId: reservation.chain_merge_id,
      reportHash: reservation.report_hash,
      amountMicro: reservation.amount_micro,
      maxRewardMicro: report.maxRewardMicro,
      mergedAt: report.mergedAt,
      eligible: report.eligible,
    };
  }

  if (!get) {
    sameOrigin(req);
  }
  const p = await principal();
  if (!get) {
    await throttle(p.authUserId, 'writes', 40);
  }
  if (get && key === 'me') {
    return {
      ...p,
      linkedWallets: await query(
        db()
          .from('wallet_links')
          .select('wallet_address')
          .eq('auth_user_id', p.authUserId),
      ),
    };
  }
  if (get && ['me/profile', 'me/contributions'].includes(key)) {
    throw new AppError(404, 'NOT_FOUND', 'Contributor history is not available');
  }

  if (!get && key === 'wallet/challenge') {
    await throttle(p.authUserId, 'challenge', 5);
    const input = await body(req, z.object({ address }).strict());
    const nonce = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 300000).toISOString();
    const message = `Hugo wallet binding\nDomain: ${appOrigin()}\nUser: ${p.authUserId}\nAddress: ${input.address}\nChain ID: 5042002\nNonce: ${nonce}\nIssued: ${now.toISOString()}\nExpires: ${expiresAt}\nPurpose: Bind wallet to GitHub-authenticated session`;
    const result = await query(
      db()
        .from('wallet_challenges')
        .insert({
          auth_user_id: p.authUserId,
          requested_wallet: input.address,
          nonce_hash: createHash('sha256').update(nonce).digest('hex'),
          message,
          expires_at: expiresAt,
        })
        .select('id')
        .single(),
    );
    return { challengeId: result.id, message, expiresAt };
  }
  if (!get && key === 'wallet/verify') {
    await throttle(p.authUserId, 'wallet-verify', 10);
    const input = await body(
      req,
      z
        .object({
          challengeId: uuid,
          address,
          signature: z.string().regex(/^0x[\da-fA-F]{130}$/),
        })
        .strict(),
    );
    const c = await one('wallet_challenges', input.challengeId);
    if (
      c.auth_user_id !== p.authUserId ||
      c.requested_wallet !== input.address ||
      c.consumed_at ||
      Date.parse(c.expires_at) <= Date.now() ||
      !c.message.includes(`Domain: ${appOrigin()}\n`) ||
      !(await verifyMessage({
        address: input.address,
        message: c.message,
        signature: input.signature as `0x${string}`,
      }))
    ) {
      throw new AppError(403, 'INVALID_CHALLENGE', 'Invalid or expired wallet signature');
    }
    const consumed = await rpc('consume_wallet', {
      p_id: c.id,
      p_user: p.authUserId,
      p_wallet: input.address,
    });
    if (!consumed) {
      throw new AppError(409, 'NONCE_CONSUMED', 'Challenge already consumed');
    }
    return { linked: true, address: input.address };
  }

  if (get && (key === 'projects' || key === 'me/projects' || key === 'me/programs')) {
    const rows = await query<any[]>(
      db()
        .from('programs_safe')
        .select('*')
        .eq('owner_auth_user_id', p.authUserId)
        .eq('owner_github_id', p.githubUserId),
    );
    return Promise.all(rows.map(projectDetail));
  }
  if (!get && key === 'projects/prepare') {
    const input = await body(
      req,
      z
        .object({
          repository: fullName,
          maxRewardMicro: z.string().regex(/^[1-9][0-9]{0,37}$/),
        })
        .strict(),
    );
    return prepareProject(input.repository, input.maxRewardMicro);
  }
  if (!get && key === 'projects') {
    const input = await body(
      req,
      z
        .object({
          id: uuid,
          repository: fullName,
          ownerWallet: address,
          treasuryAddress: address,
          deploymentTxHash: bytes32,
          maxRewardMicro: z.string().regex(/^[1-9][0-9]{0,37}$/),
        })
        .strict(),
    );
    return registerProject(input, p);
  }
  if (path[0] === 'projects' && path.length >= 2) {
    const project = await owner(uuid.parse(path[1]), p);
    if (get && path.length === 2) {
      return projectDetail(project);
    }

    if (get && path[2] === 'rewards') {
      const rows = await query<any[]>(
        db()
          .from('merge_reservations_safe')
          .select('*')
          .eq('program_id', project.id)
          .order('created_at', { ascending: false }),
      );
      return Promise.all(rows.map(rewardDto));
    }
    if (!get && ['funding-confirm', 'funding-state-confirm'].includes(path[2])) {
      const input = await body(req, txSchema);
      const confirmed = await projectReceipt(input.txHash, project.treasury_address);
      if (confirmed.receipt.from.toLowerCase() !== project.owner_wallet) {
        throw new AppError(
          403,
          'ADMIN_REQUIRED',
          'Only the project admin can change funding or settings',
        );
      }
      const name =
        path[2] === 'funding-confirm' ? 'ProjectFunded' : 'FundingStateChanged';
      if (!confirmed.events.some((e) => e.eventName === name)) {
        throw new AppError(422, 'TX_MISMATCH', 'Receipt does not match this action');
      }
      const state = await projectState(project.treasury_address);
      await query(
        db()
          .from('programs')
          .update({ max_reward_micro: state.maximum.toString() })
          .eq('id', project.id),
      );
      return { saved: true };
    }
  }
  throw new AppError(404, 'NOT_FOUND', 'Endpoint not found');
}

export async function GET(req: Request) {
  return envelope(() => route(req));
}

export async function POST(req: Request) {
  return envelope(() => route(req));
}
