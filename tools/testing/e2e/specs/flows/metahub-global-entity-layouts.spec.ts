import type { Locator, Page, Response, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    applicationSelectors,
    buildGridRowActionsTriggerSelector,
    entityDialogSelectors,
    pageSpacingSelectors
} from '../../support/selectors/contracts'
import {
    assignLayoutZoneWidget,
    createLayout,
    createLoggedInApiContext,
    createMetahub,
    createFieldDefinition,
    createLinkedCollection,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    listLayoutZoneWidgets,
    listLayouts,
    moveLayoutZoneWidget,
    syncApplicationSchema,
    syncPublication,
    toggleLayoutZoneWidgetActive,
    updateLayout,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'

type RuntimeState = {
    catalog?: {
        id?: string
        name?: string
        runtimeConfig?: Record<string, unknown>
    }
    columns?: Array<{
        field?: string
        headerName?: string
    }>
    rows?: Array<Record<string, unknown> & { id?: string }>
    zoneWidgets?: {
        left?: Array<{ id?: string; widgetKey?: string }>
        center?: Array<{ id?: string; widgetKey?: string }>
        right?: Array<{ id?: string; widgetKey?: string }>
    }
}

type LayoutListResponse = {
    items?: Array<{
        id?: string
    }>
}

type RuntimeMutationResponse = {
    id?: string
}

async function captureProofScreenshot(page: Page, testInfo: TestInfo, name: string) {
    await page.screenshot({
        path: testInfo.outputPath(name),
        fullPage: true,
        animations: 'disabled'
    })
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

async function waitForLayoutId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string, catalogId?: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = (await listLayouts(api, metahubId, {
                limit: 20,
                offset: 0,
                ...(catalogId ? { catalogId } : {})
            })) as LayoutListResponse
            layoutId = response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}${catalogId ? ` catalog ${catalogId}` : ''}`)
    }

    return layoutId
}

async function waitForRuntimeState(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string, catalogId: string) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(async () => {
            runtimeState = (await getApplicationRuntime(api, applicationId, { catalogId })) as RuntimeState
            return (
                typeof runtimeState?.catalog?.id === 'string' && Array.isArray(runtimeState?.columns) && Array.isArray(runtimeState?.rows)
            )
        })
        .toBe(true)

    if (!runtimeState?.catalog?.id) {
        throw new Error(`Runtime catalog did not become available for application ${applicationId}`)
    }

    return runtimeState
}

function resolveRuntimeFieldKey(runtimeState: RuntimeState, expectedLabel: string, expectedCodename: string) {
    const matchingColumn = (runtimeState.columns ?? []).find((column) => {
        const header = typeof column.headerName === 'string' ? column.headerName.toLowerCase() : ''
        const field = typeof column.field === 'string' ? column.field.toLowerCase() : ''
        return (
            header === expectedLabel.toLowerCase() ||
            field === expectedCodename.toLowerCase() ||
            field.includes(expectedCodename.toLowerCase())
        )
    })

    if (!matchingColumn?.field) {
        throw new Error(`Runtime field for ${expectedLabel}/${expectedCodename} was not found`)
    }

    return matchingColumn.field
}

async function fillRuntimeStringField(surface: Locator, label: string, value: string) {
    await surface.getByRole('textbox', { name: label, exact: true }).first().fill(value)
}

async function submitRuntimeSurface(page: Page, title: string, submitLabel: string) {
    const submitButton = page.getByRole('heading', { name: title, exact: true }).locator('..').getByRole('button', {
        name: submitLabel,
        exact: true
    })
    await expect(submitButton).toBeVisible()
    await submitButton.evaluate((button: HTMLButtonElement) => button.click())
}

async function waitForRuntimeDialogToClose(page: Page, title: string) {
    await expect(page.getByRole('dialog', { name: title })).toHaveCount(0)
}

async function waitForRuntimeRow(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    catalogId: string,
    rowId: string
) {
    let row: (Record<string, unknown> & { id?: string }) | null = null

    await expect
        .poll(async () => {
            const runtimeState = (await getApplicationRuntime(api, applicationId, { catalogId })) as RuntimeState
            row = (runtimeState.rows ?? []).find((entry) => entry.id === rowId) ?? null
            return Boolean(row?.id)
        })
        .toBe(true)

    if (!row?.id) {
        throw new Error(`Runtime row ${rowId} did not become available for application ${applicationId}`)
    }

    return row
}

async function clickCatalogMenuItem(page: import('@playwright/test').Page, catalogName: string) {
    const catalogButton = page.getByRole('button', { name: catalogName, exact: true })
    await expect(catalogButton).toBeVisible({ timeout: 30_000 })
    await catalogButton.click()
}

test('@flow @combined metahub global and entity-scoped layouts drive runtime widget materialization and page surfaces', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} global entity layouts`
    const metahubCodename = `${runManifest.runId}-global-entity-layouts`
    const fallbackCatalogName = `Fallback Catalog ${runManifest.runId}`
    const fallbackCatalogCodename = `${runManifest.runId}-fallback-catalog`
    const customCatalogName = `Custom Catalog ${runManifest.runId}`
    const customCatalogCodename = `${runManifest.runId}-custom-catalog`
    const customLayoutName = `Custom layout ${runManifest.runId}`
    const publicationName = `E2E ${runManifest.runId} General Publication`
    const applicationName = `E2E ${runManifest.runId} General Runtime App`
    const attributeLabel = 'Title'
    const attributeCodename = 'title'
    const createdValue = `Created row ${runManifest.runId}`
    const updatedValue = `Updated row ${runManifest.runId}`
    const copiedValue = `Copied row ${runManifest.runId}`
    const catalogBehaviorKey = 'catalogBehavior'

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for global/entity layout coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const globalLayoutId = await waitForLayoutId(api, metahub.id)

        await updateLayout(api, metahub.id, globalLayoutId, {
            config: {
                [catalogBehaviorKey]: {
                    showCreateButton: false,
                    searchMode: 'page-local',
                    createSurface: 'dialog',
                    editSurface: 'dialog',
                    copySurface: 'dialog'
                }
            }
        })

        const fallbackCatalog = await createLinkedCollection(api, metahub.id, {
            name: { en: fallbackCatalogName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', fallbackCatalogCodename)
        })

        const customCatalog = await createLinkedCollection(api, metahub.id, {
            name: { en: customCatalogName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', customCatalogCodename)
        })

        if (!fallbackCatalog?.id || !customCatalog?.id) {
            throw new Error('Entity creation did not return ids for global/entity layout coverage')
        }

        for (const catalogId of [fallbackCatalog.id, customCatalog.id]) {
            const attribute = await createFieldDefinition(api, metahub.id, catalogId, {
                name: { en: attributeLabel },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', attributeCodename),
                dataType: 'STRING',
                isRequired: false
            })

            if (!attribute?.id) {
                throw new Error(`Attribute creation did not return an id for catalog ${catalogId}`)
            }
        }

        const customLayout = await createLayout(api, metahub.id, {
            scopeEntityId: customCatalog.id,
            baseLayoutId: globalLayoutId,
            name: { en: customLayoutName },
            namePrimaryLocale: 'en',
            isActive: true,
            isDefault: true
        })

        if (!customLayout?.id) {
            throw new Error('Custom entity-scoped layout creation did not return an id')
        }

        await updateLayout(api, metahub.id, customLayout.id, {
            config: {
                ...((customLayout.config && typeof customLayout.config === 'object' ? customLayout.config : {}) as Record<string, unknown>),
                [catalogBehaviorKey]: {
                    showCreateButton: true,
                    searchMode: 'server',
                    createSurface: 'page',
                    editSurface: 'page',
                    copySurface: 'page'
                }
            }
        })

        let customLayoutWidgets = await listLayoutZoneWidgets(api, metahub.id, customLayout.id)
        const detailsTitleWidget = customLayoutWidgets.items?.find((item: { widgetKey?: string }) => item.widgetKey === 'detailsTitle')
        const detailsTableWidget = customLayoutWidgets.items?.find((item: { widgetKey?: string }) => item.widgetKey === 'detailsTable')

        if (!detailsTitleWidget?.id || !detailsTableWidget?.id) {
            throw new Error('Custom entity-scoped layout did not expose inherited details widgets for override coverage')
        }

        await toggleLayoutZoneWidgetActive(api, metahub.id, customLayout.id, detailsTitleWidget.id, false)
        await moveLayoutZoneWidget(api, metahub.id, customLayout.id, {
            widgetId: detailsTableWidget.id,
            targetIndex: 0
        })
        await assignLayoutZoneWidget(api, metahub.id, customLayout.id, {
            zone: 'right',
            widgetKey: 'divider'
        })

        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(page.getByTestId(pageSpacingSelectors.metahubResourcesTabs)).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Layouts' })).toHaveAttribute('aria-selected', 'true')

        await page.goto(`/metahub/${metahub.id}/entities/catalog/instance/${customCatalog.id}/layout/${customLayout.id}`)
        await expect(page.getByRole('heading', { name: 'Entity runtime behavior' })).toBeVisible()
        await expect(page.getByText('Create form type', { exact: true }).last()).toBeVisible()
        await expect(page.getByText('Edit form type', { exact: true }).last()).toBeVisible()
        await expect(page.getByText('Copy form type', { exact: true }).last()).toBeVisible()
        await expect(page.getByTestId(`layout-widget-inherited-${detailsTitleWidget.id}`)).toBeVisible()
        await expect(page.getByTestId(`layout-widget-toggle-${detailsTitleWidget.id}`)).toBeVisible()
        await expect(page.getByTestId(`layout-widget-edit-${detailsTitleWidget.id}`)).toHaveCount(0)
        await expect(page.getByTestId(`layout-widget-remove-${detailsTitleWidget.id}`)).toBeVisible()

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for global/entity layout coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} General Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for global/entity layout coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        const fallbackRuntime = await waitForRuntimeState(api, applicationId, fallbackCatalog.id)
        expect(fallbackRuntime.catalog?.runtimeConfig?.showCreateButton).toBe(false)
        expect((fallbackRuntime.zoneWidgets?.center ?? []).some((item) => item.widgetKey === 'detailsTitle')).toBe(true)
        expect((fallbackRuntime.zoneWidgets?.right ?? []).some((item) => item.widgetKey === 'divider')).toBe(false)

        const customRuntime = await waitForRuntimeState(api, applicationId, customCatalog.id)
        expect(customRuntime.catalog?.runtimeConfig?.createSurface).toBe('page')
        expect(customRuntime.catalog?.runtimeConfig?.editSurface).toBe('page')
        expect(customRuntime.catalog?.runtimeConfig?.copySurface).toBe('page')
        expect((customRuntime.zoneWidgets?.center ?? []).some((item) => item.widgetKey === 'detailsTitle')).toBe(false)
        expect((customRuntime.zoneWidgets?.right ?? []).some((item) => item.widgetKey === 'divider')).toBe(true)
        expect(customRuntime.zoneWidgets?.center?.[0]?.widgetKey).toBe('detailsTable')

        const runtimeFieldKey = resolveRuntimeFieldKey(customRuntime, attributeLabel, attributeCodename)

        await page.goto(`/a/${applicationId}`)

        await clickCatalogMenuItem(page, fallbackCatalogName)
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toHaveCount(0)

        await clickCatalogMenuItem(page, customCatalogName)
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeVisible({ timeout: 30_000 })

        const createRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`) &&
                response.ok()
        )
        await page.getByTestId(applicationSelectors.runtimeCreateButton).click()
        await expect(page).toHaveURL(/surface=page&mode=create/)
        await expect(page.getByRole('dialog', { name: 'Create element' })).toHaveCount(0)
        await expect(page.getByRole('grid')).toHaveCount(0)
        await fillRuntimeStringField(page.locator('body'), attributeLabel, createdValue)
        await captureProofScreenshot(page, testInfo, 'general-runtime-page-surface-create.png')
        await submitRuntimeSurface(page, 'Create element', 'Create')

        const createResponse = await createRequest
        const createdRow = await parseJsonResponse<RuntimeMutationResponse>(createResponse, 'Creating runtime row')
        if (!createdRow.id) {
            throw new Error('Create runtime row response did not contain an id')
        }

        await expect(page).not.toHaveURL(/surface=page/)
        await waitForRuntimeDialogToClose(page, 'Create element')
        await expect(page.getByText(createdValue)).toBeVisible({ timeout: 30_000 })

        const persistedCreatedRow = await waitForRuntimeRow(api, applicationId, customCatalog.id, createdRow.id)
        expect(persistedCreatedRow[runtimeFieldKey]).toBe(createdValue)

        await page.getByTestId(buildGridRowActionsTriggerSelector(createdRow.id)).click()
        await page.getByRole('menuitem', { name: 'Edit' }).click()
        await expect(page).toHaveURL(new RegExp(`surface=page&mode=edit&rowId=${createdRow.id}`))
        await expect(page.getByRole('dialog', { name: 'Edit element' })).toHaveCount(0)
        await expect(page.getByRole('grid')).toHaveCount(0)
        await fillRuntimeStringField(page.locator('body'), attributeLabel, updatedValue)

        const editRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows/${createdRow.id}`) &&
                response.ok()
        )
        await submitRuntimeSurface(page, 'Edit element', 'Save')
        await editRequest

        await expect(page).not.toHaveURL(/surface=page/)
        await waitForRuntimeDialogToClose(page, 'Edit element')
        await expect(page.getByText(updatedValue)).toBeVisible({ timeout: 30_000 })

        const persistedEditedRow = await waitForRuntimeRow(api, applicationId, customCatalog.id, createdRow.id)
        expect(persistedEditedRow[runtimeFieldKey]).toBe(updatedValue)

        await page.getByTestId(buildGridRowActionsTriggerSelector(createdRow.id)).click()
        await page.getByRole('menuitem', { name: 'Copy' }).click()
        await expect(page).toHaveURL(new RegExp(`surface=page&mode=copy&rowId=${createdRow.id}`))
        await expect(page.getByRole('dialog', { name: 'Copy element' })).toHaveCount(0)
        await expect(page.getByRole('grid')).toHaveCount(0)
        await fillRuntimeStringField(page.locator('body'), attributeLabel, copiedValue)

        const copyRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`) &&
                response.ok()
        )
        await submitRuntimeSurface(page, 'Copy element', 'Copy')

        const copyResponse = await copyRequest
        const copiedRow = await parseJsonResponse<RuntimeMutationResponse>(copyResponse, 'Copying runtime row')
        if (!copiedRow.id) {
            throw new Error('Copy runtime row response did not contain an id')
        }

        await expect(page).not.toHaveURL(/surface=page/)
        await waitForRuntimeDialogToClose(page, 'Copy element')
        await expect(page.getByText(copiedValue)).toBeVisible({ timeout: 30_000 })

        const persistedCopiedRow = await waitForRuntimeRow(api, applicationId, customCatalog.id, copiedRow.id)
        expect(persistedCopiedRow[runtimeFieldKey]).toBe(copiedValue)
    } finally {
        await disposeApiContext(api)
    }
})
