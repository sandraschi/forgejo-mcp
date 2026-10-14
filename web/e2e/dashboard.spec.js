import { expect, test } from '@playwright/test'

test('dashboard boots with sidebar and KPIs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('sidebar-toggle')).toBeVisible()
  await expect(page.getByTestId('nav-dashboard')).toBeVisible()
  // KPI labels render regardless of backend profile state (exact: nav labels differ by case)
  await expect(page.getByText('ACTIVE PROFILE', { exact: true })).toBeVisible()
  await expect(page.getByText('REPOSITORIES', { exact: true })).toBeVisible()
  await expect(page.getByText('ONLINE RUNNERS', { exact: true })).toBeVisible()
})

test('backend health is reachable through the proxy', async ({ request }) => {
  const res = await request.get('/api/status')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.service).toBe('forgejo-mcp')
  expect(body.tool_count).toBe(7)
})
