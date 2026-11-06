# Public v2 attestations

`poc.v2.attestation` stores issuer-owned Program or Contribution records with subject/revision, program ID, name/treasury, merge SHA, evidence hash, eligibility, settlement state and chain transaction references. It never includes claimant IDs, wallet-link mappings, individual amounts, raw evaluation or commit email. Transfers on Arc remain public.

The server queries the same schema filtered by issuer, project and kind; UI reads /api/arkiv/programs and /api/arkiv/contributions. A private revisioned queue publishes changes. Current expiration is 90 days; renewal/permanent storage is not claimed. Historical v1 schemas are not silently decoded as v2.

Live write/read remains blocked by Rabdi credentials and funded issuer. See ../docs/IMPLEMENTATION_STATUS.md.
