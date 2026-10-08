import type { Page, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createLayout,
    createApplicationLayout,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    deleteApplicationLayout,
    disposeApiContext,
    getApplicationLayout,
    listConnectors,
    listLayoutZoneWidgets,
    listLayouts,
    listApplicationLayoutWidgetObject,
    listApplicationLayouts,
    syncApplicationSchema,
    syncPublication,
    updateApplicationLayout,
    updateLayout,
    upsertApplicationLayoutWidget,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { buildLayoutWidgetSelector } from '../../support/selectors/contracts'

type ApplicationLayoutListResponse = {
    items?: Array<{
        id?: string
        sourceKind?: string
        sourceLayoutId?: string | null
        syncState?: string
        version?: number
    }>
}

type ApplicationLayoutDetailResponse = {
    item?: {
        id?: string
        sourceKind?: string
        syncState?: string
        version?: number
    }
    widgets?: Array<{
        id?: string
        zone?: string
        widgetKey?: string
    }>
}

type ApplicationLayoutWidgetObjectResponse = {
    items?: Array<{
        key?: string
        allowedZones?: string[]
    }>
}

async function captureProofScreenshot(page: Page, testInfo: TestInfo, name: string) {
    await page.screenshot({
        path: testInfo.outputPath(name),
        fullPage: true,
        animations: 'disabled'
    })
}

function expectWidthParity(firstWidth: number | null | undefined, secondWidth: number | null | undefined, maxRelativeDelta = 0.1) {
    expect(firstWidth).toBeTruthy()
    expect(secondWidth).toBeTruthy()

    const left = firstWidth ?? 0
    const right = secondWidth ?? 0
    const baseline = Math.max(left, right, 1)

    expect(Math.abs(left - right) / baseline).toBeLessThan(maxRelativeDelta)
}

async function waitForApplicationLayoutId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = (await listApplicationLayouts(api, applicationId, { limit: 20, offset: 0 })) as ApplicationLayoutListResponse
            const metahubLayout = response.items?.find((item) => item.sourceKind === 'metahub')
            layoutId = metahubLayout?.id ?? response.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`Application ${applicationId} did not expose any managed layouts`)
    }

    return layoutId
}

async function waitForWidgetZone(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    layoutId: string,
    widgetId: string,
    expectedZone: string
) {
    await expect
        .poll(async () => {
            const detail = (await getApplicationLayout(api, applicationId, layoutId)) as ApplicationLayoutDetailResponse
            return detail.widgets?.find((widget) => widget.id === widgetId)?.zone
        })
        .toBe(expectedZone)
}

