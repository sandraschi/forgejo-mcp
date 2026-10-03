# Per-repo fleet start config for forgejo-mcp
# Edit ports/backend target here - start.ps1 is fleet-standard.
@{
    Name         = 'forgejo-mcp'
    BackendPort  = 11133
    FrontendPort = 11132
    HealthPath   = '/health'
    WebRoot      = 'web'
    Backend = @{
        Kind          = 'uvicorn-web-app'
        UvicornTarget = 'forgejo_mcp.server:web_app'
        SyncExtras    = @('dev')
        Env           = @{ WEB_PORT = '11133' }
    }
    Frontend = @{
        Kind           = 'vite-npm'
        PackageManager = 'npm'
        PortEnvVar     = 'VITE_PORT'
        ApiTargetEnv   = 'VITE_API_TARGET'
    }
}
