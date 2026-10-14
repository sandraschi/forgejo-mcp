# forgejo-mcp — User Guide

This guide teaches humans and agents how to install forgejo-mcp, connect it to
Forgejo or Codeberg, and do real daily work with it: onboarding instances,
triaging issues, reviewing and merging pull requests, watching runners, clearing
the inbox, and chatting with a local model about your forges. It assumes the
system prompt (sibling `system.md`) as background and focuses on practice: copy
shapes, example dialogues, and what to do when something breaks. All tool names
are v0.2.0 portmanteau calls; every tool returns a dialogic dict with `success`,
`message`, and `data`.

## 1. Installing (Claude Desktop, Windows)

The zero-friction path, once a GitHub release exists:

```powershell
irm https://github.com/sandraschi/forgejo-mcp/releases/latest/download/install.ps1 | iex
```

This downloads the versioned bundle, verifies its SHA256, installs `uv`
automatically if missing (winget, else the official installer — you never touch
it by hand), and registers the server with Claude Desktop. Restart Claude
Desktop and ask: "Check my Forgejo status." The first answer will tell you no
profiles exist yet — that is expected; continue with section 3.

For every other MCP client (Cursor, VS Code, Claude Code, opencode), use the
`uvx` configuration with your checkout:

```json
{ "mcpServers": { "forgejo": {
  "command": "uvx", "args": ["--from", "git+https://github.com/sandraschi/forgejo-mcp", "forgejo-mcp"]
} } }
```

From source (developers): clone, `uv sync`, copy `.env.example` to `.env`,
fill in `FORGEJO_URL` plus `FORGEJO_TOKEN`, and run `.\start.ps1`. The dashboard
lands on http://127.0.0.1:11132 and the API on http://127.0.0.1:11133. Run
`just ci` (ruff, pyright, pytest with coverage floor, oxlint) before committing,
and `bun run e2e` in `web/` for the browser suite.

## 2. Creating a personal access token

On your Forgejo instance (or Codeberg.org), open Settings → Applications →
Generate New Token. Grant `repo` scope for repository work and `issue` scope
for issues and comments; add `admin` scope only if you need global runner
enumeration (repository runners work without it). Copy the token immediately —
it shows once. Tokens expire only if you set an expiry; a token that stops
working with 401s on every call is almost always expired or revoked, and the
fix is generating a fresh one and re-adding the profile, never debugging the
server. Treat the token like a password: it lives in the server-side profile
store, never in chat, screenshots, or committed files.

## 3. Tutorial 1 — onboard your first instance (agent dialogue)

> You: "Connect my Codeberg account. The token is in my password manager as
> codeberg-pat; the instance is https://codeberg.org."
>
> Claude: "I will register it as profile `codeberg-personal`. Please paste the
> token (it stays server-side)."
>
> You: *pastes token*
>
> Claude calls `forgejo_profiles` action `add` with name `codeberg-personal`,
> url `https://codeberg.org`, the token, label `Codeberg`, then action
> `set_active`, then `forgejo_repos` action `list` with limit 5 to verify.
>
> Claude: "Connected — 5 repositories visible, active profile
> `codeberg-personal`. Your dashboard shows the same."

What just happened: one `add` (which also activates the first profile), one
explicit `set_active` for clarity, one read-only verification. The same three
steps work for a self-hosted instance at `http://localhost:3000` or a LAN host;
only the URL changes. If `list` returns empty, the connection still succeeded —
the account simply owns no repositories. If it returns 401, the token or URL is
wrong; regenerate and re-`add` (adding the same slug overwrites).

## 4. Tutorial 2 — morning triage (agent dialogue)

> You: "Triage my demo repo — open issues and PRs, and flag anything risky."
>
> Claude calls `forgejo_status` (confirms 1 profile, active), then
> `forgejo_issues` action `list` and `forgejo_prs` action `list` for
> owner/repo `me/demo`. Two PRs are open.
>
> Claude calls `forgejo_prs` action `diff` for each, then `forgejo_actions`
> action `runners` to check CI capacity.
>
> Claude: "Issue #12 (login redirect) has no comments in 6 days — needs an
> owner. PR #7 touches auth middleware without tests (diff, ~400 lines) — I
> left a review comment asking for coverage and did NOT merge. PR #8 is a docs
> typo, safe to merge on your word. One runner offline since yesterday, which
> explains the queued workflow run."

