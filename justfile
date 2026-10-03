set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

import 'scripts/just/fleet.just'

# justfile for forgejo-mcp

# Default command: list tasks
default:
    @just --list

# Initialize the virtual environment and install dependencies
setup:
    uv venv
    uv pip install -e ".[dev]"

# Run the MCP server in STDIO mode (default)
run:
    uv run python -m forgejo_mcp

# Run the MCP server in HTTP mode
run-http:
    $env:MCP_TRANSPORT="http"; uv run python -m forgejo_mcp

# Format code using ruff
fmt:
    uv run ruff format src/ tests/

# Lint code using ruff
lint:
    uv run ruff check src/ tests/

# Run test suite
test:
    uv run pytest tests/

# Fleet gates: ruff + pytest + pyright + oxlint (web is JSX, no tsc/biome)
ci:
    uv run ruff check src/ tests/
    uv run ruff format --check src/ tests/
    uv run pyright src/
    uv run pytest tests/ -q
    cd web; npm run lint

# Build frontend production bundle
build-frontend:
    cd web; bun install; bun run build

# Perform complete build (frontend and python wheel)
build-all: build-frontend
    uv build

# Bootstrap: install dev deps + pre-commit hook
bootstrap:
    uv sync --group dev
    uv run pre-commit install
    Write-Host "Pre-commit hooks installed." -ForegroundColor Green
