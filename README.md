# forgejo-mcp

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![FastMCP 3.4.4+](https://img.shields.io/badge/FastMCP-3.4.4+-orange.svg)](https://github.com/modelcontextprotocol/sdk)

A Model Context Protocol (MCP) server designed to connect LLM agents to Forgejo and Codeberg instances. It includes a companion fullstack React web application built following fleet SOTA standards.

## Features
- **Multi-Profile Configuration**: Connect to multiple Forgejo / Codeberg instances simultaneously and switch profiles dynamically.
- **Repository Management**: List repositories, search, and create repositories.
- **Issue Tracking & PRs**: Create issues, post comments, list and merge PRs, and review diffs.
- **Actions Runner Monitoring**: Check the health and version of self-hosted `forgejo-runner` agents, and inspect active/historical workflow runs.
- **Companion Dashboard**: Responsive webapp showing status KPIs, repository browser, log visualizer, and local LLM "Glom On" auto-binding (Ollama).

## Setup & Running

### Requirements
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- [Bun](https://bun.sh) (JS package manager and runtime)
- Forgejo / Codeberg account with a Personal Access Token (PAT)

### Quick Start
1. Double-click `start.bat` or run the PowerShell script:
   ```powershell
   ./start.ps1
   ```
2. The launcher will automatically resolve port conflicts, sync python and node dependencies, launch the background Python backend (port `10761`), and run the Vite frontend development server (port `10760`).
3. Your default web browser will open to `http://localhost:10760`.

## MCP Tools Reference
- `forgejo_profile_list` / `forgejo_profile_add` / `forgejo_profile_set_active`
- `forgejo_repo_list` / `forgejo_repo_create` / `forgejo_repo_search`
- `forgejo_issue_list` / `forgejo_issue_create` / `forgejo_issue_comment`
- `forgejo_pr_list` / `forgejo_pr_create` / `forgejo_pr_merge` / `forgejo_pr_diff`
- `forgejo_runner_list` / `forgejo_workflow_runs`
- `forgejo_file_get`
