"""
FastAPI routing for companion webapp integration, profile management, and proxy endpoints.
"""

from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .client import ForgejoClient, registry, get_client

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
        }
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
        registry.add_profile(
            name=payload.name,
            url=payload.url,
            token=payload.token,
            label=payload.label
        )
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
async def proxy_list_repos(
    profile: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    try:
        client = get_client(profile)
        res = await client.list_repositories(page, limit)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/runners")
async def proxy_list_runners(
    profile: Optional[str] = None,
    owner: Optional[str] = None,
    repo: Optional[str] = None
):
    try:
        client = get_client(profile)
        res = await client.list_runners(owner, repo)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/workflows")
async def proxy_list_workflows(
    owner: str,
    repo: str,
    profile: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    try:
        client = get_client(profile)
        res = await client.list_workflows(owner, repo, page, limit)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/issues")
async def proxy_list_issues(
    owner: str,
    repo: str,
    state: str = "open",
    profile: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    try:
        client = get_client(profile)
        res = await client.list_issues(owner, repo, state, page, limit)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/pulls")
async def proxy_list_pulls(
    owner: str,
    repo: str,
    state: str = "open",
    profile: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    try:
        client = get_client(profile)
        res = await client.list_pull_requests(owner, repo, state, page, limit)
        return res
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

