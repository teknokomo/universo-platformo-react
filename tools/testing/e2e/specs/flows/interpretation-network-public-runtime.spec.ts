import { expect, test } from '../../fixtures/test'
import { request as playwrightRequest } from '@playwright/test'
import type { APIRequestContext, BrowserContext } from '@playwright/test'
import { createLocalizedContent } from '@universo-react/utils'
import {
    addApplicationMember,
    createAdminUser,
    createApplicationWorkspace,
    createLoggedInApiContext,
    disposeApiContext,
    getAssignableRoles,
    setApplicationPublicEntryWorkspace,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { expectNoPageHorizontalOverflow, expectSemanticFieldControls } from '../../support/browser/runtimeUx'
import { recordCreatedGlobalUser } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import {
    ensureSystemStructure,
    expectSingleSystemMatrix,
    findMatrixRowByTitle,
    getMatrixRows,
    openStructures,
    readLocalizedText,
    resolveRuntimeIds
} from '../../support/interpretationNetworkFocused'
import {
    PUBLIC_RUNTIME_PATH_PATTERN,
    attachReadOnlyMatrixViewportEvidence,
    attachRuntimeScreenshot,
    captureMemberRuntimeDialogViewports,
    createAnonymousBrowserContext,
    createAuthenticatedBrowserSession,
    expectNoRuntimeLeakage,
    expectPublicDashboardShell,
    expectPublicMatrixReadOnly,
    expectLoginScreenForUnavailablePublicReference,
    openPublicSystemMatrix,
    waitForPublicMaterialsResponse,
    setCanonicalAliasRouting,
    watchPublicRuntimeServerErrors,
    watchNonGetApiRequests,
    type PublicRuntimeScenario
} from './interpretation-network-public-runtime.helpers'
import { runAnonymousPublicViewerJourney } from './interpretation-network-public-runtime.anonymous-journey'

test('public runtime path matcher includes exact and nested runtime endpoints', () => {
    expect(PUBLIC_RUNTIME_PATH_PATTERN.test('/api/v1/public/applications/sample-alias/runtime')).toBe(true)
    expect(
        PUBLIC_RUNTIME_PATH_PATTERN.test('/api/v1/public/applications/sample-alias/runtime/widgets/placement/interpretation-network')
    ).toBe(true)
    expect(PUBLIC_RUNTIME_PATH_PATTERN.test('/api/v1/public/applications/sample-alias/runtime-extra')).toBe(false)
})

let publicRoleScenario: PublicRuntimeScenario | null = null

const requirePublicRoleScenario = (): PublicRuntimeScenario => {
    if (!publicRoleScenario) {
        throw new Error('The public runtime setup journey must pass before dependent journeys can run')
    }
    return publicRoleScenario
}

test.describe.serial('Interpretation Network public runtime lifecycle', () => {
    test.describe.configure({ timeout: 180_000 })

    test('@flow setup anonymous multiple-mode viewer and distinct single-system role fixture', async ({
        browser,
        runManifest
    }, testInfo) => {
        // The anonymous journey tests its own multiple-mode app, then returns the separately imported single-system role fixture.
        publicRoleScenario = await runAnonymousPublicViewerJourney(browser, runManifest, testInfo)
    })

    test('@flow authorized member CRUD through canonical alias', async ({ browser, runManifest }, testInfo) => {
        const scenario = requirePublicRoleScenario()
        const api = await createLoggedInApiContext(runManifest.testUser)
        let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
        let memberContext: BrowserContext | null = null

        try {
            bootstrapApi = await createBootstrapApiContext()
            const activeBootstrapApi = bootstrapApi
            await setCanonicalAliasRouting(activeBootstrapApi, scenario.applicationId)
            const editorDeletePolicyResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${scenario.applicationId}`, {
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'interpretationPublicEditorPolicy',
                                title: 'Interpretation public editor permissions',
                                baseRole: 'editor',
                                rules: [{ capability: 'content.delete', effect: 'allow', scope: 'application' }]
                            }
                        ]
                    }
                }
            })
            expect(editorDeletePolicyResponse.status, 'The owner explicitly grants this editor delete permission').toBe(200)
            const editorSettings = (await editorDeletePolicyResponse.json()) as {
                settings?: {
                    rolePolicies?: { templates?: Array<{ baseRole?: string; rules?: Array<{ capability?: string; effect?: string }> }> }
                }
            }
            expect(editorSettings.settings?.rolePolicies?.templates).toContainEqual(
                expect.objectContaining({
                    baseRole: 'editor',
                    rules: expect.arrayContaining([expect.objectContaining({ capability: 'content.delete', effect: 'allow' })])
                })
            )
            const assignableRoles = (await getAssignableRoles(activeBootstrapApi)) as Array<{ id?: string; codename?: string }>
            const userRole = assignableRoles.find((role) => role.codename?.toLowerCase() === 'user')
            expect(userRole?.id, 'The authorized editor gets the standard global User role').toEqual(expect.any(String))
            const editorEmail = `e2e+${runManifest.runId}.interpretation-public-editor@${
                process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
            }`
            const editorPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            const createdEditor = await createAdminUser(activeBootstrapApi, {
                email: editorEmail,
                password: editorPassword,
                roleIds: [userRole!.id!],
                comment: 'Interpretation Network public alias editor acceptance'
            })
            expect(createdEditor?.userId).toEqual(expect.any(String))
            await recordCreatedGlobalUser({ userId: createdEditor.userId, email: editorEmail })
            await addApplicationMember(api, scenario.applicationId, { email: editorEmail, role: 'editor' })
            const editorApi = await createLoggedInApiContext({ email: editorEmail, password: editorPassword })
            await disposeApiContext(editorApi)
            const runtimeIds = await resolveRuntimeIds(api, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const system = await ensureSystemStructure(api, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const rootCellRecord = findMatrixRowByTitle(
                await getMatrixRows(api, scenario.applicationId, runtimeIds, system.interpretationId),
                'Universe'
            )
            const memberSession = await createAuthenticatedBrowserSession(browser, { email: editorEmail, password: editorPassword })
            memberContext = memberSession.context
            const memberPage = memberSession.page
            const memberRuntimeRequests: string[] = []
            const memberRuntimeMutations: Array<{ method: string; pathname: string }> = []
            memberPage.on('request', (request) => {
                const url = new URL(request.url())
                if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(url.pathname)) {
                    memberRuntimeRequests.push(url.pathname)
                    if (request.method() !== 'GET') {
                        memberRuntimeMutations.push({ method: request.method(), pathname: url.pathname })
                    }
                }
            })
            const workspaceResponsePromise = memberPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname === `/api/v1/applications/${scenario.applicationId}/runtime/workspaces`
                )
            })
            const suffix = `/workspaces/${scenario.publicEntryWorkspaceId}/settings`
            const search = '?locale=ru'
            const hash = '#workspace-settings'
            await memberPage.goto(`/a/${scenario.secondaryAlias}${suffix}${search}${hash}`)
            const workspaceResponse = await workspaceResponsePromise
            expect(workspaceResponse.status(), 'The protected runtime workspace request uses the resolved application UUID').toBe(200)
            await expect
                .poll(
                    () => {
                        const currentUrl = new URL(memberPage.url())
                        return currentUrl.pathname + currentUrl.search + currentUrl.hash
                    },
                    { timeout: 30_000 }
                )
                .toBe(`/a/${scenario.alias}${suffix}${search}${hash}`)
            await expect(memberPage.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')).toBeVisible({
                timeout: 30_000
            })
            expect(memberRuntimeRequests.length, 'Authenticated application runtime requests were observed').toBeGreaterThan(0)
            expect(
                memberRuntimeRequests.every((pathname) => pathname.startsWith(`/api/v1/applications/${scenario.applicationId}/runtime`)),
                'No authenticated runtime request uses the public alias as an application ID'
            ).toBe(true)
            await expectNoPageHorizontalOverflow(memberPage, 'Authenticated canonical Interpretation Network alias')

            await memberPage.goto(`/a/${scenario.alias}/workspaces/${scenario.publicEntryWorkspaceId}?locale=en`)
            await openStructures(memberPage)
            await expectSingleSystemMatrix(memberPage)
            const rootCell = memberPage.getByTestId('interpretation-network-table-header-card').filter({ hasText: 'Universe' })
            await expect(rootCell, 'The authorized workspace Matrix contains the expected root Structure cell').toHaveCount(1)
            await expect(rootCell).toBeVisible()
            const rootCellId = await rootCell.getAttribute('data-cell-id')
            expect(rootCellId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
            expect(rootCellId, 'The member journey uses the freshly resolved database root CellId').toBe(rootCellRecord.cellId)
            await rootCell.click()

            const matrixToolbar = memberPage.getByTestId('interpretation-network-matrix-toolbar')
            await matrixToolbar.getByRole('button', { name: 'Add', exact: true }).click()
            const addCellDialog = memberPage.getByRole('dialog', { name: 'Add cell' })
            await expect(addCellDialog).toBeVisible()
            const addCellDescription = addCellDialog.getByRole('textbox', { name: 'Description' })
            await expectSemanticFieldControls(addCellDialog, { longTextLabels: ['Description'] })
            await addCellDialog.getByRole('textbox', { name: 'Title' }).fill('Alias CRUD child')
            const createdCellDescription =
                'Created through the canonical public alias by an authorized member.\nThe editor preserves multiline descriptions.'
            await addCellDescription.fill(createdCellDescription)
            await expect(addCellDescription).toHaveValue(createdCellDescription)
            await captureMemberRuntimeDialogViewports(memberPage, addCellDialog, testInfo, 'member-add-cell-dialog', ['Description'])
            const createCellResponsePromise = waitForSettledMutationResponse(
                memberPage,
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${scenario.applicationId}/runtime/interpretation-network/matrix/cells`,
                { label: 'Creating a Matrix cell through the canonical alias' }
            )
            await addCellDialog.getByRole('button', { name: 'Create', exact: true }).click()
            const createCellResponse = await createCellResponsePromise
            expect(createCellResponse.status()).toBe(201)
            const createdCellResponseBody = (await createCellResponse.json()) as {
                id: unknown
                item: Record<string, unknown>
            }
            expect(createdCellResponseBody.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
            const createdCellId = createdCellResponseBody.item.CellId
            if (typeof createdCellId !== 'string') {
                throw new Error('The created Matrix cell response did not include its semantic CellId')
            }
            expect(createdCellId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
            expect(createdCellId).not.toBe(createdCellResponseBody.id)
            await expect(memberPage.getByRole('button', { name: 'Cell actions: Alias CRUD child', exact: true })).toBeVisible({
                timeout: 30_000
            })
            await expectNoRuntimeLeakage(memberPage.getByRole('main'), 'Authenticated member Matrix after creating a cell')
            const persistedCreatedCell = findMatrixRowByTitle(
                await getMatrixRows(api, scenario.applicationId, runtimeIds, system.interpretationId),
                'Alias CRUD child'
            )
            expect(persistedCreatedCell.cellId, 'The Matrix row uses the semantic CellId returned by the create command').toBe(
                createdCellId
            )
            expect(readLocalizedText(persistedCreatedCell.row.CellValue)).toBe('Alias CRUD child')
            expect(readLocalizedText(persistedCreatedCell.row.CellDescription)).toBe(createdCellDescription)
            const createdCellVersion = Number(persistedCreatedCell.row._upl_version ?? 0)
            expect(createdCellVersion, 'The created cell has a durable aggregate version before editing').toBeGreaterThan(0)

            await memberPage.getByRole('button', { name: 'Cell actions: Alias CRUD child', exact: true }).click()
            await memberPage.getByRole('menuitem', { name: 'Edit', exact: true }).click()
            const editCellDialog = memberPage.getByRole('dialog', { name: 'Edit cell' })
            await expect(editCellDialog).toBeVisible()
            const editCellDescription = editCellDialog.getByRole('textbox', { name: 'Description' })
            await expectSemanticFieldControls(editCellDialog, { longTextLabels: ['Description'] })
            await editCellDialog.getByRole('textbox', { name: 'Title' }).fill('Alias CRUD edited')
            const editedCellDescription = 'Edited through the resolved application UUID.\nThe saved description remains multiline.'
            await editCellDescription.fill(editedCellDescription)
            await expect(editCellDescription).toHaveValue(editedCellDescription)
            await captureMemberRuntimeDialogViewports(memberPage, editCellDialog, testInfo, 'member-edit-cell-dialog', ['Description'])
            const editCellResponsePromise = waitForSettledMutationResponse(
                memberPage,
                (response) =>
                    response.request().method() === 'PATCH' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${scenario.applicationId}/runtime/interpretation-network/matrix/cells/${createdCellId}`,
                { label: 'Editing a Matrix cell through the canonical alias' }
            )
            await editCellDialog.getByRole('button', { name: 'Save', exact: true }).click()
            const editCellResponse = await editCellResponsePromise.catch((error: unknown) => {
                const observedMutations = memberRuntimeMutations.map(({ method, pathname }) => {
                    const safePath = pathname
                        .replace(scenario.applicationId, '{applicationId}')
                        .replace(/\/matrix\/cells\/[^/]+$/u, '/matrix/cells/{cellId}')
                    return `${method} ${safePath}`
                })
                const message = error instanceof Error ? error.message : String(error)
                throw new Error(`${message}. Observed member runtime mutations: ${observedMutations.join('; ') || 'none'}`)
            })
            expect(editCellResponse.status()).toBe(200)
            const editCellResponseBody = (await editCellResponse.json()) as { cellId?: unknown; version?: unknown }
            expect(editCellResponseBody).toEqual({ cellId: createdCellId, version: createdCellVersion + 1 })
            await expect(memberPage.getByRole('button', { name: 'Cell actions: Alias CRUD edited', exact: true })).toBeVisible({
                timeout: 30_000
            })
            const persistedEditedCell = findMatrixRowByTitle(
                await getMatrixRows(api, scenario.applicationId, runtimeIds, system.interpretationId),
                'Alias CRUD edited'
            )
            expect(readLocalizedText(persistedEditedCell.row.CellValue)).toBe('Alias CRUD edited')
            expect(readLocalizedText(persistedEditedCell.row.CellDescription)).toBe(editedCellDescription)
            expect(Number(persistedEditedCell.row._upl_version)).toBe(createdCellVersion + 1)
            await expectNoRuntimeLeakage(memberPage.getByRole('main'), 'Authenticated member Matrix after editing a cell')

            await memberPage.getByRole('button', { name: 'Cell actions: Alias CRUD edited', exact: true }).click()
            const deleteCellAction = memberPage.getByRole('menuitem', { name: 'Delete', exact: true })
            await expect(deleteCellAction, 'Application policy explicitly enables Matrix deletion for this editor').toBeEnabled()
            await deleteCellAction.click()
            const deleteCellDialog = memberPage.getByRole('dialog', { name: 'Delete cell?' })
            await expect(deleteCellDialog).toBeVisible()
            await captureMemberRuntimeDialogViewports(memberPage, deleteCellDialog, testInfo, 'member-delete-cell-dialog')
            const deleteCellResponsePromise = waitForSettledMutationResponse(
                memberPage,
                (response) =>
                    response.request().method() === 'DELETE' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${scenario.applicationId}/runtime/interpretation-network/matrix/cells/${createdCellId}`,
                { label: 'Deleting a Matrix cell through the canonical alias' }
            )
            await deleteCellDialog.getByRole('button', { name: 'Delete', exact: true }).click()
            const deleteCellResponse = await deleteCellResponsePromise
            expect(deleteCellResponse.status()).toBe(200)
            expect(await deleteCellResponse.json()).toEqual({ cellId: createdCellId, deletedMaterialCount: 0 })
            await expect(memberPage.getByRole('button', { name: 'Cell actions: Alias CRUD edited', exact: true })).toHaveCount(0)
            expect(
                (await getMatrixRows(api, scenario.applicationId, runtimeIds, system.interpretationId)).some(
                    (row) => row.CellId === createdCellId
                ),
                'Deleting a Matrix cell removes its persisted row, not just the optimistic UI item'
            ).toBe(false)
            await expectNoRuntimeLeakage(memberPage.getByRole('main'), 'Authenticated member Matrix after deleting a cell')
            const memberAccessibilityTree = await memberPage.getByRole('main').ariaSnapshot()
            expect(
                memberAccessibilityTree,
                'The authenticated member accessibility tree must not expose raw internal identifier labels'
            ).not.toMatch(
                /\b(?:(?:owner|user|assigned[\s_-]*user|created[\s_-]*by|updated[\s_-]*by|workspace|application|metahub|record|row|cell|entity|relation)[\s_-]*)?id\b/iu
            )
            expect(
                memberRuntimeRequests.every((pathname) => pathname.startsWith(`/api/v1/applications/${scenario.applicationId}/runtime`)),
                'Alias member CRUD requests must use the resolved application UUID'
            ).toBe(true)

            for (const viewport of [
                { name: 'wide-desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await memberPage.setViewportSize({ width: viewport.width, height: viewport.height })
                await expect(memberPage.getByTestId('interpretation-network-matrix-workspace')).toBeVisible()
                await expectNoPageHorizontalOverflow(memberPage, `Authenticated alias member matrix at ${viewport.width}px`)
                await attachRuntimeScreenshot(memberPage, testInfo, `interpretation-network-public-member-matrix-${viewport.name}`)
            }
            await memberPage.setViewportSize({ width: 1280, height: 900 })
        } finally {
            if (memberContext) await memberContext.close()
            if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
            await disposeApiContext(api)
        }
    })

    test('@flow application member remains read-only through canonical alias', async ({ browser, runManifest }, testInfo) => {
        const scenario = requirePublicRoleScenario()
        const ownerApi = await createLoggedInApiContext(runManifest.testUser)
        let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
        let memberContext: BrowserContext | null = null
        let memberApi: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null

        try {
            bootstrapApi = await createBootstrapApiContext()
            const runtimeIds = await resolveRuntimeIds(ownerApi, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const system = await ensureSystemStructure(ownerApi, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const rowsBeforeDeniedMutation = await getMatrixRows(ownerApi, scenario.applicationId, runtimeIds, system.interpretationId)
            const rootCell = findMatrixRowByTitle(rowsBeforeDeniedMutation, 'Universe')

            const assignableRoles = (await getAssignableRoles(bootstrapApi)) as Array<{ id?: string; codename?: string }>
            const userRole = assignableRoles.find((role) => role.codename?.toLowerCase() === 'user')
            expect(userRole?.id, 'The read-only member receives the standard global User role').toEqual(expect.any(String))
            const memberEmail = `e2e+${runManifest.runId}.interpretation-public-member@${
                process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
            }`
            const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            const createdMember = await createAdminUser(bootstrapApi, {
                email: memberEmail,
                password: memberPassword,
                roleIds: [userRole!.id!],
                comment: 'Interpretation Network public alias read-only member acceptance'
            })
            expect(createdMember?.userId).toEqual(expect.any(String))
            await recordCreatedGlobalUser({ userId: createdMember.userId, email: memberEmail })
            await addApplicationMember(ownerApi, scenario.applicationId, { email: memberEmail, role: 'member' })

            memberApi = await createLoggedInApiContext({ email: memberEmail, password: memberPassword })
            const emptySharedWorkspace = (await createApplicationWorkspace(ownerApi, scenario.applicationId, {
                name: createLocalizedContent('en', 'Read-only bootstrap guard'),
                description: createLocalizedContent('en', 'Verifies members cannot create the initial Matrix')
            })) as { id?: string }
            expect(emptySharedWorkspace.id, 'The owner creates an empty shared workspace').toEqual(expect.any(String))
            await setApplicationPublicEntryWorkspace(ownerApi, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const memberWorkspaceInvite = await sendWithCsrf(
                ownerApi,
                'POST',
                `/api/v1/applications/${scenario.applicationId}/runtime/workspaces/${emptySharedWorkspace.id}/members`,
                { email: memberEmail, roleCodename: 'member' }
            )
            expect(memberWorkspaceInvite.status, 'The read-only member receives access to the empty shared workspace').toBe(201)
            const missingSystemStructurePath = `/api/v1/applications/${
                scenario.applicationId
            }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(emptySharedWorkspace.id!)}`
            const deniedSystemStructureBootstrap = await sendWithCsrf(memberApi, 'POST', missingSystemStructurePath, { locale: 'en' })
            expect(deniedSystemStructureBootstrap.status, 'A read-only application member cannot create the initial system Matrix').toBe(
                403
            )
            expect(await deniedSystemStructureBootstrap.json()).toMatchObject({
                error: 'Insufficient permissions for this action',
                code: 'INTERPRETATION_NETWORK_PERMISSION_DENIED'
            })
            const ownerSystemStructureBootstrap = await sendWithCsrf(ownerApi, 'POST', missingSystemStructurePath, { locale: 'en' })
            expect(ownerSystemStructureBootstrap.status, 'The owner can still create the system Matrix').toBe(201)
            expect(await ownerSystemStructureBootstrap.json()).toMatchObject({ created: true })

            const readOnlyMemberRuntimeTarget = new URLSearchParams({
                workspaceId: scenario.publicEntryWorkspaceId,
                targetKind: 'object',
                entityTypeId: runtimeIds.entityTypeId,
                layoutId: runtimeIds.layoutId,
                widgetId: runtimeIds.widgetId,
                instanceKey: runtimeIds.instanceKey,
                locale: 'en',
                themeVariant: 'light'
            })
            const deniedMutation = await sendWithCsrf(
                memberApi,
                'POST',
                `/api/v1/applications/${scenario.applicationId}/runtime/interpretation-network/matrix/cells?${readOnlyMemberRuntimeTarget}`,
                {
                    interpretationId: system.interpretationId,
                    data: { CellValue: 'Read-only member mutation must be denied' },
                    placement: { parentCellId: rootCell.cellId }
                }
            )
            expect(deniedMutation.status, 'A real application member cannot mutate Matrix content').toBe(403)
            expect(await getMatrixRows(ownerApi, scenario.applicationId, runtimeIds, system.interpretationId)).toEqual(
                rowsBeforeDeniedMutation
            )
            await disposeApiContext(memberApi)
            memberApi = null

            const memberSession = await createAuthenticatedBrowserSession(browser, { email: memberEmail, password: memberPassword })
            memberContext = memberSession.context
            const memberPage = memberSession.page
            const nonGetApiRequests = watchNonGetApiRequests(memberContext, memberPage.url())
            const protectedRuntimeRequests: string[] = []
            const progressViewRequests: unknown[] = []
            const progressViewResponses: Array<Promise<{ status: number; payload: unknown }>> = []
            const progressContentPath = `/api/v1/applications/${scenario.applicationId}/runtime/progress/content`
            memberPage.on('request', (request) => {
                const url = new URL(request.url())
                if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(url.pathname)) {
                    protectedRuntimeRequests.push(`${request.method()} ${url.pathname}`)
                }
                if (request.method() === 'POST' && url.pathname === progressContentPath) {
                    progressViewRequests.push(request.postDataJSON())
                }
            })
            const ensureSystemStructurePath = `/api/v1/applications/${scenario.applicationId}/runtime/interpretation-network/system-structure/ensure`
            const ensureSystemStructureResponses: Array<Promise<{ status: number; payload: unknown }>> = []
            memberPage.on('response', (response) => {
                const url = new URL(response.url())
                if (response.request().method() === 'POST' && url.pathname === ensureSystemStructurePath) {
                    ensureSystemStructureResponses.push(
                        response.json().then((payload: unknown) => ({ status: response.status(), payload }))
                    )
                }
                if (response.request().method() === 'POST' && url.pathname === progressContentPath) {
                    progressViewResponses.push(response.json().then((payload: unknown) => ({ status: response.status(), payload })))
                }
            })
            const resolverResponsePromise = memberPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'GET' && url.pathname === `/api/v1/applications/runtime-reference/${scenario.alias}`
            })
            await memberPage.goto(`/a/${scenario.alias}?locale=en&workspaceId=${encodeURIComponent(scenario.publicEntryWorkspaceId)}`)
            expect(
                (await resolverResponsePromise).status(),
                'The non-owner member resolves the public alias through protected access'
            ).toBe(200)
            await openStructures(memberPage)
            await expect.poll(() => ensureSystemStructureResponses.length).toBeGreaterThan(0)
            await expectSingleSystemMatrix(memberPage)
            const structurePane = memberPage.getByTestId('interpretation-network-structure-pane')
            const detailsPane = memberPage.getByTestId('interpretation-network-details-pane')
            await expect(structurePane.getByRole('button', { name: 'Save as template' })).toHaveCount(0)
            await expect(detailsPane.getByRole('button', { name: 'Create' })).toHaveCount(0)
            await expect(
                memberPage.getByRole('button', { name: /^Cell actions:/u }),
                'The canonical public runtime omits cell action controls for read-only members'
            ).toHaveCount(0)
            await expect(memberPage.getByRole('button', { name: /^Material actions:/u })).toHaveCount(0)
            await expectNoRuntimeLeakage(memberPage.getByRole('main'), 'Read-only application member through canonical alias')

            for (const viewport of [
                { name: 'wide-desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await memberPage.setViewportSize({ width: viewport.width, height: viewport.height })
                await expect(memberPage.getByTestId('interpretation-network-matrix-workspace')).toBeVisible()
                await expectNoPageHorizontalOverflow(memberPage, `Read-only alias member Matrix at ${viewport.width}px`)
                await attachRuntimeScreenshot(memberPage, testInfo, `interpretation-network-public-member-read-only-${viewport.name}`)
            }
            expect(
                protectedRuntimeRequests.length,
                'The authenticated member alias flow uses protected application runtime endpoints'
            ).toBeGreaterThan(0)
            expect(
                protectedRuntimeRequests.every(
                    (request) =>
                        request.startsWith(`GET /api/v1/applications/${scenario.applicationId}/runtime`) ||
                        request === `POST ${ensureSystemStructurePath}` ||
                        request === `POST ${progressContentPath}`
                )
            ).toBe(true)
            const protectedPostRequests = protectedRuntimeRequests.filter((request) => request.startsWith('POST '))
            const ensurePostRequests = protectedPostRequests.filter((request) => request === `POST ${ensureSystemStructurePath}`)
            expect(ensurePostRequests, 'The member app performs at least one system Matrix check').not.toHaveLength(0)
            expect(
                protectedPostRequests.every(
                    (request) => request === `POST ${ensureSystemStructurePath}` || request === `POST ${progressContentPath}`
                ),
                'Read-only browsing only calls the idempotent system Matrix check and its view-progress endpoint'
            ).toBe(true)
            await expect
                .poll(() => ensureSystemStructureResponses.length, {
                    timeout: 30_000,
                    message: 'Every observed system Matrix check receives its response before it is inspected'
                })
                .toBe(ensurePostRequests.length)
            const ensureResponses = await Promise.all(ensureSystemStructureResponses)
            expect(ensureResponses.every(({ status }) => status === 200)).toBe(true)
            expect(
                ensureResponses.every(({ payload }) => {
                    const result = payload as { created?: boolean; canCreate?: boolean }
                    return result.created === false && result.canCreate === false
                }),
                'Every idempotent system Matrix check remains read-only'
            ).toBe(true)
            expect(ensureResponses).toHaveLength(ensurePostRequests.length)
            expect(progressViewRequests, 'The runtime reports viewing, not completion, for intro content').toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        targetObjectCodename: 'InterpretationNetworkIntro',
                        action: 'view'
                    })
                ])
            )
            expect(
                progressViewRequests.every((payload) => {
                    const progress = payload as { targetObjectCodename?: string; targetRecordId?: string; action?: string }
                    return (
                        progress.targetObjectCodename === 'InterpretationNetworkIntro' &&
                        typeof progress.targetRecordId === 'string' &&
                        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(progress.targetRecordId) &&
                        progress.action === 'view'
                    )
                }),
                'View tracking is limited to the rendered intro record and cannot mark content complete'
            ).toBe(true)
            await expect
                .poll(() => progressViewResponses.length, {
                    timeout: 30_000,
                    message: 'Every view-progress request receives a response before its persistence result is inspected'
                })
                .toBe(progressViewRequests.length)
            const progressResponses = await Promise.all(progressViewResponses)
            expect(progressResponses.every(({ status }) => status === 200)).toBe(true)
            expect(
                progressResponses.every(({ payload }, index) => {
                    const progress = payload as {
                        persisted?: boolean
                        reason?: string
                        targetObjectCodename?: string
                        targetRecordId?: string
                    }
                    const request = progressViewRequests[index] as {
                        targetObjectCodename?: string
                        targetRecordId?: string
                        action?: string
                    }
                    return (
                        (progress.persisted === false && progress.reason === 'progress_store_unavailable') ||
                        (progress.persisted === true &&
                            progress.targetObjectCodename === 'InterpretationNetworkIntro' &&
                            progress.targetObjectCodename === request.targetObjectCodename &&
                            progress.targetRecordId === request.targetRecordId &&
                            request.action === 'view')
                    )
                }),
                'View tracking either stays unpersisted when no progress store exists or is scoped to the viewed record'
            ).toBe(true)
            expect(
                nonGetApiRequests.every(
                    (request) => request === `POST ${ensureSystemStructurePath}` || request === `POST ${progressContentPath}`
                ),
                'Read-only member browsing issues no same-origin Matrix, material, or template mutations'
            ).toBe(true)
        } finally {
            if (memberContext) await memberContext.close()
            if (memberApi) await disposeApiContext(memberApi)
            if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
            await disposeApiContext(ownerApi)
        }
    })

    test('@flow authenticated non-member receives public read-only access only', async ({ browser, runManifest }, testInfo) => {
        const scenario = requirePublicRoleScenario()
        const api = await createLoggedInApiContext(runManifest.testUser)
        let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null

        try {
            bootstrapApi = await createBootstrapApiContext()
            const activeBootstrapApi = bootstrapApi
            const runtimeIds = await resolveRuntimeIds(api, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const system = await ensureSystemStructure(api, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const rootCellRecord = findMatrixRowByTitle(
                await getMatrixRows(api, scenario.applicationId, runtimeIds, system.interpretationId),
                'Universe'
            )
            const assignableRoles = (await getAssignableRoles(activeBootstrapApi)) as Array<{ id?: string; codename?: string }>
            const userRole = assignableRoles.find((role) => role.codename?.toLowerCase() === 'user')
            expect(userRole?.id, 'The non-member account receives only the normal global User role').toEqual(expect.any(String))
            const nonMemberEmail = `e2e+${runManifest.runId}.interpretation-public-nonmember@${
                process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
            }`
            const nonMemberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            const createdNonMember = await createAdminUser(activeBootstrapApi, {
                email: nonMemberEmail,
                password: nonMemberPassword,
                roleIds: [userRole!.id!],
                comment: 'Interpretation Network public runtime authorization acceptance'
            })
            expect(createdNonMember?.userId).toEqual(expect.any(String))
            await recordCreatedGlobalUser({ userId: createdNonMember.userId, email: nonMemberEmail })

            const nonMemberMutationApi = await createLoggedInApiContext({ email: nonMemberEmail, password: nonMemberPassword })
            try {
                const matrixBeforeDeniedMutation = await getMatrixRows(api, scenario.applicationId, runtimeIds, system.interpretationId)
                expect(findMatrixRowByTitle(matrixBeforeDeniedMutation, 'Universe').cellId).toBe(rootCellRecord.cellId)
                const nonMemberRuntimeTarget = new URLSearchParams({
                    workspaceId: scenario.publicEntryWorkspaceId,
                    targetKind: 'object',
                    entityTypeId: runtimeIds.entityTypeId,
                    layoutId: runtimeIds.layoutId,
                    widgetId: runtimeIds.widgetId,
                    instanceKey: runtimeIds.instanceKey,
                    locale: 'en',
                    themeVariant: 'light'
                })
                const deniedMutation = await sendWithCsrf(
                    nonMemberMutationApi,
                    'POST',
                    `/api/v1/applications/${scenario.applicationId}/runtime/interpretation-network/matrix/cells?${nonMemberRuntimeTarget}`,
                    {
                        interpretationId: system.interpretationId,
                        data: { CellValue: 'Non-member mutation must be denied' },
                        placement: { parentCellId: rootCellRecord.cellId }
                    }
                )
                expect(
                    deniedMutation.status,
                    'An authenticated non-member cannot bypass the public viewer through a protected endpoint'
                ).toBe(403)
                expect(await getMatrixRows(api, scenario.applicationId, runtimeIds, system.interpretationId)).toEqual(
                    matrixBeforeDeniedMutation
                )
            } finally {
                await disposeApiContext(nonMemberMutationApi)
            }

            const nonMemberSession = await createAuthenticatedBrowserSession(browser, {
                email: nonMemberEmail,
                password: nonMemberPassword
            })
            try {
                const publicRuntimeServerErrors = watchPublicRuntimeServerErrors(nonMemberSession.context)
                const nonGetApiRequests = watchNonGetApiRequests(nonMemberSession.context, nonMemberSession.page.url())
                const protectedRuntimeRequests: string[] = []
                const nonMemberPublicRuntimeRequests: string[] = []
                nonMemberSession.page.on('request', (request) => {
                    const url = new URL(request.url())
                    if (PUBLIC_RUNTIME_PATH_PATTERN.test(url.pathname)) {
                        nonMemberPublicRuntimeRequests.push(`${request.method()} ${url.pathname}`)
                    }
                    if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(url.pathname)) {
                        protectedRuntimeRequests.push(`${request.method()} ${url.pathname}`)
                    }
                })
                const deniedResolverPromise = nonMemberSession.page.waitForResponse((response) => {
                    const url = new URL(response.url())
                    return (
                        response.request().method() === 'GET' && url.pathname === `/api/v1/applications/runtime-reference/${scenario.alias}`
                    )
                })
                const publicBootstrapPromise = nonMemberSession.page.waitForResponse((response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'GET' && url.pathname === `/api/v1/public/applications/${scenario.alias}/runtime`
                })
                const initialPublicMaterialsResponsePromise = waitForPublicMaterialsResponse(nonMemberSession.page)
                await nonMemberSession.page.goto(`/a/${scenario.alias}?targetKind=object&entityTypeCodename=Structure&locale=en`)
                const deniedResolver = await deniedResolverPromise
                expect(deniedResolver.status(), 'An authenticated non-member receives the non-enumerating denial').toBe(404)
                expect(await deniedResolver.json()).toEqual({ error: 'Application not found' })
                expect((await publicBootstrapPromise).status(), 'The non-member can load the public bootstrap').toBe(200)
                await expectPublicDashboardShell(nonMemberSession.page)
                await expect(nonMemberSession.page.getByTestId('runtime-workspace-switcher')).toHaveCount(0)
                await expect(
                    nonMemberSession.page.getByRole('main').getByRole('button', {
                        name: /Create|Add|Edit|Delete|Save as template|Favorite|Post|Run action|Создать|Добавить|Изменить|Удалить|Сохранить в шаблон|Избранное/iu
                    })
                ).toHaveCount(0)
                await expect(
                    nonMemberSession.page.getByRole('main').getByRole('button', { name: /^(?:Cell actions:|Material actions:)/u })
                ).toHaveCount(0)
                await expectNoRuntimeLeakage(
                    nonMemberSession.page.getByRole('main'),
                    'Authenticated non-member public Interpretation Network viewer'
                )
                const { matrix: nonMemberMatrix, materialsResponse: nonMemberPrimaryMaterialResponse } = await openPublicSystemMatrix(
                    nonMemberSession.page
                )
                await expectPublicMatrixReadOnly(nonMemberSession.page, nonMemberMatrix)
                await expectNoRuntimeLeakage(
                    nonMemberSession.page.getByRole('main'),
                    'Authenticated non-member public Interpretation Network matrix'
                )
                await attachReadOnlyMatrixViewportEvidence(nonMemberSession.page, testInfo, 'interpretation-network-public-nonmember')
                await expect(nonMemberMatrix).toBeVisible()
                const primaryMaterialResponse = nonMemberPrimaryMaterialResponse ?? (await initialPublicMaterialsResponsePromise)
                if (!primaryMaterialResponse) {
                    throw new Error('The public Matrix did not load materials while opening its selected root cell')
                }
                expect(primaryMaterialResponse.status()).toBe(200)
                const nonMemberMaterialsPayload = (await primaryMaterialResponse.json()) as {
                    items?: Array<{ title?: string; isPrimary?: boolean }>
                }
                expect(nonMemberMaterialsPayload.items?.[0]).toMatchObject({
                    title: 'Public primary material',
                    isPrimary: true
                })
                await expect(nonMemberSession.page.getByRole('heading', { name: 'Public primary material', exact: true })).toHaveCount(1)
                await expect(
                    nonMemberSession.page.getByText('This material opens first in the anonymous read-only view.', { exact: true })
                ).toBeVisible()
                await expectNoRuntimeLeakage(nonMemberSession.page.getByRole('main'), 'Authenticated non-member primary Material detail')
                await expect(
                    nonMemberSession.page.getByRole('main').getByRole('button', { name: /^(?:Cell actions:|Material actions:)/u })
                ).toHaveCount(0)
                await expect(nonMemberSession.page.getByRole('main').getByRole('textbox')).toHaveCount(0)
                expect(protectedRuntimeRequests).toEqual([])
                expect(nonMemberPublicRuntimeRequests.some((request) => request.startsWith('GET '))).toBe(true)
                expect(
                    nonGetApiRequests,
                    'Authenticated non-member public browsing must issue no same-origin non-GET API requests'
                ).toEqual([])
                expect(
                    publicRuntimeServerErrors,
                    'Authenticated non-member public runtime responses must not contain 5xx statuses'
                ).toEqual([])
            } finally {
                await nonMemberSession.context.close()
            }
        } finally {
            if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
            await disposeApiContext(api)
        }
    })

    test('@flow public alias routing, UUID routing, and revocation', async ({ browser, runManifest }, testInfo) => {
        const scenario = requirePublicRoleScenario()
        const api = await createLoggedInApiContext(runManifest.testUser)
        let anonymousContext: BrowserContext | null = null
        let anonymousPublicRequest: APIRequestContext | null = null

        try {
            const runtimeIds = await resolveRuntimeIds(api, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const system = await ensureSystemStructure(api, scenario.applicationId, scenario.publicEntryWorkspaceId)
            const rootCell = findMatrixRowByTitle(
                await getMatrixRows(api, scenario.applicationId, runtimeIds, system.interpretationId),
                'Universe'
            )
            expect(rootCell.cellId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
            const anonymousSession = await createAnonymousBrowserContext(browser, testInfo)
            anonymousContext = anonymousSession.context
            const publicRuntimeServerErrors = watchPublicRuntimeServerErrors(anonymousContext)
            const baseURL = anonymousSession.baseURL
            anonymousPublicRequest = await playwrightRequest.newContext({ storageState: { cookies: [], origins: [] } })
            const nonGetApiRequests = watchNonGetApiRequests(anonymousContext, baseURL)
            const authenticatedRuntimeRequests: string[] = []
            anonymousContext.on('request', (request) => {
                const url = new URL(request.url())
                if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(url.pathname)) {
                    authenticatedRuntimeRequests.push(`${request.method()} ${url.pathname}`)
                }
            })
            const uuidPage = await anonymousContext.newPage()
            const uuidSuffix = '/campaign/overview'
            const uuidSearch = '?locale=en&step=uuid&targetKind=object&entityTypeCodename=Structure'
            const uuidHash = '#selected-structure'
            const uuidDashboardResponsePromise = uuidPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname === `/api/v1/public/applications/${scenario.applicationId}/runtime`
                )
            })
            await uuidPage.goto(`/a/${scenario.applicationId}${uuidSuffix}${uuidSearch}${uuidHash}`)
            expect((await uuidDashboardResponsePromise).status(), 'The application UUID resolves anonymously under canonical routing').toBe(
                200
            )
            await expectPublicDashboardShell(uuidPage)
            await expect(uuidPage.getByTestId('runtime-workspace-switcher')).toHaveCount(0)
            await expect(
                uuidPage.getByRole('main').getByRole('button', {
                    name: /^(?:Create|Save|Add|Edit|Delete|Settings|Access|Favorites|Post|Run action|Создать|Сохранить|Добавить|Редактировать|Удалить|Настройки|Доступ|Избранное)\b/iu
                })
            ).toHaveCount(0)
            await expect(uuidPage.getByRole('main').getByRole('button', { name: /^(?:Cell actions:|Material actions:)/u })).toHaveCount(0)
            await expectNoRuntimeLeakage(uuidPage.getByRole('main'), 'Anonymous UUID Interpretation Network runtime')
            await expectNoPageHorizontalOverflow(uuidPage, 'Anonymous UUID Interpretation Network runtime')
            await expect
                .poll(() => {
                    const currentUrl = new URL(uuidPage.url())
                    return currentUrl.pathname + currentUrl.search + currentUrl.hash
                })
                .toBe(`/a/${scenario.applicationId}${uuidSuffix}${uuidSearch}${uuidHash}`)
            const { matrix: uuidMatrix } = await openPublicSystemMatrix(uuidPage)
            await expectPublicMatrixReadOnly(uuidPage, uuidMatrix)
            await expectNoRuntimeLeakage(uuidPage.getByRole('main'), 'Anonymous UUID Interpretation Network matrix')
            await attachReadOnlyMatrixViewportEvidence(uuidPage, testInfo, 'interpretation-network-public-uuid')
            await expect(uuidMatrix).toBeVisible()

            const canonicalPage = await anonymousContext.newPage()
            const suffix = '/campaign/overview'
            const search = '?locale=ru&step=secondary-canonical&targetKind=object&entityTypeCodename=Structure'
            const hash = '#primary-material'
            const secondaryDashboardResponsePromise = canonicalPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname === `/api/v1/public/applications/${scenario.secondaryAlias}/runtime`
                )
            })
            const russianStructuresResponsePromise = canonicalPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname.includes('/runtime/widgets/') &&
                    url.pathname.endsWith('/interpretation-network') &&
                    url.searchParams.get('view') === 'structures' &&
                    url.searchParams.get('locale') === 'ru'
                )
            })
            await canonicalPage.goto(`/a/${scenario.secondaryAlias}${suffix}${search}${hash}`)
            expect((await secondaryDashboardResponsePromise).status(), 'The secondary alias resolves through the public runtime').toBe(200)
            expect((await russianStructuresResponsePromise).status(), 'The redirected Russian IN view uses the public read endpoint').toBe(
                200
            )
            await expectPublicDashboardShell(canonicalPage)
            await expect
                .poll(
                    () => {
                        const currentUrl = new URL(canonicalPage.url())
                        return currentUrl.pathname + currentUrl.search + currentUrl.hash
                    },
                    { timeout: 30_000 }
                )
                .toBe(`/a/${scenario.alias}${suffix}${search}${hash}`)
            await expect(canonicalPage.getByTestId('runtime-workspace-switcher')).toHaveCount(0)
            await expect(
                canonicalPage.getByRole('main').getByRole('button', {
                    name: /Create|Save as template|Add material|Создать|Сохранить в шаблон|Добавить материал/iu
                })
            ).toHaveCount(0)
            await expectNoRuntimeLeakage(canonicalPage.getByRole('main'), 'Anonymous canonical Russian Interpretation Network runtime')
            await expectNoPageHorizontalOverflow(canonicalPage, 'Anonymous canonical Russian Interpretation Network runtime')
            const { matrix: russianMatrix } = await openPublicSystemMatrix(canonicalPage)
            await expectPublicMatrixReadOnly(canonicalPage, russianMatrix)
            await expectNoRuntimeLeakage(canonicalPage.getByRole('main'), 'Anonymous canonical Russian Interpretation Network matrix')
            expect(nonGetApiRequests, 'Anonymous UUID and alias routes must issue no same-origin non-GET API requests').toEqual([])
            expect(authenticatedRuntimeRequests).toEqual([])
            expect(new URL(canonicalPage.url()).origin).toBe(new URL(baseURL).origin)
            expect(await anonymousContext.cookies()).toEqual([])

            const withdrawResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${scenario.applicationId}`, { isPublic: false })
            expect(withdrawResponse.ok, 'The application owner can withdraw anonymous access').toBe(true)
            const withdrawnAnonymousRead = await anonymousPublicRequest.get(
                new URL(`/api/v1/public/applications/${scenario.applicationId}/runtime`, baseURL).toString(),
                { headers: { Accept: 'application/json' } }
            )
            expect(withdrawnAnonymousRead.status(), 'Anonymous runtime data must be unavailable after public access is withdrawn').toBe(404)
            const withdrawnAnonymousBody = await withdrawnAnonymousRead.text()
            expect(withdrawnAnonymousBody).not.toContain(scenario.applicationId)
            for (const unavailableReference of ['not-a-public-application', scenario.alias, scenario.secondaryAlias]) {
                const unavailableAnonymousRead = await anonymousPublicRequest.get(
                    new URL(`/api/v1/public/applications/${unavailableReference}/runtime`, baseURL).toString(),
                    { headers: { Accept: 'application/json' } }
                )
                expect(unavailableAnonymousRead.status(), 'Unavailable public references must return the same status').toBe(404)
                expect(await unavailableAnonymousRead.text(), 'Unavailable public references must not be distinguishable').toBe(
                    withdrawnAnonymousBody
                )
            }

            const closedPage = await anonymousContext.newPage()
            const closedResponsePromise = closedPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname === `/api/v1/public/applications/${scenario.applicationId}/runtime`
                )
            })
            await closedPage.goto(`/a/${scenario.applicationId}?locale=en`)
            expect((await closedResponsePromise).status(), 'The UI availability probe must hide a withdrawn public application').toBe(204)
            await expectLoginScreenForUnavailablePublicReference(closedPage, 'Withdrawn public application')
            const unknownPage = await anonymousContext.newPage()
            const unknownResponsePromise = unknownPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' && url.pathname === '/api/v1/public/applications/not-a-public-application/runtime'
                )
            })
            await unknownPage.goto('/a/not-a-public-application?locale=en')
            expect((await unknownResponsePromise).status()).toBe(204)
            await expectLoginScreenForUnavailablePublicReference(unknownPage, 'Unknown public application reference')

            for (const withdrawnAlias of [scenario.alias, scenario.secondaryAlias]) {
                const withdrawnAliasPage = await anonymousContext.newPage()
                const withdrawnAliasResponsePromise = withdrawnAliasPage.waitForResponse((response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'GET' && url.pathname === `/api/v1/public/applications/${withdrawnAlias}/runtime`
                })
                await withdrawnAliasPage.goto(`/a/${withdrawnAlias}?locale=en`)
                expect(
                    (await withdrawnAliasResponsePromise).status(),
                    'Previously valid aliases must stop resolving when anonymous access is withdrawn'
                ).toBe(204)
                await expectLoginScreenForUnavailablePublicReference(withdrawnAliasPage, `Withdrawn public alias ${withdrawnAlias}`)
                await withdrawnAliasPage.close()
            }
            expect(
                publicRuntimeServerErrors,
                'Anonymous alias routing and revocation runtime responses must not contain 5xx statuses'
            ).toEqual([])
        } finally {
            if (anonymousContext) await anonymousContext.close()
            if (anonymousPublicRequest) await anonymousPublicRequest.dispose()
            await disposeApiContext(api)
        }
    })
})
