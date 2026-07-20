"""
Forgejo MCP server — FastMCP 3.4.4+, portmanteau pattern.
Provides tools, resources, and prompts for Forgejo/Codeberg repository management.
"""

import asyncio
import json
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import Context, FastMCP

from .client import ForgejoClient, ProfileRegistry

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s %(message)s")
logger = logging.getLogger("forgejo-mcp.server")

VERSION = "0.1.0"
WEB_PORT = int(os.getenv("WEB_PORT", "10761"))
WEB_HOST = os.getenv("WEB_HOST", "127.0.0.1")

# Global instances
project_root = Path(__file__).parent.parent.parent
registry = ProfileRegistry(project_root)

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


# --- Helper to resolve client by profile ---
def get_client(profile_name: Optional[str] = None) -> ForgejoClient:
    """Helper to resolve a client based on the requested profile, falling back to active."""
    if profile_name:
        prof = registry.get_profile(profile_name)
        if not prof:
            raise ValueError(f"Profile '{profile_name}' not found. Available profiles: {list(registry.profiles.keys())}")
    else:
        prof = registry.get_active()
        if not prof:
            raise ValueError("No active profile configured. Add a profile first.")
    return ForgejoClient(prof)


# ── Profiles Management Tools ──────────────────────────────────────────────────

@mcp.tool()
async def forgejo_profile_list(ctx: Context = None) -> str:
    """List all configured connection profiles for Forgejo/Codeberg.
    
    Returns a markdown list of profiles and shows which is currently active.
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


@mcp.tool()
async def forgejo_profile_add(name: str, url: str, token: str, label: str, ctx: Context = None) -> str:
    """Add a new connection profile for a Forgejo/Codeberg instance.
    
    Args:
        name: A unique identifier slug (e.g., 'codeberg-personal', 'local-admin').
        url: The base URL of the instance (e.g., 'https://codeberg.org', 'http://localhost:3000').
        token: The Personal Access Token generated on the instance.
        label: A user-friendly display name.
    """
    try:
        registry.add_profile(name, url, token, label)
        return f"Successfully added profile '{label}' (`{name}`). Current active: '{registry.active_profile_name}'"
    except Exception as e:
        return f"Error adding profile: {e}"


@mcp.tool()
async def forgejo_profile_set_active(name: str, ctx: Context = None) -> str:
    """Set a profile as the active default for subsequent actions.
    
    Args:
        name: The name of the profile to activate.
    """
    if registry.set_active(name):
        return f"Profile '{name}' is now active."
    return f"Failed to set profile '{name}' active. Check if it exists."


# ── Repository Tools ──────────────────────────────────────────────────────────

@mcp.tool()
async def forgejo_repo_list(profile: Optional[str] = None, page: int = 1, limit: int = 50, ctx: Context = None) -> str:
    """List repositories that the user has access to for a profile.
    
    Args:
        profile: The name of the profile to use (default: active profile).
        page: Page number for pagination.
        limit: Number of items per page.
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


@mcp.tool()
async def forgejo_repo_create(name: str, description: str = "", private: bool = True, profile: Optional[str] = None, ctx: Context = None) -> str:
    """Create a new repository under the user account.
    
    Args:
        name: Repository name.
        description: Description of the repository.
        private: Whether the repository should be private.
        profile: The profile to use (default: active profile).
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


@mcp.tool()
async def forgejo_repo_search(query: str, page: int = 1, limit: int = 20, profile: Optional[str] = None, ctx: Context = None) -> str:
    """Search for repositories on the selected instance.
    
    Args:
        query: Query string.
        page: Page number for pagination.
        limit: Number of items per page.
        profile: The profile to use (default: active profile).
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

@mcp.tool()
async def forgejo_issue_list(owner: str, repo: str, state: str = "open", page: int = 1, limit: int = 20, profile: Optional[str] = None, ctx: Context = None) -> str:
    """List issues for a specific repository.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        state: State of the issues (open, closed, all).
        page: Page number for pagination.
        limit: Number of items per page.
        profile: The profile to use (default: active profile).
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


@mcp.tool()
async def forgejo_issue_create(owner: str, repo: str, title: str, body: str = "", profile: Optional[str] = None, ctx: Context = None) -> str:
    """Create a new issue in a repository.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        title: Issue title.
        body: Markdown body description of the issue.
        profile: The profile to use (default: active profile).
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


