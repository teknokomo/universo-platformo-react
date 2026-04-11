import type { Locator, Page, Response } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, createMetahub, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    entityDialogSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'

const SHARED_DIALOG_SCREENSHOT_OPTIONS = {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixels: 220
}

const SHARED_EDIT_PANEL_SCREENSHOT_OPTIONS = {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixels: 800
}

const SHARED_COPY_DIALOG_SCREENSHOT_OPTIONS = {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixels: 5000
}

const SHARED_PAGE_SHELL_SCREENSHOT_OPTIONS = {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixels: 4000
}

type EntityTypeRecord = {
    id?: string
    kindKey?: string
}

type EntityInstanceRecord = {
    id?: string
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

function buildKindSuffix(runId: string): string {
    const normalized = runId.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return normalized.slice(-8) || 'e2e'
}

async function assertLocatorMatchesSharedSnapshot(
    page: Page,
    locator: Locator,
    snapshotName: string,
    screenshotOptions = SHARED_DIALOG_SCREENSHOT_OPTIONS
): Promise<void> {
    await expect(locator).toBeVisible()
    await page.evaluate(() => {
        const active = document.activeElement
        if (active instanceof HTMLElement) {
            active.blur()
        }
    })
    await expect(locator).toHaveScreenshot(snapshotName, screenshotOptions)
}

async function assertDialogMatchesSharedSnapshot(page: Page, dialog: Locator, snapshotName: string): Promise<void> {
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('progressbar')).toHaveCount(0)
    await assertLocatorMatchesSharedSnapshot(page, dialog, snapshotName)
}

async function assertPageShellMatchesSnapshot(page: Page, snapshotName: string): Promise<void> {
    const mainContent = page.locator('main').first()
    await expect(mainContent).toBeVisible()
    await assertLocatorMatchesSharedSnapshot(page, mainContent, snapshotName, SHARED_PAGE_SHELL_SCREENSHOT_OPTIONS)
}

async function createCatalogCompatibleInstance(page: Page, metahubId: string, kindKey: string, kindName: string, kindSuffix: string) {
    await page.goto(`/metahub/${metahubId}/entities`)
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const createTypeDialog = page.getByRole('dialog', { name: 'Create Entity Type' })
    await expect(createTypeDialog).toBeVisible()
    await createTypeDialog.getByLabel('Select template').click()
    await page.getByRole('option', { name: /Catalogs V2/i }).click()
    await expect.poll(async () => createTypeDialog.getByLabel('Kind key').inputValue()).toBe('custom.catalog-v2')
    await createTypeDialog.getByLabel('Kind key').fill(kindKey)
    await createTypeDialog.getByLabel('Name').first().fill(kindName)

    const createTypeResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entity-types`),
        { label: 'Creating catalog-compatible entity type for visual parity' }
    )

    await createTypeDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const createdType = await parseJsonResponse<EntityTypeRecord>(await createTypeResponse, 'Creating catalog-compatible entity type')

    if (!createdType.id) {
        throw new Error('Create entity type response did not contain an id for visual parity coverage')
    }

    await page.goto(`/metahub/${metahubId}/entities/${kindKey}/instances`)
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const createInstanceDialog = page.getByRole('dialog', { name: 'Create Catalog' })
    await expect(createInstanceDialog).toBeVisible()
    await createInstanceDialog.getByLabel('Name').first().fill(`${kindName} Instance`)
    await createInstanceDialog.getByLabel('Codename').first().fill(`catalog-instance-${kindSuffix}`)

    const createInstanceResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/catalogs`),
        { label: 'Creating catalog through the Catalogs V2 surface for visual parity' }
    )

    await createInstanceDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const createdInstance = await parseJsonResponse<EntityInstanceRecord>(
        await createInstanceResponse,
        'Creating catalog through the Catalogs V2 surface'
    )

    if (!createdInstance.id) {
        throw new Error('Create entity instance response did not contain an id for visual parity coverage')
    }

    return createdInstance.id
}