Notice the discipline: read-only first (`list`, `diff`, `runners`), commentary
through `forgejo_issues` action `comment` (the same endpoint serves PRs), and
`merge` strictly gated on your explicit approval. The agent should state what
it did not do ("did NOT merge") as explicitly as what it did.

## 5. Tutorial 3 — review and merge a pull request (agent dialogue)

> You: "Review PR #7 in me/demo and merge it if it is clean."
>
> Claude calls `forgejo_prs` action `diff` for index 7, reads the full change,
> then `forgejo_actions` action `workflow_runs` to confirm CI is green.
>
> Clean path — Claude: "Diff is 120 lines across 3 files, tests included, CI
> green. Merging with squash." Calls `forgejo_prs` action `merge` with style
> `squash`, reports the merged confirmation.
>
> Risky path — Claude: "The diff refactors the token refresh path with no test
> changes and CI is yellow. I posted specific review notes as a comment and
> stopped before merging. Say the word when it is addressed."

Merge styles: `merge` preserves history, `squash` keeps main linear (the fleet
default for small PRs), `rebase` replays commits. When in doubt, ask the human
which style the repo uses — it is a one-question message that prevents a
rewrite of public history.

## 6. Tutorial 4 — runner incident (agent + human)

> Pager: Forgejo Actions queue is backing up.
>
> Claude calls `forgejo_actions` action `runners`: two of four agents offline,
> both on old versions. Then action `workflow_runs` for the affected repos:
> failures cluster exactly in the offline window — this is capacity, not code.
>
> You open the Runners page on the dashboard, confirm the same two agents red,
> restart the runner services on their hosts, and watch them flip green while
> Claude re-polls. The queued runs drain on their own; nothing needed merging.

The pattern generalizes: runners tell you about capacity, workflow runs tell
you about code, and the incident is whichever one changed first.

## 7. Tutorial 5 — release notes from merged work (agent dialogue)

> You: "Draft 0.3.0 release notes for me/demo."
>
> Claude calls `forgejo_prs` action `list` with state `closed`, filters merged
> PRs since the last tag, and `forgejo_issues` action `list` with state
> `closed` for fixed issues. Then it groups: features, fixes, chores.
>
> Claude: "Draft: 3 features (incl. #9 dark mode), 5 fixes (incl. #12 login
> redirect), 2 chores. Two PRs lack descriptions, so their entries are
> title-only — want me to expand them from the diffs?"

Good release notes are grouped and user-facing; commit hashes and branch names
do not belong in them. The agent offering to expand thin entries from diffs is
exactly the kind of follow-through to ask for.

## 8. Tutorial 6 — inbox zero and webhooks (agent dialogue)

> You: "Anything need me on the forges?"
>
> Claude calls `forgejo_actions` action `notifications` (unread first): three
> threads — a review request, a failed-workflow ping, and a mention.
>
> Claude: "Review request on #14 (small, tests pass — 10-minute job), a CI
> failure on main worth a look, and a mention that is FYI only. Suggested
> order: #14, CI, ignore the mention."

For push-driven awareness instead of polling, point a repo webhook at
`POST /api/webhooks/forgejo` with the shared secret from
`FORGEJO_WEBHOOK_SECRET`. Signed deliveries (HMAC-SHA256) land in the
50-event log readable at `GET /api/webhooks/events`; unsigned or secretless
calls are rejected, never stored. The Inbox page stays the human view; the
webhook log is the machine feed.

## 9. Tutorial 7 — chat with your forge data (human + local LLM)

Open Chat, confirm the provider shows detected (Ollama :11434 or LM Studio
:1234 — rescan in Settings if not), pick a model, and choose the Triage
Assistant personality: it prepends the `forgejo-triage` prompt, so the model
already knows the tool discipline. Ask "Which of my repos have open PRs older
than a week?" The model answers from its context plus whatever you paste —
note the boundary honestly: the chat model itself does not call MCP tools; the
agent driving it does. Use Chat for drafting, summarizing, and explaining, and
the agent tool calls for acting. History persists locally (100 messages),
exports to `.txt`, and never leaves your machine: the backend proxy means
provider endpoints are only ever called server-side.

