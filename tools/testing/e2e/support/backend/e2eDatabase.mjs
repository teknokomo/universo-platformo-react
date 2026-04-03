import pg from 'pg'
import { loadE2eEnvironment } from '../env/load-e2e-env.mjs'

const advisoryLockKeySql = `('x' || substr(md5($1), 1, 16))::bit(64)::bigint`

export function getE2eDatabaseSslConfig() {
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

export function getE2eDatabaseConnectionConfig() {
    loadE2eEnvironment()

    const host = String(process.env.DATABASE_HOST || '').trim()
    const user = String(process.env.DATABASE_USER || '').trim()
    const password = String(process.env.DATABASE_PASSWORD || '')
    const database = String(process.env.DATABASE_NAME || '').trim()
    const port = Number.parseInt(String(process.env.DATABASE_PORT || '5432'), 10)

    if (!host || !user || !password || !database || !Number.isFinite(port)) {
        throw new Error('DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, and DATABASE_NAME are required for E2E database operations')
    }

    return {
        host,
        port,
        user,
        password,
        database,
        ssl: getE2eDatabaseSslConfig()
    }
}

export function createE2eDatabaseClient() {
    const { Client } = pg
    return new Client(getE2eDatabaseConnectionConfig())
}

export async function withE2eDatabaseClient(callback) {
    const client = createE2eDatabaseClient()
    await client.connect()

    try {
        return await callback(client)
    } finally {
        await client.end()
    }
}

export async function withE2eAdvisoryLock(client, lockKey, callback) {
    await client.query(`SELECT pg_advisory_lock(${advisoryLockKeySql})`, [lockKey])

    try {
        return await callback()
    } finally {
        await client.query(`SELECT pg_advisory_unlock(${advisoryLockKeySql})`, [lockKey]).catch(() => undefined)
    }
}