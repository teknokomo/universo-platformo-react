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
    listObjectCollections,
    listTreeEntities,
    listValueGroups,
    listOptionLists
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { pageSpacingSelectors, toolbarSelectors } from '../../support/selectors/contracts'
import { createLocalizedContent } from '@universo/utils'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const SCREENSHOT_DIRECTORIES = ['docs/en/.gitbook/assets/entities', 'docs/ru/.gitbook/assets/entities']

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

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ENTITY_UI_COPY = {
    en: {
        entityTypes: 'Entities',
        metahubs: 'Metahubs',
        resources: 'Resources',
        hubs: 'Hubs',
        components: 'Components',
        records: 'Records',
        constants: 'Constants',
        values: 'Values',
        createEntityType: 'Create Entity',
        selectTemplate: 'Select template',
        objects: 'Objects'
    },
    ru: {
        entityTypes: 'Сущности',
        metahubs: 'Метахабы',
        resources: 'Ресурсы',
        hubs: 'Хабы',
        components: 'Компоненты',
        records: 'Записи',
        constants: 'Константы',
        values: 'Значения',
        createEntityType: 'Создать сущность',
        selectTemplate: 'Выберите шаблон',
        objects: 'Объекты'
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

            const entityCreateButton = page.getByTestId(toolbarSelectors.primaryAction)
            await expect(entityCreateButton).toBeVisible({ timeout: 30_000 })
            await entityCreateButton.click()
            const entityDialog = page.getByRole('dialog').filter({ hasText: uiCopy.createEntityType }).first()
            await expect(entityDialog).toBeVisible({ timeout: 30_000 })
            const templateSelector = entityDialog.getByRole('combobox', { name: uiCopy.selectTemplate })
            await expect(templateSelector).toBeVisible({ timeout: 30_000 })
            await templateSelector.click()
            await page.getByRole('option', { name: new RegExp(`^${escapeRegExp(uiCopy.objects)}`, 'i') }).click()
            await expect(entityDialog.getByRole('progressbar')).toHaveCount(0)
            await entityDialog.screenshot({
                path: path.join(repoRoot, `docs/${locale}/.gitbook/assets/entities/metahub-entities-create-dialog.png`)
            })
            await page.keyboard.press('Escape')

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

            // 4. Shared resources workspace
            await page.goto(`/metahub/${metahubId}/resources`)
            await expect(page.getByRole('heading', { name: uiCopy.resources })).toBeVisible({ timeout: 30_000 })
            await expect(page.getByTestId(pageSpacingSelectors.metahubResourcesTabs)).toBeVisible({ timeout: 30_000 })
            await captureScreenshot(page, locale, 'resources-workspace')

            await page.getByRole('tab', { name: uiCopy.components, exact: true }).click()
            await expect(page.getByRole('tab', { name: uiCopy.components, exact: true, selected: true })).toBeVisible({
                timeout: 30_000
            })
            await expect(page.getByTestId(pageSpacingSelectors.metahubResourcesContent)).toBeVisible({ timeout: 30_000 })
            await captureScreenshot(page, locale, 'shared-components')

            await page.getByRole('tab', { name: uiCopy.constants, exact: true }).click()
            await expect(page.getByRole('tab', { name: uiCopy.constants, exact: true, selected: true })).toBeVisible({
                timeout: 30_000
            })
            await captureScreenshot(page, locale, 'shared-constants')

            await page.getByRole('tab', { name: uiCopy.values, exact: true }).click()
            await expect(page.getByRole('tab', { name: uiCopy.values, exact: true, selected: true })).toBeVisible({
                timeout: 30_000
            })
            await captureScreenshot(page, locale, 'shared-values')

            const treeEntities = await listTreeEntities(ctx, metahubId, { limit: 100, offset: 0 })
            if (treeEntities?.items?.length > 0) {
                const hub = treeEntities.items[0]

                // 5. Objects under hub
                const objects = await listObjectCollections(ctx, metahubId, { limit: 100, offset: 0, treeEntityId: hub.id })
                if (objects?.items?.length > 0) {
                    const object = objects.items[0]
                    await page.goto(`/metahub/${metahubId}/entities/object/instance/${object.id}/components`)
                    await expect(page.getByRole('heading', { name: uiCopy.components })).toBeVisible({ timeout: 30_000 })
                    await captureScreenshot(page, locale, 'component-list')

                    await page.goto(`/metahub/${metahubId}/entities/object/instance/${object.id}/records`)
                    await expect(page.getByRole('heading', { name: uiCopy.records })).toBeVisible({ timeout: 30_000 })
                    await captureScreenshot(page, locale, 'object-records')
                }
            }

            // 6. Sets
            const valueGroups = await listValueGroups(ctx, metahubId, { limit: 100, offset: 0 })
            if (valueGroups?.items?.length > 0) {
                const vg = valueGroups.items[0]
                await page.goto(`/metahub/${metahubId}/entities/set/instance/${vg.id}/fixed-values`)
                await expect(page.getByRole('heading', { name: uiCopy.constants })).toBeVisible({ timeout: 30_000 })
                await captureScreenshot(page, locale, 'set-fixed-values')
            }

            // 7. Enumerations
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
