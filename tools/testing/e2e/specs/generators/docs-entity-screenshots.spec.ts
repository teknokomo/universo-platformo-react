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
    createFieldDefinition,
    createFixedValue,
    createLinkedCollection,
    createTreeEntity,
    createValueGroup,
    createOptionList,
    disposeApiContext,
    listLinkedCollections,
    listTreeEntities,
    listValueGroups,
    listOptionLists,
    listFieldDefinitions,
    listFixedValues,
    listRecords
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import {
    entityDialogSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'
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

test('@generator capture entity documentation screenshots for EN and RU locales', async ({ page, runManifest }) => {
    test.setTimeout(300_000)
    ensureDirectories()

    const ctx: ApiContext = await createLoggedInApiContext(page)
    try {
        // Seed a metahub with all standard presets enabled
        const metahub = await createMetahub(ctx, {
            name: createLocalizedContent('Documentation Metahub', 'en'),
            codename: createLocalizedContent('DocsMetahub', 'en'),
            templateCodename: 'basic'
        })
        recordCreatedMetahub(runManifest, metahub.id)

        const metahubId = metahub.id

        for (const locale of ['en', 'ru'] as const) {
            await applyBrowserPreferences(page, { locale })

            // 1. Entity types workspace
            await page.goto(`/metahub/${metahubId}/entities`)
            await page.waitForSelector('[data-testid="entity-types-list"], table tbody', { timeout: 15_000 })
            await captureScreenshot(page, locale, 'entities-workspace')

            // 2. Metahub create dialog (open and capture)
            await page.goto('/metahubs')
            await page.waitForLoadState('networkidle')
            const createBtn = page.locator(toolbarSelectors.createButton)
            if (await createBtn.isVisible()) {
                await createBtn.click()
                await page.waitForSelector('[role="dialog"]', { timeout: 5_000 })
                await captureScreenshot(page, locale, 'metahub-create-dialog')
                await page.keyboard.press('Escape')
            }

            // 3. Navigate to tree entities (hubs)
            const treeEntities = await listTreeEntities(ctx, metahubId)
            if (treeEntities?.items?.length > 0) {
                const hub = treeEntities.items[0]
                await page.goto(`/metahub/${metahubId}/entities/hub/instance/${hub.id}`)
                await page.waitForLoadState('networkidle')
                await captureScreenshot(page, locale, 'hub-tree-view')

                // 4. Linked collections (catalogs) under hub
                const catalogs = await listLinkedCollections(ctx, metahubId, hub.id)
                if (catalogs?.items?.length > 0) {
                    const catalog = catalogs.items[0]
                    await page.goto(`/metahub/${metahubId}/entities/hub/instance/${hub.id}/entities/catalog/instance/${catalog.id}/field-definitions`)
                    await page.waitForLoadState('networkidle')
                    await captureScreenshot(page, locale, 'field-definition-list')

                    await page.goto(`/metahub/${metahubId}/entities/hub/instance/${hub.id}/entities/catalog/instance/${catalog.id}/records`)
                    await page.waitForLoadState('networkidle')
                    await captureScreenshot(page, locale, 'catalog-records')
                }
            }

            // 5. Value groups (sets)
            const valueGroups = await listValueGroups(ctx, metahubId)
            if (valueGroups?.items?.length > 0) {
                const vg = valueGroups.items[0]
                await page.goto(`/metahub/${metahubId}/entities/set/instance/${vg.id}/fixed-values`)
                await page.waitForLoadState('networkidle')
                await captureScreenshot(page, locale, 'set-fixed-values')
            }

            // 6. Option lists (enumerations)
            const optionLists = await listOptionLists(ctx, metahubId)
            if (optionLists?.items?.length > 0) {
                const ol = optionLists.items[0]
                await page.goto(`/metahub/${metahubId}/entities/enumeration/instance/${ol.id}`)
                await page.waitForLoadState('networkidle')
                await captureScreenshot(page, locale, 'enumeration-option-values')
            }
        }
    } finally {
        await disposeApiContext(ctx)
    }
})
