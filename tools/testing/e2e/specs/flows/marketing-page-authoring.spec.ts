import type { Locator, Page, Response, TestInfo } from '@playwright/test'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    disposeApiContext,
    getApplication,
    getApplicationLayout,
    getMarketingPageRuntime,
    getPublication,
    listLayoutZoneWidgets,
    listLayouts,
    listApplicationLayouts,
    listConnectors,
    listPublicationApplications
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'
import { parseJsonResponse, readLocalizedText } from './entity-runtime-helpers'
import { flattenMarketingPageRecords, type RuntimePayload } from '../../support/marketingPageRuntimeMaterialization'

type ApiSession = Awaited<ReturnType<typeof createLoggedInApiContext>>

type EntityResponse = {
    id?: string
    data?: {
        id?: string
    }
}

type PublicationApplication = {
    id?: string
    slug?: string
}

type PublicationApplicationsResponse = {
    items?: PublicationApplication[]
}

type Connector = {
    id?: string
    name?: unknown
}

type ConnectorsResponse = {
    items?: Connector[]
}

type LayoutWidget = {
    id?: unknown
    widgetKey?: unknown
    zone?: unknown
    config?: unknown
}

type LayoutWidgetsResponse = {
    items?: LayoutWidget[]
}

const unwrapEntity = <T extends EntityResponse>(payload: T): { id?: string } => payload.data ?? payload

const buildExecutionRunId = (runId: string, testInfo: TestInfo): string => {
    const project =
        testInfo.project.name
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase()
            .slice(-6) || 'project'
    return `${runId}-${project}-r${testInfo.retry}-p${testInfo.repeatEachIndex}-w${testInfo.workerIndex}`
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const responseIsMutation = (response: Response, method: string, path: RegExp): boolean =>
    response.request().method() === method && path.test(new URL(response.url()).pathname)

const openCreateDialog = async (page: Page, name: string): Promise<Locator> => {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name })
    await expect(dialog).toBeVisible()
    return dialog
}

const fillLocalizedField = async (dialog: Locator, label: string, value: string): Promise<void> => {
    // LocalizedInlineField renders a labelled textbox for the active locale;
    // role/name is stable even while MUI rehydrates the floating label.
    await dialog.getByRole('textbox', { name: label, exact: true }).first().fill(value)
}

const enableSwitch = async (dialog: Locator, label: string): Promise<void> => {
    const input = dialog.getByLabel(label, { exact: true })
    await expect(input).toBeEnabled()

    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await input.isChecked()) break

        try {
            await input.evaluate((element) => {
                ;(element as HTMLInputElement).click()
            })
        } catch {
            await input.setChecked(true, { force: true })
        }

        if (await input.isChecked()) break
        await input.click({ force: true })
    }

    await expect(input).toBeChecked()
}

const selectMarketingTemplate = async (page: Page, dialog: Locator): Promise<void> => {
    const templateSelect = dialog.getByLabel('Select template', { exact: true })
    await expect(templateSelect).toBeVisible()
    await templateSelect.click()

    const marketingOption = page.getByRole('option', { name: /Marketing page/i })
    await expect(marketingOption).toBeVisible()
    await marketingOption.click()
    await expect(templateSelect).toContainText(/Marketing page/i)
}

