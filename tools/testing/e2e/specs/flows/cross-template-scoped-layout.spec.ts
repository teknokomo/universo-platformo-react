import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, Response } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import {
    expectDataGridHorizontalScrollConstrained,
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls,
    expectTableHorizontalScrollConstrained,
    waitForLayoutFrame
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
    listApplicationLayoutScopes,
    listApplicationLayouts,
    listApplicationLayoutWidgets,
    listEntityInstances,
    listPublicationApplications,
    syncApplicationSchema,
    syncPublication,
    upsertApplicationLayoutWidget,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { readLocalizedText, type ApiContext } from './entity-runtime-helpers'

type LayoutRecord = {
    id: string
    version: number
    templateKey: 'dashboard' | 'marketing-page'
    scopeEntityId?: string | null
    name?: unknown
    description?: unknown
    isDefault?: boolean
}

type LayoutWidget = {
    id?: string
    widgetKey?: string
    zone?: string
    sortOrder?: number
    config?: unknown
}

type LayoutScope = {
    id?: string
    name?: string
    scopeKind?: string
    kind?: string | null
    scopeEntityId?: string | null
}

type RuntimeFixture = {
    api: ApiContext
    applicationId: string
    metahubId: string
    globalLayout: LayoutRecord
    sourceWidgets: LayoutWidget[]
    objectScope: Required<Pick<LayoutScope, 'id' | 'name' | 'scopeEntityId'>> & LayoutScope
    pageScope: Required<Pick<LayoutScope, 'id' | 'name' | 'scopeEntityId'>> & LayoutScope
}

type RuntimeTarget = {
    kind: 'page' | 'object'
    entityTypeId: string
}

type ExpectedRuntime = {
    templateKey: 'dashboard' | 'marketing-page'
    locale?: 'en' | 'ru'
    themeVariant?: 'light' | 'dark'
    target?: RuntimeTarget
}

const readLayoutItem = (payload: unknown): LayoutRecord => {
    const item = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as { item?: unknown }).item : undefined
    const value = item && typeof item === 'object' && !Array.isArray(item) ? item : payload
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Application layout response did not contain an item')
    const record = value as Partial<LayoutRecord>
    if (typeof record.id !== 'string' || typeof record.version !== 'number') {
        throw new Error('Application layout response did not contain a versioned layout')
    }
    return record as LayoutRecord
}

const waitForLinkedApplication = async (api: ApiContext, metahubId: string, publicationId: string) => {
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

const waitForApplicationSchema = async (api: ApiContext, applicationId: string): Promise<void> => {
    await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus).toBe('synced')
}

