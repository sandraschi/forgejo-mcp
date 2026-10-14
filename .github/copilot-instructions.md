# forgejo-mcp — Copilot instructions

Ports 11132 (web) / 11133 (API). Forgejo/Codeberg only, never GitHub.com.

## Session Context (forgejo-mcp)

Before starting work: call `forgejo_status` and `forgejo_profile_list`.
Prefer `forgejo_repo_search` / `forgejo_pr_diff` before mutating calls.
At end of work: leave the tree clean; never commit PATs.
