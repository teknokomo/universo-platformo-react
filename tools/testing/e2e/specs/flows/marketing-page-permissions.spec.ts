import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import {
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    copyApplicationLayout,
    deleteApplicationLayout,
    getApplicationLayout,
    getAssignableRoles,
    getMarketingPageRuntime,
    getRuntimeAppData,
    getRuntimeRow,
    resetApplicationLayoutWidgetConfigs,
    requestApi,
    listApplicationLayouts,
    listApplicationWorkspaces,
    listPublicationApplications,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    toggleApplicationLayoutWidgetActive,
    updateApplicationLayoutWidgetConfig,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
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
    let staleOwnerApi: ApiSession | null = null
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

        const crossApplicationMetahubCodename = `${runManifest.runId}-cross-application-marketing-permissions`
        const crossApplicationMetahub = await createMetahub(ownerApi, {
            name: { en: `E2E ${runManifest.runId} cross-application marketing permissions` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', crossApplicationMetahubCodename),
            templateCodename: 'marketing-page'
        })
        if (!crossApplicationMetahub?.id) throw new Error('Cross-application permission metahub creation did not return an id')
        await recordCreatedMetahub({
            id: crossApplicationMetahub.id,
            name: crossApplicationMetahubCodename,
            codename: crossApplicationMetahubCodename
        })

        const crossApplicationPublication = await createPublication(ownerApi, crossApplicationMetahub.id, {
            name: { en: `E2E ${runManifest.runId} cross-application marketing permission canary` },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            applicationName: { en: `E2E ${runManifest.runId} cross-application marketing permission canary` },
            applicationNamePrimaryLocale: 'en',
            runtimePolicy: {
                workspaceMode: 'required',
                requiredWorkspaceModeAcknowledged: true
            }
        })
        if (!crossApplicationPublication?.id) throw new Error('Cross-application publication creation did not return an id')
        await recordCreatedPublication({
            id: crossApplicationPublication.id,
            metahubId: crossApplicationMetahub.id,
            schemaName: crossApplicationPublication.schemaName
        })
        await syncPublication(ownerApi, crossApplicationMetahub.id, crossApplicationPublication.id)
        await waitForPublicationReady(ownerApi, crossApplicationMetahub.id, crossApplicationPublication.id)
        const unrelatedApplication = await waitForLinkedApplication(ownerApi, crossApplicationMetahub.id, crossApplicationPublication.id)
        await recordCreatedApplication({ id: unrelatedApplication.id, slug: unrelatedApplication.slug })
        await syncApplicationSchema(ownerApi, unrelatedApplication.id, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })

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
        const memberSiteSettingsRecord = flattenMarketingPageRecords(memberRuntimeView).find((record) => record.kind === 'siteSettings')
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
        const editorSiteSettingsRecord = flattenMarketingPageRecords(editorRuntimeView).find((record) => record.kind === 'siteSettings')
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

        const marketingDetail = await getApplicationLayout(ownerApi, application.id, marketingLayout.id)
        const faqWidget = marketingDetail.widgets?.find((widget: { widgetKey?: string }) => widget.widgetKey === 'marketing.collection')
        if (!faqWidget?.id || typeof faqWidget.version !== 'number' || !faqWidget.config) {
            throw new Error('Marketing permission fixture did not expose a versioned collection widget')
        }

        // Direct widget endpoint matrix: CSRF, role boundary, and cross-app identity.
        const noCsrfMutation = await requestApi(
            adminApi,
            `/api/v1/applications/${application.id}/layouts/${marketingLayout.id}/zone-widget/${faqWidget.id}/toggle-active`,
            {
                method: 'PATCH',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: faqWidget.isActive, expectedVersion: faqWidget.version })
            }
        )
        // The platform error middleware deliberately uses 419 for an invalid or
        // missing CSRF proof, before the route-level RBAC check is reached.
        expect(noCsrfMutation.status).toBe(419)

        for (const deniedApi of [editorApi, memberApi]) {
            const deniedWidgetMutation = await sendWithCsrf(
                deniedApi,
                'PATCH',
                `/api/v1/applications/${application.id}/layouts/${marketingLayout.id}/zone-widget/${faqWidget.id}/toggle-active`,
                { isActive: faqWidget.isActive, expectedVersion: faqWidget.version }
            )
            expect(deniedWidgetMutation.status).toBe(403)
        }

        const crossApplicationLayouts = await listApplicationLayouts(ownerApi, unrelatedApplication.id, { limit: 100, offset: 0 })
        const crossApplicationLayout = crossApplicationLayouts.items.find(
            (layout: { templateKey?: string }) => layout.templateKey === 'marketing-page'
        )
        if (!crossApplicationLayout?.id) throw new Error('Cross-application fixture did not expose a marketing layout')
        const crossApplicationWidgetMutation = await sendWithCsrf(
            ownerApi,
            'PATCH',
            `/api/v1/applications/${unrelatedApplication.id}/layouts/${crossApplicationLayout.id}/zone-widget/${faqWidget.id}/toggle-active`,
            { isActive: faqWidget.isActive, expectedVersion: faqWidget.version }
        )
        expect(crossApplicationWidgetMutation.status).toBe(404)

        const crossApplicationState = await getApplicationLayout(ownerApi, application.id, marketingLayout.id)
        expect(crossApplicationState.widgets?.find((widget: { id?: string }) => widget.id === faqWidget.id)).toMatchObject({
            id: faqWidget.id,
            version: faqWidget.version,
            isActive: faqWidget.isActive
        })

        // Two authenticated sessions must reject the stale optimistic-lock write.
        staleOwnerApi = await createLoggedInApiContext(ownerCredentials)
        const staleVersion = faqWidget.version
        const nextActive = !faqWidget.isActive
        const firstSessionMutation = await toggleApplicationLayoutWidgetActive(
            ownerApi,
            application.id,
            marketingLayout.id,
            faqWidget.id,
            nextActive,
            staleVersion
        )
        expect(firstSessionMutation.item).toMatchObject({ id: faqWidget.id, isActive: nextActive })
        const staleSessionMutation = await sendWithCsrf(
            staleOwnerApi,
            'PATCH',
            `/api/v1/applications/${application.id}/layouts/${marketingLayout.id}/zone-widget/${faqWidget.id}/toggle-active`,
            { isActive: faqWidget.isActive, expectedVersion: staleVersion }
        )
        expect(staleSessionMutation.status).toBe(409)
        const restoredWidget = await toggleApplicationLayoutWidgetActive(
            ownerApi,
            application.id,
            marketingLayout.id,
            faqWidget.id,
            faqWidget.isActive,
            firstSessionMutation.item.version
        )
        expect(restoredWidget.item).toMatchObject({ id: faqWidget.id, isActive: faqWidget.isActive })

        // Empty reset is a deliberate no-op rejection; it must not alter the widget.
        const noOpReset = await sendWithCsrf(ownerApi, 'POST', `/api/v1/applications/${application.id}/layouts/zone-widgets/config/reset`, {
            updates: []
        })
        expect(noOpReset.status).toBe(400)
        const unchangedAfterNoOp = await getApplicationLayout(ownerApi, application.id, marketingLayout.id)
        expect(unchangedAfterNoOp.widgets?.find((widget: { id?: string }) => widget.id === faqWidget.id)).toMatchObject({
            id: faqWidget.id,
            isActive: faqWidget.isActive
        })

        // Copy/delete/reset must preserve target identity and never reuse a source instance id.
        const sourceForCopy = await getApplicationLayout(ownerApi, application.id, marketingLayout.id)
        const copiedLayoutResponse = await copyApplicationLayout(ownerApi, application.id, marketingLayout.id, sourceForCopy.item.version)
        const copiedLayoutId = copiedLayoutResponse.item?.id
        if (!copiedLayoutId || copiedLayoutId === marketingLayout.id) throw new Error('Marketing layout copy reused the source layout id')
        const copiedDetail = await getApplicationLayout(ownerApi, application.id, copiedLayoutId)
        const copiedFaq = copiedDetail.widgets?.find((widget: { widgetKey?: string }) => widget.widgetKey === 'marketing.collection')
        expect(copiedFaq?.id).toBeTruthy()
        expect(copiedFaq?.id).not.toBe(faqWidget.id)
        expect(copiedFaq?.config?.instanceKey).not.toBe(faqWidget.config.instanceKey)

        const resetSourceWidget = sourceForCopy.widgets?.find((widget: { id?: string }) => widget.id === faqWidget.id)
        if (!resetSourceWidget?.id || typeof resetSourceWidget.version !== 'number') {
            throw new Error('Marketing source widget disappeared before reset identity check')
        }
        const customized = await updateApplicationLayoutWidgetConfig(ownerApi, application.id, marketingLayout.id, resetSourceWidget.id, {
            config: { ...resetSourceWidget.config, maxItems: Number(resetSourceWidget.config.maxItems ?? 100) + 1 },
            expectedVersion: resetSourceWidget.version
        })
        expect(customized.item.id).toBe(resetSourceWidget.id)
        const resetResult = await resetApplicationLayoutWidgetConfigs(ownerApi, application.id, [
            { layoutId: marketingLayout.id, widgetId: resetSourceWidget.id, expectedVersion: customized.item.version }
        ])
        expect(resetResult.items?.[0]).toMatchObject({ id: resetSourceWidget.id, layoutId: marketingLayout.id, isCustomized: false })
        expect(resetResult.items?.[0].config).toEqual(resetResult.items?.[0].sourceConfig)

        await deleteApplicationLayout(ownerApi, application.id, copiedLayoutId, copiedDetail.item.version)
        const deletedCopyResponse = await requestApi(ownerApi, `/api/v1/applications/${application.id}/layouts/${copiedLayoutId}`, {
            method: 'GET'
        })
        expect(deletedCopyResponse.status).toBe(404)
        const sourceStillPresent = await getApplicationLayout(ownerApi, application.id, marketingLayout.id)
        expect(sourceStillPresent.item.id).toBe(marketingLayout.id)

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
        if (staleOwnerApi) await disposeApiContext(staleOwnerApi)
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
