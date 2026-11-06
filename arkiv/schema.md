# Schema and ownership

Hugo uses `poc.v2.attestation` on Rabdi (chain 7794095). The publisher wallet owns the entities; contributors do not edit them. The writer is `0x112634b7dabb3af1862d802116dcc329ae1083ce`.

The schema contains `project`, `kind`, `subject`, `revision`, `programId`, `name`, `treasury`, `mergeSha`, `evidenceHash`, `eligibility`, `settlement`, and `reference`. `project`, `kind`, and `subject` are indexed. Program entities describe treasury/project state; Contribution entities describe merge eligibility and settlement references. `reference` is an Arc transaction hash, not an Arkiv transaction.

Reads filter by issuer ownership, `project=proof-of-contribution`, and `kind=Program` or `Contribution`. The adapter selects the greatest returned revision per subject, with a current 50-entity query limit. Publishing revisions creates new entities. Each expires after 90 days; renewal is not automated, so this is not permanent history.

Private identity-wallet links, individual amounts, raw evaluations and commit emails stay off Arkiv. Arc payouts remain public. See `app/src/server/arkiv.ts` for the typed schema and actual SDK query.
