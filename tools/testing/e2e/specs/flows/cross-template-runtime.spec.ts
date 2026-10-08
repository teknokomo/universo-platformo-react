import { createLocalizedContent } from '@universo-react/utils'
import { getLayoutWidgetDefinition } from '@universo-react/types'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import {
    expectDataGridHorizontalScrollConstrained,
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix
} from '../../support/browser/runtimeUx'
import {
    assignLayoutZoneWidget,
    createLayout as createMetahubLayout,
    createApplicationLayout,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createApplicationWorkspace,
    disposeApiContext,
    getLayout,
    getApplication,
    getApplicationEffectiveLayout,
    getApplicationLayout,
    getApplicationRuntime,
    listApplicationLayoutScopes,
    listApplicationLayouts,
    listApplicationLayoutWidgets,
    listApplicationWorkspaces,
    listEntityInstances,
    listLayoutZoneWidgets,
    syncApplicationSchema,
    syncPublication,
    sendWithCsrf,
    updateApplicationLayout,
    updateApplicationLayoutZoneSetting,
    updateRuntimeRow,
    upsertApplicationLayoutWidget,
    setApplicationPublicEntryWorkspace,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'

type EntityItem = {
    id?: string
    codename?: unknown
}

type LayoutRecord = {
    id?: string
    scopeEntityId?: string | null
    templateKey?: string
    version?: number
    sourceLayoutId?: string | null
}

type SourceDashboardPlacement = {
    id: string
    widgetKey: string
    zone: string
    parentInstanceKey: string | null
    slotKey: string | null
}

type BrowserIssue = {
    source: 'console' | 'pageerror' | 'requestfailed' | 'response'
    text: string
    status?: number
    url?: string
}

const watchBrowserIssues = (page: Page): BrowserIssue[] => {
    const issues: BrowserIssue[] = []
    page.on('console', (message) => {
        if (message.type() === 'error') issues.push({ source: 'console', text: message.text() })
    })
    page.on('pageerror', (error) => issues.push({ source: 'pageerror', text: error.message }))
    page.on('requestfailed', (request) => {
        const errorText = request.failure()?.errorText ?? 'Request failed'
        if (errorText === 'net::ERR_ABORTED') return
        issues.push({ source: 'requestfailed', text: errorText, url: request.url() })
    })
    page.on('response', (response) => {
        if (response.url().includes('/api/') && response.status() >= 400) {
            issues.push({
                source: 'response',
                text: `${response.status()} ${response.request().method()}`,
                status: response.status(),
                url: response.url()
            })
        }
    })
    return issues
}

type MarketingNavigationGeometry = {
    appBarPosition: string
    appBarTop: number
    appBarBottom: number
    expectedAppBarTop: number
    visualOffset: number
    navigationTop: number
    navigationHeight: number
    heroTop: number
    scrollY: number
}

const readMarketingNavigationGeometry = async (page: Page, allowMissingHero = false): Promise<MarketingNavigationGeometry> =>
    page.evaluate((permitMissingHero) => {
        const navigation = document.querySelector<HTMLElement>('[data-testid="marketing-header-navigation"]')
        const appBar = document.querySelector<HTMLElement>('[data-testid="marketing-header-shell"]')
        const hero = document.querySelector<HTMLElement>('[data-marketing-widget-instance="hero"]')
        const marketingMain = document.querySelector<HTMLElement>('#marketing-page-main')
        const anchor = hero ?? (permitMissingHero ? marketingMain : null)
        if (!navigation || !appBar || !anchor) throw new Error('Marketing navigation geometry was not rendered')
        const navigationRect = navigation.getBoundingClientRect()
        const appBarRect = appBar.getBoundingClientRect()
        const anchorRect = anchor.getBoundingClientRect()
        const frameHeight = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--template-frame-height'))
        const normalizedFrameHeight = Number.isFinite(frameHeight) ? frameHeight : 0
        const visualOffset = Number.parseFloat(appBar.dataset.marketingHeaderVisualOffset ?? '')
        const normalizedVisualOffset = Number.isFinite(visualOffset) ? visualOffset : 0
        return {
            appBarPosition: window.getComputedStyle(appBar).position,
            appBarTop: appBarRect.top,
            appBarBottom: appBarRect.bottom,
            expectedAppBarTop: normalizedFrameHeight + normalizedVisualOffset,
            visualOffset: normalizedVisualOffset,
            navigationTop: navigationRect.top,
            navigationHeight: navigationRect.height,
            heroTop: anchorRect.top,
            scrollY: window.scrollY
        }
    }, allowMissingHero)

const readDashboardGeometry = async (page: Page) =>
    page.evaluate(() => {
        const mainContent = document.querySelector<HTMLElement>('[data-testid="runtime-main-content"]')
        const main = mainContent?.closest<HTMLElement>('main')
        const dockedMenuContent = document.querySelector<HTMLElement>('[data-testid="runtime-side-menu-docked"]')
        const dockedMenu = dockedMenuContent?.closest<HTMLElement>('.MuiDrawer-root')
        const toolbarContent = document.querySelector<HTMLElement>('[data-testid="runtime-app-toolbar"]')
        const appBar = toolbarContent?.closest<HTMLElement>('.MuiAppBar-root')
        if (!mainContent || !main) throw new Error('Dashboard geometry was not rendered')
        const mainRect = main.getBoundingClientRect()
        const contentRect = mainContent.getBoundingClientRect()
        const menuRect = dockedMenu?.getBoundingClientRect()
        const appBarRect = appBar?.getBoundingClientRect()
        const frameHeight = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--template-frame-height'))
        return {
            mainLeft: mainRect.left,
            contentTop: contentRect.top,
            contentPaddingLeft: Number.parseFloat(window.getComputedStyle(mainContent).paddingLeft),
            dockedMenuWidth: menuRect?.width ?? null,
            dockedMenuDisplay: dockedMenu ? window.getComputedStyle(dockedMenu).display : 'none',
            appBarPosition: appBar ? window.getComputedStyle(appBar).position : null,
            appBarTop: appBarRect?.top ?? null,
            expectedAppBarTop: Number.isFinite(frameHeight) ? frameHeight : 0
        }
    })

type MarketingBackgroundOwnership = {
    pageBackgroundImage: string
    heroBackgroundImage: string
    hasHero: boolean
}

const readMarketingBackgroundOwnership = async (page: Page): Promise<MarketingBackgroundOwnership> =>
    page.evaluate(() => {
        const pageRoot = document.querySelector<HTMLElement>('[data-testid="marketing-page-root"]')
        const heroSlot = document.querySelector<HTMLElement>('[data-marketing-widget-instance="hero"]')
        const hero = heroSlot?.firstElementChild as HTMLElement | null
        if (!pageRoot) throw new Error('Marketing background ownership was not rendered')
        return {
            pageBackgroundImage: window.getComputedStyle(pageRoot).backgroundImage,
            heroBackgroundImage: hero ? window.getComputedStyle(hero).backgroundImage : 'none',
            hasHero: Boolean(hero)
        }
    })

const readCodename = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const record = value as { locales?: Record<string, { content?: unknown }>; _primary?: unknown }
    const primary = typeof record._primary === 'string' ? record._primary : 'en'
    const primaryContent = record.locales?.[primary]?.content
    if (typeof primaryContent === 'string') return primaryContent
    const englishContent = record.locales?.en?.content
    return typeof englishContent === 'string' ? englishContent : ''
}

