"""
FastAPI routing for companion webapp integration, profile management, and proxy endpoints.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .client import get_client, registry

router = APIRouter(prefix="/api")

# Directory configuration for frontend static files
current_dir = Path(__file__).parent
project_root = current_dir.parent.parent
dist_dir = project_root / "web" / "dist"


# ── Profile Management Endpoints ──────────────────────────────────────────────


@router.get("/profiles")
async def get_profiles():
    """Retrieve list of configured profiles and active profile name."""
    return {
        "active_profile": registry.active_profile_name,
        "profiles": {
            name: {
                "url": p.url,
                "label": p.label,
                # Do not expose tokens to frontend for security
            }
            for name, p in registry.profiles.items()
        },
    }


class ProfilePayload:
    from pydantic import BaseModel

    class Model(BaseModel):
        name: str
        url: str
        token: str
        label: str


@router.post("/profiles")
async def add_profile(payload: ProfilePayload.Model):
    """Add a new connection profile."""
    try:
        registry.add_profile(name=payload.name, url=payload.url, token=payload.token, label=payload.label)
        return {"success": True, "message": f"Profile '{payload.label}' added successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class SetActivePayload:
    from pydantic import BaseModel

    class Model(BaseModel):
        name: str


@router.post("/profiles/active")
async def set_active_profile(payload: SetActivePayload.Model):
    """Set the active connection profile."""
    if registry.set_active(payload.name):
        return {"success": True, "message": f"Active profile set to '{payload.name}'."}
    raise HTTPException(status_code=404, detail=f"Profile '{payload.name}' not found.")


@router.delete("/profiles/{name}")
async def delete_profile(name: str):
    """Remove a profile configuration."""
    if registry.remove_profile(name):
        return {"success": True, "message": f"Profile '{name}' deleted."}
    raise HTTPException(status_code=404, detail=f"Profile '{name}' not found.")


# ── Proxy Endpoints (Frontend ➔ Python client ➔ Forgejo API) ─────────────────


@router.get("/repos")
async def proxy_list_repos(profile: str | None = None, page: int = 1, limit: int = 50):
    try:
        client = get_client(profile)
        res = await client.list_repositories(page, limit)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/runners")
async def proxy_list_runners(profile: str | None = None, owner: str | None = None, repo: str | None = None):
    try:
        client = get_client(profile)
        res = await client.list_runners(owner, repo)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/workflows")
async def proxy_list_workflows(owner: str, repo: str, profile: str | None = None, page: int = 1, limit: int = 20):
    try:
        client = get_client(profile)
        res = await client.list_workflows(owner, repo, page, limit)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/issues")
async def proxy_list_issues(
    owner: str, repo: str, state: str = "open", profile: str | None = None, page: int = 1, limit: int = 20
):
    try:
        client = get_client(profile)
        res = await client.list_issues(owner, repo, state, page, limit)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/pulls")
async def proxy_list_pulls(
    owner: str, repo: str, state: str = "open", profile: str | None = None, page: int = 1, limit: int = 20
):
    try:
        client = get_client(profile)
        res = await client.list_pull_requests(owner, repo, state, page, limit)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


class RepoCreatePayload(BaseModel):
    name: str
    description: str = ""
    private: bool = True
    profile: str | None = None


@router.post("/repos")
async def proxy_create_repo(payload: RepoCreatePayload):
    """Create a repository (dashboard New-repo dialog)."""
    try:
        client = get_client(payload.profile)
        return await client.create_repository(payload.name, payload.description, payload.private)
    except Exception as e:
        return {"success": False, "error": str(e)}


class IssueCreatePayload(BaseModel):
    owner: str
    repo: str
    title: str
    body: str = ""
    profile: str | None = None


@router.post("/issues")
async def proxy_create_issue(payload: IssueCreatePayload):
    """Create an issue (dashboard Issues tab)."""
    try:
        client = get_client(payload.profile)
        return await client.create_issue(payload.owner, payload.repo, payload.title, payload.body)
    except Exception as e:
        return {"success": False, "error": str(e)}


class IssueCommentPayload(BaseModel):
    owner: str
    repo: str
    index: int
    body: str
    profile: str | None = None


@router.post("/issues/comment")
async def proxy_comment_issue(payload: IssueCommentPayload):
    """Comment on an issue or PR (dashboard Issues/Pulls tabs)."""
    try:
        client = get_client(payload.profile)
        return await client.create_issue_comment(payload.owner, payload.repo, payload.index, payload.body)
    except Exception as e:
        return {"success": False, "error": str(e)}


class PRCreatePayload(BaseModel):
    owner: str
    repo: str
    title: str
    head: str
    base: str
    body: str = ""
    profile: str | None = None


@router.post("/pulls")
async def proxy_create_pr(payload: PRCreatePayload):
    """Open a pull request (dashboard Pulls tab)."""
    try:
        client = get_client(payload.profile)
        return await client.create_pull_request(
            payload.owner, payload.repo, payload.title, payload.head, payload.base, payload.body
        )
    except Exception as e:
        return {"success": False, "error": str(e)}


class PRMergePayload(BaseModel):
    owner: str
    repo: str
    index: int
    style: str = "merge"
    profile: str | None = None


@router.post("/pulls/merge")
async def proxy_merge_pr(payload: PRMergePayload):
    """Merge a pull request (dashboard Pulls tab, human-confirmed)."""
    try:
        client = get_client(payload.profile)
        return await client.merge_pull_request(payload.owner, payload.repo, payload.index, payload.style)
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/pulls/diff")
async def proxy_pr_diff(owner: str, repo: str, index: int, profile: str | None = None):
    """Raw diff for one PR (dashboard Pulls tab review view, 40k cap applied client-side by the tool contract)."""
    try:
        client = get_client(profile)
        res = await client.get_pull_request_diff(owner, repo, index)
        if res.get("success") and isinstance(res.get("data"), str) and len(res["data"]) > 40000:
            res = {**res, "data": res["data"][:40000] + "\n\n...[Diff truncated due to size limit]..."}
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/file")
async def proxy_file_content(owner: str, repo: str, filepath: str, ref: str = "main", profile: str | None = None):
    """Decoded file contents (dashboard Files tab)."""
    try:
        client = get_client(profile)
        return await client.get_file_content(owner, repo, filepath, ref)
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── SPA Mount Setup ───────────────────────────────────────────────────────────


def setup_webapp(app):
    """Mounts built SPA static assets from web/dist or registers fallback route."""
    if dist_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(dist_dir / "assets")), name="assets")

        @app.get("/{full_path:path}", response_class=HTMLResponse)
        async def serve_spa(full_path: str):
            # Skip API endpoints
            if full_path.startswith("api/") or full_path.startswith("mcp"):
                return None

            index_path = dist_dir / "index.html"
            if index_path.exists():
                return FileResponse(index_path)
            return HTMLResponse(
                content="<h1>Frontend UI not built</h1><p>Please run <code>just build-frontend</code> to compile.</p>",
                status_code=404,
            )
    else:

        @app.get("/", response_class=HTMLResponse)
        async def dev_hint():
            return HTMLResponse(
                content="<h1>Static files missing</h1><p>Expected <code>web/dist</code> but it does not exist.</p>"
            )
