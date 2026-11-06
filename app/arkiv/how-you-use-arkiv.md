# How Proof of Contribution uses Arkiv

A private queue records program, merge eligibility and settlement changes. Run `npm run arkiv:sync` with configured Rabdi access/issuer keys and deployed API to publish typed v2 entities. Open `/arkiv` to query issuer-owned public contribution attestations; program attestations are available from the program query. Identity/wallet mappings and individual reward amounts remain private application data. No live write or read is claimed without entity/transaction evidence.
