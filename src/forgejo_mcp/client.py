"""
HTTP client and Profile Registry for Forgejo and Codeberg integration.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("forgejo-mcp.client")

DEFAULT_PROFILES_FILE = ".env.profiles.json"


class ForgejoProfile:
    """Represents a connection configuration to a Forgejo/Codeberg instance."""

    def __init__(self, name: str, url: str, token: str, label: str):
        self.name = name
        self.url = url.rstrip("/")
        self.token = token
        self.label = label

    def to_dict(self) -> Dict[str, str]:
        return {
            "name": self.name,
            "url": self.url,
            "token": self.token,
            "label": self.label,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "ForgejoProfile":
        return cls(
            name=data["name"],
            url=data["url"],
            token=data["token"],
            label=data.get("label", data["name"]),
        )


class ProfileRegistry:
    """Manages active and configured profiles, persisted locally."""

    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.profiles_path = root_dir / DEFAULT_PROFILES_FILE
        self.profiles: Dict[str, ForgejoProfile] = {}
        self.active_profile_name: Optional[str] = None
        self.load()

    def load(self) -> None:
        """Loads profiles from environment variables and the local JSON file."""
        # 1. Load from environment first (fallback default)
        env_url = os.getenv("FORGEJO_URL")
        env_token = os.getenv("FORGEJO_TOKEN")
        if env_url and env_token:
            default_profile = ForgejoProfile(
                name="env-default",
                url=env_url,
                token=env_token,
                label=os.getenv("FORGEJO_LABEL", "Environment Default"),
            )
            self.profiles[default_profile.name] = default_profile
            self.active_profile_name = default_profile.name

        # 2. Load from JSON profile file
        if self.profiles_path.exists():
            try:
                with open(self.profiles_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                active = data.get("active_profile")
                loaded_profiles = data.get("profiles", {})
                
                for name, prof_data in loaded_profiles.items():
                    prof_data["name"] = name
                    self.profiles[name] = ForgejoProfile.from_dict(prof_data)
                
                if active and active in self.profiles:
                    self.active_profile_name = active
            except Exception as e:
                logger.error(f"Failed to load profiles file: {e}")

        # Set default active if none set
        if not self.active_profile_name and self.profiles:
            self.active_profile_name = list(self.profiles.keys())[0]

    def save(self) -> None:
        """Persists the profiles configuration to a local JSON file."""
        data = {
            "active_profile": self.active_profile_name,
            "profiles": {
                name: {
                    "url": p.url,
                    "token": p.token,
                    "label": p.label,
                }
                for name, p in self.profiles.items()
            },
        }
        try:
            with open(self.profiles_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save profiles file: {e}")

    def add_profile(self, name: str, url: str, token: str, label: str) -> None:
        profile = ForgejoProfile(name=name, url=url, token=token, label=label)
        self.profiles[name] = profile
        if not self.active_profile_name:
            self.active_profile_name = name
        self.save()

    def remove_profile(self, name: str) -> bool:
        if name in self.profiles:
            del self.profiles[name]
            if self.active_profile_name == name:
                self.active_profile_name = list(self.profiles.keys())[0] if self.profiles else None
            self.save()
            return True
        return False

    def set_active(self, name: str) -> bool:
        if name in self.profiles:
            self.active_profile_name = name
            self.save()
            return True
        return False

    def get_active(self) -> Optional[ForgejoProfile]:
        if self.active_profile_name:
            return self.profiles.get(self.active_profile_name)
        return None

    def get_profile(self, name: str) -> Optional[ForgejoProfile]:
        return self.profiles.get(name)


class ForgejoClient:
    """API wrapper for sending requests to the selected Forgejo instance."""

    def __init__(self, profile: ForgejoProfile):
        self.profile = profile
        self.base_url = f"{profile.url}/api/v1"
        self.headers = {
            "Authorization": f"token {profile.token}",
            "Accept": "application/json",
            "User-Agent": "Forgejo-MCP-Server",
        }

    def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        """Synchronous HTTP request wrapper with rate limit checking."""
        url = f"{self.base_url}/{path.lstrip('/')}"
        
        # Check standard headers injection
        headers = self.headers.copy()
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))
            
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.request(method, url, headers=headers, **kwargs)
                
                # Check for rate limiting
                if response.status_code == 429:
                    logger.warning(f"Rate limited by {self.profile.url}")
                    return {"success": False, "error": "Rate limit exceeded (HTTP 429)"}
                
                if response.status_code in (200, 201, 204):
                    if response.status_code == 204:
                        return {"success": True, "data": None}
                    # Check if diff/raw is requested
                    content_type = response.headers.get("content-type", "")
                    if "application/json" in content_type:
                        return {"success": True, "data": response.json()}
                    else:
                        return {"success": True, "data": response.text}
                
                return {
                    "success": False, 
                    "error": f"API HTTP {response.status_code}: {response.text}",
                    "status_code": response.status_code
                }
        except Exception as e:
            logger.error(f"Forgejo Client error: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def _request_async(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        """Asynchronous HTTP request wrapper with rate limit checking."""
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = self.headers.copy()
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))
            
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.request(method, url, headers=headers, **kwargs)
                
                if response.status_code == 429:
                    return {"success": False, "error": "Rate limit exceeded (HTTP 429)"}
                
                if response.status_code in (200, 201, 204):
                    if response.status_code == 204:
                        return {"success": True, "data": None}
                    content_type = response.headers.get("content-type", "")
                    if "application/json" in content_type:
                        return {"success": True, "data": response.json()}
                    else:
                        return {"success": True, "data": response.text}
                        
                return {
                    "success": False, 
                    "error": f"API HTTP {response.status_code}: {response.text}",
                    "status_code": response.status_code
                }
        except Exception as e:
            return {"success": False, "error": f"Connection error: {str(e)}"}

    # --- API Implementation Methods ---

    async def get_user_info(self) -> Dict[str, Any]:
        return await self._request_async("GET", "user")

    async def list_repositories(self, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        return await self._request_async("GET", "user/repos", params={"page": page, "limit": limit})

    async def create_repository(self, name: str, description: str = "", private: bool = True) -> Dict[str, Any]:
        payload = {
            "name": name,
            "description": description,
            "private": private,
            "auto_init": True
        }
        return await self._request_async("POST", "user/repos", json=payload)

    async def get_repository(self, owner: str, repo: str) -> Dict[str, Any]:
        return await self._request_async("GET", f"repos/{owner}/{repo}")

    async def search_repositories(self, q: str, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        return await self._request_async("GET", "repos/search", params={"q": q, "page": page, "limit": limit})

    async def list_issues(self, owner: str, repo: str, state: str = "open", page: int = 1, limit: int = 20) -> Dict[str, Any]:
        # state can be: open, closed, all
        return await self._request_async(
            "GET", f"repos/{owner}/{repo}/issues", 
            params={"state": state, "page": page, "limit": limit}
        )

    async def create_issue(self, owner: str, repo: str, title: str, body: str = "") -> Dict[str, Any]:
        return await self._request_async("POST", f"repos/{owner}/{repo}/issues", json={"title": title, "body": body})

    async def get_issue(self, owner: str, repo: str, index: int) -> Dict[str, Any]:
        return await self._request_async("GET", f"repos/{owner}/{repo}/issues/{index}")

    async def create_issue_comment(self, owner: str, repo: str, index: int, body: str) -> Dict[str, Any]:
        return await self._request_async("POST", f"repos/{owner}/{repo}/issues/{index}/comments", json={"body": body})

    async def list_pull_requests(self, owner: str, repo: str, state: str = "open", page: int = 1, limit: int = 20) -> Dict[str, Any]:
        return await self._request_async(
            "GET", f"repos/{owner}/{repo}/pulls", 
            params={"state": state, "page": page, "limit": limit}
        )

    async def create_pull_request(self, owner: str, repo: str, title: str, head: str, base: str, body: str = "") -> Dict[str, Any]:
        payload = {
            "title": title,
            "head": head,
            "base": base,
            "body": body
        }
        return await self._request_async("POST", f"repos/{owner}/{repo}/pulls", json=payload)

    async def get_pull_request(self, owner: str, repo: str, index: int) -> Dict[str, Any]:
        return await self._request_async("GET", f"repos/{owner}/{repo}/pulls/{index}")

    async def merge_pull_request(self, owner: str, repo: str, index: int, style: str = "merge") -> Dict[str, Any]:
        # style can be: merge, rebase, squash
        return await self._request_async(
            "POST", f"repos/{owner}/{repo}/pulls/{index}/merge", 
            json={"Do": style}
        )

    async def get_pull_request_diff(self, owner: str, repo: str, index: int) -> Dict[str, Any]:
        headers = {"Accept": "application/vnd.gitea.v1.diff"}
        return await self._request_async("GET", f"repos/{owner}/{repo}/pulls/{index}", headers=headers)

    async def list_runners(self, owner: Optional[str] = None, repo: Optional[str] = None) -> Dict[str, Any]:
        """Retrieve active actions runners. Attempts global admin, falling back to repository-scoped."""
        if owner and repo:
            # Repo-scoped runners list
            return await self._request_async("GET", f"repos/{owner}/{repo}/runners")
        else:
            # Global admin runners list
            return await self._request_async("GET", "admin/runners")

    async def list_workflows(self, owner: str, repo: str, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Fetch Gitea/Forgejo Actions runs for a repository."""
        # Note: Gitea/Forgejo action run list endpoints mirror GitHub API's structure
        return await self._request_async(
            "GET", f"repos/{owner}/{repo}/actions/runs",
            params={"page": page, "limit": limit}
        )

    async def get_file_content(self, owner: str, repo: str, filepath: str, ref: str = "main") -> Dict[str, Any]:
        """Retrieves raw content of a file from the repository."""
        # Forgejo returns metadata + base64 content on GET /contents
        result = await self._request_async("GET", f"repos/{owner}/{repo}/contents/{filepath.lstrip('/')}", params={"ref": ref})
        if result.get("success"):
            import base64
            try:
                content_b64 = result["data"]["content"]
                decoded = base64.b64decode(content_b64).decode("utf-8")
                return {"success": True, "data": decoded}
            except Exception as e:
                return {"success": False, "error": f"Failed to decode file: {e}"}
        return result


# Shared registry instance
PROJECT_ROOT = Path(__file__).parent.parent.parent
registry = ProfileRegistry(PROJECT_ROOT)


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