## 10. Troubleshooting matrix

| Symptom | Most likely cause | Fix |
|---|---|---|
| `No active profile` on every call | Empty registry or wrong slug | `forgejo_profiles` `list`, then `add`/`set_active` |
| 401 on every call | Expired/revoked PAT or wrong URL | Regenerate token, re-`add` the profile |
| Empty repos/runners | Token lacks scopes | Reissue with repo (+issue, +admin for global runners) |
| `merge` refused by API | PR not mergeable (conflicts) | Read `list` output, resolve conflicts in the repo |
| Diff cut off | Over 40k chars | `data.truncated=true`; narrow scope or `file_get` single files |
| Chat: no model | Provider down | Start Ollama/LM Studio, rescan, re-check discover |
| Chat: empty reply | Wrong model name | Pick from the detected list, never type freehand |
| Webhook 403 | Secret mismatch | Align Forgejo webhook secret with server env |
| Webhook 503 | Receiver unconfigured | Set `FORGEJO_WEBHOOK_SECRET` and restart |
| Dashboard `Failed to fetch` | Backend down | `.\start.ps1`, then `GET /health` on :11133 |
| Wrong forge entirely | Pointed at GitHub.com | Use git-github-mcp; recreate the profile with the forge URL |

## 11. Frequently asked questions

**Forgejo or Codeberg — do I configure them differently?** No. Codeberg runs
Forgejo; only the base URL differs. Self-hosted instances usually live on LAN
hosts or localhost:3000 with plain HTTP, which is fine on loopback and LAN.

**How many profiles can I have?** As many as you like; switching is one call.
Name slugs after instance plus purpose (`codeberg-personal`, `forgejo-work`).

**Can two agents share one server?** Yes — the registry and webapp are shared.
Coordinate the active profile out loud; pass `profile` explicitly in tool calls
when working off-active so you never depend on ambient state.

**Private repositories?** New repos default to private. Listing shows visibility
badges; `file_get` respects whatever the token can see.

**What counts as needing my approval?** Merging PRs, removing profiles,
shutting down the server, and creating public repositories. Everything else is
reversible or read-only.

**Where do logs live?** The Logs page queries the server ring buffer; MCP
server logs sit at the Claude Desktop log path per the fleet docs. Webhook
deliveries have their own 50-event log.

**How do I update?** Pull, `uv sync`, restart. v0.2.0 was the breaking
portmanteau migration; check CHANGELOG before adopting new minors.

## 12. Example dialogues (short)

*Onboarding a LAN forge:* "Add profile `lan` for http://goliath:3000 with this
token, activate it, and list my repos." → add, set_active, list-5.

*Pre-merge check:* "Is PR #21 in org/site mergeable, CI green, diff
test-covered?" → list (mergeable flag), workflow_runs, diff. Three calls, one
verdict.

*Release sweep:* "List closed PRs since tag v0.2.0 in me/demo." → list with
state closed, filter by merged date client-side.

*Runner audit:* "Which runners are offline and what versions?" → runners,
report name/version/status lines.

*File check:* "Show me src/main.py on branch develop in me/demo." → file_get
with ref develop. Content arrives as the message.

Each of these maps 1:1 to entries in `examples.json` — search that file by
intent when the agent needs the exact argument shape.

## 13. Working with several instances at once

Consultants, maintainers of forks, and anyone with both a work forge and a
personal Codeberg account live in multi-profile mode permanently. The rules:
name slugs unambiguously (`codeberg-personal`, `forgejo-acme`), verify each new
profile with a 5-item `list` before trusting it, and pass `profile` explicitly
on every call in mixed sessions instead of flipping ambient state — after a
long context, nobody remembers which profile is active, but the explicit
parameter is right there in the call. A useful weekly habit: `list` each
profile's repos with a small limit and confirm the counts match your mental
model; drift means a token expired or a repo moved. When comparing the same
repository name across instances, always include the instance label in your
summary ("demo exists on Codeberg (12 issues) but not on the LAN forge").

