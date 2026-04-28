import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    addApplicationMember,
    createAdminUser,
    createLoggedInApiContext,
    disposeApiContext,
    getAssignableRoles,
    listApplicationMembers,
    listApplicationWorkspaces,
    setApplicationDefaultWorkspace
} from '../../support/backend/api-session.mjs'
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
    const statusControl = createDialog.getByLabel('Status')
    if ((await statusControl.count()) > 0) {
        await statusControl.click()
        await page.getByRole('option', { name: 'Published' }).click()
    }
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 30_000 })
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readWorkspaceName(name: unknown): string {
    if (typeof name === 'string') return name
    if (!name || typeof name !== 'object') return ''
    const locales = (name as Record<string, unknown>).locales
    const primary = (name as Record<string, unknown>)._primary
    if (!locales || typeof locales !== 'object') return ''
    if (typeof primary === 'string') {
        const primaryContent = (locales as Record<string, Record<string, unknown>>)[primary]?.content
        if (typeof primaryContent === 'string') return primaryContent
    }
    const englishContent = (locales as Record<string, Record<string, unknown>>).en?.content
    if (typeof englishContent === 'string') return englishContent
    for (const localeValue of Object.values(locales as Record<string, Record<string, unknown>>)) {
        if (typeof localeValue?.content === 'string') return localeValue.content
    }
    return ''
}

type WorkspaceTarget = {
    id: string
    name: string
}

function requireWorkspace(
    items: Array<{ id?: string; name?: unknown; workspaceType?: string; type?: string }>,
    predicate: (workspace: { id?: string; name?: unknown; workspaceType?: string; type?: string }) => boolean,
    label: string
): WorkspaceTarget {
    const workspace = items.find(predicate)
    if (!workspace?.id) {
        throw new Error(`Application workspace not found: ${label}`)
    }
    return {
        id: workspace.id,
        name: readWorkspaceName(workspace.name) || workspace.id
    }
}

async function switchWorkspace(page: Page, workspace: WorkspaceTarget | string) {
    const workspaceId = typeof workspace === 'string' ? null : workspace.id
    const workspaceName = typeof workspace === 'string' ? workspace : workspace.name
    const switcher = page.getByTestId('runtime-workspace-switcher').first()
    await expect(switcher).toBeVisible({ timeout: 30_000 })

    if (workspaceId) {
        const currentWorkspaceId = await switcher
            .locator('input')
            .first()
            .inputValue()
            .catch(() => '')
        if (currentWorkspaceId === workspaceId) {
            return
        }
    } else {
        const currentWorkspaceName = (await switcher.textContent())?.trim()
        if (currentWorkspaceName === workspaceName) {
            return
        }
    }

    await switcher.getByRole('combobox').click()
    if (workspaceId) {
        await page.locator(`[role="option"][data-value="${workspaceId}"]`).click()
        await expect(switcher.locator('input').first()).toHaveValue(workspaceId, { timeout: 30_000 })
        return
    }

    await page
        .getByRole('option', { name: new RegExp(`^${escapeRegex(workspaceName)}(?:\\s|$)`) })
        .first()
        .click()
    await expect(switcher).toContainText(workspaceName, { timeout: 30_000 })
}

