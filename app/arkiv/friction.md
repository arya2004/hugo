# Integration friction

SDK 1.0.1 uses typed schemas, issuer-owned queries and expiring entities. The adapter uses its installed signatures. Live integration needs a Rabdi access key and a tGLM-funded writer with the matching configured issuer address; none is fabricated. Records expire after 90 days; renewal is outside this POC. The public v2 schema deliberately omits v1 claimant identifiers.
