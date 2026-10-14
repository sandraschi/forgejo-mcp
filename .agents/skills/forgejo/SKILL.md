---
name: forgejo
description: Forgejo/Codeberg session primer for forgejo-mcp (profiles, repos, issues, PRs, runners).
---

## Session Context (forgejo-mcp)

Before starting work: call `forgejo_status` and `forgejo_profile_list`.
Prefer `forgejo_repo_search` / `forgejo_pr_diff` before mutating calls.
Ports 11132/11133. At end of work: clean tree, never commit PATs.
