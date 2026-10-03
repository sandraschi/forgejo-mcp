# Run CUA-NSIS smoke test (install -> launch -> nav walk -> uninstall)
# Self-contained: resolves repo root from its own location (scripts/just/.. = repo root).
# NOTE: Join-Path's multi-segment form (3+ positional args / -AdditionalChildPath) is
# PowerShell 7+ only. Fleet recipes invoke via `powershell.exe` (Windows PowerShell 5.1,
# per the fleet's own "no bare pwsh" rule), where that form throws
# "A positional parameter cannot be found that accepts argument '..'." Use a single
# child-path string instead — works on both 5.1 and 7+.
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repoRoot
if (Test-Path ".venv\Scripts\python.exe") {
    & ".venv\Scripts\python.exe" scripts/cua-smoke.py
} else {
    & py scripts/cua-smoke.py
}
exit $LASTEXITCODE
