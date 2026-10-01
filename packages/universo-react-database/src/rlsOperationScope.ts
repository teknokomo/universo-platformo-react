import { AsyncLocalStorage } from 'node:async_hooks'

type TransactionOutcome<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }

export type RlsOperationFailure = { kind: 'database'; reason: unknown } | { kind: 'transaction'; reason: unknown }

type TransactionFailure = {
    failed: boolean
    reason: unknown
}

export type RlsOperationScope = ReturnType<typeof createRlsOperationScope>

const activeOperationScope = new AsyncLocalStorage<RlsOperationScope>()

/** Returns the transaction scope inherited by the current async call chain. */
export function getActiveRlsOperationScope(): RlsOperationScope | undefined {
    return activeOperationScope.getStore()
}

/** Runs transaction work with its operation scope available to request-bound session queries. */
export function runWithRlsOperationScope<T>(scope: RlsOperationScope, operation: () => Promise<T>): Promise<T> {
    return activeOperationScope.run(scope, operation)
}

/** Runs a session query in the active transaction scope, or in the request scope outside a transaction. */
export function runInRlsOperationScope<T>(fallbackScope: RlsOperationScope, operation: () => Promise<T>): Promise<T> {
    const scope = activeOperationScope.getStore() ?? fallbackScope
    return scope.run(async () => {
        try {
            return await operation()
        } catch (error) {
            scope.recordFailure(error)
            throw error
        }
    })
}

/** Serializes transaction lifetimes while leaving ordinary queries concurrent. */
export function createSerialQueue() {
    let tail = Promise.resolve()

    return async <T>(operation: () => Promise<T>): Promise<T> => {
        const previous = tail
        let release!: () => void
        tail = new Promise<void>((resolve) => {
            release = resolve
        })
        await previous
        try {
            return await operation()
        } finally {
            release()
        }
    }
}

/** Tracks query work, fences parent queries outside savepoint lifetimes, and drains admitted work. */
export function createRlsOperationScope(options: { trackTransactionFailures?: boolean } = {}) {
    let acceptingOperations = true
    let activeOperations = 0
    let activeQueries = 0
    let queuedTransactions = 0
    const operationFailures: RlsOperationFailure[] = []
    const transactionFailures: TransactionFailure[] = []
    let resolveOperationsDrained: (() => void) | null = null
    let resolveQueriesDrained: (() => void) | null = null
    let drainPromise: Promise<RlsOperationFailure[]> | null = null
    const resolveQueryWaiters: Array<() => void> = []
    const runTransactionQueue = createSerialQueue()
    const trackTransactionFailures = options.trackTransactionFailures !== false

    const notifyOperationsDrained = () => {
        if (activeOperations !== 0) return
        const resolve = resolveOperationsDrained
        resolveOperationsDrained = null
        resolve?.()
    }

    const notifyQueriesDrained = () => {
        if (activeQueries !== 0) return
        const resolve = resolveQueriesDrained
        resolveQueriesDrained = null
        resolve?.()
    }

    const notifyQueryWaiters = () => {
        if (queuedTransactions !== 0) return
        for (const resolve of resolveQueryWaiters.splice(0)) resolve()
    }

    const waitForQuerySlot = async () => {
        while (queuedTransactions > 0) {
            await new Promise<void>((resolve) => resolveQueryWaiters.push(resolve))
        }
    }

    const waitForQueriesToDrain = async () => {
        while (activeQueries > 0) {
            await new Promise<void>((resolve) => {
                resolveQueriesDrained = resolve
            })
        }
    }

    return {
        closeAdmission: () => {
            acceptingOperations = false
        },
        closeAndDrain: (): Promise<RlsOperationFailure[]> => {
            acceptingOperations = false
            if (!drainPromise) {
                drainPromise = (async () => {
                    while (activeOperations > 0) {
                        await new Promise<void>((resolve) => {
                            resolveOperationsDrained = resolve
                        })
                    }
                    return [
                        ...operationFailures,
                        ...transactionFailures
                            .filter((failure) => failure.failed)
                            .map((failure) => ({ kind: 'transaction' as const, reason: failure.reason }))
                    ]
                })()
            }
            return drainPromise
        },
        isClosed: () => !acceptingOperations,
        recordFailure: (error: unknown) => operationFailures.push({ kind: 'database', reason: error }),
        run: async <T>(operation: () => Promise<T>): Promise<T> => {
            if (!acceptingOperations) throw new Error('RLS transaction scope is closed')
            activeOperations += 1
            try {
                do {
                    await waitForQuerySlot()
                } while (queuedTransactions > 0)
                activeQueries += 1
                try {
                    return await operation()
                } finally {
                    activeQueries -= 1
                    notifyQueriesDrained()
                }
            } finally {
                activeOperations -= 1
                notifyOperationsDrained()
            }
        },
        runSerializedTransaction: <T>(
            operation: () => Promise<T>,
            runWithLease: <TResult>(leasedOperation: () => Promise<TResult>) => Promise<TResult> = (leasedOperation) => leasedOperation()
        ) => {
            if (!acceptingOperations) {
                const reason = new Error('RLS transaction scope is closed')
                const outcome = Promise.resolve<TransactionOutcome<T>>({ status: 'rejected', reason })
                return {
                    outcome,
                    promise: Promise.reject<T>(reason)
                }
            }

            const failure: TransactionFailure = { failed: false, reason: undefined }
            if (trackTransactionFailures) transactionFailures.push(failure)
            activeOperations += 1
            queuedTransactions += 1

            let resolveOutcome!: (result: TransactionOutcome<T>) => void
            let executionStarted = false
            let settled = false
            const outcome = new Promise<TransactionOutcome<T>>((resolve) => {
                resolveOutcome = resolve
            })

            const settle = (result: TransactionOutcome<T>) => {
                if (settled) return
                settled = true
                if (result.status === 'rejected') {
                    failure.failed = true
                    failure.reason = result.reason
                }
                activeOperations -= 1
                notifyOperationsDrained()
                resolveOutcome(result)
            }

            const execute = () => {
                executionStarted = true
                const execution = runTransactionQueue(async () => {
                    await waitForQueriesToDrain()
                    try {
                        return await operation()
                    } finally {
                        queuedTransactions -= 1
                        notifyQueryWaiters()
                    }
                })
                void execution.then(
                    (value) => settle({ status: 'fulfilled', value }),
                    (reason: unknown) => settle({ status: 'rejected', reason })
                )
                return outcome
            }

            let leasedOutcome: Promise<TransactionOutcome<T>>
            try {
                leasedOutcome = Promise.resolve(runWithLease(execute)).catch((reason: unknown) => {
                    if (!executionStarted) {
                        queuedTransactions -= 1
                        notifyQueryWaiters()
                    }
                    settle({ status: 'rejected', reason })
                    return { status: 'rejected', reason }
                })
            } catch (reason) {
                queuedTransactions -= 1
                notifyQueryWaiters()
                settle({ status: 'rejected', reason })
                leasedOutcome = Promise.resolve({ status: 'rejected', reason })
            }

            return {
                outcome: leasedOutcome,
                promise: leasedOutcome.then((result) => {
                    if (result.status === 'rejected') throw result.reason
                    return result.value
                })
            }
        }
    }
}
