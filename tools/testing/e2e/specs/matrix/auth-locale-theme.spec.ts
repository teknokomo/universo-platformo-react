import { expect, test } from '@playwright/test'
import { authSelectors } from '../../support/selectors/contracts'
import { applyBrowserPreferences, calculateRelativeBrightness } from '../../support/browser/preferences'

test.use({ storageState: { cookies: [], origins: [] } })

test('@smoke auth page renders in Russian and respects the requested light/dark theme', async ({ page }, testInfo) => {
    const isDarkProject = testInfo.project.name === 'ru-dark'

    await applyBrowserPreferences(page, {
        language: 'ru',
        isDarkMode: isDarkProject
    })

    await page.goto('/auth')

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page.getByTestId(authSelectors.submitButton)).toContainText('Войти')

    const backgroundColor = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
    const brightness = calculateRelativeBrightness(backgroundColor)

    expect(brightness).not.toBeNull()
    if (typeof brightness !== 'number') {
        throw new Error(`Unable to derive page brightness from ${backgroundColor}`)
    }

    if (isDarkProject) {
        expect(brightness).toBeLessThan(140)
    } else {
        expect(brightness).toBeGreaterThan(180)
    }
})
