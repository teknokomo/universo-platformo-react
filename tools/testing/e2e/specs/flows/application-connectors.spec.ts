import { readFile } from 'node:fs/promises'
import type { Locator, Page, Response } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createApplication,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    getApplication,
    getConnector,
    listConnectorPublicationLinks,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    buildEntitySelectionOptionSelector,
    entityDialogSelectors,
    entitySelectionSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'
import {
    SELF_HOSTED_APP_CANONICAL_METAHUB,
    SELF_HOSTED_APP_FIXTURE_FILENAME,
    assertSelfHostedAppEnvelopeContract
} from '../../support/selfHostedAppFixtureContract.mjs'

type ConnectorRecord = {
    id?: string
    name?: unknown
    description?: unknown
}

type ConnectorLinkListResponse = {
    items?: Array<{
        id?: string
        publicationId?: string
    }>
}

async function loadSelfHostedAppSnapshotEnvelope() {
    const fixturePath = `${process.cwd()}/tools/fixtures/${SELF_HOSTED_APP_FIXTURE_FILENAME}`
    const raw = await readFile(fixturePath, 'utf8')
    const envelope = JSON.parse(raw) as {
        metahub?: {
            name?: {
                _primary?: string
                locales?: Record<string, { content?: string }>
            }
        }
        snapshot?: {
            entities?: Record<string, { kind?: string; codename?: string }>
        }
    }

    const metahubName = envelope.metahub?.name?.locales?.en?.content ?? ''
    if (metahubName !== SELF_HOSTED_APP_CANONICAL_METAHUB.name.en) {
        throw new Error(`Unexpected self-hosted app fixture name: ${metahubName || '<missing>'}`)
    }
    assertSelfHostedAppEnvelopeContract(envelope)

    return { fixturePath, envelope }
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

function extractLocalizedText(value: unknown): string | null {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return null
    }

    const primaryLocale = '_primary' in value && typeof value._primary === 'string' ? value._primary : null
    const locales = 'locales' in value && value.locales && typeof value.locales === 'object' ? value.locales : null
    const primaryEntry =
        primaryLocale && locales && primaryLocale in locales && locales[primaryLocale] && typeof locales[primaryLocale] === 'object'
            ? locales[primaryLocale]
            : null

    return primaryEntry && 'content' in primaryEntry && typeof primaryEntry.content === 'string' ? primaryEntry.content : null
}

async function fillConnectorGeneralFields(dialog: Locator, values: { name: string; description: string }) {
    await dialog.getByLabel('Name').first().fill(values.name)
    await dialog.getByLabel('Description').first().fill(values.description)
}

async function waitForConnectorById(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string, connectorId: string) {
    let connector: ConnectorRecord | null = null

    await expect
        .poll(async () => {
            connector = (await getConnector(api, applicationId, connectorId)) as ConnectorRecord
            return typeof connector?.id === 'string'
        })
        .toBe(true)

    if (!connector?.id) {
        throw new Error(`Connector ${connectorId} did not become available in application ${applicationId}`)
    }

    return connector
}

async function waitForConnectorPublicationLink(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    connectorId: string,
    publicationId: string
) {
    let payload: ConnectorLinkListResponse | null = null

    await expect
        .poll(async () => {
            payload = (await listConnectorPublicationLinks(api, applicationId, connectorId)) as ConnectorLinkListResponse
            return (payload?.items ?? []).some((item) => item.publicationId === publicationId)
        })
        .toBe(true)

    const link = (payload?.items ?? []).find((item) => item.publicationId === publicationId)
    if (!link?.id) {
        throw new Error(`Connector ${connectorId} did not persist publication link ${publicationId}`)
    }

    return link
}

async function ensureConnectorRowVisible(page: Page, connectorId: string, expectedName: string) {
    const menuTrigger = page.getByTestId(buildEntityMenuTriggerSelector('connector', connectorId))

    await expect(menuTrigger).toBeVisible()
    await expect(page.getByText(expectedName)).toBeVisible()
}

