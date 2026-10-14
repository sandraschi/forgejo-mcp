"""
Forgejo MCP server - FastMCP 3.4.4+, portmanteau pattern.
Provides tools, resources, and prompts for Forgejo/Codeberg repository management.
"""

import asyncio
import json
import logging
import os
import threading
import time
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any, Literal

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastmcp import Context, FastMCP
from fastmcp.server.providers.skills import SkillsDirectoryProvider
from pydantic import BaseModel, Field

from .client import get_client, registry

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s %(message)s")
logger = logging.getLogger("forgejo-mcp.server")

VERSION = "0.2.0"
WEB_PORT = int(os.getenv("WEB_PORT", "11133"))
WEB_HOST = os.getenv("WEB_HOST", "127.0.0.1")
START_TIME = time.time()
REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _error_response(operation: str, error: Exception | str) -> dict:
    """Shared dialogic error helper with auto-logging (TOOL_DESIGN_STANDARDS §7.1 Pattern 3)."""
    logger.exception(f"forgejo-mcp error in {operation}: {error}")
    return {"success": False, "message": f"{operation} failed: {error}", "data": None}


# ── In-memory log ring buffer (backs GET /api/logs for the Logs page) ─────────
_log_records: deque[dict] = deque(maxlen=300)


class _RingBufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            _log_records.append(
                {
                    "time": datetime.fromtimestamp(record.created).isoformat(timespec="seconds"),
                    "level": record.levelname,
                    "logger": record.name,
                    "message": record.getMessage(),
                }
            )
        except Exception:
            self.handleError(record)


logging.getLogger().addHandler(_RingBufferHandler())


@asynccontextmanager
async def server_lifespan(mcp_instance: FastMCP):
    logger.info(f"forgejo-mcp v{VERSION} starting (FastMCP 3.4.4+)")
    yield
    logger.info("forgejo-mcp shutting down")


mcp = FastMCP(
    "forgejo-mcp",
    version=VERSION,
    lifespan=server_lifespan,
    instructions=(
        "Forgejo and Codeberg integration server (portmanteau tools, dialogic returns). "
        "Manage multiple instances via forgejo_profiles; repos/files via forgejo_repos; "
        "issues/comments via forgejo_issues; PR lifecycle via forgejo_prs; "
        "runners, workflow runs, and notifications via forgejo_actions. "
        "forgejo_status reports health; forgejo_shutdown terminates (confirm-gated)."
    ),
)

# Serve skills/forgejo-companion/SKILL.md to skill-first clients (fail-soft: never break startup).
try:
    _skills_dir = REPO_ROOT / "skills"
    if _skills_dir.is_dir():
        mcp.add_provider(SkillsDirectoryProvider(roots=[_skills_dir]))
        logger.info(f"Skills provider serving {_skills_dir}")
except Exception as e:
    logger.warning(f"Skills provider wiring skipped: {e}")


def _ok(message: str, data: Any = None) -> dict:
    """Dialogic success envelope shared by all portmanteau tools."""
    return {"success": True, "message": message, "data": data}


def _need(action: str, *fields: str) -> dict:
    """Dialogic missing-parameter response."""
    return {"success": False, "message": f"action '{action}' requires: {', '.join(fields)}.", "data": None}


_DIALOGIC_SCHEMA = {
    "type": "object",
    "properties": {"success": {"type": "boolean"}, "message": {"type": "string"}},
    "required": ["success", "message"],
}


ProfileAction = Literal["list", "add", "set_active", "remove"]


# ── Profiles Portmanteau ─────────────────────────────────────────────────────


