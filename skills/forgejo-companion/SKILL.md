---
name: forgejo-companion
description: Manage Forgejo/Codeberg instances via forgejo-mcp (profiles, repos, issues, PRs, runners, notifications) and its web companion. Use when onboarding a git host, triaging issues/PRs, reviewing diffs, or checking Actions runners and the Inbox.
---

# Forgejo Companion

Forgejo/Codeberg integration for agents (v0.2.0+ portmanteau surface) and humans
(web companion on :11132, backend on :11133).

## Who should read what

- **Agents** (this section + Workflows): drive everything through the 7 MCP tools
  below. Never invent tool names — `action` discriminators are `Literal`-gated.
- **Humans**: open the dashboard (`http://127.0.0.1:11132`), add a profile under
  Profiles, then browse Repositories / Runners / Inbox. API shape lives under
  `GET /api/capabilities`; server logs under `GET /api/logs`.

## Backend (FastAPI + MCP, default :11133)

- Health: `GET /health` -> `{"status": "ok", ...}`; richer `GET /api/status`.
- Capabilities: `GET /api/capabilities` (`tools` + `tool_details` with read-only flags).
- Skills: `GET /api/skills` (skill list + `forgejo-triage` prompt text).
- Logs: `GET /api/logs?level=&search=` (ring buffer, newest first).
- Local LLM: `GET /api/llm/discover`, `GET /api/llm/models?provider=`,
  `POST /api/llm/chat/stream` (SSE `data: {"delta"}` … `data: [DONE]`).
- Orderly stop: `POST /api/shutdown` (exits ~500 ms after responding).
- MCP endpoint: `/mcp` (streamable HTTP); stdio via `python -m forgejo_mcp`.
- Skills served: `skills/forgejo-companion/SKILL.md` via `SkillsDirectoryProvider`.

## MCP tools (all dialogic `{"success", "message", "data"}`; pass `profile` or set active)

- `forgejo_profiles` — `list` / `add` (needs `name`, `url`, `token`, `label`) /
  `set_active` / `remove`. Start every session with `list`.
- `forgejo_repos` — `list` / `create` (needs `name`) / `search` (needs `query`) /
  `file_get` (needs `owner`, `repo`, `filepath`; optional `ref`).
- `forgejo_issues` — `list` (needs `owner`, `repo`) / `create` (needs `owner`,
  `repo`, `title`) / `comment` (needs `owner`, `repo`, `index`, `body`).
- `forgejo_prs` — `list` / `create` (needs `owner`, `repo`, `title`, `head`,
  `base`) / `merge` (needs `owner`, `repo`, `index`; `style` defaults `merge`) /
  `diff` (needs `owner`, `repo`, `index`; 40k cap, `truncated` flag in `data`).
- `forgejo_actions` — `runners` (optional `owner`/`repo` scope) / `workflow_runs`
  (needs `owner`, `repo`) / `notifications` (Inbox feed, `unread_only` default true).
- `forgejo_status` — health/version/profile count (Prefab card over MCP).
- `forgejo_shutdown` — refuses unless `confirmed=true` (returns success=false).
- Resource `forgejo://profiles` (URLs + labels, never tokens); prompt `forgejo-triage`.

## Workflows

### 1. Onboard a new instance (agent)

1. `forgejo_profiles` action `add` with the base URL + PAT (repo + issue scopes).
2. `forgejo_profiles` action `set_active` to the new slug.
3. Verify: `forgejo_repos` action `list` with `limit` 5, then `forgejo_actions`
   action `runners` to confirm the instance answers.

### 2. Triage a repo (agent)

1. `forgejo_issues` action `list` and `forgejo_prs` action `list` for `owner`/`repo`.
2. For each open PR: `forgejo_prs` action `diff`; summarize files changed and risk.
3. Post review notes with `forgejo_issues` action `comment` (works on PRs too).
4. Merge only on explicit approval: `forgejo_prs` action `merge` with `style` squash.

### 3. Runner incident (agent + human)

1. `forgejo_actions` action `runners` — note offline agents and versions.
2. `forgejo_actions` action `workflow_runs` for the affected repo — correlate
   failures with runner offline windows.
3. Human follows up on the Runners page (:11132); agent attaches the run list.

## Web companion (Vite, default :11132)

Views: Dashboard (KPIs + instance health + GPU banner), Inbox (notification
threads), Repositories (+ drill-down + workflow runs), Actions Runners, Profiles
(CRUD), Tools (live capability cards), Skills (skill + prompt text), Chat
(streaming, skill-first, 4 personalities, persisted history), Settings (service
status + LLM providers), Help, API Docs. Key testids: `sidebar-toggle`, `nav-*`,
`profile-key/label/url/token`, `profile-add`, `tool-card-*`, `chat-*`,
`llm-provider-select`, `llm-model-select`, `onboarding-cue`.

## Launch

`start.ps1` (fleet engine) or `just run` (stdio) / `just serve` (HTTP) + frontend
via the launcher. Env: `FORGEJO_URL`, `FORGEJO_TOKEN`, `WEB_PORT` (see
`.env.example`). Ports 11132/11133 — never 10760/10761 (bluesky-mcp).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `No active profile` errors | `forgejo_profiles` action `list`, then `set_active` |
| 401s on every call | Expired PAT or wrong forge URL — re-`add` the profile |
| Empty Inbox, runners fine | Instance has no notification threads for the token user |
| Chat says no model | Start Ollama (:11434) or LM Studio (:1234); check `GET /api/llm/discover` |
| `merge` did nothing | `data`/`message` carry the API error; verify `mergeable` via `list` first |
| Diff cut off | `data.truncated=true` — narrow scope or read the file via `file_get` |