## 14. Search and list patterns that scale

`limit` caps at 100 for repos and 50 elsewhere; `page` starts at 1. For
inventory ("how many repos do we have?"), page through with limit 100 and
count `data.repositories` lengths rather than eyeballing markdown. For search,
prefer distinctive substrings (`auth-middleware` beats `auth`); empty results
are successes, so treat "no matches" as information, not failure. For issues
and PRs, `state=all` with client-side date filtering beats two calls when you
need both open and recently closed. For workflow runs, the default 20 with
page 1 covers "is CI green right now"; page deeper only for archaeology. For
notifications, stay on `unread_only=true` for triage and flip to all only when
auditing history.

## 15. Token and profile hygiene

Rotate PATs yearly or on any suspicion of leak: generate the replacement,
`add` over the same slug (overwrites in place, active profile preserved),
verify with a `list`, then revoke the old token on the instance. Never store
tokens in notes, shell history files, or screenshots — paste them only into
the `add` call, which keeps them server-side. If a token might have reached a
log, rotate first and investigate second. Removing a departed teammate's
instance means `remove` on the slug plus revoking the token server-side; either
step alone leaves half-access. The `env-default` profile from environment
variables is convenient for containers; on shared machines prefer explicit
profiles so `list` shows who owns what.

## 16. Team onboarding runbook

For onboarding a whole team onto a company Forgejo via this server: (1) the
admin creates one service PAT with repo+issue scope (admin scope only if the
team needs global runner visibility); (2) each member gets the server installed
(Claude one-liner or source) and runs the Tutorial 1 dialogue with the service
token or their own PAT; (3) the admin registers the instance webhook with the
shared `FORGEJO_WEBHOOK_SECRET` so pushes and PR events land in the delivery
log; (4) everyone bookmarks the dashboard Inbox and Runners views. Verify the
rollout by asking each member to list repos and report the count — mismatched
counts mean scope or URL mistakes, caught in minutes. Document the instance URL
and token owner somewhere the team actually reads; "works on my machine"
profile setups are the number-one support ticket for self-hosted forges.

## 17. Using forgejo-mcp inside CI

Forgejo Actions can call back into this server's REST API for notifications:
after a workflow finishes, POST a repository_dispatch-style note is not
native, but a simple `curl` to the webhook receiver with the shared secret
records a deployment event in the delivery log (`event` names are free-form
from headers, so CI can send `X-Forgejo-Event: deploy`). Agents watching
`GET /api/webhooks/events` then see deploys next to pushes. Keep CI-sent
payloads small (repo name, ref, status) and never put secrets in the payload
body — the HMAC already authenticates the sender.

## 18. Webhook setup walkthrough (Forgejo UI)

Instance → repository → Settings → Webhooks → Add webhook → Forgejo. Set
Payload URL to `http://<backend-host>:11133/api/webhooks/forgejo` (127.0.0.1
for same-machine, LAN hostname otherwise), Content type to
`application/json`, Secret to the exact `FORGEJO_WEBHOOK_SECRET` value, and
select events (push, issues, pull_request are the useful trio; avoid `all` on
busy repos). Save, then press Test Delivery: a 200 with `"success": true`
means the handshake works, and the event appears in `GET /api/webhooks/events`
within a second. A 403 means the secrets differ by even one character —
re-copy, don't retype. A 503 means the server env lacks the secret — set it
and restart. Deliveries accumulate to 50 and then roll; the log is operational
signal, not an archive, so export anything you need to keep.

## 19. Chat recipes (local LLM, backend proxy)

- "Explain this diff like I'm new to the repo" (paste a `diff` message).
- "Turn these three closed issues into one paragraph of release notes."
- "Draft a kind but firm review comment asking for tests."
- "Summarize my unread notifications into a morning briefing."
- "Compare these two workflow failures — same root cause?" (paste both runs).
- "Write a webhook payload example for a push event." (it knows the shape).
- "Which profile should I use for Acme work, and why?" (it has the triage prompt).
- "Explain merge vs squash vs rebase for this repo's history."
- "Turn this issue thread into acceptance criteria."
- "Role-play the repo maintainer while I practice a tough review reply."

