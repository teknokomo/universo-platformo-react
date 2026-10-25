import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
    acquireE2eRunLock,
    borrowE2eRunLock,
    releaseE2eRunLock,
    withE2eRunLockDelegation,
    withoutE2eRunLockDelegation
} from './e2eRunLock.mjs'

async function createLockPath(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'universo-e2e-lock-'))
    t.after(async () => fs.rm(directory, { recursive: true, force: true }))
    return path.join(directory, 'run.lock')
}

test('strips delegated run lock capabilities from child process environments', () => {
    const source = {
        NODE_ENV: 'test',
        UNIVERSO_E2E_RUN_LOCK_OWNER_PID: '1234',
        UNIVERSO_E2E_RUN_LOCK_TOKEN: 'delegated-secret-token'
    }

    assert.deepEqual(withoutE2eRunLockDelegation(source), { NODE_ENV: 'test' })
    assert.equal(source.UNIVERSO_E2E_RUN_LOCK_TOKEN, 'delegated-secret-token')
})

test('delegates a run lock only to explicitly authorized child processes', () => {
    const source = {
        E2E_BASE_URL: 'http://127.0.0.1:3100',
        UNIVERSO_E2E_RUN_LOCK_OWNER_PID: '1',
        UNIVERSO_E2E_RUN_LOCK_TOKEN: 'stale-token'
    }
    const lease = { ownerPid: 1234, token: 'current-secret-token' }

    assert.deepEqual(withE2eRunLockDelegation(source), { E2E_BASE_URL: 'http://127.0.0.1:3100' })
    assert.deepEqual(withE2eRunLockDelegation(source, lease), {
        E2E_BASE_URL: 'http://127.0.0.1:3100',
        UNIVERSO_E2E_RUN_LOCK_OWNER_PID: '1234',
        UNIVERSO_E2E_RUN_LOCK_TOKEN: 'current-secret-token'
    })
    assert.equal(source.UNIVERSO_E2E_RUN_LOCK_TOKEN, 'stale-token')
})

test('exclusive lock acquisition rejects competitors without replacing the active owner', async (t) => {
    const lockPath = await createLockPath(t)
    const owner = await acquireE2eRunLock({ lockPath, metadata: { gate: 'test' } })

    await assert.rejects(acquireE2eRunLock({ lockPath }), /Another E2E run lock exists at .* \(pid=.*active\)/)
    const record = JSON.parse(await fs.readFile(lockPath, 'utf8'))
    assert.equal(record.pid, owner.ownerPid)
    assert.equal(record.token, owner.token)

    assert.equal(await releaseE2eRunLock(owner), true)
    await assert.rejects(fs.access(lockPath), { code: 'ENOENT' })
})

test('simultaneous coordinators produce one lock owner', async (t) => {
    const lockPath = await createLockPath(t)
    const contenders = await Promise.allSettled([
        acquireE2eRunLock({ lockPath, metadata: { gate: 'first' } }),
        acquireE2eRunLock({ lockPath, metadata: { gate: 'second' } })
    ])
    const owners = contenders.filter((result) => result.status === 'fulfilled')
    const rejected = contenders.filter((result) => result.status === 'rejected')

    assert.equal(owners.length, 1)
    assert.equal(rejected.length, 1)
    assert.match(rejected[0].reason.message, /Another E2E run lock exists/)
    assert.equal(await releaseE2eRunLock(owners[0].value), true)
})

test('delegated lease validates owner and token and cannot release the coordinator lock', async (t) => {
    const lockPath = await createLockPath(t)
    const owner = await acquireE2eRunLock({ lockPath, metadata: { gate: 'test' } })

    const delegated = await borrowE2eRunLock({ lockPath, ownerPid: owner.ownerPid, token: owner.token })
    assert.equal(delegated.delegated, true)
    assert.equal(await releaseE2eRunLock(delegated), false)
    assert.equal(JSON.parse(await fs.readFile(lockPath, 'utf8')).token, owner.token)

    await assert.rejects(borrowE2eRunLock({ lockPath, ownerPid: owner.ownerPid, token: 'x'.repeat(36) }), /identity changed/)
    await assert.rejects(borrowE2eRunLock({ lockPath, ownerPid: owner.ownerPid + 1, token: owner.token }), /identity changed/)

    assert.equal(await releaseE2eRunLock(owner), true)
})

test('ambiguous and stale lock records fail closed and are left for explicit cleanup', async (t) => {
    const lockPath = await createLockPath(t)
    await fs.writeFile(lockPath, '{invalid', 'utf8')

    await assert.rejects(acquireE2eRunLock({ lockPath }), /ownership is ambiguous/)
    await assert.rejects(borrowE2eRunLock({ lockPath, ownerPid: process.pid, token: 'x'.repeat(36) }), /malformed/)
    assert.equal(await fs.readFile(lockPath, 'utf8'), '{invalid')
})

test('owner release refuses to remove a lock whose identity changed', async (t) => {
    const lockPath = await createLockPath(t)
    const owner = await acquireE2eRunLock({ lockPath })
    const replacement = { pid: owner.ownerPid, token: 'replacement-token' }
    await fs.writeFile(lockPath, JSON.stringify(replacement), 'utf8')

    await assert.rejects(releaseE2eRunLock(owner), /identity changed/)
    assert.deepEqual(JSON.parse(await fs.readFile(lockPath, 'utf8')), replacement)
})
