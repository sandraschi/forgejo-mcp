import tempfile
from pathlib import Path

from forgejo_mcp.client import ForgejoClient, ForgejoProfile, ProfileRegistry


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


def test_client_headers():
    profile = ForgejoProfile(name="test-codeberg", url="https://codeberg.org", token="some_token_xyz", label="Codeberg")
    client = ForgejoClient(profile)

    assert client.base_url == "https://codeberg.org/api/v1"
    assert client.headers["Authorization"] == "token some_token_xyz"
    assert "User-Agent" in client.headers
