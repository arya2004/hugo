# Hugo

Hugo funds open-source contributors using repository treasuries on Arc Testnet. Repository owners set a reward cap and control funding; verified merged contributions are evaluated and eligible rewards are reserved for contributors.

Built with Next.js, Supabase, GitHub Actions, 0G, thirdweb, Arc, Chainlink CRE and Arkiv. External services and testnet deployments require configuration before the app can process real contributions or payments.

Merged PRs in this repository trigger `.github/workflows/post-merge.yml`, which calls the hosted Hugo API directly. Workflow-supplied merge evidence, 0G evaluation, score storage, reward reservation and linked-wallet payment attempts run in that HTTP request. No central worker or dispatch queue is used. Fresh Supabase setup uses one file: `app/supabase/migrations/001_hugo.sql` (relative to repository root).
