import crypto from 'crypto'
import { createApiContext, createAdminUser, disposeApiContext, getAssignableRoles, login } from './api-session.mjs'
import { loadE2eEnvironment } from '../env/load-e2e-env.mjs'
import { readRunManifest, writeRunManifest } from './run-manifest.mjs'

const normalizeEmail = (value) => value.trim().toLowerCase()

const normalizeRoleCodenames = (value) =>
    String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

const createRunId = () => {
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14)
    const suffix = crypto.randomBytes(4).toString('hex')
    return `e2e-${timestamp}-${suffix}`
}

const resolveRoleIds = (roles, roleCodenames) => {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)

    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable role(s) not found for e2e provisioning: ${missing.join(', ')}`)
    }

    return roleIds
}

export async function provisionE2eRun() {
    const existingManifest = await readRunManifest()
    if (existingManifest) {
        return existingManifest
    }

    loadE2eEnvironment()

    const bootstrapEmail = normalizeEmail(process.env.BOOTSTRAP_SUPERUSER_EMAIL || '')
    const bootstrapPassword = process.env.BOOTSTRAP_SUPERUSER_PASSWORD || ''

    if (!bootstrapEmail || !bootstrapPassword) {
        throw new Error('BOOTSTRAP_SUPERUSER_EMAIL and BOOTSTRAP_SUPERUSER_PASSWORD are required for e2e provisioning')
    }

    const runId = createRunId()
    const userPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const emailDomain = process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
    const testUserEmail = normalizeEmail(`e2e+${runId}@${emailDomain}`)
    const requestedRoleCodenames = normalizeRoleCodenames(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')

    const api = await createApiContext()

    try {
        await login(api, { email: bootstrapEmail, password: bootstrapPassword })
        const assignableRoles = await getAssignableRoles(api)
        const roleIds = resolveRoleIds(assignableRoles, requestedRoleCodenames)
        const createdUser = await createAdminUser(api, {
            email: testUserEmail,
            password: userPassword,
            roleIds,
            comment: `Playwright e2e run ${runId}`
        })

        const manifest = {
            runId,
            createdAt: new Date().toISOString(),
            baseURL: process.env.E2E_BASE_URL,
            bootstrapUser: {
                email: bootstrapEmail
            },
            testUser: {
                email: createdUser.email ?? testUserEmail,
                password: userPassword,
                userId: createdUser.userId,
                roleIds,
                roleCodenames: requestedRoleCodenames
            },
            createdMetahubs: []
        }

        return writeRunManifest(manifest)
    } finally {
        await disposeApiContext(api)
    }
}
