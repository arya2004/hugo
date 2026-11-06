import 'server-only';
import { encodeFunctionData, type Address, type Hex } from 'viem';
import { hash } from '../lib/core';
import { mergeBudget, type ContributorScore } from '../lib/reward-policy';
import { projectAbi, projectClaimTypes } from '../lib/project-contract';
import { db, one, query, rpc } from './db';
import { arc } from './arc';
import { projectState, projectReceipt, syncProjectHistory } from './project-chain';
import { AppError } from './env';
import { rewardSigner, sendDurableTransaction, withArcLease } from './arc-transactions';
import { thirdwebIdentity } from './contributor-auth';

export async function processReward(mergeId: string) {
  return withArcLease(async (token) => {
    const merge = await one('merge_events', mergeId);
    const repo = await one('repositories', merge.repository_id);
    const project = await one('programs', repo.program_id);
    if (project.contract_version !== 2) {
      throw new AppError(
        409,
        'TREASURY_MIGRATION_REQUIRED',
        'Existing v1 treasury requires an explicit v2 migration',
      );
    }
    const address = project.treasury_address as Address;
    let reservation = await query<any>(
      db()
        .from('merge_reservations_safe')
        .select('*')
        .eq('merge_event_id', merge.id)
        .maybeSingle(),
    );
    if (!reservation) {
      const mergedAt = BigInt(Math.floor(Date.parse(merge.merged_at) / 1000));
      const block = await syncProjectHistory(project, mergedAt);
      const state = await projectState(address, block);
      if (state.signer !== rewardSigner().address.toLowerCase()) {
        throw new AppError(503, 'SIGNER_MISMATCH', 'Treasury signer mismatch');
      }
      const eligible = await arc().readContract({
        address,
        abi: projectAbi,
        functionName: 'fundingAt',
        args: [mergedAt],
        blockNumber: block,
      });
      const donations = await query<any[]>(
        db()
          .from('donations_safe')
          .select('amount_micro')
          .eq('program_id', project.id)
          .gte(
            'block_timestamp',
            new Date(Number(mergedAt - 604800n) * 1000).toISOString(),
          )
          .lt('block_timestamp', merge.merged_at),
      );
      const inflow = donations.reduce((sum, d) => sum + BigInt(d.amount_micro), 0n);
      const scores = await query<ContributorScore[]>(
        db().from('contribution_scores').select('*').eq('merge_event_id', merge.id),
      );
      const { shares, budget } = mergeBudget(
        state.maximum,
        eligible ? state.available : 0n,
        inflow,
        scores,
      );
      const chainMergeId = hash({
        provider: merge.provider,
        repositoryId: merge.external_repo_id,
        prNumber: merge.pr_number,
        mergeSha: merge.merge_sha,
      });
      const rows = shares.map((s) => {
        const [provider, providerUserId] = s.identity.split(':');
        return {
          provider,
          providerUserId,
          amountMicro: s.amount.toString(),
          claimId: hash({ chainMergeId, identity: s.identity }),
        };
      });
      const evaluation = await query<any>(
        db()
          .from('evaluations')
          .select('evidence_hash')
          .eq('merge_event_id', merge.id)
          .single(),
      );
      const report = {
        version: 'immediate-v2',
        repositoryKey: state.repositoryKey,
        mergeId: chainMergeId,
        mergedAt: mergedAt.toString(),
        mergeSha: merge.merge_sha,
        eligible,
        evidenceHash: evaluation.evidence_hash,
        snapshotBlock: block.toString(),
        maxRewardMicro: state.maximum.toString(),
        availableMicro: state.available.toString(),
        inflowMicro: inflow.toString(),
        amountMicro: budget.toString(),
        allocations: rows,
      };
      const id = await rpc<string>('freeze_merge_reservation', {
        p_merge: merge.id,
        p_key: chainMergeId,
        p_report_hash: hash(report),
        p_report: report,
        p_rows: rows,
      });
      reservation = await one('merge_reservations', id);
    }
    if (['INELIGIBLE', 'NO_FUNDS', 'SETTLED'].includes(reservation.status)) {
      return { rewardId: reservation.id, status: reservation.status };
    }
    if (reservation.status === 'RESERVING') {
      const allocations = await allocationRows(reservation.id);
      const tx = await sendDurableTransaction(
        token,
        `reserve:${reservation.id}`,
        address,
        encodeFunctionData({
          abi: projectAbi,
          functionName: 'reserveReward',
          args: [
            reservation.chain_merge_id,
            BigInt(reservation.report_json.mergedAt),
            reservation.report_hash,
            allocations.map((a) => a.claim_id),
            allocations.map((a) => BigInt(a.amount_micro)),
          ],
        }),
      );
      if (!tx.confirmed) {
        return { rewardId: reservation.id, status: 'RESERVING' };
      }
      const { events } = await projectReceipt(tx.txHash, address);
      if (
        !events.some(
          (e) =>
            e.eventName === 'RewardReserved' &&
            e.args.mergeId === reservation.chain_merge_id &&
            e.args.amount === BigInt(reservation.amount_micro) &&
            e.args.reportHash === reservation.report_hash,
        )
      ) {
        throw new AppError(
          409,
          'RESERVATION_MISMATCH',
          'Confirmed reservation differs from stored allocation',
        );
      }
      await query(
        db()
          .from('merge_reservations')
          .update({ status: 'RESERVED', reserve_tx_hash: tx.txHash })
          .eq('id', reservation.id),
      );
      reservation.status = 'RESERVED';
    }
    // Each recipient is independent: a missing link or failed transfer never blocks peers.
    let pending = false;
    for (const allocation of await allocationRows(reservation.id)) {
      if (
        allocation.status === 'PAID' ||
        (!allocation.auto_pay && allocation.status !== 'PAYING')
      ) {
        continue;
      }
      const link = await query<any>(
        db()
          .from('contributor_wallets')
          .select('*')
          .eq('provider', allocation.provider)
          .eq('provider_user_id', allocation.provider_user_id)
          .maybeSingle(),
      );
      if (!link) {
        continue; // Fully funded reservation remains available for later authenticated claim.
      }
      try {
        const payment = await payAllocation(
          token,
          allocation,
          reservation,
          project,
          allocation.recipient ?? link.wallet_address,
        );
        pending ||= payment.status !== 'PAID';
      } catch {
        pending = true;
      }
    }
    const remaining = (await allocationRows(reservation.id)).some(
      (a) => a.status !== 'PAID',
    );
    if (!remaining) {
      await query(
        db()
          .from('merge_reservations')
          .update({ status: 'SETTLED' })
          .eq('id', reservation.id),
      );
    }
    return {
      rewardId: reservation.id,
      status: pending ? 'PAYING' : remaining ? 'RESERVED' : 'SETTLED',
    };
  });
}

