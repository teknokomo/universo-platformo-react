import { useQuery } from '@tanstack/react-query'

import { fetchMiningState } from '../../api/api'
import type { EconomyAsteroidState, EconomyMineResponse, EconomyMiningState } from '@universo-react/types'

export const MINING_STATE_QUERY_KEY_PREFIX = 'mining-state'
/** Fallback poll interval; the server payload's `statePollMs` takes precedence (TZ §11.5). */
const DEFAULT_MINING_STATE_POLL_MS = 2000

export interface UseMiningStateOptions {
    apiBaseUrl: string
    applicationId: string
    /** The workspace the realtime room was joined with (CodeRabbit, PR #934). */
    workspaceId: string | null | undefined
    /** ready && realtime connected/restored && member mode (TZ §11.5 gating). */
    enabled: boolean
}

export interface UseMiningStateResult {
    data: EconomyMiningState | null
    error: unknown
    isPolling: boolean
    refetch: () => void
}

/**
 * Belt-state polling for the mining canvas controls (mining TZ §11.5, plan C2):
 * a TanStack Query with a `statePollMs`-driven `refetchInterval`. TanStack's
 * default `refetchIntervalInBackground: false` pauses the poll while the tab is
 * hidden, satisfying the visibilitychange requirement without manual listeners.
 */
export function useMiningState({ apiBaseUrl, applicationId, workspaceId, enabled }: UseMiningStateOptions): UseMiningStateResult {
    const query = useQuery({
        queryKey: [MINING_STATE_QUERY_KEY_PREFIX, apiBaseUrl, applicationId, workspaceId ?? null],
        queryFn: ({ signal }) => fetchMiningState(apiBaseUrl, applicationId, workspaceId, signal),
        enabled,
        refetchInterval: (query) =>
            (query.state.data as EconomyMiningState | undefined)?.constants.statePollMs ?? DEFAULT_MINING_STATE_POLL_MS
    })

    return {
        data: query.data ?? null,
        error: query.error,
        isPolling: enabled,
        refetch: () => {
            void query.refetch()
        }
    }
}

/**
 * Patches the asteroid list from a fire response (own-shot local update, TZ
 * §11.5 — the UI does not wait for the next poll tick).
 */
export function applyFireResult(asteroids: EconomyAsteroidState[], fire: EconomyMineResponse): EconomyAsteroidState[] {
    return asteroids.map((asteroid) =>
        asteroid.code === fire.asteroid.code
            ? { ...asteroid, remainingQuantityKg: fire.asteroid.remainingQuantityKg, status: fire.asteroid.status }
            : asteroid
    )
}
