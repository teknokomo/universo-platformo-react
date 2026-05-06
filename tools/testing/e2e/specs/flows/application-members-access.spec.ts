import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { disposeBootstrapApiContext, createBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    createAdminUser,
    createApplication,
    createLoggedInApiContext,
    disposeApiContext,
    getAssignableRoles,
    listApplicationMembers,
    removeApplicationMember,
    updateApplicationMember
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedGlobalUser } from '../../support/backend/run-manifest.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'

type ListedMember = {
    id: string
    userId: string
    email?: string | null
    role?: string
}

function resolveGlobalRoleIds(roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]) {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)

    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable global role(s) not found: ${missing.join(', ')}`)
    }

    return roleIds
}

function getListedMembers(payload: { items?: ListedMember[]; members?: ListedMember[] } | null | undefined): ListedMember[] {
    if (Array.isArray(payload?.items)) {
        return payload.items
    }

    if (Array.isArray(payload?.members)) {
        return payload.members
    }

    return []
}

async function waitForApplicationMember(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    predicate: (member: ListedMember) => boolean
) {
    let matchedMember: ListedMember | null = null

    await expect
        .poll(async () => {
            const payload = await listApplicationMembers(api, applicationId)
            matchedMember = getListedMembers(payload).find(predicate) ?? null
            return Boolean(matchedMember?.id)
        })
        .toBe(true)

    if (!matchedMember) {
        throw new Error(`Application member was not found for ${applicationId}`)
    }

    return matchedMember
}

async function waitForBrowserLoginReadiness(credentials: { email: string; password: string }) {
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

test('@flow @permission application admin access is enforced for invited members and owner can manage membership', async ({
    browser,
    runManifest
}) => {
    const bootstrapApi = await createBootstrapApiContext()
    const ownerApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const memberEmail = `e2e+${runManifest.runId}.application-member@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const applicationName = `E2E ${runManifest.runId} Access Application`
    const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    let ownerSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let memberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)

        const createdUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: defaultRoleIds,
            comment: `Created for application member coverage ${runManifest.runId}`
        })

        if (!createdUser?.userId) {
            throw new Error(`Created user ${memberEmail} did not return a user id`)
        }

        await recordCreatedGlobalUser({ userId: createdUser.userId, email: memberEmail })
        await waitForBrowserLoginReadiness({
            email: memberEmail,
            password: memberPassword
        })

        const application = await createApplication(ownerApi, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            isPublic: false
        })

        if (!application?.id) {
            throw new Error('Application creation did not return an id for member coverage')
        }

        await recordCreatedApplication({
            id: application.id,
            slug: application.slug
        })

        ownerSession = await createLoggedInBrowserContext(
            browser,
            {
                email: runManifest.testUser.email,
                password: runManifest.testUser.password
            },
            {
                basePathAfterLogin: `/a/${application.id}/admin/access`
            }
        )

        const ownerPage = ownerSession.page
        await ownerPage.goto(`/a/${application.id}/admin/access`)
        await expect(ownerPage).toHaveURL(new RegExp(`/a/${application.id}/admin/access(?:\\?.*)?$`))
        await expect(ownerPage.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()
        await ownerPage.getByTestId(toolbarSelectors.primaryAction).click()

        const inviteDialog = ownerPage.getByRole('dialog')
        await inviteDialog.getByLabel('Email').fill(memberEmail)
        await inviteDialog.getByLabel('Role').click()
        await ownerPage.getByRole('option', { name: 'Member' }).click()

        const inviteRequest = ownerPage.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${application.id}/members`)
        )
        await inviteDialog.getByRole('button', { name: 'Save' }).click()
        const inviteResponse = await inviteRequest
        expect(inviteResponse.ok()).toBe(true)
        await expect(inviteDialog).toHaveCount(0)

        const invitedMember = await waitForApplicationMember(ownerApi, application.id, (member) => member.userId === createdUser.userId)

        memberSession = await createLoggedInBrowserContext(browser, {
            email: memberEmail,
            password: memberPassword
        })

        const memberPage = memberSession.page
        await memberPage.goto(`/a/${application.id}/admin/access`)
        await expect(memberPage).toHaveURL(new RegExp(`/a/${application.id}(?:\\?.*)?$`))
        await expect(memberPage.getByText('Application is under development')).toBeVisible()

        await updateApplicationMember(ownerApi, application.id, invitedMember.id, {
            role: 'admin'
        })

        await expect
            .poll(async () => {
                const payload = await listApplicationMembers(ownerApi, application.id)
                return getListedMembers(payload).find((member) => member.id === invitedMember.id)?.role
            })
            .toBe('admin')

        await memberPage.goto(`/a/${application.id}/admin/access`)
        await expect(memberPage).toHaveURL(new RegExp(`/a/${application.id}/admin/access(?:\\?.*)?$`))
        await expect(memberPage.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()

        await removeApplicationMember(ownerApi, application.id, invitedMember.id)

        await expect
            .poll(async () => {
                const payload = await listApplicationMembers(ownerApi, application.id)
                return getListedMembers(payload).some((member) => member.id === invitedMember.id)
            })
            .toBe(false)
    } finally {
        await ownerSession?.context.close().catch(() => undefined)
        await memberSession?.context.close().catch(() => undefined)
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