async function allocationRows(id: string) {
  return query<any[]>(
    db()
      .from('merge_allocations_safe')
      .select('*')
      .eq('reservation_id', id)
      .order('claim_id'),
  );
}

async function payAllocation(
  token: string,
  allocation: any,
  reservation: any,
  project: any,
  wallet: Address,
) {
  if (!['RESERVED', 'SETTLED'].includes(reservation.status)) {
    throw new AppError(409, 'RESERVATION_PENDING', 'Wait for onchain reservation');
  }
  if (allocation.status === 'PAID') {
    return { status: 'PAID', txHash: allocation.payment_tx_hash };
  }
  const identity = await thirdwebIdentity(wallet);
  if (
    identity.provider !== allocation.provider ||
    identity.providerUserId !== allocation.provider_user_id
  ) {
    throw new AppError(
      403,
      'IDENTITY_MISMATCH',
      'Wallet does not belong to this forge contributor',
    );
  }
  if (!allocation.recipient) {
    const locked = await rpc('lock_allocation_recipient', {
      p_allocation: allocation.id,
      p_provider: identity.provider,
      p_identity: identity.providerUserId,
      p_wallet: wallet,
    });
    if (!locked) {
      throw new AppError(
        409,
        'RECIPIENT_LOCKED',
        'Allocation belongs to another verified recipient',
      );
    }
  } else if (allocation.recipient !== wallet) {
    throw new AppError(
      403,
      'RECIPIENT_LOCKED',
      'Recipient cannot change after settlement starts',
    );
  }
  const claim = {
    mergeId: reservation.chain_merge_id as Hex,
    claimId: allocation.claim_id as Hex,
    reportHash: reservation.report_hash as Hex,
    recipient: wallet,
    amount: BigInt(allocation.amount_micro),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
  };
  const signature = await rewardSigner().signTypedData({
    domain: {
      name: 'ProofOfContribution',
      version: '2',
      chainId: 5042002,
      verifyingContract: project.treasury_address,
    },
    types: projectClaimTypes,
    primaryType: 'Claim',
    message: claim,
  });
  await query(
    db().from('merge_allocations').update({ status: 'PAYING' }).eq('id', allocation.id),
  );
  const tx = await sendDurableTransaction(
    token,
    `claim:${allocation.id}`,
    project.treasury_address,
    encodeFunctionData({
      abi: projectAbi,
      functionName: 'claim',
      args: [claim, signature],
    }),
  );
  if (!tx.confirmed) {
    return { status: 'PAYING', txHash: tx.txHash };
  }
  const { events } = await projectReceipt(tx.txHash, project.treasury_address);
  if (
    !events.some(
      (e) =>
        e.eventName === 'RewardClaimed' &&
        e.args.claimId === allocation.claim_id &&
        e.args.mergeId === reservation.chain_merge_id &&
        e.args.amount === claim.amount &&
        e.args.recipient.toLowerCase() === wallet,
    )
  ) {
    throw new AppError(
      409,
      'PAYMENT_MISMATCH',
      'Payment receipt differs from the recipient-bound allocation',
    );
  }
  await query(
    db()
      .from('merge_allocations')
      .update({ status: 'PAID', payment_tx_hash: tx.txHash })
      .eq('id', allocation.id),
  );
  return { status: 'PAID', txHash: tx.txHash };
}

export async function claimAllocation(id: string, session: any) {
  return withArcLease(async (token) => {
    const allocation = await one('merge_allocations', id);
    if (
      allocation.provider !== session.provider ||
      allocation.provider_user_id !== session.provider_user_id
    ) {
      throw new AppError(
        403,
        'IDENTITY_MISMATCH',
        'Allocation belongs to another contributor',
      );
    }
    const reservation = await one('merge_reservations', allocation.reservation_id);
    const project = await one('programs', reservation.program_id);
    return payAllocation(token, allocation, reservation, project, session.wallet_address);
  });
}

export async function rewardDto(reservation: any) {
  const merge = await one('merge_events', reservation.merge_event_id);
  const recipients = await allocationRows(reservation.id);
  return {
    id: reservation.id,
    prNumber: merge.pr_number,
    amount_micro: reservation.amount_micro,
    claim_status: reservation.status,
    recipientCount: recipients.length,
    paidCount: recipients.filter((a) => a.status === 'PAID').length,
    reportHash: reservation.report_hash,
    reserveTxHash: reservation.reserve_tx_hash,
    paymentTxHashes: [...new Set(recipients.map((a) => a.payment_tx_hash).filter(Boolean))],
  };
}
