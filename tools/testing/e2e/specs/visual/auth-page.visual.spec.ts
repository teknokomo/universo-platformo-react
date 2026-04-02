import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('@visual auth page layout remains stable', async ({ page }) => {
    await page.goto('/auth')
    await expect(page).toHaveScreenshot('auth-page.png', {
        fullPage: true,
        animations: 'disabled'
    })
})
