'use client';
import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseUnits, type Address, type Hex, type Abi } from 'viem';
import { api, LiveData, money, Donation, WalletBind, wallet, wait } from './client';
import { USDC } from '../lib/contracts';
import artifact from '../lib/generated/project-treasury.json';
import { ExplorerLink } from './explorer-link';

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Unable to complete this action';

export function ProjectList() {
  return (
    <LiveData path="projects">
      {(rows) =>
        rows.length ? (
          <div className="grid">
            {rows.map((p: any) => (
              <Link className="card program" key={p.id} href={`/admin/projects/${p.id}`}>
                <span className="tag">YOUR REPOSITORY</span>
                <h2>{p.repoFullName}</h2>
                <p className="muted">{p.description}</p>
                <div className="stat">
                  {money(p.availableMicro)} <small>USDC for contributor rewards</small>
                </div>
                <p className="muted">
                  Up to {money(p.maxRewardMicro)} USDC per merged MR
                </p>
                <span className="arrow">Open project ↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <section className="card">
            <h2>Register your first repository.</h2>
            <p>
              Get a permanent funding address for your repo and set its automatic reward
              limit.
            </p>
            <Link href="/admin/projects/new">Register repository ↗</Link>
          </section>
        )
      }
    </LiveData>
  );
}

export function ProjectHeading({
  id,
  section,
}: {
  id: string;
  section: 'funding' | 'settings';
}) {
  return (
    <LiveData path={`projects/${id}`}>
      {(p) => (
        <>
          <div className="pagehead">
            <span className="eyebrow">ADMIN / YOUR PROJECT</span>
            <h1>{p.repoFullName}</h1>
            <p>
              One repository. A permanent funding address. Automatic rewards for merged
              work.
            </p>
          </div>
          <nav className="project-tabs">
            <Link
              className={section === 'funding' ? 'active' : ''}
              href={`/admin/projects/${id}`}
            >
              Project funding
            </Link>
            <Link
              className={section === 'settings' ? 'active' : ''}
              href={`/admin/projects/${id}/settings`}
            >
              Funding controls
            </Link>
          </nav>
        </>
      )}
    </LiveData>
  );
}

export function ProjectFunding({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <LiveData path={`projects/${id}`}>
      {(p) => (
        <>
          <div className="stats project-stats">
            <div>
              <span className="muted">Available for rewards</span>
              <strong>
                {money(p.availableMicro)} <small>USDC</small>
              </strong>
            </div>
            <div>
              <span className="muted">Ready to be claimed</span>
              <strong>
                {money(p.reservedMicro)} <small>USDC</small>
              </strong>
            </div>
            <div>
              <span className="muted">Maximum per MR</span>
              <strong>
                {money(p.maxRewardMicro)} <small>USDC</small>
              </strong>
            </div>
          </div>
          <div className="split">
            <section className="card">
              <span className="eyebrow">PERMANENT REPOSITORY FUNDING ADDRESS</span>
              <h2>Funds for contributors. Only.</h2>
              <p className="funding-address">
                <ExplorerLink kind="address" value={p.fundingAddress} />
              </p>
              {p.deploymentTxHash && (
                <p>
                  <ExplorerLink value={p.deploymentTxHash}>
                    View treasury deployment ↗
                  </ExplorerLink>
                </p>
              )}
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(p.fundingAddress);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? 'Copied ✓' : 'Copy address'}
              </button>
              <p className="muted">
                This address stays linked to {p.repoFullName}. All project funds are
                dedicated to contributor rewards.
              </p>
              <dl className="project-facts">
                <div>
                  <dt>Who can fund it</dt>
                  <dd>Owner and public donors</dd>
                </div>
                <div>
                  <dt>Who receives a reward</dt>
                  <dd>Eligible code contributors</dd>
                </div>
                <div>
                  <dt>How many recipients</dt>
                  <dd>Each eligible code contributor</dd>
                </div>
              </dl>
            </section>
            <section className="card">
              <WalletBind />
              <Donation projectId={id} treasuryAddress={p.fundingAddress as Address} />
            </section>
          </div>
          <section className="card">
            <h2>How rewards work</h2>
            <p>
              After an eligible merge, AI scores code contributors. Donation rate,
              available funds and the immutable cap determine one combined reward.
              Verified linked wallets are paid automatically; others claim reserved shares
              with thirdweb GitHub login.
            </p>
            <p className="muted">No payout periods or manual allocation approvals.</p>
            <Link href={`/admin/projects/${id}/settings`}>Start / stop funding ↗</Link>
          </section>
          <ProjectRewards id={id} />
        </>
      )}
    </LiveData>
  );
}

export function ProjectRewards({ id }: { id: string }) {
  return (
    <>
      <h2 className="sectiontitle">Automatic MR rewards</h2>
      <LiveData path={`projects/${id}/rewards`}>
        {(rows) =>
          rows.length ? (
            <div className="reward-list">
              {rows.map((r: any) => (
                <article className="card reward-row" key={r.id}>
                  <div>
                    <strong>MR #{r.prNumber}</strong>
                    <p className="muted">
                      {r.paidCount} of {r.recipientCount} recipients paid
                    </p>
                  </div>
                  <div>
                    <span className="tag">{r.claim_status.replaceAll('_', ' ')}</span>
                    <p>
                      {r.amount_micro && BigInt(r.amount_micro) > 0n
                        ? `${money(r.amount_micro)} USDC`
                        : 'Awaiting project funding'}
                    </p>
                    {r.reserveTxHash && (
                      <p>
                        <ExplorerLink value={r.reserveTxHash}>
                          View reward reservation ↗
                        </ExplorerLink>
                      </p>
                    )}
                    {r.paymentTxHashes?.map((tx: string) => (
                      <p key={tx}>
                        <ExplorerLink value={tx}>
                          View payout ↗ {tx.slice(0, 10)}…
                        </ExplorerLink>
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="card">
              <p className="muted">
                Eligible merges are evaluated immediately. Registered contributors are
                paid automatically; other shares remain reserved.
              </p>
            </section>
          )
        }
      </LiveData>
    </>
  );
}
type Draft = {
  id: string;
  repository: string;
  repositoryKey: Hex;
  voucherSigner: Address;
  maxRewardMicro: string;
  owner?: Address;
  treasuryAddress?: Address;
  deploymentTxHash?: Hex;
};

export function RegisterProject() {
  const router = useRouter();
  const [maximum, setMaximum] = useState('100');
  const [repository, setRepository] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>();
  useEffect(() => {
    try {
      const saved = localStorage.getItem('poc-project-registration-v3');
      if (saved) {
        const d = JSON.parse(saved);
        setDraft(d);
        setRepository(d.repository);
      }
    } catch {}
  }, []);

  function save(d: Draft) {
    setDraft(d);
    localStorage.setItem('poc-project-registration-v3', JSON.stringify(d));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      let d =
        draft ??
        (await api('projects/prepare', {
          repository,
          maxRewardMicro: parseUnits(maximum, 6).toString(),
        }));
      save(d);
      const { client, account } = await wallet();
      if (d.owner && d.owner.toLowerCase() !== account.toLowerCase()) {
        throw Error('Continue with the wallet that started this registration');
      }
      const challenge = await api('wallet/challenge', { address: account });
      const signature = await client.signMessage({ account, message: challenge.message });
      await api('wallet/verify', {
        challengeId: challenge.challengeId,
        address: account,
        signature,
      });
      if (!d.deploymentTxHash) {
        setStatus('Confirm creation of your repository’s funding address.');
        const tx = await client.deployContract({
          account,
          abi: artifact.abi as Abi,
          bytecode: artifact.bytecode as Hex,
          args: [USDC, d.repositoryKey, d.voucherSigner, BigInt(d.maxRewardMicro)],
        });
        d = { ...d, owner: account, deploymentTxHash: tx };
        save(d);
      }
      const receipt = await wait(d.deploymentTxHash);
      if (!receipt.contractAddress) {
        throw Error('Funding address was not created');
      }
      d = { ...d, treasuryAddress: receipt.contractAddress };
      save(d);
      const p = await api('projects', {
        id: d.id,
        repository: d.repository,
        ownerWallet: account,
        treasuryAddress: d.treasuryAddress,
        deploymentTxHash: d.deploymentTxHash,
        maxRewardMicro: d.maxRewardMicro,
      });
      localStorage.removeItem('poc-project-registration-v3');
      router.push(`/admin/projects/${p.id}`);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="registration-layout">
      <form className="card form" onSubmit={submit}>
        <h2>Your repository is the project.</h2>
        <p className="muted">
          Register it once. Its funding address stays permanently linked to it.
        </p>
        <label>
          GitHub repository
          <input
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            disabled={!!draft}
            pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+"
            placeholder="your-team/repository"
            required
          />
        </label>
        <label>
          Permanent combined reward cap per PR (USDC)
          <input
            type="number"
            min="0.000001"
            step="0.000001"
            required
            value={draft ? money(draft.maxRewardMicro) : maximum}
            disabled={!!draft}
            onChange={(event) => setMaximum(event.target.value)}
          />
        </label>
        <div className="registration-note">
          <strong>Private admin workspace</strong>
          <p>
            Your project won’t appear in a public directory. Anyone can donate; only you
            can start or stop funding.
          </p>
        </div>
        <button disabled={busy} className="primary">
          {busy
            ? 'Registering…'
            : draft
              ? 'Continue registration ↗'
              : 'Register repository ↗'}
        </button>
        {draft && !busy && (
          <button
            className="quiet"
            type="button"
            onClick={() => {
              localStorage.removeItem('poc-project-registration-v3');
              setDraft(undefined);
              setStatus('');
            }}
          >
            Start over
          </button>
        )}
        <p role="status">{status}</p>
      </form>
      <aside className="registration-steps">
        <article>
          <span>01</span>
          <div>
            <h3>Register your repo</h3>
            <p>One repository becomes one project, with a permanent funding address.</p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h3>Fund it and set a maximum</h3>
            <p>
              Choose the maximum reward for a merged MR. Every deposited USDC is for
              contributor payouts.
            </p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h3>Rewards happen automatically</h3>
            <p>
              After an eligible merge, AI scores contributors and reserves capped shares.
              Linked wallets receive automatic payments. Others sign in with GitHub to
              claim.
            </p>
          </div>
        </article>
      </aside>
    </div>
  );
}
