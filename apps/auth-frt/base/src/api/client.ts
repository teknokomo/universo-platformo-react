import axios, { AxiosInstance } from 'axios'

export const AUTH_CSRF_STORAGE_KEY = 'up.auth.csrf'
const CSRF_STORAGE_SYMBOL = Symbol.for('universo.auth.csrfStorageKey')

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
        csrfStorageKey: AUTH_CSRF_STORAGE_KEY,
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
                ...options,
        }

        const instance = axios.create({
                baseURL: mergedOptions.baseURL,
                withCredentials: true,
                headers: {
                        'Content-Type': 'application/json',
                },
        })

        ;(instance as any)[CSRF_STORAGE_SYMBOL] = mergedOptions.csrfStorageKey

        const csrfFetcher = axios.create({
                baseURL: mergedOptions.baseURL,
                withCredentials: true,
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
                (error) => {
                        if (error?.response?.status === 419) {
                                const storage = getSessionStorage()
                                storage?.removeItem(mergedOptions.csrfStorageKey)
                        }
                        return Promise.reject(error)
                },
        )

        return instance
}

export type AuthClient = ReturnType<typeof createAuthClient>

export const getStoredCsrfToken = (client?: AuthClient, storageKey?: string): string | null => {
        const storage = getSessionStorage()
        if (!storage) return null

        const resolvedKey =
                storageKey ?? ((client as any)?.[CSRF_STORAGE_SYMBOL] as string | undefined) ?? AUTH_CSRF_STORAGE_KEY

        return storage.getItem(resolvedKey) ?? null
}
