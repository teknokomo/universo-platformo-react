import { expect, test } from '../../fixtures/test'
import { createLocalizedContent } from '@universo-react/utils'
import {
    addApplicationMember,
    createApplicationWorkspace,
    createAdminUser,
    createLoggedInApiContext,
    disposeApiContext,
    getApplicationRuntime,
    getAssignableRoles,
    getRuntimeAppData,
    listApplicationMembers,
    listApplicationWorkspaces,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedApplication, recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    expectSingleSystemMatrix,
    findMatrixRowByTitle,
    getMatrixRows,
    type InterpretationNetworkApi,
    listTemplates,
    getTemplateDetail,
    getTemplateMatrixRows,
    readLocalizedText,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig,
    toMatrixRowSnapshot,
    uuidV7Pattern
} from '../../support/interpretationNetworkFocused'
import { createLoggedInBrowserContext } from '../../support/browser/auth'

const resolveRoleIds = (roles: Array<{ id?: string; codename?: string }>, codenames: string[]): string[] => {
    const byCodename = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    return codenames.map((codename) => {
        const id = byCodename.get(codename.toLowerCase())
        if (!id) throw new Error(`Missing role ${codename}`)
        return id
    })
}

const waitForUser = async (credentials: { email: string; password: string }): Promise<void> => {
    await expect
        .poll(async () => {
            try {
                const api = await createLoggedInApiContext(credentials)
                await disposeApiContext(api)
                return true
            } catch {
                return false
            }
        })
        .toBe(true)
}

