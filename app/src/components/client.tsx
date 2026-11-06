'use client';
import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  erc20Abi,
  parseUnits,
  type Address,
  type Hex,
  type EIP1193Provider,
} from 'viem';
import { arcTestnet } from 'viem/chains';
import { browserClient } from '../lib/supabase/client';
import { USDC } from '../lib/contracts';
import { projectAbi } from '../lib/project-contract';

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export async function api(path: string, data?: unknown) {
  const r = await fetch(`/api/${path}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok) {
    throw Error(j.error?.message ?? 'Request failed');
  }
  return j.data;
}

function refreshData() {
  window.dispatchEvent(new Event('poc:refresh'));
}

function message(e: unknown) {
  return e instanceof Error ? e.message : 'Request failed';
}

export function money(s: string) {
  const n = BigInt(s);
  return `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, '0')}`;
}

export async function wallet() {
  if (!window.ethereum) {
    throw Error('Install an EVM wallet to continue');
  }
  const client = createWalletClient({
    chain: arcTestnet,
    transport: custom(window.ethereum),
  });
  const [account] = await client.requestAddresses();
  try {
    await client.switchChain({ id: 5042002 });
  } catch {
    await client.addChain({ chain: arcTestnet });
    await client.switchChain({ id: 5042002 });
  }
  return { client, account };
}
const chainReader = () =>
  createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.io'),
  });

function vault() {
  const s = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
  if (!s || !/^0x[\da-fA-F]{40}$/.test(s)) {
    throw Error('Configure a deployed Arc Testnet treasury first');
  }
  return s as Address;
}

export async function wait(tx: Hex) {
  const r = await chainReader().waitForTransactionReceipt({
    hash: tx,
    confirmations: 3,
    timeout: 120000,
  });
  if (r.status !== 'success') {
    throw Error('Arc transaction reverted');
  }
  return r;
}

function Tx({ tx }: { tx: string }) {
  return (
    <a href={`https://explorer.testnet.arc.io/tx/${tx}`} target="_blank" rel="noreferrer">
      View Arc transaction ↗
    </a>
  );
}

export function Login({ next = '/contributor' }: { next?: string }) {
  const [error, setError] = useState('');
  return (
    <div>
      <button
        className="primary"
        onClick={async () => {
          try {
            const { error } = await browserClient().auth.signInWithOAuth({
              provider: 'github',
              options: {
                redirectTo:
                  location.origin + '/auth/callback?next=' + encodeURIComponent(next),
              },
            });
            if (error) {
              throw error;
            }
          } catch (e) {
            setError(message(e));
          }
        }}
      >
        Continue with GitHub ↗
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="quiet"
      onClick={async () => {
        await browserClient().auth.signOut();
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function WalletBind() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { client, account } = await wallet();
            const c = await api('wallet/challenge', { address: account });
            const signature = await client.signMessage({ account, message: c.message });
            await api('wallet/verify', {
              challengeId: c.challengeId,
              address: account,
              signature,
            });
            setStatus(`Verified ${account}`);
            refreshData();
          } catch (e) {
            setStatus(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Waiting for signature…' : 'Connect & verify wallet'}
      </button>
      <p role="status" className="muted">
        {status}
      </p>
    </div>
  );
}

export function LiveData({
  path,
  children,
}: {
  path: string;
  children: (data: any) => ReactNode;
}) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    api(path)
      .then((d) => {
        if (alive) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) {
          setError(message(e));
        }
      });
    return () => {
      alive = false;
    };
  }, [path, version]);
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener('poc:refresh', refresh);
    return () => window.removeEventListener('poc:refresh', refresh);
  }, []);
  return (
    <div>
      {error ? (
        <div className="notice" role="alert">
          {error}{' '}
          <button className="quiet" onClick={() => setVersion((v) => v + 1)}>
            Retry
          </button>
        </div>
      ) : data === undefined ? (
        <p className="muted">Loading records…</p>
      ) : (
        children(data)
      )}
    </div>
  );
}

export function Donation({
  projectId,
  treasuryAddress,
}: {
  projectId?: string;
  treasuryAddress?: Address;
}) {
  const [status, setStatus] = useState('');
  const [tx, setTx] = useState('');
  const [busy, setBusy] = useState(false);

  async function fund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawAmount = String(new FormData(event.currentTarget).get('amount'));
    setBusy(true);
    try {
      const amount = parseUnits(rawAmount, 6);
      if (amount <= 0n) {
        throw Error('Enter a positive USDC amount');
      }
      const { client, account } = await wallet();
      const fundingAddress = treasuryAddress ?? vault();
      const balance = await chainReader().readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
      });
      if (balance < amount) {
        throw Error(`Wallet has ${money(balance.toString())} ERC-20 USDC`);
      }
      setStatus('Approve the exact testnet USDC amount in your wallet');
      const approve = await client.writeContract({
        account,
        address: USDC,
        abi: erc20Abi,
        functionName: 'approve',
        args: [fundingAddress, amount],
      });
      setTx(approve);
      await wait(approve);
      setStatus('Confirm project funding in your wallet');
      const hash = await client.writeContract({
        account,
        address: fundingAddress,
        abi: projectAbi,
        functionName: 'fund',
        args: [amount],
      });
      setTx(hash);
      await wait(hash);
      if (projectId) {
        await api(`projects/${projectId}/funding-confirm`, { txHash: hash });
      }
      setStatus('Project funding confirmed on Arc. Your balance is up to date.');
      refreshData();
    } catch (e) {
      setStatus(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={fund}>
      <h2>Add project funds</h2>
      <p className="muted">
        Owners and public donors can add Arc Testnet USDC. Donating does not start
        funding.
      </p>
      <label>
        USDC amount
        <input
          name="amount"
          type="number"
          min="0.000001"
          step="0.000001"
          required
          placeholder="25.000000"
        />
      </label>
      <button className="primary" disabled={busy}>
        {busy ? 'Transaction in progress…' : 'Add funds ↗'}
      </button>
      <p role="status">{status}</p>
      {tx && <Tx tx={tx} />}
    </form>
  );
}
