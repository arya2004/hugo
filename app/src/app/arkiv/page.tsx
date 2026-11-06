import { Attestations } from '../../components/attestations';

export default function Page() {
  return (
    <>
      <div className="pagehead">
        <span className="eyebrow">PUBLIC ATTESTATIONS</span>
        <h1>Verify the work.</h1>
        <p>
          Live issuer-owned Arkiv records show merge eligibility and settlement
          references. Individual rewards and private wallet links are omitted.
        </p>
      </div>
      <Attestations />
    </>
  );
}
