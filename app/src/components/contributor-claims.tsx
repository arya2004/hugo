'use client';
import { useState } from 'react';
import { createThirdwebClient, defineChain } from 'thirdweb';
import { inAppWallet } from 'thirdweb/wallets/in-app';
import { api, money } from './client';

type Claim = {
  id: string;
  amountMicro: string;
  status: string;
};

export function ContributorClaims() {
  const [claims, setClaims] = useState<Claim[]>();
  const [wallet, setWallet] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const result = await api('contributor/allocations');
    setClaims(result.allocations);
    setWallet(result.wallet);
  }

  async function signIn() {
    setBusy(true);
    try {
      {
        const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
        if (!clientId) {
          throw Error('Configure the thirdweb client ID to enable GitHub login');
        }
        const embedded = inAppWallet();
        const account = await embedded.connect({
          client: createThirdwebClient({ clientId }),
          chain: defineChain(5042002),
          strategy: 'github',
        });
        const challenge = await api('contributor/challenge', {
          address: account.address,
        });
        const signature = await account.signMessage({ message: challenge.message });
        await api('contributor/verify', {
          challengeId: challenge.challengeId,
          address: account.address,
          signature,
        });
      }
      await refresh();
      setStatus(
        'Wallet linked. Future eligible contributions can be paid automatically.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card form">
      <h2>Claim reserved rewards</h2>
      <p>
        Sign in with the GitHub account that authored the contribution. An embedded wallet
        is created automatically. Your wallet signs an authorization message; the service
        pays Arc transaction gas.
      </p>
      <button className="primary" disabled={busy} onClick={signIn}>
        {busy ? 'Working…' : 'Continue with GitHub'}
      </button>
      {wallet && <p className="funding-address">Receiving wallet: {wallet}</p>}
      {claims?.map((claim) => (
        <article className="card" key={claim.id}>
          <strong>{money(claim.amountMicro)} USDC</strong>
          <p>
            {claim.status === 'PAYING'
              ? 'Transfer pending; retry checks the same transaction.'
              : 'Reserved on Arc'}
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const payment = await api(
                  `contributor/allocations/${claim.id}/claim`,
                  {},
                );
                setStatus(
                  payment.status === 'PAID'
                    ? 'Payment confirmed on Arc.'
                    : 'Payment pending. You can safely retry.',
                );
                await refresh();
              } catch (error) {
                setStatus(error instanceof Error ? error.message : 'Payment pending');
              } finally {
                setBusy(false);
              }
            }}
          >
            {claim.status === 'PAYING' ? 'Check payment' : 'Claim to my embedded wallet'}
          </button>
        </article>
      ))}
      {claims?.length === 0 && (
        <p>No unclaimed, confirmed rewards for this GitHub account.</p>
      )}
      <p role="status">{status}</p>
    </section>
  );
}
