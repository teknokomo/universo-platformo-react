import fs from 'fs/promises'
import { expect, test } from '@playwright/test'
import { cleanupE2eRun } from '../../support/backend/e2eCleanup.mjs'
import { provisionE2eRun } from '../../support/backend/e2eProvisioning.mjs'
import { authSelectors } from '../../support/selectors/contracts'
import { loadE2eEnvironment, storageStatePath } from '../../support/env/load-e2e-env.mjs'

test('provisions a fresh e2e user and stores authenticated browser state', async ({ page }) => {
    loadE2eEnvironment()

    await cleanupE2eRun({ quiet: true })
    const manifest = await provisionE2eRun()

    await fs.rm(storageStatePath, { force: true })

    await page.goto(process.env.E2E_AUTH_PATH || '/auth')
    await page.getByTestId(authSelectors.emailInput).fill(manifest.testUser.email)
    await page.getByTestId(authSelectors.passwordInput).fill(manifest.testUser.password)
    await page.getByTestId(authSelectors.submitButton).click()

    await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible({ timeout: 30000 })

    await page.context().storageState({ path: storageStatePath })
})
