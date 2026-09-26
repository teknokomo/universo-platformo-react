import assert from 'node:assert/strict'
import test from 'node:test'
import { coordinateLocalSupabaseE2eGate } from './localSupabaseE2eGateCoordinator.mjs'

test('reuses a running Supabase stack and never stops it', async () => {
    const events = []
    const lease = { ownerPid: 123, token: 'lease-token' }
    let lockReleased = false

    await coordinateLocalSupabaseE2eGate({
        acquireLock: async () => {
            events.push('acquire-lock')
            return lease
        },
        releaseLock: async (receivedLease) => {
            assert.equal(receivedLease, lease)
            lockReleased = true
            events.push('release-lock')
        },
        resetArtifacts: async () => events.push('reset-artifacts'),
        getStackState: async () => {
            events.push('status')
            return 'running'
        },
        startStack: async () => events.push('start-stack'),
        stopStack: async () => events.push('stop-stack'),
        prepare: async () => events.push('prepare'),
        runSuite: async (receivedLease, markSuiteStarted) => {
            assert.equal(receivedLease, lease)
            assert.equal(lockReleased, false)
            markSuiteStarted()
            events.push('run-suite')
        },
        preserveArtifacts: async (options) => {
            assert.equal(options.includeSharedArtifacts, true)
            events.push('preserve-artifacts')
        }
    })

    assert.deepEqual(events, ['acquire-lock', 'reset-artifacts', 'status', 'prepare', 'run-suite', 'preserve-artifacts', 'release-lock'])
    assert.equal(lockReleased, true)
})

test('stops only the Supabase stack started by this gate before releasing its lock', async () => {
    const events = []
    const states = ['stopped', 'running', 'stopped']
    const lease = { ownerPid: 123, token: 'lease-token' }

    await coordinateLocalSupabaseE2eGate({
        acquireLock: async () => lease,
        releaseLock: async () => events.push('release-lock'),
        resetArtifacts: async () => events.push('reset-artifacts'),
        getStackState: async () => {
            events.push('status')
            return states.shift()
        },
        startStack: async () => events.push('start-stack'),
        stopStack: async () => events.push('stop-stack'),
        prepare: async () => events.push('prepare'),
        runSuite: async (_receivedLease, markSuiteStarted) => {
            markSuiteStarted()
            events.push('run-suite')
        },
        preserveArtifacts: async () => events.push('preserve-artifacts')
    })

    assert.deepEqual(events, [
        'reset-artifacts',
        'status',
        'start-stack',
        'status',
        'prepare',
        'run-suite',
        'preserve-artifacts',
        'stop-stack',
        'status',
        'release-lock'
    ])
})

test('clears old reports before build and does not preserve them when build fails early', async () => {
    const oldReports = new Set(['old-playwright-report', 'old-test-result'])
    const copiedReports = []
    let preserveOptions

    await assert.rejects(
        coordinateLocalSupabaseE2eGate({
            acquireLock: async () => ({ ownerPid: 123, token: 'lease-token' }),
            releaseLock: async () => {},
            resetArtifacts: async () => oldReports.clear(),
            getStackState: async () => 'running',
            startStack: async () => assert.fail('a running stack must be reused'),
            stopStack: async () => assert.fail('a reused stack must not be stopped'),
            prepare: async () => {
                throw new Error('build failed')
            },
            runSuite: async () => assert.fail('suite must not run after a build failure'),
            preserveArtifacts: async (options) => {
                preserveOptions = options
                if (options.includeSharedArtifacts) copiedReports.push(...oldReports)
            }
        }),
        /build failed/
    )

    assert.equal(preserveOptions.status, 'failed')
    assert.equal(preserveOptions.includeSharedArtifacts, false)
    assert.deepEqual(copiedReports, [])
    assert.equal(oldReports.size, 0)
})

test('does not preserve reports when the Playwright child never spawns', async () => {
    let preserveOptions

    await assert.rejects(
        coordinateLocalSupabaseE2eGate({
            acquireLock: async () => ({ ownerPid: 123, token: 'lease-token' }),
            releaseLock: async () => {},
            resetArtifacts: async () => {},
            getStackState: async () => 'running',
            startStack: async () => assert.fail('a running stack must be reused'),
            stopStack: async () => assert.fail('a reused stack must not be stopped'),
            prepare: async () => {},
            runSuite: async () => {
                throw new Error('Playwright process failed before spawn')
            },
            preserveArtifacts: async (options) => {
                preserveOptions = options
            }
        }),
        /failed before spawn/
    )

    assert.equal(preserveOptions.includeSharedArtifacts, false)
})

