import { expect, type APIRequestContext, type Browser } from '@playwright/test'
import { createLoggedInBrowserContext } from '../browser/auth'
import { applyBrowserPreferences } from '../browser/preferences'
import {
    addMetahubMember,
    createAdminUser,
    createLoggedInApiContext,
    disposeApiContext,
    getAssignableRoles,
    getLayoutZoneWidgetBindings,
    listMetahubMembers,
    listRecords,
    sendWithCsrf
} from '../backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../backend/bootstrap.mjs'
import { recordCreatedGlobalUser } from '../backend/run-manifest.mjs'
import { expectNoTechnicalLeakage } from '../browser/runtimeUx'

export async function verifyMarketingHeroMemberPermissions(options: {
    browser: Browser
    api: APIRequestContext
    executionRunId: string
    memberPassword: string
    metahubId: string
    marketingLayoutId: string
    heroEntityId: string
    sourceHeroWidgetId: string
}): Promise<void> {
    const { browser, api, executionRunId, memberPassword, metahubId, marketingLayoutId, heroEntityId, sourceHeroWidgetId } = options
    const bootstrapApi = await createBootstrapApiContext()
    let noEditContentApi: APIRequestContext | null = null
    let noEditContentBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const userRole = assignableRoles.find((role: { codename?: string }) => role.codename?.toLowerCase() === 'user')
        if (typeof userRole?.id !== 'string') {
            throw new Error('The assignable User role was not available for the Hero permission fixture')
        }

        const memberEmail = `e2e+${executionRunId}.marketing-content-member@example.test`
        const createdMember = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: [userRole.id],
            comment: `Marketing Hero editContent browser coverage ${executionRunId}`
        })
        if (typeof createdMember?.userId !== 'string') throw new Error('The no-editContent Hero member account was not created')
        await recordCreatedGlobalUser({ userId: createdMember.userId, email: memberEmail })
        await expect
            .poll(
                async () => {
                    let readinessApi: APIRequestContext | null = null
                    try {
                        readinessApi = await createLoggedInApiContext({ email: memberEmail, password: memberPassword })
                        return true
                    } catch {
                        return false
                    } finally {
                        if (readinessApi) await disposeApiContext(readinessApi)
                    }
                },
                { timeout: 30_000, message: 'Waiting for the no-editContent member account to become available' }
            )
            .toBe(true)
        await addMetahubMember(api, metahubId, { email: memberEmail, role: 'member' })

        noEditContentApi = await createLoggedInApiContext({ email: memberEmail, password: memberPassword })
        const memberAccess = await listMetahubMembers(noEditContentApi, metahubId)
        expect(memberAccess).toMatchObject({ role: 'member', permissions: { editContent: false } })

        const sourceBinding = (await getLayoutZoneWidgetBindings(api, metahubId, marketingLayoutId, sourceHeroWidgetId, 'en')) as {
            bindings?: Array<{ slot?: string; semanticKey?: string }>
        }
        const sourceHeroKey = sourceBinding.bindings?.find((binding) => binding.slot === 'content')?.semanticKey
        if (!sourceHeroKey) throw new Error('The seeded Hero placement had no semantic Entity binding for the permission check')
        const initialRecords = (await listRecords(api, metahubId, heroEntityId, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const sourceHeroRecord = initialRecords.items?.find((record) => record.data?.HeroKey === sourceHeroKey)
        if (!sourceHeroRecord?.id || !sourceHeroRecord.data) {
            throw new Error('The bound Hero record was unavailable for the permission mutation checks')
        }

        const createProbeKey = `permission-probe-${executionRunId}`
        let deniedCreateStatus: number | undefined
        let createdProbeId: string | undefined
        let createRequestError: unknown
        try {
            const deniedCreateResponse = await sendWithCsrf(
                noEditContentApi,
                'POST',
                `/api/v1/metahub/${metahubId}/entities/object/instance/${heroEntityId}/records`,
                { data: { ...sourceHeroRecord.data, HeroKey: createProbeKey } }
            )
            deniedCreateStatus = deniedCreateResponse.status
            if (deniedCreateResponse.ok) {
                const createPayload = (await deniedCreateResponse.json().catch(() => null)) as {
                    id?: string
                    data?: { id?: string }
                } | null
                createdProbeId = createPayload?.id ?? createPayload?.data?.id
            }
        } catch (error) {
            createRequestError = error
        }

        const recordsAfterCreate = (await listRecords(api, metahubId, heroEntityId, {
            limit: 100,
            offset: 0
        })) as { items?: Array<{ id?: string; data?: Record<string, unknown> }> }
        if (!Array.isArray(recordsAfterCreate.items)) {
            throw new Error('The Hero permission-probe cleanup could not verify the Object records')
        }
        const probeIds = new Set(
            recordsAfterCreate.items
                .filter((record) => record.data?.HeroKey === createProbeKey)
                .map((record) => record.id)
                .filter((id): id is string => typeof id === 'string')
        )
        if (typeof createdProbeId === 'string') probeIds.add(createdProbeId)
        for (const probeId of probeIds) {
            const cleanupResponse = await sendWithCsrf(
                api,
                'DELETE',
                `/api/v1/metahub/${metahubId}/entities/object/instance/${heroEntityId}/record/${probeId}`
            )
            if (!cleanupResponse.ok) {
                throw new Error(`The Hero permission-probe record cleanup failed with ${cleanupResponse.status}`)
            }
        }
        const recordsAfterCleanup = (await listRecords(api, metahubId, heroEntityId, {
            limit: 100,
            offset: 0
        })) as { items?: Array<{ data?: Record<string, unknown> }> }
        if (
            !Array.isArray(recordsAfterCleanup.items) ||
            recordsAfterCleanup.items.some((record) => record.data?.HeroKey === createProbeKey)
        ) {
            throw new Error('The Hero permission-probe record remained after cleanup')
        }
        if (createRequestError) throw createRequestError
        expect(deniedCreateStatus).toBe(403)

        const deniedUpdateResponse = await sendWithCsrf(
            noEditContentApi,
            'PATCH',
            `/api/v1/metahub/${metahubId}/entities/object/instance/${heroEntityId}/record/${sourceHeroRecord.id}`,
            { data: sourceHeroRecord.data }
        )
        const recordsAfterDeniedUpdate = (await listRecords(api, metahubId, heroEntityId, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const heroAfterDeniedUpdate = recordsAfterDeniedUpdate.items?.find((record) => record.id === sourceHeroRecord.id)
        expect(heroAfterDeniedUpdate?.data).toEqual(sourceHeroRecord.data)
        expect(deniedUpdateResponse.status).toBe(403)

        noEditContentBrowser = await createLoggedInBrowserContext(browser, { email: memberEmail, password: memberPassword })
        await applyBrowserPreferences(noEditContentBrowser.page, { language: 'en' })
        await noEditContentBrowser.page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
        await expect(noEditContentBrowser.page.getByTestId('metahub-layout-details-content')).toBeVisible()
        const readOnlyHeroSurface = noEditContentBrowser.page.getByTestId(`layout-widget-${sourceHeroWidgetId}`)
        await expect(readOnlyHeroSurface).toBeVisible()
        await expectNoTechnicalLeakage(readOnlyHeroSurface, {
            label: 'Read-only Marketing Hero surface',
            checkUuidSubstrings: true
        })
        await expect(readOnlyHeroSurface.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
        await expect(noEditContentBrowser.page.getByRole('button', { name: 'Create record', exact: true })).toHaveCount(0)
        await expect(noEditContentBrowser.page.getByRole('button', { name: 'Edit record', exact: true })).toHaveCount(0)
        await expect(noEditContentBrowser.page.getByRole('dialog', { name: 'Hero content', exact: true })).toHaveCount(0)
    } finally {
        await noEditContentBrowser?.context.close().catch(() => undefined)
        if (noEditContentApi) await disposeApiContext(noEditContentApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
}
