import 'server-only';
import { createWalletClient, http, keccak256, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';
import { arc } from './arc';
import { db, query, rpc } from './db';
import { AppError, required } from './env';

export function rewardSigner() {
  return privateKeyToAccount(required('PAYOUT_VOUCHER_SIGNER_KEY') as Hex);
}

export async function withArcLease<T>(run: (token: string) => Promise<T>) {
  const token = await rpc<string | null>('lease_arc_processor', {});
  if (!token) {
    throw new AppError(409, 'PROCESSOR_BUSY', 'Settlement is running; retry shortly');
  }
  try {
    return await run(token);
  } finally {
    await rpc('release_arc_processor', { p_token: token });
  }
}

// Persist the exact signed transaction BEFORE any broadcast. An interrupted request
// rebroadcasts the same bytes/nonce. A reverted transaction alone permits a new attempt.
export async function sendDurableTransaction(
  token: string,
  operation: string,
  to: Address,
  data: Hex,
) {
  const client = arc();
  const account = rewardSigner();
  const writer = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.io'),
  });
  let transaction = await query<any>(
    db()
      .from('arc_transactions')
      .select('*')
      .eq('operation', operation)
      .order('attempt', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (!transaction || transaction.status === 'REVERTED') {
    const highest = await query<any>(
      db()
        .from('arc_transactions')
        .select('nonce')
        .eq('sender', account.address.toLowerCase())
        .order('nonce', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    const pendingNonce = await client.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });
    const nonce = Math.max(pendingNonce, highest ? Number(highest.nonce) + 1 : 0);
    const request = await writer.prepareTransactionRequest({ to, data, nonce });
    const raw = await writer.signTransaction(request);
    const txHash = keccak256(raw);
    await rpc('persist_arc_transaction', {
      p_token: token,
      p_operation: operation,
      p_attempt: (transaction?.attempt ?? 0) + 1,
      p_sender: account.address.toLowerCase(),
      p_nonce: nonce,
      p_raw: raw,
      p_hash: txHash,
    });
    transaction = { raw_transaction: raw, tx_hash: txHash };
  }
  const txHash = transaction.tx_hash as Hex;
  let receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) {
    // "Already known" / network timeout is recoverable: only the persisted hash matters.
    await writer
      .sendRawTransaction({ serializedTransaction: transaction.raw_transaction })
      .catch(() => undefined);
    receipt = await client
      .waitForTransactionReceipt({ hash: txHash, confirmations: 3, timeout: 120000 })
      .catch(() => null);
  }
  if (!receipt || (await client.getBlockNumber()) < receipt.blockNumber + 2n) {
    return { confirmed: false, txHash };
  }
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (block.hash !== receipt.blockHash) {
    return { confirmed: false, txHash };
  }
  await query(
    db()
      .from('arc_transactions')
      .update({ status: receipt.status === 'success' ? 'CONFIRMED' : 'REVERTED' })
      .eq('tx_hash', txHash),
  );
  if (receipt.status !== 'success') {
    throw new AppError(
      409,
      'TRANSACTION_REVERTED',
      'Transaction reverted; funds remain reserved and a retry is safe',
    );
  }
  return { confirmed: true, txHash };
}
