# Hugo

Hugo rewards open-source contributors through repository treasuries on Arc Testnet. Owners register a repository, fund it and set a reward cap; eligible merged contributions are evaluated and paid to contributors.

The application lives in [app/](app/README.md). Real operation requires configured external services and a testnet deployment.

Merged PRs in this repository trigger `.github/workflows/post-merge.yml`, which calls the hosted Hugo API directly. Workflow-supplied merge evidence, 0G evaluation, score storage, reward reservation and linked-wallet payment attempts run in that HTTP request. No central worker or dispatch queue is used. Fresh Supabase setup uses one file: `app/supabase/migrations/001_hugo.sql` (relative to repository root).
