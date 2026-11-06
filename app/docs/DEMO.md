# POC demo

1. Open the owner workspace, register a repository and choose its fixed combined PR cap.
2. Donate test USDC from the owner and a public donor. Start Funding.
3. Link contributor A once using thirdweb GitHub. Leave contributor B unregistered.
4. Merge a PR with code from A and B and review-only evidence from C. Show the actual 0G request ID, persisted scores/explanations and reviewer score zero.
5. Show the one confirmed Arc reservation within the cap. A receives an automatic payment; B's share remains reserved.
6. Stop Funding. Authenticate B with thirdweb GitHub and claim the reserved share. Show the actual Arc receipts. Repeated requests must not transfer again.
7. Merge another PR while stopped: the persisted contribution is ineligible, including after restart.
8. Open /arkiv and query actual issuer-owned eligibility/settlement records. Run the configured genuine CRE simulation against the real reservation.

Local preview uses labelled sample data and is suitable for reviewing pages only. Do not present it as an integration demo. Accounts, faucets, deployment, live 0G/thirdweb/Arkiv/CRE evidence remain prerequisites recorded in IMPLEMENTATION_STATUS.md.
