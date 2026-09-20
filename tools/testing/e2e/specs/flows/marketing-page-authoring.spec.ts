import type { Locator, Page, Response, TestInfo } from '@playwright/test'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createLayout,
    disposeApiContext,
    getApplication,
    getApplicationLayout,
    getLayout,
    getMarketingPageRuntime,
    getPublication,
    listLayoutZoneWidgets,
    listEntityInstances,
    listLayouts,
    listApplicationLayouts,
    listConnectors,
    listPublicationApplications,
    resetLayoutZoneSetting,
    updateLayoutZoneSetting
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectLocatorFitsViewport,
    expectLocatorHasNoInlineOverflow,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoUnexpectedBrowserRuntimeIssues,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls,
    expectStrictRuntimeUxSurface,
    watchBrowserRuntimeIssues
} from '../../support/browser/runtimeUx'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'
import { parseJsonResponse, readLocalizedText } from './entity-runtime-helpers'
import { flattenMarketingPageRecords, type RuntimePayload } from '../../support/marketingPageRuntimeMaterialization'
import { installMarketingPageLocalMedia } from '../../support/marketingPageMedia'

type ApiSession = Awaited<ReturnType<typeof createLoggedInApiContext>>

type EntityResponse = {
    id?: string
    data?: {
        id?: string
    }
}

