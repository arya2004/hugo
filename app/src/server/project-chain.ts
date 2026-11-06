import 'server-only';
import { setTimeout as delay } from 'node:timers/promises';
import { parseEventLogs, type Hex } from 'viem';
import { arc, treasury } from './arc';
import { projectAbi } from '../lib/project-contract';
import { USDC } from '../lib/contracts';
import { AppError } from './env';

export async function projectState(contract: string, blockNumber?: bigint) {
  const client = arc();
  const address = treasury(contract);
  if ((await client.getChainId()) !== 5042002) {
    throw new AppError(503, 'WRONG_CHAIN', 'Arc Testnet required');
  }
  const [token, admin, repo, signer, maximum, available, reserved, active] =
    await Promise.all([
      client.readContract({
        address,
        abi: projectAbi,
        blockNumber,
        functionName: 'usdc',
      }),
      client.readContract({
        address,
        abi: projectAbi,
        blockNumber,
        functionName: 'administrator',
      }),
      client.readContract({
        address,
        abi: projectAbi,
        blockNumber,
        functionName: 'repositoryKey',
      }),
      client.readContract({
        address,
        abi: projectAbi,
        blockNumber,
        functionName: 'rewardSigner',
      }),
      client.readContract({
        address,
        abi: projectAbi,
        blockNumber,
        functionName: 'maxRewardMicro',
      }),
      client.readContract({
        address,
        abi: projectAbi,
        blockNumber,
        functionName: 'available',
      }),
      client.readContract({
        address,
        abi: projectAbi,
        blockNumber,
        functionName: 'reserved',
      }),
      client.readContract({
        address,
        abi: projectAbi,
        blockNumber,
        functionName: 'fundingActive',
      }),
    ]);
  if (token.toLowerCase() !== USDC.toLowerCase()) {
    throw new AppError(422, 'WRONG_TOKEN', 'Project must use Arc testnet USDC');
  }
  return {
    admin: admin.toLowerCase(),
    repositoryKey: repo,
    signer: signer.toLowerCase(),
    maximum,
    available,
    reserved,
    active,
  };
}

export async function projectReceipt(tx: Hex, contract: string) {
  const client = arc();
  const r = await client.getTransactionReceipt({ hash: tx });
  const head = await client.getBlockNumber();
  if (r.status !== 'success' || head < r.blockNumber + 2n) {
    throw new AppError(409, 'TX_PENDING', 'Waiting for transaction confirmation');
  }
  const block = await client.getBlock({ blockNumber: r.blockNumber });
  if (block.hash !== r.blockHash || r.to?.toLowerCase() !== contract.toLowerCase()) {
    throw new AppError(422, 'TX_MISMATCH', 'Transaction does not match this project');
  }
  return {
    receipt: r,
    events: parseEventLogs({
      abi: projectAbi,
      logs: r.logs.filter((l) => l.address.toLowerCase() === contract.toLowerCase()),
      strict: true,
    }),
  };
}

// Only confirmed logs enter eligibility/rate history. Replayed indexing is idempotent.
export async function syncProjectHistory(project: any, mergedAt?: bigint) {
  const client = arc();
  const address = treasury(project.treasury_address);
  const deployment = await client.getTransactionReceipt({
    hash: project.deployment_tx_hash,
  });
  const head = (await client.getBlockNumber()) - 2n;
  const finalized = await client.getBlock({ blockNumber: head });
  if (mergedAt !== undefined && finalized.timestamp < mergedAt) {
    throw new AppError(
      409,
      'MERGE_NOT_FINAL',
      'Waiting for a confirmed block after merge',
    );
  }
  const { db, query } = await import('./db');
  for (let from = deployment.blockNumber; from <= head; from += 2000n) {
    // The public RPC rate-limits bursts of history queries. Pace each batch,
    // including the first one after the receipt and block reads above.
    await delay(1000);
    const to = from + 1999n < head ? from + 1999n : head;
    const logs = await client.getContractEvents({
      address,
      abi: projectAbi,
      fromBlock: from,
      toBlock: to,
      strict: true,
    }).catch(() => {
      throw new AppError(
        503,
        'ARC_HISTORY_UNAVAILABLE',
        'Arc history RPC is temporarily unavailable. Retry this workflow shortly.',
      );
    });
    for (const log of logs) {
      if (log.eventName === 'FundingStateChanged') {
        await query(
          db()
            .from('funding_transitions')
            .upsert(
              {
                program_id: project.id,
                active: log.args.active,
                effective_at: new Date(Number(log.args.effectiveAt) * 1000).toISOString(),
                block_number: log.blockNumber.toString(),
                log_index: log.logIndex,
                tx_hash: log.transactionHash,
              },
              { onConflict: 'program_id,tx_hash,log_index' },
            ),
        );
      }
      if (log.eventName === 'ProjectFunded') {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        await query(
          db()
            .from('donations')
            .upsert(
              {
                program_id: project.id,
                tx_hash: log.transactionHash,
                log_index: log.logIndex,
                block_number: log.blockNumber.toString(),
                block_timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                donor_wallet: log.args.donor.toLowerCase(),
                amount_micro: log.args.amount.toString(),
              },
              { onConflict: 'tx_hash,log_index' },
            ),
        );
      }
    }
  }
  return head;
}
