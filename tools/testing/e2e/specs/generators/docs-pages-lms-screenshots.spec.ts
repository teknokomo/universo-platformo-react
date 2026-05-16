/**
 * Documentation screenshot generator for Pages entity and LMS features.
 *
 * Captures PNG screenshots of:
 * - Pages entity with Editor.js integration
 * - LMS dashboard and workflows
 * - Ledgers functionality
 *
 * For both EN and RU locales.
 *
 * Usage:
 *   npx playwright test --project=chromium tools/testing/e2e/specs/generators/docs-pages-lms-screenshots.spec.ts
 */
import fs from 'fs'
import path from 'path'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    createEntity,
    listEntities
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { createLocalizedContent } from '@universo/utils'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const SCREENSHOT_DIRECTORIES = [
    'docs/en/.gitbook/assets/entities',
    'docs/ru/.gitbook/assets/entities',
    'docs/en/.gitbook/assets/lms',
    'docs/ru/.gitbook/assets/lms',
    'docs/en/.gitbook/assets/platform',
    'docs/ru/.gitbook/assets/platform'
]

function ensureDirectories() {
    for (const dir of SCREENSHOT_DIRECTORIES) {
        const absolute = path.join(repoRoot, dir)
        if (!fs.existsSync(absolute)) {
            fs.mkdirSync(absolute, { recursive: true })
        }
    }
}

async function captureScreenshot(page: import('@playwright/test').Page, locale: string, category: string, name: string) {
    const dir = path.join(repoRoot, `docs/${locale}/.gitbook/assets/${category}`)
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true })
}

const UI_COPY = {
    en: {
        pages: 'Pages',
        content: 'Content',
        createEntity: 'Create Entity',
        selectTemplate: 'Select template',
        ledgers: 'Ledgers',
        facts: 'Facts',
        applications: 'Applications'
    },
    ru: {
        pages: 'Страницы',
        content: 'Контент',
        createEntity: 'Создать сущность',
        selectTemplate: 'Выберите шаблон',
        ledgers: 'Регистры',
        facts: 'Факты',
        applications: 'Приложения'
    }
} as const

test('@generator capture Pages and LMS documentation screenshots for EN and RU locales', async ({ page, runManifest }) => {
    test.setTimeout(300_000)
    ensureDirectories()

    const ctx: ApiContext = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahubName = `Docs Pages LMS ${runManifest.runId}`
        const metahubCodename = `docs-pages-lms-${String(runManifest.runId).toLowerCase()}`

        // Create metahub with basic template
        const metahub = await createMetahub(ctx, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            description: { en: 'Pages and LMS documentation screenshots metahub' },
            descriptionPrimaryLocale: 'en',
            templateCodename: 'basic'
        })

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const metahubId = metahub.id

        // Create a Page entity for screenshots
        const pageEntity = await createEntity(ctx, metahubId, {
            kindKey: 'page',
            codename: createLocalizedContent('en', 'sample-page'),
            presentation: {
                name: { en: 'Sample Page', ru: 'Пример страницы' },
                description: { en: 'A sample page for documentation', ru: 'Пример страницы для документации' }
            }
        })

        for (const locale of ['en', 'ru'] as const) {
            const uiCopy = UI_COPY[locale]
            await applyBrowserPreferences(page, { language: locale, isDarkMode: false })

            // 1. Pages entity list
            await page.goto(`/metahub/${metahubId}/entities/page/instances`)
            await expect(page.getByRole('heading', { name: uiCopy.pages })).toBeVisible({ timeout: 30_000 })
            await captureScreenshot(page, locale, 'entities', 'pages-list')

            // 2. Pages content editor (if entity was created)
            if (pageEntity?.id) {
                await page.goto(`/metahub/${metahubId}/entities/page/instance/${pageEntity.id}/content`)
                await expect(page.getByRole('heading', { name: uiCopy.content })).toBeVisible({ timeout: 30_000 })

                // Wait for Editor.js to load
                // Wait for Editor.js to load and take a screenshot
                const editorContainer = page.locator('[data-testid="editor-js-container"]').or(page.locator('.codex-editor'))
                await expect(editorContainer).toBeVisible({ timeout: 10000 })
                await captureScreenshot(page, locale, 'entities', 'pages-editor')
            }

            // 3. Ledgers list (if any exist)
            const ledgers = await listEntities(ctx, metahubId, { kindKey: 'ledger', limit: 10, offset: 0 })
            if (ledgers?.items?.length > 0) {
                await page.goto(`/metahub/${metahubId}/entities/ledger/instances`)
                await expect(page.getByRole('heading', { name: uiCopy.ledgers })).toBeVisible({ timeout: 30_000 })
                await captureScreenshot(page, locale, 'platform', 'ledgers-list')

                // Navigate to first ledger facts
                const ledger = ledgers.items[0]
                await page.goto(`/metahub/${metahubId}/entities/ledger/instance/${ledger.id}/facts`)
                await expect(page.getByRole('heading', { name: uiCopy.facts })).toBeVisible({ timeout: 30_000 })
                await captureScreenshot(page, locale, 'platform', 'ledger-facts')
            }

            // 4. Applications list
            await page.goto('/applications')
            await expect(page.getByRole('heading', { name: uiCopy.applications })).toBeVisible({ timeout: 30_000 })
            await captureScreenshot(page, locale, 'platform', 'applications-list-updated')
        }
    } finally {
        await disposeApiContext(ctx)
    }
})
