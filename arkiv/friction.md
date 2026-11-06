# Integration feedback

A real partial publication exposed a difficult-to-see field limit in SDK 1.0.1: a combined reservation/payout transaction reference was 133 bytes, while Arkiv's `str` permits 128 bytes. The Program publication succeeded and the Contribution failed. We expected the reference to serialize; instead the write was rejected.

Reproduce locally using the SDK schema: pass two 66-character transaction hashes joined by a separator into one `str` field. Hugo now stores a single complete payout hash, falling back to the reservation hash. Both Program and Contribution writes subsequently succeeded. Field-size errors that name the field and measured limit would make this easier to diagnose.

Other setup friction was distinguishing the access key, writer private key, issuer public address, and Rabdi tGLM from Arc credentials. A single preflight example checking those prerequisites would help. Hugo's publishing script now reports successful writes, queue state and backend error/request IDs. No slow-query shapes are published here.
