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
    assert data["tool_count"] == 7


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
    assert data["tools"] == [
        "forgejo_actions",
        "forgejo_issues",
        "forgejo_profiles",
        "forgejo_prs",
        "forgejo_repos",
        "forgejo_shutdown",
        "forgejo_status",
    ]
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
    assert result["success"] is False
    assert "Refusing" in result["message"]


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


def test_api_logs_ring_buffer():
    import logging

    # NOTE: warning+ (root logger sits at WARNING under pytest's logging setup).
    logging.getLogger("forgejo-mcp.test-probe").warning("log-marker-xyz-123")
    response = client.get("/api/logs", params={"search": "log-marker-xyz-123"})
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 1
    assert any("log-marker-xyz-123" in entry["message"] for entry in data["logs"])

    filtered = client.get("/api/logs", params={"level": "CRITICAL", "search": "log-marker-xyz-123"})
    assert filtered.json()["count"] == 0


@patch("forgejo_mcp.server.get_client")
def test_api_notifications_proxy(mock_get_client):
    mock_client = MagicMock()
    mock_client.list_notifications = AsyncMock(return_value={"success": True, "data": []})
    mock_get_client.return_value = mock_client

    response = client.get("/api/notifications", params={"unread_only": "false"})
    assert response.status_code == 200
    assert response.json() == {"success": True, "data": []}
    _, kwargs = mock_client.list_notifications.call_args
    assert kwargs["unread_only"] is False


@patch("forgejo_mcp.server.get_client")
def test_api_notifications_error(mock_get_client):
    mock_get_client.side_effect = ValueError("No active profile configured.")
    response = client.get("/api/notifications")
    assert response.status_code == 200
    assert response.json()["success"] is False


@patch("forgejo_mcp.server._probe_json")
def test_api_llm_discover_shape(mock_probe):
    async def fake_probe(url, timeout=1.5):
        if ":11434" in url:
            return {"models": [{"name": "llama3.1:8b"}]}
        return None

    mock_probe.side_effect = fake_probe
    response = client.get("/api/llm/discover")
    assert response.status_code == 200
    providers = {p["id"]: p for p in response.json()["providers"]}
    assert providers["ollama"]["detected"] is True
    assert providers["ollama"]["models"] == ["llama3.1:8b"]
    assert providers["lmstudio"]["detected"] is False
    assert providers["lmstudio"]["models"] == []


@patch("forgejo_mcp.server._probe_json")
def test_api_llm_models_known_and_unknown(mock_probe):
    mock_probe.return_value = None
    response = client.get("/api/llm/models", params={"provider": "ollama"})
    assert response.status_code == 200
    assert response.json() == {"provider": "ollama", "detected": False, "models": []}

    unknown = client.get("/api/llm/models", params={"provider": "nope"})
    assert unknown.status_code == 404


