from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from forgejo_mcp.server import web_app as app

client = TestClient(app, raise_server_exceptions=False)


@patch("forgejo_mcp.web.registry")
def test_get_profiles(mock_registry):
    mock_profile = MagicMock()
    mock_profile.url = "http://localhost:3000"
    mock_profile.label = "Test"

    mock_registry.profiles = {"test-profile": mock_profile}
    mock_registry.active_profile_name = "test-profile"

    response = client.get("/api/profiles")
    assert response.status_code == 200
    data = response.json()
    assert data["active_profile"] == "test-profile"
    assert "test-profile" in data["profiles"]
    assert data["profiles"]["test-profile"]["url"] == "http://localhost:3000"


@patch("forgejo_mcp.web.get_client")
def test_list_repositories(mock_get_client):
    mock_client = MagicMock()
    mock_client.list_repositories = AsyncMock(
        return_value={"success": True, "data": [{"name": "repo1", "owner": {"login": "user1"}}]}
    )
    mock_get_client.return_value = mock_client

    response = client.get("/api/repos")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["name"] == "repo1"


def test_api_status_shape():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "forgejo-mcp"
    assert data["tool_count"] == 18


def test_api_skills_shape():
    response = client.get("/api/skills")
    assert response.status_code == 200
    data = response.json()
    assert data["skills"][0]["name"] == "forgejo-companion"
    assert data["prompt"] == "forgejo-triage"


def test_api_capabilities_lists_status_tool():
    response = client.get("/api/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert "forgejo_status" in data["tools"]
    assert "forgejo_shutdown" in data["tools"]
    assert "/api/shutdown" in data["endpoints"]


def test_cors_not_wildcard():
    from forgejo_mcp.server import web_app as app_mod

    cors = [m for m in app_mod.user_middleware if "CORS" in str(m.cls)]
    assert cors, "CORSMiddleware must be configured"
    assert "*" not in cors[0].kwargs.get("allow_origins", ["*"])
    assert cors[0].kwargs.get("allow_origin_regex"), "unconditional origin regex required"


async def test_forgejo_status_dialogic():
    from forgejo_mcp.server import forgejo_status

    result = await forgejo_status()
    assert result["success"] is True
    assert "message" in result
    assert result["data"]["service"] == "forgejo-mcp"


async def test_forgejo_shutdown_refuses_without_confirm():
    from forgejo_mcp.server import forgejo_shutdown

    result = await forgejo_shutdown(confirmed=False)
    assert "Refusing" in result


async def test_profiles_resource_hides_tokens():
    import json

    from forgejo_mcp.server import forgejo_profiles_resource

    payload = json.loads(await forgejo_profiles_resource())
    assert "profiles" in payload
    assert "token" not in json.dumps(payload)


def test_triage_prompt_mentions_status():
    from forgejo_mcp.server import forgejo_triage_prompt

    text = forgejo_triage_prompt()
    assert "forgejo_status" in text
