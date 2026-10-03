# INSTALL — forgejo-mcp

## Prereqs

- [uv](https://github.com/astral-sh/uv) (Python 3.12+)
- [Bun](https://bun.sh) (web companion) — or npm
- A Forgejo instance (local or [Codeberg.org](https://codeberg.org)) + personal access token

## Install

```powershell
git clone https://github.com/sandraschi/forgejo-mcp
cd forgejo-mcp
uv sync
Copy-Item .env.example .env
# edit .env: FORGEJO_URL + FORGEJO_TOKEN (+ optional FORGEJO_LABEL)
.\start.ps1
```

Dashboard: http://127.0.0.1:11132 · API/MCP: http://127.0.0.1:11133

## Verify

```powershell
Invoke-WebRequest http://127.0.0.1:11133/health -UseBasicParsing
uv run pytest tests/ -q
```

## Claude Desktop (stdio)

```json
{ "mcpServers": { "forgejo": {
  "command": "uv", "args": ["run", "--project", "D:/Dev/repos/forgejo-mcp", "python", "-m", "forgejo_mcp"]
} } }
```

The server also starts a FastAPI companion thread (`WEB_PORT`, default 11133) for the dashboard.
