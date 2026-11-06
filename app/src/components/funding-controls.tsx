'use client';
import { useState } from 'react';
import { api, LiveData, money, wallet, wait } from './client';
import { projectAbi } from '../lib/project-contract';
import { ExplorerLink } from './explorer-link';

export function FundingControls({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');
  return (
    <LiveData path={`projects/${id}`}>
      {(project) => (
        <section className="card form">
          <span className="eyebrow">OWNER FUNDING CONTROLS</span>
          <h2>Funding is {project.fundingActive ? 'active' : 'stopped'}</h2>
          <p>
            Only merges during an active interval qualify. Stopping never cancels earned
            rewards. Donations do not restart funding.
          </p>
          <p>
            <strong>{money(project.maxRewardMicro)} USDC</strong> maximum across all
            contributors to one PR. This cap is fixed at project creation.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                {
                  const { client, account } = await wallet();
                  if (account.toLowerCase() !== project.ownerWallet) {
                    throw Error('Use the project owner wallet');
                  }
                  const tx = await client.writeContract({
                    account,
                    address: project.fundingAddress,
                    abi: projectAbi,
                    functionName: 'setFundingActive',
                    args: [!project.fundingActive],
                  });
                  setTxHash(tx);
                  await wait(tx);
                  await api(`projects/${id}/funding-state-confirm`, { txHash: tx });
                }
                setStatus(
                  'Funding state confirmed. Existing reserved rewards remain payable.',
                );
                window.dispatchEvent(new Event('poc:refresh'));
              } catch (error) {
                setStatus(
                  error instanceof Error ? error.message : 'Unable to change funding',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? 'Confirming…'
              : project.fundingActive
                ? 'Stop Funding'
                : 'Start Funding'}
          </button>
          <p role="status">{status}</p>
          {txHash && (
            <p>
              <ExplorerLink value={txHash}>View funding control transaction ↗</ExplorerLink>
            </p>
          )}
        </section>
      )}
    </LiveData>
  );
}
