import { QueryClient } from '@tanstack/react-query'

/**
 * Parse Retry-After header value (seconds or HTTP-date)
 */
const parseRetryAfter = (value) => {
    if (!value) return null
    if (typeof value === 'string') {
        const seconds = Number(value)
        if (!isNaN(seconds)) {
            return Math.max(0, seconds * 1000)
        }
        const parsedDate = Date.parse(value)
        if (!isNaN(parsedDate)) {
            const diff = parsedDate - Date.now()
            return diff > 0 ? diff : 0
        }
    }
    return null
}

/**
 * Create global QueryClient for the entire application
 *
 * This is the SINGLE QueryClient instance used across the whole app.
 * Following TanStack Query v5 best practices: one QueryClient per application.
 *
 * Features:
 * - 5min stale time for most queries (reduces API calls significantly)
 * - 30min garbage collection (memory management)
 * - Smart retry: skip auth errors (401/403) and rate limits (429)
 * - Exponential backoff with Retry-After header respect
 * - Automatic request deduplication (prevents duplicate concurrent requests)
 * - Persistent cache across component lifecycle
 *
 * @returns {QueryClient} Global QueryClient instance
 */
export const createGlobalQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                // Data considered fresh for 5 minutes
                // This dramatically reduces API calls for data that doesn't change often
                staleTime: 5 * 60 * 1000,

                // Garbage collection after 30 minutes of inactivity
                // Keeps memory usage under control
                gcTime: 30 * 60 * 1000,

                // Don't refetch on window focus by default
                // Can be overridden per-query if needed
                refetchOnWindowFocus: false,

                // Retry strategy: be smart about which errors to retry
                retry: (failureCount, error) => {
                    const status = error?.response?.status
                    if (!status) return failureCount < 1

                    // Never retry these status codes
                    if ([400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504].includes(status)) {
                        return false
                    }

                    // For rare transient statuses (for example 408), allow one retry.
                    return failureCount < 1
                },

                // Prevent automatic re-retries on remount for errored queries.
                // Users can still retry manually via UI actions.
                retryOnMount: false,

                // Exponential backoff with Retry-After header respect
                retryDelay: (attempt, error) => {
                    // Check for Retry-After header (RFC 7231)
                    const retryAfter = error?.response?.headers?.['retry-after'] || error?.response?.headers?.['Retry-After']

                    const parsed = parseRetryAfter(retryAfter)
                    if (parsed !== null) {
                        // Respect server's Retry-After + small jitter to prevent thundering herd
                        return parsed + Math.random() * 150
                    }

                    // Exponential backoff: min(1s * 2^attempt, 30s)
                    return Math.min(1000 * Math.pow(2, attempt), 30000)
                }
            },

            mutations: {
                // Don't retry mutations by default (they may have side effects)
                retry: false
            }
        }
    })
