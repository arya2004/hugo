'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  defineChain,
  prepareTransaction,
  sendTransaction,
  waitForReceipt,
  type ThirdwebClient,
} from 'thirdweb';
import type { Account } from 'thirdweb/wallets';
import { createPublicClient, formatUnits, http, type Address } from 'viem';
import { arcTestnet } from 'viem/chains';
import { ARC_CHAIN_ID } from '../lib/contracts';
import { withdrawAll } from '../lib/wallet-transfer';

const rpc = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.io';
const chain = defineChain({ id: ARC_CHAIN_ID, rpc });
const reader = createPublicClient({ chain: arcTestnet, transport: http(rpc) });
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Transfer failed';

// Arc native USDC and ERC-20 USDC expose the same underlying balance.
// Native sends let us withdraw at full precision, reserving only the gas budget.
function readBalance(address: string) {
  return reader.getBalance({ address: address as Address });
}

type Withdrawal = {
  to: Address;
  value: bigint;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  fee: bigint;
};

export function WalletTransfer({
  account,
  client,
  refreshVersion,
}: {
  account: Account;
  client: ThirdwebClient;
  refreshVersion: number;
}) {
  const [balance, setBalance] = useState<bigint>();
  const [to, setTo] = useState('');
  const [review, setReview] = useState<Withdrawal>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  async function loadBalance() {
    const value = await readBalance(account.address);
    setBalance(value);
  }

  useEffect(() => {
    let active = true;
    readBalance(account.address)
      .then((value) => {
        if (active) {
          setBalance(value);
        }
      })
      .catch((error) => {
        if (active) {
          setStatus(errorText(error));
        }
      });
    return () => {
      active = false;
    };
  }, [account.address, refreshVersion]);

  async function reviewTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    setReview(undefined);
    try {
      const current = await readBalance(account.address);
      setBalance(current);
      const destination = withdrawAll(to.trim(), current, 0n).to;
      const [estimatedGas, fees] = await Promise.all([
        reader.estimateGas({
          account: account.address as Address,
          to: destination,
          value: 1n,
        }),
        reader.estimateFeesPerGas(),
      ]);
      const gas = estimatedGas + estimatedGas / 5n;
      const fee = gas * fees.maxFeePerGas;
      const plan = withdrawAll(destination, current, fee);
      setReview({ ...plan, gas, fee, ...fees });
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmTransfer() {
    if (!review || busy) {
      return;
    }
    setBusy(true);
    setStatus('Confirming your transfer…');
    try {
      const sent = await sendTransaction({
        account,
        transaction: prepareTransaction({
          client,
          chain,
          to: review.to,
          value: review.value,
          gas: review.gas,
          maxFeePerGas: review.maxFeePerGas,
          maxPriorityFeePerGas: review.maxPriorityFeePerGas,
        }),
      });
      setTxHash(sent.transactionHash);
      setReview(undefined);
      setStatus('Transfer sent. Waiting for Arc confirmation…');
      const receipt = await waitForReceipt({
        client,
        chain,
        transactionHash: sent.transactionHash,
      });
      if (receipt.status !== 'success') {
        throw Error('The transfer reverted. Check the transaction below.');
      }
      setStatus('Transfer confirmed. The USDC is now at your destination address on Arc Testnet.');
      await loadBalance();
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card form">
      <span className="eyebrow">ARC TESTNET · YOUR WALLET</span>
      <h2>Withdraw all</h2>
      <p>
        Send your available USDC to your MetaMask or another Arc address.
        The network fee is deducted automatically.
      </p>
      <p>
        <strong>
          {balance === undefined ? 'Loading balance…' : `${formatUnits(balance, 18)} USDC`}
        </strong>
      </p>
      <button
        className="quiet"
        type="button"
        disabled={busy}
        onClick={() => loadBalance().catch((error) => setStatus(errorText(error)))}
      >
        Refresh balance
      </button>
      <form onSubmit={reviewTransfer} className="form">
        <label>
          Destination Arc address
          <input
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setReview(undefined);
            }}
            placeholder="0x…"
            required
            disabled={busy}
          />
        </label>
        <p className="muted">
          Arc Testnet only. We reserve the network fee automatically. A small balance
          may remain if the actual fee is lower.
        </p>
        <button
          className="primary"
          type="submit"
          disabled={busy || balance === undefined || balance === 0n}
        >
          {busy ? 'Working…' : 'Review withdrawal'}
        </button>
      </form>
      {review && (
        <div className="notice">
          <p>
            Send <strong>{formatUnits(review.value, 18)} USDC</strong> on Arc
            Testnet to:
          </p>
          <p className="funding-address">{review.to}</p>
          <p>Reserved network fee: {formatUnits(review.fee, 18)} USDC</p>
          <button
            className="primary"
            type="button"
            disabled={busy}
            onClick={confirmTransfer}
          >
            Withdraw all
          </button>
          <button type="button" disabled={busy} onClick={() => setReview(undefined)}>
            Cancel
          </button>
        </div>
      )}
      <p role="status">{status}</p>
      {txHash && (
        <a
          href={`https://explorer.testnet.arc.io/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          View transfer on Arc ↗
        </a>
      )}
    </section>
  );
}
