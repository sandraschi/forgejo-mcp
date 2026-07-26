# start.ps1 - Launcher for forgejo-mcp server and React frontend

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$NoBrowser
)

$ScriptRoot = Split-Path -Parent $PSCommandPath
$WebRoot = Join-Path $ScriptRoot "web"
$BackendPort = 11133
$FrontendPort = 11132

# --- Helper function to find and stop process on a port ---
function Stop-PortListener {
    param([int]$Port)
    $pids = [System.Collections.Generic.HashSet[int]]::new()
    $needle = ":$Port"
    $raw = cmd /c "netstat -ano -p TCP 2>nul | findstr `"$needle`" | findstr LISTENING"
    if ($raw) {
        foreach ($line in ($raw -split "`r?`n")) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            $parts = ($line.Trim() -split '\s+')
            if ($parts.Count -lt 5) { continue }
            $procId = 0
            if ([int]::TryParse($parts[-1], [ref]$procId) -and $procId -gt 4) {
                [void]$pids.Add($procId)
            }
        }
    }
    foreach ($pid in $pids) {
        if ($pid -eq $PID) { continue }
        Write-Host "Stopping process holding port $Port (PID: $pid)..." -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    if ($pids.Count -gt 0) {
        Start-Sleep -Milliseconds 300
    }
}

# --- Teardown Conflicting Ports ---
Write-Host "Cleaning up ports $FrontendPort and $BackendPort..." -ForegroundColor Cyan
Stop-PortListener -Port $FrontendPort
Stop-PortListener -Port $BackendPort

# --- Setup Python Environment ---
if (-not $FrontendOnly) {
    Write-Host "Verifying backend dependencies..." -ForegroundColor Cyan
    if (-not (Test-Path (Join-Path $ScriptRoot ".venv"))) {
        Write-Host "Virtual environment not found. Initializing..." -ForegroundColor Yellow
        & uv venv
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Failed to create virtual environment" -ForegroundColor Red
            exit 1
        }
    }
    
    # Check if package is installed in editable mode or install it
    Write-Host "Syncing backend dependencies with uv..." -ForegroundColor Yellow
    & uv pip install -e ".[dev]"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install backend dependencies" -ForegroundColor Red
        exit 1
    }
}

# --- Launch Python Backend ---
if (-not $FrontendOnly) {
    Write-Host "Launching Python MCP backend on port $BackendPort..." -ForegroundColor Green
    
    # Run backend in a separate background window
    $backendCmd = "uv"
    $backendArgs = @("run", "python", "-m", "forgejo_mcp")
    
    # Set environment variables for the backend process
    $envVars = @{
        "WEB_PORT" = "$BackendPort"
        "WEB_HOST" = "127.0.0.1"
        "MCP_TRANSPORT" = "stdio" # Standard mode starts stdio and FastAPI HTTP in thread
    }
    
    # Form command line for Start-Process
    $argList = @("/c", "set WEB_PORT=$BackendPort && set WEB_HOST=127.0.0.1 && set MCP_TRANSPORT=stdio && uv run python -m forgejo_mcp")
    Start-Process -FilePath "cmd.exe" -ArgumentList $argList -NoNewWindow:$false
    
    # Wait for backend to bind and respond
    Write-Host "Waiting for backend to be ready..." -ForegroundColor Yellow
    $retries = 30
    $backendReady = $false
    while ($retries -gt 0 -and -not $backendReady) {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/health" -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $backendReady = $true
            }
        } catch {}
        if (-not $backendReady) {
            Start-Sleep -Seconds 1
            $retries--
        }
    }
    
    if (-not $backendReady) {
        Write-Host "ERROR: Backend failed to start or respond on port $BackendPort within 30 seconds." -ForegroundColor Red
        exit 1
    }
    Write-Host "Backend is ready!" -ForegroundColor Green
}

# --- Launch Frontend ---
if (-not $BackendOnly) {
    if (-not (Test-Path $WebRoot)) {
        Write-Host "ERROR: Frontend folder 'web' does not exist." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Verifying frontend dependencies..." -ForegroundColor Cyan
    if (-not (Test-Path (Join-Path $WebRoot "node_modules"))) {
        Write-Host "node_modules not found in web folder. Installing with bun..." -ForegroundColor Yellow
        Set-Location $WebRoot
        & bun install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Frontend install failed" -ForegroundColor Red
            Set-Location $ScriptRoot
            exit 1
        }
        Set-Location $ScriptRoot
    }
    
    if (-not $NoBrowser) {
        # Launch browser to frontend URL when ready
        $frontendUrl = "http://127.0.0.1:$FrontendPort"
        Write-Host "Will open browser to $frontendUrl" -ForegroundColor Gray
        Start-ThreadJob -ScriptBlock {
            param($url)
            Start-Sleep -Seconds 2
            Start-Process $url
        } -ArgumentList $frontendUrl | Out-Null
    }
    
    Write-Host "Starting Vite frontend dev server on port $FrontendPort..." -ForegroundColor Green
    Set-Location $WebRoot
    & bun run dev -- --port $FrontendPort --host 127.0.0.1 --strictPort
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Vite server exited with code $LASTEXITCODE" -ForegroundColor Red
        Set-Location $ScriptRoot
        exit $LASTEXITCODE
    }
    Set-Location $ScriptRoot
}