@mcp.tool(
    app=True,
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False},
    output_schema=_DIALOGIC_SCHEMA,
)
async def forgejo_profiles(
    action: Annotated[ProfileAction, Field(description="Profile operation: list, add, set_active, or remove.")],
    name: Annotated[str | None, Field(description="Profile slug (add/set_active/remove).")] = None,
    url: Annotated[str | None, Field(description="Instance base URL (add).")] = None,
    token: Annotated[str | None, Field(description="Personal Access Token (add).")] = None,
    label: Annotated[str | None, Field(description="Display name (add).")] = None,
    ctx: Context | None = None,
) -> dict:
    """Manage Forgejo/Codeberg connection profiles (multi-instance switching).

    ## Return Format
    Dialogic dict `{"success", "message", "data"}`; list returns markdown + structured data.

    ## Examples
    ```python
    await call_tool("forgejo_profiles", {"action": "list"})
    await call_tool("forgejo_profiles", {"action": "add", "name": "local", "url": "http://localhost:3000", "token": "SECRET", "label": "Local"})
    await call_tool("forgejo_profiles", {"action": "set_active", "name": "local"})
    ```
    """
    try:
        if action == "list":
            profiles = registry.profiles
            active = registry.active_profile_name
            if not profiles:
                return _ok(
                    "No profiles configured. Use action='add' to register the first one.",
                    {"profiles": {}, "active_profile": None},
                )
            lines = ["### Configured Forgejo Profiles\n"]
            for key, prof in profiles.items():
                status = "*(Active)*" if key == active else ""
                lines.append(f"- **{prof.label}** (`{key}`): {prof.url} {status}")
            return _ok(
                "\n".join(lines),
                {
                    "profiles": {k: {"url": v.url, "label": v.label} for k, v in profiles.items()},
                    "active_profile": active,
                },
            )
        if action == "add":
            if not name or not url or not token or not label:
                return _need(action, "name", "url", "token", "label")
            registry.add_profile(name, url, token, label)
            return _ok(
                f"Profile '{label}' (`{name}`) added. Active: '{registry.active_profile_name}'.",
                {"name": name, "active_profile": registry.active_profile_name},
            )
        if action == "set_active":
            if not name:
                return _need(action, "name")
            if registry.set_active(name):
                return _ok(f"Profile '{name}' is now active.", {"active_profile": name})
            return {"success": False, "message": f"Profile '{name}' not found.", "data": None}
        if action == "remove":
            if not name:
                return _need(action, "name")
            if registry.remove_profile(name):
                return _ok(f"Profile '{name}' removed.", {"active_profile": registry.active_profile_name})
            return {"success": False, "message": f"Profile '{name}' not found.", "data": None}
        return {"success": False, "message": f"Unknown action '{action}'.", "data": None}
    except Exception as e:
        return _error_response("forgejo_profiles", e)


RepoAction = Literal["list", "create", "search", "file_get"]


