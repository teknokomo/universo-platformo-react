function toErrorMessage(error) {
    return error instanceof Error ? error.message : String(error)
}

export async function coordinateLocalSupabaseE2eGate({
    acquireLock,
    releaseLock,
    resetArtifacts,
    getStackState,
    startStack,
    stopStack,
    prepare,
    runSuite,
    preserveArtifacts,
    canReleaseLock = () => true,
    reportCleanupFailure = () => {}
}) {
    let lockLease = null
    let ownsStack = false
    let artifactsReady = false
    let suiteStarted = false
    let releaseLockAllowed = true
    let failed = false
    let failureMessage = null

    try {
        lockLease = await acquireLock()
        await resetArtifacts()
        artifactsReady = true

        const initialStackState = await getStackState()
        if (initialStackState === 'stopped') {
            try {
                await startStack()
            } catch (startError) {
                try {
                    const stateAfterFailedStart = await getStackState({ afterStartFailure: true })
                    if (stateAfterFailedStart === 'running') {
                        releaseLockAllowed = false
                        throw new Error(
                            'Supabase start failed after the stack became visible; ownership is ambiguous, so the stack and run lock are retained fail-closed'
                        )
                    }
                    if (stateAfterFailedStart !== 'stopped') {
                        releaseLockAllowed = false
                        throw new Error('Supabase start failed and stack state is ambiguous; retaining the shared run lock fail-closed')
                    }
                } catch (statusError) {
                    releaseLockAllowed = false
                    if (statusError instanceof Error && statusError.message.includes('ownership is ambiguous')) throw statusError
                    throw new Error('Supabase start failed and stack state is ambiguous; retaining the shared run lock fail-closed')
                }
                throw startError
            }

            let startedStackState
            try {
                startedStackState = await getStackState()
            } catch {
                releaseLockAllowed = false
                throw new Error('Supabase start completed but stack state is ambiguous; retaining the shared run lock fail-closed')
            }
            if (startedStackState !== 'running') {
                releaseLockAllowed = false
                throw new Error('Supabase start completed but stack state is not confirmed; retaining the shared run lock fail-closed')
            }
            ownsStack = true
        } else if (initialStackState !== 'running') {
            throw new Error(`Unexpected Supabase stack state: ${String(initialStackState)}`)
        }

        await prepare()
        await runSuite(lockLease, () => {
            suiteStarted = true
        })
    } catch (error) {
        failed = true
        failureMessage = toErrorMessage(error)
        throw error
    } finally {
        try {
            await preserveArtifacts({
                status: failed ? 'failed' : 'passed',
                error: failureMessage,
                includeSharedArtifacts: Boolean(lockLease && artifactsReady && suiteStarted)
            })
        } catch (error) {
            reportCleanupFailure(error)
        }

        if (ownsStack) {
            if (!canReleaseLock()) {
                releaseLockAllowed = false
                reportCleanupFailure(
                    new Error('E2E child processes may still use Supabase; leaving the stack and shared run lock in place')
                )
            } else {
                try {
                    await stopStack()
                    const stoppedStackState = await getStackState({ afterStop: true, allowAfterSignal: true })
                    if (stoppedStackState !== 'stopped') {
                        releaseLockAllowed = false
                        reportCleanupFailure(
                            new Error('Supabase stop completed but the stack is not confirmed stopped; retaining the shared run lock')
                        )
                    }
                } catch (error) {
                    releaseLockAllowed = false
                    reportCleanupFailure(error)
                }
            }
        }

        if (lockLease && releaseLockAllowed && !canReleaseLock()) {
            releaseLockAllowed = false
            reportCleanupFailure(new Error('E2E child processes may still use Supabase; retaining the shared run lock fail-closed'))
        }

        if (lockLease && releaseLockAllowed) {
            try {
                await releaseLock(lockLease)
            } catch (error) {
                reportCleanupFailure(error)
            }
        }
    }
}
