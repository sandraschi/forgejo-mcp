import base64
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from forgejo_mcp.client import ForgejoClient, ForgejoProfile, ProfileRegistry, get_client


def test_profile_registry_creation():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        registry = ProfileRegistry(tmp_path)

        # Should start empty
        assert len(registry.profiles) == 0
        assert registry.active_profile_name is None

        # Test adding a profile
        registry.add_profile(name="test-prof", url="http://localhost:3000", token="mytoken", label="Test Local")

        assert len(registry.profiles) == 1
        assert "test-prof" in registry.profiles
        assert registry.active_profile_name == "test-prof"
        assert registry.get_active().token == "mytoken"


def test_profile_registry_persistence_roundtrip():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        registry = ProfileRegistry(tmp_path)
        registry.add_profile(name="a", url="https://codeberg.org", token="tok-a", label="A")
        registry.add_profile(name="b", url="http://localhost:3000", token="tok-b", label="B")
        assert registry.set_active("b") is True
        assert registry.set_active("missing") is False

        reloaded = ProfileRegistry(tmp_path)
        assert set(reloaded.profiles) == {"a", "b"}
        assert reloaded.active_profile_name == "b"
        assert reloaded.get_profile("a").url == "https://codeberg.org"

        assert registry.remove_profile("b") is True
        assert registry.remove_profile("b") is False
        assert registry.active_profile_name == "a"
        assert registry.get_profile("nope") is None


def test_profile_registry_env_default(monkeypatch):
    monkeypatch.setenv("FORGEJO_URL", "https://codeberg.org")
    monkeypatch.setenv("FORGEJO_TOKEN", "env-token")
    with tempfile.TemporaryDirectory() as tmpdir:
        registry = ProfileRegistry(Path(tmpdir))
        assert registry.active_profile_name == "env-default"
        assert registry.get_active().token == "env-token"


def test_get_client_errors():
    with tempfile.TemporaryDirectory() as tmpdir:
        from forgejo_mcp import client as client_mod

        empty = ProfileRegistry(Path(tmpdir))
        with patch.object(client_mod, "registry", empty):
            with pytest.raises(ValueError, match="No active profile"):
                get_client()
            with pytest.raises(ValueError, match="not found"):
                get_client("ghost")


def test_client_headers():
    profile = ForgejoProfile(name="test-codeberg", url="https://codeberg.org", token="some_token_xyz", label="Codeberg")
    client = ForgejoClient(profile)

    assert client.base_url == "https://codeberg.org/api/v1"
    assert client.headers["Authorization"] == "token some_token_xyz"
    assert "User-Agent" in client.headers


async def test_get_file_content_decode_paths():
    profile = ForgejoProfile(name="t", url="https://codeberg.org", token="x", label="T")
    client = ForgejoClient(profile)
    raw = base64.b64encode(b"hello forgejo").decode()

    client._request_async = AsyncMock(return_value={"success": True, "data": {"content": raw}})
    res = await client.get_file_content("o", "r", "README.md")
    assert res == {"success": True, "data": "hello forgejo"}

    client._request_async = AsyncMock(
        return_value={"success": True, "data": {"content": base64.b64encode(b"\xff\xfe\x00bad").decode()}}
    )
    res = await client.get_file_content("o", "r", "README.md")
    assert res["success"] is False and "decode" in res["error"]

    client._request_async = AsyncMock(return_value={"success": False, "error": "nope"})
    res = await client.get_file_content("o", "r", "README.md")
    assert res == {"success": False, "error": "nope"}


async def test_list_notifications_params():
    profile = ForgejoProfile(name="t", url="https://codeberg.org", token="x", label="T")
    client = ForgejoClient(profile)
    seen = {}

    async def fake_request(method, path, **kwargs):
        seen.update({"method": method, "path": path, "params": kwargs.get("params")})
        return {"success": True, "data": []}

    client._request_async = fake_request
    res = await client.list_notifications(unread_only=True, page=2, limit=5)
    assert res["success"] is True
    assert seen["path"] == "notifications"
    assert seen["params"] == {"all": "false", "page": 2, "limit": 5}

    await client.list_notifications(unread_only=False)
    assert seen["params"]["all"] == "true"


def test_sync_request_rate_limit_and_transport_error():
    profile = ForgejoProfile(name="t", url="https://codeberg.org", token="x", label="T")
    client = ForgejoClient(profile)

    resp = MagicMock(status_code=429, text="slow down", headers={})
    with patch("forgejo_mcp.client.httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.request.return_value = resp
        assert client._request("GET", "user") == {"success": False, "error": "Rate limit exceeded (HTTP 429)"}

    with patch("forgejo_mcp.client.httpx.Client", side_effect=RuntimeError("boom")):
        res = client._request("GET", "user")
        assert res["success"] is False and "boom" in res["error"]
