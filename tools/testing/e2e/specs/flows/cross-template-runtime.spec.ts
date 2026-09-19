import { createLocalizedContent } from '@universo-react/utils'
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
    disposeApiContext,
    getApplication,
    getApplicationEffectiveLayout,
    getApplicationLayout,
    getApplicationRuntime,
    listApplicationLayoutScopes,
    listApplicationLayouts,
    listApplicationLayoutWidgets,
    listEntityInstances,
    listPublicationApplications,
    syncApplicationSchema,
    syncPublication,
    updateApplicationLayoutZoneSetting,
    updateRuntimeRow,
    upsertApplicationLayoutWidget,
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

const readMarketingNavigationGeometry = async (page: Page): Promise<MarketingNavigationGeometry> =>
    page.evaluate(() => {
        const navigation = document.querySelector<HTMLElement>('[data-testid="marketing-header-navigation"]')
        const appBar = document.querySelector<HTMLElement>('[data-testid="marketing-header-shell"]')
        const hero = document.querySelector<HTMLElement>('[data-marketing-widget-instance="hero"]')
        if (!navigation || !appBar || !hero) throw new Error('Marketing navigation geometry was not rendered')
        const navigationRect = navigation.getBoundingClientRect()
        const appBarRect = appBar.getBoundingClientRect()
        const heroRect = hero.getBoundingClientRect()
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
            heroTop: heroRect.top,
            scrollY: window.scrollY
        }
    })

type MarketingBackgroundOwnership = {
    pageBackgroundImage: string
    heroBackgroundImage: string
}

