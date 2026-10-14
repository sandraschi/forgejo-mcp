# forgejo-mcp (.mcpb bundle root)

This directory is what `mcpb pack` archives for Claude Desktop. It is a
maintained source tree, not a dump:

- `manifest.json` — v0.2 manifest (stdio via `uv run --directory`, spec-only `${...}` vars)
- `pyproject.toml` — runtime-only project so `uv run` resolves inside the bundle
- `assets/icon.png` — 256x256 bundle icon (copy of repo `assets/icon.png`)
- `assets/prompts/` — synced from repo `assets/prompts/` at pack time (3-4-100 gate)
- `src/` — **build artifact**, wiped + recopied from repo `src/` on every pack (gitignored, never edit)
- `.mcpbignore` — synced from repo root at pack time

Pack with `just mcpb-pack` (repo shim → fleet pipeline: stage, verify, 3-4-100
check, pack, stable name + `install.ps1`, smoke-launch). Attach `dist/*.mcpb`
plus `dist/install.ps1` to the GitHub release.