async function waitForApplicationSchema(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string): Promise<void> {
    await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus).toBe('synced')
}

async function expectApplicationEntityBindingWriteDenied(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    layoutId: string,
    payload: { widgetKey: string; zone: string; sortOrder: number; config: Record<string, unknown> }
): Promise<void> {
    const detail = await getApplicationLayout(api, applicationId, layoutId)
    const version = detail?.item?.version
    if (!Number.isInteger(version) || version < 1) throw new Error(`Layout ${layoutId} did not expose a writable version`)
    await expect(upsertApplicationLayoutWidget(api, applicationId, layoutId, { ...payload, expectedVersion: version })).rejects.toThrow(
        'APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT'
    )
}

test('@flow @combined @cross-template resolves an entity-scoped template and shared widget across runtime hosts', async ({
    page,
    browser,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)
    await page.clock.setFixedTime(new Date('2026-10-08T12:00:00.000Z'))
    const browserIssues = watchBrowserIssues(page)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    const metahubName = `E2E ${runManifest.runId} cross-template metahub`
    const metahubCodename = `${runManifest.runId}-cross-template`
    const publicationName = `E2E ${runManifest.runId} cross-template publication`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName, ru: `Кросс-шаблонный метахаб ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })
        if (typeof metahub?.id !== 'string') throw new Error('Cross-template metahub creation did not return an id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        const sourceDashboardEntities = await listEntityInstances(api, metahub.id, { kind: 'object', limit: 200, offset: 0 })
        const sourceDashboardScope = sourceDashboardEntities.items.find(
            (item: EntityItem) => readCodename(item.codename) === 'MarketingPageSiteSettings'
        )
        expect(sourceDashboardScope?.id).toEqual(expect.any(String))
        // Required table sources are authored in Metahub and published, never copied into Application config.
        const sourceDashboardLayoutIds: string[] = []
        let sourceDashboardPlacements: SourceDashboardPlacement[] = []
        for (const scopeEntityId of [sourceDashboardScope.id]) {
            const sourceDashboard = await createMetahubLayout(api, metahub.id, {
                templateKey: 'dashboard',
                scopeEntityId,
                name: { en: `Published dashboard ${runManifest.runId}` },
                namePrimaryLocale: 'en',
                isActive: true,
                isDefault: false
            })
            expect(sourceDashboard.id).toEqual(expect.any(String))
            expect(sourceDashboard.version).toEqual(expect.any(Number))
            sourceDashboardLayoutIds.push(sourceDashboard.id)
            const currentSourceDashboard = await getLayout(api, metahub.id, sourceDashboard.id)
            if (!Number.isInteger(currentSourceDashboard?.version) || currentSourceDashboard.version < 1) {
                throw new Error('Scoped Dashboard layout did not return a current optimistic-lock version')
            }
            await assignLayoutZoneWidget(api, metahub.id, sourceDashboard.id, {
                widgetKey: 'detailsTable',
                zone: 'center',
                sortOrder: 2,
                expectedVersion: currentSourceDashboard.version,
                config: {
                    variant: 'records',
                    __layout: {
                        bindings: {
                            version: 1,
                            slots: [
                                {
                                    slot: 'rows',
                                    targets: [
                                        {
                                            entityKind: 'object',
                                            entityCodename: 'MarketingPageFeature',
                                            selector: { kind: 'record-set' },
                                            projection: []
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            })
            for (const hostWidget of [
                { widgetKey: 'appNavbar', zone: 'top', sortOrder: 1, config: {} },
                { widgetKey: 'menuWidget', zone: 'left', sortOrder: 1, config: { variant: 'generated' } },
                { widgetKey: 'languageSwitcher', zone: 'top', sortOrder: 2, config: {} },
                { widgetKey: 'datePicker', zone: 'top', sortOrder: 3, config: { selection: 'range', showPresets: true } },
                { widgetKey: 'footer', zone: 'bottom', sortOrder: 1, config: { alignment: 'left', spacing: 'compact' } }
            ]) {
                const latestSourceDashboard = await getLayout(api, metahub.id, sourceDashboard.id)
                if (!Number.isInteger(latestSourceDashboard?.version) || latestSourceDashboard.version < 1) {
                    throw new Error('Scoped Dashboard layout did not return a current version before source widget authoring')
                }
                await assignLayoutZoneWidget(api, metahub.id, sourceDashboard.id, {
                    ...hostWidget,
                    expectedVersion: latestSourceDashboard.version
                })
            }

            const sourcePlacementsResponse = await listLayoutZoneWidgets(api, metahub.id, sourceDashboard.id)
            sourceDashboardPlacements = (sourcePlacementsResponse.items ?? []).map((placement: Record<string, unknown>) => {
                if (typeof placement.id !== 'string' || typeof placement.widgetKey !== 'string' || typeof placement.zone !== 'string') {
                    throw new Error('The published Dashboard source did not persist complete widget placement metadata')
                }
                return {
                    id: placement.id,
                    widgetKey: placement.widgetKey,
                    zone: placement.zone,
                    parentInstanceKey: typeof placement.parentInstanceKey === 'string' ? placement.parentInstanceKey : null,
                    slotKey: typeof placement.slotKey === 'string' ? placement.slotKey : null
                }
            })
            expect(sourceDashboardPlacements.map(({ widgetKey }) => widgetKey).sort()).toEqual(
                ['appNavbar', 'datePicker', 'detailsTable', 'footer', 'languageSwitcher', 'menuWidget'].sort()
            )
            expect(new Set(sourceDashboardPlacements.map(({ id }) => id)).size).toBe(sourceDashboardPlacements.length)
        }

        const concurrencyLayout = await createMetahubLayout(api, metahub.id, {
            templateKey: 'dashboard',
            scopeEntityId: sourceDashboardScope.id,
            name: { en: `Dashboard placement concurrency ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            isActive: false,
            isDefault: false
        })
        const initialConcurrencyLayout = await getLayout(api, metahub.id, concurrencyLayout.id)
        if (!Number.isInteger(initialConcurrencyLayout?.version) || initialConcurrencyLayout.version < 1) {
            throw new Error('Concurrency-test Dashboard layout did not expose its current version')
        }
        await assignLayoutZoneWidget(api, metahub.id, concurrencyLayout.id, {
            widgetKey: 'detailsTable',
            zone: 'center',
            sortOrder: 1,
            expectedVersion: initialConcurrencyLayout.version,
            config: {
                variant: 'records',
                __layout: {
                    bindings: {
                        version: 1,
                        slots: [
                            {
                                slot: 'rows',
                                targets: [
                                    {
                                        entityKind: 'object',
                                        entityCodename: 'MarketingPageFeature',
                                        selector: { kind: 'record-set' },
                                        projection: []
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        })
        const [concurrencyLayoutBeforeRace, concurrencyWidgetsBeforeRace] = await Promise.all([
            getLayout(api, metahub.id, concurrencyLayout.id),
            listLayoutZoneWidgets(api, metahub.id, concurrencyLayout.id)
        ])
        const concurrencySourceWidget = (concurrencyWidgetsBeforeRace.items ?? []).find(
            (item: Record<string, unknown>) => item.widgetKey === 'detailsTable'
        )
        if (
            !Number.isInteger(concurrencyLayoutBeforeRace?.version) ||
            !Number.isInteger(concurrencySourceWidget?.version) ||
            typeof concurrencySourceWidget?.id !== 'string'
        ) {
            throw new Error('Concurrency-test widget did not expose its current placement and layout versions')
        }
        const duplicatePlacementPath = `/api/v1/metahub/${metahub.id}/layout/${concurrencyLayout.id}/zone-widget/placement-duplicate`
        const duplicatePlacementPayload = {
            widgetId: concurrencySourceWidget.id,
            expectedVersion: concurrencySourceWidget.version,
            expectedLayoutVersion: concurrencyLayoutBeforeRace.version
        }
        const duplicatePlacementResponses = await Promise.all([
            sendWithCsrf(api, 'POST', duplicatePlacementPath, duplicatePlacementPayload),
            sendWithCsrf(api, 'POST', duplicatePlacementPath, duplicatePlacementPayload)
        ])
        expect(duplicatePlacementResponses.map(({ status }) => status).sort((left, right) => left - right)).toEqual([201, 409])
        const concurrencyWidgetsAfterRace = await listLayoutZoneWidgets(api, metahub.id, concurrencyLayout.id)
        expect(concurrencyWidgetsAfterRace.items).toHaveLength((concurrencyWidgetsBeforeRace.items ?? []).length + 1)

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false,
            runtimePolicy: {
                workspaceMode: 'required',
                requiredWorkspaceModeAcknowledged: true
            }
        })
        if (typeof publication?.id !== 'string') throw new Error('Cross-template publication creation did not return an id')
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: {
                en: `E2E ${runManifest.runId} cross-template application`,
                ru: `E2E ${runManifest.runId} кросс-шаблонное приложение`
            },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: true
        })
        const applicationId = linkedApplication?.application?.id
        if (!applicationId) throw new Error('Cross-template publication did not create an application')
        await recordCreatedApplication({
            id: applicationId
        })

        await syncApplicationSchema(api, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await waitForApplicationSchema(api, applicationId)

        const workspaceList = await listApplicationWorkspaces(api, applicationId)
        const sharedWorkspace = (workspaceList?.items ?? []).find(
            (workspace: Record<string, unknown>) => workspace?.workspaceType !== 'personal' && !workspace?.personalUserId
        )
        const publicEntryWorkspaceId =
            (sharedWorkspace as { id?: string } | undefined)?.id ??
            (
                await createApplicationWorkspace(api, applicationId, {
                    name: createLocalizedContent('en', 'Cross-template public entry workspace'),
                    description: createLocalizedContent('en', 'Workspace used for anonymous cross-template rendering')
                })
            )?.id
        if (typeof publicEntryWorkspaceId !== 'string') {
            throw new Error('Cross-template runtime spec could not prepare a public entry workspace')
        }
        await setApplicationPublicEntryWorkspace(api, applicationId, publicEntryWorkspaceId)

        const entityResponse = await listEntityInstances(api, metahub.id, { kind: 'object', limit: 200, offset: 0 })
        const sourceEntity = (entityResponse?.items ?? []).find(
            (item: EntityItem) => readCodename(item.codename) === 'MarketingPageSiteSettings'
        ) as EntityItem | undefined
        if (typeof sourceEntity?.id !== 'string')
            throw new Error('The marketing source entity was not available for scoped layout coverage')
        const sourceEntityCodename = readCodename(sourceEntity.codename)
        if (!sourceEntityCodename) throw new Error('The marketing source Entity must expose its semantic codename')

        const scopesResponse = await listApplicationLayoutScopes(api, applicationId, 'en')
        const entityScope = (scopesResponse?.items ?? []).find(
            (scope: { scopeEntityId?: string | null; name?: string }) =>
                typeof scope.scopeEntityId === 'string' && scope.name === 'Marketing site settings'
        )
        if (typeof entityScope?.scopeEntityId !== 'string') {
            throw new Error('The application did not expose the marketing entity as a layout-capable scope')
        }
        if (entityScope.scopeEntityId !== sourceEntity.id) {
            throw new Error('The marketing layout scope must resolve to the MarketingPageSiteSettings Object')
        }

        const navigationEntity = (entityResponse?.items ?? []).find(
            (item: EntityItem) => readCodename(item.codename) === 'MarketingPageNavigation'
        ) as EntityItem | undefined
        if (typeof navigationEntity?.id !== 'string') throw new Error('The marketing navigation entity was not available')
        const navigationRuntime = await getApplicationRuntime(api, applicationId, {
            objectCollectionId: navigationEntity.id,
            limit: 100,
            offset: 0,
            locale: 'en'
        })
        const navigationKeyField = (navigationRuntime?.columns ?? []).find(
            (column: { codename?: unknown }) => column.codename === 'NavKey'
        )?.field
        const navigationHrefField = (navigationRuntime?.columns ?? []).find(
            (column: { codename?: unknown }) => column.codename === 'Href'
        )?.field
        if (typeof navigationKeyField !== 'string' || typeof navigationHrefField !== 'string') {
            throw new Error('The marketing navigation runtime fields were not available')
        }
        const navigationRow = (navigationRuntime?.rows ?? []).find((row: Record<string, unknown>) => row[navigationKeyField] === 'blog') as
            | (Record<string, unknown> & { id?: string })
            | undefined
        if (typeof navigationRow?.id !== 'string') throw new Error('The seeded marketing navigation row was not available')
        const scopedDashboardHref = `/a/${applicationId}?targetKind=object&entityTypeCodename=${encodeURIComponent(sourceEntityCodename)}`
        await updateRuntimeRow(api, applicationId, navigationRow.id, {
            objectCollectionId: navigationEntity.id,
            data: { [navigationHrefField]: scopedDashboardHref }
        })
        const layoutResponse = await listApplicationLayouts(api, applicationId, { limit: 100, offset: 0 })
        const globalLayout = (layoutResponse?.items ?? []).find(
            (layout: LayoutRecord) => layout.scopeEntityId === null && layout.templateKey === 'marketing-page'
        ) as LayoutRecord | undefined
        if (typeof globalLayout?.id !== 'string' || typeof globalLayout.version !== 'number') {
            throw new Error('The application did not expose its materialized marketing global layout')
        }

        const sourceWidgetResponse = await listApplicationLayoutWidgets(api, applicationId, globalLayout.id)

        const globalEffective = await getApplicationEffectiveLayout(api, applicationId, { locale: 'en', themeVariant: 'light' })
        expect(globalEffective.status).toBe('ok')
        expect(globalEffective.layout.templateKey).toBe('marketing-page')
        expect(globalEffective.widgets).toEqual(
            expect.arrayContaining([expect.objectContaining({ widgetKey: 'marketing.navigation', zone: 'marketing-header' })])
        )

        const scopedMarketingResponse = await createApplicationLayout(api, applicationId, {
            templateKey: 'marketing-page',
            scopeEntityId: entityScope.scopeEntityId,
            name: {
                en: `Marketing settings ${runManifest.runId}`,
                ru: `Настройки маркетинговой страницы ${runManifest.runId}`
            },
            isActive: true,
            isDefault: true,
            sortOrder: 5,
            config: {}
        })
        const scopedMarketingLayout = scopedMarketingResponse?.item as LayoutRecord | undefined
        expect(scopedMarketingLayout?.templateKey).toBe('marketing-page')
        expect(scopedMarketingLayout?.scopeEntityId).toBe(entityScope.scopeEntityId)
        if (typeof scopedMarketingLayout?.id !== 'string' || typeof scopedMarketingLayout.version !== 'number') {
            throw new Error('The scoped marketing layout did not return a writable version')
        }

        for (const widget of sourceWidgetResponse?.items ?? []) {
            if (typeof widget.widgetKey !== 'string' || typeof widget.zone !== 'string') continue
            const payload = {
                widgetKey: widget.widgetKey,
                zone: widget.zone,
                sortOrder: typeof widget.sortOrder === 'number' ? widget.sortOrder : 0,
                config: widget.config && typeof widget.config === 'object' && !Array.isArray(widget.config) ? widget.config : {}
            }
            if (!getLayoutWidgetDefinition(payload.widgetKey, payload.config)?.bindingSlots?.length) continue
            await expectApplicationEntityBindingWriteDenied(api, applicationId, scopedMarketingLayout.id, payload)
        }

        const scopedMarketingEffective = await getApplicationEffectiveLayout(api, applicationId, {
            targetKind: 'object',
            entityTypeId: entityScope.scopeEntityId,
            locale: 'en',
            themeVariant: 'light'
        })
        expect(scopedMarketingEffective.status).toBe('ok')
        expect(scopedMarketingEffective.layout.templateKey).toBe('marketing-page')
        expect(scopedMarketingEffective.scope).toBe('entity')
        const effectiveNavigationWidgets = scopedMarketingEffective.widgets.filter(
            (widget: { widgetKey?: unknown }) => widget.widgetKey === 'marketing.navigation'
        )
        expect(effectiveNavigationWidgets).toHaveLength(0)

        const baseURL = testInfo.project.use.baseURL
        if (typeof baseURL !== 'string') throw new Error('The cross-template test project must define the E2E base URL')
        const anonymousContext = await browser.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
            locale: 'en-US',
            colorScheme: 'light',
            viewport: { width: 1440, height: 900 }
        })
        try {
            await anonymousContext.clearCookies()
            expect((await anonymousContext.cookies()).length).toBe(0)
            const anonymousPage = await anonymousContext.newPage()
            const anonymousBrowserIssues = watchBrowserIssues(anonymousPage)
            const publicRuntimeResponse = anonymousPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    url.pathname === `/api/v1/public/applications/${applicationId}/runtime` &&
                    url.searchParams.get('targetKind') === 'object' &&
                    url.searchParams.get('entityTypeCodename') === sourceEntityCodename
                )
            })
            await anonymousPage.goto(`${scopedDashboardHref}&locale=en&themeVariant=light`)
            const publicResponse = await publicRuntimeResponse
            expect(publicResponse.status()).toBe(200)
            await expect(anonymousPage.locator('#marketing-page-main')).toBeVisible()
            await expect(anonymousPage.locator('[data-marketing-widget-instance]')).toHaveCount(0)
            const authBootstrapPaths = new Set(['/api/v1/auth/me', '/api/v1/auth/permissions'])
            const unexpectedAnonymousBrowserIssues = anonymousBrowserIssues.filter((issue) => {
                if (issue.source === 'response' && issue.status === 401 && issue.url) {
                    return !authBootstrapPaths.has(new URL(issue.url).pathname)
                }
                if (issue.source === 'console' && /Failed to load resource:.*\b401\b/u.test(issue.text)) {
                    // Chromium logs expected anonymous auth probes without the response URL.
                    return false
                }
                return true
            })
            expect(unexpectedAnonymousBrowserIssues, JSON.stringify(unexpectedAnonymousBrowserIssues, null, 2)).toEqual([])
            await expectNoPageHorizontalOverflow(anonymousPage, 'Anonymous cross-template scoped marketing runtime')
            await anonymousPage.screenshot({
                path: testInfo.outputPath('cross-template-anonymous-scoped-marketing.png'),
                fullPage: true,
                animations: 'disabled'
            })
        } finally {
            await anonymousContext.close()
        }

        await page.goto(`${scopedDashboardHref}&locale=en&themeVariant=light`)
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expect(page.locator('[data-marketing-widget-instance]')).toHaveCount(0)
        await expect(page.locator('[data-marketing-widget-instance="hero"]')).toHaveCount(0)
        await expect(page.getByTestId('marketing-header-shell')).toHaveCount(0)
        await expect(page.getByTestId('runtime-main-content')).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'Independent scoped marketing layout without inherited Entity bindings')
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Independent scoped marketing layout without inherited Entity bindings',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/marketing\.(?:navigation|footer|hero)/i]
        })

        const publishedDashboardLayouts = await listApplicationLayouts(api, applicationId, { limit: 100, offset: 0 })
        const publishedDashboard = publishedDashboardLayouts.items.find(
            (layout: LayoutRecord & { sourceLayoutId?: string }) => layout.sourceLayoutId === sourceDashboardLayoutIds[0]
        )
        expect(publishedDashboard?.scopeEntityId).toBe(entityScope.scopeEntityId)
        expect(publishedDashboard?.templateKey).toBe('dashboard')
        expect(publishedDashboard?.id).toEqual(expect.any(String))
        const scopedLayoutResponse = await updateApplicationLayout(api, applicationId, publishedDashboard.id, {
            name: {
                en: `Dashboard settings ${runManifest.runId}`,
                ru: `Настройки дашборда ${runManifest.runId}`
            },
            isActive: true,
            isDefault: true,
            expectedVersion: publishedDashboard.version
        })
        const scopedLayout = scopedLayoutResponse?.item as LayoutRecord | undefined
        expect(scopedLayout?.templateKey).toBe('dashboard')
        expect(scopedLayout?.scopeEntityId).toBe(entityScope.scopeEntityId)
        if (typeof scopedLayout?.id !== 'string' || typeof scopedLayout.version !== 'number') {
            throw new Error('The scoped Dashboard layout did not return a writable version')
        }
        const inheritedDashboardWidgets = await listApplicationLayoutWidgets(api, applicationId, scopedLayout.id)
        expect(inheritedDashboardWidgets.items.map((widget: { widgetKey?: string }) => widget.widgetKey)).toEqual(
            expect.arrayContaining(['appNavbar', 'menuWidget', 'languageSwitcher', 'datePicker', 'detailsTable', 'footer'])
        )
        expect(scopedLayout.sourceLayoutId).toBe(sourceDashboardLayoutIds[0])
        const inheritedSourceWidgets = inheritedDashboardWidgets.items.filter((widget: Record<string, unknown>) =>
            sourceDashboardPlacements.some(({ id }) => widget.sourceWidgetId === id)
        )
        expect(inheritedSourceWidgets).toHaveLength(sourceDashboardPlacements.length)
        for (const sourcePlacement of sourceDashboardPlacements) {
            const matches = inheritedDashboardWidgets.items.filter(
                (widget: Record<string, unknown>) => widget.sourceWidgetId === sourcePlacement.id
            )
            expect(matches, `Metahub widget ${sourcePlacement.widgetKey} should materialize exactly once`).toHaveLength(1)
            expect(matches[0]).toMatchObject({
                sourceWidgetId: sourcePlacement.id,
                widgetKey: sourcePlacement.widgetKey,
                zone: sourcePlacement.zone,
                parentWidgetId: null,
                slotKey: sourcePlacement.slotKey
            })
        }
        await expectApplicationEntityBindingWriteDenied(api, applicationId, scopedLayout.id, {
            widgetKey: 'detailsTitle',
            zone: 'center',
            sortOrder: 1,
            config: {}
        })
        await expectApplicationEntityBindingWriteDenied(api, applicationId, scopedLayout.id, {
            widgetKey: 'detailsTable',
            zone: 'center',
            sortOrder: 2,
            config: {}
        })
        const publishedTableWidgets = await listApplicationLayoutWidgets(api, applicationId, scopedLayout.id)
        expect(publishedTableWidgets.items.filter((widget: { widgetKey?: string }) => widget.widgetKey === 'detailsTable')).toHaveLength(1)

        const scopedEffective = await getApplicationEffectiveLayout(api, applicationId, {
            targetKind: 'object',
            entityTypeId: entityScope.scopeEntityId,
            locale: 'en',
            themeVariant: 'light'
        })
        expect(scopedEffective.status).toBe('ok')
        expect(scopedEffective.scope).toBe('entity')
        expect(scopedEffective.resolvedEntityTypeId).toBe(entityScope.scopeEntityId)
        expect(scopedEffective.layout.templateKey).toBe('dashboard')
        expect(scopedEffective.widgets).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ widgetKey: 'marketing.navigation' })])
        )

        // Verify the real browser contract for the non-default position before
        // restoring the fixed default used by the remaining runtime matrix.
        const globalLayoutBeforeFlow = await getApplicationLayout(api, applicationId, globalLayout.id)
        const flowGlobalLayout = await updateApplicationLayoutZoneSetting(
            api,
            applicationId,
            globalLayout.id,
            'marketing-header',
            'position',
            'flow',
            globalLayoutBeforeFlow.item.version
        )
        expect(flowGlobalLayout.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'flow' })

        const assertFlowRuntime = async (viewport: { width: number; height: number }, screenshotName: string) => {
            await page.setViewportSize(viewport)
            await page.goto(`/a/${applicationId}?locale=en&themeVariant=light`)
            await expect(page.locator('#marketing-page-main')).toBeVisible()
            await expect(page.getByTestId('marketing-header-shell')).toHaveClass(/MuiAppBar-positionStatic/)
            await expect(page.getByTestId('marketing-header-spacer')).toHaveCount(0)
            const initial = await readMarketingNavigationGeometry(page)
            expect(initial.appBarPosition).toBe('static')
            expect(initial.heroTop).toBeGreaterThanOrEqual(initial.appBarBottom - 1)
            const flowDocumentState = await page.evaluate(() => ({
                scrollPaddingBlockStart: window.getComputedStyle(document.documentElement).scrollPaddingBlockStart,
                marketingHeaderOcclusion: document.documentElement.style.getPropertyValue('--marketing-header-occlusion')
            }))
            expect(['auto', '0px']).toContain(flowDocumentState.scrollPaddingBlockStart)
            expect(flowDocumentState.marketingHeaderOcclusion).toBe('')

            await page.evaluate(() => window.scrollTo({ top: 640, behavior: 'instant' }))
            await page.waitForFunction(() => window.scrollY > 0)
            const scrolled = await readMarketingNavigationGeometry(page)
            expect(scrolled.appBarPosition).toBe('static')
            expect(scrolled.appBarTop).toBeLessThan(initial.appBarTop - 100)
            expect(scrolled.heroTop).toBeLessThan(initial.heroTop - 100)
            await page.screenshot({ path: testInfo.outputPath(screenshotName), fullPage: true, animations: 'disabled' })
        }

        await assertFlowRuntime({ width: 1440, height: 1000 }, 'cross-template-global-marketing-flow-desktop.png')
        await assertFlowRuntime({ width: 768, height: 1024 }, 'cross-template-global-marketing-flow-tablet.png')
        await assertFlowRuntime({ width: 390, height: 844 }, 'cross-template-global-marketing-flow-mobile.png')

        const globalLayoutBeforeFixedRestore = await getApplicationLayout(api, applicationId, globalLayout.id)
        await updateApplicationLayoutZoneSetting(
            api,
            applicationId,
            globalLayout.id,
            'marketing-header',
            'position',
            'fixed',
            globalLayoutBeforeFixedRestore.item.version
        )

        await page.setViewportSize({ width: 1440, height: 1000 })
        await page.goto(`/a/${applicationId}?locale=en&themeVariant=light`)
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expect(page.locator('body')).not.toContainText(entityScope.scopeEntityId)
        await expect(page.getByTestId('marketing-header-spacer')).toHaveCount(0)
        const marketingNavigation = page.getByTestId('marketing-header-navigation').first()
        const initialMarketingGeometry = await readMarketingNavigationGeometry(page)
        expect(initialMarketingGeometry.appBarPosition).toBe('fixed')
        expect(initialMarketingGeometry.visualOffset).toBe(28)
        expect(Math.abs(initialMarketingGeometry.appBarTop - initialMarketingGeometry.expectedAppBarTop)).toBeLessThanOrEqual(1)
        expect(initialMarketingGeometry.navigationHeight).toBeGreaterThan(0)
        expect(Math.abs(initialMarketingGeometry.heroTop)).toBeLessThanOrEqual(1)
        await expect(page.locator('a[href="#marketing-page-main"]')).toHaveCount(0)
        const singleBackgroundOwnership = await readMarketingBackgroundOwnership(page)
        expect(singleBackgroundOwnership.pageBackgroundImage).toBe('none')
        expect(singleBackgroundOwnership.heroBackgroundImage).toContain('radial-gradient')
        await page.evaluate(() => window.scrollTo({ top: 640, behavior: 'instant' }))
        await page.waitForFunction(() => window.scrollY > 0)
        await expect(marketingNavigation).toBeVisible()
        const scrolledMarketingGeometry = await readMarketingNavigationGeometry(page)
        expect(scrolledMarketingGeometry.appBarPosition).toBe('fixed')
        expect(scrolledMarketingGeometry.scrollY).toBeGreaterThan(0)
        expect(Math.abs(scrolledMarketingGeometry.appBarTop - scrolledMarketingGeometry.expectedAppBarTop)).toBeLessThanOrEqual(1)
        expect(Math.abs(scrolledMarketingGeometry.appBarTop - initialMarketingGeometry.appBarTop)).toBeLessThanOrEqual(1)
        expect(Math.abs(scrolledMarketingGeometry.navigationTop - initialMarketingGeometry.navigationTop)).toBeLessThanOrEqual(1)
        expect(scrolledMarketingGeometry.heroTop).toBeLessThan(initialMarketingGeometry.heroTop)
        await page.screenshot({
            path: testInfo.outputPath('cross-template-global-marketing-scrolled.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await page.waitForFunction(() => window.scrollY === 0)
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Cross-template marketing runtime',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/marketing\.(?:navigation|footer|hero)/i]
        })
        await expectNoPageHorizontalOverflow(page, 'Cross-template marketing runtime')
        await expectRuntimeUxViewportMatrix(page, 'Cross-template marketing runtime', {
            beforeEachViewport: async () => {
                await expect(page.locator('#marketing-page-main')).toBeVisible()
                const viewportGeometry = await readMarketingNavigationGeometry(page)
                expect(viewportGeometry.appBarPosition).toBe('fixed')
                expect(Math.abs(viewportGeometry.appBarTop - viewportGeometry.expectedAppBarTop)).toBeLessThanOrEqual(1)
                expect(Math.abs(viewportGeometry.heroTop)).toBeLessThanOrEqual(1)
            }
        })
        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(accessibility.violations, JSON.stringify(accessibility.violations)).toEqual([])
        await page.screenshot({ path: testInfo.outputPath('cross-template-global-marketing.png'), fullPage: true, animations: 'disabled' })

        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/a/${applicationId}?locale=ru&themeVariant=light`)
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Наши новые продукты', exact: true })).toBeVisible()
        await expect(page.locator('[data-screenshot="toggle-mode"]:visible')).toHaveCount(1)
        await expectNoPageHorizontalOverflow(page, 'Cross-template marketing mobile runtime')
        await page.screenshot({
            path: testInfo.outputPath('cross-template-global-marketing-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })

        await page.goto(`/a/${applicationId}?locale=en&themeVariant=light`)
        await expect(page.getByRole('heading', { name: 'Our latest products', exact: true })).toBeVisible()
        await page.screenshot({
            path: testInfo.outputPath('cross-template-global-marketing-en-after-language-switch.png'),
            fullPage: true,
            animations: 'disabled'
        })

        await page.setViewportSize({ width: 768, height: 1024 })
        await page.goto(`/a/${applicationId}?locale=en&themeVariant=light`)
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Cross-template marketing tablet runtime')
        await page.screenshot({
            path: testInfo.outputPath('cross-template-global-marketing-tablet.png'),
            fullPage: true,
            animations: 'disabled'
        })

        await page.setViewportSize({ width: 1440, height: 1000 })
        const scopedNavigationLink = page.getByRole('link', { name: 'Blog', exact: true })
        await expect(scopedNavigationLink).toBeVisible()
        await expect(scopedNavigationLink).toHaveAttribute('href', scopedDashboardHref)
        await scopedNavigationLink.click()
        await expect(page.getByTestId('runtime-main-content')).toBeVisible()
        await expect(page.locator('#marketing-page-main')).toHaveCount(0)
        await expect(page.locator('body')).not.toContainText(entityScope.scopeEntityId)
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Cross-template dashboard runtime',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/marketing\.(?:navigation|footer|hero)/i]
        })
        const { todayLabel, rangeStartLabel } = await page.evaluate(() => {
            const formatter = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' })
            const today = new Date()
            const sixDaysAgo = new Date(today)
            sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
            return { todayLabel: formatter.format(today), rangeStartLabel: formatter.format(sixDaysAgo) }
        })
        await expect(page.getByRole('button', { name: todayLabel, exact: true })).toHaveCount(2)
        await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Last 7 days', exact: true }).click()
        await expect(page.getByRole('button', { name: rangeStartLabel, exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: todayLabel, exact: true })).toBeVisible()
        await expect(page.locator('body')).not.toContainText('2023')
        const dashboardFooter = page.getByTestId('runtime-footer-widget')
        await expect(dashboardFooter).toContainText(`E2E ${runManifest.runId} cross-template application`)
        await expect(dashboardFooter).not.toContainText('Sitemark')
        await expectNoPageHorizontalOverflow(page, 'Cross-template dashboard runtime')
        await expectLocalizedValidation(page.locator('body'), 'en', { label: 'Cross-template dashboard runtime' })
        if ((await page.locator('.MuiDataGrid-root:visible').count()) > 0) {
            await expectNoDataGridTechnicalLeakage(page.locator('body'), {
                label: 'Cross-template dashboard runtime',
                requireVisibleGrid: true,
                checkUuidSubstrings: true
            })
            await expectDataGridHorizontalScrollConstrained(page, 'Cross-template dashboard runtime')
        }
        await page.screenshot({ path: testInfo.outputPath('cross-template-scoped-dashboard.png'), fullPage: true, animations: 'disabled' })

        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080, expectedMainLeft: 240, expectedContentTop: 64, expectedPadding: 24 },
            { name: 'tablet', width: 768, height: 1024, expectedMainLeft: 0, expectedContentTop: 64, expectedPadding: 24 },
            { name: 'mobile', width: 390, height: 844, expectedMainLeft: 0, expectedContentTop: 64, expectedPadding: 16 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await page.goto(`${scopedDashboardHref}&locale=en&themeVariant=light`)
            await expect(page.getByTestId('runtime-main-content')).toBeVisible()
            if (viewport.name !== 'desktop' && (await page.locator('.MuiDataGrid-root:visible').count()) > 0) {
                await expectDataGridHorizontalScrollConstrained(page, `Dashboard reference ${viewport.name} runtime`)
            }
            await expectNoPageHorizontalOverflow(page, `Dashboard reference geometry ${viewport.name}`)
            const geometry = await readDashboardGeometry(page)
            expect(Math.abs(geometry.mainLeft - viewport.expectedMainLeft)).toBeLessThanOrEqual(1)
            expect(Math.abs(geometry.contentTop - viewport.expectedContentTop)).toBeLessThanOrEqual(1)
            expect(geometry.contentPaddingLeft).toBe(viewport.expectedPadding)
            expect(geometry.appBarPosition).toBe('fixed')
            expect(geometry.appBarTop).toBe(geometry.expectedAppBarTop)
            if (viewport.width >= 900) {
                expect(geometry.dockedMenuDisplay).not.toBe('none')
                expect(Math.abs((geometry.dockedMenuWidth ?? 0) - 240)).toBeLessThanOrEqual(1)
            } else {
                expect(geometry.dockedMenuDisplay).toBe('none')
            }
            await page.screenshot({
                path: testInfo.outputPath(`dashboard-reference-${viewport.name}.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }

        await page.setViewportSize({ width: 1440, height: 1000 })
        await page.goto(`${scopedDashboardHref}&locale=en&themeVariant=light`)

        const applicationNavigation = page.getByRole('navigation', { name: 'Application navigation', exact: true })
        await expect(applicationNavigation.getByRole('link', { name: String(entityScope.name), exact: true })).toHaveCount(0)
        await expect(applicationNavigation.getByRole('link', { name: sourceEntityCodename, exact: true })).toHaveCount(0)
        const scopedRuntimeTarget = new URL(page.url())
        expect(scopedRuntimeTarget.searchParams.get('targetKind')).toBe('object')
        expect(scopedRuntimeTarget.searchParams.get('entityTypeCodename')).toBe(sourceEntityCodename)
        expect(scopedRuntimeTarget.searchParams.has('entityTypeId')).toBe(false)
        expect(page.url()).not.toContain(entityScope.scopeEntityId)
        await expect(page.getByTestId('runtime-main-content')).toBeVisible()

        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`${scopedDashboardHref}&locale=ru&themeVariant=light`)
        await expect(page.getByTestId('runtime-main-content')).toBeVisible()
        await expect(page.getByRole('grid')).toBeVisible()
        await expectDataGridHorizontalScrollConstrained(page, 'Cross-template dashboard mobile runtime')
        await expect(page.getByRole('columnheader', { name: 'Заголовок', exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Создать', exact: true })).toHaveCount(0)
        const ruDashboardFooter = page.getByTestId('runtime-footer-widget')
        await expect(ruDashboardFooter).toContainText(`E2E ${runManifest.runId} кросс-шаблонное приложение`)
        await expect(ruDashboardFooter).not.toContainText('Sitemark')
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Cross-template dashboard mobile runtime',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/marketing\.(?:navigation|footer|hero)/i]
        })
        await expectLocalizedValidation(page.locator('body'), 'ru', { label: 'Cross-template dashboard mobile runtime' })
        await expectNoPageHorizontalOverflow(page, 'Cross-template dashboard mobile runtime')
        const dashboardLanguageButton = page.getByRole('button', { name: /language|язык/i }).first()
        await dashboardLanguageButton.focus()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('menu')).toBeVisible()
        await page.keyboard.press('Escape')
        expect(browserIssues, JSON.stringify(browserIssues, null, 2)).toEqual([])
        await page.screenshot({
            path: testInfo.outputPath('cross-template-scoped-dashboard-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })
    } finally {
        await disposeApiContext(api)
    }
})