Recipes work best with the Triage personality for forge questions and Custom
with a pasted style guide for writing tasks. If an answer hallucinates a repo
fact, paste the `list` output and ask again — the model reasons over context,
not over the API.

## 20. Extended FAQ

**Can I use HTTP transport instead of stdio?** Yes: `MCP_TRANSPORT=http` serves
streamable HTTP on `WEB_PORT` (or `MCP_PORT` when set). Claude Desktop uses
stdio; network clients and the launch-check sandbox use HTTP.

**Why do tools return markdown AND data?** Markdown for the conversation,
`data` for follow-up logic (counts, URLs, flags like `truncated`). Read the
message, compute over the data.

**What happens on 429 rate limits?** An explicit error dict. Wait 60+ seconds,
halve page sizes, resume. Do not hammer.

**Can the server manage users or organizations?** No — repositories, issues,
PRs, runners, workflows, notifications, files. Admin user management stays in
the Forgejo UI.

**Does search span code contents?** No — repository names/descriptions/topics.
Use `file_get` once you know the repo.

**How are binary files handled?** `file_get` base64-decodes text; binary
content fails decoding with a named error. Don't fetch archives or images.

**Can I watch a repo for changes?** Poll `list` with state filters, subscribe
via webhooks for push events, or read the Inbox for mentions and assignments.

**What is the blast radius of `remove`?** The profile entry only — no repos,
issues, or tokens on the instance are touched. Revoke the PAT separately.

**Does the server phone home?** No outbound calls except to your configured
forge instances and (for Chat) your local LLM. No telemetry.

**How do I back up my setup?** `.env.profiles.json` holds profiles (tokens
included — store the backup like a secret). Everything else is code.

## 21. Migration guide: v0.1.0 atomic tools → v0.2.0 portmanteau

Version 0.2.0 replaced 18 single-purpose tools with 7 `action`-discriminated
tools and made every return dialogic. Rewrite saved calls by this mapping:

| v0.1.0 call | v0.2.0 equivalent |
|---|---|
| `forgejo_profile_list` | `forgejo_profiles` action `list` |
| `forgejo_profile_add(name, url, token, label)` | `forgejo_profiles` action `add`, same fields |
| `forgejo_profile_set_active(name)` | `forgejo_profiles` action `set_active` |
| (new) | `forgejo_profiles` action `remove` |
| `forgejo_repo_list(profile, page, limit)` | `forgejo_repos` action `list`, same fields |
| `forgejo_repo_create(name, description, private, profile)` | `forgejo_repos` action `create`, same fields |
| `forgejo_repo_search(query, page, limit, profile)` | `forgejo_repos` action `search`, same fields |
| `forgejo_file_get(owner, repo, filepath, ref, profile)` | `forgejo_repos` action `file_get`, same fields |
| `forgejo_issue_list(owner, repo, state, page, limit, profile)` | `forgejo_issues` action `list`, same fields |
| `forgejo_issue_create(owner, repo, title, body, profile)` | `forgejo_issues` action `create`, same fields |
| `forgejo_issue_comment(owner, repo, index, body, profile)` | `forgejo_issues` action `comment`, same fields |
| `forgejo_pr_list(...)` | `forgejo_prs` action `list`, same fields |
| `forgejo_pr_create(owner, repo, title, head, base, body, profile)` | `forgejo_prs` action `create`, same fields |
| `forgejo_pr_merge(owner, repo, index, style, profile)` | `forgejo_prs` action `merge`, same fields |
| `forgejo_pr_diff(owner, repo, index, profile)` | `forgejo_prs` action `diff`, same fields |
| `forgejo_runner_list(owner, repo, profile)` | `forgejo_actions` action `runners`, same fields |
| `forgejo_workflow_runs(owner, repo, page, limit, profile)` | `forgejo_actions` action `workflow_runs`, same fields |
| (new) | `forgejo_actions` action `notifications` |

Returns changed shape too: where v0.1.0 returned bare markdown strings (and
`Error: ...` strings on failure), v0.2.0 returns
`{"success", "message", "data"}`. Update parsers to read `message` for display
and `data` for logic, and to branch on `success` instead of string-matching
"Error". `forgejo_status` kept its name but is now dialogic with
`output_schema`; `forgejo_shutdown` kept its name and confirm gate but refuses
dialogically. REST endpoints did not change, so dashboard and script
integrations carry over untouched.

