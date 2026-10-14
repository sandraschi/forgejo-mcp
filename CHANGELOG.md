# Changelog

## [0.2.0] (assfix deferred pass, 2026-10-14) — BREAKING

Tool surface replaced: 18 atomic `forgejo_*` tools → 7 portmanteau tools
(`forgejo_profiles`, `forgejo_repos`, `forgejo_issues`, `forgejo_prs`,
`forgejo_actions`, `forgejo_status`, `forgejo_shutdown`) with an `action`
discriminator. All tools now return dialogic `{"success", "message", "data"}`.
Update saved MCP tool calls; REST API is unchanged.

### Added
- `SkillsDirectoryProvider` serves `skills/` to skill-first clients (fail-soft)
- `GET /api/logs` (server ring buffer), `GET /api/notifications` (Inbox feed)
- `GET /api/llm/discover`, `GET /api/llm/models`, `POST /api/llm/chat/stream`
  (backend Ollama/LM Studio proxy, SSE) — Chat/Settings pages use these only
- `forgejo_actions(action="notifications")` via new `list_notifications` client
- `tool_details` (live descriptions + read-only flags) in `/api/capabilities`;
  prompt text in `/api/skills`
- pytest-cov gate (`--cov-fail-under=70`, currently 78%), 37 tests
- Webapp catch-them-all: Inbox, Tools, Skills, Chat (SSE streaming, 4
  personalities, skill-first, persisted history), Settings (LLM providers),
  Logs (ring buffer), Help — 12 views; `text-xs` eliminated
- Skill rebuild (97 lines, 3 workflows, troubleshooting); Playwright e2e
  (18 specs green) + `just e2e` + CI e2e job
- MCPB bundle: `mcpb/manifest.json` (stdio via uv, spec-only vars), runtime
  `mcpb/pyproject.toml`, 256px icon, 3-4-100 prompt corpus (system 3064,
  user 4033, 100 examples); `just mcpb-pack` packs + smoke-launches clean
- Fixed: `MCP_TRANSPORT=http` never actually served MCP (bare `mcp.run()` is
  always stdio) — now explicit `transport="http"` with `MCP_PORT` override
- Inbound webhook receiver `POST /api/webhooks/forgejo` (HMAC-SHA256,
  `FORGEJO_WEBHOOK_SECRET`) + `GET /api/webhooks/events` delivery log
- Saved-call refresh: mirror project pages (mcp-central-docs, documentation-mcp),
  versions aligned (`__init__`, plugin, sidebar), `just ci` via bun, web README

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
