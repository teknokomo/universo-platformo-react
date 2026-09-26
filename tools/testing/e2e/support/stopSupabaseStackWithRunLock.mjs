export async function stopSupabaseStackWithRunLock({
    acquireLock,
    releaseLock,
    getStackState,
    stopStack,
    canReleaseLock = () => true,
    onLockUnavailable = () => {},
    reportCleanupFailure = () => {}
}) {
    let lockLease = null
    let stopConfirmed = false

    try {
        try {
            lockLease = await acquireLock()
        } catch (error) {
            onLockUnavailable(error)
            return false
        }

        const stackState = await getStackState()
        if (stackState === 'stopped') {
            stopConfirmed = true
            return true
        }
        if (stackState !== 'running') throw new Error(`Unexpected Supabase stack state: ${String(stackState)}`)

        await stopStack()
        const stoppedStackState = await getStackState({ afterStop: true, allowAfterSignal: true })
        if (stoppedStackState !== 'stopped') throw new Error('Supabase stop completed but the stack is not confirmed stopped')
        stopConfirmed = true
        return true
    } finally {
        if (lockLease) {
            if (!stopConfirmed) {
                reportCleanupFailure(new Error('Supabase stop was not confirmed; retaining the shared E2E run lock fail-closed'))
            } else if (!canReleaseLock()) {
                reportCleanupFailure(new Error('E2E child process termination is uncertain; retaining the shared run lock fail-closed'))
            } else {
                try {
                    await releaseLock(lockLease)
                } catch (error) {
                    reportCleanupFailure(error)
                }
            }
        }
    }
}
