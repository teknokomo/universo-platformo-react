import { type Page } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import {
    disposeBootstrapApiContext,
    createBootstrapApiContext,
    getBootstrapCredentials,
    resolvePrimaryInstance
} from '../../support/backend/bootstrap.mjs'
import { createRole, getAssignableRoles, getRole, listGlobalUsers, listRoles, listLocales } from '../../support/backend/api-session.mjs'
import { recordCreatedGlobalUser, recordCreatedLocale, recordCreatedRole } from '../../support/backend/run-manifest.mjs'
import {
    buildEntitySelectionOptionSelector,
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    confirmDeleteSelectors,
    entitySelectionSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'

function buildName(prefix: string, runId: string) {
    return `E2E ${runId} ${prefix}`
}

function buildPascalCodename(prefix: string, runId: string) {
    const suffix = runId
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-12)
        .split('')
        .map((char) => {
            if (/[a-z]/i.test(char)) {
                return char.toUpperCase()
            }

            return String.fromCharCode(65 + (Number.parseInt(char, 36) % 26))
        })
        .join('')

    return `${prefix}${suffix}`.slice(0, 48)
}

function buildLocaleCode(runId: string) {
    return runId
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-2)
        .padStart(2, 'a')
        .split('')
        .map((char) => String.fromCharCode(97 + (char.toLowerCase().charCodeAt(0) % 26)))
        .join('')
}

async function waitForLocale(api: Awaited<ReturnType<typeof createBootstrapApiContext>>, code: string) {
    let matchedLocale: { id?: string; code?: string } | undefined

    await expect
        .poll(async () => {
            const locales = await listLocales(api, { includeDisabled: true })
            matchedLocale = locales.find((locale: { code?: string }) => locale.code === code)
            return Boolean(matchedLocale?.id)
        })
        .toBe(true)

    return matchedLocale ?? null
}

async function waitForRoleDeleted(api: Awaited<ReturnType<typeof createBootstrapApiContext>>, roleId: string) {
    await expect
        .poll(async () => {
            const roles = await listRoles(api, { limit: 100, offset: 0 })
            return roles.some((role: { id?: string }) => role.id === roleId)
        })
        .toBe(false)
}

async function waitForGlobalUserByEmail(api: Awaited<ReturnType<typeof createBootstrapApiContext>>, email: string) {
    let matchedUser:
        | {
              id?: string
              userId?: string
              email?: string
              roles?: Array<{ id?: string; codename?: string }>
          }
        | undefined

    await expect
        .poll(async () => {
            const users = await listGlobalUsers(api, { limit: 100, offset: 0, search: email })
            matchedUser = users.find((user: { email?: string }) => user.email === email)
            return Boolean(matchedUser?.userId)
        })
        .toBe(true)

    return matchedUser ?? null
}

async function findGlobalUserByEmail(api: Awaited<ReturnType<typeof createBootstrapApiContext>>, email: string) {
    const users = await listGlobalUsers(api, { limit: 100, offset: 0, search: email })
    return users.find((user: { email?: string }) => user.email === email) ?? null
}

async function selectRoleInUserDialog(page: Page, roleOptionId: string, roleDisplayName: string) {
    const userDialog = page.getByRole('dialog', { name: 'Create User' })
    const rolesTab = userDialog.getByRole('tab', { name: 'Roles' })
    await rolesTab.click()

    try {
        await expect(userDialog.getByTestId(entitySelectionSelectors.addButton)).toBeVisible({ timeout: 2_000 })
    } catch {
        await rolesTab.click({ force: true })
        await rolesTab.press('Enter').catch(() => undefined)
        await rolesTab.evaluate((element: HTMLElement) => {
            element.click()
        })
        await expect(userDialog.getByTestId(entitySelectionSelectors.addButton)).toBeVisible()
    }

    await userDialog.getByTestId(entitySelectionSelectors.addButton).click()

    const pickerDialog = page.getByRole('dialog', { name: 'Select Roles' })
    await expect(pickerDialog).toBeVisible()
    await expect(pickerDialog.getByTestId(buildEntitySelectionOptionSelector(roleOptionId))).toBeVisible()
    await pickerDialog.getByTestId(buildEntitySelectionOptionSelector(roleOptionId)).click()
    await pickerDialog.getByTestId(entitySelectionSelectors.confirmButton).click()

    await expect(userDialog.getByText(roleDisplayName)).toBeVisible()
}