## 22. Dashboard view tour (all twelve)

**Dashboard** is home: four KPI cards (active profile, repository count, online
runners, local LLM state), instance health, a GPU/local-LLM banner that doubles
as the onboarding cue when no provider is detected, and a Forgejo explainer for
newcomers. **Inbox** lists notification threads with unread/all filter and
search; it is the human counterpart of the `notifications` action. **Profiles**
is the CRUD form (slug, label, URL, token) with inline validation and
activate/delete per row. **Repositories** browses with search, drills into repo
detail (issues, PRs, workflow runs tabs), and reads files. **Actions Runners**
shows agent cards with online status, labels, and versions, plus per-repo run
history. **Tools** renders live capability cards from `/api/capabilities` with
read-only/mutating badges and search — the honest, always-current tool list.
**Skills** shows the companion skill plus the full triage prompt text that Chat
prepends. **Chat** streams from the backend proxy with personality, provider,
and model selectors, persisted history, and export. **Settings** shows service
status (version, uptime, tool count), repeats the profile summary, hosts the
LLM provider/model selects (persisted), and flashes the red onboarding cue when
no profiles exist. **Logs** tails the server ring buffer with level filter,
search, manual refresh, and 5-second autorefresh. **Help** condenses this guide
into four cards (getting started, MCP reference, chat/LLM, troubleshooting).
**API Docs** embeds Swagger UI for the whole REST surface. Sidebar collapses
for narrow windows; every control carries a `data-testid` the e2e suite walks
on every commit.

## 23. Failure drills (practice the unhappy paths)

Run these once after onboarding so the first real incident is not the first
time you see these screens. (1) **Dead token drill:** revoke a test profile's
token on the instance, call `forgejo_repos` action `list`, confirm the 401
error shape, then re-`add` and verify recovery. (2) **Empty registry drill:**
`remove` your only test profile, confirm `forgejo_status` reports zero
profiles and the Settings page shows the red onboarding cue, then re-add.
(3) **Provider outage drill:** stop Ollama/LM Studio, confirm Chat shows the
not-detected state and `discover` reports false, restart, rescan, confirm
green. (4) **Webhook secret drill:** POST a delivery with a wrong signature,
confirm 403 and nothing stored; POST with no secret configured, confirm 503;
then configure and confirm 200 plus a log entry. (5) **Truncation drill:**
`diff` a huge PR, confirm `data.truncated=true`, then `file_get` the two
largest files individually instead. (6) **Rate-limit drill:** page a big
instance with limit 1 rapidly until a 429 surfaces, then back off 60 seconds
and resume with limit 50 — feel the difference. Each drill ends with the
system green again; if any drill leaves red behind, that is itself the finding
to fix before relying on the setup.

## 24. Glossary for newcomers

**Forgejo** — community fork of Gitea, a lightweight self-hosted Git service
with issues, pull requests, and CI (Actions). **Codeberg.org** — the public
nonprofit Forgejo instance; configuring it differs from self-hosted only in
the URL. **PAT** — personal access token, the password-equivalent credential
used per profile. **Slug** — the short profile key (`codeberg-personal`).
**Ambient profile** — the active default used when a call omits `profile`.
**Portmanteau tool** — one MCP tool with an `action` switch covering a domain
(7 tools total here). **Dialogic return** — the `{"success","message","data"}`
envelope every tool speaks. **Triage** — the list, diff, comment, then
approved-merge loop. **Glom-on** — automatic local-LLM detection in the
dashboard. **Runner/agent** — a worker machine executing Actions jobs; **workflow
run** — one CI execution with status and conclusion. **Ref** — any branch, tag,
or commit SHA addressing code. **Squash/merge/rebase** — three ways to land a
PR: single squashed commit, merge commit, or replayed commits. **HMAC** — the
shared-secret signature proving a webhook really came from your forge.
**SSE** — server-sent events, the streaming transport Chat renders
incrementally. **MCP** — Model Context Protocol, the wire this server speaks to
Claude over stdio or HTTP.
