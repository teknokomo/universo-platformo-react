import fs from 'fs'
import path from 'path'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createBootstrapApiContext,
    disposeBootstrapApiContext,
    getBootstrapCredentials,
    resolvePrimaryInstance
} from '../../support/backend/bootstrap.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'

const SCREENSHOT_DIRECTORIES = [
    path.resolve(repoRoot, 'docs', 'en', '.gitbook', 'assets', 'platform'),
    path.resolve(repoRoot, 'docs', 'ru', '.gitbook', 'assets', 'platform')
] as const

const ADMIN_COPY = {
    en: {
        settings: 'Settings',
        rolesHeading: /Roles|Role Management/i,
        metahubs: 'Metahubs'
    },
    ru: {
        settings: 'Настройки',
        rolesHeading: /Роли|Управление ролями/i,
        metahubs: 'Метахабы'
    }
} as const

function ensureScreenshotDirectories() {
    for (const screenshotsDir of SCREENSHOT_DIRECTORIES) {
        fs.mkdirSync(screenshotsDir, { recursive: true })
    }
}

test('@generator capture admin documentation screenshots for docs', async ({ browser }) => {
    test.setTimeout(180_000)
    ensureScreenshotDirectories()

    const api = await createBootstrapApiContext()
    const instance = await resolvePrimaryInstance(api)

    try {
        for (const locale of ['en', 'ru'] as const) {
            const labels = ADMIN_COPY[locale]
            const adminSession = await createLoggedInBrowserContext(browser, getBootstrapCredentials(), {
                basePathAfterLogin: '/admin'
            })

            try {
                const page = adminSession.page
                const screenshotsDir = path.resolve(repoRoot, 'docs', locale, '.gitbook', 'assets', 'platform')

                await applyBrowserPreferences(page, { language: locale, isDarkMode: false })

                await page.goto(`/admin/instance/${instance.id}/settings`)
                await expect(page.getByRole('heading', { level: 1, name: labels.settings })).toBeVisible({ timeout: 30_000 })
                await page.getByRole('tab', { name: labels.metahubs }).click()
                await expect(page.getByRole('tab', { name: labels.metahubs })).toHaveAttribute('aria-selected', 'true')
                await page.screenshot({ path: path.join(screenshotsDir, 'admin-settings.png') })

                await page.goto(`/admin/instance/${instance.id}/roles`)
                await expect(page.getByRole('heading', { name: labels.rolesHeading })).toBeVisible({ timeout: 30_000 })
                await page.screenshot({ path: path.join(screenshotsDir, 'admin-roles.png') })

                for (const screenshotName of ['admin-settings.png', 'admin-roles.png']) {
                    const screenshotPath = path.join(screenshotsDir, screenshotName)
                    expect(fs.existsSync(screenshotPath)).toBe(true)
                    expect(fs.statSync(screenshotPath).size).toBeGreaterThan(0)
                }
            } finally {
                await adminSession.context.close().catch(() => undefined)
            }
        }
    } finally {
        await disposeBootstrapApiContext(api)
    }
})