test.describe('Interpretation Network role boundaries @flow @permission @interpretation-network-focused', () => {
    test('allows owner and editor Matrix creation, keeps members read-only, and rejects guessed IDs directly', async ({
        browser,
        runManifest
    }) => {
        test.setTimeout(240_000)
        const ownerApi = await createLoggedInApiContext(runManifest.testUser)
        const bootstrapApi = await createBootstrapApiContext()
        let ownerSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
        let memberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
        let editorSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
        let memberApi: InterpretationNetworkApi | null = null
        let editorApi: InterpretationNetworkApi | null = null
        let memberMutationApi: InterpretationNetworkApi | null = null

        try {
            const imported = await importInterpretationNetworkSnapshot(ownerApi, {
                snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
                label: `permissions-${runManifest.runId}`
            })
            await recordCreatedMetahub({
                id: imported.metahub.id,
                name: 'Interpretation Network permissions focused flow',
                codename: `interpretation-network-permissions-${runManifest.runId}`
            })
            await recordCreatedApplication({ id: imported.applicationId })
            const runtimeIds = await resolveRuntimeIds(ownerApi, imported.applicationId)
            await setInterpretationNetworkWidgetConfig(ownerApi, imported.applicationId, { structureMode: 'singleSystem' })
            const assignableRoles = await getAssignableRoles(bootstrapApi)
            const roleIds = resolveRoleIds(assignableRoles, ['User'])
            const memberEmail = `e2e+${runManifest.runId}.interpretation-member@example.test`
            const editorEmail = `e2e+${runManifest.runId}.interpretation-editor@example.test`
            const password = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            const member = await createAdminUser(bootstrapApi, { email: memberEmail, password, roleIds, comment: 'focused member' })
            const editor = await createAdminUser(bootstrapApi, { email: editorEmail, password, roleIds, comment: 'focused editor' })
            if (!member?.userId || !editor?.userId) throw new Error('Role fixture users were not created')
            await recordCreatedGlobalUser({ userId: member.userId, email: memberEmail })
            await recordCreatedGlobalUser({ userId: editor.userId, email: editorEmail })
            await waitForUser({ email: memberEmail, password })
            await waitForUser({ email: editorEmail, password })
            await addApplicationMember(ownerApi, imported.applicationId, { email: memberEmail, role: 'member' })
            await addApplicationMember(ownerApi, imported.applicationId, { email: editorEmail, role: 'editor' })

            const sharedWorkspaceName = `Permission boundary workspace ${runManifest.runId}`
            const sharedWorkspace = (await createApplicationWorkspace(ownerApi, imported.applicationId, {
                name: createLocalizedContent('en', sharedWorkspaceName)
            })) as { id?: string }
            expect(sharedWorkspace.id).toMatch(uuidV7Pattern)
            const sharedWorkspaceId = sharedWorkspace.id!
            for (const email of [memberEmail, editorEmail]) {
                const invite = await sendWithCsrf(
                    ownerApi,
                    'POST',
                    `/api/v1/applications/${imported.applicationId}/runtime/workspaces/${sharedWorkspaceId}/members`,
                    { email, roleCodename: 'member' }
                )
                expect(invite.status).toBe(201)
            }
            const sharedRuntimeIds = await resolveRuntimeIds(ownerApi, imported.applicationId, sharedWorkspaceId)
            const sharedBootstrapResponse = await sendWithCsrf(
                ownerApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(sharedWorkspaceId)}`,
                { locale: 'en' }
            )
            expect([200, 201]).toContain(sharedBootstrapResponse.status)
            const sharedBootstrap = (await sharedBootstrapResponse.json()) as {
                structureId?: string
                interpretationId?: string
                rootCellId?: string
            }
            expect(sharedBootstrap.structureId).toMatch(uuidV7Pattern)
            expect(sharedBootstrap.interpretationId).toMatch(uuidV7Pattern)
            expect(sharedBootstrap.rootCellId).toMatch(uuidV7Pattern)

            const readSharedAggregateSnapshot = async () => {
                const [structures, interpretations, matrixRows] = await Promise.all([
                    getRuntimeAppData(ownerApi, imported.applicationId, {
                        objectCollectionCodename: 'Structure',
                        workspaceId: sharedWorkspaceId,
                        locale: 'en',
                        limit: 100,
                        offset: 0
                    }),
                    getRuntimeAppData(ownerApi, imported.applicationId, {
                        objectCollectionCodename: 'Interpretation',
                        workspaceId: sharedWorkspaceId,
                        locale: 'en',
                        limit: 100,
                        offset: 0
                    }),
                    getMatrixRows(ownerApi, imported.applicationId, sharedRuntimeIds, sharedBootstrap.interpretationId!)
                ])
                const rowIds = (data: unknown) =>
                    ((data as { rows?: Array<{ id?: unknown }> }).rows ?? [])
                        .map((row) => {
                            expect(row.id).toEqual(expect.any(String))
                            return String(row.id)
                        })
                        .sort()
                const cells = matrixRows
                    .map(toMatrixRowSnapshot)
                    .map(({ rowId, cellId, parentCellId }) => ({ rowId, cellId, parentCellId }))
                    .sort((left, right) => left.rowId.localeCompare(right.rowId))
                const structureIds = rowIds(structures)
                const interpretationIds = rowIds(interpretations)

                expect(structureIds.filter((id) => id === sharedBootstrap.structureId)).toHaveLength(1)
                expect(interpretationIds.filter((id) => id === sharedBootstrap.interpretationId)).toHaveLength(1)
                expect(cells.filter((cell) => cell.cellId === sharedBootstrap.rootCellId)).toHaveLength(1)
                expect(structureIds).toEqual([sharedBootstrap.structureId])
                expect(interpretationIds).toEqual([sharedBootstrap.interpretationId])
                expect(new Set(cells.map((cell) => cell.cellId)).size).toBe(cells.length)

                return { structureIds, interpretationIds, cells }
            }
            let initialSharedAggregate = await readSharedAggregateSnapshot()
            expect(initialSharedAggregate.cells).toHaveLength(1)

            const ownerRuntime = (await getApplicationRuntime(ownerApi, imported.applicationId)) as {
                permissions?: Record<string, boolean>
            }
            expect(ownerRuntime.permissions?.createContent).toBe(true)

            const ownerSystemStructure = await sendWithCsrf(
                ownerApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(sharedWorkspaceId)}`,
                { locale: 'en' }
            )
            expect(ownerSystemStructure.status).toBe(200)
            const ownerSystemStructureResult = (await ownerSystemStructure.json()) as {
                structureId?: string
                interpretationId?: string
                rootCellId?: string
                created?: boolean
            }
            expect(ownerSystemStructureResult).toMatchObject({
                structureId: sharedBootstrap.structureId,
                interpretationId: sharedBootstrap.interpretationId,
                rootCellId: sharedBootstrap.rootCellId,
                created: false
            })
            expect(await readSharedAggregateSnapshot()).toEqual(initialSharedAggregate)

            ownerSession = await createLoggedInBrowserContext(browser, runManifest.testUser)
            await ownerSession.page.goto(`/a/${imported.applicationId}?locale=en&workspaceId=${encodeURIComponent(sharedWorkspaceId)}`)
            await expect(ownerSession.page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')).toBeVisible({
                timeout: 30_000
            })
            await ownerSession.page
                .getByRole('navigation')
                .filter({ hasText: 'Structures' })
                .first()
                .getByRole('link', { name: 'Structures' })
                .click()
            await expectSingleSystemMatrix(ownerSession.page)
            const ownerSideMenu = ownerSession.page.getByTestId('runtime-side-menu-docked')
            await expect(ownerSideMenu.getByRole('link', { name: 'Workspaces', exact: true })).toHaveCount(0)
            const workspaceSwitcher = ownerSideMenu.getByTestId('runtime-workspace-switcher')
            await workspaceSwitcher.getByRole('combobox', { name: 'Switch workspace' }).click()
            await expect(ownerSession.page.getByRole('option', { name: /Manage workspaces/u })).toBeVisible()
            await ownerSession.page.keyboard.press('Escape')
            const structureTabList = ownerSession.page.getByRole('tablist', { name: 'Workspace sections', exact: true })
            await expect(structureTabList.getByRole('tab')).toHaveText(['Matrix', 'Favorites', 'Templates'])
            await expect(ownerSession.page.getByRole('tablist', { name: 'Structure list sections' })).toHaveCount(0)
            const ownerMatrix = ownerSession.page.getByTestId('interpretation-network-matrix-workspace')
            await ownerMatrix.getByRole('button').filter({ hasText: 'Universe' }).first().click()
            await ownerMatrix.getByRole('button', { name: 'Add', exact: true }).click()
            const ownerAddCellDialog = ownerSession.page.getByRole('dialog', { name: 'Add cell' })
            await expect(ownerAddCellDialog).toBeVisible()
            const ownerCellTitle = `Owner-created Matrix cell ${runManifest.runId}`
            const ownerCellDescription = 'Created by the application owner.'
            await ownerAddCellDialog.getByRole('textbox', { name: 'Title', exact: true }).fill(ownerCellTitle)
            await ownerAddCellDialog.getByRole('textbox', { name: 'Description', exact: true }).fill(ownerCellDescription)
            const ownerCellCreateResponsePromise = waitForSettledMutationResponse(
                ownerSession.page,
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/matrix/cells`,
                { label: 'Creating a Matrix cell through the owner runtime UI' }
            )
            await ownerAddCellDialog.getByRole('button', { name: 'Create', exact: true }).click()
            const ownerCellCreateResponse = await ownerCellCreateResponsePromise
            expect(ownerCellCreateResponse.status(), 'An application owner can create a Matrix cell from the runtime UI').toBe(201)
            const ownerCellCreateResult = (await ownerCellCreateResponse.json()) as {
                id?: string
                status?: string
                item?: { CellId?: string }
            }
            expect(ownerCellCreateResult.id).toMatch(uuidV7Pattern)
            expect(ownerCellCreateResult.item?.CellId).toMatch(uuidV7Pattern)
            expect(ownerCellCreateResult.item?.CellId).not.toBe(ownerCellCreateResult.id)
            await expect(ownerAddCellDialog).toHaveCount(0)
            await expect(ownerMatrix.getByRole('button').filter({ hasText: ownerCellTitle })).toBeVisible({ timeout: 30_000 })
            const persistedOwnerCellRows = (
                await getMatrixRows(ownerApi, imported.applicationId, sharedRuntimeIds, sharedBootstrap.interpretationId!)
            ).filter((row) => readLocalizedText(row.CellValue) === ownerCellTitle)
            expect(persistedOwnerCellRows).toHaveLength(1)
            expect(toMatrixRowSnapshot(persistedOwnerCellRows[0])).toMatchObject({
                rowId: ownerCellCreateResult.id,
                cellId: ownerCellCreateResult.item?.CellId,
                parentCellId: sharedBootstrap.rootCellId
            })
            expect(readLocalizedText(persistedOwnerCellRows[0].CellValue)).toBe(ownerCellTitle)
            expect(readLocalizedText(persistedOwnerCellRows[0].CellDescription)).toBe(ownerCellDescription)
            expect(Number(persistedOwnerCellRows[0]._upl_version ?? 0)).toBeGreaterThan(0)
            await ownerSession.context.close()
            ownerSession = null
            initialSharedAggregate = await readSharedAggregateSnapshot()

            memberSession = await createLoggedInBrowserContext(browser, { email: memberEmail, password })
            await memberSession.page.goto(`/a/${imported.applicationId}?locale=en&workspaceId=${encodeURIComponent(sharedWorkspaceId)}`)
            await expect(memberSession.page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')).toBeVisible({
                timeout: 30_000
            })
            await expect.poll(() => new URL(memberSession!.page.url()).pathname).toBe(`/a/${imported.applicationId}`)
            await expect.poll(() => new URL(memberSession!.page.url()).searchParams.get('workspaceId')).toBe(sharedWorkspaceId)
            await expect(
                memberSession.page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')
            ).toContainText(sharedWorkspaceName)
            await memberSession.page
                .getByRole('navigation')
                .filter({ hasText: 'Structures' })
                .first()
                .getByRole('link', { name: 'Structures' })
                .click()
            await expectSingleSystemMatrix(memberSession.page)
            await expect(
                memberSession.page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Save as template' })
            ).toHaveCount(0)
            await expect(
                memberSession.page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })
            ).toHaveCount(0)
            const memberMatrix = memberSession.page.getByTestId('interpretation-network-matrix-workspace')
            await expect(memberMatrix.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0)
            await expect(memberMatrix.getByRole('button', { name: /^Cell actions:/u })).toHaveCount(0)
            memberApi = await createLoggedInApiContext({ email: memberEmail, password })
            const memberRuntimeIds = await resolveRuntimeIds(memberApi, imported.applicationId, sharedWorkspaceId)
            const bootstrapResponse = await sendWithCsrf(
                memberApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(memberRuntimeIds.workspaceId)}`,
                { locale: 'en' }
            )
            expect(bootstrapResponse.status).toBe(200)
            const bootstrapped = (await bootstrapResponse.json()) as {
                structureId?: string
                interpretationId?: string
                rootCellId?: string
                created?: boolean
                canCreate?: boolean
            }
            expect(bootstrapped).toMatchObject({
                structureId: sharedBootstrap.structureId,
                interpretationId: sharedBootstrap.interpretationId,
                rootCellId: sharedBootstrap.rootCellId,
                created: false
            })
            expect(bootstrapped.canCreate).toBe(false)
            expect(await readSharedAggregateSnapshot()).toEqual(initialSharedAggregate)
            const idempotentBootstrap = await sendWithCsrf(
                memberApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(memberRuntimeIds.workspaceId)}`,
                { locale: 'en' }
            )
            expect(idempotentBootstrap.status).toBe(200)
            const idempotentBootstrapResult = (await idempotentBootstrap.json()) as {
                structureId?: string
                interpretationId?: string
                rootCellId?: string
                created?: boolean
            }
            expect(idempotentBootstrapResult).toMatchObject({
                structureId: sharedBootstrap.structureId,
                interpretationId: sharedBootstrap.interpretationId,
                rootCellId: sharedBootstrap.rootCellId,
                created: false
            })
            expect(await readSharedAggregateSnapshot()).toEqual(initialSharedAggregate)
            const memberTemplates = await listTemplates(memberApi, imported.applicationId, memberRuntimeIds.workspaceId)
            expect(memberTemplates).toEqual([])
            await disposeApiContext(memberApi)
            memberApi = null

            editorSession = await createLoggedInBrowserContext(browser, { email: editorEmail, password })
            await editorSession.page.goto(`/a/${imported.applicationId}?locale=en&workspaceId=${encodeURIComponent(sharedWorkspaceId)}`)
            const editorWorkspaceSwitcher = editorSession.page
                .getByTestId('runtime-side-menu-docked')
                .getByTestId('runtime-workspace-switcher')
            await expect(editorWorkspaceSwitcher).toBeVisible({ timeout: 30_000 })
            await expect.poll(() => new URL(editorSession!.page.url()).pathname).toBe(`/a/${imported.applicationId}`)
            await expect.poll(() => new URL(editorSession!.page.url()).searchParams.get('workspaceId')).toBe(sharedWorkspaceId)
            await expect(editorWorkspaceSwitcher).toContainText(sharedWorkspaceName)
            await editorSession.page
                .getByRole('navigation')
                .filter({ hasText: 'Structures' })
                .first()
                .getByRole('link', { name: 'Structures' })
                .click()
            await expectSingleSystemMatrix(editorSession.page)
            const editorCellTitle = `Editor-created Matrix cell ${runManifest.runId}`
            const editorMatrix = editorSession.page.getByTestId('interpretation-network-matrix-workspace')
            await editorMatrix.getByRole('button').filter({ hasText: 'Universe' }).first().click()
            await editorMatrix.getByRole('button', { name: 'Add', exact: true }).click()
            const addCellDialog = editorSession.page.getByRole('dialog', { name: 'Add cell' })
            await expect(addCellDialog).toBeVisible()
            const editorCellDescription = 'Created through the editor runtime form.'
            await addCellDialog.getByRole('textbox', { name: 'Title', exact: true }).fill(editorCellTitle)
            await addCellDialog.getByRole('textbox', { name: 'Description', exact: true }).fill(editorCellDescription)
            const editorCellCreateResponsePromise = waitForSettledMutationResponse(
                editorSession.page,
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/matrix/cells`,
                { label: 'Creating a Matrix cell through the editor runtime UI' }
            )
            await addCellDialog.getByRole('button', { name: 'Create', exact: true }).click()
            const editorCellCreateResponse = await editorCellCreateResponsePromise
            expect(editorCellCreateResponse.status()).toBe(201)
            const editorCellCreateResult = (await editorCellCreateResponse.json()) as {
                id?: string
                status?: string
                item?: { CellId?: string }
            }
            expect(editorCellCreateResult.id).toMatch(uuidV7Pattern)
            expect(editorCellCreateResult.item?.CellId).toMatch(uuidV7Pattern)
            expect(editorCellCreateResult.item?.CellId).not.toBe(editorCellCreateResult.id)
            expect(editorCellCreateResult.status).toBe('created')
            await expect(addCellDialog).toHaveCount(0)
            await expect(editorMatrix.getByRole('button').filter({ hasText: editorCellTitle })).toBeVisible({ timeout: 30_000 })

            const persistedEditorCellRows = (
                await getMatrixRows(ownerApi, imported.applicationId, sharedRuntimeIds, sharedBootstrap.interpretationId!)
            ).filter((row) => readLocalizedText(row.CellValue) === editorCellTitle)
            expect(persistedEditorCellRows).toHaveLength(1)
            expect(toMatrixRowSnapshot(persistedEditorCellRows[0])).toMatchObject({
                rowId: editorCellCreateResult.id,
                cellId: editorCellCreateResult.item?.CellId,
                parentCellId: sharedBootstrap.rootCellId
            })
            expect(readLocalizedText(persistedEditorCellRows[0].CellValue)).toBe(editorCellTitle)
            expect(readLocalizedText(persistedEditorCellRows[0].CellDescription)).toBe(editorCellDescription)
            expect(Number(persistedEditorCellRows[0]._upl_version ?? 0)).toBeGreaterThan(0)

            await editorSession.page.reload()
            await expect(editorWorkspaceSwitcher).toBeVisible({ timeout: 30_000 })
            await expect.poll(() => new URL(editorSession!.page.url()).pathname).toBe(`/a/${imported.applicationId}`)
            await expect.poll(() => new URL(editorSession!.page.url()).searchParams.get('workspaceId')).toBe(sharedWorkspaceId)
            await expect(editorWorkspaceSwitcher).toContainText(sharedWorkspaceName)
            await editorSession.page
                .getByRole('navigation')
                .filter({ hasText: 'Structures' })
                .first()
                .getByRole('link', { name: 'Structures' })
                .click()
            await expectSingleSystemMatrix(editorSession.page)
            await expect(
                editorSession.page
                    .getByTestId('interpretation-network-matrix-workspace')
                    .getByRole('button')
                    .filter({ hasText: editorCellTitle })
            ).toBeVisible({ timeout: 30_000 })
            await expect(
                editorSession.page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Save as template' })
            ).toBeVisible()
            await editorSession.page
                .getByTestId('interpretation-network-structure-pane')
                .getByRole('button', { name: 'Save as template' })
                .click()
            const editorSaveDialog = editorSession.page.getByRole('dialog', { name: 'Save structure as template' })
            await expect(editorSaveDialog).toBeVisible()
            const editorTemplateName = `Editor permission template ${runManifest.runId}`
            await editorSaveDialog.getByRole('textbox', { name: 'Template name' }).first().fill(editorTemplateName)
            await editorSaveDialog.getByRole('textbox', { name: 'Description' }).first().fill('Created by the editor browser session')
            await editorSaveDialog.getByRole('radio', { name: 'Structure only' }).check()
            const editorTemplateResponsePromise = editorSession.page.waitForResponse(
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/templates`
            )
            await editorSaveDialog.getByRole('button', { name: 'Save' }).click()
            const editorTemplateResponse = await editorTemplateResponsePromise
            expect(editorTemplateResponse.status()).toBe(201)
            const editorTemplateResult = (await editorTemplateResponse.json()) as { id?: string }
            expect(editorTemplateResult.id).toMatch(uuidV7Pattern)
            await expect(editorSaveDialog).toHaveCount(0)
            editorApi = await createLoggedInApiContext({ email: editorEmail, password })
            const editorRuntimeIds = await resolveRuntimeIds(editorApi, imported.applicationId, sharedWorkspaceId)
            const editorTemplates = await listTemplates(editorApi, imported.applicationId, editorRuntimeIds.workspaceId)
            expect(editorTemplates.some((template) => readLocalizedText(template.name) === editorTemplateName)).toBe(true)
            await disposeApiContext(editorApi)
            editorApi = null

            const unrelated = await importInterpretationNetworkSnapshot(ownerApi, {
                snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
                label: `permissions-unrelated-${runManifest.runId}`
            })
            await recordCreatedMetahub({
                id: unrelated.metahub.id,
                name: 'Interpretation Network permissions isolation canary',
                codename: `interpretation-network-permissions-unrelated-${runManifest.runId}`
            })
            await recordCreatedApplication({ id: unrelated.applicationId })
            const unrelatedRuntimeIds = await resolveRuntimeIds(ownerApi, unrelated.applicationId)

            const matrixRowsBeforeDeniedCreate = await getMatrixRows(
                ownerApi,
                imported.applicationId,
                sharedRuntimeIds,
                sharedBootstrap.interpretationId!
            )
            const savedEditorTemplate = editorTemplates.find((template) => template.id === editorTemplateResult.id)
            if (!savedEditorTemplate || !Number.isSafeInteger(savedEditorTemplate.version) || savedEditorTemplate.version < 1) {
                throw new Error('The permissions flow could not resolve the saved template version')
            }
            const rootMatrixSnapshot = findMatrixRowByTitle(matrixRowsBeforeDeniedCreate, 'Universe')
            expect(rootMatrixSnapshot.cellId).toBe(sharedBootstrap.rootCellId)
            expect(rootMatrixSnapshot.rowId).toMatch(uuidV7Pattern)
            const rootMatrixAggregate = matrixRowsBeforeDeniedCreate.find((row) => row.id === rootMatrixSnapshot.rowId)
            if (!rootMatrixAggregate) throw new Error('The permissions flow could not resolve the root aggregate by its row ID')
            const rootMatrixRowVersion = Number(rootMatrixAggregate._upl_version)
            if (!Number.isSafeInteger(rootMatrixRowVersion) || rootMatrixRowVersion < 1) {
                throw new Error('The permissions flow could not resolve the current target Matrix row version')
            }
            const templateRowsBeforeDeniedApply = await getTemplateMatrixRows(
                ownerApi,
                imported.applicationId,
                sharedRuntimeIds,
                savedEditorTemplate.id
            )
            const templateDetailBeforeDeniedApply = await getTemplateDetail(
                ownerApi,
                imported.applicationId,
                sharedRuntimeIds.workspaceId,
                savedEditorTemplate.id
            )
            memberMutationApi = await createLoggedInApiContext({ email: memberEmail, password })
            const memberRuntimeTarget = new URLSearchParams({
                workspaceId: memberRuntimeIds.workspaceId,
                targetKind: 'object',
                entityTypeId: memberRuntimeIds.entityTypeId,
                layoutId: memberRuntimeIds.layoutId,
                widgetId: memberRuntimeIds.widgetId,
                instanceKey: memberRuntimeIds.instanceKey,
                locale: 'en',
                themeVariant: 'light'
            })
            const memberDirectCreate = await sendWithCsrf(
                memberMutationApi,
                'POST',
                `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/matrix/cells?${memberRuntimeTarget}`,
                {
                    interpretationId: sharedBootstrap.interpretationId,
                    data: { CellValue: 'Forbidden member cell' },
                    placement: { parentCellId: sharedBootstrap.rootCellId }
                }
            )
            expect(memberDirectCreate.status).toBe(403)
            expect(await getMatrixRows(ownerApi, imported.applicationId, sharedRuntimeIds, sharedBootstrap.interpretationId!)).toEqual(
                matrixRowsBeforeDeniedCreate
            )
            const deniedTemplateApply = await sendWithCsrf(
                memberMutationApi,
                'POST',
                `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/templates/${
                    savedEditorTemplate.id
                }/apply?workspaceId=${encodeURIComponent(sharedRuntimeIds.workspaceId)}`,
                {
                    interpretationId: sharedBootstrap.interpretationId,
                    targetCellId: sharedBootstrap.rootCellId,
                    expectedTemplateVersion: savedEditorTemplate.version,
                    expectedTargetVersion: rootMatrixRowVersion
                }
            )
            expect(deniedTemplateApply.status, 'A read-only member cannot apply a saved template through the API').toBe(403)
            await expect(memberMatrix.getByRole('button', { name: /^Cell actions:/u })).toHaveCount(0)
            expect(await getMatrixRows(ownerApi, imported.applicationId, sharedRuntimeIds, sharedBootstrap.interpretationId!)).toEqual(
                matrixRowsBeforeDeniedCreate
            )
            expect(await getTemplateMatrixRows(ownerApi, imported.applicationId, sharedRuntimeIds, savedEditorTemplate.id)).toEqual(
                templateRowsBeforeDeniedApply
            )
            expect(await getTemplateDetail(ownerApi, imported.applicationId, sharedRuntimeIds.workspaceId, savedEditorTemplate.id)).toEqual(
                templateDetailBeforeDeniedApply
            )
            const directResponse = await sendWithCsrf(
                memberMutationApi,
                'DELETE',
                `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/templates/${
                    editorTemplateResult.id
                }?workspaceId=${encodeURIComponent(editorRuntimeIds.workspaceId)}`,
                {}
            )
            expect(directResponse.status).toBe(403)

            const crossApplicationEnsure = await sendWithCsrf(
                memberMutationApi,
                'POST',
                `/api/v1/applications/${
                    unrelated.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(
                    unrelatedRuntimeIds.workspaceId
                )}`,
                { locale: 'en' }
            )
            expect([403, 404]).toContain(crossApplicationEnsure.status)

            const secondWorkspaceResponse = await sendWithCsrf(
                ownerApi,
                'POST',
                `/api/v1/applications/${imported.applicationId}/runtime/workspaces`,
                { name: createLocalizedContent('en', `Permission isolation workspace ${runManifest.runId}`) }
            )
            expect(secondWorkspaceResponse.status).toBe(201)
            const secondWorkspace = (await secondWorkspaceResponse.json()) as { id?: string }
            expect(secondWorkspace.id).toMatch(uuidV7Pattern)
            const ownerWorkspaces = (await listApplicationWorkspaces(ownerApi, imported.applicationId)) as {
                items?: Array<{ id?: string; workspaceType?: string; personalUserId?: string | null }>
            }
            expect(ownerWorkspaces.items?.some((workspace) => workspace.id === secondWorkspace.id)).toBe(true)
            const ownerPersonalWorkspace = ownerWorkspaces.items?.find((workspace) => workspace.workspaceType === 'personal')
            const ownerPersonalWorkspaceId = ownerPersonalWorkspace?.id
            if (!ownerPersonalWorkspaceId) throw new Error('Owner personal workspace was not returned')
            expect(ownerPersonalWorkspaceId).toMatch(uuidV7Pattern)
            expect(ownerPersonalWorkspace?.personalUserId).toEqual(expect.any(String))
            expect(ownerPersonalWorkspace?.personalUserId).not.toBe(member.userId)
            const memberWorkspaces = (await listApplicationWorkspaces(memberMutationApi, imported.applicationId)) as {
                items?: Array<{ id?: string }>
            }
            expect(memberWorkspaces.items?.some((workspace) => workspace.id === ownerPersonalWorkspaceId)).toBe(false)
            const crossWorkspaceEnsure = await sendWithCsrf(
                memberMutationApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(ownerPersonalWorkspaceId)}`,
                { locale: 'en' }
            )
            expect(crossWorkspaceEnsure.status).toBe(403)
            await disposeApiContext(memberMutationApi)
            memberMutationApi = null
            expect(await listTemplates(ownerApi, imported.applicationId, runtimeIds.workspaceId)).not.toEqual(
                expect.arrayContaining([expect.objectContaining({ id: editorTemplateResult.id })])
            )
            expect(await listTemplates(ownerApi, unrelated.applicationId, unrelatedRuntimeIds.workspaceId)).toEqual([])
            const listedMembers = (await listApplicationMembers(ownerApi, imported.applicationId)) as {
                items?: Array<Record<string, unknown>>
                members?: Array<Record<string, unknown>>
            }
            expect(listedMembers.items ?? listedMembers.members ?? []).toEqual(
                expect.arrayContaining([expect.objectContaining({ userId: member.userId, role: 'member' })])
            )
        } finally {
            await ownerSession?.context.close().catch(() => undefined)
            await memberSession?.context.close().catch(() => undefined)
            await editorSession?.context.close().catch(() => undefined)
            if (memberApi) await disposeApiContext(memberApi).catch(() => undefined)
            if (editorApi) await disposeApiContext(editorApi).catch(() => undefined)
            if (memberMutationApi) await disposeApiContext(memberMutationApi).catch(() => undefined)
            await disposeApiContext(ownerApi)
            await disposeBootstrapApiContext(bootstrapApi)
        }
    })
})