const readMarketingBackgroundOwnership = async (page: Page): Promise<MarketingBackgroundOwnership> =>
    page.evaluate(() => {
        const pageRoot = document.querySelector<HTMLElement>('[data-testid="marketing-page-root"]')
        const heroSlot = document.querySelector<HTMLElement>('[data-marketing-widget-instance="hero"]')
        const hero = heroSlot?.firstElementChild as HTMLElement | null
        if (!pageRoot || !hero) throw new Error('Marketing background ownership was not rendered')
        return {
            pageBackgroundImage: window.getComputedStyle(pageRoot).backgroundImage,
            heroBackgroundImage: window.getComputedStyle(hero).backgroundImage
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

async function waitForLinkedApplication(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    publicationId: string
) {
    let application: Record<string, unknown> | null = null
    await expect
        .poll(async () => {
            const response = await listPublicationApplications(api, metahubId, publicationId)
            application = (response?.items ?? [])[0] ?? null
            return typeof application?.id === 'string'
        })
        .toBe(true)

    if (typeof application?.id !== 'string') throw new Error('The publication did not expose a linked application')
    return application
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

test('@flow @combined @cross-template resolves an entity-scoped template and shared widget across runtime hosts', async ({
    page,
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
            autoCreateApplication: true,
            applicationName: { en: `E2E ${runManifest.runId} cross-template application` },
            applicationNamePrimaryLocale: 'en',
            runtimePolicy: {
                workspaceMode: 'required',
                requiredWorkspaceModeAcknowledged: true
            }
        })
        if (typeof publication?.id !== 'string') throw new Error('Cross-template publication creation did not return an id')
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await waitForLinkedApplication(api, metahub.id, publication.id)
        const applicationId = typeof linkedApplication.id === 'string' ? linkedApplication.id : null
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
            await upsertApplicationLayoutWidgetWithRetry(api, applicationId, scopedMarketingLayout.id, {
                widgetKey: widget.widgetKey,
                zone: widget.zone,
                sortOrder: typeof widget.sortOrder === 'number' ? widget.sortOrder : 0,
                config: widget.config && typeof widget.config === 'object' && !Array.isArray(widget.config) ? widget.config : {}
            })
        }

        const navigationSourceWidget = (sourceWidgetResponse?.items ?? []).find(
            (widget: { widgetKey?: unknown }) => widget.widgetKey === 'marketing.navigation'
        ) as { widgetKey?: string; zone?: string; sortOrder?: number; config?: unknown } | undefined
        if (typeof navigationSourceWidget?.zone !== 'string') {
            throw new Error('The marketing navigation widget was not available for repeated-instance coverage')
        }
        const repeatedNavigationConfig =
            navigationSourceWidget.config &&
            typeof navigationSourceWidget.config === 'object' &&
            !Array.isArray(navigationSourceWidget.config)
                ? { ...(navigationSourceWidget.config as Record<string, unknown>) }
                : {}
        delete repeatedNavigationConfig.instanceKey
        for (let duplicateIndex = 0; duplicateIndex < 2; duplicateIndex += 1) {
            await upsertApplicationLayoutWidgetWithRetry(api, applicationId, scopedMarketingLayout.id, {
                widgetKey: 'marketing.navigation',
                zone: navigationSourceWidget.zone,
                sortOrder: (navigationSourceWidget.sortOrder ?? 0) + duplicateIndex + 1,
                config: repeatedNavigationConfig
            })
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
        expect(effectiveNavigationWidgets).toHaveLength(3)
        expect(
            new Set(effectiveNavigationWidgets.map((widget: { id?: unknown; instanceKey?: unknown }) => widget.instanceKey ?? widget.id))
                .size
        ).toBe(3)

        await page.goto(
            `/a/${applicationId}/${encodeURIComponent(entityScope.scopeEntityId)}?targetKind=object&entityTypeId=${encodeURIComponent(
                entityScope.scopeEntityId
            )}&locale=en&themeVariant=light`
        )
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Our latest products', exact: true })).toBeVisible()
        await expect(page.getByTestId('marketing-header-shell')).toHaveCount(1)
        await expect(page.getByRole('banner')).toHaveCount(1)
        await expect(page.getByTestId('marketing-header-drawer')).toHaveCount(1)
        const navigationLandmarks = page.getByTestId('marketing-header-navigation')
        await expect(navigationLandmarks).toHaveCount(3)
        for (let index = 0; index < 3; index += 1) {
            await expect(navigationLandmarks.nth(index)).toBeVisible()
        }
        await expect(page.getByRole('navigation')).toHaveCount(3)
        const navigationLabels = await page
            .getByRole('navigation')
            .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute('aria-label')).filter((label): label is string => Boolean(label?.trim()))
            )
        expect(navigationLabels).toHaveLength(3)
        expect(new Set(navigationLabels).size).toBe(3)
        const navigationGeometry = await readMarketingNavigationGeometry(page)
        expect(navigationGeometry.appBarPosition).toBe('fixed')
        expect(navigationGeometry.visualOffset).toBe(28)
        expect(navigationGeometry.navigationHeight).toBeGreaterThan(0)
        expect(
            Math.abs(navigationGeometry.heroTop),
            'Repeated navigation must overlay the reference Hero from document y=0'
        ).toBeLessThanOrEqual(1)
        const repeatedBackgroundOwnership = await readMarketingBackgroundOwnership(page)
        expect(repeatedBackgroundOwnership.pageBackgroundImage).toBe('none')
        expect(repeatedBackgroundOwnership.heroBackgroundImage).toContain('radial-gradient')
        await page.evaluate(() => window.scrollTo({ top: 320, behavior: 'instant' }))
        await page.waitForFunction(() => window.scrollY > 0)
        const scrolledNavigationGeometry = await readMarketingNavigationGeometry(page)
        expect(scrolledNavigationGeometry.appBarPosition).toBe('fixed')
        expect(Math.abs(scrolledNavigationGeometry.appBarTop - navigationGeometry.appBarTop)).toBeLessThanOrEqual(1)
        await page.screenshot({
            path: testInfo.outputPath('cross-template-scoped-marketing-repeated-navigation-scrolled.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await page.waitForFunction(() => window.scrollY === 0)
        await expect(page.getByTestId('runtime-main-content')).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'Cross-template scoped marketing runtime')
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Cross-template scoped marketing runtime',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/marketing\.(?:navigation|footer|hero)/i]
        })
        await page.screenshot({
            path: testInfo.outputPath('cross-template-scoped-marketing-repeated-navigation.png'),
            fullPage: true,
            animations: 'disabled'
        })

        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(
            `/a/${applicationId}/${encodeURIComponent(entityScope.scopeEntityId)}?targetKind=object&entityTypeId=${encodeURIComponent(
                entityScope.scopeEntityId
            )}&locale=en&themeVariant=light`
        )
        await expect(navigationLandmarks).toHaveCount(3)
        await expect(page.getByTestId('marketing-header-shell')).toHaveCount(1)
        await expect(page.getByRole('banner')).toHaveCount(1)
        const mobileInitialGeometry = await readMarketingNavigationGeometry(page)
        expect(mobileInitialGeometry.appBarPosition).toBe('fixed')
        expect(mobileInitialGeometry.visualOffset).toBe(28)
        expect(Math.abs(mobileInitialGeometry.appBarTop - mobileInitialGeometry.expectedAppBarTop)).toBeLessThanOrEqual(1)
        await page.evaluate(() => window.scrollTo({ top: 320, behavior: 'instant' }))
        await page.waitForFunction(() => window.scrollY > 0)
        const mobileScrolledGeometry = await readMarketingNavigationGeometry(page)
        expect(mobileScrolledGeometry.scrollY).toBeGreaterThan(0)
        expect(Math.abs(mobileScrolledGeometry.appBarTop - mobileInitialGeometry.appBarTop)).toBeLessThanOrEqual(1)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await page.waitForFunction(() => window.scrollY === 0)
        const firstMobileMenuButton = page.getByTestId('marketing-header-mobile-menu').locator('button')
        await firstMobileMenuButton.click()
        await expect(firstMobileMenuButton).toHaveAttribute('aria-expanded', 'true')
        await expect(page.getByTestId('marketing-header-drawer')).toBeVisible()
        const drawerNavigationLandmarks = page.getByTestId('marketing-header-drawer-navigation')
        await expect(drawerNavigationLandmarks).toHaveCount(3)
        for (let index = 0; index < 3; index += 1) {
            await expect(drawerNavigationLandmarks.nth(index)).toBeVisible()
        }
        const mobileAccessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(mobileAccessibility.violations, JSON.stringify(mobileAccessibility.violations)).toEqual([])
        await page.keyboard.press('Escape')
        await expect(firstMobileMenuButton).toHaveAttribute('aria-expanded', 'false')
        await expect(firstMobileMenuButton).toBeFocused()
        await expectNoPageHorizontalOverflow(page, 'Cross-template scoped marketing mobile runtime')

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
