# Connect a repository to Hugo

This folder contains an integration example, not an active Hugo workflow. The separate `hugo-todo-demo` repository is the integration showcase and already has this workflow installed.

To connect another repository:

1. Copy `post-merge.yml` into that repository as `.github/workflows/post-merge.yml` and commit it to the default branch.
2. Deploy Hugo and register that repository in Hugo's owner workspace. Deploy its treasury, add test USDC and Start Funding.
3. In the connected repository's GitHub **Settings → Secrets and variables → Actions**, add:
   - `POC_API_URL`: your hosted Hugo origin.
   - `POC_MERGE_TRIGGER_SECRET`: the same value as Hugo's backend `MERGE_TRIGGER_SECRET`.
4. Open and merge a real PR in the connected repository. Its workflow collects contribution details, sends them to Hugo's `/api/merge/github` endpoint, and waits for synchronous evaluation and reward processing.

The workflow uses GitHub's automatic token for evidence collection and does not check out or execute PR code. Hugo trusts the submitted evidence for this POC. AI credentials and the payout signer stay on the Hugo backend.

Merging into the Hugo application repository does not run contribution payouts. No source-repository workflow is installed by deploying Hugo itself.