const openVisibleRowMenu = async (page: Page, text: string): Promise<Locator> => {
    const row = page.getByRole('row').filter({ hasText: text }).first()
    await expect(row, `The row containing “${text}” should be visible`).toBeVisible()

    const menuButton = row.getByRole('button', { name: 'Options', exact: true })
    await expect(menuButton, `The row action for “${text}” should have a friendly accessible name`).toBeVisible()
    await expect(menuButton).not.toHaveAttribute('aria-label', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    await menuButton.click()
    return row
}

const ensureListView = async (page: Page): Promise<void> => {
    const listView = page.getByTitle('List View', { exact: true })
    if (await listView.count()) {
        await listView.click()
    }
}

const waitForPublicationApplication = async (
    api: ApiSession,
    metahubId: string,
    publicationId: string
): Promise<PublicationApplication> => {
    let application: PublicationApplication | undefined
    await expect
        .poll(
            async () => {
                const payload = (await listPublicationApplications(api, metahubId, publicationId)) as PublicationApplicationsResponse
                application = payload.items?.[0]
                return application?.id ?? null
            },
            { timeout: 90_000, message: 'Waiting for the publication-linked application to be created' }
        )
        .not.toBeNull()

    if (!application?.id) {
        throw new Error('The publication did not expose a linked application')
    }

    return application
}

const waitForApplicationConnector = async (api: ApiSession, applicationId: string): Promise<Connector> => {
    let connector: Connector | undefined
    await expect
        .poll(
            async () => {
                const payload = (await listConnectors(api, applicationId)) as ConnectorsResponse
                connector = payload.items?.[0]
                return connector?.id ?? null
            },
            { timeout: 90_000, message: 'Waiting for the publication connector to be created' }
        )
        .not.toBeNull()

    if (!connector?.id) {
        throw new Error('The linked application did not expose a connector')
    }

    return connector
}

const waitForPublicationVersion = async (api: ApiSession, metahubId: string, publicationId: string): Promise<void> => {
    await expect
        .poll(
            async () => {
                const publication = await getPublication(api, metahubId, publicationId)
                return {
                    activeVersionId: publication?.activeVersionId ?? null,
                    schemaStatus: publication?.schemaStatus ?? null
                }
            },
            { timeout: 90_000, message: 'Waiting for the publication to expose an active version' }
        )
        .toMatchObject({ activeVersionId: expect.any(String) })
}

const readLayoutWidgetConfig = (widget: LayoutWidget): Record<string, unknown> => {
    if (!widget.config || typeof widget.config !== 'object' || Array.isArray(widget.config)) return {}
    return widget.config as Record<string, unknown>
}

const findMarketingWidget = async (
    api: ApiSession,
    metahubId: string,
    instanceKey: string
): Promise<{ layoutId: string; widgetId: string }> => {
    const layouts = (await listLayouts(api, metahubId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: unknown; templateKey?: unknown }>
    }
    const marketingLayout = layouts.items?.find((layout) => layout.templateKey === 'marketing-page')
    if (typeof marketingLayout?.id !== 'string') {
        throw new Error('The browser-created marketing-page metahub did not expose its marketing layout')
    }

    const widgets = (await listLayoutZoneWidgets(api, metahubId, marketingLayout.id)) as LayoutWidgetsResponse
    const widget = widgets.items?.find((item) => readLayoutWidgetConfig(item).instanceKey === instanceKey)
    if (typeof widget?.id !== 'string') {
        throw new Error(`The marketing layout did not expose the ${instanceKey} widget`)
    }
    return { layoutId: marketingLayout.id, widgetId: widget.id }
}

test('@flow @combined @marketing-page browser authoring publishes edited content into the runtime', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(420_000)

    const executionRunId = buildExecutionRunId(runManifest.runId, testInfo)
    const metahubName = `E2E ${executionRunId} marketing authoring`
    const metahubCodename = `${executionRunId}-marketing-authoring`
    const publicationName = `E2E ${executionRunId} Marketing Publication`
    const updatedHeroTitle = `Our latest ${executionRunId}`

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        await applyBrowserPreferences(page, { language: 'en' })

        // Create the metahub through the real template picker. The API is used only
        // to observe the settled response and to register deterministic cleanup.
        await page.goto('/metahubs')
        const metahubDialog = await openCreateDialog(page, 'Create Metahub')
        await expectNoTechnicalLeakage(metahubDialog, {
            label: 'Marketing metahub create dialog',
            checkUuidSubstrings: true
        })
        await fillLocalizedField(metahubDialog, 'Name', metahubName)
        await fillLocalizedField(metahubDialog, 'Codename', metahubCodename)
        await selectMarketingTemplate(page, metahubDialog)

        const metahubResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', /\/api\/v1\/metahubs$/),
            { label: 'Creating a marketing-page metahub through the browser picker', timeout: 90_000 }
        )
        await metahubDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const metahubPayload = await parseJsonResponse<EntityResponse>(
            await metahubResponsePromise,
            'Creating a marketing-page metahub through the browser picker'
        )
        const metahub = unwrapEntity(metahubPayload)
        if (!metahub.id) {
            throw new Error('The browser-created marketing-page metahub did not return an id')
        }
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        // Change the persisted widget composition through the real metahub
        // authoring surface before publication. The later runtime assertion
        // proves that publication carries this semantic choice forward.
        const { layoutId: marketingLayoutId, widgetId: faqWidgetId } = await findMarketingWidget(api, metahub.id, 'faq')
        await page.goto(`/metahub/${metahub.id}/resources/layouts/${marketingLayoutId}`)
        const marketingLayoutDetails = page.getByTestId('metahub-layout-details-content')
        await expect(marketingLayoutDetails).toBeVisible()
        const faqSurface = page.getByTestId(`layout-widget-${faqWidgetId}`)
        await expect(faqSurface).toBeVisible()
        const deactivateFaqButton = faqSurface.getByRole('button', { name: 'Deactivate', exact: true })
        await expect(deactivateFaqButton).toBeVisible()
        const deactivateFaqResponse = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/toggle-active$/),
            { label: 'Deactivating the FAQ widget before publication', timeout: 90_000 }
        )
        await deactivateFaqButton.click()
        expect((await deactivateFaqResponse).ok()).toBe(true)
        await expect(faqSurface.getByRole('button', { name: 'Activate', exact: true })).toBeVisible()

        // Open the singleton site-settings object and edit its localized hero
        // title through the generic object/record authoring surface.  Hero and
        // footer runtime values are owned by this record; the renderer must
        // not silently read a second, stale source.
        await page.goto(`/metahub/${metahub.id}/entities/object/instances`)
        await expect(page.getByRole('heading', { name: 'Objects', exact: true })).toBeVisible()
        await ensureListView(page)
        const siteSettingsLink = page.getByRole('link', { name: 'Marketing site settings', exact: true })
        await expect(siteSettingsLink).toBeVisible()
        await siteSettingsLink.click()
        await expect(page).toHaveURL(/\/components$/)
        await page.getByRole('tab', { name: 'Records', exact: true }).click()
        await expect(page).toHaveURL(/\/records$/)
        await expect(page.getByRole('heading', { name: 'Records', exact: true })).toBeVisible()

        const siteSettingsRow = page
            .getByRole('row')
            .filter({ hasText: /Our latest/ })
            .first()
        await expect(siteSettingsRow).toBeVisible()
        await siteSettingsRow.getByRole('button', { name: 'Options', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()

        const recordDialog = page.getByRole('dialog', { name: /Edit (Element|Record)/ })
        await expect(recordDialog).toBeVisible()
        await expectNoTechnicalLeakage(recordDialog, {
            label: 'Marketing site settings record dialog',
            checkUuidSubstrings: true
        })
        await expectSemanticFieldControls(recordDialog, { longTextLabels: ['Hero subtitle'] })
        await fillLocalizedField(recordDialog, 'Hero title', updatedHeroTitle)

        const recordUpdatePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
            { label: 'Updating the marketing hero through the generic record dialog', timeout: 90_000 }
        )
        await recordDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const recordUpdateResponse = await recordUpdatePromise
        expect(recordUpdateResponse.ok()).toBe(true)
        await expect(recordDialog).toHaveCount(0)
        await expect(page.getByRole('row').filter({ hasText: updatedHeroTitle }).first()).toBeVisible()

        // Create a publication and linked application from the UI. Application
        // schema creation is intentionally completed below in ConnectorBoard,
        // where the real diff/confirmation dialog is available.
        await page.goto(`/metahub/${metahub.id}/publications`)
        await expect(page.getByRole('heading', { name: 'Publications', exact: true })).toBeVisible()
        await ensureListView(page)

        const publicationResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', new RegExp(`/api/v1/metahub/${metahub.id}/publications$`)),
            { label: 'Creating the marketing publication through the browser dialog', timeout: 120_000 }
        )
        const publicationDialog = await openCreateDialog(page, 'Create Publication')
        await fillLocalizedField(publicationDialog, 'Name', publicationName)
        await enableSwitch(publicationDialog, 'Create application')
        await publicationDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(publicationDialog).toHaveCount(0)

        const publicationPayload = await parseJsonResponse<EntityResponse>(
            await publicationResponsePromise,
            'Creating the marketing publication through the browser dialog'
        )
        const publication = unwrapEntity(publicationPayload)
        if (!publication.id) {
            throw new Error('The browser-created marketing publication did not return an id')
        }
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id })
        await waitForPublicationVersion(api, metahub.id, publication.id)

        // Exercise the publication-level Sync action via its accessible row
        // action menu, then verify that the backend settled successfully.
        await page.goto(`/metahub/${metahub.id}/publications`)
        await ensureListView(page)
        const publicationRow = await openVisibleRowMenu(page, publicationName)
        const publicationSyncPromise = waitForSettledMutationResponse(
            page,
            (response) =>
                responseIsMutation(response, 'POST', new RegExp(`/api/v1/metahub/${metahub.id}/publication/${publication.id}/sync$`)),
            { label: 'Synchronizing the marketing publication from the UI', timeout: 120_000 }
        )
        await page.getByRole('menuitem', { name: 'Sync Schema', exact: true }).click()
        const publicationSyncResponse = await publicationSyncPromise
        expect(publicationSyncResponse.ok()).toBe(true)
        await expect(publicationRow).toBeVisible()

        const application = await waitForPublicationApplication(api, metahub.id, publication.id)
        if (!application.id) {
            throw new Error('The linked marketing application did not return an id')
        }
        await recordCreatedApplication({ id: application.id, slug: application.slug })
        const connector = await waitForApplicationConnector(api, application.id)
        const connectorName = readLocalizedText(connector.name)
        if (!connectorName) {
            throw new Error('The linked marketing application connector did not return a localized display name')
        }

        // Complete the application schema through the real ConnectorBoard diff
        // dialog, so the runtime assertion covers the full publish pipeline.
        await page.goto(`/a/${application.id}/admin/connectors`)
        await expect(page.getByRole('heading', { name: 'Connectors', exact: true })).toBeVisible()
        await ensureListView(page)
        const connectorLink = page.getByRole('link', { name: connectorName, exact: true })
        await expect(connectorLink).toBeVisible()
        await connectorLink.click()
        await expect(page.getByTestId('application-connector-board-schema-card')).toBeVisible()

        const diffResponsePromise = page.waitForResponse(
            (response) => responseIsMutation(response, 'GET', new RegExp(`/api/v1/application/${application.id}/diff$`)),
            { timeout: 120_000 }
        )
        await page.getByTestId('application-connector-board-sync-button').click()
        const diffResponse = await diffResponsePromise
        expect(diffResponse.ok()).toBe(true)

        const diffDialog = page.getByRole('dialog', { name: 'Schema Changes' })
        await expect(diffDialog).toBeVisible()
        const createSchemaButton = diffDialog.getByRole('button', { name: 'Create Schema', exact: true })
        await expect(createSchemaButton).toBeEnabled()

        const applicationSyncPromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', new RegExp(`/api/v1/application/${application.id}/sync$`)),
            { label: 'Creating the marketing application schema from ConnectorBoard', timeout: 180_000 }
        )
        await createSchemaButton.click()
        const applicationSyncResponse = await applicationSyncPromise
        expect(applicationSyncResponse.ok()).toBe(true)
        await expect(diffDialog).toHaveCount(0)
        await expect
            .poll(
                async () => {
                    const current = await getApplication(api, application.id!)
                    return current?.schemaStatus ?? current?.data?.schemaStatus ?? null
                },
                { timeout: 180_000, message: 'Waiting for the marketing application schema to become synced' }
            )
            .toBe('synced')

        // Verify the application authoring surface in Russian after materialization.
        // The widget labels and source identity must remain user-facing and usable
        // after the metahub layout has crossed the publication boundary.
        const applicationLayouts = (await listApplicationLayouts(api, application.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: unknown; templateKey?: unknown }>
        }
        const applicationMarketingLayout = applicationLayouts.items?.find((item) => item.templateKey === 'marketing-page')
        if (typeof applicationMarketingLayout?.id !== 'string') {
            throw new Error('The marketing application did not expose a materialized marketing layout')
        }

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/a/${application.id}/admin/layouts/${applicationMarketingLayout.id}`)
        const applicationLayoutDetails = page.getByTestId('application-layout-details-content')
        await expect(applicationLayoutDetails).toBeVisible()
        for (const [zone, label] of [
            ['marketing-header', 'Шапка маркетинговой страницы'],
            ['marketing-main', 'Содержимое маркетинговой страницы'],
            ['marketing-footer', 'Подвал маркетинговой страницы']
        ] as const) {
            await expect(page.getByTestId(`layout-zone-${zone}`)).toContainText(label)
        }

        const marketingWidgets = (await getApplicationLayout(api, application.id, applicationMarketingLayout.id)) as {
            widgets?: LayoutWidget[]
        }
        const widgetLabels: Record<string, string> = {
            navigation: 'Навигация',
            hero: 'Главный экран',
            logos: 'Коллекция: Логотипы',
            features: 'Коллекция: Возможности',
            testimonials: 'Коллекция: Отзывы',
            highlights: 'Коллекция: Преимущества',
            pricing: 'Тарифы',
            faq: 'Коллекция: FAQ',
            footer: 'Футер'
        }
        for (const [instanceKey, label] of Object.entries(widgetLabels)) {
            const widget = marketingWidgets.widgets?.find(
                (item) => readLayoutWidgetConfig(item).instanceKey === instanceKey && typeof item.id === 'string'
            )
            if (!widget?.id) throw new Error(`The application marketing layout did not expose the ${instanceKey} widget`)
            const surface = page.getByTestId(`layout-widget-${widget.id}`)
            await expect(surface.getByRole('button', { name: label, exact: true })).toBeVisible()
        }

        const logoWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'logos')
        if (!logoWidget?.id) throw new Error('The application marketing layout did not expose the logos widget')
        await page
            .getByTestId(`layout-widget-${logoWidget.id}`)
            .getByRole('button', { name: /Редактировать|Edit/ })
            .click()
        const applicationWidgetDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
        await expect(applicationWidgetDialog).toBeVisible()
        await expect(applicationWidgetDialog.getByRole('alert')).toHaveCount(0)
        await expectNoTechnicalLeakage(applicationWidgetDialog, {
            label: 'Russian application marketing widget configuration dialog',
            checkUuidSubstrings: true
        })
        const applicationSourceSelect = applicationWidgetDialog.getByRole('combobox', { name: 'Источник контента', exact: true })
        await expect(applicationSourceSelect).toBeEnabled()
        await applicationSourceSelect.click()
        await expect(page.getByRole('option', { name: 'Логотипы клиентов', exact: true })).toBeVisible()
        await page.getByRole('option', { name: 'Логотипы клиентов', exact: true }).click()
        await applicationWidgetDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(applicationWidgetDialog).toHaveCount(0)

        const heroWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'hero')
        if (!heroWidget?.id) throw new Error('The application marketing layout did not expose the hero widget')
        const applicationHeroSurface = page.getByTestId(`layout-widget-${heroWidget.id}`)
        await expect(applicationHeroSurface.getByRole('button', { name: 'Дублировать виджет: Главный экран', exact: true })).toBeVisible()
        const duplicateApplicationHeroResponsePromise = page.waitForResponse(
            (response) =>
                response.url().includes(`/api/v1/applications/${application.id}/layouts/${applicationMarketingLayout.id}/zone-widget`) &&
                response.request().method() === 'PUT',
            { timeout: 90_000 }
        )
        await applicationHeroSurface.getByRole('button', { name: 'Дублировать виджет: Главный экран', exact: true }).click()
        expect((await duplicateApplicationHeroResponsePromise).ok()).toBe(true)
        await expect
            .poll(async () => {
                const current = (await getApplicationLayout(api, application.id!, applicationMarketingLayout.id!)) as {
                    widgets?: LayoutWidget[]
                }
                return current.widgets?.filter((item) => item.widgetKey === 'marketing.hero' && typeof item.id === 'string').length ?? 0
            })
            .toBeGreaterThan(1)
        await expectNoTechnicalLeakage(applicationLayoutDetails, {
            label: 'Russian application marketing layout after duplicating a hero widget',
            checkUuidSubstrings: true
        })
        await expectNoTechnicalLeakage(applicationLayoutDetails, {
            label: 'Russian application marketing layout authoring surface',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Russian application marketing layout authoring')
        await expectRuntimeUxViewportMatrix(page, 'Russian application marketing layout authoring viewport matrix')
        await page.screenshot({
            path: testInfo.outputPath('marketing-page-application-layout-ru.png'),
            fullPage: true,
            animations: 'disabled'
        })

        await applyBrowserPreferences(page, { language: 'en' })

        const runtimePayload = (await getMarketingPageRuntime(api, application.id, 'en')) as RuntimePayload & {
            marketingPage?: RuntimePayload['marketingPage'] & { templateKey?: unknown }
        }
        expect(runtimePayload.templateKey).toBe('marketing-page')
        expect(runtimePayload.marketingPage?.templateKey).toBe('marketing-page')
        const settings = flattenMarketingPageRecords(runtimePayload).find((record) => record.kind === 'siteSettings')
        expect(settings?.heroTitle).toMatchObject({ en: updatedHeroTitle })
        expect(settings?.provenance).toMatchObject({ layer: 'application', isSeeded: false, isAuthored: true })
        const publishedFaqWidget = runtimePayload.marketingPage?.widgets?.find((widget) => widget.instanceKey === 'faq')
        expect(publishedFaqWidget?.isActive).toBe(false)

        // Reload the published app and assert the semantic value rendered by
        // the MUI marketing template, not an implementation detail or ID.
        await page.goto(`/a/${application.id}`)
        await expect(page.locator('#marketing-page-main')).toBeVisible({ timeout: 120_000 })
        const publishedHeroHeadings = page.getByRole('heading', { name: new RegExp(`${escapeRegExp(updatedHeroTitle)}\\s+products`) })
        await expect(publishedHeroHeadings).toHaveCount(2)
        await expect(publishedHeroHeadings.first()).toBeVisible()
        await expect(page.locator('#marketing-widget-faq')).toHaveCount(0)
        await page.reload()
        await expect(publishedHeroHeadings).toHaveCount(2, {
            timeout: 120_000
        })
        await expect(publishedHeroHeadings.first()).toBeVisible({
            timeout: 120_000
        })

        // Exercise the published runtime's localized error boundary and retry
        // control with a real browser reload. The route fails long enough to
        // exhaust React Query's automatic attempts, then recovers on Retry.
        let marketingRuntimeFailures = 0
        await page.route(`**/api/v1/applications/${application.id}/runtime/marketing-page**`, async (route) => {
            marketingRuntimeFailures += 1
            await route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'E2E transient marketing runtime failure' })
            })
        })
        await page.reload()
        await expect(page.getByRole('alert')).toContainText('Failed to load runtime data', { timeout: 120_000 })
        expect(marketingRuntimeFailures).toBeGreaterThan(0)
        await page.unroute(`**/api/v1/applications/${application.id}/runtime/marketing-page**`)
        await page.getByRole('button', { name: 'Retry', exact: true }).click()
        await expect(publishedHeroHeadings).toHaveCount(2, {
            timeout: 120_000
        })
        await expect(publishedHeroHeadings.first()).toBeVisible({
            timeout: 120_000
        })
        await expect(page.locator('#marketing-widget-faq')).toHaveCount(0)
        await page.unroute(`**/api/v1/applications/${application.id}/runtime/marketing-page**`)

        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Published marketing-page authoring flow',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Published marketing-page authoring flow')
        await page.screenshot({ path: testInfo.outputPath('marketing-page-authoring-runtime.png'), fullPage: true, animations: 'disabled' })
    } finally {
        await disposeApiContext(api)
    }
})
