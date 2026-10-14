# Changelog

## [Unreleased] (assfix 2026-10-14, second full pass)

### Fixed
- CORS wildcard (`allow_origins=["*"]`) replaced with explicit origins + LAN/Tailscale/Tauri regex
- `web/src/App.jsx` referenced undefined `VERSION`/`WEB_PORT` (sidebar + docs buttons crashed) — now `APP_VERSION` const + same-origin `/docs` links
- CI web job used `npm ci` with `web/package-lock.json` (absent; repo is bun) — now `oven-sh/setup-bun` + frozen lockfile
- `scripts/mcpb-pack.ps1` was a stale docs-mcp copy — now a fleet shim delegating to `mcp-central-docs/scripts/fleet-mcpb-pack.ps1`; added `.mcpbignore`
- Removed `S110`/`S112` from ruff ignore (silent swallows now linted); added `T20` print ban + per-file-ignores
- `llms.txt`/`llms-full.txt` cited bluesky ports 10760/10761 and missing docs — corrected to 11132/11133 with real links

### Added
- `forgejo_status` tool (dialogic dict + `output_schema`, Prefab `app=True`)
- `forgejo://profiles` MCP resource (no tokens), `forgejo-triage` MCP prompt
- `GET /api/status`, `GET /api/skills`, `POST /api/shutdown` (orderly 500 ms exit)
- `Annotated[..., Field(...)]` params on all tools (no more `Args:` blocks); `_error_response()` helper; `logger.exception` in client except paths
- Session injection: `.cursorrules`, `.windsurfrules`, `.claude-plugin/` (+ hooks), `.github/copilot-instructions.md`, `.opencode/skills/`, `.agents/skills/`
- `just serve`, `.gitattributes` (LF), `renovate.json`, `*.mcpb` gitignore
- `glama.json` now lists all 18 tools

### Deferred (with reason)
- `SUGGESTED: skillbuild forgejo-mcp` (sole domain skill is a 28-line runt; needs repo-wide harvest, never an inline rewrite)
- Catch-them-all webapp pages (Inbox/Tools/Skills/Chat/Settings/Help/Logs) — standalone build
- Portmanteau refactor, dialogic returns on legacy tools, coverage threshold, e2e suite
- `SkillsDirectoryProvider` wiring (unverified API on 3.4.x; must not risk startup)

## [Unreleased] (assfix 2026-10-02, first full pass)

### Added
- `forgejo_shutdown` tool (confirm-gated) + `GET /api/capabilities`
- Tool annotations (READ_ONLY/MUTATING) + docstring standard sections on all 16 tools
- `.env.example`, `INSTALL.md`, `CHANGELOG.md`, `skills/forgejo-companion/SKILL.md`
- `.github/workflows/ci.yml`, `.pre-commit-config.yaml` (adapted: oxlint, no tsc/biome — webapp is JSX)
- `just ci` recipe + `scripts/just/fleet.just` import (mcpb-pack, cua tests)
- Testids on sidebar/nav/profile form
- `WEB_PORT` default corrected to 11133; vite dev ports aligned to 11132/11133
