import { expect, test } from '../../fixtures/test'
import {
    addApplicationMember,
    createAdminUser,
    createLoggedInApiContext,
    disposeApiContext,
    getApplicationRuntime,
    getAssignableRoles,
    listApplicationMembers,
    listApplicationWorkspaces,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedApplication, recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    expectSingleSystemMatrix,
    getMatrixRows,
    type InterpretationNetworkApi,
    listTemplates,
    readLocalizedText,
    resolveRuntimeIds,
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
    test('keeps a member read-only, allows editor creation, and rejects guessed IDs directly', async ({ browser, runManifest }) => {
        test.setTimeout(240_000)
        const ownerApi = await createLoggedInApiContext(runManifest.testUser)
        const bootstrapApi = await createBootstrapApiContext()
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
            await recordCreatedApplication({ id: imported.applicationId, slug: imported.applicationSlug })
            const runtimeIds = await resolveRuntimeIds(ownerApi, imported.applicationId)
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

            const ownerRuntime = (await getApplicationRuntime(ownerApi, imported.applicationId)) as {
                permissions?: Record<string, boolean>
            }
            expect(ownerRuntime.permissions?.createContent).toBe(true)

            memberSession = await createLoggedInBrowserContext(browser, { email: memberEmail, password })
            await memberSession.page.goto(`/a/${imported.applicationId}`)
            await expect(memberSession.page.getByTestId('runtime-workspace-switcher')).toBeVisible({ timeout: 30_000 })
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
            memberApi = await createLoggedInApiContext({ email: memberEmail, password })
            const memberRuntimeIds = await resolveRuntimeIds(memberApi, imported.applicationId)
            const bootstrapResponse = await sendWithCsrf(
                memberApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(memberRuntimeIds.workspaceId)}`,
                { locale: 'en' }
            )
            expect([200, 201]).toContain(bootstrapResponse.status)
            const bootstrapped = (await bootstrapResponse.json()) as {
                structureId?: string
                interpretationId?: string
                rootCellId?: string
                created?: boolean
                canCreate?: boolean
            }
            expect(bootstrapped.structureId).toMatch(/^[0-9a-f-]{36}$/i)
            expect(bootstrapped.interpretationId).toMatch(/^[0-9a-f-]{36}$/i)
            expect(bootstrapped.rootCellId).toMatch(/^[0-9a-f-]{36}$/i)
            expect(bootstrapped.canCreate).toBe(false)
            const idempotentBootstrap = await sendWithCsrf(
                memberApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(memberRuntimeIds.workspaceId)}`,
                { locale: 'en' }
            )
            expect(idempotentBootstrap.status).toBe(200)
            const memberTemplates = await listTemplates(memberApi, imported.applicationId, memberRuntimeIds.workspaceId)
            expect(memberTemplates).toEqual([])
            await disposeApiContext(memberApi)
            memberApi = null

            editorSession = await createLoggedInBrowserContext(browser, { email: editorEmail, password })
            await editorSession.page.goto(`/a/${imported.applicationId}`)
            await editorSession.page
                .getByRole('navigation')
                .filter({ hasText: 'Structures' })
                .first()
                .getByRole('link', { name: 'Structures' })
                .click()
            await expectSingleSystemMatrix(editorSession.page)
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
            const editorTemplates = await listTemplates(editorApi, imported.applicationId, runtimeIds.workspaceId)
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
            await recordCreatedApplication({ id: unrelated.applicationId, slug: unrelated.applicationSlug })
            const unrelatedRuntimeIds = await resolveRuntimeIds(ownerApi, unrelated.applicationId)

            const matrixRowsBeforeDeniedCreate = await getMatrixRows(
                ownerApi,
                imported.applicationId,
                runtimeIds,
                bootstrapped.interpretationId!
            )
            memberMutationApi = await createLoggedInApiContext({ email: memberEmail, password })
            const memberDirectCreate = await sendWithCsrf(
                memberMutationApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/matrix/cells?workspaceId=${encodeURIComponent(runtimeIds.workspaceId)}`,
                {
                    interpretationId: bootstrapped.interpretationId,
                    data: { CellValue: 'Forbidden member cell' },
                    placement: { parentCellId: bootstrapped.rootCellId }
                }
            )
            expect(memberDirectCreate.status).toBe(403)
            expect(await getMatrixRows(ownerApi, imported.applicationId, runtimeIds, bootstrapped.interpretationId!)).toEqual(
                matrixRowsBeforeDeniedCreate
            )
            const directResponse = await sendWithCsrf(
                memberMutationApi,
                'DELETE',
                `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/templates/${
                    editorTemplateResult.id
                }?workspaceId=${encodeURIComponent(runtimeIds.workspaceId)}`,
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
                { name: `Permission isolation workspace ${runManifest.runId}` }
            )
            expect(secondWorkspaceResponse.status).toBe(201)
            const secondWorkspace = (await secondWorkspaceResponse.json()) as { id?: string }
            expect(secondWorkspace.id).toMatch(uuidV7Pattern)
            const ownerWorkspaces = (await listApplicationWorkspaces(ownerApi, imported.applicationId)) as {
                items?: Array<{ id?: string }>
            }
            expect(ownerWorkspaces.items?.some((workspace) => workspace.id === secondWorkspace.id)).toBe(true)
            const crossWorkspaceEnsure = await sendWithCsrf(
                memberMutationApi,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(secondWorkspace.id!)}`,
                { locale: 'en' }
            )
            expect(crossWorkspaceEnsure.status).toBe(403)
            await disposeApiContext(memberMutationApi)
            memberMutationApi = null
            expect(await listTemplates(ownerApi, imported.applicationId, runtimeIds.workspaceId)).toEqual(
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
