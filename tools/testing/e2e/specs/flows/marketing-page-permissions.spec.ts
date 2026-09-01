import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import {
    createAdminUser,
    createApplication,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    getApplicationLayout,
    getAssignableRoles,
    getMarketingPageRuntime,
    getRuntimeAppData,
    getRuntimeRow,
    listApplicationLayouts,
    listApplicationWorkspaces,
    listPublicationApplications,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
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
    const byCodename = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    return codenames.map((codename) => {
        const roleId = byCodename.get(codename.toLowerCase())
        if (!roleId) throw new Error(`Assignable global role ${codename} was not found`)
        return roleId
    })
}

async function waitForLinkedApplication(api: ApiSession, metahubId: string, publicationId: string): Promise<{ id: string; slug?: string }> {
    let application: { id?: string; slug?: string } | null = null

    await expect
        .poll(async () => {
            const response = await listPublicationApplications(api, metahubId, publicationId)
            application = (response?.items ?? [])[0] ?? null
            return typeof application?.id === 'string'
        })
        .toBe(true)

    if (!application?.id) throw new Error('Marketing publication did not create an application')
    return { id: application.id, slug: application.slug }
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

test('@flow @permission @marketing-page enforces runtime read and layout mutation boundaries', async ({ browser, runManifest }) => {
    test.setTimeout(240_000)

    const ownerCredentials = runManifest.testUser
    const password = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const roleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    const ownerApi = await createLoggedInApiContext(ownerCredentials)
    const bootstrapApi = await createBootstrapApiContext()
    let adminApi: ApiSession | null = null
    let editorApi: ApiSession | null = null
    let memberApi: ApiSession | null = null
    let adminBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let memberBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let anonymousContext: Awaited<ReturnType<typeof browser.newContext>> | null = null

    try {
        const metahubCodename = `${runManifest.runId}-marketing-permissions`
        const metahub = await createMetahub(ownerApi, {
            name: { en: `E2E ${runManifest.runId} marketing permissions` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })
        if (!metahub?.id) throw new Error('Permission fixture metahub creation did not return an id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubCodename, codename: metahubCodename })

        const publication = await createPublication(ownerApi, metahub.id, {
            name: { en: `E2E ${runManifest.runId} marketing permissions publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            applicationName: { en: `E2E ${runManifest.runId} marketing permissions application` },
            applicationNamePrimaryLocale: 'en',
            runtimePolicy: {
                workspaceMode: 'required',
                requiredWorkspaceModeAcknowledged: true
            }
        })
        if (!publication?.id) throw new Error('Permission fixture publication creation did not return an id')
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
        await syncPublication(ownerApi, metahub.id, publication.id)
        await waitForPublicationReady(ownerApi, metahub.id, publication.id)

        const application = await waitForLinkedApplication(ownerApi, metahub.id, publication.id)
        await recordCreatedApplication({ id: application.id, slug: application.slug })
        await syncApplicationSchema(ownerApi, application.id, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })

        const unrelatedApplication = await createApplication(ownerApi, {
            name: { en: `E2E ${runManifest.runId} unrelated marketing permission canary` },
            namePrimaryLocale: 'en',
            isPublic: false
        })
        if (!unrelatedApplication?.id) throw new Error('Unrelated application creation did not return an id')
        await recordCreatedApplication({ id: unrelatedApplication.id, slug: unrelatedApplication.slug })

        const roleIds = resolveRoleIds(await getAssignableRoles(bootstrapApi), roleCodenames)
        const users = {
            admin: {
                email: `e2e+${runManifest.runId}.marketing-admin@example.test`,
                role: 'admin' as const
            },
            editor: {
                email: `e2e+${runManifest.runId}.marketing-editor@example.test`,
                role: 'editor' as const
            },
            member: {
                email: `e2e+${runManifest.runId}.marketing-member@example.test`,
                role: 'member' as const
            }
        }
        const createdUsers = []
        for (const [key, value] of Object.entries(users)) {
            const created = await createAdminUser(bootstrapApi, {
                email: value.email,
                password,
                roleIds,
                comment: `Marketing-page ${key} permission coverage ${runManifest.runId}`
            })
            if (!created?.userId) throw new Error(`Permission user ${key} was not created`)
            await recordCreatedGlobalUser({ userId: created.userId, email: value.email })
            await waitForUser({ email: value.email, password })
            createdUsers.push(created)
        }

        for (const [index, value] of Object.values(users).entries()) {
            await sendWithCsrf(ownerApi, 'POST', `/api/v1/applications/${application.id}/members`, {
                email: value.email,
                role: value.role
            }).then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Adding ${value.role} marketing member failed with ${response.status}: ${await response.text()}`)
                }
            })
            expect(createdUsers[index]?.userId).toMatch(/^[0-9a-f-]{36}$/i)
        }

        adminApi = await createLoggedInApiContext({ email: users.admin.email, password })
        editorApi = await createLoggedInApiContext({ email: users.editor.email, password })
        memberApi = await createLoggedInApiContext({ email: users.member.email, password })

        const ownerLayouts = await listApplicationLayouts(ownerApi, application.id, { limit: 100, offset: 0 })
        const marketingLayout = ownerLayouts.items.find((layout: { templateKey?: string }) => layout.templateKey === 'marketing-page')
        if (!marketingLayout?.id) throw new Error('Permission fixture did not expose the synced marketing layout')

        const ownerRuntime = await getApiResponse(ownerApi, `/api/v1/applications/${application.id}/runtime/marketing-page`)
        expect(ownerRuntime.status).toBe(200)
        expect((await ownerRuntime.json()).templateKey).toBe('marketing-page')

        anonymousContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        const anonymousPage = await anonymousContext.newPage()
        const anonymousRuntime = await anonymousPage.request.get(`/api/v1/applications/${application.id}/runtime/marketing-page`)
        expect(anonymousRuntime.status()).toBe(401)
        const anonymousLayouts = await anonymousPage.request.get(`/api/v1/applications/${application.id}/layouts`)
        expect(anonymousLayouts.status()).toBe(401)

        const adminRuntime = await getApiResponse(adminApi, `/api/v1/applications/${application.id}/runtime/marketing-page`)
        const editorRuntime = await getApiResponse(editorApi, `/api/v1/applications/${application.id}/runtime/marketing-page`)
        const memberRuntime = await getApiResponse(memberApi, `/api/v1/applications/${application.id}/runtime/marketing-page`)
        for (const response of [adminRuntime, editorRuntime, memberRuntime]) {
            expect(response.status).toBe(200)
            expect((await response.json()).templateKey).toBe('marketing-page')
        }

        const workspacePayload = await listApplicationWorkspaces(ownerApi, application.id)
        const ownerPersonalWorkspace = (workspacePayload.items ?? []).find(
            (workspace: { workspaceType?: string; id?: string }) => workspace.workspaceType === 'personal'
        )
        if (!ownerPersonalWorkspace?.id) throw new Error('Permission fixture owner personal workspace was not materialized')

        const memberRuntimeView = await getMarketingPageRuntime(memberApi, application.id, 'en')
        const memberSiteSettingsRecord = memberRuntimeView.marketingPage?.records?.find(
            (record: { kind?: string; id?: string }) => record.kind === 'siteSettings'
        )
        if (!memberSiteSettingsRecord?.id) throw new Error('Permission fixture member site-settings row was not materialized')
        const memberRuntimeData = await getRuntimeAppData(memberApi, application.id, {
            objectCollectionCodename: 'MarketingPageSiteSettings',
            locale: 'en'
        })
        const memberWorkspaceId = memberRuntimeData.currentWorkspaceId
        if (!isUuidV7(memberWorkspaceId)) throw new Error('Permission fixture member personal workspace was not materialized')
        const memberSiteSettingsCollection = (memberRuntimeData.objectCollections ?? []).find(
            (collection: { codename?: string; id?: string }) => collection.codename === 'MarketingPageSiteSettings'
        )
        if (!memberSiteSettingsCollection?.id) throw new Error('Permission fixture member site-settings collection was not materialized')
        const memberRowBefore = await getRuntimeRow(memberApi, application.id, memberSiteSettingsRecord.id, {
            objectCollectionId: memberSiteSettingsCollection.id,
            workspaceId: memberWorkspaceId
        })
        expect(memberRowBefore).toBeTruthy()
        expect(memberRuntimeData.permissions).toMatchObject({ createContent: false, editContent: false, deleteContent: false })

        const memberContentMutationResponses = await Promise.all([
            sendWithCsrf(memberApi, 'POST', `/api/v1/applications/${application.id}/runtime/rows?workspaceId=${memberWorkspaceId}`, {
                objectCollectionId: memberSiteSettingsCollection.id,
                data: {}
            }),
            sendWithCsrf(
                memberApi,
                'PATCH',
                `/api/v1/applications/${application.id}/runtime/rows/${memberSiteSettingsRecord.id}?objectCollectionId=${memberSiteSettingsCollection.id}&workspaceId=${memberWorkspaceId}`,
                { objectCollectionId: memberSiteSettingsCollection.id, data: {} }
            ),
            sendWithCsrf(
                memberApi,
                'POST',
                `/api/v1/applications/${application.id}/runtime/rows/${memberSiteSettingsRecord.id}/copy?workspaceId=${memberWorkspaceId}`,
                { objectCollectionId: memberSiteSettingsCollection.id }
            ),
            sendWithCsrf(
                memberApi,
                'DELETE',
                `/api/v1/applications/${application.id}/runtime/rows/${memberSiteSettingsRecord.id}?objectCollectionId=${memberSiteSettingsCollection.id}&workspaceId=${memberWorkspaceId}`
            )
        ])
        for (const response of memberContentMutationResponses) expect(response.status).toBe(403)
        const memberRowAfter = await getRuntimeRow(memberApi, application.id, memberSiteSettingsRecord.id, {
            objectCollectionId: memberSiteSettingsCollection.id,
            workspaceId: memberWorkspaceId
        })
        expect(memberRowAfter).toEqual(memberRowBefore)

        const editorRuntimeView = await getMarketingPageRuntime(editorApi, application.id, 'en')
        const editorSiteSettingsRecord = editorRuntimeView.marketingPage?.records?.find(
            (record: { kind?: string; id?: string }) => record.kind === 'siteSettings'
        )
        if (!editorSiteSettingsRecord?.id) throw new Error('Permission fixture editor site-settings row was not materialized')
        const editorRuntimeData = await getRuntimeAppData(editorApi, application.id, {
            objectCollectionCodename: 'MarketingPageSiteSettings',
            locale: 'en'
        })
        const editorWorkspaceId = editorRuntimeData.currentWorkspaceId
        if (!isUuidV7(editorWorkspaceId)) throw new Error('Permission fixture editor personal workspace was not materialized')
        const editorSiteSettingsCollection = (editorRuntimeData.objectCollections ?? []).find(
            (collection: { codename?: string; id?: string }) => collection.codename === 'MarketingPageSiteSettings'
        )
        if (!editorSiteSettingsCollection?.id) throw new Error('Permission fixture editor site-settings collection was not materialized')
        const editorRowBefore = await getRuntimeRow(editorApi, application.id, editorSiteSettingsRecord.id, {
            objectCollectionId: editorSiteSettingsCollection.id,
            workspaceId: editorWorkspaceId
        })
        expect(editorRuntimeData.permissions).toMatchObject({ createContent: true, editContent: true, deleteContent: false })
        const heroTitleColumn = (editorRuntimeData.columns ?? []).find(
            (column: { codename?: string; field?: string }) =>
                String(column.codename ?? '').toLowerCase() === 'herotitle' || String(column.field ?? '').toLowerCase() === 'herotitle'
        )
        const editorHeroTitle = editorRowBefore?.data?.HeroTitle ?? editorRowBefore?.data?.[heroTitleColumn?.field ?? 'HeroTitle']
        expect(editorRowBefore).toBeTruthy()
        expect(heroTitleColumn?.field).toBeTruthy()
        expect(editorHeroTitle).toBeDefined()
        const editorMutation = await sendWithCsrf(
            editorApi,
            'PATCH',
            `/api/v1/applications/${application.id}/runtime/rows/${editorSiteSettingsRecord.id}?objectCollectionId=${editorSiteSettingsCollection.id}&workspaceId=${editorWorkspaceId}`,
            {
                objectCollectionId: editorSiteSettingsCollection.id,
                expectedVersion: Number(editorRowBefore?.version ?? editorRowBefore?._upl_version ?? 1),
                data: { [heroTitleColumn?.field ?? 'HeroTitle']: editorHeroTitle }
            }
        )
        expect(editorMutation.status).toBe(200)

        const editorOwnerWorkspaceMutation = await sendWithCsrf(
            editorApi,
            'PATCH',
            `/api/v1/applications/${application.id}/runtime/rows/${editorSiteSettingsRecord.id}?objectCollectionId=${editorSiteSettingsCollection.id}&workspaceId=${ownerPersonalWorkspace.id}`,
            {
                objectCollectionId: editorSiteSettingsCollection.id,
                data: { [heroTitleColumn?.field ?? 'HeroTitle']: editorHeroTitle }
            }
        )
        expect(editorOwnerWorkspaceMutation.status).toBe(403)

        const memberLayouts = await getApiResponse(memberApi, `/api/v1/applications/${application.id}/layouts`)
        expect(memberLayouts.status).toBe(403)
        const editorLayouts = await getApiResponse(editorApi, `/api/v1/applications/${application.id}/layouts`)
        expect(editorLayouts.status).toBe(403)

        const deniedMemberMutation = await sendWithCsrf(
            memberApi,
            'PATCH',
            `/api/v1/applications/${application.id}/layouts/${marketingLayout.id}`,
            {
                config: { themeMode: 'dark' },
                expectedVersion: marketingLayout.version
            }
        )
        expect(deniedMemberMutation.status).toBe(403)
        const deniedEditorMutation = await sendWithCsrf(
            editorApi,
            'PATCH',
            `/api/v1/applications/${application.id}/layouts/${marketingLayout.id}`,
            {
                config: { themeMode: 'dark' },
                expectedVersion: marketingLayout.version
            }
        )
        expect(deniedEditorMutation.status).toBe(403)

        const adminMutation = await sendWithCsrf(
            adminApi,
            'PATCH',
            `/api/v1/applications/${application.id}/layouts/${marketingLayout.id}`,
            {
                config: { themeMode: 'dark' },
                expectedVersion: marketingLayout.version
            }
        )
        expect(adminMutation.status).toBe(200)
        const updatedLayout = await getApplicationLayout(ownerApi, application.id, marketingLayout.id)
        expect(updatedLayout.item.config).toMatchObject({ themeMode: 'dark' })

        const crossApplicationRuntime = await getApiResponse(
            memberApi,
            `/api/v1/applications/${unrelatedApplication.id}/runtime/marketing-page`
        )
        expect([403, 404]).toContain(crossApplicationRuntime.status)

        adminBrowser = await createLoggedInBrowserContext(
            browser,
            { email: users.admin.email, password },
            { basePathAfterLogin: `/a/${application.id}/admin/layouts/${marketingLayout.id}` }
        )
        await expect(adminBrowser.page).toHaveURL(new RegExp(`/a/${application.id}/admin/layouts/${marketingLayout.id}(?:\\?.*)?$`))
        await expect(adminBrowser.page.getByTestId('application-marketing-appearance-panel')).toBeVisible()
        await expect(adminBrowser.page.getByLabel('Theme mode')).toBeEnabled()

        memberBrowser = await createLoggedInBrowserContext(browser, { email: users.member.email, password })
        await memberBrowser.page.goto(`/a/${application.id}/admin/layouts`)
        await expect(memberBrowser.page).toHaveURL(new RegExp(`/a/${application.id}(?:\\?.*)?$`))
        await expect(memberBrowser.page.locator('#marketing-page-main')).toBeVisible()
        await expect(memberBrowser.page.getByTestId('application-marketing-appearance-panel')).toHaveCount(0)
        const memberBody = await memberBrowser.page.locator('body').innerText()
        expect(memberBody).not.toContain(application.id)
        expect(memberBody).not.toContain('[object Object]')
    } finally {
        await adminBrowser?.context.close().catch(() => undefined)
        await memberBrowser?.context.close().catch(() => undefined)
        await anonymousContext?.close().catch(() => undefined)
        if (adminApi) await disposeApiContext(adminApi)
        if (editorApi) await disposeApiContext(editorApi)
        if (memberApi) await disposeApiContext(memberApi)
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
