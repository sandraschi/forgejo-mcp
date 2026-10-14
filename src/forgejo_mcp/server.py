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
from contextlib import asynccontextmanager
from typing import Annotated

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import Context, FastMCP
from pydantic import Field

from .client import get_client, registry

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s %(message)s")
logger = logging.getLogger("forgejo-mcp.server")

VERSION = "0.1.0"
WEB_PORT = int(os.getenv("WEB_PORT", "11133"))
WEB_HOST = os.getenv("WEB_HOST", "127.0.0.1")
START_TIME = time.time()


def _error_response(operation: str, error: Exception | str) -> dict:
    """Shared dialogic error helper with auto-logging (TOOL_DESIGN_STANDARDS §7.1 Pattern 3)."""
    logger.exception(f"forgejo-mcp error in {operation}: {error}")
    return {"success": False, "message": f"{operation} failed: {error}", "data": None}


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
        "Forgejo and Codeberg integration server. "
        "Allows managing multiple instances (local and remote Codeberg) with multi-profile configurations. "
        "Exposes tools to list, create, and search repositories, manage issues/comments, handle PR lifecycle, "
        "and monitor Actions runners and workflow runs."
    ),
)


# ── Profiles Management Tools ──────────────────────────────────────────────────


@mcp.tool(
    app=True,
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def forgejo_profile_list(ctx: Context | None = None) -> str:
    """List all configured connection profiles for Forgejo/Codeberg.

    Returns a markdown list of profiles and shows which is currently active.

    ## Return Format
    Markdown string (profile list, or a setup hint when none exist)

    ## Examples
    ```python
    await call_tool("forgejo_profile_list")
    ```
    """
    profiles = registry.profiles
    active = registry.active_profile_name

    if not profiles:
        return "No profiles configured. Use `forgejo_profile_add` to add your first profile."

    lines = ["### Configured Forgejo Profiles\n"]
    for name, p in profiles.items():
        status = "*(Active)*" if name == active else ""
        lines.append(f"- **{p.label}** (`{name}`): {p.url} {status}")

    return "\n".join(lines)


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False}
)
async def forgejo_profile_add(
    name: Annotated[str, Field(description="Unique identifier slug (e.g. 'codeberg-personal').")],
    url: Annotated[str, Field(description="Base URL of the instance (e.g. 'https://codeberg.org').")],
    token: Annotated[str, Field(description="Personal Access Token generated on the instance.")],
    label: Annotated[str, Field(description="User-friendly display name.")],
    ctx: Context | None = None,
) -> str:
    """Add a new connection profile for a Forgejo/Codeberg instance.

    ## Return Format
    Confirmation string (or `Error adding profile: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_profile_add", {"name": "local-admin", "url": "http://localhost:3000", "token": "SECRET", "label": "Local"})
    ```
    """
    try:
        registry.add_profile(name, url, token, label)
        return f"Successfully added profile '{label}' (`{name}`). Current active: '{registry.active_profile_name}'"
    except Exception as e:
        logger.exception(f"forgejo-mcp error in forgejo_profile_add: {e}")
        return f"Error adding profile: {e}"


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False}
)
async def forgejo_profile_set_active(
    name: Annotated[str, Field(description="Name of the profile to activate.")],
    ctx: Context | None = None,
) -> str:
    """Set a profile as the active default for subsequent actions.

    ## Return Format
    Confirmation string

    ## Examples
    ```python
    await call_tool("forgejo_profile_set_active", {"name": "local-admin"})
    ```
    """
    if registry.set_active(name):
        return f"Profile '{name}' is now active."
    return f"Failed to set profile '{name}' active. Check if it exists."


