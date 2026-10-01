export interface RlsConnectionLease {
    close(): Promise<void>
    isClosed(): boolean
    isReleased(): boolean
    release(): void
    run<T>(operation: () => Promise<T>): Promise<T>
}

/** Coordinates request-scoped work with the pinned connection's close/release lifecycle. */
export function createRlsConnectionLease(): RlsConnectionLease {
    let acceptingOperations = true
    let released = false
    let activeOperations = 0
    let resolveOperationsDrained: (() => void) | null = null
    let drainPromise: Promise<void> | null = null

    const run = async <T>(operation: () => Promise<T>): Promise<T> => {
        if (!acceptingOperations || released) throw new Error('RLS connection lease is closed')
        activeOperations += 1
        try {
            return await operation()
        } finally {
            activeOperations -= 1
            if (activeOperations === 0) {
                const resolve = resolveOperationsDrained
                resolveOperationsDrained = null
                resolve?.()
            }
        }
    }

    const close = (): Promise<void> => {
        acceptingOperations = false
        if (!drainPromise) {
            drainPromise = (async () => {
                while (activeOperations > 0) {
                    await new Promise<void>((resolve) => {
                        resolveOperationsDrained = resolve
                    })
                }
            })()
        }
        return drainPromise
    }

    const release = (): void => {
        acceptingOperations = false
        released = true
    }

    return {
        close,
        isClosed: () => !acceptingOperations || released,
        isReleased: () => released,
        release,
        run
    }
}