@mcp.tool()
async def forgejo_issue_comment(owner: str, repo: str, index: int, body: str, profile: Optional[str] = None, ctx: Context = None) -> str:
    """Comment on an existing issue or pull request.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        index: Issue/PR number.
        body: Markdown comment body.
        profile: The profile to use (default: active profile).
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

@mcp.tool()
async def forgejo_pr_list(owner: str, repo: str, state: str = "open", page: int = 1, limit: int = 20, profile: Optional[str] = None, ctx: Context = None) -> str:
    """List pull requests in a repository.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        state: State of the PRs (open, closed, all).
        page: Page for pagination.
        limit: Number of items per page.
        profile: The profile to use (default: active profile).
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


@mcp.tool()
async def forgejo_pr_create(owner: str, repo: str, title: str, head: str, base: str, body: str = "", profile: Optional[str] = None, ctx: Context = None) -> str:
    """Open a new pull request.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        title: PR title.
        head: The name of the branch containing the changes (e.g. 'feature-branch').
        base: The target branch to merge into (e.g. 'main').
        body: Markdown description of the PR changes.
        profile: The profile to use (default: active profile).
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


@mcp.tool()
async def forgejo_pr_merge(owner: str, repo: str, index: int, style: str = "merge", profile: Optional[str] = None, ctx: Context = None) -> str:
    """Merge a pull request.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        index: PR index number.
        style: Merge strategy (merge, rebase, squash).
        profile: The profile to use (default: active profile).
    """
    try:
        client = get_client(profile)
        res = await client.merge_pull_request(owner, repo, index, style)
        if not res.get("success"):
            return f"Error merging PR: {res.get('error')}"
            
        return f"Pull Request #{index} merged successfully using '{style}' strategy!"
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
async def forgejo_pr_diff(owner: str, repo: str, index: int, profile: Optional[str] = None, ctx: Context = None) -> str:
    """Get the raw diff format of a Pull Request to review changes.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        index: PR number.
        profile: The profile to use (default: active profile).
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

@mcp.tool()
async def forgejo_runner_list(owner: Optional[str] = None, repo: Optional[str] = None, profile: Optional[str] = None, ctx: Context = None) -> str:
    """List connected Actions runners (requires admin for global, or repo parameters for repo runners).
    
    Args:
        owner: Optional repository owner (e.g. for repo-scoped runner search).
        repo: Optional repository name (e.g. for repo-scoped runner search).
        profile: The profile to use (default: active profile).
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


@mcp.tool()
async def forgejo_workflow_runs(owner: str, repo: str, page: int = 1, limit: int = 20, profile: Optional[str] = None, ctx: Context = None) -> str:
    """Get active/historical Forgejo Actions runs for a repository.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        page: Page for pagination.
        limit: Number of items per page.
        profile: The profile to use (default: active profile).
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
            lines.append(f"  *Trigger: {r.get('event')} by @{r.get('actor', {}).get('username')} | Branch: {r.get('head_branch')}*")
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {e}"


# ── File Contents Tools ────────────────────────────────────────────────────────

@mcp.tool()
async def forgejo_file_get(owner: str, repo: str, filepath: str, ref: str = "main", profile: Optional[str] = None, ctx: Context = None) -> str:
    """Read contents of a file directly from a repository branch.
    
    Args:
        owner: Repository owner.
        repo: Repository name.
        filepath: Relative file path in the repository (e.g. 'README.md', 'src/main.py').
        ref: The branch, commit SHA, or tag (default: 'main').
        profile: The profile to use (default: active profile).
    """
    try:
        client = get_client(profile)
        res = await client.get_file_content(owner, repo, filepath, ref)
        if not res.get("success"):
            return f"Error reading file: {res.get('error')}"
            
        return res.get("data", "")
    except Exception as e:
        return f"Error: {e}"


# Serve FastAPI web app in a background thread for companion dashboard
web_app = FastAPI(title="Forgejo MCP Companion WebApp", version=VERSION)

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@web_app.get("/health")
async def health_check():
    return {"status": "ok", "version": VERSION, "active_profile": registry.active_profile_name}

# Import web routing endpoints (will create in web.py next)
from .web import router as web_router
web_app.include_router(web_router)


def main():
    import sys

    # Check transport mode
    transport = os.getenv("MCP_TRANSPORT", "stdio").lower()
    
    # Start web app in background thread to serve REST and dashboard
    web_thread = threading.Thread(
        target=lambda: uvicorn.run(web_app, host=WEB_HOST, port=WEB_PORT, log_level="warning"),
        daemon=True
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
