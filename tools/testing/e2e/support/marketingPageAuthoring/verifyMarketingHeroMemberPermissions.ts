import { expect, type APIRequestContext, type Browser } from '@playwright/test'
import { createLoggedInBrowserContext } from '../browser/auth'
import { applyBrowserPreferences } from '../browser/preferences'
import {
    addMetahubMember,
    createAdminUser,
    createLoggedInApiContext,
    disposeApiContext,
    getAssignableRoles,
    listMetahubMembers
} from '../backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../backend/bootstrap.mjs'
import { recordCreatedGlobalUser } from '../backend/run-manifest.mjs'

export async function verifyMarketingHeroMemberPermissions(options: {
    browser: Browser
    api: APIRequestContext
    executionRunId: string
    memberPassword: string
    metahubId: string
    marketingLayoutId: string
    sourceHeroWidgetId: string
}): Promise<void> {
    const { browser, api, executionRunId, memberPassword, metahubId, marketingLayoutId, sourceHeroWidgetId } = options
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

        noEditContentBrowser = await createLoggedInBrowserContext(browser, { email: memberEmail, password: memberPassword })
        await applyBrowserPreferences(noEditContentBrowser.page, { language: 'en' })
        await noEditContentBrowser.page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
        await expect(noEditContentBrowser.page.getByTestId('metahub-layout-details-content')).toBeVisible()
        const readOnlyHeroSurface = noEditContentBrowser.page.getByTestId(`layout-widget-${sourceHeroWidgetId}`)
        await expect(readOnlyHeroSurface).toBeVisible()
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
