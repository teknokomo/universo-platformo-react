import { createLocalizedContent } from '@universo-react/utils'
import { test, expect } from '../../fixtures/test'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import {
    createLoggedInApiContext,
    createMetahub,
    createComponent,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getLayout,
    listLayouts,
    listLayoutZoneWidgets,
    listObjectCollections,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    updateLayoutZoneWidgetConfig,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { applicationSelectors, entityDialogSelectors } from '../../support/selectors/contracts'

function readCodename(value: unknown): string {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const record = value as { locales?: Record<string, { content?: unknown }>; _primary?: unknown }
    const primary = typeof record._primary === 'string' ? record._primary : 'en'
    const primaryContent = record.locales?.[primary]?.content
    if (typeof primaryContent === 'string') return primaryContent
    const englishContent = record.locales?.en?.content
    return typeof englishContent === 'string' ? englishContent : ''
}

async function waitForLayoutId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}`)
    }

    return layoutId
}

async function waitForObjectId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let objectCollectionId: string | undefined

    await expect
        .poll(async () => {
            const response = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
            objectCollectionId = response?.items?.[0]?.id
            return typeof objectCollectionId === 'string'
        })
        .toBe(true)

    if (!objectCollectionId) {
        throw new Error(`No objectCollection was returned for metahub ${metahubId}`)
    }

    return objectCollectionId
}

async function configureEnhancedLayout(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    const layoutId = await waitForLayoutId(api, metahubId)
    const layout = await getLayout(api, metahubId, layoutId)
    const currentConfig = layout?.config && typeof layout.config === 'object' ? layout.config : {}
    const expectedVersion = typeof layout?.version === 'number' && layout.version > 0 ? layout.version : 1

    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, {
        expectedVersion,
        config: {
            ...currentConfig,
            showOverviewTitle: false,
            showOverviewCards: false,
            showSessionsChart: false,
            showPageViewsChart: false,
            showDetailsTitle: true,
            showDetailsTable: true,
            showFooter: false,
            showViewToggle: true,
            defaultViewMode: 'card',
            showFilterBar: true,
            enableRowReordering: true,
            cardColumns: 2,
            rowHeight: 'auto'
        }
    })

    expect(response.ok).toBe(true)
    return layoutId
}

test.describe('Application Runtime View Settings', () => {
    test('@flow layout details page shows view settings panel', async ({ page, runManifest }) => {
        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const metahubName = `E2E ${runManifest.runId} runtime views`
        const metahubCodename = `${runManifest.runId}-runtime-views`

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename)
            })

            if (!metahub?.id) {
                throw new Error('Metahub creation did not return an id for runtime view settings coverage')
            }

            await recordCreatedMetahub({
                id: metahub.id,
                name: metahubName,
                codename: metahubCodename
            })

            const layoutId = await waitForLayoutId(api, metahub.id)

            await page.goto(`/metahub/${metahub.id}/resources/layouts/${layoutId}`)
            await page.waitForURL(`**/metahub/${metahub.id}/resources/layouts/${layoutId}`)

            const viewSettingsHeading = page.getByText(/view settings|настройки отображения/i).first()
            await expect(viewSettingsHeading).toBeVisible({ timeout: 10_000 })

            // The runtime settings panel must render real controls, not an empty shell.
            const runtimeSettingsPanel = page.getByTestId('layout-runtime-settings-panel')
            await expect(runtimeSettingsPanel).toBeVisible({ timeout: 10_000 })
            await expect(runtimeSettingsPanel.getByRole('switch').first()).toBeVisible()
        } finally {
            await disposeApiContext(api)
        }
    })

    test('@flow dashboard renders enhanced details section through the real /a runtime route', async ({ page, runManifest }) => {
        test.setTimeout(180_000)

        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const metahubName = `E2E ${runManifest.runId} runtime layout app`
        const metahubCodename = `${runManifest.runId}-runtime-layout-app`
        const publicationName = `E2E ${runManifest.runId} Runtime Layout Publication`
        const applicationName = `E2E ${runManifest.runId} Runtime Layout Application`
        const alphaTitle = `Alpha Runtime ${runManifest.runId}`
        const betaTitle = `Beta Runtime ${runManifest.runId}`

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename)
            })

            if (!metahub?.id) {
                throw new Error('Metahub creation did not return an id for runtime view coverage')
            }

            await recordCreatedMetahub({
                id: metahub.id,
                name: metahubName,
                codename: metahubCodename
            })

            const objectCollectionId = await waitForObjectId(api, metahub.id)
            // The object may already expose a seeded/system `title` component;
            // tolerate the codename conflict and verify the runtime contract
            // below through the real create dialog instead.
            try {
                await createComponent(api, metahub.id, objectCollectionId, {
                    name: { en: 'Title' },
                    namePrimaryLocale: 'en',
                    codename: createLocalizedContent('en', 'title'),
                    dataType: 'STRING',
                    isRequired: false
                })
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                if (!message.includes('409')) throw error
            }

            await configureEnhancedLayout(api, metahub.id)

            const publication = await createPublication(api, metahub.id, {
                name: { en: publicationName },
                namePrimaryLocale: 'en',
                autoCreateApplication: false
            })

            if (!publication?.id) {
                throw new Error('Publication creation did not return an id for runtime view coverage')
            }

            await recordCreatedPublication({
                id: publication.id,
                metahubId: metahub.id,
                schemaName: publication.schemaName
            })

            await createPublicationVersion(api, metahub.id, publication.id, {
                name: { en: `E2E ${runManifest.runId} Runtime Layout Version` },
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
                throw new Error('Linked application creation did not return an id for runtime view coverage')
            }

            await recordCreatedApplication({
                id: applicationId
            })

            await syncApplicationSchema(api, applicationId)

            await page.goto(`/a/${applicationId}`)

            const detailsTable = page.locator('.MuiDataGrid-root').first()

            await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })
            await expect(detailsTable).toBeVisible({ timeout: 30_000 })
            await expect(detailsTable.getByRole('columnheader', { name: 'Title' })).toBeVisible()
            // A single-object application renders the records.list details table,
            // which intentionally has no card/table toggle or header search; the
            // card/table toggle belongs to records.union dashboards and is covered
            // by the layout view-settings authoring test above.

            const createAlphaRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`),
                { label: 'Creating alpha runtime row' }
            )
            await page.getByTestId(applicationSelectors.runtimeCreateButton).click()
            const createAlphaDialog = page.getByRole('dialog', { name: 'Create element' })
            await expect(createAlphaDialog).toBeVisible()
            await createAlphaDialog.getByLabel('Title').first().fill(alphaTitle)
            await createAlphaDialog.getByTestId(entityDialogSelectors.submitButton).click()
            expect((await createAlphaRequest).ok()).toBe(true)
            await expect(page.getByText(alphaTitle)).toBeVisible({ timeout: 30_000 })

            const createBetaRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`),
                { label: 'Creating beta runtime row' }
            )
            await page.getByTestId(applicationSelectors.runtimeCreateButton).click()
            const createBetaDialog = page.getByRole('dialog', { name: 'Create element' })
            await expect(createBetaDialog).toBeVisible()
            await createBetaDialog.getByLabel('Title').first().fill(betaTitle)
            await createBetaDialog.getByTestId(entityDialogSelectors.submitButton).click()
            expect((await createBetaRequest).ok()).toBe(true)
            await expect(page.getByText(alphaTitle)).toBeVisible({ timeout: 30_000 })
            await expect(page.getByText(betaTitle)).toBeVisible({ timeout: 30_000 })
        } finally {
            await disposeApiContext(api)
        }
    })

    test('@flow union dashboard applies view settings and search at runtime', async ({ page, runManifest }) => {
        test.setTimeout(240_000)

        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const metahubName = `E2E ${runManifest.runId} union runtime views`
        const metahubCodename = `${runManifest.runId}-union-runtime-views`
        const publicationName = `E2E ${runManifest.runId} Union Runtime Publication`
        const applicationName = `E2E ${runManifest.runId} Union Runtime Application`
        const rowTitle = `Union alpha ${runManifest.runId}`

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename)
            })
            if (!metahub?.id) throw new Error('Metahub creation did not return an id for the union runtime coverage')
            await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

            await waitForObjectId(api, metahub.id)
            const objectCollections = await listObjectCollections(api, metahub.id, { limit: 100, offset: 0 })
            const objectCodename = readCodename(objectCollections?.items?.[0]?.codename)
            if (!objectCodename) throw new Error('Union runtime coverage could not resolve the object codename')

            // Configure the details widget as a records.union datasource with the
            // authored view settings; this is the surface that owns the runtime
            // card/table toggle and the header search.
            const layoutId = await waitForLayoutId(api, metahub.id)
            const widgetsPayload = await listLayoutZoneWidgets(api, metahub.id, layoutId)
            const detailsWidget = (widgetsPayload?.items ?? []).find(
                (widget: Record<string, unknown>) => widget.widgetKey === 'detailsTable'
            )
            if (!detailsWidget || typeof detailsWidget.id !== 'string' || typeof detailsWidget.version !== 'number') {
                throw new Error('Union runtime coverage did not find a versioned details table widget')
            }
            await updateLayoutZoneWidgetConfig(api, metahub.id, layoutId, detailsWidget.id, {
                config: {
                    ...(typeof detailsWidget.config === 'object' && detailsWidget.config ? detailsWidget.config : {}),
                    datasource: { kind: 'records.union', targets: [{ objectCollectionCodename: objectCodename }] },
                    showViewToggle: true,
                    showSearch: true,
                    createTargets: [
                        {
                            id: 'main-target',
                            label: createLocalizedContent('en', 'Main'),
                            objectCollectionCodename: objectCodename,
                            surface: 'dialog'
                        }
                    ]
                },
                expectedVersion: detailsWidget.version
            })

            const publication = await createPublication(api, metahub.id, {
                name: { en: publicationName },
                namePrimaryLocale: 'en',
                autoCreateApplication: false
            })
            if (!publication?.id) throw new Error('Publication creation did not return an id for the union runtime coverage')
            await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })

            await createPublicationVersion(api, metahub.id, publication.id, {
                name: { en: `E2E ${runManifest.runId} Union Runtime Version` },
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
            if (typeof applicationId !== 'string') throw new Error('Union runtime coverage did not create an application')
            await recordCreatedApplication({ id: applicationId })
            await syncApplicationSchema(api, applicationId)

            await page.goto(`/a/${applicationId}`)

            const unionSurface = page.getByTestId('records-union-details-table')
            await expect(unionSurface).toBeVisible({ timeout: 30_000 })

            // Authored view settings reach the runtime: the toolbar exposes the
            // card/table toggle and the search field.
            const cardViewButton = page.getByRole('button', { name: 'Card view' })
            const tableViewButton = page.getByRole('button', { name: 'Table view' })
            await expect(cardViewButton).toBeVisible({ timeout: 30_000 })
            await expect(tableViewButton).toBeVisible()
            await expect(tableViewButton).toHaveAttribute('aria-pressed', 'true')

            const searchField = page.getByLabel('Search…').first()
            await expect(searchField).toBeVisible()

            const createMenuButton = page.getByTestId('records-union-create-target-menu-button')
            await expect(createMenuButton).toBeVisible()
            await createMenuButton.click()
            await page.getByRole('menuitem', { name: 'Main', exact: true }).click()
            const createDialog = page.getByRole('dialog').first()
            await expect(createDialog).toBeVisible({ timeout: 15_000 })
            await createDialog.getByLabel('Title').first().fill(rowTitle)
            await createDialog.getByTestId(entityDialogSelectors.submitButton).click()

            await expect(page.getByText(rowTitle)).toBeVisible({ timeout: 30_000 })

            // The authored card view renders the created row as a card.
            await cardViewButton.click()
            await expect(cardViewButton).toHaveAttribute('aria-pressed', 'true')
            const cardView = page.getByTestId('records-union-card-view').first()
            await expect(cardView).toBeVisible({ timeout: 30_000 })
            await expect(cardView.getByText(rowTitle)).toBeVisible()
            await tableViewButton.click()
            await expect(tableViewButton).toHaveAttribute('aria-pressed', 'true')

            // Search filters the union rows.
            await searchField.fill(rowTitle)
            await expect(page.getByText(rowTitle)).toBeVisible({ timeout: 30_000 })
        } finally {
            await disposeApiContext(api)
        }
    })
})
