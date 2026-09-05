import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import {
    addApplicationMember,
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    getAssignableRoles,
    getRuntimeAppData,
    getRuntimeRow,
    listApplicationWorkspaces,
    listPublicationApplications,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { withE2eDatabaseClient } from '../../support/backend/e2eDatabase.mjs'
import { flattenMarketingPageRecords } from '../../support/marketingPageRuntimeMaterialization'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'

type ApiSession = Awaited<ReturnType<typeof createLoggedInApiContext>>

const apiCookieHeader = (api: ApiSession): string =>
    Array.from(api.cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')

async function getApiResponse(api: ApiSession, path: string): Promise<Response> {
    return fetch(new URL(path, api.baseURL), {
        headers: {
            Accept: 'application/json',
            Cookie: apiCookieHeader(api)
        }
    })
}

function resolveRoleIds(roles: Array<{ id?: string; codename?: string }>, codenames: string[]): string[] {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    return codenames.map((codename) => {
        const roleId = roleMap.get(codename.toLowerCase())
        if (!roleId) throw new Error(`Assignable global role ${codename} was not found`)
        return roleId
    })
}

async function waitForUser(credentials: { email: string; password: string }): Promise<void> {
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

async function waitForApplication(api: ApiSession, metahubId: string, publicationId: string): Promise<{ id: string; slug?: string }> {
    let application: { id?: string; slug?: string } | null = null
    await expect
        .poll(async () => {
            const payload = await listPublicationApplications(api, metahubId, publicationId)
            application = payload?.items?.[0] ?? null
            return typeof application?.id === 'string'
        })
        .toBe(true)
    if (!application?.id) throw new Error('Marketing workspace fixture application was not created')
    return { id: application.id, slug: application.slug }
}

function workspacePath(applicationId: string, workspaceId?: string): string {
    return workspaceId
        ? `/api/v1/applications/${applicationId}/runtime/workspaces/${workspaceId}`
        : `/api/v1/applications/${applicationId}/runtime/workspaces`
}

function runtimePath(applicationId: string, workspaceId: string): string {
    return `/api/v1/applications/${applicationId}/runtime/marketing-page?locale=en&workspaceId=${encodeURIComponent(workspaceId)}`
}

function readEnglishLocalizedValue(value: unknown): unknown {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as { en?: unknown }).en : undefined
}

test('@flow @permission @marketing-page verifies workspace lifecycle, seed isolation, and member denial', async ({
    browser,
    runManifest
}, testInfo) => {
    test.setTimeout(360_000)

    const ownerApi = await createLoggedInApiContext(runManifest.testUser)
    const bootstrapApi = await createBootstrapApiContext()
    let memberApi: ApiSession | null = null
    let ownerBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let memberBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let copiedWorkspace: { id: string } | null = null
    let applicationId: string | null = null

    const memberEmail = `e2e+${runManifest.runId}.marketing-workspace-member@example.test`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'

    try {
        const metahubCodename = `${runManifest.runId}-marketing-workspace`
        const metahub = await createMetahub(ownerApi, {
            name: { en: `E2E ${runManifest.runId} marketing workspace` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })
        if (!metahub?.id) throw new Error('Marketing workspace fixture metahub was not created')
        await recordCreatedMetahub({ id: metahub.id, name: metahubCodename, codename: metahubCodename })

        const publication = await createPublication(ownerApi, metahub.id, {
            name: { en: `E2E ${runManifest.runId} marketing workspace publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            applicationName: { en: `E2E ${runManifest.runId} marketing workspace application` },
            applicationNamePrimaryLocale: 'en',
            runtimePolicy: { workspaceMode: 'required', requiredWorkspaceModeAcknowledged: true }
        })
        if (!publication?.id) throw new Error('Marketing workspace fixture publication was not created')
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
        await syncPublication(ownerApi, metahub.id, publication.id)
        await waitForPublicationReady(ownerApi, metahub.id, publication.id)

        const application = await waitForApplication(ownerApi, metahub.id, publication.id)
        applicationId = application.id
        await recordCreatedApplication({ id: application.id, slug: application.slug })
        await syncApplicationSchema(ownerApi, application.id, {
            schemaOptions: { workspaceModeRequested: 'enabled', acknowledgeIrreversibleWorkspaceEnablement: true }
        })

        const roleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
        const createdMember = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: resolveRoleIds(await getAssignableRoles(bootstrapApi), roleCodenames),
            comment: `Marketing workspace lifecycle ${runManifest.runId}`
        })
        if (!createdMember?.userId) throw new Error('Marketing workspace member was not created')
        await recordCreatedGlobalUser({ userId: createdMember.userId, email: memberEmail })
        await waitForUser({ email: memberEmail, password: memberPassword })
        await addApplicationMember(ownerApi, application.id, { email: memberEmail, role: 'member' })
        memberApi = await createLoggedInApiContext({ email: memberEmail, password: memberPassword })

        const initialPayload = await listApplicationWorkspaces(ownerApi, application.id)
        const personalWorkspace = (initialPayload.items ?? []).find((item: { workspaceType?: string }) => item.workspaceType === 'personal')
        expect(isUuidV7(personalWorkspace?.id)).toBe(true)

        const memberCreateResponse = await sendWithCsrf(memberApi, 'POST', workspacePath(application.id), {
            name: createLocalizedContent('en', `Forbidden ${runManifest.runId}`),
            description: createLocalizedContent('en', 'Member must not create a shared workspace')
        })
        expect(memberCreateResponse.status).toBe(403)

        const sharedName = `Marketing shared ${runManifest.runId}`
        const sharedCreateResponse = await sendWithCsrf(ownerApi, 'POST', workspacePath(application.id), {
            name: createLocalizedContent('en', sharedName),
            description: createLocalizedContent('en', 'Seeded marketing workspace')
        })
        expect(sharedCreateResponse.ok).toBe(true)
        const sharedWorkspace = await sharedCreateResponse.json()
        expect(isUuidV7(sharedWorkspace.id)).toBe(true)

        const sharedRuntime = await getApiResponse(ownerApi, runtimePath(application.id, sharedWorkspace.id))
        expect(sharedRuntime.status).toBe(200)
        const sharedRuntimePayload = await sharedRuntime.json()
        expect(flattenMarketingPageRecords(sharedRuntimePayload)).toEqual(
            expect.arrayContaining([expect.objectContaining({ kind: 'siteSettings' })])
        )

        ownerBrowser = await createLoggedInBrowserContext(browser, runManifest.testUser, {
            basePathAfterLogin: `/a/${application.id}/workspaces/${sharedWorkspace.id}/settings`
        })
        await expect(ownerBrowser.page.getByRole('button', { name: 'Reset seeded content', exact: true })).toBeVisible({ timeout: 60_000 })
        await ownerBrowser.page.getByRole('button', { name: 'Reset seeded content', exact: true }).click()
        const pristineResetDialog = ownerBrowser.page.getByRole('dialog')
        await expect(pristineResetDialog).toContainText('Reset seeded content?')
        const pristineResetResponsePromise = ownerBrowser.page.waitForResponse(
            (response) =>
                response.url().includes(`/runtime/workspaces/${sharedWorkspace.id}/seed/reset`) && response.request().method() === 'POST'
        )
        await pristineResetDialog.getByRole('button', { name: 'Reset content', exact: true }).click()
        const pristineResetResponse = await pristineResetResponsePromise
        expect(pristineResetResponse.ok()).toBe(true)
        const pristineResetPayload = await pristineResetResponse.json()
        expect(pristineResetPayload.resetRows).toBeGreaterThan(0)
        expect(isUuidV7(pristineResetPayload.operationId)).toBe(true)

        const schemaName = `app_${application.id.replace(/-/g, '')}`
        expect(schemaName).toMatch(/^app_[0-9a-f]{32}$/i)
        await withE2eDatabaseClient(async (client) => {
            const auditResult = await client.query(
                `SELECT operation_kind, affected_rows, workspace_id, source_key
                 FROM "${schemaName}"."_app_workspace_operation_audit"
                 WHERE id = $1 AND workspace_id = $2`,
                [pristineResetPayload.operationId, sharedWorkspace.id]
            )
            expect(auditResult.rowCount).toBe(1)
            expect(auditResult.rows[0]).toEqual({
                operation_kind: 'seed_reset',
                affected_rows: pristineResetPayload.resetRows,
                workspace_id: sharedWorkspace.id,
                source_key: 'workspace_seed_template'
            })
        })

        const copyResponse = await sendWithCsrf(ownerApi, 'POST', `${workspacePath(application.id, sharedWorkspace.id)}/copy`, {
            name: createLocalizedContent('en', `${sharedName} copy`),
            description: createLocalizedContent('en', 'Copied seeded marketing workspace')
        })
        expect(copyResponse.ok).toBe(true)
        const createdCopiedWorkspace = (await copyResponse.json()) as { id: string }
        copiedWorkspace = createdCopiedWorkspace
        expect(isUuidV7(createdCopiedWorkspace.id)).toBe(true)
        expect(createdCopiedWorkspace.id).not.toBe(sharedWorkspace.id)

        const copiedRuntime = await getApiResponse(ownerApi, runtimePath(application.id, createdCopiedWorkspace.id))
        expect(copiedRuntime.status).toBe(200)
        const copiedRuntimePayload = await copiedRuntime.json()
        expect(flattenMarketingPageRecords(copiedRuntimePayload)).toEqual(
            expect.arrayContaining([expect.objectContaining({ kind: 'siteSettings' })])
        )

        const readSiteSettingsId = (payload: unknown): string => {
            const record = flattenMarketingPageRecords(payload as Parameters<typeof flattenMarketingPageRecords>[0]).find(
                (item) => item.kind === 'siteSettings'
            )
            if (!record || typeof record.id !== 'string' || !record.id) {
                throw new Error('Site settings record was not materialized for the workspace')
            }
            return record.id
        }
        expect(readSiteSettingsId(sharedRuntimePayload)).not.toBe(readSiteSettingsId(copiedRuntimePayload))
        const copiedSiteSettingsId = readSiteSettingsId(copiedRuntimePayload)

        const sharedGenericRuntime = (await getRuntimeAppData(ownerApi, application.id, {
            workspaceId: sharedWorkspace.id,
            locale: 'en'
        })) as {
            objectCollections?: Array<{ id?: string; codename?: string }>
        }
        const siteSettingsCollection = sharedGenericRuntime.objectCollections?.find(
            (collection) => collection.codename === 'MarketingPageSiteSettings'
        )
        expect(siteSettingsCollection?.id).toMatch(/^[0-9a-f-]{36}$/i)
        const sharedSiteSettingsId = readSiteSettingsId(sharedRuntimePayload)
        const sharedSiteSettingsRow = await getRuntimeRow(ownerApi, application.id, sharedSiteSettingsId, {
            objectCollectionId: siteSettingsCollection!.id,
            workspaceId: sharedWorkspace.id
        })
        expect(sharedSiteSettingsRow).toBeTruthy()
        const crossScopeMutation = await sendWithCsrf(
            ownerApi,
            'PATCH',
            `/api/v1/applications/${application.id}/runtime/rows/${sharedSiteSettingsId}?objectCollectionId=${encodeURIComponent(
                siteSettingsCollection!.id!
            )}&workspaceId=${encodeURIComponent(createdCopiedWorkspace.id)}`,
            {
                objectCollectionId: siteSettingsCollection!.id,
                data: {
                    HeroTitle: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Cross-scope probe', version: 1, isActive: true }
                        }
                    }
                }
            }
        )
        expect(crossScopeMutation.status).toBe(404)
        expect(
            await getRuntimeRow(ownerApi, application.id, sharedSiteSettingsId, {
                objectCollectionId: siteSettingsCollection!.id,
                workspaceId: createdCopiedWorkspace.id
            })
        ).toBeNull()

        const authoredHeroTitle = `Authored workspace content ${runManifest.runId}`
        const copiedSiteSettingsRow = await getRuntimeRow(ownerApi, application.id, copiedSiteSettingsId, {
            objectCollectionId: siteSettingsCollection!.id,
            workspaceId: createdCopiedWorkspace.id
        })
        const copiedRowVersion = Number(copiedSiteSettingsRow?.version ?? copiedSiteSettingsRow?._upl_version ?? 1)
        const authoredMutation = await sendWithCsrf(
            ownerApi,
            'PATCH',
            `/api/v1/applications/${application.id}/runtime/rows/${copiedSiteSettingsId}?objectCollectionId=${encodeURIComponent(
                siteSettingsCollection!.id!
            )}&workspaceId=${encodeURIComponent(createdCopiedWorkspace.id)}`,
            {
                objectCollectionId: siteSettingsCollection!.id,
                expectedVersion: Number.isInteger(copiedRowVersion) && copiedRowVersion > 0 ? copiedRowVersion : 1,
                data: {
                    HeroTitle: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: authoredHeroTitle, version: 1, isActive: true }
                        }
                    }
                }
            }
        )
        expect(authoredMutation.ok).toBe(true)
        const authoredRuntime = await getApiResponse(ownerApi, runtimePath(application.id, createdCopiedWorkspace.id))
        expect(authoredRuntime.status).toBe(200)
        const authoredRuntimePayload = await authoredRuntime.json()
        expect(
            readEnglishLocalizedValue(
                flattenMarketingPageRecords(authoredRuntimePayload).find((record) => record.kind === 'siteSettings')?.heroTitle
            )
        ).toBe(authoredHeroTitle)

        await ownerBrowser.page.goto(new URL(`/a/${application.id}/workspaces`, ownerBrowser.page.url()).toString())
        await expect(ownerBrowser.page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 60_000 })
        await expect(ownerBrowser.page.locator('#marketing-page-main')).toHaveCount(0)
        await expect(ownerBrowser.page.getByText(sharedName, { exact: true })).toBeVisible({ timeout: 60_000 })

        const sharedCard = ownerBrowser.page.locator(`[data-testid="runtime-workspace-card"][data-workspace-id="${sharedWorkspace.id}"]`)
        await sharedCard.getByLabel('Workspace actions').click()
        await ownerBrowser.page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
        const editedName = `${sharedName} edited`
        const editDialog = ownerBrowser.page.getByRole('dialog')
        await editDialog.getByLabel('Workspace name').fill(editedName)
        await editDialog.getByLabel('Workspace description').fill('Edited through the marketing workspace UI')
        const editResponsePromise = ownerBrowser.page.waitForResponse(
            (response) => response.url().includes(`/runtime/workspaces/${sharedWorkspace.id}`) && response.request().method() === 'PATCH'
        )
        await editDialog.getByRole('button', { name: 'Save', exact: true }).click()
        expect((await editResponsePromise).ok()).toBe(true)
        await expect(ownerBrowser.page.getByText(editedName, { exact: true })).toBeVisible({ timeout: 60_000 })

        const editedCard = ownerBrowser.page.locator(`[data-testid="runtime-workspace-card"][data-workspace-id="${sharedWorkspace.id}"]`)
        await editedCard.getByLabel('Workspace actions').click()
        await ownerBrowser.page.getByRole('menuitem', { name: 'Copy', exact: true }).click()
        const copyDialog = ownerBrowser.page.getByRole('dialog')
        const uiCopyName = `${editedName} UI copy`
        await copyDialog.getByLabel('Workspace name').fill(uiCopyName)
        const copyResponsePromise = ownerBrowser.page.waitForResponse(
            (response) =>
                response.url().includes(`/runtime/workspaces/${sharedWorkspace.id}/copy`) && response.request().method() === 'POST'
        )
        await copyDialog.getByRole('button', { name: 'Copy', exact: true }).click()
        const uiCopyResponse = await copyResponsePromise
        expect(uiCopyResponse.ok()).toBe(true)
        const uiCopyWorkspace = await uiCopyResponse.json()
        expect(isUuidV7(uiCopyWorkspace.id)).toBe(true)
        expect(uiCopyWorkspace.id).not.toBe(sharedWorkspace.id)

        await ownerBrowser.page.goto(new URL(`/a/${application.id}/workspaces`, ownerBrowser.page.url()).toString())
        await expect(ownerBrowser.page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 60_000 })
        const uiCopyCard = ownerBrowser.page.locator(`[data-testid="runtime-workspace-card"][data-workspace-id="${uiCopyWorkspace.id}"]`)
        await expect(uiCopyCard).toBeVisible({ timeout: 60_000 })
        await uiCopyCard.getByLabel('Workspace actions').click()
        await ownerBrowser.page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
        const deleteDialog = ownerBrowser.page.getByRole('dialog')
        const deleteResponsePromise = ownerBrowser.page.waitForResponse(
            (response) => response.url().includes(`/runtime/workspaces/${uiCopyWorkspace.id}`) && response.request().method() === 'DELETE'
        )
        await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click()
        expect((await deleteResponsePromise).ok()).toBe(true)
        await expect(uiCopyCard).toHaveCount(0)

        await ownerBrowser.page.goto(
            new URL(`/a/${application.id}/workspaces/${createdCopiedWorkspace.id}/settings`, ownerBrowser.page.url()).toString()
        )
        await expect(ownerBrowser.page.getByRole('button', { name: 'Reset seeded content', exact: true })).toBeVisible({ timeout: 60_000 })
        await ownerBrowser.page.getByRole('button', { name: 'Reset seeded content', exact: true }).click()
        const resetDialog = ownerBrowser.page.getByRole('dialog')
        await expect(resetDialog).toContainText('Reset seeded content?')
        const resetResponsePromise = ownerBrowser.page.waitForResponse(
            (response) =>
                response.url().includes(`/runtime/workspaces/${createdCopiedWorkspace.id}/seed/reset`) &&
                response.request().method() === 'POST'
        )
        await resetDialog.getByRole('button', { name: 'Reset content', exact: true }).click()
        const resetResponse = await resetResponsePromise
        expect(resetResponse.ok()).toBe(true)
        const resetPayload = await resetResponse.json()
        expect(resetPayload.resetRows).toEqual(expect.any(Number))
        expect(isUuidV7(resetPayload.operationId)).toBe(true)
        expect(resetPayload.resetRows).toBe(0)

        await withE2eDatabaseClient(async (client) => {
            const auditResult = await client.query(
                `SELECT operation_kind, affected_rows, workspace_id, source_key
                 FROM "${schemaName}"."_app_workspace_operation_audit"
                 WHERE id = $1 AND workspace_id = $2`,
                [resetPayload.operationId, createdCopiedWorkspace.id]
            )
            expect(auditResult.rowCount).toBe(1)
            expect(auditResult.rows[0]).toEqual({
                operation_kind: 'seed_reset',
                affected_rows: 0,
                workspace_id: createdCopiedWorkspace.id,
                source_key: 'workspace_seed_template'
            })
        })

        const authoredAfterResetRuntime = await getApiResponse(ownerApi, runtimePath(application.id, createdCopiedWorkspace.id))
        expect(authoredAfterResetRuntime.status).toBe(200)
        const authoredAfterResetPayload = await authoredAfterResetRuntime.json()
        expect(
            readEnglishLocalizedValue(
                flattenMarketingPageRecords(authoredAfterResetPayload).find((record) => record.kind === 'siteSettings')?.heroTitle
            )
        ).toBe(authoredHeroTitle)

        const memberResetResponse = await sendWithCsrf(
            memberApi!,
            'POST',
            `/api/v1/applications/${application.id}/runtime/workspaces/${createdCopiedWorkspace.id}/seed/reset`,
            {}
        )
        expect(memberResetResponse.status).toBe(403)
        const anonymousResetResponse = await fetch(
            new URL(`/api/v1/applications/${application.id}/runtime/workspaces/${createdCopiedWorkspace.id}/seed/reset`, ownerApi.baseURL),
            { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' }
        )
        expect(anonymousResetResponse.status).toBe(419)
        expect(await ownerBrowser.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await ownerBrowser.page.screenshot({ path: testInfo.outputPath('marketing-workspaces-owner.png'), fullPage: true })

        memberBrowser = await createLoggedInBrowserContext(
            browser,
            { email: memberEmail, password: memberPassword },
            {
                basePathAfterLogin: `/a/${application.id}/workspaces`
            }
        )
        await expect(memberBrowser.page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 60_000 })
        await expect(memberBrowser.page.locator('#marketing-page-main')).toHaveCount(0)
        await expect(memberBrowser.page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0)
        expect(await memberBrowser.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await memberBrowser.page.screenshot({ path: testInfo.outputPath('marketing-workspaces-member.png'), fullPage: true })
    } finally {
        if (applicationId && copiedWorkspace?.id) {
            await sendWithCsrf(ownerApi, 'DELETE', workspacePath(applicationId, copiedWorkspace.id)).catch(() => undefined)
        }
        await ownerBrowser?.context.close().catch(() => undefined)
        await memberBrowser?.context.close().catch(() => undefined)
        if (memberApi) await disposeApiContext(memberApi)
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
