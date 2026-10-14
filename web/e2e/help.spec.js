import { expect, test } from '@playwright/test'

const TABS = ['overview', 'wrappee', 'api', 'troubleshoot', 'faq', 'mcp', 'chat']

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-help').click()
  await expect(page.getByTestId('help-tabs')).toBeVisible()
})

for (const tab of TABS) {
  test(`help tab ${tab} renders content`, async ({ page }) => {
    await page.getByTestId(`help-tab-${tab}`).click()
    await expect(page.locator('main')).not.toBeEmpty()
  })
}

test('help overview shows architecture and page map', async ({ page }) => {
  await expect(page.getByText(':11133 (/api/*, /mcp, /docs)')).toBeVisible()
  await expect(page.getByText('Repositories', { exact: true }).first()).toBeVisible()
})

test('help wrappee names the forges and verification path', async ({ page }) => {
  await page.getByTestId('help-tab-wrappee').click()
  await expect(page.getByText('127.0.0.1:11243')).toBeVisible()
  await expect(page.getByText('docs/ONBOARDING.md')).toBeVisible()
})

test('help troubleshoot filter narrows to the 401 entry', async ({ page }) => {
  await page.getByTestId('help-tab-troubleshoot').click()
  await page.getByTestId('help-search').fill('401 on every API call')
  await expect(page.getByTestId('help-fixes')).toContainText('Expired or revoked PAT')
  await expect(page.getByTestId('help-fixes')).not.toContainText('Playwright: Error')
})

test('help faq accordion opens and filter narrows', async ({ page }) => {
  await page.getByTestId('help-tab-faq').click()
  await page.getByTestId('help-search-faq').fill('code change')
  const items = page.getByTestId('faq-item')
  await expect(items).toHaveCount(1)
  await items.first().click()
  await expect(items.first()).toContainText('start.ps1')
})

test('help page has no client errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await page.goto('/')
  await page.getByTestId('nav-help').click()
  for (const tab of TABS) {
    await page.getByTestId(`help-tab-${tab}`).click()
  }
  expect(errors).toEqual([])
})