test('@flow @permission admin can manage roles, users, and locales from browser UI', async ({ browser, runManifest }) => {
    const api = await createBootstrapApiContext()
    const instance = await resolvePrimaryInstance(api)
    const adminSession = await createLoggedInBrowserContext(browser, getBootstrapCredentials(), {
        basePathAfterLogin: `/admin/instance/${instance.id}/roles`
    })

    const roleName = buildName('Role Manager', runManifest.runId)
    const roleCodename = buildPascalCodename('E2EAdminRole', runManifest.runId)
    const disposableRoleName = buildName('Role Disposable', runManifest.runId)
    const disposableRoleCodename = buildPascalCodename('E2EAdminDeleteRole', runManifest.runId)
    const userEmail = `e2e+${runManifest.runId}.rbac@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const userPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const localeCode = buildLocaleCode(runManifest.runId)
    const localeNativeName = buildName('Locale', runManifest.runId)

    try {
        const page = adminSession.page

        await page.goto(`/admin/instance/${instance.id}/roles`)
        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const roleDialog = page.getByRole('dialog')
        await roleDialog.getByLabel('Name').first().fill(roleName)
        await roleDialog.getByLabel('Code Name').first().fill(roleCodename)

        const createRoleRequest = page.waitForResponse(
            (response) => response.request().method() === 'POST' && /\/api\/v1\/admin\/roles$/.test(response.url())
        )
        await roleDialog.getByRole('button', { name: 'Create' }).click()
        await createRoleRequest

        await page.waitForURL(/\/admin\/instance\/[^/]+\/roles\/[^/]+$/)

        const roleId = page.url().split('/').pop()
        if (!roleId) {
            throw new Error('Created role id was not found in URL')
        }

        await recordCreatedRole({ id: roleId, codename: roleCodename })

        const grantAllToggle = page.getByRole('switch', { name: 'Grant all permissions' })
        await grantAllToggle.check()
        await page.getByRole('button', { name: 'Save permissions' }).click()

        await expect
            .poll(async () => {
                const role = await getRole(api, roleId)
                return (
                    Array.isArray(role.permissions) &&
                    role.permissions.some(
                        (permission: { subject?: string; action?: string }) => permission.subject === '*' && permission.action === '*'
                    )
                )
            })
            .toBe(true)

        const assignableRoles = await getAssignableRoles(api)
        const superUserRole = assignableRoles.find((role: { codename?: string; name?: string; id?: string }) =>
            String(role.codename || role.name || '')
                .toLowerCase()
                .includes('super')
        )

        if (!superUserRole?.id) {
            throw new Error('Assignable Super User role was not found for admin user creation coverage')
        }

        await page.goto(`/admin/instance/${instance.id}/users`)
        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const userDialog = page.getByRole('dialog', { name: 'Create User' })
        await userDialog.getByLabel('Email').fill(userEmail)
        await userDialog.getByLabel('Password').fill(userPassword)
        await userDialog.getByLabel('Comment').fill(`Created by Playwright RBAC coverage for ${runManifest.runId}`)
        await selectRoleInUserDialog(page, superUserRole.id, 'Super User')

        const createUserRequest = page.waitForResponse(
            (response) => response.request().method() === 'POST' && /\/api\/v1\/admin\/global-users\/create-user$/.test(response.url())
        )
        await userDialog.getByRole('button', { name: 'Create' }).click()
        const createUserResponse = await createUserRequest
        expect(createUserResponse.ok()).toBe(true)
        await expect(userDialog).toHaveCount(0)
        await expect(page.getByText(userEmail)).toBeVisible()

        const createdUser = await waitForGlobalUserByEmail(api, userEmail)

        if (!createdUser?.userId || !createdUser?.id) {
            throw new Error(`Created global user ${userEmail} was not returned by admin API`)
        }

        await recordCreatedGlobalUser({ userId: createdUser.userId, email: userEmail })
        await expect
            .poll(async () => {
                const listedUser = await findGlobalUserByEmail(api, userEmail)
                return Array.isArray(listedUser?.roles) ? listedUser.roles.length : null
            })
            .toBeGreaterThan(0)

        const delegatedAdminSession = await createLoggedInBrowserContext(
            browser,
            {
                email: userEmail,
                password: userPassword
            },
            {
                basePathAfterLogin: '/admin'
            }
        )

        try {
            await expect(delegatedAdminSession.page.getByRole('heading', { name: 'Instances' })).toBeVisible()
            await expect(delegatedAdminSession.page.getByText('Local')).toBeVisible()
        } finally {
            await delegatedAdminSession.context.close().catch(() => undefined)
        }

        await page.goto(`/admin/instance/${instance.id}/users`)
        await page.getByTestId(buildEntityMenuTriggerSelector('user', createdUser.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('user', 'clearRoles', createdUser.id)).click()
        await page.getByTestId(confirmDeleteSelectors.confirmButton).click()

        await expect
            .poll(async () => {
                const listedUser = await findGlobalUserByEmail(api, userEmail)
                if (!listedUser) {
                    return 'removed'
                }

                return Array.isArray(listedUser.roles) ? listedUser.roles.length : null
            })
            .toBe('removed')

        const revokedSession = await createLoggedInBrowserContext(browser, {
            email: userEmail,
            password: userPassword
        })

        try {
            await revokedSession.page.goto('/admin')
            await expect.poll(() => new URL(revokedSession.page.url()).pathname.startsWith('/admin')).toBe(false)
        } finally {
            await revokedSession.context.close().catch(() => undefined)
        }

        const disposableRole = await createRole(api, {
            codename: createLocalizedContent('en', disposableRoleCodename),
            name: createLocalizedContent('en', disposableRoleName),
            description: createLocalizedContent('en', `Disposable role created by Playwright for ${runManifest.runId}`),
            color: '#9e9e9e',
            isSuperuser: false,
            permissions: []
        })
        if (!disposableRole?.id) {
            throw new Error(`Disposable role ${disposableRoleCodename} was not returned by admin API`)
        }

        await recordCreatedRole({ id: disposableRole.id, codename: disposableRoleCodename })

        await page.goto(`/admin/instance/${instance.id}/roles`)
        await page.getByPlaceholder('Search roles...').fill(disposableRoleName)
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('role', disposableRole.id))).toBeVisible()
        await page.getByTestId(buildEntityMenuTriggerSelector('role', disposableRole.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('role', 'delete', disposableRole.id)).click()
        await page.getByTestId(confirmDeleteSelectors.confirmButton).click()

        await waitForRoleDeleted(api, disposableRole.id)

        await page.goto(`/admin/instance/${instance.id}/locales`)
        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const localeDialog = page.getByRole('dialog')
        await localeDialog.getByLabel('Code').fill(localeCode)
        await localeDialog.getByLabel('Native Name').fill(localeNativeName)
        await localeDialog.getByLabel('Name').first().fill(localeNativeName)

        const createLocaleRequest = page.waitForResponse(
            (response) => response.request().method() === 'POST' && /\/api\/v1\/admin\/locales$/.test(response.url())
        )
        await localeDialog.getByRole('button', { name: 'Create' }).click()
        await createLocaleRequest

        const createdLocale = await waitForLocale(api, localeCode)
        if (!createdLocale?.id) {
            throw new Error(`Created locale ${localeCode} was not returned by admin API`)
        }

        await page.goto(`/admin/instance/${instance.id}/locales`)
        await expect(page.getByRole('heading', { name: 'Languages' })).toBeVisible()
        await page.getByPlaceholder('Search languages...').fill(localeCode.toUpperCase())
        await expect(page.getByText(localeCode.toUpperCase(), { exact: true })).toBeVisible()
        await expect(page.getByText(localeNativeName, { exact: false })).toBeVisible()

        await recordCreatedLocale({ id: createdLocale.id, code: localeCode })
    } finally {
        await adminSession.context.close().catch(() => undefined)
        await disposeBootstrapApiContext(api)
    }
})