# ── Repository Tools ──────────────────────────────────────────────────────────


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False})
async def forgejo_repo_list(
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    page: Annotated[int, Field(description="Page number for pagination.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=100)] = 50,
    ctx: Context | None = None,
) -> str:
    """List repositories that the user has access to for a profile.

    ## Return Format
    Markdown string (repo list, or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_repo_list", {"limit": 20})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.list_repositories(page, limit)
        if not res.get("success"):
            return f"Error: {res.get('error')}"

        repos = res.get("data", [])
        if not repos:
            return f"No repositories found on instance: {client.profile.url}"

        lines = [f"### Repositories on {client.profile.label} (Page {page})\n"]
        for r in repos:
            priv = "🔒 Private" if r.get("private") else "🌐 Public"
            lines.append(f"- **{r.get('full_name')}** ({priv})")
            if r.get("description"):
                lines.append(f"  *Description: {r.get('description')}*")
            lines.append(f"  *URL: {r.get('html_url')}*")
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False}
)
async def forgejo_repo_create(
    name: Annotated[str, Field(description="Repository name.")],
    description: Annotated[str, Field(description="Repository description.")] = "",
    private: Annotated[bool, Field(description="Whether the repository should be private.")] = True,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Create a new repository under the user account.

    ## Return Format
    Markdown string (created repo summary, or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_repo_create", {"name": "demo", "private": True})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.create_repository(name, description, private)
        if not res.get("success"):
            return f"Error creating repository: {res.get('error')}"

        data = res.get("data", {})
        return (
            f"### Repository Created Successfully!\n"
            f"- **Name**: {data.get('full_name')}\n"
            f"- **Visibility**: {'Private' if data.get('private') else 'Public'}\n"
            f"- **Clone URL**: {data.get('clone_url')}\n"
            f"- **HTML URL**: {data.get('html_url')}"
        )
    except Exception as e:
        return f"Error: {e}"


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False})
async def forgejo_repo_search(
    query: Annotated[str, Field(description="Search query string.")],
    page: Annotated[int, Field(description="Page number for pagination.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=50)] = 20,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Search for repositories on the selected instance.

    ## Return Format
    Markdown string (search results, or `Error searching: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_repo_search", {"query": "mcp"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.search_repositories(query, page, limit)
        if not res.get("success"):
            return f"Error searching: {res.get('error')}"

        data = res.get("data", {})
        repos = data.get("data", [])
        if not repos:
            return f"No repositories found matching: '{query}'"

        lines = [f"### Search Results for '{query}' on {client.profile.label}\n"]
        for r in repos:
            priv = "🔒 Private" if r.get("private") else "🌐 Public"
            lines.append(f"- **{r.get('full_name')}** ({priv})")
            if r.get("description"):
                lines.append(f"  *Description: {r.get('description')}*")
            lines.append(f"  *Stars: {r.get('stars_count')} | Forks: {r.get('forks_count')}*")
            lines.append(f"  *URL: {r.get('html_url')}*")
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {e}"


# ── Issue Management Tools ────────────────────────────────────────────────────


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False})
async def forgejo_issue_list(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    state: Annotated[str, Field(description="Issue state filter: open, closed, or all.")] = "open",
    page: Annotated[int, Field(description="Page number for pagination.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=50)] = 20,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """List issues for a specific repository.

    ## Return Format
    Markdown string (issue list, or `Error fetching issues: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_issue_list", {"owner": "me", "repo": "demo"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.list_issues(owner, repo, state, page, limit)
        if not res.get("success"):
            return f"Error fetching issues: {res.get('error')}"

        issues = res.get("data", [])
        if not issues:
            return f"No issues found in {owner}/{repo} with state '{state}'."

        lines = [f"### Issues in {owner}/{repo} ({state})\n"]
        for i in issues:
            lines.append(f"- **#{i.get('number')} {i.get('title')}** (by @{i.get('user', {}).get('username')})")
            lines.append(f"  *State: {i.get('state')} | Comments: {i.get('comments')}*")
            lines.append(f"  *URL: {i.get('html_url')}*")
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False}
)
async def forgejo_issue_create(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    title: Annotated[str, Field(description="Issue title.")],
    body: Annotated[str, Field(description="Markdown body of the issue.")] = "",
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Create a new issue in a repository.

    ## Return Format
    Markdown string (created issue summary, or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_issue_create", {"owner": "me", "repo": "demo", "title": "Bug"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.create_issue(owner, repo, title, body)
        if not res.get("success"):
            return f"Error creating issue: {res.get('error')}"

        i = res.get("data", {})
        return (
            f"### Issue Created Successfully!\n"
            f"- **Issue**: #{i.get('number')} {i.get('title')}\n"
            f"- **URL**: {i.get('html_url')}"
        )
    except Exception as e:
        return f"Error: {e}"


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False}
)
async def forgejo_issue_comment(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    index: Annotated[int, Field(description="Issue/PR number.", ge=1)],
    body: Annotated[str, Field(description="Markdown comment body.")],
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Comment on an existing issue or pull request.

    ## Return Format
    Confirmation string (or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_issue_comment", {"owner": "me", "repo": "demo", "index": 1, "body": "Thanks!"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.create_issue_comment(owner, repo, index, body)
        if not res.get("success"):
            return f"Error adding comment: {res.get('error')}"

        c = res.get("data", {})
        return f"Comment posted successfully on #{index}. URL: {c.get('html_url')}"
    except Exception as e:
        return f"Error: {e}"


# ── Pull Request Tools ────────────────────────────────────────────────────────


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False})
async def forgejo_pr_list(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    state: Annotated[str, Field(description="PR state filter: open, closed, or all.")] = "open",
    page: Annotated[int, Field(description="Page number for pagination.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=50)] = 20,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """List pull requests in a repository.

    ## Return Format
    Markdown string (PR list, or `Error fetching PRs: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_pr_list", {"owner": "me", "repo": "demo"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.list_pull_requests(owner, repo, state, page, limit)
        if not res.get("success"):
            return f"Error fetching PRs: {res.get('error')}"

        prs = res.get("data", [])
        if not prs:
            return f"No pull requests found in {owner}/{repo} with state '{state}'."

        lines = [f"### Pull Requests in {owner}/{repo} ({state})\n"]
        for p in prs:
            lines.append(f"- **#{p.get('number')} {p.get('title')}** (by @{p.get('user', {}).get('username')})")
            lines.append(f"  *Branch: {p.get('head', {}).get('ref')} ➔ {p.get('base', {}).get('ref')}*")
            lines.append(f"  *State: {p.get('state')} | Mergeable: {p.get('mergeable')}*")
            lines.append(f"  *URL: {p.get('html_url')}*")
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False}
)
async def forgejo_pr_create(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    title: Annotated[str, Field(description="PR title.")],
    head: Annotated[str, Field(description="Branch with the changes (e.g. 'feature-branch').")],
    base: Annotated[str, Field(description="Target branch to merge into (e.g. 'main').")],
    body: Annotated[str, Field(description="Markdown description of the PR changes.")] = "",
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Open a new pull request.

    ## Return Format
    Markdown string (opened PR summary, or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_pr_create", {"owner": "me", "repo": "demo", "title": "Feat", "head": "feat", "base": "main"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.create_pull_request(owner, repo, title, head, base, body)
        if not res.get("success"):
            return f"Error creating PR: {res.get('error')}"

        p = res.get("data", {})
        return (
            f"### Pull Request Opened Successfully!\n"
            f"- **PR**: #{p.get('number')} {p.get('title')}\n"
            f"- **Flow**: {head} ➔ {base}\n"
            f"- **URL**: {p.get('html_url')}"
        )
    except Exception as e:
        return f"Error: {e}"


@mcp.tool(
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False}
)
async def forgejo_pr_merge(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    index: Annotated[int, Field(description="PR index number.", ge=1)],
    style: Annotated[str, Field(description="Merge strategy: merge, rebase, or squash.")] = "merge",
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Merge a pull request.

    ## Return Format
    Confirmation string (or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_pr_merge", {"owner": "me", "repo": "demo", "index": 3, "style": "squash"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.merge_pull_request(owner, repo, index, style)
        if not res.get("success"):
            return f"Error merging PR: {res.get('error')}"

        return f"Pull Request #{index} merged successfully using '{style}' strategy!"
    except Exception as e:
        return f"Error: {e}"


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False})
async def forgejo_pr_diff(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    index: Annotated[int, Field(description="PR number.", ge=1)],
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Get the raw diff format of a Pull Request to review changes.

    ## Return Format
    Diff text in a ```diff block (or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_pr_diff", {"owner": "me", "repo": "demo", "index": 3})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.get_pull_request_diff(owner, repo, index)
        if not res.get("success"):
            return f"Error getting diff: {res.get('error')}"

        diff_text = res.get("data", "")
        # Limit size for safety
        if len(diff_text) > 40000:
            diff_text = diff_text[:40000] + "\n\n...[Diff truncated due to size limit]..."
        return f"```diff\n{diff_text}\n```"
    except Exception as e:
        return f"Error: {e}"


# ── Actions & Runner Tools ────────────────────────────────────────────────────


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False})
async def forgejo_runner_list(
    owner: Annotated[str | None, Field(description="Repo owner for repo-scoped runners.")] = None,
    repo: Annotated[str | None, Field(description="Repo name for repo-scoped runners.")] = None,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """List connected Actions runners (requires admin for global, or repo parameters for repo runners).

    ## Return Format
    Markdown string (runner list, or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_runner_list")
    ```
    """
    try:
        client = get_client(profile)
        res = await client.list_runners(owner, repo)
        if not res.get("success"):
            return f"Error listing runners: {res.get('error')}"

        runners = res.get("data", [])
        if not runners:
            return "No connected runners found."

        lines = [f"### Connected Actions Runners on {client.profile.label}\n"]
        for r in runners:
            status = "🟢 Online" if r.get("status") == "online" else "🔴 Offline"
            lines.append(f"- **{r.get('name')}** (ID: {r.get('id')}) | {status}")
            lines.append(f"  *Agent OS: {r.get('agent_labels')} | Version: {r.get('version')}*")
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False})
async def forgejo_workflow_runs(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    page: Annotated[int, Field(description="Page number for pagination.", ge=1)] = 1,
    limit: Annotated[int, Field(description="Items per page.", ge=1, le=50)] = 20,
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Get active/historical Forgejo Actions runs for a repository.

    ## Return Format
    Markdown string (workflow runs, or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_workflow_runs", {"owner": "me", "repo": "demo"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.list_workflows(owner, repo, page, limit)
        if not res.get("success"):
            return f"Error listing workflows: {res.get('error')}"

        data = res.get("data", {})
        runs = data.get("action_runs", [])
        if not runs:
            return f"No workflow runs found in {owner}/{repo}."

        lines = [f"### Workflow Runs in {owner}/{repo} (Page {page})\n"]
        for r in runs:
            # Gitea/Forgejo return values might slightly vary; handle safely
            status = r.get("status", "unknown")
            conclusion = r.get("conclusion", "")
            badge = "🟢" if conclusion == "success" else "🔴" if conclusion == "failure" else "🟡"
            lines.append(
                f"- {badge} **#{r.get('run_number')} - {r.get('title', 'Workflow Run')}** "
                f"({status}/{conclusion or 'running'})"
            )
            lines.append(
                f"  *Trigger: {r.get('event')} by @{r.get('actor', {}).get('username')} | Branch: {r.get('head_branch')}*"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {e}"


# ── File Contents Tools ────────────────────────────────────────────────────────


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False})
async def forgejo_file_get(
    owner: Annotated[str, Field(description="Repository owner.")],
    repo: Annotated[str, Field(description="Repository name.")],
    filepath: Annotated[str, Field(description="Relative file path (e.g. 'README.md').")],
    ref: Annotated[str, Field(description="Branch, commit SHA, or tag (default: 'main').")] = "main",
    profile: Annotated[str | None, Field(description="Profile to use (default: active).")] = None,
    ctx: Context | None = None,
) -> str:
    """Read contents of a file directly from a repository branch.

    ## Return Format
    Raw file contents string (or `Error: ...` string)

    ## Examples
    ```python
    await call_tool("forgejo_file_get", {"owner": "me", "repo": "demo", "filepath": "README.md"})
    ```
    """
    try:
        client = get_client(profile)
        res = await client.get_file_content(owner, repo, filepath, ref)
        if not res.get("success"):
            return f"Error reading file: {res.get('error')}"

        return res.get("data", "")
    except Exception as e:
        return f"Error: {e}"


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
            "tool_count": 18,
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
        "1) Call forgejo_status (or forgejo_profile_list) to confirm the active profile. "
        "2) Use forgejo_issue_list / forgejo_pr_list for the target repo. "
        "3) For a PR, read forgejo_pr_diff before commenting. "
        "4) Prefer read-only checks (list/search/diff) before create/merge/comment. "
        "Pass `profile` explicitly when working outside the active profile."
    )


@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "idempotentHint": False, "openWorldHint": False})
async def forgejo_shutdown(
    confirmed: Annotated[bool, Field(description="Pass true to actually terminate the server.")] = False,
    ctx: Context | None = None,
) -> str:
    """Shut down the forgejo-mcp server process.

    ## Return Format
    Confirmation prompt or termination notice string

    ## Examples
    ```python
    await call_tool("forgejo_shutdown", {"confirmed": True})
    ```
    """
    if not confirmed:
        return "Refusing: pass confirmed=true to terminate the forgejo-mcp server process."
    import os as _os
    import signal as _signal

    _os.kill(_os.getpid(), _signal.SIGTERM)
    return "forgejo-mcp server terminating."


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
        "tool_count": 18,
    }


@web_app.get("/api/skills")
async def api_skills():
    """Skill inventory for skill-first Chat clients."""
    return {
        "skills": [
            {
                "name": "forgejo-companion",
                "uri": "skill://forgejo-companion",
                "description": "Manage Forgejo/Codeberg instances (profiles, repos, issues, PRs, runners).",
            }
        ],
        "prompt": "forgejo-triage",
    }


@web_app.post("/api/shutdown")
async def api_shutdown():
    """Orderly exit for the fleet launcher: respond 200 now, exit ~500 ms later."""
    threading.Timer(0.5, lambda: os._exit(0)).start()
    return {"status": "shutting_down", "message": "forgejo-mcp backend exiting in ~500 ms."}


@web_app.get("/api/capabilities")
async def api_capabilities():
    """Standard fleet shape for webapp discovery."""
    tool_names = sorted(
        [
            "forgejo_profile_list",
            "forgejo_profile_add",
            "forgejo_profile_set_active",
            "forgejo_repo_list",
            "forgejo_repo_create",
            "forgejo_repo_search",
            "forgejo_issue_list",
            "forgejo_issue_create",
            "forgejo_issue_comment",
            "forgejo_pr_list",
            "forgejo_pr_create",
            "forgejo_pr_merge",
            "forgejo_pr_diff",
            "forgejo_runner_list",
            "forgejo_workflow_runs",
            "forgejo_file_get",
            "forgejo_status",
            "forgejo_shutdown",
        ]
    )
    return {
        "service": "forgejo-mcp",
        "version": VERSION,
        "status": "ok",
        "tool_count": len(tool_names),
        "tools": tool_names,
        "endpoints": ["/health", "/api/status", "/api/capabilities", "/api/skills", "/api/shutdown", "/mcp"],
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
