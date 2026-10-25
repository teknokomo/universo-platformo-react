import { expect, request as playwrightRequest } from '@playwright/test'
import type { Browser, BrowserContext, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo-react/utils'
import {
    createApplicationWorkspace,
    createLoggedInApiContext,
    disposeApiContext,
    listApplicationWorkspaces,
    sendWithCsrf,
    setApplicationPublicEntryWorkspace
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { expectDataGridHorizontalScrollConstrained, expectNoPageHorizontalOverflow } from '../../support/browser/runtimeUx'
import { waitForPageResponseSnapshot } from '../../support/browser/network'
import { recordCreatedApplication, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import {
    createMaterialForCell,
    findMatrixRowByTitle,
    getMatrixRows,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig,
    setPrimaryMaterialForCell
} from '../../support/interpretationNetworkFocused'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import {
    PUBLIC_RUNTIME_PATH_PATTERN,
    PUBLIC_MULTILINE_CELL_DESCRIPTION,
    attachReadOnlyMatrixViewportEvidence,
    attachRuntimeScreenshot,
    createAnonymousBrowserContext,
    createAuthenticatedBrowserSession,
    expectNoRuntimeLeakage,
    expectPublicDashboardShell,
    expectPublicNoWorkspacesState,
    expectPublicInterpretationNetworkWorkspace,
    expectPublicMatrixReadOnly,
    waitForPublicMaterialsResponse,
    watchPublicRuntimeServerErrors,
    watchNonGetApiRequests,
    type PublicRuntimeScenario
} from './interpretation-network-public-runtime.helpers'
import { preparePublicRoleScenario } from './interpretation-network-public-runtime.role-scenario'
import type { E2ERunManifest } from '../../fixtures/test'

export const runAnonymousPublicViewerJourney = async (
    browser: Browser,
    runManifest: E2ERunManifest,
    testInfo: TestInfo
): Promise<PublicRuntimeScenario> => {
    const structuresRoute = (applicationRef: string, locale: 'en' | 'ru' = 'en') =>
        `/a/${applicationRef}?targetKind=object&entityTypeCodename=Structure&locale=${locale}`
    const api = await createLoggedInApiContext(runManifest.testUser)
    let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
    let anonymousContext: BrowserContext | null = null
    let ownerContext: BrowserContext | null = null

    try {
        bootstrapApi = await createBootstrapApiContext()
        const activeBootstrapApi = bootstrapApi
        const imported = await importInterpretationNetworkSnapshot(api, {
            snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
            label: `public-runtime-${runManifest.runId}`,
            isPublic: false
        })
        await recordCreatedMetahub({
            id: imported.metahub.id,
            name: 'Interpretation Network anonymous runtime',
            codename: `interpretation-network-public-runtime-${runManifest.runId}`
        })
        await recordCreatedApplication({ id: imported.applicationId })

        await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'multiple' })

        const ownerSession = await createAuthenticatedBrowserSession(browser, runManifest.testUser)
        ownerContext = ownerSession.context
        const ownerPage = ownerSession.page
        const baseURL = testInfo.project.use.baseURL
        if (typeof baseURL !== 'string') throw new Error('The public runtime test project must define the E2E base URL')
        await ownerPage.goto(new URL(`/a/${imported.applicationId}/admin/settings`, baseURL).toString())
        const visibilitySetting = ownerPage.getByTestId('application-setting-visibility')
        const visibilitySwitch = ownerPage.getByTestId('application-settings-visibility-switch')
        await expect(visibilitySetting).toBeVisible({ timeout: 30_000 })
        await expect(visibilitySwitch, 'The imported app starts closed before the owner publishes it').not.toBeChecked()
        await attachRuntimeScreenshot(ownerPage, testInfo, 'interpretation-network-application-settings-closed')
        await ownerPage.getByTestId('application-settings-visibility-toggle').click()
        await expect(visibilitySwitch).toBeChecked()
        const publishResponsePromise = ownerPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'PATCH' && url.pathname === `/api/v1/applications/${imported.applicationId}`
        })
        await ownerPage.getByTestId('application-settings-general-save').click()
        const publishResponse = await publishResponsePromise
        expect(publishResponse.status(), 'The owner publishes the application through its settings screen').toBe(200)
        await expect(visibilitySwitch).toBeChecked()
        await attachRuntimeScreenshot(ownerPage, testInfo, 'interpretation-network-application-settings-public')

        const aliasToken = imported.applicationId.replaceAll('-', '').toLowerCase()
        const alias = `network-${aliasToken}`
        const secondaryAlias = `network-alt-${aliasToken}`
        const aliasResponse = await sendWithCsrf(activeBootstrapApi, 'POST', '/api/v1/application-aliases', {
            applicationId: imported.applicationId,
            alias,
            makePrimary: true
        })
        if (!aliasResponse.ok) {
            throw new Error(
                `Creating public Interpretation Network alias failed with ${aliasResponse.status}: ${await aliasResponse.text()}`
            )
        }
        const secondaryAliasResponse = await sendWithCsrf(activeBootstrapApi, 'POST', '/api/v1/application-aliases', {
            applicationId: imported.applicationId,
            alias: secondaryAlias,
            makePrimary: false
        })
        if (!secondaryAliasResponse.ok) {
            throw new Error(
                `Creating secondary public Interpretation Network alias failed with ${
                    secondaryAliasResponse.status
                }: ${await secondaryAliasResponse.text()}`
            )
        }
        const directPolicyResponse = await sendWithCsrf(
            activeBootstrapApi,
            'PATCH',
            `/api/v1/applications/${imported.applicationId}/aliases/policy`,
            { routingMode: 'direct' }
        )
        if (!directPolicyResponse.ok) {
            throw new Error(
                `Setting direct public Interpretation Network alias routing failed with ${
                    directPolicyResponse.status
                }: ${await directPolicyResponse.text()}`
            )
        }

        const initialWorkspaceList = await listApplicationWorkspaces(api, imported.applicationId)
        const initialSharedWorkspaces = (initialWorkspaceList?.items ?? []).filter(
            (workspace: Record<string, unknown>) =>
                (workspace.workspaceType === 'shared' || workspace.type === 'shared') && workspace.personalUserId == null
        )
        expect(
            initialSharedWorkspaces,
            'The anonymous empty-state journey starts with no shared Workspace in this newly imported application'
        ).toHaveLength(0)

        // A newly published app remains publicly reachable even before any shared Workspace exists.
        anonymousContext = (await createAnonymousBrowserContext(browser, testInfo)).context
        const publicMutationRequestsBeforeWorkspace = watchNonGetApiRequests(anonymousContext, baseURL)
        const noWorkspacePage = await anonymousContext.newPage()
        const authenticatedRuntimeRequestsBeforeWorkspace: string[] = []
        const publicWidgetDataRequestsBeforeWorkspace: string[] = []
        anonymousContext.on('request', (request) => {
            const pathname = new URL(request.url()).pathname
            if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(pathname)) {
                authenticatedRuntimeRequestsBeforeWorkspace.push(`${request.method()} ${pathname}`)
            }
            if (PUBLIC_RUNTIME_PATH_PATTERN.test(pathname) && pathname.includes('/runtime/widgets/')) {
                publicWidgetDataRequestsBeforeWorkspace.push(`${request.method()} ${pathname}`)
            }
        })
        const noWorkspaceBootstrapPromise = noWorkspacePage.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' && PUBLIC_RUNTIME_PATH_PATTERN.test(url.pathname) && url.pathname.endsWith('/runtime')
            )
        })
        await noWorkspacePage.goto(structuresRoute(imported.applicationId))
        await expect(noWorkspacePage).toHaveURL(new RegExp(`/a/${imported.applicationId}(?:\\?|$)`, 'u'))
        const noWorkspaceBootstrap = await noWorkspaceBootstrapPromise
        expect(noWorkspaceBootstrap.status(), 'A public app with no shared Workspaces returns a renderable public Dashboard DTO').toBe(200)
        const noWorkspaceRuntimeResponse = await anonymousContext.request.get(
            new URL(
                `/api/v1/public/applications/${imported.applicationId}/runtime?targetKind=object&entityTypeCodename=Structure`,
                baseURL
            ).toString()
        )
        expect(noWorkspaceRuntimeResponse.status(), 'The anonymous public runtime DTO remains readable through the browser context').toBe(
            200
        )
        const noWorkspacePayload = (await noWorkspaceRuntimeResponse.json()) as {
            dashboard?: {
                locale?: string
                workspaceAvailability?: string
                placements?: Array<{ instanceKey?: string; widgetKey?: string; runtimeData?: { status?: string } }>
            }
        }
        expect(noWorkspacePayload.dashboard).toMatchObject({ locale: 'en', workspaceAvailability: 'none' })
        expect(noWorkspacePayload.dashboard?.placements).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    instanceKey: 'interpretation-workspace',
                    widgetKey: 'interpretationNetworkWorkspace',
                    runtimeData: { status: 'deferred' }
                })
            ])
        )
        await expectPublicNoWorkspacesState(noWorkspacePage)
        expect(authenticatedRuntimeRequestsBeforeWorkspace).toEqual([])
        await noWorkspacePage.setViewportSize({ width: 1920, height: 1080 })
        await expectPublicNoWorkspacesState(noWorkspacePage)
        await expectNoPageHorizontalOverflow(noWorkspacePage, 'Public Dashboard without a shared Workspace at 1920px')
        await attachRuntimeScreenshot(noWorkspacePage, testInfo, 'interpretation-network-public-no-workspaces-en-wide-desktop')
        await noWorkspacePage.setViewportSize({ width: 768, height: 1024 })
        await expectPublicNoWorkspacesState(noWorkspacePage)
        await expectNoPageHorizontalOverflow(noWorkspacePage, 'Public Dashboard without a shared Workspace at 768px')
        await attachRuntimeScreenshot(noWorkspacePage, testInfo, 'interpretation-network-public-no-workspaces-en-tablet')
        await expectNoPageHorizontalOverflow(noWorkspacePage, 'Public Dashboard without a shared Workspace')
        await noWorkspacePage.setViewportSize({ width: 390, height: 844 })
        await expectPublicNoWorkspacesState(noWorkspacePage)
        await expectNoPageHorizontalOverflow(noWorkspacePage, 'Public Dashboard without a shared Workspace at 390px')
        await attachRuntimeScreenshot(noWorkspacePage, testInfo, 'interpretation-network-public-no-workspaces-en-mobile')

        const aliasNoWorkspaceBootstrapPromise = noWorkspacePage.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' && PUBLIC_RUNTIME_PATH_PATTERN.test(url.pathname) && url.pathname.endsWith('/runtime')
            )
        })
        await noWorkspacePage.goto(structuresRoute(alias))
        const aliasNoWorkspaceBootstrap = await aliasNoWorkspaceBootstrapPromise
        expect(aliasNoWorkspaceBootstrap.status(), 'A short alias opens the public no-workspace state without authentication').toBe(200)
        await expect(noWorkspacePage).toHaveURL(new RegExp(`/a/${alias}(?:\\?|$)`, 'u'))
        await expectPublicNoWorkspacesState(noWorkspacePage)
        expect(authenticatedRuntimeRequestsBeforeWorkspace).toEqual([])
        const anonymousApi = await playwrightRequest.newContext({
            baseURL,
            extraHTTPHeaders: { Accept: 'application/json' }
        })
        try {
            const aliasRuntimeResponse = await anonymousApi.get(
                `/api/v1/public/applications/${encodeURIComponent(alias)}/runtime?targetKind=object&entityTypeCodename=Structure&locale=en`
            )
            expect(aliasRuntimeResponse.status(), 'The public alias resolves through the anonymous runtime API').toBe(200)
            expect((await aliasRuntimeResponse.json()).dashboard.workspaceAvailability).toBe('none')
        } finally {
            await anonymousApi.dispose()
        }

        const russianNoWorkspaceBootstrapPromise = noWorkspacePage.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname === `/api/v1/public/applications/${encodeURIComponent(imported.applicationId)}/runtime` &&
                url.searchParams.get('locale') === 'ru' &&
                url.searchParams.get('targetKind') === 'object' &&
                url.searchParams.get('entityTypeCodename') === 'Structure' &&
                PUBLIC_RUNTIME_PATH_PATTERN.test(url.pathname) &&
                url.pathname.endsWith('/runtime')
            )
        })
        await noWorkspacePage.goto(structuresRoute(imported.applicationId, 'ru'))
        const russianNoWorkspaceBootstrap = await russianNoWorkspaceBootstrapPromise
        expect(russianNoWorkspaceBootstrap.status()).toBe(200)
        const russianAnonymousApi = await playwrightRequest.newContext({
            baseURL,
            extraHTTPHeaders: { Accept: 'application/json' }
        })
        try {
            const russianRuntimeResponse = await russianAnonymousApi.get(
                `/api/v1/public/applications/${encodeURIComponent(
                    imported.applicationId
                )}/runtime?targetKind=object&entityTypeCodename=Structure&locale=ru`
            )
            expect(russianRuntimeResponse.status(), 'The anonymous Russian runtime DTO remains readable').toBe(200)
            expect((await russianRuntimeResponse.json()).dashboard).toMatchObject({ locale: 'ru', workspaceAvailability: 'none' })
        } finally {
            await russianAnonymousApi.dispose()
        }
        await expectPublicNoWorkspacesState(noWorkspacePage, 'ru')
        expect(publicWidgetDataRequestsBeforeWorkspace, 'An app with no shared Workspace must not query public widget data').toEqual([])
        expect(publicMutationRequestsBeforeWorkspace, 'Anonymous empty-state navigation must not send API mutations').toEqual([])
        await expectNoPageHorizontalOverflow(noWorkspacePage, 'Russian public Dashboard without a shared Workspace at 390px')
        await attachRuntimeScreenshot(noWorkspacePage, testInfo, 'interpretation-network-public-no-workspaces-ru-mobile')
        await noWorkspacePage.close()

        const workspaceList = await listApplicationWorkspaces(api, imported.applicationId)
        const sharedWorkspace = (workspaceList?.items ?? []).find(
            (workspace: Record<string, unknown>) =>
                (workspace.workspaceType === 'shared' || workspace.type === 'shared') && workspace.personalUserId == null
        )
        const existingSharedWorkspace = sharedWorkspace as
            | {
                  id?: string
                  name?: { locales?: Record<string, { content?: string }> }
              }
            | undefined
        const createdEntryWorkspace = existingSharedWorkspace
            ? undefined
            : await createApplicationWorkspace(api, imported.applicationId, {
                  name: createLocalizedContent('en', 'Interpretation Network public entry'),
                  description: createLocalizedContent('en', 'Workspace used for anonymous public rendering')
              })
        const publicEntryWorkspaceId = existingSharedWorkspace?.id ?? createdEntryWorkspace?.id
        const publicEntryWorkspaceLabel =
            existingSharedWorkspace?.name?.locales?.en?.content ??
            existingSharedWorkspace?.name?.locales?.ru?.content ??
            'Interpretation Network public entry'
        if (typeof publicEntryWorkspaceId !== 'string') {
            throw new Error('The public Interpretation Network runtime test could not prepare a public entry workspace')
        }
        await setApplicationPublicEntryWorkspace(api, imported.applicationId, null)
        await ownerPage.reload()
        const publicEntryWorkspaceSelector = ownerPage.getByTestId('application-settings-public-entry-workspace-select')
        await expect(
            publicEntryWorkspaceSelector,
            'The owner can configure the public entry workspace in Application Settings'
        ).toBeVisible({
            timeout: 30_000
        })
        await publicEntryWorkspaceSelector.click()
        const publicEntryWorkspaceOption = ownerPage.getByRole('option', { name: publicEntryWorkspaceLabel, exact: true })
        await expect(publicEntryWorkspaceOption).toBeVisible()
        const publicEntryWorkspaceSavePromise = waitForPageResponseSnapshot(ownerPage, (response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'PATCH' &&
                url.pathname === `/api/v1/applications/${imported.applicationId}/settings/public-entry-workspace`
            )
        })
        await publicEntryWorkspaceOption.click()
        const publicEntryWorkspaceSave = await publicEntryWorkspaceSavePromise
        expect(publicEntryWorkspaceSave.status, 'Selecting the public entry workspace persists through the settings UI').toBe(200)
        expect(JSON.parse(publicEntryWorkspaceSave.body).workspaceId).toBe(publicEntryWorkspaceId)
        await attachRuntimeScreenshot(ownerPage, testInfo, 'interpretation-network-application-settings-public-entry-workspace')
        await expectNoPageHorizontalOverflow(ownerPage, 'Application Settings public entry workspace selector')
        const runtimeIds = await resolveRuntimeIds(api, imported.applicationId, publicEntryWorkspaceId)
        const publicStructureName = 'Public Interpretation Network structure'
        const widgetContextQuery = new URLSearchParams({
            workspaceId: publicEntryWorkspaceId,
            layoutId: runtimeIds.layoutId,
            widgetId: runtimeIds.widgetId
        })
        const createStructureResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/structures?${widgetContextQuery}`,
            {
                name: createLocalizedContent('en', publicStructureName),
                description: createLocalizedContent('en', 'A real multiple-mode structure rendered by the anonymous Dashboard.'),
                locale: 'en'
            }
        )
        const createStructureResponseBody = await createStructureResponse.text()
        expect(
            createStructureResponse.status,
            `The generated snapshot starts in multiple-structure mode: ${createStructureResponseBody}`
        ).toBe(201)
        const system = JSON.parse(createStructureResponseBody) as {
            structureId: string
            interpretationId: string
            rootCellId: string
            created: boolean
        }
        expect(system.structureId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
        expect(system.interpretationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
        expect(system.rootCellId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
        const rootCell = findMatrixRowByTitle(
            await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
            'Universe'
        )
        const rootCellVersion = Number(rootCell.row._upl_version ?? 0)
        if (!Number.isSafeInteger(rootCellVersion) || rootCellVersion <= 0) {
            throw new Error('The public runtime multiline description test could not resolve the root cell version')
        }
        const multilineDescriptionResponse = await sendWithCsrf(
            api,
            'PATCH',
            `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/matrix/cells/${
                rootCell.cellId
            }?workspaceId=${encodeURIComponent(publicEntryWorkspaceId)}&targetKind=object&entityTypeId=${encodeURIComponent(
                runtimeIds.entityTypeId
            )}&layoutId=${encodeURIComponent(runtimeIds.layoutId)}&widgetId=${encodeURIComponent(
                runtimeIds.widgetId
            )}&instanceKey=${encodeURIComponent(runtimeIds.instanceKey)}&locale=en&themeVariant=light`,
            {
                interpretationId: system.interpretationId,
                data: { CellDescription: createLocalizedContent('en', PUBLIC_MULTILINE_CELL_DESCRIPTION) },
                expectedCellVersion: rootCellVersion
            }
        )
        if (!multilineDescriptionResponse.ok) {
            throw new Error(
                `Setting the public Matrix multiline description failed with ${
                    multilineDescriptionResponse.status
                }: ${await multilineDescriptionResponse.text()}`
            )
        }
        for (let index = 1; index <= 25; index += 1) {
            await createMaterialForCell(api, imported.applicationId, runtimeIds, {
                interpretationId: system.interpretationId,
                cellId: rootCell.cellId,
                title: `Public secondary material ${String(index).padStart(2, '0')}`,
                description: 'A secondary item used to verify Primary Material pagination.'
            })
        }
        const primaryMaterial = await createMaterialForCell(api, imported.applicationId, runtimeIds, {
            interpretationId: system.interpretationId,
            cellId: rootCell.cellId,
            title: 'Public primary material',
            description: 'This material opens first in the anonymous read-only view.',
            body: {
                format: 'editorjs',
                data: {
                    time: 0,
                    version: '2.30.8',
                    blocks: [
                        {
                            id: 'public-primary-material-paragraph',
                            type: 'paragraph',
                            data: { text: 'This rich material body is rendered with the shared block editor.' }
                        }
                    ]
                }
            }
        })
        const currentRootCell = findMatrixRowByTitle(
            await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
            'Universe'
        )
        const currentCellVersion = Number(currentRootCell.row._upl_version ?? 0)
        if (!Number.isSafeInteger(currentCellVersion) || currentCellVersion <= 0) {
            throw new Error('The public runtime primary material test could not resolve the root cell version')
        }
        await setPrimaryMaterialForCell(api, imported.applicationId, runtimeIds, {
            interpretationId: system.interpretationId,
            cellId: currentRootCell.cellId,
            materialId: primaryMaterial.id,
            expectedCellVersion: currentCellVersion
        })

        const anonymousSession = { context: anonymousContext, baseURL: testInfo.project.use.baseURL }
        if (typeof anonymousSession.baseURL !== 'string') throw new Error('The public runtime test project must define the E2E base URL')
        const publicRuntimeServerErrors = watchPublicRuntimeServerErrors(anonymousContext)
        const nonGetApiRequests = watchNonGetApiRequests(anonymousContext, anonymousSession.baseURL)
        const page = await anonymousContext.newPage()
        const publicRuntimeRequests: string[] = []
        const authenticatedRuntimeRequests: string[] = []
        anonymousContext.on('request', (request) => {
            const requestUrl = new URL(request.url())
            if (PUBLIC_RUNTIME_PATH_PATTERN.test(requestUrl.pathname)) {
                publicRuntimeRequests.push(`${request.method()} ${requestUrl.pathname}`)
            }
            if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(requestUrl.pathname)) {
                authenticatedRuntimeRequests.push(`${request.method()} ${requestUrl.pathname}`)
            }
        })
        const startPageBootstrapPromise = waitForPageResponseSnapshot(page, (response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' && PUBLIC_RUNTIME_PATH_PATTERN.test(url.pathname) && url.pathname.endsWith('/runtime')
            )
        })
        await page.goto(`/a/${alias}?locale=en`)
        const startBootstrap = await startPageBootstrapPromise
        expect(startBootstrap.status, 'The default public Start page loads through the Dashboard runtime').toBe(200)
        const startRuntime = JSON.parse(startBootstrap.body) as {
            templateKey?: string
            dashboard?: {
                pageBlocks?: unknown[]
                placements?: Array<{ widgetKey?: string; runtimeData?: { data?: { navigationAction?: unknown } } }>
            }
        }
        expect(startRuntime.templateKey).toBe('dashboard')
        expect(
            startRuntime.dashboard?.pageBlocks?.length,
            'The public Dashboard response includes the selected Start page content'
        ).toBeGreaterThan(0)
        expect(
            startRuntime.dashboard?.placements?.some(({ widgetKey }) => widgetKey === 'interpretationNetworkWorkspace'),
            'The Start layout does not contain the Structures-only workspace placement'
        ).toBe(false)
        expect(
            startRuntime.dashboard?.placements?.find(({ widgetKey }) => widgetKey === 'menuWidget')?.runtimeData?.data?.navigationAction,
            'The Start page publishes a semantic navigation action to the Structures page'
        ).toMatchObject({
            label: 'Structures',
            source: { kind: 'page', codename: 'InterpretationNetworkIntro' },
            target: { kind: 'object', codename: 'Structure' }
        })
        await expectPublicDashboardShell(page)
        const startMain = page.getByRole('main')
        const startHeading = startMain.getByRole('heading', {
            name: /^(?:Interpretation Network|Трактовочная сеть|Сеть интерпретаций)$/u
        })
        const startPurpose = startMain.getByText(
            'The interpretation network helps build a hierarchy of structures, cells, relations, and Editor.js materials for analyzing meanings across contexts.'
        )
        await expect(startHeading, 'Start does not repeat the application name as a central heading').toHaveCount(0)
        await expect(startPurpose, 'Start exposes its basic product introduction').toHaveCount(1)
        await expect(startPurpose).toBeVisible()
        await expect(startMain.getByText('No dashboard content is available yet.')).toHaveCount(0)
        await expect(
            startMain.getByTestId('interpretation-network-structure-pane'),
            'The application Start page does not mount the Structures workspace widget'
        ).toHaveCount(0)
        for (const viewport of [
            { name: 'wide-desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expectPublicDashboardShell(page)
            await expect(startHeading, `No repeated application heading appears at ${viewport.width}px`).toHaveCount(0)
            await expect(startPurpose, `The basic Start description remains visible at ${viewport.width}px`).toBeVisible()
            await expect(startPurpose, `The Start introduction text remains visible at ${viewport.width}px`).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Public Interpretation Network Start at ${viewport.width}px`)
            await attachRuntimeScreenshot(page, testInfo, `interpretation-network-public-start-page-${viewport.name}`)
            if (viewport.name === 'wide-desktop') {
                await page.screenshot({
                    path: testInfo.outputPath('interpretation-network-public-start-desktop.png'),
                    fullPage: true,
                    animations: 'disabled'
                })
            }
        }
        await page.setViewportSize({ width: 1280, height: 900 })
        const structuresLink = page.getByTestId('public-dashboard-next-section')
        await expect(structuresLink, 'Start exposes a clear next-step link to Structures').toHaveText('Structures')
        const structuresHref = new URL((await structuresLink.getAttribute('href')) ?? '', anonymousSession.baseURL)
        expect(structuresHref.pathname).toBe(`/a/${alias}`)
        expect(structuresHref.searchParams.get('targetKind')).toBe('object')
        expect(structuresHref.searchParams.get('entityTypeCodename')).toBe('Structure')
        expect(structuresHref.searchParams.get('locale')).toBe('en')

        const publicStructuresResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname.includes('/runtime/widgets/') &&
                url.pathname.endsWith('/interpretation-network') &&
                url.searchParams.get('view') === 'structures'
            )
        })
        const publicStructuresDashboardResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname === `/api/v1/public/applications/${alias}/runtime` &&
                url.searchParams.get('targetKind') === 'object' &&
                url.searchParams.get('entityTypeCodename') === 'Structure'
            )
        })
        await structuresLink.click()
        const publicStructuresDashboardResponse = await publicStructuresDashboardResponsePromise
        expect(publicStructuresDashboardResponse.status(), 'Anonymous semantic deep links load the public Dashboard').toBe(200)
        await expect(page).toHaveURL(structuresRoute(alias))
        const publicDtoRequest = await playwrightRequest.newContext({ storageState: { cookies: [], origins: [] } })
        let runtimePayload: { route?: Record<string, unknown>; templateKey?: string } | null = null
        try {
            const dashboardResponse = await publicDtoRequest.get(
                new URL(
                    `/api/v1/public/applications/${alias}/runtime?targetKind=object&entityTypeCodename=Structure&locale=en`,
                    anonymousSession.baseURL
                ).toString()
            )
            expect(dashboardResponse.status(), 'Anonymous dashboard projection must succeed').toBe(200)
            runtimePayload = (await dashboardResponse.json()) as { route?: Record<string, unknown>; templateKey?: string }
        } finally {
            await publicDtoRequest.dispose()
        }
        expect(runtimePayload?.templateKey).toBe('dashboard')
        expect(runtimePayload?.route).not.toHaveProperty('applicationId')
        await expectPublicDashboardShell(page)
        await expectPublicInterpretationNetworkWorkspace(page)
        const publicStructuresResponse = await publicStructuresResponsePromise
        expect(publicStructuresResponse.status(), 'Anonymous widget data must be served from the public read endpoint').toBe(200)

        const structurePane = page.getByTestId('interpretation-network-structure-pane')
        await expect(structurePane).toBeVisible({ timeout: 30_000 })
        for (const viewport of [
            { name: 'wide-desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expectPublicDashboardShell(page)
            await expectPublicInterpretationNetworkWorkspace(page)
            await expectNoPageHorizontalOverflow(page, `Public Interpretation Network Structures at ${viewport.width}px`)
            await expectDataGridHorizontalScrollConstrained(page, `Public Interpretation Network Structures at ${viewport.width}px`)
            await attachRuntimeScreenshot(page, testInfo, `interpretation-network-public-structures-${viewport.name}`)
            if (viewport.name === 'wide-desktop') {
                await page.screenshot({
                    path: testInfo.outputPath('interpretation-network-public-structures-desktop.png'),
                    fullPage: true,
                    animations: 'disabled'
                })
            }
        }
        await page.setViewportSize({ width: 1280, height: 900 })
        const structureFilter = structurePane.getByRole('textbox', { name: 'Filter by title', exact: true })
        await expect(structureFilter, 'The anonymous read-only Structure filter is inside the shared Structure pane').toHaveCount(1)
        await structureFilter.fill('No public structure matches this filter')
        await expect(structurePane.getByText('No structures match the current filter.', { exact: true })).toBeVisible()
        await structureFilter.clear()
        const structureButton = structurePane.getByRole('button', { name: publicStructureName, exact: true })
        await expect(structureButton, 'Clearing the read-only filter restores the public Structure list').toHaveCount(1)
        await expect(structureButton).toBeVisible()
        await expect
            .poll(() => {
                const currentUrl = new URL(page.url())
                return currentUrl.pathname + currentUrl.search
            })
            .toBe(structuresRoute(alias))
        const materialsResponsePromise = waitForPublicMaterialsResponse(page)
        await structureButton.focus()
        await expect(structureButton).toBeFocused()
        await page.keyboard.press('Enter')

        const matrix = page.getByTestId('interpretation-network-matrix-workspace')
        await expect(matrix).toBeVisible({ timeout: 30_000 })
        const materialsResponse = await materialsResponsePromise
        expect(materialsResponse.status, 'The anonymous Matrix reads cell materials from the public runtime endpoint').toBe(200)
        const materialsPayload = JSON.parse(materialsResponse.body) as {
            items?: Array<{ title?: string; isPrimary?: boolean }>
        }
        expect(materialsPayload.items).toHaveLength(25)
        expect(materialsPayload.items?.[0]).toMatchObject({ title: 'Public primary material', isPrimary: true })
        await expectPublicMatrixReadOnly(page, matrix)
        await expectNoRuntimeLeakage(page.getByRole('main'), 'Anonymous Interpretation Network matrix')
        const rootCellButton = matrix.getByRole('button', { name: /,\s*Universe$/u })
        await expect(rootCellButton, 'The shared Matrix exposes Universe as the selected root cell').toHaveCount(1)
        await expect(rootCellButton).toHaveAttribute('aria-pressed', 'true')
        await rootCellButton.focus()
        await expect(rootCellButton).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('heading', { name: 'Public primary material', exact: true })).toBeVisible()
        await expect(
            page.getByText('This material opens first in the anonymous read-only view.', { exact: true }),
            'The anonymous Primary Material detail includes the material description'
        ).toBeVisible()
        await expect(page.getByText('This rich material body is rendered with the shared block editor.', { exact: true })).toBeVisible()
        await expect(page.getByText('Primary Material', { exact: true })).toBeVisible()
        await attachReadOnlyMatrixViewportEvidence(page, testInfo, 'interpretation-network-public-anonymous')
        const backToMaterialsButton = page.getByRole('button', { name: 'Back to materials', exact: true })
        await expect(backToMaterialsButton).toBeVisible()
        await expectNoRuntimeLeakage(page.getByRole('main'), 'Anonymous Primary Material detail')
        for (const viewport of [
            { name: 'wide-desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(page.getByRole('heading', { name: 'Public primary material', exact: true })).toBeVisible()
            await expect(backToMaterialsButton).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Anonymous Primary Material detail at ${viewport.width}px`)
            await attachRuntimeScreenshot(page, testInfo, `interpretation-network-public-primary-material-${viewport.name}`)
        }
        await page.setViewportSize({ width: 1280, height: 900 })
        await attachRuntimeScreenshot(page, testInfo, 'interpretation-network-public-primary-material')
        await backToMaterialsButton.focus()
        await expect(backToMaterialsButton).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('heading', { name: 'Materials', exact: true })).toBeVisible()
        const materialList = page.getByTestId('interpretation-network-details-pane')
        await expect(materialList.getByText('Public primary material', { exact: true })).toBeVisible()
        await expect(materialList.getByText('Primary Material', { exact: true })).toBeVisible()
        const secondaryMaterial = materialList.getByRole('button', { name: /^Public secondary material 01/u })
        await expect(secondaryMaterial, 'The anonymous material list remains navigable after opening its Primary Material').toBeVisible()
        await secondaryMaterial.click()
        await expect(page.getByRole('heading', { name: 'Public secondary material 01', exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Back to materials', exact: true })).toBeVisible()
        await expect(page.getByText('Primary Material', { exact: true })).toHaveCount(0)
        await page.getByRole('button', { name: 'Back to materials', exact: true }).click()
        await expect(materialList.getByText('Public primary material', { exact: true })).toBeVisible()
        await expect(page.getByTestId('runtime-workspace-switcher')).toHaveCount(0)
        await expect(
            page.getByRole('main').getByRole('button', {
                name: /^(?:Create|Save|Add|Edit|Delete|Settings|Access|Favorites|Post|Run action|Создать|Сохранить|Добавить|Редактировать|Удалить|Настройки|Доступ|Избранное)\b/iu
            })
        ).toHaveCount(0)
        await expect(page.getByRole('main').getByRole('button', { name: /^(?:Cell actions:|Material actions:)/u })).toHaveCount(0)
        await expect(page.getByRole('main').getByRole('menuitem')).toHaveCount(0)
        await expect(page.getByRole('main').getByRole('tab')).toHaveCount(0)
        const publicRuntimeMain = page.getByRole('main')
        const materialTitleFilter = publicRuntimeMain.getByRole('textbox', { name: 'Filter by title', exact: true })
        await expect(publicRuntimeMain.getByRole('textbox')).toHaveCount(1)
        await expect(materialTitleFilter, 'Public visitors may filter materials without editing them').toBeVisible()
        await expect(publicRuntimeMain.locator('textarea, [contenteditable="true"]')).toHaveCount(0)
        await expect(page.getByRole('main').getByRole('columnheader', { name: /Actions|Действия/iu })).toHaveCount(0)
        await expectNoRuntimeLeakage(page.getByRole('main'), 'Anonymous Interpretation Network runtime')
        expect(publicRuntimeRequests).toContain(`GET /api/v1/public/applications/${alias}/runtime`)
        expect(nonGetApiRequests, 'Anonymous public browsing must issue no same-origin non-GET API requests').toEqual([])
        expect(authenticatedRuntimeRequests).toEqual([])
        expect(await anonymousContext.cookies()).toEqual([])
        await expectNoPageHorizontalOverflow(page, 'Anonymous Interpretation Network material list')
        await attachRuntimeScreenshot(page, testInfo, 'interpretation-network-public-material-list')

        for (const viewport of [
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'wide-desktop', width: 1920, height: 1080 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(page.getByRole('heading', { name: 'Materials', exact: true })).toBeVisible()
            await expect(materialList.getByText('Public primary material', { exact: true })).toBeVisible()
            await expect(
                materialList.getByRole('button', { name: /^Public secondary material 01/u }),
                `The anonymous Materials list remains usable at ${viewport.width}px`
            ).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Anonymous Interpretation Network ${viewport.name}`)
            await attachRuntimeScreenshot(page, testInfo, `interpretation-network-public-${viewport.name}`)
        }

        const russianStartBootstrapPromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname === `/api/v1/public/applications/${alias}/runtime` &&
                url.searchParams.get('locale') === 'ru'
            )
        })
        await page.goto(`/a/${alias}?locale=ru`)
        const russianStartBootstrap = await russianStartBootstrapPromise
        expect(russianStartBootstrap.status(), 'The localized public Start page loads in Russian').toBe(200)
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expectPublicDashboardShell(page)
        const russianStartMain = page.getByRole('main')
        await expect(
            russianStartMain.getByText(
                'Трактовочная сеть помогает создавать иерархию структур, ячеек, связей и материалов Editor.js для анализа смыслов в разных контекстах.',
                { exact: true }
            ),
            'The Russian Start page displays its localized product introduction'
        ).toBeVisible()
        await expect(russianStartMain.getByTestId('interpretation-network-structure-pane')).toHaveCount(0)
        const russianStructuresLink = page.getByRole('link', { name: 'Структуры', exact: true })
        await expect(russianStructuresLink, 'The Russian Start page exposes the localized next-step link').toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Public Interpretation Network Start in Russian')
        await attachRuntimeScreenshot(page, testInfo, 'interpretation-network-public-start-page-ru')

        const russianStructuresDashboardResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname === `/api/v1/public/applications/${alias}/runtime` &&
                url.searchParams.get('targetKind') === 'object' &&
                url.searchParams.get('entityTypeCodename') === 'Structure' &&
                url.searchParams.get('locale') === 'ru'
            )
        })
        const russianStructuresWidgetResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname.includes('/runtime/widgets/') &&
                url.pathname.endsWith('/interpretation-network') &&
                url.searchParams.get('view') === 'structures' &&
                url.searchParams.get('locale') === 'ru'
            )
        })
        await russianStructuresLink.focus()
        await expect(russianStructuresLink).toBeFocused()
        await page.keyboard.press('Enter')
        const russianStructuresDashboardResponse = await russianStructuresDashboardResponsePromise
        expect(russianStructuresDashboardResponse.status(), 'Keyboard activation opens Structures anonymously in Russian').toBe(200)
        await expect(page).toHaveURL(
            (url) =>
                url.pathname === `/a/${alias}` &&
                url.searchParams.get('targetKind') === 'object' &&
                url.searchParams.get('entityTypeCodename') === 'Structure' &&
                url.searchParams.get('locale') === 'ru'
        )
        await expectPublicDashboardShell(page)
        await expectPublicInterpretationNetworkWorkspace(page)
        await expect(page.getByTestId('interpretation-network-structure-pane')).toBeVisible({ timeout: 30_000 })
        expect((await russianStructuresWidgetResponsePromise).status(), 'The Russian Structures widget uses the public read endpoint').toBe(
            200
        )
        await expectNoPageHorizontalOverflow(page, 'Public Interpretation Network Structures in Russian')
        await attachRuntimeScreenshot(page, testInfo, 'interpretation-network-public-structures-ru')

        expect(publicRuntimeServerErrors, 'Anonymous public viewer runtime responses must not contain 5xx statuses').toEqual([])
        return await preparePublicRoleScenario(api, activeBootstrapApi, runManifest)
    } finally {
        if (anonymousContext) await anonymousContext.close()
        if (ownerContext) await ownerContext.close()
        if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
        await disposeApiContext(api)
    }
}