@patch("forgejo_mcp.server._ollama_chat_events")
def test_api_llm_chat_stream_deltas(mock_events):
    async def fake_events(url, model, messages):
        assert model == "llama3.1:8b"
        assert messages[-1] == {"role": "user", "content": "hi"}
        yield {"delta": "hello "}
        yield {"delta": "there"}

    mock_events.side_effect = fake_events
    response = client.post(
        "/api/llm/chat/stream",
        json={"provider": "ollama", "model": "llama3.1:8b", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert response.status_code == 200
    assert "hello " in response.text
    assert "data: [DONE]" in response.text


def test_api_llm_chat_stream_needs_model():
    response = client.post("/api/llm/chat/stream", json={"provider": "ollama", "model": ""})
    assert response.status_code == 200
    assert "No model selected" in response.text

    unknown = client.post("/api/llm/chat/stream", json={"provider": "nope", "model": "x"})
    assert unknown.status_code == 404


def test_api_capabilities_tool_details():
    response = client.get("/api/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert data["tool_details"], "live tool listing must not be empty"
    by_name = {t["name"]: t for t in data["tool_details"]}
    assert set(by_name) == set(data["tools"])
    assert by_name["forgejo_status"]["read_only"] is True
    assert by_name["forgejo_shutdown"]["read_only"] is False
    assert all(t["description"] for t in data["tool_details"])


def test_api_skills_has_prompt_text():
    response = client.get("/api/skills")
    assert response.status_code == 200
    data = response.json()
    assert "forgejo_status" in data["prompt_text"]


# ── Portmanteau dispatch (v0.2.0 surface) ────────────────────────────────────


def test_api_skills_has_prompt_text():
    response = client.get("/api/skills")
    assert response.status_code == 200
    data = response.json()
    assert "forgejo_status" in data["prompt_text"]
    assert "forgejo_profiles" in data["prompt_text"]


def _mock_client(**method_returns):
    mock_client = MagicMock()
    mock_client.profile = MagicMock(url="https://codeberg.org", label="Codeberg")
    for method, value in method_returns.items():
        setattr(mock_client, method, AsyncMock(return_value=value))
    return mock_client


@patch("forgejo_mcp.server.registry")
async def test_profiles_list_empty_and_full(mock_registry):
    from forgejo_mcp.server import forgejo_profiles

    mock_registry.profiles = {}
    mock_registry.active_profile_name = None
    res = await forgejo_profiles(action="list")
    assert res["success"] is True and res["data"]["profiles"] == {}

    prof = MagicMock(url="https://codeberg.org", label="Codeberg")
    mock_registry.profiles = {"cb": prof}
    mock_registry.active_profile_name = "cb"
    res = await forgejo_profiles(action="list")
    assert "Codeberg" in res["message"]
    assert res["data"]["active_profile"] == "cb"


@patch("forgejo_mcp.server.registry")
async def test_profiles_mutations(mock_registry):
    from forgejo_mcp.server import forgejo_profiles

    res = await forgejo_profiles(action="add", name="x")
    assert res["success"] is False and "name, url, token, label" in res["message"]

    res = await forgejo_profiles(action="add", name="x", url="u", token="t", label="L")
    assert res["success"] is True
    mock_registry.add_profile.assert_called_once_with("x", "u", "t", "L")

    mock_registry.set_active.return_value = True
    assert (await forgejo_profiles(action="set_active", name="x"))["success"] is True
    mock_registry.set_active.return_value = False
    assert (await forgejo_profiles(action="set_active", name="ghost"))["success"] is False
    assert (await forgejo_profiles(action="set_active"))["success"] is False

    mock_registry.remove_profile.return_value = True
    assert (await forgejo_profiles(action="remove", name="x"))["success"] is True
    mock_registry.remove_profile.return_value = False
    assert (await forgejo_profiles(action="remove", name="ghost"))["success"] is False


@patch("forgejo_mcp.server.registry")
async def test_profiles_registry_error(mock_registry):
    from forgejo_mcp.server import forgejo_profiles

    mock_registry.profiles = {}
    mock_registry.active_profile_name = None
    mock_registry.add_profile.side_effect = RuntimeError("disk full")
    res = await forgejo_profiles(action="add", name="x", url="u", token="t", label="L")
    assert res["success"] is False and "disk full" in res["message"]


@patch("forgejo_mcp.server.get_client")
async def test_repos_dispatch(mock_get_client):
    from forgejo_mcp.server import forgejo_repos

    repo = {"full_name": "me/demo", "private": False, "description": "d", "html_url": "u"}
    mock_get_client.return_value = _mock_client(
        list_repositories={"success": True, "data": [repo]},
        create_repository={"success": True, "data": {"full_name": "me/n", "private": True}},
        search_repositories={"success": True, "data": {"data": [repo]}},
        get_file_content={"success": True, "data": "file-bytes"},
    )

    res = await forgejo_repos(action="list")
    assert res["success"] is True and "me/demo" in res["message"]

    res = await forgejo_repos(action="create", name="n")
    assert res["success"] is True and "me/n" in res["message"]
    assert (await forgejo_repos(action="create"))["success"] is False

    res = await forgejo_repos(action="search", query="mcp")
    assert res["success"] is True and "mcp" in res["message"]
    assert (await forgejo_repos(action="search"))["success"] is False

    res = await forgejo_repos(action="file_get", owner="me", repo="demo", filepath="README.md")
    assert res == {
        "success": True,
        "message": "file-bytes",
        "data": {"owner": "me", "repo": "demo", "filepath": "README.md", "ref": "main"},
    }
    assert (await forgejo_repos(action="file_get", owner="me"))["success"] is False


@patch("forgejo_mcp.server.get_client")
async def test_repos_client_error_paths(mock_get_client):
    from forgejo_mcp.server import forgejo_repos

    mock_get_client.return_value = _mock_client(
        list_repositories={"success": False, "error": "denied"},
        create_repository={"success": False, "error": "denied"},
        search_repositories={"success": False, "error": "denied"},
        get_file_content={"success": False, "error": "denied"},
    )
    assert (await forgejo_repos(action="list"))["message"] == "Error: denied"
    assert "denied" in (await forgejo_repos(action="create", name="n"))["message"]
    assert "denied" in (await forgejo_repos(action="search", query="q"))["message"]
    assert "denied" in (await forgejo_repos(action="file_get", owner="o", repo="r", filepath="f"))["message"]

    mock_get_client.return_value = _mock_client(list_repositories={"success": True, "data": []})
    assert (await forgejo_repos(action="list"))["data"] == {"repositories": []}
    mock_get_client.side_effect = ValueError("No active profile")
    assert (await forgejo_repos(action="list"))["success"] is False


@patch("forgejo_mcp.server.get_client")
async def test_issues_dispatch(mock_get_client):
    from forgejo_mcp.server import forgejo_issues

    issue = {"number": 1, "title": "Bug", "user": {"username": "me"}, "state": "open", "comments": 2, "html_url": "u"}
    mock_get_client.return_value = _mock_client(
        list_issues={"success": True, "data": [issue]},
        create_issue={"success": True, "data": {"number": 2, "title": "N", "html_url": "u"}},
        create_issue_comment={"success": True, "data": {"html_url": "c"}},
    )
    res = await forgejo_issues(action="list", owner="me", repo="demo")
    assert res["success"] is True and "#1 Bug" in res["message"]
    assert (await forgejo_issues(action="list", owner="me"))["success"] is False

    res = await forgejo_issues(action="create", owner="me", repo="demo", title="N")
    assert res["success"] is True and "#2" in res["message"]
    assert (await forgejo_issues(action="create", owner="me", repo="demo"))["success"] is False

    res = await forgejo_issues(action="comment", owner="me", repo="demo", index=1, body="hi")
    assert res["success"] is True
    assert (await forgejo_issues(action="comment", owner="me", repo="demo", index=1))["success"] is False

    mock_get_client.return_value = _mock_client(list_issues={"success": True, "data": []})
    assert (await forgejo_issues(action="list", owner="me", repo="demo"))["data"] == {"issues": []}
    mock_get_client.return_value = _mock_client(list_issues={"success": False, "error": "gone"})
    assert "gone" in (await forgejo_issues(action="list", owner="me", repo="demo"))["message"]


@patch("forgejo_mcp.server.get_client")
async def test_prs_dispatch(mock_get_client):
    from forgejo_mcp.server import forgejo_prs

    pr = {
        "number": 3,
        "title": "Feat",
        "user": {"username": "me"},
        "head": {"ref": "f"},
        "base": {"ref": "main"},
        "state": "open",
        "mergeable": True,
        "html_url": "u",
    }
    mock_get_client.return_value = _mock_client(
        list_pull_requests={"success": True, "data": [pr]},
        create_pull_request={"success": True, "data": {"number": 4, "title": "F", "html_url": "u"}},
        merge_pull_request={"success": True, "data": {}},
        get_pull_request_diff={"success": True, "data": "diff-text"},
    )
    res = await forgejo_prs(action="list", owner="me", repo="demo")
    assert res["success"] is True and "#3 Feat" in res["message"]
    assert (await forgejo_prs(action="list", owner="me"))["success"] is False

    res = await forgejo_prs(action="create", owner="me", repo="d", title="F", head="f", base="main")
    assert res["success"] is True and "#4" in res["message"]
    assert (await forgejo_prs(action="create", owner="me", repo="d"))["success"] is False

    res = await forgejo_prs(action="merge", owner="me", repo="d", index=3, style="squash")
    assert res["success"] is True and "squash" in res["message"]

    res = await forgejo_prs(action="diff", owner="me", repo="d", index=3)
    assert res["success"] is True and res["data"]["truncated"] is False
    assert (await forgejo_prs(action="diff", owner="me"))["success"] is False

    mock_get_client.return_value = _mock_client(
        list_pull_requests={"success": False, "error": "gone"},
        create_pull_request={"success": False, "error": "gone"},
        merge_pull_request={"success": False, "error": "gone"},
        get_pull_request_diff={"success": False, "error": "gone"},
    )
    assert "gone" in (await forgejo_prs(action="list", owner="o", repo="r"))["message"]
    assert "gone" in (await forgejo_prs(action="create", owner="o", repo="r", title="t", head="h", base="b"))["message"]
    assert "gone" in (await forgejo_prs(action="merge", owner="o", repo="r", index=1))["message"]
    assert "gone" in (await forgejo_prs(action="diff", owner="o", repo="r", index=1))["message"]

    mock_get_client.return_value = _mock_client(
        list_pull_requests={"success": True, "data": []},
        get_pull_request_diff={"success": True, "data": "x" * 50000},
    )
    assert (await forgejo_prs(action="list", owner="o", repo="r"))["data"] == {"prs": []}
    big = await forgejo_prs(action="diff", owner="o", repo="r", index=1)
    assert big["data"]["truncated"] is True and "truncated due to size" in big["message"]


@patch("forgejo_mcp.server.get_client")
async def test_actions_dispatch(mock_get_client):
    from forgejo_mcp.server import forgejo_actions

    runner = {"name": "r1", "id": 7, "status": "online", "agent_labels": ["ubuntu"], "version": "1.0"}
    run = {
        "run_number": 9,
        "title": "CI",
        "status": "completed",
        "conclusion": "success",
        "event": "push",
        "actor": {"username": "me"},
        "head_branch": "main",
    }
    thread = {"unread": True, "subject": {"type": "Issue", "title": "Hey"}, "updated_at": "now"}
    mock_get_client.return_value = _mock_client(
        list_runners={"success": True, "data": [runner]},
        list_workflows={"success": True, "data": {"action_runs": [run]}},
        list_notifications={"success": True, "data": [thread]},
    )
    res = await forgejo_actions(action="runners")
    assert res["success"] is True and "r1" in res["message"]

    res = await forgejo_actions(action="workflow_runs", owner="me", repo="demo")
    assert res["success"] is True and "#9" in res["message"]
    assert (await forgejo_actions(action="workflow_runs", owner="me"))["success"] is False

    res = await forgejo_actions(action="notifications")
    assert res["success"] is True and "Hey" in res["message"]

    mock_get_client.return_value = _mock_client(
        list_runners={"success": False, "error": "nope"},
        list_workflows={"success": True, "data": {"action_runs": []}},
        list_notifications={"success": True, "data": []},
    )
    assert "nope" in (await forgejo_actions(action="runners"))["message"]
    assert (await forgejo_actions(action="workflow_runs", owner="o", repo="r"))["data"] == {"runs": []}
    assert (await forgejo_actions(action="notifications"))["data"] == {"notifications": []}
    mock_get_client.side_effect = ValueError("No active profile")
    assert (await forgejo_actions(action="runners"))["success"] is False


# ── web.py profile CRUD + proxy error paths ──────────────────────────────────


@patch("forgejo_mcp.web.registry")
def test_profile_crud_endpoints(mock_registry):
    mock_registry.add_profile.return_value = None
    mock_registry.set_active.return_value = True
    mock_registry.remove_profile.return_value = True

    payload = {"name": "n", "url": "https://codeberg.org", "token": "t", "label": "L"}
    assert client.post("/api/profiles", json=payload).status_code == 200
    assert client.post("/api/profiles/active", json={"name": "n"}).status_code == 200
    assert client.delete("/api/profiles/n").status_code == 200

    mock_registry.add_profile.side_effect = ValueError("bad url")
    assert client.post("/api/profiles", json=payload).status_code == 400
    mock_registry.set_active.return_value = False
    assert client.post("/api/profiles/active", json={"name": "ghost"}).status_code == 404
    mock_registry.remove_profile.return_value = False
    assert client.delete("/api/profiles/ghost").status_code == 404


@patch("forgejo_mcp.web.get_client")
def test_proxy_error_paths(mock_get_client):
    mock_get_client.side_effect = ValueError("No active profile configured.")
    for path in (
        "/api/runners",
        "/api/repos",
        "/api/issues?owner=o&repo=r",
        "/api/pulls?owner=o&repo=r",
        "/api/workflows?owner=o&repo=r",
    ):
        response = client.get(path)
        assert response.status_code == 200
        assert response.json()["success"] is False
