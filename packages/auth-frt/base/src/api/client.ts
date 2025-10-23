import axios, { AxiosInstance } from 'axios'

export const AUTH_CSRF_STORAGE_KEY = 'up.auth.csrf'
const CSRF_STORAGE_SYMBOL = Symbol.for('universo.auth.csrfStorageKey')

const RETRYABLE_METHODS = new Set(['get', 'head', 'options'])
const RETRYABLE_STATUSES = new Set([503, 504])
const MAX_RETRY_ATTEMPTS = 4
const BASE_BACKOFF_MS = 300

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const parseRetryAfter = (value: unknown): number | null => {
    if (!value) return null
    if (typeof value === 'string') {
        const seconds = Number(value)
        if (!Number.isNaN(seconds)) {
            return Math.max(0, seconds * 1000)
        }
        const nextDate = Date.parse(value)
        if (!Number.isNaN(nextDate)) {
            const diff = nextDate - Date.now()
            return diff > 0 ? diff : 0
        }
    }
    return null
}

const resolveBackoffDelay = (attempt: number, retryAfter?: unknown): number => {
    const headerDelay = parseRetryAfter(retryAfter)
    if (headerDelay !== null) {
        return headerDelay + Math.random() * 150
    }
    const expo = BASE_BACKOFF_MS * Math.pow(2, attempt)
    const jitter = Math.random() * 100
    return expo + jitter
}

export interface AuthClientOptions {
    /** Base URL pointing to the API root (e.g. `${baseURL}/api/v1`). */
    baseURL: string
    /** Path that returns `{ csrfToken: string }`. Defaults to `auth/csrf`. */
    csrfPath?: string
    /** Storage key used to persist the fetched CSRF token for the session. */
    csrfStorageKey?: string
}

const defaultOptions: Required<Omit<AuthClientOptions, 'baseURL'>> = {
    csrfPath: 'auth/csrf',
    csrfStorageKey: AUTH_CSRF_STORAGE_KEY
}

const getSessionStorage = () => {
    try {
        return window.sessionStorage
    } catch (error) {
        console.warn('[auth] sessionStorage unavailable', error)
        return undefined
    }
}

export const createAuthClient = (options: AuthClientOptions): AxiosInstance => {
    const mergedOptions: Required<AuthClientOptions> = {
        csrfPath: defaultOptions.csrfPath,
        csrfStorageKey: defaultOptions.csrfStorageKey,
        ...options
    }

    const instance = axios.create({
        baseURL: mergedOptions.baseURL,
        withCredentials: true,
        headers: {
            'Content-Type': 'application/json'
        }
    })

    ;(instance as any)[CSRF_STORAGE_SYMBOL] = mergedOptions.csrfStorageKey

    const csrfFetcher = axios.create({
        baseURL: mergedOptions.baseURL,
        withCredentials: true
    })

    let csrfPromise: Promise<string> | null = null

    const resolveCsrfToken = async () => {
        const storage = getSessionStorage()
        const cached = storage?.getItem(mergedOptions.csrfStorageKey)
        if (cached) return cached
        if (!csrfPromise) {
            csrfPromise = csrfFetcher
                .get<{ csrfToken: string }>(mergedOptions.csrfPath)
                .then(({ data }) => {
                    if (typeof data?.csrfToken !== 'string') throw new Error('Invalid CSRF response')
                    storage?.setItem(mergedOptions.csrfStorageKey, data.csrfToken)
                    return data.csrfToken
                })
                .finally(() => {
                    csrfPromise = null
                })
        }
        return csrfPromise
    }

    instance.interceptors.request.use(async (config) => {
        const token = await resolveCsrfToken()
        config.headers = config.headers ?? {}
        config.headers['X-CSRF-Token'] = token
        config.withCredentials = true
        return config
    })

    instance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const status = error?.response?.status
            if (status === 419) {
                const storage = getSessionStorage()
                storage?.removeItem(mergedOptions.csrfStorageKey)
            }

            const config: Record<string, any> = error?.config ?? {}
            const method = typeof config?.method === 'string' ? config.method.toLowerCase() : ''
            const shouldRetry = RETRYABLE_METHODS.has(method) && typeof status === 'number' && RETRYABLE_STATUSES.has(status)

            if (shouldRetry) {
                const currentAttempt = config.__retryCount ?? 0
                if (currentAttempt < MAX_RETRY_ATTEMPTS) {
                    const retryAfterHeader = error?.response?.headers?.['retry-after'] ?? error?.response?.headers?.['Retry-After']
                    const delayMs = resolveBackoffDelay(currentAttempt, retryAfterHeader)
                    config.__retryCount = currentAttempt + 1
                    await delay(delayMs)
                    return instance(config)
                }
            }

            return Promise.reject(error)
        }
    )

    return instance
}

export type AuthClient = ReturnType<typeof createAuthClient>

export const getStoredCsrfToken = (client?: AuthClient, storageKey?: string): string | null => {
    const storage = getSessionStorage()
    if (!storage) return null

    const resolvedKey = storageKey ?? ((client as any)?.[CSRF_STORAGE_SYMBOL] as string | undefined) ?? AUTH_CSRF_STORAGE_KEY

    return storage.getItem(resolvedKey) ?? null
}
