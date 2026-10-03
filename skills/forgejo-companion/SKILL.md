---
name: forgejo-companion
description: Manage Forgejo/Codeberg instances via forgejo-mcp (profiles, repos, issues, PRs, runners) and its web companion. Use when onboarding a git host, triaging issues/PRs, or checking Actions runners.
---

# Forgejo Companion

## Backend (FastAPI + MCP, default :11133)

- Health: `GET /health` -> `{"status": "ok", ...}`
- Capabilities: `GET /api/capabilities` (tool list + versions)
- MCP endpoint: `/mcp` (streamable HTTP); stdio via `python -m forgejo_mcp`

## MCP tools (profile-scoped; pass `profile` or set active)

- Profiles: `forgejo_profile_list` (read-only), `forgejo_profile_add`, `forgejo_profile_set_active`
- Repos: `forgejo_repo_list` / `forgejo_repo_search` (read-only), `forgejo_repo_create`
- Issues: `forgejo_issue_list` (read-only), `forgejo_issue_create`, `forgejo_issue_comment`
- PRs: `forgejo_pr_list` / `forgejo_pr_diff` (read-only), `forgejo_pr_create`, `forgejo_pr_merge`
- Ops: `forgejo_runner_list` / `forgejo_workflow_runs` / `forgejo_file_get` (read-only), `forgejo_shutdown(confirmed=true)`

## Web companion (Vite, default :11132)

Single-view dashboard: profiles, repositories, runners, API docs. Key testids: `sidebar-toggle`, `nav-*`, `profile-key/label/url/token`, `profile-add`.

## Launch

`start.ps1` (fleet engine) or `just run` (stdio) + `just` frontend. Env: `FORGEJO_URL`, `FORGEJO_TOKEN`, `WEB_PORT` (see `.env.example`).
