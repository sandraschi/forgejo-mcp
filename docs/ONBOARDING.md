# Onboarding — forgejo-mcp

## What this is for

Talk to **Forgejo** or **Codeberg** (self-hosted Git forges) from agents: repos, issues, PRs, runner health. Not GitHub.com — use git-github-mcp for that.

## Cost / account

| Question | Answer |
|----------|--------|
| Account? | Forgejo/Codeberg user + **Personal Access Token** |
| Money? | Codeberg free for normal use; self-hosted Forgejo = your hardware |
| GitHub PAT? | Wrong product — this server speaks Forgejo/Gitea API |

## Setup

1. Create a PAT on your Forgejo/Codeberg instance (repo + issue scopes as needed).
2. ```powershell
   cd D:\Dev\repos\forgejo-mcp
   Copy-Item .env.example .env
   uv sync
   .\start.ps1
   ```
3. Add a profile (base URL + token) via tools or dashboard Settings.

Fleet launcher: `mcp-central-docs\starts\forgejo-mcp-start.bat`

- Dashboard: http://127.0.0.1:11132  
- Backend / MCP: http://127.0.0.1:11133  

## Pitfalls

- Ports **11132/11133** — do **not** use 10760/10761 (those are bluesky-mcp)
- Wrong forge URL / expired PAT → 401s
- Multi-profile: set active profile before repo ops
