# forgejo-mcp — Copilot instructions

Ports 11132 (web) / 11133 (API). Forgejo/Codeberg only, never GitHub.com.

## Session Context (forgejo-mcp)

Before starting work: call `forgejo_status` and `forgejo_profiles` (action `list`).
Prefer `forgejo_repos` search / `forgejo_prs` diff before mutating calls.
At end of work: leave the tree clean; never commit PATs.
