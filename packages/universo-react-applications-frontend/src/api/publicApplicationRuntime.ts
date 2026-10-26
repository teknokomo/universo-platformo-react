import {
    MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES,
    PUBLIC_APPLICATION_RUNTIME_ERROR_CODE,
    publicApplicationRuntimeSchema,
    type PublicApplicationRuntime
} from '@universo-react/types'
import type { ApplicationRuntimeLayoutTarget } from '../types'

export type PublicApplicationRuntimeTarget = Pick<ApplicationRuntimeLayoutTarget, 'targetKind' | 'entityTypeId' | 'entityTypeCodename'>

const PUBLIC_RUNTIME_UI_PROBE_ACCEPT = 'application/vnd.universo.public-runtime-probe+json'
const PUBLIC_RUNTIME_FETCH_TIMEOUT_MS = 15_000

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

const readJsonBody = async (response: Response, signal: AbortSignal): Promise<unknown> => {
    const contentLength = response.headers.get('content-length')
    if (contentLength && /^\d+$/u.test(contentLength) && Number(contentLength) > MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES) {
        await response.body?.cancel().catch(() => undefined)
        throw new PublicApplicationRuntimeError(502, 'PUBLIC_APPLICATION_RUNTIME_RESPONSE_TOO_LARGE')
    }

    if (!response.body) return null

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let byteCount = 0
    let body = ''
    try {
        let done = false
        while (!done) {
            const chunk = await reader.read()
            done = chunk.done
            if (done) break
            const { value } = chunk
            if (!value) continue
            byteCount += value.byteLength
            if (byteCount > MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES) {
                await reader.cancel().catch(() => undefined)
                throw new PublicApplicationRuntimeError(502, 'PUBLIC_APPLICATION_RUNTIME_RESPONSE_TOO_LARGE')
            }
            body += decoder.decode(value, { stream: true })
        }
        body += decoder.decode()
        return body ? JSON.parse(body) : null
    } catch (error) {
        if (signal.aborted || error instanceof PublicApplicationRuntimeError) throw error
        return null
    } finally {
        reader.releaseLock()
    }
}

export const isPublicApplicationUnavailableError = (error: unknown): boolean =>
    error instanceof PublicApplicationRuntimeError &&
    error.status === 404 &&
    (error.code === null || error.code === PUBLIC_APPLICATION_RUNTIME_ERROR_CODE)

export const getPublicApplicationRuntime = async (
    applicationRef: string,
    locale: string,
    target?: PublicApplicationRuntimeTarget,
    querySignal?: AbortSignal
): Promise<PublicApplicationRuntime> => {
    const normalizedRef = applicationRef.trim()
    if (!normalizedRef) {
        throw new PublicApplicationRuntimeError(400, null, 'Application reference is required')
    }

    const params = new URLSearchParams({ locale })
    if (target?.targetKind !== undefined && target.targetKind !== null) params.set('targetKind', target.targetKind)
    if (target?.entityTypeId !== undefined && target.entityTypeId !== null) params.set('entityTypeId', target.entityTypeId)
    if (target?.entityTypeCodename !== undefined && target.entityTypeCodename !== null) {
        params.set('entityTypeCodename', target.entityTypeCodename)
    }
    const controller = new AbortController()
    let timedOut = false
    const timeoutId = globalThis.setTimeout(() => {
        timedOut = true
        controller.abort(new DOMException('Public runtime request timed out', 'TimeoutError'))
    }, PUBLIC_RUNTIME_FETCH_TIMEOUT_MS)
    const abortFromQuery = () => controller.abort(querySignal?.reason)
    if (querySignal?.aborted) abortFromQuery()
    else querySignal?.addEventListener('abort', abortFromQuery, { once: true })

    try {
        const response = await fetch(`/api/v1/public/applications/${encodeURIComponent(normalizedRef)}/runtime?${params.toString()}`, {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store',
            headers: {
                Accept: PUBLIC_RUNTIME_UI_PROBE_ACCEPT
            },
            signal: controller.signal
        })
        if (response.status === 204) {
            throw new PublicApplicationRuntimeError(404, PUBLIC_APPLICATION_RUNTIME_ERROR_CODE)
        }
        const body = await readJsonBody(response, controller.signal)

        if (!response.ok) {
            throw new PublicApplicationRuntimeError(response.status, readErrorCode(body))
        }

        const parsed = publicApplicationRuntimeSchema.safeParse(body)
        if (!parsed.success) {
            throw new PublicApplicationRuntimeError(502, 'PUBLIC_APPLICATION_RUNTIME_RESPONSE_INVALID')
        }

        return parsed.data
    } catch (error) {
        if (timedOut) throw new PublicApplicationRuntimeError(408, 'PUBLIC_APPLICATION_RUNTIME_TIMEOUT')
        throw error
    } finally {
        globalThis.clearTimeout(timeoutId)
        querySignal?.removeEventListener('abort', abortFromQuery)
    }
}

export interface CanonicalApplicationRuntimePathInput {
    applicationRef: string
    canonicalAlias: string | null
    remainingPath?: string | null
    search?: string | null
    hash?: string | null
}

export const buildCanonicalApplicationRuntimePath = ({
    applicationRef,
    canonicalAlias,
    remainingPath,
    search,
    hash
}: CanonicalApplicationRuntimePathInput): string | null => {
    if (!canonicalAlias || canonicalAlias === applicationRef) return null

    const normalizedRemainingPath = remainingPath?.replace(/^\/+|\/+$/g, '') ?? ''
    const suffix = normalizedRemainingPath ? `/${normalizedRemainingPath}` : ''
    const normalizedSearch = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''
    // Anchors are part of the visitor-facing deep link: dropping the hash on the
    // canonical alias redirect breaks in-page navigation on the marketing runtime.
    const normalizedHash = hash && hash !== '#' ? (hash.startsWith('#') ? hash : `#${hash}`) : ''
    return `/a/${canonicalAlias}${suffix}${normalizedSearch}${normalizedHash}`
}
