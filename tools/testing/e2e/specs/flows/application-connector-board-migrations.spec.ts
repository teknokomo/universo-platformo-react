import type { Locator, Page } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    analyzeApplicationMigrationRollback,
    createLoggedInApiContext,
    createMetahub,
    createFieldDefinition,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplication,
    listApplicationMigrations,
    listConnectors,
    listLinkedCollections,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    applicationSelectors,
    buildApplicationMigrationExpandSelector,
    buildApplicationMigrationRollbackSelector,
    buildApplicationMigrationRowSelector,
    buildApplicationMigrationSummarySelector
} from '../../support/selectors/contracts'

type CatalogListResponse = {
    items?: Array<{
        id?: string
    }>
}

type ConnectorListResponse = {
    items?: Array<{
        id?: string
        name?: unknown
    }>
}

type ApplicationRecord = {
    id?: string
    schemaStatus?: string
}

type MigrationListResponse = {
    items?: Array<{
        id?: string
        name?: string
        summary?: string
    }>
}

type RollbackAnalysis = {
    migrationName?: string
    canRollback?: boolean
    blockers?: string[]
    warnings?: string[]
    rollbackChanges?: string[]
}

async function waitForCatalogId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let payload: CatalogListResponse | null = null

    await expect
        .poll(async () => {
            payload = (await listLinkedCollections(api, metahubId, { limit: 100, offset: 0 })) as CatalogListResponse
            return typeof payload?.items?.[0]?.id === 'string'
        })
        .toBe(true)

    const catalogId = payload?.items?.[0]?.id
    if (!catalogId) {
        throw new Error(`Metahub ${metahubId} did not expose a default catalog`)
    }

    return catalogId
}

async function waitForApplicationSchemaStatus(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    expectedStatus = 'synced'
) {
    let application: ApplicationRecord | null = null

    await expect
        .poll(async () => {
            application = (await getApplication(api, applicationId)) as ApplicationRecord
            return application?.schemaStatus ?? null
        })
        .toBe(expectedStatus)

    return application
}

async function waitForConnector(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string) {
    let payload: ConnectorListResponse | null = null

    await expect
        .poll(async () => {
            payload = (await listConnectors(api, applicationId)) as ConnectorListResponse
            return typeof payload?.items?.[0]?.id === 'string'
        })
        .toBe(true)

    const connector = payload?.items?.[0]
    if (!connector?.id) {
        throw new Error(`Application ${applicationId} did not expose a connector after schema sync`)
    }

    return connector
}

async function waitForMigrationList(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    minimumCount: number
) {
    let payload: MigrationListResponse | null = null

    await expect
        .poll(async () => {
            payload = (await listApplicationMigrations(api, applicationId, { limit: 20, offset: 0 })) as MigrationListResponse
            return payload?.items?.length ?? 0
        })
        .toBeGreaterThanOrEqual(minimumCount)

    return payload?.items ?? []
}

