/**
 * Documentation screenshot generator for entity-first architecture.
 *
 * Captures PNG screenshots of the entity workspace, create dialogs,
 * entity instance lists, metadata tabs, and delete dialogs
 * for both EN and RU locales.
 *
 * Usage:
 *   npx playwright test --project=chromium tools/testing/e2e/specs/generators/docs-entity-screenshots.spec.ts
 */
import fs from 'fs'
import path from 'path'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    listLinkedCollections,
    listTreeEntities,
    listValueGroups,
    listOptionLists
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'
import { createLocalizedContent } from '@universo/utils'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const SCREENSHOT_DIRECTORIES = [
    'docs/en/.gitbook/assets/entities',
    'docs/ru/.gitbook/assets/entities'
]

function ensureDirectories() {
    for (const dir of SCREENSHOT_DIRECTORIES) {
        const absolute = path.join(repoRoot, dir)
        if (!fs.existsSync(absolute)) {
            fs.mkdirSync(absolute, { recursive: true })
        }
    }
}

async function captureScreenshot(page: import('@playwright/test').Page, locale: string, name: string) {
    const dir = path.join(repoRoot, `docs/${locale}/.gitbook/assets/entities`)
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false })
}

const ENTITY_UI_COPY = {
    en: {
        entityTypes: 'Entity Types',
        metahubs: 'Metahubs',
        hubs: 'Hubs',
        fieldDefinitions: 'Field Definitions',
        records: 'Records',
        constants: 'Constants',
        values: 'Values'
    },
    ru: {
        entityTypes: 'Типы сущностей',
        metahubs: 'Метахабы',
        hubs: 'Хабы',
        fieldDefinitions: 'Определения полей',
        records: 'Записи',
        constants: 'Константы',
        values: 'Значения'
    }
} as const

test('@generator capture entity documentation screenshots for EN and RU locales', async ({ page, runManifest }) => {
    test.setTimeout(300_000)
    ensureDirectories()

    const ctx: ApiContext = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    try {
        const metahubName = `Docs Entities ${runManifest.runId}`
        const metahubCodename = `docs-entities-${String(runManifest.runId).toLowerCase()}`
        // Seed a metahub with all standard presets enabled
        const metahub = await createMetahub(ctx, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            description: { en: 'Entity documentation screenshots metahub' },
            descriptionPrimaryLocale: 'en',
            templateCodename: 'basic'
        })
        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const metahubId = metahub.id

        for (const locale of ['en', 'ru'] as const) {
            const uiCopy = ENTITY_UI_COPY[locale]
            await applyBrowserPreferences(page, { language: locale, isDarkMode: false })

            // 1. Entity types workspace
            await page.goto(`/metahub/${metahubId}/entities`)
            await expect(page.getByRole('heading', { name: uiCopy.entityTypes })).toBeVisible({ timeout: 30_000 })
            await captureScreenshot(page, locale, 'entities-workspace')

            // 2. Metahub create dialog (open and capture)
            await page.goto('/metahubs')
            await expect(page.getByRole('heading', { name: uiCopy.metahubs })).toBeVisible({ timeout: 30_000 })
            const createBtn = page.getByTestId(toolbarSelectors.primaryAction)
            if (await createBtn.isVisible()) {
                await createBtn.click()
                await page.waitForSelector('[role="dialog"]', { timeout: 5_000 })
                await captureScreenshot(page, locale, 'metahub-create-dialog')
                await page.keyboard.press('Escape')
            }

            // 3. Navigate to hubs
            await page.goto(`/metahub/${metahubId}/entities/hub/instances`)
            await expect(page.getByRole('heading', { name: uiCopy.hubs })).toBeVisible({ timeout: 30_000 })
            await captureScreenshot(page, locale, 'hub-tree-view')

            const treeEntities = await listTreeEntities(ctx, metahubId, { limit: 100, offset: 0 })
            if (treeEntities?.items?.length > 0) {
                const hub = treeEntities.items[0]

                // 4. Catalogs under hub
                const catalogs = await listLinkedCollections(ctx, metahubId, { limit: 100, offset: 0, treeEntityId: hub.id })
                if (catalogs?.items?.length > 0) {
                    const catalog = catalogs.items[0]
                    await page.goto(`/metahub/${metahubId}/entities/catalog/instance/${catalog.id}/field-definitions`)
                    await expect(page.getByRole('heading', { name: uiCopy.fieldDefinitions })).toBeVisible({ timeout: 30_000 })
                    await captureScreenshot(page, locale, 'field-definition-list')

                    await page.goto(`/metahub/${metahubId}/entities/catalog/instance/${catalog.id}/records`)
                    await expect(page.getByRole('heading', { name: uiCopy.records })).toBeVisible({ timeout: 30_000 })
                    await captureScreenshot(page, locale, 'catalog-records')
                }
            }

            // 5. Sets
            const valueGroups = await listValueGroups(ctx, metahubId, { limit: 100, offset: 0 })
            if (valueGroups?.items?.length > 0) {
                const vg = valueGroups.items[0]
                await page.goto(`/metahub/${metahubId}/entities/set/instance/${vg.id}/fixed-values`)
                await expect(page.getByRole('heading', { name: uiCopy.constants })).toBeVisible({ timeout: 30_000 })
                await captureScreenshot(page, locale, 'set-fixed-values')
            }

            // 6. Enumerations
            const optionLists = await listOptionLists(ctx, metahubId, { limit: 100, offset: 0 })
            if (optionLists?.items?.length > 0) {
                const ol = optionLists.items[0]
                await page.goto(`/metahub/${metahubId}/entities/enumeration/instance/${ol.id}/values`)
                await expect(page.getByRole('heading', { name: uiCopy.values })).toBeVisible({ timeout: 30_000 })
                await captureScreenshot(page, locale, 'enumeration-option-values')
            }
        }
    } finally {
        await disposeApiContext(ctx)
    }
})
