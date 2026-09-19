import {
    PUBLIC_APPLICATION_RUNTIME_ERROR_CODE,
    publicMarketingApplicationRuntimeSchema,
    type PublicMarketingApplicationRuntime
} from '@universo-react/types'

const PUBLIC_RUNTIME_UI_PROBE_ACCEPT = 'application/vnd.universo.public-runtime-probe+json'

export class PublicApplicationRuntimeError extends Error {
    readonly status: number
    readonly code: string | null

    constructor(status: number, code: string | null, message = 'Public application runtime request failed') {
        super(message)
        this.name = 'PublicApplicationRuntimeError'
        this.status = status
        this.code = code
    }
}

const readErrorCode = (value: unknown): string | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const code = (value as { code?: unknown }).code
    return typeof code === 'string' && code.trim() ? code.trim() : null
}

const readJsonBody = async (response: Response): Promise<unknown> => {
    try {
        return await response.json()
    } catch {
        return null
    }
}

export const isPublicApplicationUnavailableError = (error: unknown): boolean =>
    error instanceof PublicApplicationRuntimeError &&
    error.status === 404 &&
    (error.code === null || error.code === PUBLIC_APPLICATION_RUNTIME_ERROR_CODE)

export const getPublicApplicationRuntime = async (applicationRef: string, locale: string): Promise<PublicMarketingApplicationRuntime> => {
    const normalizedRef = applicationRef.trim()
    if (!normalizedRef) {
        throw new PublicApplicationRuntimeError(400, null, 'Application reference is required')
    }

    const params = new URLSearchParams({ locale })
    const response = await fetch(`/api/v1/public/applications/${encodeURIComponent(normalizedRef)}/runtime?${params.toString()}`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
            Accept: PUBLIC_RUNTIME_UI_PROBE_ACCEPT
        }
    })
    if (response.status === 204) {
        throw new PublicApplicationRuntimeError(404, PUBLIC_APPLICATION_RUNTIME_ERROR_CODE)
    }
    const body = await readJsonBody(response)

    if (!response.ok) {
        throw new PublicApplicationRuntimeError(response.status, readErrorCode(body))
    }

    const parsed = publicMarketingApplicationRuntimeSchema.safeParse(body)
    if (!parsed.success) {
        throw new PublicApplicationRuntimeError(502, 'PUBLIC_APPLICATION_RUNTIME_RESPONSE_INVALID')
    }

    return parsed.data
}

export interface CanonicalApplicationRuntimePathInput {
    applicationRef: string
    canonicalAlias: string | null
    remainingPath?: string | null
    search?: string | null
}

export const buildCanonicalApplicationRuntimePath = ({
    applicationRef,
    canonicalAlias,
    remainingPath,
    search
}: CanonicalApplicationRuntimePathInput): string | null => {
    if (!canonicalAlias || canonicalAlias === applicationRef) return null

    const normalizedRemainingPath = remainingPath?.replace(/^\/+|\/+$/g, '') ?? ''
    const suffix = normalizedRemainingPath ? `/${normalizedRemainingPath}` : ''
    const normalizedSearch = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''
    return `/a/${canonicalAlias}${suffix}${normalizedSearch}`
}