async function expectRowText(row: Locator, value: string) {
    await expect(row.getByText(value, { exact: false })).toBeVisible()
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

async function ensureConnectorBoardReady(page: Page, connectorName: string | null, metahubName: string) {
    const schemaCard = page.getByTestId(applicationSelectors.connectorBoardSchemaCard)
    const detailsCard = page.getByTestId(applicationSelectors.connectorBoardDetailsCard)

    await expect(schemaCard).toBeVisible()
    await expect(detailsCard).toBeVisible()

    if (connectorName) {
        await expect(page.getByRole('heading', { name: connectorName })).toBeVisible()
    } else {
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }

    await expect(schemaCard.getByText(metahubName)).toBeVisible()
    await expect(schemaCard.getByText('Synced', { exact: true })).toBeVisible()
    await expect(page.getByTestId(applicationSelectors.connectorBoardViewMigrationsButton)).toBeVisible()
}

test('@flow @combined application connector board exposes schema state and links into migration history', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} connector board metahub`
    const metahubCodename = `${runManifest.runId}-connector-board-metahub`
    const publicationName = `E2E ${runManifest.runId} connector board publication`
    const applicationName = `E2E ${runManifest.runId} connector board app`
    const firstVersionName = `E2E ${runManifest.runId} connector board v1`
    const secondVersionName = `E2E ${runManifest.runId} connector board v2`
    const firstAttributeName = 'Title'
    const firstAttributeCodename = 'title'
    const secondAttributeName = 'Summary'
    const secondAttributeCodename = 'summary'

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for connector-board migration coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const catalogId = await waitForCatalogId(api, metahub.id)

        await createFieldDefinition(api, metahub.id, catalogId, {
            name: { en: firstAttributeName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', firstAttributeCodename),
            dataType: 'STRING',
            isRequired: false
        })

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for connector-board migration coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: firstVersionName },
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
            throw new Error('Linked application creation did not return an id for connector-board migration coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)
        await waitForApplicationSchemaStatus(api, applicationId, 'synced')

        const connector = await waitForConnector(api, applicationId)
        const connectorId = connector.id
        const connectorName = extractLocalizedText(connector.name)

        await createFieldDefinition(api, metahub.id, catalogId, {
            name: { en: secondAttributeName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', secondAttributeCodename),
            dataType: 'STRING',
            isRequired: false
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: secondVersionName },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)
        await syncApplicationSchema(api, applicationId)
        await waitForApplicationSchemaStatus(api, applicationId, 'synced')

        const migrations = await waitForMigrationList(api, applicationId, 2)
        const latestMigration = migrations[0]
        const rollbackTarget = migrations.find((migration, index) => index > 0 && typeof migration.id === 'string')

        if (!latestMigration?.id || !latestMigration.name || !latestMigration.summary) {
            throw new Error('Latest migration payload was incomplete for connector-board migration coverage')
        }

        if (!rollbackTarget?.id || !rollbackTarget.name || !rollbackTarget.summary) {
            throw new Error('Rollback target migration payload was incomplete for connector-board migration coverage')
        }

        const rollbackAnalysis = (await analyzeApplicationMigrationRollback(api, applicationId, rollbackTarget.id)) as RollbackAnalysis

        await page.goto(`/a/${applicationId}/admin/connector/${connectorId}`)
        await ensureConnectorBoardReady(page, connectorName, metahubName)
        await expect(page.getByTestId(applicationSelectors.connectorBoardSyncButton)).toBeEnabled()

        await page.getByTestId(applicationSelectors.connectorBoardViewMigrationsButton).click()

        await expect(page).toHaveURL(`/a/${applicationId}/admin/migrations`)
        await expect(page.getByRole('heading', { name: 'Migration History' })).toBeVisible()
        await expect(page.getByTestId(applicationSelectors.migrationsTable)).toBeVisible()

        const latestRow = page.getByTestId(buildApplicationMigrationRowSelector(latestMigration.id))
        await expect(latestRow).toBeVisible()
        await expectRowText(latestRow, latestMigration.name)

        const rollbackRow = page.getByTestId(buildApplicationMigrationRowSelector(rollbackTarget.id))
        await expect(rollbackRow).toBeVisible()
        await expectRowText(rollbackRow, rollbackTarget.name)

        await page.getByTestId(buildApplicationMigrationExpandSelector(latestMigration.id)).click()
        await expect(page.getByTestId(buildApplicationMigrationSummarySelector(latestMigration.id))).toContainText(latestMigration.summary)

        await page.getByTestId(buildApplicationMigrationRollbackSelector(rollbackTarget.id)).click()

        const rollbackDialog = page.getByRole('dialog', { name: 'Confirm Rollback' })
        await expect(rollbackDialog).toBeVisible()
        await expect(rollbackDialog.getByText(rollbackAnalysis.migrationName ?? rollbackTarget.name)).toBeVisible()

        if ((rollbackAnalysis.blockers ?? []).length > 0) {
            await expect(rollbackDialog.getByText('Cannot rollback')).toBeVisible()
            await expect(rollbackDialog.getByRole('button', { name: 'Rollback' })).toBeDisabled()
            await expect(rollbackDialog.getByText(rollbackAnalysis.blockers?.[0] ?? '')).toBeVisible()
        } else if ((rollbackAnalysis.warnings ?? []).length > 0) {
            await expect(rollbackDialog.getByText('Warnings')).toBeVisible()
            await expect(rollbackDialog.getByText(rollbackAnalysis.warnings?.[0] ?? '')).toBeVisible()
            await expect(rollbackDialog.getByRole('button', { name: 'Rollback' })).toBeEnabled()
        } else {
            await expect(rollbackDialog.getByRole('button', { name: 'Rollback' })).toBeEnabled()
        }

        if ((rollbackAnalysis.rollbackChanges ?? []).length > 0) {
            await expect(rollbackDialog.getByText(rollbackAnalysis.rollbackChanges?.[0] ?? '')).toBeVisible()
        }

        await rollbackDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(rollbackDialog).toHaveCount(0)
    } finally {
        await disposeApiContext(api)
    }
})