const createRuntimeFixture = async (runManifest: {
    runId: string
    testUser: { email: string; password: string }
}): Promise<RuntimeFixture> => {
    const api = await createLoggedInApiContext(runManifest.testUser)
    const metahubName = `E2E ${runManifest.runId} scoped-layout metahub`
    const metahubCodename = `${runManifest.runId}-scoped-layout`

    const metahub = await createMetahub(api, {
        name: { en: metahubName, ru: `Метахаб scoped-layout ${runManifest.runId}` },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', metahubCodename),
        templateCodename: 'marketing-page'
    })
    if (typeof metahub?.id !== 'string') throw new Error('Scoped-layout metahub creation did not return an id')
    await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

    const publication = await createPublication(api, metahub.id, {
        name: { en: `E2E ${runManifest.runId} scoped-layout publication` },
        namePrimaryLocale: 'en',
        autoCreateApplication: true,
        applicationName: { en: `E2E ${runManifest.runId} scoped-layout application` },
        applicationNamePrimaryLocale: 'en',
        runtimePolicy: {
            workspaceMode: 'required',
            requiredWorkspaceModeAcknowledged: true
        }
    })
    if (typeof publication?.id !== 'string') throw new Error('Scoped-layout publication creation did not return an id')
    await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
    await syncPublication(api, metahub.id, publication.id)
    await waitForPublicationReady(api, metahub.id, publication.id)

    const linkedApplication = await waitForLinkedApplication(api, metahub.id, publication.id)
    if (typeof linkedApplication.id !== 'string') throw new Error('Scoped-layout publication did not create an application')
    await recordCreatedApplication({
        id: linkedApplication.id,
        slug: typeof linkedApplication.slug === 'string' ? linkedApplication.slug : undefined
    })
    await syncApplicationSchema(api, linkedApplication.id, {
        schemaOptions: {
            workspaceModeRequested: 'enabled',
            acknowledgeIrreversibleWorkspaceEnablement: true
        }
    })
    await waitForApplicationSchema(api, linkedApplication.id)

    const scopesResponse = await listApplicationLayoutScopes(api, linkedApplication.id, 'en')
    const scopes = (scopesResponse?.items ?? []) as LayoutScope[]
    const entityResponse = await listEntityInstances(api, metahub.id, {
        kind: 'object',
        limit: 200,
        offset: 0
    })
    const siteSettingsEntity = (entityResponse?.items ?? []).find(
        (entity: { id?: string; codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageSiteSettings'
    )
    if (typeof siteSettingsEntity?.id !== 'string') {
        throw new Error('The scoped-layout metahub did not expose the Marketing site settings Object entity')
    }

    const objectScope = scopes.find(
        (scope) =>
            scope.scopeKind === 'entity' &&
            typeof scope.id === 'string' &&
            scope.scopeEntityId === siteSettingsEntity.id &&
            scope.kind?.toLowerCase() === 'object'
    )
    const pageScope = scopes.find(
        (scope) =>
            scope.scopeKind === 'entity' &&
            typeof scope.id === 'string' &&
            typeof scope.scopeEntityId === 'string' &&
            scope.kind?.toLowerCase() === 'page'
    )
    if (!objectScope?.id || !objectScope.scopeEntityId) {
        throw new Error('The scoped-layout application did not expose the Marketing site settings Object target')
    }
    if (!pageScope?.id || !pageScope.scopeEntityId) {
        throw new Error('The scoped-layout application did not expose a Page target')
    }

    const layoutResponse = await listApplicationLayouts(api, linkedApplication.id, { limit: 100, offset: 0 })
    const globalLayout = (layoutResponse?.items ?? []).find(
        (layout: LayoutRecord) => layout.scopeEntityId === null && layout.templateKey === 'marketing-page'
    ) as LayoutRecord | undefined
    if (!globalLayout?.id || typeof globalLayout.version !== 'number') {
        throw new Error('The scoped-layout application did not expose its materialized marketing global layout')
    }

    const sourceWidgetsResponse = await listApplicationLayoutWidgets(api, linkedApplication.id, globalLayout.id)
    const sourceWidgets = (sourceWidgetsResponse?.items ?? []).filter(
        (widget: LayoutWidget) => typeof widget.widgetKey === 'string' && typeof widget.zone === 'string'
    ) as LayoutWidget[]
    if (sourceWidgets.length === 0) throw new Error('The scoped-layout application did not expose marketing source widgets')

    return {
        api,
        applicationId: linkedApplication.id,
        metahubId: metahub.id,
        globalLayout,
        sourceWidgets,
        objectScope: {
            ...objectScope,
            name: objectScope.name ?? 'Marketing site settings'
        } as RuntimeFixture['objectScope'],
        pageScope: {
            ...pageScope,
            name: pageScope.name ?? 'Page'
        } as RuntimeFixture['pageScope']
    }
}

const addWidget = async (api: ApiContext, applicationId: string, layoutId: string, payload: Omit<LayoutWidget, 'id'>): Promise<void> => {
    await expect
        .poll(
            async () => {
                const detail = await getApplicationLayout(api, applicationId, layoutId)
                const version = detail?.item?.version
                if (!Number.isInteger(version) || version < 1) {
                    throw new Error(`Layout ${layoutId} did not expose a writable version`)
                }

                try {
                    await upsertApplicationLayoutWidget(api, applicationId, layoutId, {
                        ...payload,
                        expectedVersion: version
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

const copyWidgets = async (fixture: RuntimeFixture, layoutId: string): Promise<void> => {
    for (const widget of fixture.sourceWidgets) {
        if (!widget.widgetKey || !widget.zone) continue
        await addWidget(fixture.api, fixture.applicationId, layoutId, {
            widgetKey: widget.widgetKey,
            zone: widget.zone,
            sortOrder: widget.sortOrder ?? 0,
            config: widget.config && typeof widget.config === 'object' && !Array.isArray(widget.config) ? widget.config : {}
        })
    }
}

const addDashboardWidgets = async (fixture: RuntimeFixture, layoutId: string): Promise<void> => {
    await addWidget(fixture.api, fixture.applicationId, layoutId, {
        widgetKey: 'appNavbar',
        zone: 'top',
        sortOrder: 0,
        config: {}
    })
    await addWidget(fixture.api, fixture.applicationId, layoutId, {
        widgetKey: 'menuWidget',
        zone: 'left',
        sortOrder: 0,
        config: { autoShowAllSections: true, showTitle: false, items: [] }
    })
    await addWidget(fixture.api, fixture.applicationId, layoutId, {
        widgetKey: 'languageSwitcher',
        zone: 'top',
        sortOrder: 1,
        config: {}
    })
    await addWidget(fixture.api, fixture.applicationId, layoutId, {
        widgetKey: 'detailsTitle',
        zone: 'center',
        sortOrder: 1,
        config: {}
    })
    await addWidget(fixture.api, fixture.applicationId, layoutId, {
        widgetKey: 'detailsTable',
        zone: 'center',
        sortOrder: 2,
        config: {}
    })
}

const createLayout = async (
    fixture: RuntimeFixture,
    templateKey: LayoutRecord['templateKey'],
    scopeEntityId: string | null,
    name: string,
    isDefault: boolean
): Promise<LayoutRecord> => {
    const response = await createApplicationLayout(fixture.api, fixture.applicationId, {
        templateKey,
        scopeEntityId,
        name: { en: name, ru: name },
        isActive: true,
        isDefault,
        sortOrder: 10,
        config: {}
    })
    return readLayoutItem(response)
}

const buildRuntimePath = (
    applicationId: string,
    target: RuntimeTarget | null,
    locale: 'en' | 'ru' = 'en',
    themeVariant: 'light' | 'dark' = 'light'
): string => {
    const query = new URLSearchParams({ locale, themeVariant })
    if (target) {
        query.set('targetKind', target.kind)
        query.set('entityTypeId', target.entityTypeId)
        return `/a/${applicationId}/${encodeURIComponent(target.entityTypeId)}?${query.toString()}`
    }
    return `/a/${applicationId}?${query.toString()}`
}

const targetKey = (target: RuntimeTarget | null): string => (target ? `${target.kind}:${target.entityTypeId}` : 'global')

const effectiveResponseFor = (page: Page, applicationId: string, target: RuntimeTarget | null): Promise<Response> =>
    page.waitForResponse(
        (response) => {
            if (response.request().method() !== 'GET') return false
            const url = new URL(response.url())
            if (url.pathname !== `/api/v1/applications/${applicationId}/runtime/effective-layout`) return false
            return target
                ? url.searchParams.get('targetKind') === target.kind && url.searchParams.get('entityTypeId') === target.entityTypeId
                : !url.searchParams.has('targetKind') && !url.searchParams.has('entityTypeId')
        },
        { timeout: 60_000 }
    )

const marketingResponseFor = (page: Page, applicationId: string, target: RuntimeTarget | null): Promise<Response> =>
    page.waitForResponse(
        (response) => {
            if (response.request().method() !== 'GET') return false
            const url = new URL(response.url())
            if (url.pathname !== `/api/v1/applications/${applicationId}/runtime/marketing-page`) return false
            return target
                ? url.searchParams.get('targetKind') === target.kind && url.searchParams.get('entityTypeId') === target.entityTypeId
                : !url.searchParams.has('targetKind') && !url.searchParams.has('entityTypeId')
        },
        { timeout: 60_000 }
    )

const assertSurface = async (page: Page, expected: ExpectedRuntime, label: string): Promise<void> => {
    const locale = expected.locale ?? 'en'
    if (expected.templateKey === 'marketing-page') {
        await expect(page.locator('#marketing-page-main'), `${label} marketing main`).toBeVisible()
        await expect(
            page.getByRole('heading', { name: locale === 'ru' ? 'Наши новые продукты' : 'Our latest products', exact: true }),
            `${label} marketing heading`
        ).toBeVisible()
        await expect(page.getByTestId('runtime-main-content')).toHaveCount(0)
    } else {
        await expect(page.getByTestId('runtime-main-content'), `${label} dashboard main`).toBeVisible()
        await expect(page.locator('#marketing-page-main')).toHaveCount(0)
    }

    await expectNoPageHorizontalOverflow(page, label)
    await expectNoTechnicalLeakage(page.locator('body'), {
        label,
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: [/marketing\.(?:navigation|footer|hero)/i]
    })
    await expectLocalizedValidation(page.locator('body'), locale, { label })

    if ((await page.locator('.MuiDataGrid-root:visible').count()) > 0) {
        await expectNoDataGridTechnicalLeakage(page.locator('body'), {
            label,
            requireVisibleGrid: true,
            checkUuidSubstrings: true
        })
        await expectDataGridHorizontalScrollConstrained(page, label)
    }
}

const visitRuntime = async (
    page: Page,
    fixture: RuntimeFixture,
    target: RuntimeTarget | null,
    expected: ExpectedRuntime,
    label: string,
    effectiveRequestKeys: Set<string>,
    marketingRequestKeys: Set<string>
): Promise<void> => {
    const effectivePromise = effectiveResponseFor(page, fixture.applicationId, target)
    const marketingPromise = expected.templateKey === 'marketing-page' ? marketingResponseFor(page, fixture.applicationId, target) : null
    await page.goto(buildRuntimePath(fixture.applicationId, target, expected.locale ?? 'en', expected.themeVariant ?? 'light'))

    const effectiveResponse = await effectivePromise
    expect(effectiveResponse.ok(), `${label} effective-layout response`).toBe(true)
    const effectivePayload = (await effectiveResponse.json()) as {
        effectiveHash?: unknown
        layout?: { id?: unknown; templateKey?: string; version?: unknown }
        scope?: unknown
    }
    expect(effectivePayload.layout?.templateKey, `${label} effective template`).toBe(expected.templateKey)
    expect(isUuidV7(effectivePayload.layout?.id), `${label} effective layout identity must be UUID v7`).toBe(true)
    expect(effectivePayload.layout?.version, `${label} effective layout must expose a version`).toEqual(expect.any(Number))
    expect(effectivePayload.effectiveHash, `${label} effective layout must expose a content hash`).toMatch(/^[0-9a-f]{64}$/i)
    effectiveRequestKeys.add(targetKey(target))

    if (marketingPromise) {
        const marketingResponse = await marketingPromise
        expect(marketingResponse.ok(), `${label} marketing content response`).toBe(true)
        marketingRequestKeys.add(targetKey(target))
    }

    await assertSurface(page, expected, label)
}

const assertMarketingMobileDrawer = async (page: Page): Promise<void> => {
    await page.setViewportSize({ width: 390, height: 844 })
    await waitForLayoutFrame(page)
    const openButton = page.getByRole('button', { name: 'Open menu', exact: true })
    await expect(openButton).toBeVisible()
    await openButton.focus()
    await page.keyboard.press('Enter')
    const closeButton = page.getByRole('button', { name: 'Close menu', exact: true })
    await expect(closeButton).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(openButton).toBeFocused()
}

const assertDashboardMobileDrawer = async (page: Page, locale: 'en' | 'ru' = 'en'): Promise<void> => {
    await page.setViewportSize({ width: 390, height: 844 })
    await waitForLayoutFrame(page)
    const accessibleNames =
        locale === 'ru'
            ? { openMenu: 'Открыть меню', navigation: 'Навигация приложения' }
            : { openMenu: 'Open menu', navigation: 'Application navigation' }
    const openButton = page.getByRole('button', { name: accessibleNames.openMenu, exact: true }).last()
    await expect(openButton).toBeVisible()
    await openButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('navigation', { name: accessibleNames.navigation, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(openButton).toBeFocused()
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const chooseOption = async (page: Page, dialog: Locator, label: string, optionName: string | RegExp): Promise<void> => {
    const select = dialog.getByRole('combobox', { name: label, exact: true })
    await expect(select).toBeVisible()
    await select.click()
    await expect(page.getByRole('option', { name: optionName, exact: typeof optionName === 'string' })).toBeVisible()
    await page.getByRole('option', { name: optionName, exact: typeof optionName === 'string' }).click()
}

test('@flow @combined @cross-template @scoped-layout covers Page/Object precedence in both template directions', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(420_000)
    const fixture = await createRuntimeFixture(runManifest)
    const effectiveRequestKeys = new Set<string>()
    const marketingRequestKeys = new Set<string>()
    const objectTarget: RuntimeTarget = { kind: 'object', entityTypeId: fixture.objectScope.scopeEntityId }
    const pageTarget: RuntimeTarget = { kind: 'page', entityTypeId: fixture.pageScope.scopeEntityId }

    try {
        const globalDashboard = await createLayout(fixture, 'dashboard', null, `Global dashboard ${runManifest.runId}`, true)
        await addDashboardWidgets(fixture, globalDashboard.id)

        const pageMarketing = await createLayout(
            fixture,
            'marketing-page',
            pageTarget.entityTypeId,
            `Page marketing ${runManifest.runId}`,
            true
        )
        await copyWidgets(fixture, pageMarketing.id)
        const objectMarketing = await createLayout(
            fixture,
            'marketing-page',
            objectTarget.entityTypeId,
            `Object marketing ${runManifest.runId}`,
            true
        )
        await copyWidgets(fixture, objectMarketing.id)

        const directionOneGlobal = await getApplicationEffectiveLayout(fixture.api, fixture.applicationId, {
            locale: 'en',
            themeVariant: 'light'
        })
        const directionOnePage = await getApplicationEffectiveLayout(fixture.api, fixture.applicationId, {
            targetKind: 'page',
            entityTypeId: pageTarget.entityTypeId,
            locale: 'en',
            themeVariant: 'light'
        })
        const directionOneObject = await getApplicationEffectiveLayout(fixture.api, fixture.applicationId, {
            targetKind: 'object',
            entityTypeId: objectTarget.entityTypeId,
            locale: 'en',
            themeVariant: 'light'
        })
        expect(directionOneGlobal.layout.templateKey).toBe('dashboard')
        expect(directionOnePage.layout.templateKey).toBe('marketing-page')
        expect(directionOnePage.resolvedEntityTypeId).toBe(pageTarget.entityTypeId)
        expect(directionOneObject.layout.templateKey).toBe('marketing-page')
        expect(directionOneObject.resolvedEntityTypeId).toBe(objectTarget.entityTypeId)

        await visitRuntime(
            page,
            fixture,
            null,
            { templateKey: 'dashboard' },
            'Direction one global Dashboard',
            effectiveRequestKeys,
            marketingRequestKeys
        )
        await visitRuntime(
            page,
            fixture,
            pageTarget,
            { templateKey: 'marketing-page' },
            'Direction one Page Marketing',
            effectiveRequestKeys,
            marketingRequestKeys
        )
        await expectRuntimeUxViewportMatrix(page, 'Direction one Page Marketing responsive', {
            beforeEachViewport: async () => {
                await expect(page.locator('#marketing-page-main')).toBeVisible()
            }
        })
        await visitRuntime(
            page,
            fixture,
            objectTarget,
            { templateKey: 'marketing-page' },
            'Direction one Object Marketing',
            effectiveRequestKeys,
            marketingRequestKeys
        )

        const globalMarketing = await createLayout(fixture, 'marketing-page', null, `Global marketing ${runManifest.runId}`, true)
        await copyWidgets(fixture, globalMarketing.id)
        const pageDashboard = await createLayout(fixture, 'dashboard', pageTarget.entityTypeId, `Page dashboard ${runManifest.runId}`, true)
        await addDashboardWidgets(fixture, pageDashboard.id)
        const objectDashboard = await createLayout(
            fixture,
            'dashboard',
            objectTarget.entityTypeId,
            `Object dashboard ${runManifest.runId}`,
            true
        )
        await addDashboardWidgets(fixture, objectDashboard.id)

        const directionTwoGlobal = await getApplicationEffectiveLayout(fixture.api, fixture.applicationId, {
            locale: 'en',
            themeVariant: 'light'
        })
        const directionTwoPage = await getApplicationEffectiveLayout(fixture.api, fixture.applicationId, {
            targetKind: 'page',
            entityTypeId: pageTarget.entityTypeId,
            locale: 'en',
            themeVariant: 'light'
        })
        const directionTwoObject = await getApplicationEffectiveLayout(fixture.api, fixture.applicationId, {
            targetKind: 'object',
            entityTypeId: objectTarget.entityTypeId,
            locale: 'en',
            themeVariant: 'light'
        })
        expect(directionTwoGlobal.layout.templateKey).toBe('marketing-page')
        expect(directionTwoPage.layout.templateKey).toBe('dashboard')
        expect(directionTwoPage.resolvedEntityTypeId).toBe(pageTarget.entityTypeId)
        expect(directionTwoObject.layout.templateKey).toBe('dashboard')
        expect(directionTwoObject.resolvedEntityTypeId).toBe(objectTarget.entityTypeId)

        await visitRuntime(
            page,
            fixture,
            null,
            { templateKey: 'marketing-page' },
            'Direction two global Marketing',
            effectiveRequestKeys,
            marketingRequestKeys
        )
        await expectRuntimeUxViewportMatrix(page, 'Direction two global Marketing responsive', {
            beforeEachViewport: async () => {
                await expect(page.locator('#marketing-page-main')).toBeVisible()
            }
        })
        await visitRuntime(
            page,
            fixture,
            null,
            { templateKey: 'marketing-page', themeVariant: 'dark' },
            'Direction two global Marketing dark theme',
            effectiveRequestKeys,
            marketingRequestKeys
        )
        await assertMarketingMobileDrawer(page)
        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(accessibility.violations, JSON.stringify(accessibility.violations)).toEqual([])

        await visitRuntime(
            page,
            fixture,
            pageTarget,
            { templateKey: 'dashboard' },
            'Direction two Page Dashboard',
            effectiveRequestKeys,
            marketingRequestKeys
        )
        await visitRuntime(
            page,
            fixture,
            pageTarget,
            { templateKey: 'dashboard', themeVariant: 'dark' },
            'Direction two Page Dashboard dark theme',
            effectiveRequestKeys,
            marketingRequestKeys
        )
        await visitRuntime(
            page,
            fixture,
            objectTarget,
            { templateKey: 'dashboard', locale: 'ru' },
            'Direction two Object Dashboard',
            effectiveRequestKeys,
            marketingRequestKeys
        )
        await expect(page.getByRole('button', { name: 'Создать', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Настройки маркетинговой страницы', exact: true })).toBeVisible()
        await assertDashboardMobileDrawer(page, 'ru')

        expect([...effectiveRequestKeys]).toEqual(
            expect.arrayContaining(['global', `page:${pageTarget.entityTypeId}`, `object:${objectTarget.entityTypeId}`])
        )
        expect([...marketingRequestKeys]).toEqual(
            expect.arrayContaining(['global', `page:${pageTarget.entityTypeId}`, `object:${objectTarget.entityTypeId}`])
        )

        await waitForLayoutFrame(page)
        await page.screenshot({ path: testInfo.outputPath('cross-template-scoped-layout-object-dashboard-ru-mobile.png'), fullPage: true })
    } finally {
        await disposeApiContext(fixture.api)
    }
})

test('@flow @combined @cross-template @authoring covers localized layout CRUD, reset, focus, and responsive authoring UX', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(360_000)
    const fixture = await createRuntimeFixture({
        ...runManifest,
        runId: `${runManifest.runId}-authoring`
    })
    const applicationId = fixture.applicationId
    const createdName = `Authoring Object ${runManifest.runId}`
    const updatedName = `Authoring Updated ${runManifest.runId}`

    try {
        await page.goto(`/a/${applicationId}/admin/layouts`)
        await expect(page.getByRole('heading', { name: 'Layouts', exact: true })).toBeVisible()
        const listSurface = page.getByTestId('application-layouts-list-content')
        await expect(listSurface).toBeVisible()
        const listView = page.getByTitle('List View', { exact: true })
        if (await listView.count()) await listView.click()
        await expectTableHorizontalScrollConstrained(listSurface, 'Application layout list')
        await expectNoTechnicalLeakage(listSurface, { label: 'Application layout list', checkUuidSubstrings: true })

        await expectRuntimeUxViewportMatrix(page, 'Application layout authoring responsive', {
            beforeEachViewport: async () => {
                await expect(listSurface).toBeVisible()
                await expectNoPageHorizontalOverflow(page, 'Application layout authoring responsive')
            }
        })

        await page.getByRole('button', { name: 'Create layout', exact: true }).click()
        const createDialog = page.getByRole('dialog', { name: 'Create layout', exact: true })
        const createName = createDialog.getByRole('textbox', { name: /^Name/ }).first()
        await expect(createDialog).toBeVisible()
        await createDialog.getByRole('button', { name: 'Create layout', exact: true }).click()
        await expect(createDialog.getByText('Enter a layout name.', { exact: true })).toBeVisible()
        await expect(createName).toHaveValue('')
        await expectLocalizedValidation(createDialog, 'en', { label: 'Create layout validation' })

        await createName.fill(createdName)
        await chooseOption(page, createDialog, 'Layout target', 'Specific entity')
        await chooseOption(page, createDialog, 'Target', new RegExp(`^Object:\\s*${escapeRegExp(fixture.objectScope.name)}$`))
        await chooseOption(page, createDialog, 'Template', 'Dashboard')
        const createResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/layouts`,
            { timeout: 60_000 }
        )
        await createDialog.getByRole('button', { name: 'Create layout', exact: true }).click()
        const createResponse = await createResponsePromise
        expect(createResponse.ok()).toBe(true)
        const createdLayout = readLayoutItem(await createResponse.json())
        const createdId = createdLayout.id
        expect(isUuidV7(createdId), 'Created layout identity must be UUID v7').toBe(true)
        await expect(createDialog).not.toBeVisible()
        const createdRow = page.getByRole('row').filter({ hasText: createdName }).first()
        await expect(createdRow).toBeVisible()

        const createdAction = createdRow.getByRole('button', { name: `Actions for ${createdName}`, exact: true })
        await createdAction.click()
        await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
        const editDialog = page.getByRole('dialog', { name: 'Edit', exact: true })
        await expect(editDialog).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(editDialog).not.toBeVisible()
        await expect(createdAction).toBeFocused()

        await createdAction.click()
        await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
        const reopenedEditDialog = page.getByRole('dialog', { name: 'Edit', exact: true })
        const nameEn = reopenedEditDialog.getByLabel('Name (English)', { exact: true })
        const nameRu = reopenedEditDialog.getByLabel('Name (Russian)', { exact: true })
        await nameEn.fill('')
        await nameRu.fill('')
        await reopenedEditDialog.getByRole('button', { name: 'Save', exact: true }).click()
        await expect(reopenedEditDialog.getByText('Enter a name in English or Russian.', { exact: true })).toBeVisible()
        await expect(nameEn).toBeEmpty()
        await expect(nameRu).toBeEmpty()
        await expectLocalizedValidation(reopenedEditDialog, 'en', { label: 'Edit layout validation' })
        await expectSemanticFieldControls(reopenedEditDialog, {
            longTextLabels: ['Description (English)', 'Description (Russian)']
        })
        await nameEn.fill(updatedName)
        await nameRu.fill(`Обновлённый layout ${runManifest.runId}`)
        await reopenedEditDialog
            .getByLabel('Description (English)', { exact: true })
            .fill(`A multiline authoring description for ${runManifest.runId}.`)
        await reopenedEditDialog
            .getByLabel('Description (Russian)', { exact: true })
            .fill(`Многострочное описание layout ${runManifest.runId}.`)
        const updateResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/layouts/${createdId}`,
            { timeout: 60_000 }
        )
        await reopenedEditDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const updateResponse = await updateResponsePromise
        expect(updateResponse.ok()).toBe(true)
        const editedLayout = readLayoutItem(await updateResponse.json())
        expect(editedLayout.id).toBe(createdId)
        expect(editedLayout.version).toBeGreaterThan(createdLayout.version)
        expect(readLocalizedText(editedLayout.name, 'en')).toBe(updatedName)
        await expect(reopenedEditDialog).not.toBeVisible()
        await expect(page.getByRole('row').filter({ hasText: updatedName }).first()).toBeVisible()

        await expect
            .poll(async () => {
                const current = await listApplicationLayouts(fixture.api, applicationId, { limit: 100, offset: 0 })
                return (current?.items ?? []).some(
                    (layout: LayoutRecord) => layout.id === editedLayout.id && layout.version === editedLayout.version
                )
            })
            .toBe(true)

        const updatedRow = page.getByRole('row').filter({ hasText: updatedName }).first()
        await updatedRow.getByRole('button', { name: `Actions for ${updatedName}`, exact: true }).click()
        const copyResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/layouts/${editedLayout.id}/copy`,
            { timeout: 60_000 }
        )
        await page.getByRole('menuitem', { name: 'Copy', exact: true }).click()
        const copyResponse = await copyResponsePromise
        expect(copyResponse.ok()).toBe(true)
        const copiedPayload = (await copyResponse.json()) as { item?: { id?: string } }
        const copiedId = copiedPayload.item?.id
        expect(copiedId).toBeTruthy()
        expect(copiedId).not.toBe(editedLayout.id)
        expect(typeof copiedId === 'string' && isUuidV7(copiedId), 'Copied layout identity must be UUID v7').toBe(true)
        const copiedDetail = await getApplicationLayout(fixture.api, applicationId, copiedId as string)
        for (const widget of (copiedDetail?.widgets ?? []) as LayoutWidget[]) {
            if (typeof widget.id === 'string') expect(isUuidV7(widget.id), 'Copied widget identity must be UUID v7').toBe(true)
        }
        await expect
            .poll(async () => {
                const current = await listApplicationLayouts(fixture.api, applicationId, { limit: 100, offset: 0 })
                return (current?.items ?? []).some((layout: LayoutRecord) => layout.id === copiedId)
            })
            .toBe(true)

        const copiedRows = page.getByRole('row').filter({ hasText: updatedName })
        await expect(copiedRows).toHaveCount(2)
        const copiedRow = copiedRows.last()
        await copiedRow.getByRole('button', { name: `Actions for ${updatedName}`, exact: true }).click()
        await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
        const deleteDialog = page.getByRole('dialog', { name: 'Delete layout?', exact: true })
        await expect(deleteDialog).toBeVisible()
        const deleteResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'DELETE' &&
                new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/layouts/${copiedId}`,
            { timeout: 60_000 }
        )
        await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click()
        const deleteResponse = await deleteResponsePromise
        expect(deleteResponse.ok()).toBe(true)
        await expect
            .poll(async () =>
                (
                    await listApplicationLayouts(fixture.api, applicationId, { limit: 100, offset: 0 })
                ).items.some((layout: LayoutRecord) => layout.id === copiedId)
            )
            .toBe(false)
        await expect(page.getByRole('row').filter({ hasText: updatedName })).toHaveCount(1)

        await page.goto(`/a/${applicationId}/admin/layouts/${fixture.globalLayout.id}`)
        const appearancePanel = page.getByTestId('application-marketing-appearance-panel')
        await expect(appearancePanel).toBeVisible()
        const resetButton = page.getByTestId('application-marketing-appearance-reset')
        await expect(resetButton).toBeEnabled()
        await resetButton.click()
        const resetDialog = page.getByRole('dialog', { name: 'Restore marketing page defaults?', exact: true })
        await expect(resetDialog).toBeVisible()
        const resetResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                new URL(response.url()).pathname ===
                    `/api/v1/applications/${applicationId}/layouts/${fixture.globalLayout.id}/config/reset`,
            { timeout: 60_000 }
        )
        await resetDialog.getByRole('button', { name: 'Restore defaults', exact: true }).click()
        const resetResponse = await resetResponsePromise
        expect(resetResponse.ok()).toBe(true)
        await expect(appearancePanel.getByRole('combobox', { name: 'Theme mode', exact: true })).toHaveText('System')
        await expect(appearancePanel.getByLabel('Primary color', { exact: true })).toHaveValue('')
        await expect(appearancePanel.getByLabel('Accent color', { exact: true })).toHaveValue('')
        await expect(appearancePanel.getByRole('switch', { name: 'Allow email actions', exact: true })).toBeChecked()
        await expect(appearancePanel.getByRole('switch', { name: 'Allow telephone actions', exact: true })).toBeChecked()
        await expect(appearancePanel.getByRole('combobox', { name: 'External link target', exact: true })).toHaveText('New tab')
        await expectNoTechnicalLeakage(page.locator('body'), { label: 'Application layout detail', checkUuidSubstrings: true })
        await expectNoPageHorizontalOverflow(page, 'Application layout detail')
        await waitForLayoutFrame(page)
        await page.screenshot({ path: testInfo.outputPath('application-layout-authoring-reset.png'), fullPage: true })
    } finally {
        await disposeApiContext(fixture.api)
    }
})
