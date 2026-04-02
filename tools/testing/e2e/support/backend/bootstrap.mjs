import pg from 'pg'
import { createApiContext, disposeApiContext, listInstances, login } from './api-session.mjs'
import { loadE2eEnvironment } from '../env/load-e2e-env.mjs'

function getFallbackDatabaseSslConfig() {
    if (process.env.DATABASE_SSL_KEY_BASE64) {
        return {
            rejectUnauthorized: false,
            ca: Buffer.from(process.env.DATABASE_SSL_KEY_BASE64, 'base64').toString()
        }
    }

    if (process.env.DATABASE_SSL === 'true') {
        return { rejectUnauthorized: false }
    }

    return false
}

function getFallbackDatabaseConnectionConfig() {
    loadE2eEnvironment()

    const host = String(process.env.DATABASE_HOST || '').trim()
    const user = String(process.env.DATABASE_USER || '').trim()
    const password = String(process.env.DATABASE_PASSWORD || '')
    const database = String(process.env.DATABASE_NAME || '').trim()
    const port = Number.parseInt(String(process.env.DATABASE_PORT || '5432'), 10)

    if (!host || !user || !password || !database || !Number.isFinite(port)) {
        const message =
            'DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, and DATABASE_NAME are required for bootstrap fallback instance resolution'
        throw new Error(message)
    }

    return {
        host,
        port,
        user,
        password,
        database,
        ssl: getFallbackDatabaseSslConfig()
    }
}

export function getBootstrapCredentials() {
    loadE2eEnvironment()

    const email = String(process.env.BOOTSTRAP_SUPERUSER_EMAIL || '')
        .trim()
        .toLowerCase()
    const password = String(process.env.BOOTSTRAP_SUPERUSER_PASSWORD || '')

    if (!email || !password) {
        throw new Error('BOOTSTRAP_SUPERUSER_EMAIL and BOOTSTRAP_SUPERUSER_PASSWORD are required for admin browser tests')
    }

    return { email, password }
}

export async function createBootstrapApiContext() {
    const credentials = getBootstrapCredentials()
    const api = await createApiContext()
    await login(api, credentials)
    return api
}

export async function resolvePrimaryInstance(api) {
    const response = await listInstances(api, { limit: 20, offset: 0 })
    const items = Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : []
    const instance = items[0]

    if (!instance?.id) {
        const { Client } = pg
        const client = new Client(getFallbackDatabaseConnectionConfig())

        await client.connect()

        try {
            const result = await client.query(
                `SELECT id, codename, name, description, url, status, is_local
                 FROM admin.cfg_instances
                 WHERE _upl_deleted = false AND _app_deleted = false
                 ORDER BY is_local DESC, _upl_created_at ASC
                 LIMIT 1`
            )

            const fallbackInstance = result.rows[0]

            if (!fallbackInstance?.id) {
                throw new Error('No admin instances were returned for e2e coverage')
            }

            return fallbackInstance
        } finally {
            await client.end()
        }
    }

    return instance
}

export async function disposeBootstrapApiContext(api) {
    await disposeApiContext(api)
}