type PublicationApplication = {
    id?: string
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

const expectLayoutWidgetLabelsReadable = async (page: Page, label: string): Promise<void> => {
    const labels = page.locator('.layout-widget-label:visible')
    await expect(labels, `${label} must expose widget labels`).not.toHaveCount(0)

    const metrics = await labels.evaluateAll((elements) =>
        elements.map((element) => {
            const node = element as HTMLElement
            const rect = node.getBoundingClientRect()
            const styles = window.getComputedStyle(node)
            return {
                text: node.innerText,
                width: rect.width,
                height: rect.height,
                scrollWidth: node.scrollWidth,
                writingMode: styles.writingMode
            }
        })
    )
    const unreadable = metrics.filter(
        ({ text, width, height, scrollWidth, writingMode }) =>
            !text.trim() || width < 32 || height > 72 || scrollWidth > width + 1 || writingMode !== 'horizontal-tb'
    )
    expect(unreadable, `${label} contains clipped, vertical, or unusably narrow widget labels`).toEqual([])
}

const expectStandardZoneSettingsFooter = async (dialog: Locator, label: string): Promise<void> => {
    const actions = dialog.getByTestId('layout-zone-settings-actions')
    await expect(actions, `${label} must use the shared dialog actions surface`).toHaveClass(/MuiDialogActions-root/)
    const spacing = await actions.evaluate((element) => {
        const styles = window.getComputedStyle(element)
        return {
            right: Number.parseFloat(styles.paddingRight) || 0,
            bottom: Number.parseFloat(styles.paddingBottom) || 0
        }
    })
    expect(spacing.right, `${label} must preserve the standard right footer inset`).toBeGreaterThanOrEqual(23)
    expect(spacing.bottom, `${label} must preserve the standard bottom footer inset`).toBeGreaterThanOrEqual(23)
}

const expectRussianMarketingHeaderLabels = async (zone: Locator): Promise<void> => {
    for (const label of ['Бренд', 'Навигация', 'Аутентификация', 'Переключатель языка', 'Переключатель темы']) {
        await expect(zone.getByText(label, { exact: true }), `Russian header must expose ${label}`).toBeVisible()
    }
    await expect(zone).not.toContainText(/Brand|Authentication|Language switcher|Color mode switcher/)
}

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
    const browserIssues = watchBrowserRuntimeIssues(page)

    const executionRunId = buildExecutionRunId(runManifest.runId, testInfo)
    const metahubName = `E2E ${executionRunId} marketing authoring`
    const metahubCodename = `${executionRunId}-marketing-authoring`
    const publicationName = `E2E ${executionRunId} Marketing Publication`
    const updatedHeroTitle = `Our latest ${executionRunId}`
    const brandLogoUrl = 'https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg'

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

        // Exercise the metahub source chain directly: a global position flows
        // into a scoped layout, a local override wins, and reset exposes later
        // source changes again. Renderer-owned config must remain byte-for-byte
        // stable throughout the neutral metadata mutations.
        const metahubGlobalLayout = await getLayout(api, metahub.id, marketingLayoutId)
        const metahubRendererConfig = { ...(metahubGlobalLayout.config ?? {}) }
        const flowGlobalLayout = await updateLayoutZoneSetting(
            api,
            metahub.id,
            marketingLayoutId,
            'marketing-header',
            'position',
            'flow',
            metahubGlobalLayout.version
        )
        expect(flowGlobalLayout.config).toEqual(metahubRendererConfig)
        expect(flowGlobalLayout.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'flow' })

        const entityResponse = await listEntityInstances(api, metahub.id, { kind: 'object', limit: 200, offset: 0 })
        const siteSettingsEntity = (entityResponse?.items ?? []).find(
            (entity: { id?: string; codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageSiteSettings'
        )
        if (typeof siteSettingsEntity?.id !== 'string') {
            throw new Error('The marketing authoring fixture did not expose the site-settings entity for scoped inheritance')
        }

        const scopedMetahubLayout = await createLayout(api, metahub.id, {
            scopeEntityId: siteSettingsEntity.id,
            baseLayoutId: marketingLayoutId,
            templateKey: 'marketing-page',
            name: { en: `Scoped marketing ${executionRunId}`, ru: `Область маркетинга ${executionRunId}` },
            namePrimaryLocale: 'en',
            isActive: true,
            isDefault: true,
            config: {}
        })
        if (!scopedMetahubLayout?.id || typeof scopedMetahubLayout.version !== 'number') {
            throw new Error('The scoped metahub layout did not return a versioned layout')
        }
        const scopedMetahubBeforeOverride = await getLayout(api, metahub.id, scopedMetahubLayout.id)
        expect(scopedMetahubBeforeOverride.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()

        const scopedMetahubFixedLayout = await updateLayoutZoneSetting(
            api,
            metahub.id,
            scopedMetahubLayout.id,
            'marketing-header',
            'position',
            'fixed',
            scopedMetahubBeforeOverride.version
        )
        expect(scopedMetahubFixedLayout.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'fixed' })

        const scopedMetahubResetLayout = await resetLayoutZoneSetting(
            api,
            metahub.id,
            scopedMetahubLayout.id,
            'marketing-header',
            'position',
            scopedMetahubFixedLayout.version
        )
        expect(scopedMetahubResetLayout.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()
        expect((await getLayout(api, metahub.id, marketingLayoutId)).neutral?.zoneSettings?.['marketing-header']).toEqual({
            position: 'flow'
        })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources/layouts/${scopedMetahubLayout.id}`)
        const russianScopedLayoutDetails = page.getByTestId('metahub-layout-details-content')
        await expect(russianScopedLayoutDetails).toBeVisible()
        const russianMetahubHeaderZone = page.getByTestId('layout-zone-marketing-header')
        await expect(russianMetahubHeaderZone).toContainText('Шапка маркетинговой страницы')
        await expectRussianMarketingHeaderLabels(russianMetahubHeaderZone)
        await expect(russianScopedLayoutDetails.getByText('Начало', { exact: true })).toBeVisible()
        await expect(russianScopedLayoutDetails.getByText('Конец', { exact: true })).toBeVisible()
        const russianZoneSettingsButton = page.getByTestId('layout-zone-settings-marketing-header')
        await russianZoneSettingsButton.focus()
        await page.keyboard.press('Enter')
        const russianZoneSettingsDialog = page.getByRole('dialog', { name: 'Настройки: Шапка маркетинговой страницы' })
        await expect(russianZoneSettingsDialog).toBeVisible()
        await expect(russianZoneSettingsDialog.getByText('Поведение шапки', { exact: true })).toBeVisible()
        await expect(russianZoneSettingsDialog.getByRole('radio', { name: 'Закреплена на экране', exact: true })).toBeVisible()
        await expectStrictRuntimeUxSurface(russianZoneSettingsDialog, {
            label: 'Russian metahub Zone Settings dialog',
            locale: 'ru'
        })
        await expectStandardZoneSettingsFooter(russianZoneSettingsDialog, 'Russian metahub Zone Settings dialog')
        await russianZoneSettingsDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(russianZoneSettingsDialog).toHaveCount(0)

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/resources/layouts/${scopedMetahubLayout.id}`)
        const scopedLayoutDetails = page.getByTestId('metahub-layout-details-content')
        await expect(scopedLayoutDetails).toBeVisible()
        const scopedZoneSettingsButton = page.getByTestId('layout-zone-settings-marketing-header')
        await expect(scopedZoneSettingsButton).toBeVisible()
        await scopedZoneSettingsButton.focus()
        await page.keyboard.press('Enter')
        const scopedZoneSettingsDialog = page.getByRole('dialog')
        await expect(scopedZoneSettingsDialog.getByText('Inherited from the current layout source', { exact: true })).toBeVisible()
        await expectRuntimeUxViewportMatrix(page, 'Shared metahub Zone Settings dialog', {
            beforeEachViewport: async (viewport) => {
                await expect(scopedZoneSettingsDialog).toBeVisible()
                await expectLocatorFitsViewport(scopedZoneSettingsDialog, `Metahub Zone Settings dialog at ${viewport.name}`)
                await expectLocatorHasNoInlineOverflow(scopedZoneSettingsDialog, `Metahub Zone Settings dialog at ${viewport.name}`)
                await expectStrictRuntimeUxSurface(scopedZoneSettingsDialog, {
                    label: `Metahub Zone Settings dialog at ${viewport.name}`,
                    locale: 'en'
                })
            }
        })
        const scopedFixedRadio = scopedZoneSettingsDialog.getByRole('radio', { name: 'Fixed on screen', exact: true })
        await scopedFixedRadio.focus()
        await page.keyboard.press('Space')
        await expect(scopedFixedRadio).toBeChecked()
        const scopedZoneSaveResponse = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/zone-settings\/marketing-header\/position$/),
            { label: 'Saving the scoped marketing header position', timeout: 90_000 }
        )
        const scopedZoneSaveButton = scopedZoneSettingsDialog.getByRole('button', { name: 'Save', exact: true })
        await scopedZoneSaveButton.focus()
        await page.keyboard.press('Enter')
        expect((await scopedZoneSaveResponse).ok()).toBe(true)
        await expect(scopedZoneSettingsDialog).toHaveCount(0)
        await page.reload()
        await page.getByTestId('layout-zone-settings-marketing-header').focus()
        await page.keyboard.press('Enter')
        const scopedCustomizedDialog = page.getByRole('dialog')
        await expect(scopedCustomizedDialog.getByText('Customized for this layout', { exact: true })).toBeVisible()
        await expect(scopedCustomizedDialog.getByRole('radio', { name: 'Fixed on screen', exact: true })).toBeChecked()
        const scopedZoneResetResponse = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', /\/zone-settings\/marketing-header\/position\/reset$/),
            { label: 'Resetting the scoped marketing header position', timeout: 90_000 }
        )
        const scopedZoneResetButton = scopedCustomizedDialog.getByRole('button', { name: 'Reset override', exact: true })
        await scopedZoneResetButton.focus()
        await page.keyboard.press('Enter')
        expect((await scopedZoneResetResponse).ok()).toBe(true)
        await expect(scopedCustomizedDialog).toHaveCount(0)

        const scopedAfterBrowserReset = await getLayout(api, metahub.id, scopedMetahubLayout.id)
        expect(scopedAfterBrowserReset.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()
        const globalAfterScopedReset = await getLayout(api, metahub.id, marketingLayoutId)
        const restoredGlobalLayout = await resetLayoutZoneSetting(
            api,
            metahub.id,
            marketingLayoutId,
            'marketing-header',
            'position',
            globalAfterScopedReset.version
        )
        expect(restoredGlobalLayout.config).toEqual(metahubRendererConfig)
        expect(restoredGlobalLayout.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()

        await page.goto(`/metahub/${metahub.id}/resources/layouts/${marketingLayoutId}`)
        const marketingLayoutDetails = page.getByTestId('metahub-layout-details-content')
        await expect(marketingLayoutDetails).toBeVisible()
        await expect(marketingLayoutDetails.getByRole('alert')).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'Marketing metahub layout details')
        await expectNoTechnicalLeakage(marketingLayoutDetails, {
            label: 'Marketing metahub layout details',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/widgetKey/i, /source[_ -]?base/i, /allowedZonesByTemplate/i]
        })
        await page.screenshot({ path: testInfo.outputPath('marketing-metahub-layout-details.png'), fullPage: true })
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
        await recordCreatedApplication({ id: application.id })
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
        const russianApplicationHeaderZone = page.getByTestId('layout-zone-marketing-header')
        await expectRussianMarketingHeaderLabels(russianApplicationHeaderZone)
        await expect(applicationLayoutDetails.getByText('Начало', { exact: true })).toBeVisible()
        await expect(applicationLayoutDetails.getByText('Конец', { exact: true })).toBeVisible()
        const applicationZoneSettingsButton = page.getByTestId('layout-zone-settings-marketing-header')
        await applicationZoneSettingsButton.focus()
        await page.keyboard.press('Enter')
        const applicationZoneSettingsDialog = page.getByRole('dialog', { name: 'Настройки: Шапка маркетинговой страницы' })
        await expect(applicationZoneSettingsDialog).toBeVisible()
        await expect(applicationZoneSettingsDialog.getByText('Поведение шапки', { exact: true })).toBeVisible()
        await expectStrictRuntimeUxSurface(applicationZoneSettingsDialog, {
            label: 'Russian application Zone Settings dialog',
            locale: 'ru'
        })
        await expectStandardZoneSettingsFooter(applicationZoneSettingsDialog, 'Russian application Zone Settings dialog')
        await applicationZoneSettingsDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(applicationZoneSettingsDialog).toHaveCount(0)
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
            .getByRole('button', { name: 'Редактировать виджет: Коллекция: Логотипы', exact: true })
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

        const brandWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'brand')
        if (!brandWidget?.id) throw new Error('The application marketing layout did not expose the brand widget')
        await page
            .getByTestId(`layout-widget-${brandWidget.id}`)
            .getByRole('button', { name: 'Редактировать виджет: Бренд', exact: true })
            .click()
        const brandWidgetDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
        await expect(brandWidgetDialog).toBeVisible()
        await expect(brandWidgetDialog.getByRole('alert')).toHaveCount(0)
        await brandWidgetDialog.getByLabel('URL логотипа бренда', { exact: true }).fill(brandLogoUrl)
        const brandLogoResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                responseIsMutation(
                    response,
                    'PATCH',
                    new RegExp(
                        `/api/v1/applications/${application.id}/layouts/${applicationMarketingLayout.id}/zone-widget/${brandWidget.id}/config$`
                    )
                ),
            { label: 'Saving the marketing brand logo through the widget dialog', timeout: 90_000 }
        )
        await brandWidgetDialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
        expect((await brandLogoResponse).ok()).toBe(true)
        await expect(brandWidgetDialog).toHaveCount(0)

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
        const duplicatedApplicationLayout = (await getApplicationLayout(api, application.id, applicationMarketingLayout.id)) as {
            widgets?: LayoutWidget[]
        }
        const duplicatedHeroWidget = duplicatedApplicationLayout.widgets?.find(
            (item) => item.widgetKey === 'marketing.hero' && item.id !== heroWidget.id && typeof item.id === 'string'
        )
        if (typeof duplicatedHeroWidget?.id !== 'string') {
            throw new Error('The application marketing layout did not expose the duplicated hero widget')
        }
        const duplicatedHeroSurface = page.getByTestId(`layout-widget-${duplicatedHeroWidget.id}`)
        await expect(duplicatedHeroSurface).toBeVisible()
        await expectNoTechnicalLeakage(applicationLayoutDetails, {
            label: 'Russian application marketing layout after duplicating a hero widget',
            checkUuidSubstrings: true
        })
        await expectNoTechnicalLeakage(applicationLayoutDetails, {
            label: 'Russian application marketing layout authoring surface',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Russian application marketing layout authoring')
        await expectRuntimeUxViewportMatrix(page, 'Russian application marketing layout authoring viewport matrix', {
            beforeEachViewport: async (viewport) => {
                if (viewport.name === 'mobile-390') {
                    await expectLayoutWidgetLabelsReadable(page, 'Russian application marketing layout authoring at mobile-390')
                }
            }
        })
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
        // Inactive widgets are filtered from the published runtime envelope;
        // authoring keeps the inactive row, while runtime never exposes it.
        expect(publishedFaqWidget).toBeUndefined()

        // Reload the published app and assert the semantic value rendered by
        // the MUI marketing template, not an implementation detail or ID.
        await installMarketingPageLocalMedia(page)
        await page.goto(`/a/${application.id}`)
        await expect(page.locator('#marketing-page-main')).toBeVisible({ timeout: 120_000 })
        const publishedHeroHeadings = page.getByRole('heading', { name: new RegExp(`${escapeRegExp(updatedHeroTitle)}\\s+products`) })
        await expect(publishedHeroHeadings).toHaveCount(2)
        await expect(publishedHeroHeadings.first()).toBeVisible()
        await expect(page.locator('#marketing-widget-faq')).toHaveCount(0)

        const expectPublishedBrandLogo = async (logo: Locator, label: string): Promise<void> => {
            await expect(logo, `${label} must render the configured brand logo image`).toHaveCount(1)
            await expect
                .poll(async () => logo.evaluate((element) => (element as HTMLImageElement).naturalWidth), {
                    message: `Waiting for ${label} to decode the configured brand logo`,
                    timeout: 30_000
                })
                .toBeGreaterThan(0)
            await expect(logo, `${label} must be visible`).toBeVisible()
        }
        await expectPublishedBrandLogo(
            page.locator(`[data-testid="marketing-header-shell"] img[src="${brandLogoUrl}"]`),
            'Published marketing header'
        )
        await expectPublishedBrandLogo(page.locator(`#footer img[src="${brandLogoUrl}"]`), 'Published marketing footer')

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

        await testInfo.attach('marketing-runtime-retry-observability.json', {
            body: Buffer.from(
                JSON.stringify(
                    {
                        interceptedFailures: marketingRuntimeFailures,
                        localizedErrorObserved: true,
                        retryRecoveredRuntime: true,
                        retryIndex: testInfo.retry
                    },
                    null,
                    2
                )
            ),
            contentType: 'application/json'
        })

        await expectStrictRuntimeUxSurface(page.locator('body'), {
            label: 'Published marketing-page authoring flow',
            locale: 'en'
        })
        await expectNoPageHorizontalOverflow(page, 'Published marketing-page authoring flow')
        await page.screenshot({ path: testInfo.outputPath('marketing-page-authoring-runtime.png'), fullPage: true, animations: 'disabled' })

        // Complete the browser copy/delete lifecycle after the published runtime
        // has proved that the duplicated widget received independent identity.
        await page.goto(`/a/${application.id}/admin/layouts/${applicationMarketingLayout.id}`)
        const removalSurface = page.getByTestId(`layout-widget-${duplicatedHeroWidget.id}`)
        await expect(removalSurface).toBeVisible()
        await removalSurface.getByRole('button', { name: /Удалить виджет|Remove widget/ }).click()
        const removeWidgetDialog = page.getByRole('dialog').filter({ hasText: /Удалить виджет|Remove widget/ })
        await expect(removeWidgetDialog).toBeVisible()
        const removeWidgetResponse = page.waitForResponse(
            (response) =>
                response.url().includes(`/api/v1/applications/${application.id}/layouts/${applicationMarketingLayout.id}/zone-widget/`) &&
                response.request().method() === 'DELETE',
            { timeout: 90_000 }
        )
        await removeWidgetDialog.getByRole('button', { name: /Удалить|Delete/, exact: true }).click()
        expect((await removeWidgetResponse).ok()).toBe(true)
        await expect
            .poll(async () => {
                const current = (await getApplicationLayout(api, application.id!, applicationMarketingLayout.id!)) as {
                    widgets?: LayoutWidget[]
                }
                return current.widgets?.filter((item) => item.widgetKey === 'marketing.hero' && typeof item.id === 'string').length ?? 0
            })
            .toBe(1)
        await expect(removalSurface).toHaveCount(0)
        expectNoUnexpectedBrowserRuntimeIssues(browserIssues, 'Marketing-page authoring browser flow', {
            allowTextPatterns: [/503|E2E transient marketing runtime failure/i]
        })
    } finally {
        await disposeApiContext(api)
    }
})
