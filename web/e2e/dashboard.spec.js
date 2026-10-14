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

test('dashboard hero describes the app with live version', async ({ page }) => {
  await page.goto('/')
  const hero = page.getByTestId('dashboard-hero')
  await expect(hero).toBeVisible()
  await expect(hero).toContainText('Forgejo Companion')
  await expect(hero).toContainText('v0.2.0')
  await expect(hero).toContainText('self-hosted')
  await expect(hero).toContainText('Codeberg')
})

test('quick actions navigate without a profile', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('quick-action-inbox').click()
  await expect(page.getByText('Select an active profile in the top bar to read notifications.')).toBeVisible()
  await page.getByTestId('nav-dashboard').click()
  await page.getByTestId('quick-action-chat').click()
  await expect(page.getByTestId('chat-page')).toBeVisible()
  await page.getByTestId('nav-dashboard').click()
  await page.getByTestId('quick-action-repos').click()
  await expect(page.getByText('Select an active profile in the top bar to view repositories.')).toBeVisible()
})

test('recent warnings box links to the logs page', async ({ page }) => {
  await page.goto('/')
  const box = page.getByTestId('dashboard-recent-logs')
  await expect(box).toBeVisible()
  await box.getByTestId('recent-logs-view-all').click()
  await expect(page.getByTestId('logs-level')).toBeVisible()
})

test('backend health is reachable through the proxy', async ({ request }) => {
  const res = await request.get('/api/status')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.service).toBe('forgejo-mcp')
  expect(body.tool_count).toBe(7)
})
