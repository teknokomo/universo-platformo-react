import type { Locator, Page, Response } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createMetahubAttribute,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    listMetahubCatalogs,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    applicationSelectors,
    buildGridRowActionsTriggerSelector,
    confirmDeleteSelectors,
    entityDialogSelectors
} from '../../support/selectors/contracts'

type RuntimeState = {
    catalog?: {
        id?: string
    }
    columns?: Array<{
        field?: string
        headerName?: string
    }>
    rows?: Array<Record<string, unknown> & { id?: string }>
}

type CatalogListResponse = {
    items?: Array<{
        id?: string
        codename?: unknown
    }>
}

type RuntimeMutationResponse = {
    id?: string
    status?: string
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

async function fillRuntimeStringField(dialog: Locator, label: string, value: string) {
    await dialog.getByLabel(label).first().fill(value)
}

async function waitForRuntimeState(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string, catalogId?: string) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(async () => {
            runtimeState = (await getApplicationRuntime(api, applicationId, catalogId ? { catalogId } : {})) as RuntimeState
            return typeof runtimeState?.catalog?.id === 'string' && Array.isArray(runtimeState?.columns) && runtimeState.columns.length > 0
        })
        .toBe(true)

    if (!runtimeState?.catalog?.id) {
        throw new Error(`Runtime catalog did not become available for application ${applicationId}`)
    }

    return runtimeState
}

async function waitForCatalogId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let payload: CatalogListResponse | null = null

    await expect
        .poll(async () => {
            payload = (await listMetahubCatalogs(api, metahubId, { limit: 100, offset: 0 })) as CatalogListResponse
            return typeof payload?.items?.[0]?.id === 'string'
        })
        .toBe(true)

    const catalogId = payload?.items?.[0]?.id
    if (!catalogId) {
        throw new Error(`Metahub ${metahubId} did not expose a default catalog`)
    }

    return catalogId
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

async function waitForRuntimeRowCount(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    catalogId: string,
    expectedCount: number
) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(async () => {
            runtimeState = (await getApplicationRuntime(api, applicationId, { catalogId })) as RuntimeState
            return runtimeState.rows?.length ?? 0
        })
        .toBe(expectedCount)

    return runtimeState
}

async function ensureRuntimeRowVisible(page: Page, rowId: string, expectedText: string) {
    const actionTrigger = page.getByTestId(buildGridRowActionsTriggerSelector(rowId))
    await expect(actionTrigger).toBeVisible()
    await expect(page.getByText(expectedText)).toBeVisible()
}

test('@flow @combined application runtime rows support browser create, edit, copy, and delete with persisted data checks', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} runtime metahub`
    const metahubCodename = `${runManifest.runId}-runtime-metahub`
    const publicationName = `E2E ${runManifest.runId} Runtime Publication`
    const applicationName = `E2E ${runManifest.runId} Runtime App`
    const attributeLabel = 'Title'
    const attributeCodename = 'title'
    const createdValue = `Created row ${runManifest.runId}`
    const updatedValue = `Updated row ${runManifest.runId}`
    const copiedValue = `Copied row ${runManifest.runId}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for runtime row coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const catalogId = await waitForCatalogId(api, metahub.id)

        const attribute = await createMetahubAttribute(api, metahub.id, catalogId, {
            name: { en: attributeLabel },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', attributeCodename),
            dataType: 'STRING',
            isRequired: false
        })

        if (!attribute?.id) {
            throw new Error('Attribute creation did not return an id for runtime row coverage')
        }

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for runtime row coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Runtime Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for runtime row coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        const runtimeState = await waitForRuntimeState(api, applicationId, catalogId)
        const runtimeFieldKey = resolveRuntimeFieldKey(runtimeState, attributeLabel, attributeCodename)

        await page.goto(`/a/${applicationId}`)
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })

        await page.getByTestId(applicationSelectors.runtimeCreateButton).click()

        const createDialog = page.getByRole('dialog', { name: 'Create element' })
        await expect(createDialog).toBeVisible()
        await fillRuntimeStringField(createDialog, attributeLabel, createdValue)

        const createRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`)
        )
        await createDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createResponse = await createRequest
        const createdRow = await parseJsonResponse<RuntimeMutationResponse>(createResponse, 'Creating runtime row')
        if (!createdRow.id) {
            throw new Error('Create runtime row response did not contain an id')
        }

        await ensureRuntimeRowVisible(page, createdRow.id, createdValue)

        const persistedCreatedRow = await waitForRuntimeRow(api, applicationId, catalogId, createdRow.id)
        expect(persistedCreatedRow[runtimeFieldKey]).toBe(createdValue)

        await page.getByTestId(buildGridRowActionsTriggerSelector(createdRow.id)).click()
        await page.getByRole('menuitem', { name: 'Edit' }).click()

        const editDialog = page.getByRole('dialog', { name: 'Edit element' })
        await expect(editDialog).toBeVisible()
        await fillRuntimeStringField(editDialog, attributeLabel, updatedValue)

        const editRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows/${createdRow.id}`)
        )
        await editDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const editResponse = await editRequest
        expect(editResponse.ok()).toBe(true)

        const persistedEditedRow = await waitForRuntimeRow(api, applicationId, catalogId, createdRow.id)
        expect(persistedEditedRow[runtimeFieldKey]).toBe(updatedValue)
        await ensureRuntimeRowVisible(page, createdRow.id, updatedValue)

        await page.getByTestId(buildGridRowActionsTriggerSelector(createdRow.id)).click()
        await page.getByRole('menuitem', { name: 'Copy' }).click()

        const copyDialog = page.getByRole('dialog', { name: 'Copy element' })
        await expect(copyDialog).toBeVisible()
        await fillRuntimeStringField(copyDialog, attributeLabel, copiedValue)

        const copyRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`)
        )
        await copyDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const copyResponse = await copyRequest
        const copiedRow = await parseJsonResponse<RuntimeMutationResponse>(copyResponse, 'Copying runtime row')
        if (!copiedRow.id) {
            throw new Error('Copy runtime row response did not contain an id')
        }

        const runtimeAfterCopy = await waitForRuntimeRowCount(api, applicationId, catalogId, 2)
        const persistedCopiedRow = runtimeAfterCopy?.rows?.find((row) => row.id === copiedRow.id)
        expect(persistedCopiedRow?.[runtimeFieldKey]).toBe(copiedValue)
        await ensureRuntimeRowVisible(page, copiedRow.id, copiedValue)

        await page.getByTestId(buildGridRowActionsTriggerSelector(copiedRow.id)).click()
        await page.getByRole('menuitem', { name: 'Delete' }).click()

        const deleteRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'DELETE' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/${copiedRow.id}`) &&
                response.ok()
        )
        await page.getByTestId(confirmDeleteSelectors.confirmButton).click()
        await deleteRequest

        const runtimeAfterDelete = await waitForRuntimeRowCount(api, applicationId, catalogId, 1)
        const remainingRowIds = (runtimeAfterDelete?.rows ?? []).map((row) => row.id)
        expect(remainingRowIds).toContain(createdRow.id)
        expect(remainingRowIds).not.toContain(copiedRow.id)

        const remainingCreatedRow = (runtimeAfterDelete?.rows ?? []).find((row) => row.id === createdRow.id)
        expect(remainingCreatedRow?.[runtimeFieldKey]).toBe(updatedValue)
        await expect(page.getByTestId(buildGridRowActionsTriggerSelector(copiedRow.id))).toHaveCount(0)
        await ensureRuntimeRowVisible(page, createdRow.id, updatedValue)
    } finally {
        await disposeApiContext(api)
    }
})
