import { ContributorClaims } from '../../components/contributor-claims';

export default function Page() {
  return (
    <div className="private-claim-shell">
      <div className="pagehead">
        <span className="eyebrow">CONTRIBUTOR REWARDS</span>
        <h1>Good work. Your reward.</h1>
        <p>
          Already linked? Eligible rewards arrive automatically. New here? Authenticate
          with GitHub and claim your reserved share. No registration is needed before
          contributing.
        </p>
        <p className="muted">
          Reviewing alone earns no reward. All transfers use public Arc Testnet USDC.
        </p>
      </div>
      <ContributorClaims />
    </div>
  );
}
