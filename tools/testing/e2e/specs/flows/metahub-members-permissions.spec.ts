import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { disposeBootstrapApiContext, createBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getAssignableRoles,
    listMetahubMembers,
    removeMetahubMember,
    updateMetahubMember
} from '../../support/backend/api-session.mjs'
import { recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { buildEntityMenuTriggerSelector, toolbarSelectors } from '../../support/selectors/contracts'

test.setTimeout(180_000)

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

function getListedMembers(payload: { members?: ListedMember[]; items?: ListedMember[] } | null | undefined): ListedMember[] {
    if (Array.isArray(payload?.members)) {
        return payload.members
    }

    if (Array.isArray(payload?.items)) {
        return payload.items
    }

    return []
}

async function waitForMetahubMember(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    predicate: (member: ListedMember) => boolean
) {
    let matchedMember: ListedMember | null = null

    await expect
        .poll(async () => {
            const payload = await listMetahubMembers(api, metahubId)
            matchedMember = getListedMembers(payload).find(predicate) ?? null
            return Boolean(matchedMember?.id)
        })
        .toBe(true)

    if (!matchedMember) {
        throw new Error(`Metahub member was not found for ${metahubId}`)
    }

    return matchedMember
}

test('@flow @permission metahub members UI respects manageMembers permission boundaries and persists invite-edit-remove actions', async ({
    browser,
    runManifest
}) => {
    const bootstrapApi = await createBootstrapApiContext()
    const ownerApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const memberEmail = `e2e+${runManifest.runId}.metahub-member@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const metahubName = `E2E ${runManifest.runId} Members Metahub`
    const metahubCodename = `${runManifest.runId}-members-metahub`
    const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    let ownerSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let invitedSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)

        const createdUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: defaultRoleIds,
            comment: `Created for metahub member coverage ${runManifest.runId}`
        })

        if (!createdUser?.userId) {
            throw new Error(`Created user ${memberEmail} did not return a user id`)
        }

        await recordCreatedGlobalUser({ userId: createdUser.userId, email: memberEmail })

        const metahub = await createMetahub(ownerApi, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for member coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        ownerSession = await createLoggedInBrowserContext(
            browser,
            {
                email: runManifest.testUser.email,
                password: runManifest.testUser.password
            },
            {
                basePathAfterLogin: `/metahub/${metahub.id}/members`
            }
        )

        const ownerPage = ownerSession.page
        await ownerPage.goto(`/metahub/${metahub.id}/members`)
        await expect(ownerPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/members(?:\\?.*)?$`))
        await expect(ownerPage.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()
        await ownerPage.getByTestId(toolbarSelectors.primaryAction).click()

        const inviteDialog = ownerPage.getByRole('dialog')
        await inviteDialog.getByLabel('Email').fill(memberEmail)
        await inviteDialog.getByLabel('Role').click()
        await ownerPage.getByRole('option', { name: 'Editor' }).click()

        const inviteRequest = ownerPage.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/members`)
        )

        await inviteDialog.getByRole('button', { name: 'Save' }).click()

        const inviteResponse = await inviteRequest
        expect(inviteResponse.ok()).toBe(true)
        await expect(inviteDialog).toHaveCount(0)

        const invitedMember = await waitForMetahubMember(ownerApi, metahub.id, (member) => member.userId === createdUser.userId)

        invitedSession = await createLoggedInBrowserContext(browser, {
            email: memberEmail,
            password: memberPassword
        })

        const invitedPage = invitedSession.page
        await invitedPage.goto(`/metahub/${metahub.id}/members`)
        await expect(invitedPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/members(?:\\?.*)?$`))
        await expect(invitedPage.getByText(memberEmail)).toBeVisible()
        await expect(invitedPage.getByTestId(toolbarSelectors.primaryAction)).toHaveCount(0)
        await expect(invitedPage.getByTestId(buildEntityMenuTriggerSelector('member', invitedMember.id))).toHaveCount(0)

        await updateMetahubMember(ownerApi, metahub.id, invitedMember.id, { role: 'member' })

        await expect
            .poll(async () => {
                const payload = await listMetahubMembers(ownerApi, metahub.id)
                return getListedMembers(payload).find((member) => member.id === invitedMember.id)?.role
            })
            .toBe('member')

        await removeMetahubMember(ownerApi, metahub.id, invitedMember.id)

        await expect
            .poll(async () => {
                const payload = await listMetahubMembers(ownerApi, metahub.id)
                return getListedMembers(payload).some((member) => member.id === invitedMember.id)
            })
            .toBe(false)
    } finally {
        await ownerSession?.context.close().catch(() => undefined)
        await invitedSession?.context.close().catch(() => undefined)
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
