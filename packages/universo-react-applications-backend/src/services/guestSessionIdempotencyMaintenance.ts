import type { DbExecutor } from '@universo-react/utils'
import { purgeExpiredGuestSessionIdempotency } from '../persistence/guestSessionIdempotencyStore'

const CLEANUP_BATCH_SIZE = 500
const DEFAULT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000

export async function runGuestSessionIdempotencyCleanup(executor: DbExecutor): Promise<number> {
    let deletedCount = 0

    for (;;) {
        const batchCount = await purgeExpiredGuestSessionIdempotency(executor, CLEANUP_BATCH_SIZE)
        deletedCount += batchCount
        if (batchCount < CLEANUP_BATCH_SIZE) return deletedCount
    }
}

export type GuestSessionIdempotencyCleanupHandle = { stop: () => Promise<void> }

export function startGuestSessionIdempotencyCleanup(
    getExecutor: () => DbExecutor,
    options: {
        intervalMs?: number
        onCleanup?: (deletedCount: number) => void
        onError?: (error: unknown) => void
    } = {}
): GuestSessionIdempotencyCleanupHandle {
    const intervalMs = options.intervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS
    let stopped = false
    let activeRun: Promise<void> | null = null

    const run = (): Promise<void> => {
        if (stopped || activeRun) return activeRun ?? Promise.resolve()
        activeRun = runGuestSessionIdempotencyCleanup(getExecutor())
            .then((deletedCount) => options.onCleanup?.(deletedCount))
            .catch((error: unknown) => options.onError?.(error))
            .finally(() => {
                activeRun = null
            })
        return activeRun
    }

    const timer = setInterval(() => void run(), intervalMs)
    timer.unref?.()
    void run()

    return {
        async stop() {
            stopped = true
            clearInterval(timer)
            await activeRun
        }
    }
}
