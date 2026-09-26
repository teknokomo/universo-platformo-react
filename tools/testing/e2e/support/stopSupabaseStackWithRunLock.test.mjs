import assert from 'node:assert/strict'
import test from 'node:test'
import { stopSupabaseStackWithRunLock } from './stopSupabaseStackWithRunLock.mjs'

test('a retained or active run lock prevents CI cleanup from checking or stopping Supabase', async () => {
    const events = []

    const stopped = await stopSupabaseStackWithRunLock({
        acquireLock: async () => {
            events.push('acquire-lock')
            throw new Error('run lock already exists')
        },
        releaseLock: async () => events.push('release-lock'),
        getStackState: async () => events.push('status'),
        stopStack: async () => events.push('stop-stack'),
        onLockUnavailable: () => events.push('skip')
    })

    assert.equal(stopped, false)
    assert.deepEqual(events, ['acquire-lock', 'skip'])
})

test('CI cleanup stops a running stack under its lease and releases only after stop completes', async () => {
    const events = []
    const lease = { token: 'cleanup-lease' }

    const stopped = await stopSupabaseStackWithRunLock({
        acquireLock: async () => {
            events.push('acquire-lock')
            return lease
        },
        releaseLock: async (receivedLease) => {
            assert.equal(receivedLease, lease)
            events.push('release-lock')
        },
        getStackState: async () => {
            events.push('status')
            return events.filter((event) => event === 'status').length === 1 ? 'running' : 'stopped'
        },
        stopStack: async () => events.push('stop-stack')
    })

    assert.equal(stopped, true)
    assert.deepEqual(events, ['acquire-lock', 'status', 'stop-stack', 'status', 'release-lock'])
})

test('CI cleanup retains its lease when stack stop fails', async () => {
    const events = []

    await assert.rejects(
        stopSupabaseStackWithRunLock({
            acquireLock: async () => ({ token: 'cleanup-lease' }),
            releaseLock: async () => events.push('release-lock'),
            getStackState: async () => 'running',
            stopStack: async () => {
                events.push('stop-stack')
                throw new Error('stop failed')
            },
            reportCleanupFailure: () => events.push('retain-lock')
        }),
        /stop failed/
    )

    assert.deepEqual(events, ['stop-stack', 'retain-lock'])
})

test('CI cleanup releases its lease without stopping an already stopped stack', async () => {
    const events = []

    await stopSupabaseStackWithRunLock({
        acquireLock: async () => ({ token: 'cleanup-lease' }),
        releaseLock: async () => events.push('release-lock'),
        getStackState: async () => {
            events.push('status')
            return 'stopped'
        },
        stopStack: async () => events.push('stop-stack')
    })

    assert.deepEqual(events, ['status', 'release-lock'])
})

test('CI cleanup retains its lease if the stack still reports running after stop', async () => {
    const events = []

    await assert.rejects(
        stopSupabaseStackWithRunLock({
            acquireLock: async () => ({ token: 'cleanup-lease' }),
            releaseLock: async () => events.push('release-lock'),
            getStackState: async () => {
                events.push('status')
                return 'running'
            },
            stopStack: async () => events.push('stop-stack'),
            reportCleanupFailure: () => events.push('retain-lock')
        }),
        /not confirmed stopped/
    )

    assert.deepEqual(events, ['status', 'stop-stack', 'status', 'retain-lock'])
})
