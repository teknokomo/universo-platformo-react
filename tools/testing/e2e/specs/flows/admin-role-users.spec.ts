import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { createGlobalRolePersona } from '../../support/backend/personas.mjs'
import {
    createBootstrapApiContext,
    disposeBootstrapApiContext,
    getBootstrapCredentials,
    resolvePrimaryInstance
} from '../../support/backend/bootstrap.mjs'
import { listRoleUsers } from '../../support/backend/api-session.mjs'

function buildPascalCodename(prefix, runId) {
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

test('@flow @permission admin role-users page lists users assigned to a role', async ({ browser, runManifest }) => {
    const bootstrapApi = await createBootstrapApiContext()
    const instance = await resolvePrimaryInstance(bootstrapApi)
    const adminSession = await createLoggedInBrowserContext(browser, getBootstrapCredentials(), {
        basePathAfterLogin: `/admin/instance/${instance.id}/roles`
    })

    const roleName = `E2E ${runManifest.runId} role users`
    const roleCodename = buildPascalCodename('E2ERoleUsers', runManifest.runId)
    const userEmail = `e2e+${runManifest.runId}.role-users@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const userPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'

    try {
        const persona = await createGlobalRolePersona({
            runId: runManifest.runId,
            roleCodename,
            roleName,
            permissions: [{ subject: 'metahubs', action: 'read' }],
            userEmail,
            password: userPassword
        })

        await expect
            .poll(async () => {
                const response = await listRoleUsers(bootstrapApi, persona.role.id, {
                    limit: 100,
                    offset: 0,
                    search: persona.user.email
                })
                const users = Array.isArray(response?.data?.users) ? response.data.users : []
                return users.some((user) => user.id === persona.user.userId)
            })
            .toBe(true)

        const page = adminSession.page
        await page.goto(`/admin/instance/${instance.id}/roles/${persona.role.id}/users`)
        await expect(page.getByRole('heading', { name: 'Role Users' })).toBeVisible()
        await expect(page.getByText(persona.user.email)).toBeVisible()
    } finally {
        await adminSession.context.close()
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
