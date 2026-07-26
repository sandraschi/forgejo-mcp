# forgejo-mcp — Claude / agent context

Forgejo / Codeberg MCP. Ports **11132** (frontend) / **11133** (backend). License **GPL-3.0-only**.

## Do

- Use profiles for each instance; set active before mutating
- Prefer dry checks (list/search) before merge/create
- Read `docs/ONBOARDING.md` for PAT setup

## Don't

- Point this at GitHub.com (use git-github-mcp)
- Reuse bluesky ports 10760/10761
- Commit PATs or `.env.profiles.json` with secrets

## Commands

```powershell
.\start.ps1
uv run pytest
```

See AGENTS.md, README.md, llms-full.txt.
