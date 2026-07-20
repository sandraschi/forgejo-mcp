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
    $env:MCP_TRANSPORT="http" && uv run python -m forgejo_mcp

# Format code using ruff
fmt:
    uv run ruff format src/ tests/

# Lint code using ruff
lint:
    uv run ruff check src/ tests/

# Run test suite
test:
    uv run pytest tests/

# Build frontend production bundle
build-frontend:
    cd web && bun install && bun run build

# Perform complete build (frontend and python wheel)
build-all: build-frontend
    uv build
