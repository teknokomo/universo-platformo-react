import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { createAdminUser, createLoggedInApiContext, disposeApiContext, getAssignableRoles } from '../../support/backend/api-session.mjs'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import { applicationSelectors, entityDialogSelectors } from '../../support/selectors/contracts'
import { setupPublishedLmsApplication, waitForApplicationCatalogId } from '../../support/lmsRuntime'

function resolveGlobalRoleIds(roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]) {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)

    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable global role(s) not found: ${missing.join(', ')}`)
    }

    return roleIds
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

async function createRuntimeRowViaBrowser(page: Page, title: string) {
    await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })
    await page.getByTestId(applicationSelectors.runtimeCreateButton).click()

    const createDialog = page.getByRole('dialog', { name: 'Create element' })
    await expect(createDialog).toBeVisible()
    await createDialog.getByLabel('Title').first().fill(title)
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 30_000 })
}

async function switchWorkspace(page: Page, workspaceName: string) {
    const switcher = page.getByRole('combobox').first()
    await expect(switcher).toBeVisible({ timeout: 30_000 })
    await switcher.click()
    await page.getByRole('option', { name: workspaceName }).click()
}

test('@flow lms workspace management isolates module runtime rows across personal and shared workspaces', async ({
    browser,
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const bootstrapApi = await createBootstrapApiContext()
    const ownerApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const memberEmail = `e2e+${runManifest.runId}.lms-workspace@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    let memberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const lms = await setupPublishedLmsApplication(ownerApi, {
            runId: runManifest.runId,
            label: 'Workspace',
            workspacesEnabled: true
        })

        await recordCreatedMetahub({
            id: lms.metahub.id,
            name: `E2E ${runManifest.runId} Workspace LMS`,
            codename: `${runManifest.runId}-workspace-lms`
        })
        await recordCreatedPublication({
            id: lms.publication.id,
            metahubId: lms.metahub.id,
            schemaName: lms.publication.schemaName
        })
        await recordCreatedApplication({
            id: lms.applicationId,
            slug: lms.applicationSlug
        })

        const modulesCatalogId = await waitForApplicationCatalogId(ownerApi, lms.applicationId, 'Modules')

        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)

        const createdUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: defaultRoleIds,
            comment: `Created for LMS workspace management flow ${runManifest.runId}`
        })

        if (!createdUser?.userId) {
            throw new Error(`Created user ${memberEmail} did not return a user id`)
        }

        await recordCreatedGlobalUser({ userId: createdUser.userId, email: memberEmail })
        await waitForBrowserLoginReadiness({ email: memberEmail, password: memberPassword })

        const sharedWorkspaceName = `Shared LMS ${runManifest.runId}`
        const sharedWorkspaceCodename = `shared-lms-${runManifest.runId}`
        const sharedModuleTitle = `Shared workspace module ${runManifest.runId}`

        await page.goto(`/a/${lms.applicationId}?catalogId=${modulesCatalogId}`)
        const ownerPersonalWorkspaceName = (await page.getByRole('combobox').first().textContent())?.trim() || 'Main'
        await expect(page.getByRole('button', { name: 'Manage workspaces' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Manage workspaces' }).click()

        const managerDialog = page.getByRole('dialog', { name: 'Workspaces' })
        await expect(managerDialog).toBeVisible()
        await managerDialog.getByLabel('Workspace name').fill(sharedWorkspaceName)
        await managerDialog.getByLabel('Codename').fill(sharedWorkspaceCodename)
        await managerDialog.getByRole('button', { name: 'New workspace' }).click()
        await expect(managerDialog.getByText(sharedWorkspaceName, { exact: true })).toBeVisible({ timeout: 30_000 })

        await managerDialog.getByRole('button', { name: sharedWorkspaceName }).click()
        await managerDialog.getByLabel('User ID').fill(createdUser.userId)
        await managerDialog.getByRole('button', { name: 'Invite' }).click()
        await expect(managerDialog.getByText(createdUser.userId, { exact: true })).toBeVisible({ timeout: 30_000 })
        await managerDialog.getByRole('button', { name: 'Close' }).click()
        await expect(managerDialog).toBeHidden({ timeout: 30_000 })

        await switchWorkspace(page, sharedWorkspaceName)
        await createRuntimeRowViaBrowser(page, sharedModuleTitle)

        memberSession = await createLoggedInBrowserContext(browser, {
            email: memberEmail,
            password: memberPassword
        })

        const memberPage = memberSession.page
        await memberPage.goto(`/a/${lms.applicationId}?catalogId=${modulesCatalogId}`)
        const memberPersonalWorkspaceName = (await memberPage.getByRole('combobox').first().textContent())?.trim() || 'Main'
        await expect(memberPage.getByText(sharedModuleTitle, { exact: true })).toHaveCount(0)

        await switchWorkspace(memberPage, sharedWorkspaceName)
        await expect(memberPage.getByText(sharedModuleTitle, { exact: true })).toBeVisible({ timeout: 30_000 })

        await switchWorkspace(memberPage, memberPersonalWorkspaceName)
        await expect(memberPage.getByText(sharedModuleTitle, { exact: true })).toHaveCount(0)

        await switchWorkspace(page, ownerPersonalWorkspaceName)
        await expect(page.getByText(sharedModuleTitle, { exact: true })).toHaveCount(0)

        await switchWorkspace(page, sharedWorkspaceName)
        await expect(page.getByText(sharedModuleTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
    } finally {
        await memberSession?.context.close().catch(() => undefined)
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})