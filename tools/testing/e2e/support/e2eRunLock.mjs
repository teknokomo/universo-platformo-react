import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

function isProcessAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false

    try {
        process.kill(pid, 0)
        return true
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') return false
        return true
    }
}

async function readLockMetadata(lockPath) {
    let raw
    try {
        raw = await fs.readFile(lockPath, 'utf8')
    } catch (error) {
        throw new Error(`Unable to read E2E run lock: ${error instanceof Error ? error.message : String(error)}`)
    }

    try {
        return JSON.parse(raw)
    } catch {
        throw new Error('E2E run lock metadata is malformed; refusing to acquire or release it')
    }
}

function assertLockIdentity(metadata, { ownerPid, token }) {
    if (metadata?.pid !== ownerPid || metadata?.token !== token) {
        throw new Error('E2E run lock identity changed; refusing to release or borrow an ambiguous lock')
    }
}

export async function acquireE2eRunLock({ lockPath, metadata = {} }) {
    const ownerPid = process.pid
    const token = randomUUID()
    await fs.mkdir(path.dirname(lockPath), { recursive: true })

    let handle
    try {
        handle = await fs.open(lockPath, 'wx', 0o600)
    } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error

        let existing
        try {
            existing = await readLockMetadata(lockPath)
        } catch (readError) {
            throw new Error(
                `An E2E run lock already exists and its ownership is ambiguous; refusing to proceed. ${
                    readError instanceof Error ? readError.message : String(readError)
                }`
            )
        }

        const holder = Number.isInteger(existing?.pid)
            ? `pid=${existing.pid}${isProcessAlive(existing.pid) ? ' (active)' : ' (stale)'}`
            : 'unknown holder'
        throw new Error(
            `Another E2E run lock exists at ${lockPath} (${holder}); refusing to acquire it. Inspect the owner and clear only a verified stale lock.`
        )
    }

    const lease = { lockPath, ownerPid, token, handle, delegated: false }
    const record = {
        ...metadata,
        pid: ownerPid,
        token,
        startedAt: new Date().toISOString()
    }

    try {
        await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, 'utf8')
        await handle.sync()
    } catch (error) {
        await handle.close()
        lease.handle = null
        throw new Error(
            `Failed to persist E2E run lock metadata; the lock is retained fail-closed: ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    }

    return lease
}

export async function borrowE2eRunLock({ lockPath, ownerPid, token }) {
    if (!Number.isInteger(ownerPid) || ownerPid <= 0 || typeof token !== 'string' || token.length < 32) {
        throw new Error('E2E run lock delegation is incomplete; refusing to start the suite')
    }

    const metadata = await readLockMetadata(lockPath)
    assertLockIdentity(metadata, { ownerPid, token })
    if (!isProcessAlive(ownerPid)) throw new Error(`E2E run lock owner pid=${ownerPid} is no longer active; refusing delegated execution`)

    return { lockPath, ownerPid, token, handle: null, delegated: true }
}

export async function releaseE2eRunLock(lease) {
    if (!lease) return false
    if (lease.delegated) return false

    try {
        const metadata = await readLockMetadata(lease.lockPath)
        assertLockIdentity(metadata, lease)
        await fs.rm(lease.lockPath)
        return true
    } finally {
        if (lease.handle) {
            await lease.handle.close()
            lease.handle = null
        }
    }
}