test('@flow @combined application layout management exposes sourced layouts and registry-authorized widget reordering', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} application layouts metahub`
    const metahubCodename = `${runManifest.runId}-application-layouts-metahub`
    const publicationName = `E2E ${runManifest.runId} application layouts publication`
    const applicationName = `E2E ${runManifest.runId} application layouts app`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'basic-demo'
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for application layout management coverage')
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
            throw new Error('Publication creation did not return an id for application layout management coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} application layouts v1` },
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
            throw new Error('Linked application creation did not return an id for application layout management coverage')
        }

        await recordCreatedApplication({
            id: applicationId
        })

        await syncApplicationSchema(api, applicationId)

        const layoutId = await waitForApplicationLayoutId(api, applicationId)
        const detail = (await getApplicationLayout(api, applicationId, layoutId)) as ApplicationLayoutDetailResponse
        expect(detail.item?.sourceKind).toBe('metahub')
        expect(detail.item?.syncState).toBe('clean')

        const widgetObject = (await listApplicationLayoutWidgetObject(
            api,
            applicationId,
            layoutId
        )) as ApplicationLayoutWidgetObjectResponse
        expect(widgetObject.items?.some((item) => item.key === 'divider' && item.allowedZones?.includes('top'))).toBe(true)

        const centerWidget = detail.widgets?.find(
            (widget) => widget.widgetKey === 'overviewCards' && widget.zone === 'center' && typeof widget.id === 'string'
        )
        if (!centerWidget?.id || !centerWidget.widgetKey) {
            throw new Error(`Application layout ${layoutId} did not expose a center widget for reorder coverage`)
        }

        const localLayoutName = `E2E ${runManifest.runId} local move layout`
        const localLayoutResponse = await createApplicationLayout(api, applicationId, {
            templateKey: 'dashboard',
            scopeEntityId: null,
            name: { en: localLayoutName },
            isActive: true,
            isDefault: false,
            sortOrder: 99,
            config: {}
        })
        const localLayout = localLayoutResponse?.item ?? localLayoutResponse
        if (typeof localLayout?.id !== 'string') {
            throw new Error('Application-owned layout creation did not return an id for widget reorder coverage')
        }
        const localLayoutId = localLayout.id

        await page.goto(`/a/${applicationId}/admin/layouts`)
        await expect(page.getByRole('heading', { name: 'Layouts' })).toBeVisible()
        await expect(page.getByText('Metahub', { exact: true })).toBeVisible()
        await expect(page.getByText('Clean', { exact: true }).first()).toBeVisible()
        await expect(page.getByText(localLayoutName, { exact: true })).toBeVisible()
        const appListRect = await page.getByTestId('application-layouts-list-content').boundingBox()
        await captureProofScreenshot(page, testInfo, 'application-layouts-list.png')

        await page.goto(`/a/${applicationId}/admin/layouts/${layoutId}`)
        await expect(page.getByRole('heading', { name: 'Main' })).toBeVisible()
        const sourcedWidgetCard = page.getByTestId(buildLayoutWidgetSelector(centerWidget.id))
        await expect(sourcedWidgetCard).toBeVisible()
        await expect(sourcedWidgetCard.getByTestId(`layout-widget-duplicate-${centerWidget.id}`)).toHaveCount(0)
        await expect(sourcedWidgetCard.getByTestId(`layout-widget-move-menu-${centerWidget.id}`)).toHaveCount(0)
        await captureProofScreenshot(page, testInfo, 'application-layouts-detail-sourced.png')

        await page.goto(`/a/${applicationId}/admin/layouts/${localLayoutId}`)
        await expect(page.getByRole('heading', { name: localLayoutName })).toBeVisible()
        for (const zoneName of ['Top', 'Left', 'Center', 'Right', 'Bottom']) {
            await expect(page.getByRole('heading', { name: zoneName })).toBeVisible()
        }

        const currentDetail = (await getApplicationLayout(api, applicationId, localLayoutId)) as ApplicationLayoutDetailResponse
        const currentVersion = currentDetail.item?.version
        if (!Number.isInteger(currentVersion) || (currentVersion ?? 0) < 1) {
            throw new Error(`Application-owned layout ${localLayoutId} did not expose a version for cross-zone reorder setup`)
        }
        const dividerResponse = await upsertApplicationLayoutWidget(api, applicationId, localLayoutId, {
            widgetKey: 'divider',
            zone: 'left',
            sortOrder: 99,
            config: {},
            expectedVersion: currentVersion
        })
        const dividerItem = dividerResponse?.item ?? dividerResponse
        if (typeof dividerItem?.id !== 'string') {
            throw new Error(`Application-owned layout ${localLayoutId} did not return the created divider placement`)
        }
        const detailWithDivider = (await getApplicationLayout(api, applicationId, localLayoutId)) as ApplicationLayoutDetailResponse
        const movableWidget = detailWithDivider.widgets?.find((widget) => widget.id === dividerItem.id)
        if (!movableWidget?.id) {
            throw new Error(
                `Application-owned layout ${localLayoutId} did not persist the divider widget used for cross-zone reorder coverage`
            )
        }
        expect(movableWidget).toMatchObject({ widgetKey: 'divider', zone: 'left' })

        // The placement was created through the API client while the editor route was open.
        // Reload so the browser query cache observes that out-of-band change before the move flow.
        await page.reload()
        await expect(page.getByRole('heading', { name: localLayoutName })).toBeVisible()
        const appDetailRect = await page.getByTestId('application-layout-details-content').boundingBox()
        const appTopZoneRect = await page.getByTestId('layout-zone-top').boundingBox()
        await captureProofScreenshot(page, testInfo, 'application-layouts-detail-before-move.png')

        const movableWidgetCard = page.getByTestId(buildLayoutWidgetSelector(movableWidget.id))
        await expect(movableWidgetCard).toBeVisible()
        await movableWidgetCard.getByTestId(`layout-widget-move-menu-${movableWidget.id}`).click()
        const moveResponsePromise = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/layouts/${localLayoutId}/zone-widgets/move`,
            { label: 'Moving a dashboard widget between allowed zones' }
        )
        await page.getByTestId(`layout-widget-move-${movableWidget.id}-top`).click()
        expect((await moveResponsePromise).ok()).toBe(true)
        await waitForWidgetZone(api, applicationId, localLayoutId, movableWidget.id, 'top')
        await expect(movableWidgetCard).toBeVisible()
        await captureProofScreenshot(page, testInfo, 'application-layouts-detail-after-move.png')

        const metahubLayouts = await listLayouts(api, metahub.id, { limit: 20, offset: 0 })
        const metahubLayoutId = metahubLayouts.items?.[0]?.id
        if (typeof metahubLayoutId !== 'string') {
            throw new Error(`Metahub ${metahub.id} did not expose a layout for parity coverage`)
        }

        await page.goto(`/metahub/${metahub.id}/resources`)
        await page.getByRole('tab', { name: 'Layouts', exact: true }).click()
        await expect(page.getByTestId('metahub-layouts-list-content')).toBeVisible()
        const metahubListRect = await page.getByTestId('metahub-layouts-list-content').boundingBox()
        await captureProofScreenshot(page, testInfo, 'metahub-layouts-list.png')

        await page.goto(`/metahub/${metahub.id}/resources/layouts/${metahubLayoutId}`)
        await expect(page.getByTestId('metahub-layout-details-content')).toBeVisible()
        for (const zoneName of ['Top', 'Left', 'Center', 'Right', 'Bottom']) {
            await expect(page.getByRole('heading', { name: `${zoneName} zone`, exact: true })).toBeVisible()
        }
        const metahubWidgetPayload = (await listLayoutZoneWidgets(api, metahub.id, metahubLayoutId)) as {
            items?: Array<{ id?: string; widgetKey?: string; zone?: string }>
        }
        const metahubWidget = metahubWidgetPayload.items?.find(
            (widget) => widget.widgetKey === 'overviewCards' && widget.zone === 'center' && typeof widget.id === 'string'
        )
        if (!metahubWidget?.id || !metahubWidget.widgetKey) {
            throw new Error(`Metahub layout ${metahubLayoutId} did not expose a center widget for duplicate coverage`)
        }
        const metahubWidgetCard = page.getByTestId(buildLayoutWidgetSelector(metahubWidget.id))
        await expect(metahubWidgetCard).toBeVisible()
        const duplicateMetahubWidgetResponsePromise = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                new URL(response.url()).pathname ===
                    `/api/v1/metahub/${metahub.id}/layout/${metahubLayoutId}/zone-widget/placement-duplicate`,
            { label: 'Duplicating a dashboard widget in the metahub layout' }
        )
        await metahubWidgetCard.getByTestId(`layout-widget-duplicate-${metahubWidget.id}`).click()
        expect((await duplicateMetahubWidgetResponsePromise).ok()).toBe(true)
        await expect
            .poll(async () => {
                const current = (await listLayoutZoneWidgets(api, metahub.id, metahubLayoutId)) as {
                    items?: Array<{ id?: string; widgetKey?: string; zone?: string }>
                }
                return (
                    current.items?.filter((widget) => widget.widgetKey === metahubWidget.widgetKey && widget.id !== metahubWidget.id)
                        .length ?? 0
                )
            })
            .toBeGreaterThan(0)
        const metahubDetailRect = await page.getByTestId('metahub-layout-details-content').boundingBox()
        const metahubTopZoneRect = await page.getByTestId('layout-zone-top').boundingBox()
        await captureProofScreenshot(page, testInfo, 'metahub-layouts-detail.png')

        expectWidthParity(appListRect?.width, metahubListRect?.width, 0.08)
        expectWidthParity(appDetailRect?.width, metahubDetailRect?.width, 0.12)
        expectWidthParity(appTopZoneRect?.width, metahubTopZoneRect?.width, 0.12)
        await expect(page.getByTestId(`layout-zone-top`)).toBeVisible()
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow @combined application layout sync resolves layout conflicts, preserves excluded sources, and imports new metahub layouts', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(360_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} application layout conflict metahub`
    const metahubCodename = `${runManifest.runId}-application-layout-conflict-metahub`
    const publicationName = `E2E ${runManifest.runId} application layout conflict publication`
    const applicationName = `E2E ${runManifest.runId} application layout conflict app`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for layout conflict coverage')
        }

        const secondarySourceLayout = await createLayout(api, metahub.id, {
            name: { en: 'Secondary source layout' },
            namePrimaryLocale: 'en',
            isActive: true,
            isDefault: false
        })
        if (!secondarySourceLayout?.id || typeof secondarySourceLayout.version !== 'number') {
            throw new Error('Creating secondary source layout did not return an id and optimistic-lock version')
        }

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })
        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for layout conflict coverage')
        }

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} application layout conflict v1` },
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
            throw new Error('Linked application creation did not return an application id for layout conflict coverage')
        }

        await syncApplicationSchema(api, applicationId)

        const connectorList = await listConnectors(api, applicationId)
        const connectorId = connectorList.items?.[0]?.id
        if (typeof connectorId !== 'string') {
            throw new Error(`Application ${applicationId} did not expose a connector for layout conflict coverage`)
        }

        const metahubLayouts = await listLayouts(api, metahub.id, { limit: 20, offset: 0 })
        const baseMetahubLayoutId = metahubLayouts.items?.find(
            (item: { id?: string; idSource?: string | null }) => item.id !== secondarySourceLayout.id
        )?.id
        if (typeof baseMetahubLayoutId !== 'string') {
            throw new Error('Could not resolve the primary metahub layout id for exclusion coverage')
        }

        const initialAppLayouts = (await listApplicationLayouts(api, applicationId, {
            limit: 50,
            offset: 0
        })) as ApplicationLayoutListResponse
        const baseImportedLayout = initialAppLayouts.items?.find((item) => item.sourceLayoutId === baseMetahubLayoutId)
        const secondaryImportedLayout = initialAppLayouts.items?.find((item) => item.sourceLayoutId === secondarySourceLayout.id)
        if (!baseImportedLayout?.id || !secondaryImportedLayout?.id) {
            throw new Error(`Application ${applicationId} did not import the expected metahub layouts`)
        }

        const independentLayoutResponse = await createApplicationLayout(api, applicationId, {
            templateKey: 'dashboard',
            scopeEntityId: null,
            name: { en: `E2E ${runManifest.runId} independent default layout` },
            isActive: true,
            isDefault: false,
            sortOrder: 99,
            config: {}
        })
        const independentLayout = independentLayoutResponse?.item ?? independentLayoutResponse
        if (!independentLayout?.id || typeof independentLayout.version !== 'number') {
            throw new Error('Creating an independent application-owned layout did not return a versioned layout')
        }

        await updateApplicationLayout(api, applicationId, independentLayout.id, {
            isDefault: true,
            expectedVersion: independentLayout.version
        })
        const refreshedAppLayouts = (await listApplicationLayouts(api, applicationId, {
            limit: 50,
            offset: 0
        })) as ApplicationLayoutListResponse
        const refreshedBaseImportedLayout = refreshedAppLayouts.items?.find((item) => item.id === baseImportedLayout.id)
        if (!refreshedBaseImportedLayout?.id || typeof refreshedBaseImportedLayout.version !== 'number') {
            throw new Error('Could not refresh the previous default layout before deletion')
        }
        expect(refreshedBaseImportedLayout.isDefault).toBe(false)
        expect(refreshedBaseImportedLayout.version).toBeGreaterThan(baseImportedLayout.version)
        await deleteApplicationLayout(api, applicationId, refreshedBaseImportedLayout.id, refreshedBaseImportedLayout.version)
        await updateApplicationLayout(api, applicationId, secondaryImportedLayout.id, {
            name: { en: 'Secondary source layout locally customized' },
            expectedVersion: secondaryImportedLayout.version
        })

        await updateLayout(api, metahub.id, secondarySourceLayout.id, {
            name: { en: 'Secondary source layout updated upstream' },
            namePrimaryLocale: 'en',
            expectedVersion: secondarySourceLayout.version
        })
        const newSourceLayout = await createLayout(api, metahub.id, {
            name: { en: 'Brand new source layout' },
            namePrimaryLocale: 'en',
            isActive: true,
            isDefault: false
        })
        if (!newSourceLayout?.id) {
            throw new Error('Creating a new source layout did not return an id')
        }

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} application layout conflict v2` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        await page.goto(`/a/${applicationId}/admin/connector/${connectorId}`)
        await page.getByRole('button', { name: 'Sync Schema' }).click()
        await expect(page.getByText('Layout changes may conflict with application-side customizations.')).toBeVisible()
        await expect(page.getByText('Local and source changes diverged')).toBeVisible()
        await expect(page.getByText('Default layout collision')).toBeVisible()
        await captureProofScreenshot(page, testInfo, 'application-layout-conflict-dialog.png')

        await page.getByTestId('connector-layout-resolution-bulk-trigger').click()
        await page.getByRole('option', { name: 'Copy metahub source as a new application layout' }).click()
        await page.getByRole('button', { name: 'Apply Changes' }).click()

        await expect(page.getByTestId('connector-diff-dialog')).not.toBeVisible({ timeout: 30_000 })

        await expect
            .poll(
                async () => {
                    const response = (await listApplicationLayouts(api, applicationId, {
                        limit: 50,
                        offset: 0
                    })) as ApplicationLayoutListResponse
                    const excludedBase = response.items?.find(
                        (item) => item.sourceLayoutId === baseMetahubLayoutId && item.syncState === 'source_excluded'
                    )
                    const copiedConflictLayout = response.items?.find(
                        (item) => item.sourceKind === 'application' && item.sourceLayoutId === secondarySourceLayout.id
                    )
                    const importedNewLayout = response.items?.find(
                        (item) => item.sourceKind === 'metahub' && item.sourceLayoutId === newSourceLayout.id
                    )

                    return Boolean(excludedBase && copiedConflictLayout && importedNewLayout)
                },
                { timeout: 30_000 }
            )
            .toBe(true)

        await page.goto(`/a/${applicationId}/admin/layouts`)
        await expect(page.getByText('Application', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('Excluded', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('Metahub', { exact: true }).first()).toBeVisible()
        await captureProofScreenshot(page, testInfo, 'application-layouts-after-conflict-sync.png')
    } finally {
        await disposeApiContext(api)
    }
})
