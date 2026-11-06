# How Hugo uses Arkiv

A private publication queue captures project and contribution state. The publishing API writes typed Program and Contribution entities on Rabdi using `@arkiv-network/sdk`. The CLI calls this hosted API; the backend signs the writes.

The `/arkiv` page reads `/api/arkiv/contributions`, which performs a live Arkiv SDK query rather than reading the publication queue. It displays merge eligibility, paid-recipient state, entity links and Arc settlement references. The Program query is `/api/arkiv/programs`.

Issuer ownership prevents unrelated writers from appearing in Hugo's view. Project/kind filters select the intended records; revision selection avoids showing older returned state. After 90-day expiry, records are no longer a durable public history; renewal is outside the POC. A successful live Contribution entity is `0xa9aea787302390cf52a725809e961bf867e758ce9915d6c8272624318f91767a`.
