import Link from 'next/link';

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <i /> YOUR REPOSITORY. YOUR PROJECT.
          </span>
          <h1>
            Fund your project.
            <br />
            Recognize the work.
            <br />
            <em>Reward contributors.</em>
          </h1>
          <p className="lede">
            Register a repository and give it a dedicated funding address. Set a permanent
            per-PR cap, accept donations, and start funding. Eligible code contributors
            receive immediate, funded rewards. Linked wallets are paid automatically; new
            contributors claim with GitHub.
          </p>
          <div className="actions">
            <Link className="button primary" href="/admin">
              Open admin workspace ↗
            </Link>
            <Link className="textlink" href="/redeem">
              How MR rewards work →
            </Link>
          </div>
          <p className="heronote">
            Private project workspaces. Automatic payments and reserved individual claims.
          </p>
        </div>
        <div className="hero-visual" aria-label="Project funding lifecycle">
          <div className="orbit orbit1" />
          <div className="orbit orbit2" />
          <div className="floating mini mini1">
            <span className="statusdot" /> Your repository, connected <b>↗</b>
          </div>
          <div className="ledger">
            <span className="eyebrow">ONE REPOSITORY = ONE PROJECT</span>
            <div className="ledger-symbol">✳</div>
            <h2>Fund the work you own.</h2>
            <p>Repository → funding address → contributor payouts</p>
            <div className="ledgerline">
              <span>01</span> Admin registers a repository <b>↗</b>
            </div>
            <div className="ledgerline">
              <span>02</span> Admin funds its repository <b>↗</b>
            </div>
            <div className="ledgerline">
              <span>03</span> Contributors get funded reward shares <b>↗</b>
            </div>
            <div className="ledgerfoot">
              <i /> OWNER + PUBLIC DONATIONS <span>USDC / ARC</span>
            </div>
          </div>
          <div className="floating mini mini2">
            <span className="miniicon">✓</span>
            <div>
              Your project stays in your workspace
              <small>One maximum reward. Automatic MR payouts.</small>
            </div>
          </div>
        </div>
      </section>
      <section className="principle">
        <span>REGISTER YOUR REPO.</span>
        <span>FUND YOUR PROJECT.</span>
        <span>REWARD MERGED WORK.</span>
      </section>
      <section className="role-cards">
        <Link href="/admin" className="card role-card">
          <span className="eyebrow">ADMIN / REPOSITORY OWNER</span>
          <h2>I manage the project.</h2>
          <p>
            Register a repository, get its funding address, add USDC and set the maximum
            automatic reward.
          </p>
          <span className="arrow">Go to admin workspace ↗</span>
        </Link>
        <Link href="/redeem" className="card role-card">
          <span className="eyebrow">CONTRIBUTOR</span>
          <h2>I contribute to the project.</h2>
          <p>
            Already linked to a verified embedded wallet? Get paid automatically.
            Otherwise sign in with GitHub and claim your reserved share.
          </p>
          <span className="arrow">Claim contributor rewards ↗</span>
        </Link>
      </section>
      <section className="callout">
        <div>
          <span className="eyebrow">PRIVATE BY DEFAULT</span>
          <h2>Your funding stays out of the spotlight.</h2>
          <p>
            Only your registered repositories appear in your admin workspace. There is no
            contributor directory or history feed. Funding transactions remain visible on
            Arc.
          </p>
        </div>
        <Link className="button" href="/admin/projects/new">
          Register a repository ↗
        </Link>
      </section>
    </>
  );
}
