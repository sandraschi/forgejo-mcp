# forgejo-mcp — Agent Guide

## Overview
FastMCP 3.4.4+ server for Forgejo and Codeberg integration.

## Entry Points
- `uv run python -m forgejo_mcp` → Starts server (Stdio + background FastAPI companion thread).

## Standards
- FastMCP 3.4.4+ tool structure.
- Configuration loaded dynamically via `.env.profiles.json`.
- All operations allow passing an optional `profile` query to switch contexts.
- Dual transport: stdio (Claude Desktop) + HTTP (`MCP_TRANSPORT=http`).
- Web companion UI port: `10760` (Frontend dev) and `10761` (FastAPI backend).

## Key Files
- `README.md` — User documentation
- `INSTALL.md` — Prerequisites and installation instructions
- `src/forgejo_mcp/client.py` — httpx client mapping Gitea/Forgejo APIs
- `src/forgejo_mcp/server.py` — MCP tools registrations
