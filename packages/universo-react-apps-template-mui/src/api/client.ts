const AUTH_CSRF_STORAGE_KEY = 'up.auth.csrf'

let csrfTokenPromise: Promise<string> | null = null

const getSessionStorage = (): Storage | null => {
    try {
        return typeof window !== 'undefined' ? window.sessionStorage : null
    } catch {
        return null
    }
}

const buildApiUrl = (apiBaseUrl: string, path: string): string => {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const apiPath = `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`

    if (/^https?:\/\//i.test(normalizedBase)) {
        return new URL(apiPath).toString()
    }

    return new URL(apiPath, window.location.origin).toString()
}

export const buildAppsApiUrl = (apiBaseUrl: string, applicationId: string, path = ''): string => {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const apiPath = `${normalizedBase}/api/v1/apps/${encodeURIComponent(applicationId)}${path}`

    if (/^https?:\/\//i.test(normalizedBase)) {
        return new URL(apiPath).toString()
    }

    return new URL(apiPath, window.location.origin).toString()
}

const getStoredCsrfToken = (): string | null => getSessionStorage()?.getItem(AUTH_CSRF_STORAGE_KEY) ?? null

const clearStoredCsrfToken = (): void => {
    getSessionStorage()?.removeItem(AUTH_CSRF_STORAGE_KEY)
}

const storeCsrfToken = (token: string): void => {
    getSessionStorage()?.setItem(AUTH_CSRF_STORAGE_KEY, token)
}

export const extractErrorMessage = async (res: Response, fallbackPrefix: string): Promise<string> => {
    const text = await res.text().catch(() => '')
    if (text) {
        try {
            const json = JSON.parse(text)
            const msg = json?.error ?? json?.message ?? json?.detail
            if (typeof msg === 'string' && msg.trim().length > 0) {
                return `${fallbackPrefix} (${res.status}): ${msg}`
            }
        } catch {
            // Not JSON — use raw text
        }
        return `${fallbackPrefix} (${res.status}): ${text}`
    }
    return `${fallbackPrefix} (${res.status}): ${res.statusText}`
}

export class AppsApiError extends Error {
    readonly status: number
    readonly code?: string
    readonly details?: unknown

    constructor(message: string, status: number, code?: string, details?: unknown) {
        super(message)
        this.name = 'AppsApiError'
        this.status = status
        this.code = code
        this.details = details
    }
}

export const throwAppsApiError = async (res: Response, fallbackPrefix: string): Promise<never> => {
    const text = await res.text().catch(() => '')
    let message = `${fallbackPrefix} (${res.status})`
    let code: string | undefined
    let details: unknown

    if (text) {
        try {
            const json = JSON.parse(text) as { error?: unknown; message?: unknown; detail?: unknown; code?: unknown; details?: unknown }
            const candidate = json.error ?? json.message ?? json.detail
            if (typeof candidate === 'string' && candidate.trim()) message = candidate.trim()
            if (typeof json.code === 'string' && json.code.trim()) code = json.code.trim()
            details = json.details
        } catch {
            message = text
        }
    }

    throw new AppsApiError(message, res.status, code, details)
}

const resolveCsrfToken = async (apiBaseUrl: string): Promise<string> => {
    const stored = getStoredCsrfToken()
    if (stored) {
        return stored
    }

    if (!csrfTokenPromise) {
        csrfTokenPromise = (async () => {
            const response = await fetch(buildApiUrl(apiBaseUrl, '/auth/csrf'), { credentials: 'include' })
            if (!response.ok) {
                throw new Error(await extractErrorMessage(response, 'CSRF token request failed'))
            }

            const payload = (await response.json()) as { csrfToken?: unknown }
            if (typeof payload?.csrfToken !== 'string' || payload.csrfToken.trim().length === 0) {
                throw new Error('CSRF token response is invalid')
            }

            storeCsrfToken(payload.csrfToken)
            return payload.csrfToken
        })().finally(() => {
            csrfTokenPromise = null
        })
    }

    return csrfTokenPromise
}

export async function fetchWithCsrf(apiBaseUrl: string, input: string, init: RequestInit = {}): Promise<Response> {
    const method = (init.method ?? 'GET').toUpperCase()
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return fetch(input, {
            ...init,
            credentials: init.credentials ?? 'include'
        })
    }

    const applyRequest = async (csrfToken: string): Promise<Response> => {
        const headers = new Headers(init.headers ?? {})
        headers.set('X-CSRF-Token', csrfToken)

        return fetch(input, {
            ...init,
            credentials: init.credentials ?? 'include',
            headers
        })
    }

    let response = await applyRequest(await resolveCsrfToken(apiBaseUrl))
    if (response.status !== 419) {
        return response
    }

    clearStoredCsrfToken()
    response = await applyRequest(await resolveCsrfToken(apiBaseUrl))
    return response
}