test('@flow lms workspace management isolates module runtime rows across personal and shared workspaces', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(480_000)

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
    let memberApi: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null

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
        await addApplicationMember(ownerApi, lms.applicationId, {
            email: memberEmail,
            role: 'member'
        })
        await expect
            .poll(async () => {
                const payload = await listApplicationMembers(ownerApi, lms.applicationId)
                const members = Array.isArray(payload?.items) ? payload.items : []
                return members.some((member: { userId?: string }) => member.userId === createdUser.userId)
            })
            .toBe(true)

        const sharedWorkspaceName = `Shared LMS ${runManifest.runId}`
        const sharedModuleTitle = `Shared workspace module ${runManifest.runId}`
        const initialOwnerWorkspacesPayload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
        const initialOwnerWorkspaces = Array.isArray(initialOwnerWorkspacesPayload?.items) ? initialOwnerWorkspacesPayload.items : []
        expect(initialOwnerWorkspaces.filter((workspace) => (workspace.workspaceType ?? workspace.type) === 'personal')).toHaveLength(1)
        expect(initialOwnerWorkspaces.filter((workspace) => (workspace.workspaceType ?? workspace.type) === 'shared')).toHaveLength(0)
        const ownerPersonalWorkspace = requireWorkspace(
            initialOwnerWorkspaces,
            (workspace) => (workspace.workspaceType ?? workspace.type) === 'personal',
            'owner personal workspace'
        )
        const modulesCatalogId = await waitForApplicationCatalogId(ownerApi, lms.applicationId, 'Modules')

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${lms.applicationId}/workspaces`)
        await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Overview' })).toHaveCount(0)
        await expect(page.getByText('Users', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Conversions', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Event count', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Plan about to expire', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Riley Carter', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Sitemark-web', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Modules', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Workspaces', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(/Rows per page/i).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(memberEmail, { exact: true })).toHaveCount(0)
        await page.screenshot({ path: testInfo.outputPath('runtime-workspaces-page.png'), fullPage: true })
        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/a/${lms.applicationId}/workspaces`)
        await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Рабочие пространства', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('runtime-workspaces-card-view')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Основное', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('runtime-workspace-switcher').first()).toContainText('Основное')
        await expect(page.getByTestId('runtime-workspace-switcher').first()).not.toContainText('Main')
        await page.screenshot({ path: testInfo.outputPath('runtime-workspaces-page-ru.png'), fullPage: true })
        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${lms.applicationId}/workspaces`)
        await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('button', { name: 'Manage workspaces' })).toHaveCount(0)
        const sidebarWorkspaceSwitcher = page.getByTestId('runtime-workspace-switcher').first()
        await sidebarWorkspaceSwitcher.getByRole('combobox').click()
        await expect(page.getByRole('option', { name: /Manage workspaces/ })).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('runtime-workspace-switcher-menu.png'), fullPage: true })
        await page.keyboard.press('Escape')
        await page.getByText('Modules', { exact: true }).first().click()
        await expect(page).toHaveURL(new RegExp(`/a/${lms.applicationId}/${modulesCatalogId}`))
        await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('runtime-workspace-switcher')).toHaveCount(1)
        await page.goto(`/a/${lms.applicationId}/workspaces`)
        await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })

        await page.getByRole('button', { name: 'Create' }).click()
        const createWorkspaceDialog = page.getByRole('dialog', { name: 'Create workspace' })
        await createWorkspaceDialog.getByLabel('Workspace name').fill(sharedWorkspaceName)
        await createWorkspaceDialog.getByLabel('Workspace description').fill(`Shared workspace for ${runManifest.runId}`)
        await createWorkspaceDialog.getByRole('button', { name: 'Create' }).click()
        await expect(page).toHaveURL(new RegExp(`/a/${lms.applicationId}/workspaces/[0-9a-f-]{36}$`), { timeout: 30_000 })
        const createdWorkspaceId = page.url().split('/').at(-1)
        if (!createdWorkspaceId) {
            throw new Error('Created workspace id was not present in the runtime URL')
        }
        await expect
            .poll(
                async () => {
                    const payload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
                    const items = Array.isArray(payload?.items) ? payload.items : []
                    return items.some((workspace: { id?: string }) => workspace.id === createdWorkspaceId)
                },
                { timeout: 30_000 }
            )
            .toBe(true)
        const ownerWorkspacesAfterCreatePayload = await listApplicationWorkspaces(ownerApi, lms.applicationId)
        const ownerWorkspacesAfterCreate = Array.isArray(ownerWorkspacesAfterCreatePayload?.items)
            ? ownerWorkspacesAfterCreatePayload.items
            : []
        const sharedWorkspace = requireWorkspace(
            ownerWorkspacesAfterCreate,
            (workspace) => workspace.id === createdWorkspaceId,
            'created shared workspace'
        )
        await expect(page.getByRole('heading', { name: sharedWorkspaceName })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('link', { name: 'Access', exact: true })).toBeVisible({ timeout: 30_000 })

        await page.goto(`/a/${lms.applicationId}/workspaces`)
        const workspacePage = page.getByTestId('runtime-workspaces-page')
        const sharedWorkspaceLocator = workspacePage.getByText(sharedWorkspaceName, { exact: true }).first()
        await expect(sharedWorkspaceLocator).toBeVisible({ timeout: 30_000 })
        const sharedWorkspaceCard = workspacePage.getByTestId('runtime-workspace-card').filter({ hasText: sharedWorkspaceName }).first()
        await expect(sharedWorkspaceCard.getByRole('button', { name: 'Workspace actions' })).toBeVisible({ timeout: 30_000 })

        await sharedWorkspaceCard.getByRole('button', { name: 'Workspace actions' }).click()
        await page.getByRole('menuitem', { name: 'Copy' }).click()
        const copyWorkspaceDialog = page.getByRole('dialog', { name: 'Copy workspace' })
        const copiedWorkspaceName = `${sharedWorkspaceName} (copy)`
        await expect(copyWorkspaceDialog.getByLabel('Workspace name')).toHaveValue(copiedWorkspaceName, { timeout: 30_000 })
        await copyWorkspaceDialog.getByRole('button', { name: 'Copy' }).click()
        await expect(page).toHaveURL(new RegExp(`/a/${lms.applicationId}/workspaces/[0-9a-f-]{36}$`), { timeout: 30_000 })
        await expect(page.getByRole('heading', { name: copiedWorkspaceName })).toBeVisible({ timeout: 30_000 })

        await page.goto(`/a/${lms.applicationId}/workspaces`)
        const copiedWorkspaceCard = page
            .getByTestId('runtime-workspaces-page')
            .getByTestId('runtime-workspace-card')
            .filter({ hasText: copiedWorkspaceName })
            .first()
        await expect(copiedWorkspaceCard).toBeVisible({ timeout: 30_000 })
        await copiedWorkspaceCard.getByRole('button', { name: 'Workspace actions' }).click()
        await page.getByRole('menuitem', { name: 'Edit' }).click()
        const editWorkspaceDialog = page.getByRole('dialog', { name: 'Edit workspace' })
        const renamedCopyWorkspaceName = `${sharedWorkspaceName} Copy Edited`
        await editWorkspaceDialog.getByLabel('Workspace name').fill(renamedCopyWorkspaceName)
        await editWorkspaceDialog.getByLabel('Workspace description').fill(`Edited workspace for ${runManifest.runId}`)
        await editWorkspaceDialog.getByRole('button', { name: 'Save' }).click()
        await expect(page.getByText(renamedCopyWorkspaceName, { exact: true }).first()).toBeVisible({ timeout: 30_000 })

        const renamedCopyWorkspaceCard = page
            .getByTestId('runtime-workspaces-page')
            .getByTestId('runtime-workspace-card')
            .filter({ hasText: renamedCopyWorkspaceName })
            .first()
        await renamedCopyWorkspaceCard.getByRole('button', { name: 'Workspace actions' }).click()
        await page.getByRole('menuitem', { name: 'Delete' }).click()
        const deleteWorkspaceDialog = page.getByRole('dialog', { name: 'Delete workspace' })
        await deleteWorkspaceDialog.getByRole('button', { name: 'Delete' }).click()
        await expect(page.getByText(renamedCopyWorkspaceName, { exact: true })).toHaveCount(0, { timeout: 30_000 })

        await page.locator('button[title="Table view"]').click()
        const sharedWorkspaceRow = workspacePage.getByRole('row', {
            name: new RegExp(escapeRegex(sharedWorkspaceName))
        })
        await expect(sharedWorkspaceRow).toBeVisible({ timeout: 30_000 })
        await expect(sharedWorkspaceRow.getByRole('button', { name: 'Open' })).toHaveCount(0)
        await expect(sharedWorkspaceRow.getByRole('button', { name: 'Workspace actions' })).toBeVisible()
        await page.getByPlaceholder('Search workspaces').fill(`missing-${runManifest.runId}`)
        await expect(sharedWorkspaceRow).toHaveCount(0)
        await page.getByPlaceholder('Search workspaces').fill(sharedWorkspaceName)
        await expect(sharedWorkspaceRow).toBeVisible({ timeout: 30_000 })
        await page.locator('button[title="Card view"]').click()

        await sharedWorkspaceLocator.first().click()
        await expect(page).toHaveURL(new RegExp(`/a/${lms.applicationId}/workspaces/${sharedWorkspace.id}`), { timeout: 30_000 })
        await expect(page.getByRole('heading', { name: sharedWorkspaceName })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('link', { name: 'Access', exact: true }).click()
        await expect(page).toHaveURL(new RegExp(`/a/${lms.applicationId}/workspaces/${sharedWorkspace.id}/access`), { timeout: 30_000 })
        await expect(page.getByRole('button', { name: 'Remove member' })).toHaveCount(0)

        await page.getByRole('button', { name: 'Add' }).click()
        const inviteDialog = page.getByRole('dialog', { name: 'Add member' })
        await inviteDialog
            .getByLabel('Email')
            .fill(`missing+${runManifest.runId}@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`)
        await inviteDialog.getByRole('button', { name: 'Add' }).click()
        await expect(inviteDialog.getByText('User not found')).toBeVisible({ timeout: 30_000 })

        await inviteDialog.getByLabel('Email').fill(memberEmail)
        await inviteDialog.getByRole('button', { name: 'Add' }).click()
        await expect(page.getByText(memberEmail, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('runtime-workspace-members-card-view')).toBeVisible({ timeout: 30_000 })
        await page.locator('button[title="Member list view"]').click()
        await expect(
            workspacePage.getByRole('row', {
                name: new RegExp(escapeRegex(memberEmail))
            })
        ).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('runtime-workspace-members-list.png'), fullPage: true })
        await page.locator('button[title="Member card view"]').click()
        await expect(page.getByTestId('runtime-workspace-members-card-view')).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('runtime-workspace-members.png'), fullPage: true })

        memberApi = await createLoggedInApiContext({
            email: memberEmail,
            password: memberPassword
        })
        const memberWorkspacesPayload = await listApplicationWorkspaces(memberApi, lms.applicationId)
        const memberWorkspaces = Array.isArray(memberWorkspacesPayload?.items) ? memberWorkspacesPayload.items : []
        const memberPersonalWorkspace = requireWorkspace(
            memberWorkspaces,
            (workspace) => (workspace.workspaceType ?? workspace.type) === 'personal',
            'member personal workspace'
        )

        await setApplicationDefaultWorkspace(ownerApi, lms.applicationId, ownerPersonalWorkspace.id)
        await setApplicationDefaultWorkspace(memberApi, lms.applicationId, memberPersonalWorkspace.id)

        await page.goto(`/a/${lms.applicationId}/${modulesCatalogId}`)
        await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible({ timeout: 30_000 })

        await switchWorkspace(page, sharedWorkspace)
        await createRuntimeRowViaBrowser(page, sharedModuleTitle)

        memberSession = await createLoggedInBrowserContext(browser, {
            email: memberEmail,
            password: memberPassword
        })

        const memberPage = memberSession.page
        await memberPage.goto(`/a/${lms.applicationId}/workspaces`)
        await expect(memberPage.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })
        await expect(memberPage.getByRole('heading', { name: 'Overview' })).toHaveCount(0)
        await expect(memberPage.getByText('Modules', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await memberPage.getByText(sharedWorkspaceName, { exact: true }).first().click()
        await expect(memberPage).toHaveURL(new RegExp(`/a/${lms.applicationId}/workspaces/${sharedWorkspace.id}`), { timeout: 30_000 })
        await memberPage.getByRole('link', { name: 'Access', exact: true }).click()
        await expect(memberPage).toHaveURL(new RegExp(`/a/${lms.applicationId}/workspaces/${sharedWorkspace.id}/access`), {
            timeout: 30_000
        })
        await expect(memberPage.getByRole('button', { name: 'Add' })).toHaveCount(0, { timeout: 30_000 })
        await expect(memberPage.getByRole('button', { name: 'Remove member' })).toHaveCount(0)

        await memberPage.goto(`/a/${lms.applicationId}/${modulesCatalogId}`)
        await expect(memberPage.getByRole('heading', { name: 'Modules' })).toBeVisible({ timeout: 30_000 })
        await expect(memberPage.getByText(sharedModuleTitle, { exact: true })).toHaveCount(0)

        await switchWorkspace(memberPage, sharedWorkspace)
        await expect(memberPage.getByText(sharedModuleTitle, { exact: true })).toBeVisible({ timeout: 30_000 })

        await switchWorkspace(memberPage, memberPersonalWorkspace)
        await expect(memberPage.getByText(sharedModuleTitle, { exact: true })).toHaveCount(0)

        await switchWorkspace(page, ownerPersonalWorkspace)
        await expect(page.getByText(sharedModuleTitle, { exact: true })).toHaveCount(0)

        await switchWorkspace(page, sharedWorkspace)
        await expect(page.getByText(sharedModuleTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
    } finally {
        await memberSession?.context.close().catch(() => undefined)
        if (memberApi) {
            await disposeApiContext(memberApi)
        }
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
