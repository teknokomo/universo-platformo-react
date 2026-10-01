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
    createApplicationLayout,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createApplicationWorkspace,
    disposeApiContext,
    getApplication,
    getApplicationEffectiveLayout,
    getApplicationLayout,
    getApplicationRuntime,
    listApplicationLayoutScopes,
    listApplicationLayouts,
    listApplicationLayoutWidgets,
    listApplicationWorkspaces,
    listEntityInstances,
    syncApplicationSchema,
    syncPublication,
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

async function upsertApplicationLayoutWidgetWithRetry(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    layoutId: string,
    payload: {
        widgetKey: string
        zone: string
        sortOrder: number
        config: Record<string, unknown>
    }
): Promise<void> {
    await expect
        .poll(
            async () => {
                const detail = await getApplicationLayout(api, applicationId, layoutId)
                const currentVersion = detail?.item?.version
                if (!Number.isInteger(currentVersion) || currentVersion < 1) {
                    throw new Error(`Layout ${layoutId} did not expose a writable version before adding ${payload.widgetKey}`)
                }

                try {
                    await upsertApplicationLayoutWidget(api, applicationId, layoutId, {
                        ...payload,
                        expectedVersion: currentVersion
                    })
                    return true
                } catch (error) {
                    if (error instanceof Error && error.message.includes('APPLICATION_LAYOUT_VERSION_CONFLICT')) return false
                    throw error
                }
            },
            { timeout: 30_000 }
        )
        .toBe(true)
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
            name: { en: `E2E ${runManifest.runId} cross-template application` },
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

        const scopesResponse = await listApplicationLayoutScopes(api, applicationId, 'en')
        const entityScope = (scopesResponse?.items ?? []).find(
            (scope: { scopeEntityId?: string | null; name?: string }) =>
                typeof scope.scopeEntityId === 'string' && scope.name === 'Marketing site settings'
        )
        if (typeof entityScope?.scopeEntityId !== 'string') {
            throw new Error('The application did not expose the marketing entity as a layout-capable scope')
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
        const scopedDashboardHref = `/a/${applicationId}/${encodeURIComponent(
            entityScope.scopeEntityId
        )}?targetKind=object&entityTypeId=${encodeURIComponent(entityScope.scopeEntityId)}`
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
                    url.searchParams.get('entityTypeId') === entityScope.scopeEntityId
                )
            })
            await anonymousPage.goto(
                `/a/${applicationId}/${encodeURIComponent(entityScope.scopeEntityId)}?targetKind=object&entityTypeId=${encodeURIComponent(
                    entityScope.scopeEntityId
                )}&locale=en&themeVariant=light`
            )
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

        await page.goto(
            `/a/${applicationId}/${encodeURIComponent(entityScope.scopeEntityId)}?targetKind=object&entityTypeId=${encodeURIComponent(
                entityScope.scopeEntityId
            )}&locale=en&themeVariant=light`
        )
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

        const scopedLayoutResponse = await createApplicationLayout(api, applicationId, {
            templateKey: 'dashboard',
            scopeEntityId: entityScope.scopeEntityId,
            name: {
                en: `Dashboard settings ${runManifest.runId}`,
                ru: `Настройки дашборда ${runManifest.runId}`
            },
            isActive: true,
            isDefault: true,
            sortOrder: 10,
            config: {}
        })
        const scopedLayout = scopedLayoutResponse?.item as LayoutRecord | undefined
        expect(scopedLayout?.templateKey).toBe('dashboard')
        expect(scopedLayout?.scopeEntityId).toBe(entityScope.scopeEntityId)
        if (typeof scopedLayout?.id !== 'string' || typeof scopedLayout.version !== 'number') {
            throw new Error('The scoped Dashboard layout did not return a writable version')
        }
        await upsertApplicationLayoutWidgetWithRetry(api, applicationId, scopedLayout.id, {
            widgetKey: 'menuWidget',
            zone: 'left',
            sortOrder: 0,
            config: {
                autoShowAllSections: true,
                showTitle: false,
                items: []
            }
        })
        const addScopedWidget = async (payload: {
            widgetKey: string
            zone: string
            sortOrder: number
            config: Record<string, unknown>
        }) => {
            await upsertApplicationLayoutWidgetWithRetry(api, applicationId, scopedLayout.id as string, payload)
        }
        await addScopedWidget({ widgetKey: 'appNavbar', zone: 'top', sortOrder: 0, config: {} })
        await addScopedWidget({ widgetKey: 'languageSwitcher', zone: 'top', sortOrder: 1, config: {} })
        await addScopedWidget({ widgetKey: 'detailsTitle', zone: 'center', sortOrder: 1, config: {} })
        await addScopedWidget({ widgetKey: 'detailsTable', zone: 'center', sortOrder: 2, config: {} })

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

        const visibleEntityLink = page
            .locator(`nav[aria-label="Application navigation"] a[href*="entityTypeId=${entityScope.scopeEntityId}"]`)
            .first()
        await expect(visibleEntityLink).toBeVisible()
        await expect(visibleEntityLink).toContainText(String(entityScope.name))
        await expect(visibleEntityLink).toHaveAttribute('href', new RegExp(`targetKind=object.*entityTypeId=${entityScope.scopeEntityId}`))
        await visibleEntityLink.click()
        await expect(page.getByTestId('runtime-main-content')).toBeVisible()

        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(
            `/a/${applicationId}/${encodeURIComponent(entityScope.scopeEntityId)}?targetKind=object&entityTypeId=${encodeURIComponent(
                entityScope.scopeEntityId
            )}&locale=ru&themeVariant=light`
        )
        await expect(page.getByTestId('runtime-main-content')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Создать', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Настройки маркетинговой страницы', exact: true })).toBeVisible()
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
