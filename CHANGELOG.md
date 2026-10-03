# Changelog

## [Unreleased] (assfix 2026-10-02, first full pass)

### Added
- `forgejo_shutdown` tool (confirm-gated) + `GET /api/capabilities`
- Tool annotations (READ_ONLY/MUTATING) + docstring standard sections on all 16 tools
- `.env.example`, `INSTALL.md`, `CHANGELOG.md`, `skills/forgejo-companion/SKILL.md`
- `.github/workflows/ci.yml`, `.pre-commit-config.yaml` (adapted: oxlint, no tsc/biome — webapp is JSX)
- `just ci` recipe + `scripts/just/fleet.just` import (mcpb-pack, cua tests)
- Testids on sidebar/nav/profile form
- `WEB_PORT` default corrected to 11133; vite dev ports aligned to 11132/11133
