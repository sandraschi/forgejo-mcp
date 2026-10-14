import { expect, test } from '@playwright/test'

const VIEWS = [
  'dashboard',
  'inbox',
  'profiles',
  'repositories',
  'runners',
  'tools',
  'skills',
  'chat',
  'settings',
  'logs',
  'help'
]

for (const view of VIEWS) {
  test(`nav walk reaches ${view}`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId(`nav-${view}`).click()
    // Every view renders its heading or gate text without a blank crash page
    await expect(page.locator('main')).not.toBeEmpty()
  })
}

test('tools page lists live capabilities', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-tools').click()
  await expect(page.getByTestId('tool-card-forgejo_profiles')).toBeVisible()
  await expect(page.getByTestId('tool-card-forgejo_prs')).toBeVisible()
  await page.getByTestId('search-tools').fill('notif')
  await expect(page.getByTestId('tool-card-forgejo_profiles')).toBeHidden()
  await expect(page.getByTestId('tool-card-forgejo_actions')).toBeVisible()
})

test('chat page shows skill-first controls and examples', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-chat').click()
  await expect(page.getByTestId('chat-page')).toBeVisible()
  await expect(page.getByTestId('personality-select')).toBeVisible()
  await expect(page.getByTestId('llm-provider-select')).toBeVisible()
  await expect(page.getByTestId('llm-model-select')).toBeVisible()
  await expect(page.getByTestId('example-prompts')).toBeVisible()
  await expect(page.getByTestId('chat-input')).toBeVisible()
})

test('settings shows service status and onboarding cue without profiles', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-settings').click()
  await expect(page.getByTestId('llm-provider-select')).toBeVisible()
  await expect(page.getByTestId('llm-model-select')).toBeVisible()
  // Fresh backend has no profiles: the onboarding cue must appear
  await expect(page.getByTestId('onboarding-cue')).toBeVisible()
})

test('logs page renders level filter and refresh', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-logs').click()
  await expect(page.getByTestId('logs-level')).toBeVisible()
  await expect(page.getByTestId('logs-refresh')).toBeVisible()
})

test('profile form rejects empty submission', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-profiles').click()
  await page.getByTestId('profile-add').click()
  await expect(page.getByText('All fields are required.')).toBeVisible()
})