test('@flow @combined application connector can be created through the browser and edited without losing its publication link', async ({
    page,
    runManifest
}) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} connector metahub`
    const metahubCodename = `${runManifest.runId}-connector-metahub`
    const publicationName = `E2E ${runManifest.runId} connector publication`
    const applicationName = `E2E ${runManifest.runId} connector app`
    const connectorName = `E2E ${runManifest.runId} connector`
    const connectorDescription = `Created from browser flow ${runManifest.runId}`
    const updatedConnectorName = `E2E ${runManifest.runId} connector updated`
    const updatedConnectorDescription = `Updated from browser flow ${runManifest.runId}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for connector coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for connector coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        const application = await createApplication(api, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            workspacesEnabled: false,
            isPublic: false
        })

        if (!application?.id) {
            throw new Error('Application creation did not return an id for connector coverage')
        }

        await recordCreatedApplication({
            id: application.id,
            slug: application.slug
        })

        await page.goto(`/a/${application.id}/admin/connectors`)
        await expect(page.getByRole('heading', { name: 'Connectors' })).toBeVisible()

        const createButton = page.getByTestId(toolbarSelectors.primaryAction)
        await expect(createButton).toBeEnabled()
        await createButton.click()

        const createDialog = page.getByRole('dialog', { name: 'Create Connector' })
        await expect(createDialog).toBeVisible()

        await fillConnectorGeneralFields(createDialog, {
            name: connectorName,
            description: connectorDescription
        })

        const submitButton = createDialog.getByTestId(entityDialogSelectors.submitButton)
        await expect(submitButton).toBeDisabled()

        await createDialog.getByRole('tab', { name: 'Metahubs' }).click()
        await expect(createDialog.getByTestId(entitySelectionSelectors.addButton)).toBeVisible()
        await createDialog.getByTestId(entitySelectionSelectors.addButton).click()

        const pickerDialog = page.getByRole('dialog', { name: 'Select Metahub' })
        await expect(pickerDialog).toBeVisible()
        await pickerDialog.getByTestId(buildEntitySelectionOptionSelector(publication.id)).click()
        await pickerDialog.getByTestId(entitySelectionSelectors.confirmButton).click()

        await expect(pickerDialog).toHaveCount(0)
        await expect(createDialog.getByText(metahubName)).toBeVisible()
        await expect(submitButton).toBeEnabled()

        const createRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${application.id}/connectors`)
        )

        await submitButton.click()

        const createResponse = await createRequest
        const createdConnector = await parseJsonResponse<{ id?: string }>(createResponse, 'Creating connector')
        if (!createdConnector.id) {
            throw new Error('Create connector response did not contain an id')
        }

        await ensureConnectorRowVisible(page, createdConnector.id, connectorName)

        const persistedConnector = await waitForConnectorById(api, application.id, createdConnector.id)
        expect(extractLocalizedText(persistedConnector.name)).toBe(connectorName)
        expect(extractLocalizedText(persistedConnector.description)).toBe(connectorDescription)

        const publicationLink = await waitForConnectorPublicationLink(api, application.id, createdConnector.id, publication.id)
        expect(publicationLink.publicationId).toBe(publication.id)

        await expect(createButton).toBeDisabled()
        await expect(page.getByText('Currently, only one Connector per Application is supported.')).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('connector', createdConnector.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('connector', 'edit', createdConnector.id)).click()

        const editDialog = page.getByRole('dialog', { name: 'Edit Connector' })
        await expect(editDialog).toBeVisible()
        await fillConnectorGeneralFields(editDialog, {
            name: updatedConnectorName,
            description: updatedConnectorDescription
        })

        await editDialog.getByRole('tab', { name: 'Metahubs' }).click()
        await expect(editDialog.getByText(metahubName)).toBeVisible()

        const updateRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/applications/${application.id}/connectors/${createdConnector.id}`)
        )

        await editDialog.getByRole('tab', { name: 'General' }).click()
        await editDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const updateResponse = await updateRequest
        expect(updateResponse.ok()).toBe(true)
        await expect(editDialog).toHaveCount(0)
        await expect(page.getByText(updatedConnectorName)).toBeVisible()

        await expect
            .poll(async () => {
                const connector = await getConnector(api, application.id, createdConnector.id)
                return {
                    name: extractLocalizedText(connector?.name),
                    description: extractLocalizedText(connector?.description)
                }
            })
            .toEqual({
                name: updatedConnectorName,
                description: updatedConnectorDescription
            })

        const persistedLinks = (await listConnectorPublicationLinks(api, application.id, createdConnector.id)) as ConnectorLinkListResponse
        expect((persistedLinks.items ?? []).map((item) => item.publicationId)).toEqual([publication.id])
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow imported snapshot publication creates schema on first connector attempt', async ({ page, runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const { envelope } = await loadSelfHostedAppSnapshotEnvelope()
        const importResponse = await sendWithCsrf(api, 'POST', '/api/v1/metahubs/import', envelope)

        if (!importResponse.ok) {
            const bodyText = await importResponse.text()
            throw new Error(`Snapshot import failed with ${importResponse.status} ${importResponse.statusText}: ${bodyText}`)
        }

        const importBody = await importResponse.json()
        const importedMetahubId = importBody?.metahub?.id
        const importedPublicationId = importBody?.publication?.id
        const importedVersionId = importBody?.version?.id

        if (typeof importedMetahubId !== 'string' || typeof importedPublicationId !== 'string' || typeof importedVersionId !== 'string') {
            throw new Error(`Snapshot import response did not include metahub/publication/version ids: ${JSON.stringify(importBody)}`)
        }

        const importedMetahubName =
            envelope?.metahub?.name?._primary && envelope?.metahub?.name?.locales?.[envelope.metahub.name._primary]?.content
                ? envelope.metahub.name.locales[envelope.metahub.name._primary]?.content
                : 'Imported metahub'

        await recordCreatedMetahub({
            id: importedMetahubId,
            name: importedMetahubName,
            codename: 'imported-self-hosted-fixture'
        })
        await recordCreatedPublication({
            id: importedPublicationId,
            metahubId: importedMetahubId,
            schemaName: null
        })

        const applicationName = `E2E ${runManifest.runId} imported schema app`
        const connectorName = `E2E ${runManifest.runId} imported connector`

        const application = await createApplication(api, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            workspacesEnabled: false,
            isPublic: false
        })

        if (!application?.id) {
            throw new Error('Application creation did not return an id for imported snapshot connector flow')
        }

        await recordCreatedApplication({
            id: application.id,
            slug: application.slug
        })

        await page.goto(`/a/${application.id}/admin/connectors`)
        await expect(page.getByRole('heading', { name: 'Connectors' })).toBeVisible()

        const createButton = page.getByTestId(toolbarSelectors.primaryAction)
        await createButton.click()

        const createDialog = page.getByRole('dialog', { name: 'Create Connector' })
        await expect(createDialog).toBeVisible()

        await fillConnectorGeneralFields(createDialog, {
            name: connectorName,
            description: `Imported snapshot connector ${runManifest.runId}`
        })

        await createDialog.getByRole('tab', { name: 'Metahubs' }).click()
        await createDialog.getByTestId(entitySelectionSelectors.addButton).click()

        const pickerDialog = page.getByRole('dialog', { name: 'Select Metahub' })
        await expect(pickerDialog).toBeVisible()
        await pickerDialog.getByTestId(buildEntitySelectionOptionSelector(importedPublicationId)).click()
        await pickerDialog.getByTestId(entitySelectionSelectors.confirmButton).click()

        await expect(pickerDialog).toHaveCount(0)
        await expect(createDialog.getByText(importedMetahubName)).toBeVisible()

        const createRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${application.id}/connectors`)
        )
        await createDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createResponse = await createRequest
        const createdConnector = await parseJsonResponse<{ id?: string }>(createResponse, 'Creating imported connector')
        if (!createdConnector.id) {
            throw new Error('Create connector response did not contain an id for imported snapshot flow')
        }

        await page.goto(`/a/${application.id}/admin/connector/${createdConnector.id}`)
        await expect(page.getByTestId('application-connector-board-schema-card')).toBeVisible()

        const diffResponsePromise = page.waitForResponse(
            (response) => response.request().method() === 'GET' && response.url().endsWith(`/api/v1/application/${application.id}/diff`)
        )
        await page.getByTestId('application-connector-board-sync-button').click()

        const diffResponse = await diffResponsePromise
        expect(diffResponse.status()).toBe(200)

        const diffDialog = page.getByRole('dialog', { name: 'Schema Changes' })
        await expect(diffDialog).toBeVisible()
        await expect(diffDialog.getByRole('heading', { name: /The following schema will be created/i })).toBeVisible()

        const syncResponsePromise = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/application/${application.id}/sync`)
        )
        await diffDialog.getByRole('button', { name: 'Create Schema' }).click()

        const syncResponse = await syncResponsePromise
        expect(syncResponse.status()).toBe(200)

        const syncBody = await syncResponse.json()
        expect(syncBody?.status).toBe('created')
        await expect(diffDialog).toHaveCount(0)

        await expect
            .poll(async () => {
                const refreshed = await getApplication(api, application.id)
                return refreshed?.schemaStatus ?? refreshed?.data?.schemaStatus ?? null
            })
            .toBe('synced')
    } finally {
        await disposeApiContext(api)
    }
})
