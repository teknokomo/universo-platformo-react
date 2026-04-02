import {
    createAdminUser,
    createApiContext,
    createRole,
    disposeApiContext,
    getAssignableRoles,
    listGlobalUsers,
    login,
    setGlobalUserRoles
} from './api-session.mjs'
import { recordCreatedGlobalUser, recordCreatedRole } from './run-manifest.mjs'
import { loadE2eEnvironment } from '../env/load-e2e-env.mjs'

const normalizeEmail = (value) => value.trim().toLowerCase()

function createLocalizedContent(primaryLocale, initialContent) {
    const now = new Date().toISOString()

    return {
        _schema: '1',
        _primary: primaryLocale,
        locales: {
            [primaryLocale]: {
                content: initialContent,
                version: 1,
                isActive: true,
                createdAt: now,
                updatedAt: now
            }
        }
    }
}

export async function createBootstrapApiContext() {
    loadE2eEnvironment()

    const email = normalizeEmail(process.env.BOOTSTRAP_SUPERUSER_EMAIL || '')
    const password = process.env.BOOTSTRAP_SUPERUSER_PASSWORD || ''

    if (!email || !password) {
        throw new Error('BOOTSTRAP_SUPERUSER_EMAIL and BOOTSTRAP_SUPERUSER_PASSWORD are required for persona provisioning')
    }

    const api = await createApiContext()
    await login(api, { email, password })
    return api
}

export async function withBootstrapApi(callback) {
    const api = await createBootstrapApiContext()

    try {
        return await callback(api)
    } finally {
        await disposeApiContext(api)
    }
}

export async function createGlobalRolePersona({ runId, roleCodename, roleName, permissions, userEmail, password }) {
    return withBootstrapApi(async (api) => {
        const role = await createRole(api, {
            codename: createLocalizedContent('en', roleCodename),
            name: createLocalizedContent('en', roleName),
            description: createLocalizedContent('en', `${roleName} for Playwright ${runId}`),
            color: '#607d8b',
            isSuperuser: false,
            permissions
        })

        await recordCreatedRole({
            id: role.id,
            codename: roleCodename
        })

        const createdUser = await createAdminUser(api, {
            email: userEmail,
            password,
            roleIds: [role.id],
            comment: `Playwright persona ${roleCodename} for ${runId}`
        })

        await recordCreatedGlobalUser({
            userId: createdUser.userId,
            email: createdUser.email ?? userEmail
        })

        return {
            role,
            user: {
                userId: createdUser.userId,
                email: createdUser.email ?? userEmail,
                password
            }
        }
    })
}

export async function assignExistingRolesToUser({ userId, roleCodenames, comment = 'Playwright role reassignment' }) {
    return withBootstrapApi(async (api) => {
        const assignableRoles = await getAssignableRoles(api)
        const roleMap = new Map(assignableRoles.map((role) => [String(role.codename).toLowerCase(), role.id]))
        const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)

        if (roleIds.length !== roleCodenames.length) {
            const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
            throw new Error(`Assignable role(s) not found: ${missing.join(', ')}`)
        }

        return setGlobalUserRoles(api, userId, { roleIds, comment })
    })
}

export async function findGlobalUserByEmail(email) {
    return withBootstrapApi(async (api) => {
        const users = await listGlobalUsers(api, { limit: 200, offset: 0, search: email })
        return users.find((item) => String(item.email || '').toLowerCase() === String(email).toLowerCase()) ?? null
    })
}
