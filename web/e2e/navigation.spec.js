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

test('settings shows service status and onboarding cue without profiles', async ({ page, request }) => {
  await page.goto('/')
  await page.getByTestId('nav-settings').click()
  await expect(page.getByTestId('llm-provider-select')).toBeVisible()
  await expect(page.getByTestId('llm-model-select')).toBeVisible()
  // Onboarding cue tracks live profile state: visible on a fresh backend,
  // hidden once any profile exists (e.g. a dev machine with a local forge).
  const profiles = await (await request.get('/api/profiles')).json()
  const hasProfiles = Object.keys(profiles.profiles || {}).length > 0
  if (hasProfiles) {
    await expect(page.getByTestId('onboarding-cue')).toBeHidden()
  } else {
    await expect(page.getByTestId('onboarding-cue')).toBeVisible()
  }
})

test('logs page renders level filter and refresh', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-logs').click()
  await expect(page.getByTestId('logs-level')).toBeVisible()
  await expect(page.getByTestId('logs-refresh')).toBeVisible()
})

test('logs webhooks tab lists deliveries (empty state without secret traffic)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-logs').click()
  await page.getByTestId('logs-tab-webhooks').click()
  await expect(page.getByText('No webhook deliveries yet.')).toBeVisible()
})

test('shutdown button arms but never fires on one click', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-settings').click()
  const button = page.getByTestId('shutdown-backend')
  await expect(button).toBeVisible()
  await expect(button).toContainText('Shut down backend')
  await button.click()
  await expect(button).toContainText('Click again to confirm shutdown')
  // Deliberately no second click: the backend running this suite must survive.
})

test('repositories view gates on missing profile', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-repositories').click()
  await expect(page.getByText('Select an active profile in the top bar to view repositories.')).toBeVisible()
})

test('profile form rejects empty submission', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-profiles').click()
  await page.getByTestId('profile-add').click()
  await expect(page.getByText('All fields are required.')).toBeVisible()
})

test('onboarding panel covers both forge paths', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-profiles').click()
  await expect(page.getByTestId('onboarding-tab-local')).toBeVisible()
  // Auto-probe of the default local URL resolves to either state
  await expect(page.getByTestId('local-probe-result')).toContainText(/Reachable|Not reachable/, {
    timeout: 20000
  })
  await page.getByTestId('onboarding-tab-codeberg').click()
  await expect(page.getByText('Create a free account at')).toBeVisible()
  await page.getByTestId('onboarding-tab-local').click()
  await expect(page.getByTestId('local-probe-check')).toBeVisible()
})