test('rejects a competing lock before touching stack state or reports', async () => {
    const events = []

    await assert.rejects(
        coordinateLocalSupabaseE2eGate({
            acquireLock: async () => {
                events.push('acquire-lock')
                throw new Error('lock busy')
            },
            releaseLock: async () => events.push('release-lock'),
            resetArtifacts: async () => events.push('reset-artifacts'),
            getStackState: async () => events.push('status'),
            startStack: async () => events.push('start-stack'),
            stopStack: async () => events.push('stop-stack'),
            prepare: async () => events.push('prepare'),
            runSuite: async () => events.push('run-suite'),
            preserveArtifacts: async ({ includeSharedArtifacts }) => {
                assert.equal(includeSharedArtifacts, false)
                events.push('preserve-gate-status')
            }
        }),
        /lock busy/
    )

    assert.deepEqual(events, ['acquire-lock', 'preserve-gate-status'])
})

test('retains stack and lock when a failed start leaves ownership ambiguous', async () => {
    const events = []
    const states = ['stopped', 'running']

    await assert.rejects(
        coordinateLocalSupabaseE2eGate({
            acquireLock: async () => ({ ownerPid: 123, token: 'lease-token' }),
            releaseLock: async () => events.push('release-lock'),
            resetArtifacts: async () => events.push('reset-artifacts'),
            getStackState: async () => states.shift(),
            startStack: async () => {
                events.push('start-stack')
                throw new Error('start command interrupted')
            },
            stopStack: async () => events.push('stop-stack'),
            prepare: async () => events.push('prepare'),
            runSuite: async () => events.push('run-suite'),
            preserveArtifacts: async () => events.push('preserve-artifacts')
        }),
        /ownership is ambiguous/
    )

    assert.deepEqual(events, ['reset-artifacts', 'start-stack', 'preserve-artifacts'])
})

test('keeps the shared lock when a test process may outlive a signal', async () => {
    const events = []

    await assert.rejects(
        coordinateLocalSupabaseE2eGate({
            acquireLock: async () => ({ ownerPid: 123, token: 'lease-token' }),
            releaseLock: async () => events.push('release-lock'),
            resetArtifacts: async () => events.push('reset-artifacts'),
            getStackState: async () => 'running',
            startStack: async () => events.push('start-stack'),
            stopStack: async () => events.push('stop-stack'),
            prepare: async () => events.push('prepare'),
            runSuite: async (_lease, markSuiteStarted) => {
                markSuiteStarted()
                events.push('run-suite')
                throw new Error('interrupted')
            },
            preserveArtifacts: async () => events.push('preserve-artifacts'),
            canReleaseLock: () => false,
            reportCleanupFailure: () => events.push('retain-lock')
        }),
        /interrupted/
    )

    assert.deepEqual(events, ['reset-artifacts', 'prepare', 'run-suite', 'preserve-artifacts', 'retain-lock'])
})

test('retains the shared lock when Supabase stop is not confirmed', async () => {
    const events = []
    const states = ['stopped', 'running', 'running']

    await coordinateLocalSupabaseE2eGate({
        acquireLock: async () => ({ ownerPid: 123, token: 'lease-token' }),
        releaseLock: async () => events.push('release-lock'),
        resetArtifacts: async () => events.push('reset-artifacts'),
        getStackState: async () => {
            events.push('status')
            return states.shift()
        },
        startStack: async () => events.push('start-stack'),
        stopStack: async () => events.push('stop-stack'),
        prepare: async () => events.push('prepare'),
        runSuite: async (_lease, markSuiteStarted) => {
            markSuiteStarted()
            events.push('run-suite')
        },
        preserveArtifacts: async () => events.push('preserve-artifacts'),
        reportCleanupFailure: () => events.push('retain-lock')
    })

    assert.deepEqual(events, [
        'reset-artifacts',
        'status',
        'start-stack',
        'status',
        'prepare',
        'run-suite',
        'preserve-artifacts',
        'stop-stack',
        'status',
        'retain-lock'
    ])
})
