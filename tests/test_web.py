from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from forgejo_mcp.server import web_app as app

client = TestClient(app)


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
