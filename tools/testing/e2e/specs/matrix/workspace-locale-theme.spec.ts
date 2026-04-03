import { expect, test } from '@playwright/test'
import { getBootstrapCredentials } from '../../support/backend/bootstrap.mjs'
import { readRunManifest } from '../../support/backend/run-manifest.mjs'
import { loginThroughUi } from '../../support/browser/auth'
import { applyBrowserPreferences, calculateRelativeBrightness } from '../../support/browser/preferences'
import { storageStatePath } from '../../support/env/load-e2e-env.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'

function expectValidBrightness(brightness: number | null, backgroundColor: string): asserts brightness is number {
    expect(brightness).not.toBeNull()

    if (typeof brightness !== 'number') {
        throw new Error(`Unable to derive page brightness from ${backgroundColor}`)
    }
}

async function expectBrightnessForTheme(page: import('@playwright/test').Page, isDarkProject: boolean) {
    const backgroundColor = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
    const brightness = calculateRelativeBrightness(backgroundColor)

    expectValidBrightness(brightness, backgroundColor)

    if (isDarkProject) {
        expect(brightness).toBeLessThan(140)
    } else {
        expect(brightness).toBeGreaterThan(180)
    }
}

test('@smoke authenticated metahubs workspace renders in Russian and respects the requested light/dark theme', async ({
    browser
}, testInfo) => {
    const isDarkProject = testInfo.project.name === 'ru-dark'
    const manifest = await readRunManifest()

    if (!manifest?.testUser?.email) {
        throw new Error('E2E run manifest is missing the disposable test user')
    }

    const context = await browser.newContext({ storageState: storageStatePath })
    const page = await context.newPage()

    try {
        await applyBrowserPreferences(page, {
            language: 'ru',
            isDarkMode: isDarkProject
        })

        await page.goto('/metahubs')

        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(page.getByRole('heading', { name: 'Метахабы' })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toContainText('Создать')

        await expectBrightnessForTheme(page, isDarkProject)
    } finally {
        await context.close()
    }
})

test('@smoke bootstrap admin pages render in Russian and respect the requested light/dark theme', async ({ browser }, testInfo) => {
    const isDarkProject = testInfo.project.name === 'ru-dark'
    const context = await browser.newContext({
        storageState: {
            cookies: [],
            origins: []
        }
    })
    const page = await context.newPage()

    try {
        await applyBrowserPreferences(page, {
            language: 'ru',
            isDarkMode: isDarkProject
        })

        await loginThroughUi(page, getBootstrapCredentials(), {
            authPath: '/auth'
        })

        await page.goto('/admin')

        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(page.getByRole('heading', { name: 'Экземпляры' })).toBeVisible()

        await expectBrightnessForTheme(page, isDarkProject)
    } finally {
        await context.close()
    }
})