# ── Repositories Portmanteau (incl. file contents) ───────────────────────────


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False},
    output_schema=_DIALOGIC_SCHEMA,
)
async def forgejo_repos(
    action: Annotated[RepoAction, Field(description="Repo operation: list, create, search, or file_get.")],
    query: Annotated[str | None, Field(description="Search query (search).")] = None,
    name: Annotated[str | None, Field(description="New repository name (create).")] = None,
    description: Annotated[str, Field(description="New repository description (create).")] = "",
    private: Annotated[bool, Field(description="Private visibility (create).")] = True,
    owner: Annotated[str | None, Field(description="Repository owner (file_get).")] = None,
    repo: Annotated[str | None, Field(description="Repository name (file_get).")] = None,
    filepath: Annotated[str, Field(description="Relative file path (file_get).")] = "",
    ref: Annotated[str, Field(description="Branch, SHA, or tag (file_get).")] = "main",
    page: Annotated[int, Field(description="Page number.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=100)] = 50,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> dict:
    """List, create, and search repositories; read raw file contents from a branch.

    ## Return Format
    Dialogic dict `{"success", "message", "data"}`; message carries markdown (or file text).

    ## Examples
    ```python
    await call_tool("forgejo_repos", {"action": "list", "limit": 20})
    await call_tool("forgejo_repos", {"action": "search", "query": "mcp"})
    await call_tool("forgejo_repos", {"action": "file_get", "owner": "me", "repo": "demo", "filepath": "README.md"})
    ```
    """
    try:
        client = get_client(profile)
        if action == "list":
            res = await client.list_repositories(page, limit)
            if not res.get("success"):
                return {"success": False, "message": f"Error: {res.get('error')}", "data": None}
            repos = res.get("data", [])
            if not repos:
                return _ok(f"No repositories found on instance: {client.profile.url}", {"repositories": []})
            lines = [f"### Repositories on {client.profile.label} (Page {page})\n"]
            for r in repos:
                priv = "🔒 Private" if r.get("private") else "🌐 Public"
                lines.append(f"- **{r.get('full_name')}** ({priv})")
                if r.get("description"):
                    lines.append(f"  *Description: {r.get('description')}*")
                lines.append(f"  *URL: {r.get('html_url')}*")
            return _ok("\n".join(lines), {"repositories": repos, "page": page})
        if action == "create":
            if not name:
                return _need(action, "name")
            res = await client.create_repository(name, description, private)
            if not res.get("success"):
                return {"success": False, "message": f"Error creating repository: {res.get('error')}", "data": None}
            data = res.get("data", {})
            return _ok(
                f"### Repository Created Successfully!\n- **Name**: {data.get('full_name')}\n"
                f"- **Visibility**: {'Private' if data.get('private') else 'Public'}\n"
                f"- **Clone URL**: {data.get('clone_url')}\n- **HTML URL**: {data.get('html_url')}",
                data,
            )
        if action == "search":
            if not query:
                return _need(action, "query")
            res = await client.search_repositories(query, page, limit)
            if not res.get("success"):
                return {"success": False, "message": f"Error searching: {res.get('error')}", "data": None}
            data = res.get("data", {})
            repos = data.get("data", [])
            if not repos:
                return _ok(f"No repositories found matching: '{query}'", {"repositories": []})
            lines = [f"### Search Results for '{query}' on {client.profile.label}\n"]
            for r in repos:
                priv = "🔒 Private" if r.get("private") else "🌐 Public"
                lines.append(f"- **{r.get('full_name')}** ({priv})")
                if r.get("description"):
                    lines.append(f"  *Description: {r.get('description')}*")
                lines.append(f"  *Stars: {r.get('stars_count')} | Forks: {r.get('forks_count')}*")
                lines.append(f"  *URL: {r.get('html_url')}*")
            return _ok("\n".join(lines), {"repositories": repos, "query": query})
        if action == "file_get":
            if not owner or not repo or not filepath:
                return _need(action, "owner", "repo", "filepath")
            res = await client.get_file_content(owner, repo, filepath, ref)
            if not res.get("success"):
                return {"success": False, "message": f"Error reading file: {res.get('error')}", "data": None}
            return _ok(res.get("data", ""), {"owner": owner, "repo": repo, "filepath": filepath, "ref": ref})
        return {"success": False, "message": f"Unknown action '{action}'.", "data": None}
    except Exception as e:
        return _error_response("forgejo_repos", e)


IssueAction = Literal["list", "create", "comment"]


# ── Issues Portmanteau ───────────────────────────────────────────────────────


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False},
    output_schema=_DIALOGIC_SCHEMA,
)
async def forgejo_issues(
    action: Annotated[IssueAction, Field(description="Issue operation: list, create, or comment.")],
    owner: Annotated[str | None, Field(description="Repository owner.")] = None,
    repo: Annotated[str | None, Field(description="Repository name.")] = None,
    state: Annotated[str, Field(description="Issue state filter: open, closed, or all (list).")] = "open",
    title: Annotated[str | None, Field(description="Issue title (create).")] = None,
    body: Annotated[str, Field(description="Markdown body (create/comment).")] = "",
    index: Annotated[int | None, Field(description="Issue/PR number (comment).", ge=1)] = None,
    page: Annotated[int, Field(description="Page number.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=50)] = 20,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> dict:
    """List and create issues; comment on issues and pull requests.

    ## Return Format
    Dialogic dict `{"success", "message", "data"}`.

    ## Examples
    ```python
    await call_tool("forgejo_issues", {"action": "list", "owner": "me", "repo": "demo"})
    await call_tool("forgejo_issues", {"action": "comment", "owner": "me", "repo": "demo", "index": 1, "body": "Thanks!"})
    ```
    """
    try:
        client = get_client(profile)
        if action == "list":
            if not owner or not repo:
                return _need(action, "owner", "repo")
            res = await client.list_issues(owner, repo, state, page, limit)
            if not res.get("success"):
                return {"success": False, "message": f"Error fetching issues: {res.get('error')}", "data": None}
            issues = res.get("data", [])
            if not issues:
                return _ok(f"No issues found in {owner}/{repo} with state '{state}'.", {"issues": []})
            lines = [f"### Issues in {owner}/{repo} ({state})\n"]
            for i in issues:
                lines.append(f"- **#{i.get('number')} {i.get('title')}** (by @{i.get('user', {}).get('username')})")
                lines.append(f"  *State: {i.get('state')} | Comments: {i.get('comments')}*")
                lines.append(f"  *URL: {i.get('html_url')}*")
            return _ok("\n".join(lines), {"issues": issues})
        if action == "create":
            if not owner or not repo or not title:
                return _need(action, "owner", "repo", "title")
            res = await client.create_issue(owner, repo, title, body)
            if not res.get("success"):
                return {"success": False, "message": f"Error creating issue: {res.get('error')}", "data": None}
            i = res.get("data", {})
            return _ok(
                f"### Issue Created Successfully!\n- **Issue**: #{i.get('number')} {i.get('title')}\n"
                f"- **URL**: {i.get('html_url')}",
                i,
            )
        if action == "comment":
            if not owner or not repo or not index or not body:
                return _need(action, "owner", "repo", "index", "body")
            res = await client.create_issue_comment(owner, repo, index, body)
            if not res.get("success"):
                return {"success": False, "message": f"Error adding comment: {res.get('error')}", "data": None}
            c = res.get("data", {})
            return _ok(f"Comment posted successfully on #{index}. URL: {c.get('html_url')}", c)
        return {"success": False, "message": f"Unknown action '{action}'.", "data": None}
    except Exception as e:
        return _error_response("forgejo_issues", e)


PRAction = Literal["list", "create", "merge", "diff"]


# ── Pull Requests Portmanteau ────────────────────────────────────────────────


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False},
    output_schema=_DIALOGIC_SCHEMA,
)
async def forgejo_prs(
    action: Annotated[PRAction, Field(description="PR operation: list, create, merge, or diff.")],
    owner: Annotated[str | None, Field(description="Repository owner.")] = None,
    repo: Annotated[str | None, Field(description="Repository name.")] = None,
    state: Annotated[str, Field(description="PR state filter: open, closed, or all (list).")] = "open",
    title: Annotated[str | None, Field(description="PR title (create).")] = None,
    head: Annotated[str | None, Field(description="Branch with the changes (create).")] = None,
    base: Annotated[str | None, Field(description="Target branch (create).")] = None,
    body: Annotated[str, Field(description="Markdown description (create).")] = "",
    index: Annotated[int | None, Field(description="PR number (merge/diff).", ge=1)] = None,
    style: Annotated[str, Field(description="Merge strategy: merge, rebase, or squash (merge).")] = "merge",
    page: Annotated[int, Field(description="Page number.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=50)] = 20,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> dict:
    """List, open, merge, and diff pull requests (merge closes the PR with the given strategy).

    ## Return Format
    Dialogic dict `{"success", "message", "data"}`.

    ## Examples
    ```python
    await call_tool("forgejo_prs", {"action": "list", "owner": "me", "repo": "demo"})
    await call_tool("forgejo_prs", {"action": "diff", "owner": "me", "repo": "demo", "index": 3})
    await call_tool("forgejo_prs", {"action": "merge", "owner": "me", "repo": "demo", "index": 3, "style": "squash"})
    ```
    """
    try:
        client = get_client(profile)
        if action == "list":
            if not owner or not repo:
                return _need(action, "owner", "repo")
            res = await client.list_pull_requests(owner, repo, state, page, limit)
            if not res.get("success"):
                return {"success": False, "message": f"Error fetching PRs: {res.get('error')}", "data": None}
            prs = res.get("data", [])
            if not prs:
                return _ok(f"No pull requests found in {owner}/{repo} with state '{state}'.", {"prs": []})
            lines = [f"### Pull Requests in {owner}/{repo} ({state})\n"]
            for p in prs:
                lines.append(f"- **#{p.get('number')} {p.get('title')}** (by @{p.get('user', {}).get('username')})")
                lines.append(f"  *Branch: {p.get('head', {}).get('ref')} ➔ {p.get('base', {}).get('ref')}*")
                lines.append(f"  *State: {p.get('state')} | Mergeable: {p.get('mergeable')}*")
                lines.append(f"  *URL: {p.get('html_url')}*")
            return _ok("\n".join(lines), {"prs": prs})
        if action == "create":
            if not owner or not repo or not title or not head or not base:
                return _need(action, "owner", "repo", "title", "head", "base")
            res = await client.create_pull_request(owner, repo, title, head, base, body)
            if not res.get("success"):
                return {"success": False, "message": f"Error creating PR: {res.get('error')}", "data": None}
            p = res.get("data", {})
            return _ok(
                f"### Pull Request Opened Successfully!\n- **PR**: #{p.get('number')} {p.get('title')}\n"
                f"- **Flow**: {head} ➔ {base}\n- **URL**: {p.get('html_url')}",
                p,
            )
        if action == "merge":
            if not owner or not repo or not index:
                return _need(action, "owner", "repo", "index")
            res = await client.merge_pull_request(owner, repo, index, style)
            if not res.get("success"):
                return {"success": False, "message": f"Error merging PR: {res.get('error')}", "data": None}
            return _ok(
                f"Pull Request #{index} merged successfully using '{style}' strategy!",
                {"owner": owner, "repo": repo, "index": index, "style": style},
            )
        if action == "diff":
            if not owner or not repo or not index:
                return _need(action, "owner", "repo", "index")
            res = await client.get_pull_request_diff(owner, repo, index)
            if not res.get("success"):
                return {"success": False, "message": f"Error getting diff: {res.get('error')}", "data": None}
            diff_text = res.get("data", "")
            truncated = len(diff_text) > 40000
            if truncated:
                diff_text = diff_text[:40000] + "\n\n...[Diff truncated due to size limit]..."
            return _ok(
                f"```diff\n{diff_text}\n```", {"owner": owner, "repo": repo, "index": index, "truncated": truncated}
            )
        return {"success": False, "message": f"Unknown action '{action}'.", "data": None}
    except Exception as e:
        return _error_response("forgejo_prs", e)


ActionsAction = Literal["runners", "workflow_runs", "notifications"]


# ── Actions, Runners & Notifications Portmanteau ─────────────────────────────


@mcp.tool(
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    output_schema=_DIALOGIC_SCHEMA,
)
async def forgejo_actions(
    action: Annotated[ActionsAction, Field(description="Ops operation: runners, workflow_runs, or notifications.")],
    owner: Annotated[str | None, Field(description="Repo owner (repo-scoped runners, workflow_runs).")] = None,
    repo: Annotated[str | None, Field(description="Repo name (repo-scoped runners, workflow_runs).")] = None,
    unread_only: Annotated[bool, Field(description="Only unread threads (notifications).")] = True,
    page: Annotated[int, Field(description="Page number.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=50)] = 20,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> dict:
    """Inspect Actions runners and workflow runs; read notification threads (Inbox feed).

    ## Return Format
    Dialogic dict `{"success", "message", "data"}`.

    ## Examples
    ```python
    await call_tool("forgejo_actions", {"action": "runners"})
    await call_tool("forgejo_actions", {"action": "workflow_runs", "owner": "me", "repo": "demo"})
    await call_tool("forgejo_actions", {"action": "notifications"})
    ```
    """
    try:
        client = get_client(profile)
        if action == "runners":
            res = await client.list_runners(owner, repo)
            if not res.get("success"):
                return {"success": False, "message": f"Error listing runners: {res.get('error')}", "data": None}
            runners = res.get("data", [])
            if not runners:
                return _ok("No connected runners found.", {"runners": []})
            lines = [f"### Connected Actions Runners on {client.profile.label}\n"]
            for r in runners:
                status = "🟢 Online" if r.get("status") == "online" else "🔴 Offline"
                lines.append(f"- **{r.get('name')}** (ID: {r.get('id')}) | {status}")
                lines.append(f"  *Agent OS: {r.get('agent_labels')} | Version: {r.get('version')}*")
            return _ok("\n".join(lines), {"runners": runners})
        if action == "workflow_runs":
            if not owner or not repo:
                return _need(action, "owner", "repo")
            res = await client.list_workflows(owner, repo, page, limit)
            if not res.get("success"):
                return {"success": False, "message": f"Error listing workflows: {res.get('error')}", "data": None}
            data = res.get("data", {})
            runs = data.get("action_runs", [])
            if not runs:
                return _ok(f"No workflow runs found in {owner}/{repo}.", {"runs": []})
            lines = [f"### Workflow Runs in {owner}/{repo} (Page {page})\n"]
            for r in runs:
                status = r.get("status", "unknown")
                conclusion = r.get("conclusion", "")
                badge = "🟢" if conclusion == "success" else "🔴" if conclusion == "failure" else "🟡"
                lines.append(
                    f"- {badge} **#{r.get('run_number')} - {r.get('title', 'Workflow Run')}** "
                    f"({status}/{conclusion or 'running'})"
                )
                lines.append(
                    f"  *Trigger: {r.get('event')} by @{r.get('actor', {}).get('username')} | "
                    f"Branch: {r.get('head_branch')}*"
                )
            return _ok("\n".join(lines), {"runs": runs})
        if action == "notifications":
            res = await client.list_notifications(unread_only=unread_only, page=page, limit=limit)
            if not res.get("success"):
                return {"success": False, "message": f"Error listing notifications: {res.get('error')}", "data": None}
            threads = res.get("data", [])
            if not threads:
                return _ok("No notification threads found.", {"notifications": []})
            lines = ["### Notification Threads\n"]
            for t in threads:
                subject = t.get("subject", {})
                unread = "🔔 Unread" if t.get("unread") else "✓ Read"
                lines.append(f"- {unread} **{subject.get('type', '?')}: {subject.get('title', '(no title)')}**")
                lines.append(f"  *Updated: {t.get('updated_at', '?')}*")
            return _ok("\n".join(lines), {"notifications": threads})
        return {"success": False, "message": f"Unknown action '{action}'.", "data": None}
    except Exception as e:
        return _error_response("forgejo_actions", e)


@mcp.tool(
    app=True,
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "message": {"type": "string"},
            "data": {"type": "object"},
        },
        "required": ["success", "message"],
    },
)
async def forgejo_status(ctx: Context | None = None) -> dict:
    """Report forgejo-mcp health: version, uptime, profiles, and tool inventory.

    ## Return Format
    Dialogic dict: `{"success": True, "message": <one-line summary>, "data": {...}}`

    ## Examples
    ```python
    await call_tool("forgejo_status")
    ```
    """
    try:
        data = {
            "service": "forgejo-mcp",
            "version": VERSION,
            "uptime_seconds": round(time.time() - START_TIME, 1),
            "transport": os.getenv("MCP_TRANSPORT", "stdio"),
            "backend_port": WEB_PORT,
            "profiles_configured": len(registry.profiles),
            "active_profile": registry.active_profile_name,
            "tool_count": 7,
        }
        active = registry.active_profile_name or "none"
        return {
            "success": True,
            "message": f"forgejo-mcp v{VERSION} healthy, {len(registry.profiles)} profile(s), active: {active}.",
            "data": data,
        }
    except Exception as e:
        return _error_response("forgejo_status", e)


@mcp.resource("forgejo://profiles")
async def forgejo_profiles_resource() -> str:
    """Configured Forgejo/Codeberg profiles (URLs and labels; tokens never exposed).

    ## Return Format
    JSON string: `{"active_profile": <name|null>, "profiles": {name: {url, label}}}`
    """
    payload = {
        "active_profile": registry.active_profile_name,
        "profiles": {name: {"url": p.url, "label": p.label} for name, p in registry.profiles.items()},
    }
    return json.dumps(payload, indent=2)


@mcp.prompt("forgejo-triage")
def forgejo_triage_prompt() -> str:
    """Triage template for Forgejo/Codeberg issues and PRs.

    ## Return Format
    System-prompt string composing profile context with the triage workflow.
    """
    return (
        "You are triaging Forgejo/Codeberg work via forgejo-mcp. "
        "1) Call forgejo_status (or forgejo_profiles action='list') to confirm the active profile. "
        "2) Use forgejo_issues action='list' / forgejo_prs action='list' for the target repo. "
        "3) For a PR, read forgejo_prs action='diff' before commenting. "
        "4) Prefer read-only checks (list/search/diff/runners) before create/merge/comment. "
        "Pass `profile` explicitly when working outside the active profile."
    )


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": True, "idempotentHint": False, "openWorldHint": False},
    output_schema=_DIALOGIC_SCHEMA,
)
async def forgejo_shutdown(
    confirmed: Annotated[bool, Field(description="Pass true to actually terminate the server.")] = False,
    ctx: Context | None = None,
) -> dict:
    """Shut down the forgejo-mcp server process.

    ## Return Format
    Dialogic dict; unconfirmed calls refuse with success=false (nothing terminates).

    ## Examples
    ```python
    await call_tool("forgejo_shutdown", {"confirmed": True})
    ```
    """
    if not confirmed:
        return {
            "success": False,
            "message": "Refusing: pass confirmed=true to terminate the forgejo-mcp server process.",
            "data": None,
        }
    import os as _os
    import signal as _signal

    _os.kill(_os.getpid(), _signal.SIGTERM)
    return {"success": True, "message": "forgejo-mcp server terminating.", "data": None}


# Serve FastAPI web app in a background thread for companion dashboard
web_app = FastAPI(title="Forgejo MCP Companion WebApp", version=VERSION)

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:11132",
        "http://localhost:11132",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.1[6-9]\.\d+\.\d+|172\.2\d\.\d+\.\d+|172\.3[01]\.\d+\.\d+|[a-z0-9-]+\.ts\.net|goliath)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@web_app.get("/health")
async def health_check():
    return {"status": "ok", "version": VERSION, "active_profile": registry.active_profile_name}


@web_app.get("/api/status")
async def api_status():
    """Richer status diagnostics for the fleet launcher and dashboard health dot."""
    return {
        "status": "ok",
        "service": "forgejo-mcp",
        "version": VERSION,
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "active_profile": registry.active_profile_name,
        "profiles_configured": len(registry.profiles),
        "tool_count": 7,
    }


@web_app.get("/api/skills")
async def api_skills():
    """Skill inventory for skill-first Chat clients (includes prompt text)."""
    return {
        "skills": [
            {
                "name": "forgejo-companion",
                "uri": "skill://forgejo-companion",
                "description": "Manage Forgejo/Codeberg instances (profiles, repos, issues, PRs, runners).",
            }
        ],
        "prompt": "forgejo-triage",
        "prompt_text": forgejo_triage_prompt(),
    }


@web_app.get("/api/logs")
async def api_logs(level: str = "INFO", search: str = "", limit: int = 100):
    """Server log ring buffer (newest first) for the Logs page."""
    levels = logging.getLevelNamesMapping()
    threshold = levels.get(level.upper(), logging.INFO)
    query = search.lower()
    out = [
        r
        for r in reversed(_log_records)
        if levels.get(r["level"], 0) >= threshold and (not query or query in (r["message"] + r["logger"]).lower())
    ]
    return {"count": len(out), "logs": out[: max(1, min(limit, 300))]}


@web_app.get("/api/notifications")
async def api_notifications(profile: str | None = None, unread_only: bool = True, page: int = 1, limit: int = 20):
    """Notification threads for the Inbox page (proxied through the Forgejo client)."""
    try:
        client = get_client(profile)
        return await client.list_notifications(unread_only=unread_only, page=page, limit=limit)
    except Exception as e:
        return {"success": False, "error": str(e)}


class ChatMessage(BaseModel):
    role: str = "user"
    content: str = ""


class ChatStreamRequest(BaseModel):
    provider: str = "ollama"
    model: str = ""
    messages: list[ChatMessage] = []
    system: str = ""


async def _ollama_chat_events(url: str, model: str, messages: list[dict]):
    """Yield {"delta": text} events from Ollama's /api/chat NDJSON stream."""
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream(
            "POST", f"{url}/api/chat", json={"model": model, "messages": messages, "stream": True}
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                except ValueError:
                    continue
                if "error" in chunk:
                    yield {"error": str(chunk["error"])}
                    return
                delta = chunk.get("message", {}).get("content", "")
                if delta:
                    yield {"delta": delta}
                if chunk.get("done"):
                    return


async def _lmstudio_chat_events(url: str, model: str, messages: list[dict]):
    """Yield {"delta": text} events from an OpenAI-compatible /v1/chat/completions SSE stream."""
    payload = {"model": model, "messages": messages, "stream": True}
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream("POST", f"{url}/v1/chat/completions", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    return
                try:
                    chunk = json.loads(data)
                except ValueError:
                    continue
                delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if delta:
                    yield {"delta": delta}


_LLM_PROVIDERS = (
    {"id": "ollama", "name": "Ollama", "url": "http://127.0.0.1:11434", "tags_path": "/api/tags"},
    {"id": "lmstudio", "name": "LM Studio", "url": "http://127.0.0.1:1234", "tags_path": "/v1/models"},
)


async def _probe_json(url: str, timeout: float = 1.5) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url)
            return resp.json() if resp.status_code == 200 else None
    except Exception:
        return None


def _extract_models(provider_id: str, payload: dict | None) -> list[str]:
    if not payload:
        return []
    if provider_id == "ollama":
        return [m.get("name", "") for m in payload.get("models", []) if m.get("name")]
    return [m.get("id", "") for m in payload.get("data", []) if m.get("id")]


@web_app.get("/api/llm/discover")
async def api_llm_discover():
    """Probe local LLM providers (Ollama :11434, LM Studio :1234) for the Chat/Settings pages."""
    providers = []
    for p in _LLM_PROVIDERS:
        payload = await _probe_json(p["url"] + p["tags_path"])
        providers.append(
            {
                "id": p["id"],
                "name": p["name"],
                "url": p["url"],
                "detected": payload is not None,
                "models": _extract_models(p["id"], payload),
            }
        )
    return {"providers": providers}


@web_app.get("/api/llm/models")
async def api_llm_models(provider: str = "ollama"):
    """Model list for one provider (live when reachable, empty with detected=false otherwise)."""
    disc = await api_llm_discover()
    for p in disc["providers"]:
        if p["id"] == provider.lower():
            return {"provider": p["id"], "detected": p["detected"], "models": p["models"]}
    raise HTTPException(status_code=404, detail=f"Unknown provider '{provider}'. Expected ollama|lmstudio.")


@web_app.post("/api/llm/chat/stream")
async def api_llm_chat_stream(req: ChatStreamRequest):
    """Backend chat proxy (SSE `data: {"delta"}` chunks + `data: [DONE]`). Keys never leave the server."""
    provider = req.provider.lower()
    base = "http://127.0.0.1:1234" if provider == "lmstudio" else "http://127.0.0.1:11434"
    gen = _lmstudio_chat_events if provider == "lmstudio" else _ollama_chat_events
    if provider not in ("ollama", "lmstudio"):
        raise HTTPException(status_code=404, detail=f"Unknown provider '{req.provider}'.")

    async def _stream():
        if not req.model:
            yield 'data: {"error": "No model selected."}\n\n'
            yield "data: [DONE]\n\n"
            return
        messages = ([{"role": "system", "content": req.system}] if req.system else []) + [
            m.model_dump() for m in req.messages
        ]
        try:
            async for event in gen(base, req.model, messages):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


@web_app.post("/api/shutdown")
async def api_shutdown():
    """Orderly exit for the fleet launcher: respond 200 now, exit ~500 ms later."""
    threading.Timer(0.5, lambda: os._exit(0)).start()
    return {"status": "shutting_down", "message": "forgejo-mcp backend exiting in ~500 ms."}


@web_app.get("/api/capabilities")
async def api_capabilities():
    """Standard fleet shape for webapp discovery (names + live descriptions for the Tools page)."""
    tool_names = sorted(
        [
            "forgejo_profiles",
            "forgejo_repos",
            "forgejo_issues",
            "forgejo_prs",
            "forgejo_actions",
            "forgejo_status",
            "forgejo_shutdown",
        ]
    )
    details = []
    try:
        for tool in await mcp.list_tools():
            annotations = tool.annotations
            details.append(
                {
                    "name": tool.name,
                    "description": (tool.description or "").split("\n")[0],
                    "read_only": bool(getattr(annotations, "readOnlyHint", False)),
                }
            )
    except Exception as e:
        logger.warning(f"capabilities tool listing failed: {e}")
    return {
        "service": "forgejo-mcp",
        "version": VERSION,
        "status": "ok",
        "tool_count": len(tool_names),
        "tools": tool_names,
        "tool_details": sorted(details, key=lambda t: t["name"]),
        "endpoints": [
            "/health",
            "/api/status",
            "/api/capabilities",
            "/api/skills",
            "/api/shutdown",
            "/api/logs",
            "/api/notifications",
            "/api/llm/discover",
            "/api/llm/models",
            "/api/llm/chat/stream",
            "/mcp",
        ],
        "transports": ["http", "stdio"],
    }


# Import web routing endpoints (will create in web.py next)
from .web import router as web_router
from .web import setup_webapp

web_app.include_router(web_router)
setup_webapp(web_app)


def main():

    # Check transport mode
    transport = os.getenv("MCP_TRANSPORT", "stdio").lower()

    # Start web app in background thread to serve REST and dashboard
    web_thread = threading.Thread(
        target=lambda: uvicorn.run(web_app, host=WEB_HOST, port=WEB_PORT, log_level="warning"), daemon=True
    )
    web_thread.start()
    logger.info(f"FastAPI Companion WebApp running on http://{WEB_HOST}:{WEB_PORT}")

    if transport == "http":
        logger.info("Running MCP Server in HTTP transport mode (blocking)")
        mcp.run()
    else:
        logger.info("Running MCP Server in STDIO transport mode (blocking)")
        # Block on stdio transport async loop
        try:
            asyncio.run(mcp.run_stdio_async())
        except KeyboardInterrupt:
            logger.info("Shutting down via keyboard interrupt")


if __name__ == "__main__":
    main()
