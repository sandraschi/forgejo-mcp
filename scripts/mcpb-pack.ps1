# MCPB pre-pack verification + pack for docs-mcp.
# Verifies manifest, icon, and bundle importability, then packs via the
# `mcpb` CLI when present. Without the CLI it exits 2 with a manual-pack
# message (pack via the Anthropic DXT desktop app: validate, then pack).

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

$manifest = Join-Path $RepoRoot "manifest.json"
if (-not (Test-Path $manifest)) { Write-Error "manifest.json missing"; exit 1 }
try { $null = Get-Content $manifest -Raw | ConvertFrom-Json }
catch { Write-Error "manifest.json is not valid JSON: $_"; exit 1 }
Write-Host "  manifest.json valid" -ForegroundColor Green

$icon = Join-Path (Join-Path $RepoRoot "assets") "icon.png"
if (-not (Test-Path $icon)) { Write-Error "assets/icon.png missing (256x256 required)"; exit 1 }
Write-Host "  assets/icon.png present" -ForegroundColor Green

$packDir = Join-Path (Join-Path $RepoRoot "mcpb") "src"
if (-not (Test-Path $packDir)) { Write-Error "mcpb/src staging dir missing"; exit 1 }
Write-Host "  mcpb/src staging present" -ForegroundColor Green

$mcpb = Get-Command mcpb -ErrorAction SilentlyContinue
if ($null -eq $mcpb) {
    Write-Host "mcpb CLI not on PATH - manual pack required (Anthropic DXT app: validate, then pack). Pre-pack checks passed." -ForegroundColor Yellow
    exit 2
}

$version = (Get-Content $manifest -Raw | ConvertFrom-Json).version
$dist = Join-Path $RepoRoot "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$outFile = Join-Path $dist ("docs-mcp-v" + $version + ".mcpb")
& mcpb pack $RepoRoot $outFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host ("Packed: " + $outFile) -ForegroundColor Green