test('@visual legacy Catalog dialogs remain identical to catalog-compatible entity dialogs', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} catalogs v2 visual parity`
    const metahubCodename = `${runManifest.runId}-catalogs-v2-visual`
    const kindSuffix = buildKindSuffix(runManifest.runId)
    const customKindKey = `custom.catalog-v2-${kindSuffix}`
    const customName = `Catalogs V2 ${kindSuffix}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for catalog parity visual coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.addInitScript(() => {
            window.localStorage.setItem('metahubsEntityInstanceDisplayStyle', 'list')
        })

        const createdInstanceId = await createCatalogCompatibleInstance(page, metahub.id, customKindKey, customName, kindSuffix)

        await page.goto(`/metahub/${metahub.id}/catalogs`)
        await assertPageShellMatchesSnapshot(page, 'catalogs-page-shell.png')
        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const legacyCreateDialog = page.getByRole('dialog', { name: 'Create Catalog' })
        await assertDialogMatchesSharedSnapshot(page, legacyCreateDialog, 'catalog-compatible-create-dialog.png')
        await legacyCreateDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(legacyCreateDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
        await assertPageShellMatchesSnapshot(page, 'catalogs-page-shell.png')
        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const entityCreateDialog = page.getByRole('dialog', { name: 'Create Catalog' })
        await assertDialogMatchesSharedSnapshot(page, entityCreateDialog, 'catalog-compatible-create-dialog.png')
        await entityCreateDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(entityCreateDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/catalogs`)
        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', createdInstanceId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'edit', createdInstanceId)).click()
        const legacyEditDialog = page.getByRole('dialog', { name: 'Edit Catalog' })
        await expect(legacyEditDialog.getByRole('tab', { name: 'Hubs' })).toBeVisible()
        await expect(legacyEditDialog.getByRole('tab', { name: 'Layouts' })).toBeVisible()
        await expect(legacyEditDialog.getByRole('tab', { name: 'Scripts' })).toBeVisible()
        await expect(legacyEditDialog.getByRole('button', { name: 'Save' })).toBeVisible()
        await assertLocatorMatchesSharedSnapshot(
            page,
            legacyEditDialog.locator('[role="tabpanel"]').first(),
            'catalog-compatible-edit-general-panel.png',
            SHARED_EDIT_PANEL_SCREENSHOT_OPTIONS
        )
        await legacyEditDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(legacyEditDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', createdInstanceId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'edit', createdInstanceId)).click()
        const entityEditDialog = page.getByRole('dialog', { name: 'Edit Catalog' })
        await expect(entityEditDialog.getByRole('tab', { name: 'Hubs' })).toBeVisible()
        await expect(entityEditDialog.getByRole('tab', { name: 'Layouts' })).toBeVisible()
        await expect(entityEditDialog.getByRole('button', { name: 'Save' })).toBeVisible()
        await assertLocatorMatchesSharedSnapshot(
            page,
            entityEditDialog.locator('[role="tabpanel"]').first(),
            'catalog-compatible-edit-general-panel.png',
            SHARED_EDIT_PANEL_SCREENSHOT_OPTIONS
        )
        await entityEditDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(entityEditDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/catalogs`)
        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', createdInstanceId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'copy', createdInstanceId)).click()
        const legacyCopyDialog = page.getByRole('dialog', { name: 'Copying Catalog' })
        await legacyCopyDialog.getByRole('tab', { name: 'Options' }).click()
        await assertLocatorMatchesSharedSnapshot(
            page,
            legacyCopyDialog,
            'catalog-compatible-copy-dialog.png',
            SHARED_COPY_DIALOG_SCREENSHOT_OPTIONS
        )
        await legacyCopyDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(legacyCopyDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', createdInstanceId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'copy', createdInstanceId)).click()
        const entityCopyDialog = page.getByRole('dialog', { name: 'Copying Catalog' })
        await entityCopyDialog.getByRole('tab', { name: 'Options' }).click()
        await assertLocatorMatchesSharedSnapshot(
            page,
            entityCopyDialog,
            'catalog-compatible-copy-dialog.png',
            SHARED_COPY_DIALOG_SCREENSHOT_OPTIONS
        )
        await entityCopyDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(entityCopyDialog).toHaveCount(0)

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/catalogs`)
        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const legacyRuCreateDialog = page.getByRole('dialog', { name: 'Создать каталог' })
        await assertDialogMatchesSharedSnapshot(page, legacyRuCreateDialog, 'catalog-compatible-create-dialog-ru.png')
        await legacyRuCreateDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(legacyRuCreateDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const entityRuCreateDialog = page.getByRole('dialog', { name: 'Создать каталог' })
        await assertDialogMatchesSharedSnapshot(page, entityRuCreateDialog, 'catalog-compatible-create-dialog-ru.png')
        await entityRuCreateDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(entityRuCreateDialog).toHaveCount(0)
    } finally {
        await disposeApiContext(api)
    }
})
