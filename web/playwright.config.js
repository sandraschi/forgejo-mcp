import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
// bun lives off-PATH by design (fleet AGENTS.md); resolve the default install
// location so the Playwright-spawned shell finds it on any machine.
const bunBin = path.join(os.homedir(), '.bun', 'bin', 'bun.exe')
const bunCmd = fs.existsSync(bunBin) ? `"${bunBin}"` : 'bun'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:11132',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: `uv run --project "${repoRoot}" uvicorn forgejo_mcp.server:web_app --host 127.0.0.1 --port 11133`,
      cwd: repoRoot,
      url: 'http://127.0.0.1:11133/health',
      timeout: 120_000,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: `${bunCmd} run dev`,
      cwd: here,
      url: 'http://127.0.0.1:11132',
      timeout: 120_000,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
})
