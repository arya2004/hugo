# Why Arkiv

Arkiv lets external tools query issuer-owned contribution attestations without access to Hugo's private Supabase database. Ownership scopes the source of the statements, indexed fields support finding the relevant records, and explicit expiry bounds their lifetime. The public verification page reads these entities live.

Keeping this data only in Supabase would leave external consumers dependent on Hugo's database-backed API for the public record. Arkiv makes the underlying records independently queryable, although Hugo's own UI currently uses a backend adapter with an access key.

Arc remains authoritative for funds and payments. An issuer-owned attestation does not independently prove the AI score or eliminate trust in Hugo. Identity-wallet links and raw evaluations stay private; public Arc transfers are not confidential.
