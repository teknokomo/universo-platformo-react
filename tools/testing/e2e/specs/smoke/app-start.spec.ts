import { expect, test } from '@playwright/test'
import { authSelectors } from '../../support/selectors/contracts'

test.use({ storageState: { cookies: [], origins: [] } })

test('@smoke auth page is rendered for anonymous users', async ({ page }) => {
    await page.goto('/auth')

    await expect(page.getByTestId(authSelectors.emailInput)).toBeVisible()
    await expect(page.getByTestId(authSelectors.passwordInput)).toBeVisible()
    await expect(page.getByTestId(authSelectors.submitButton)).toBeVisible()
})
