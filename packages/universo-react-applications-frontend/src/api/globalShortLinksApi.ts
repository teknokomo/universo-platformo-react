import {
    globalShortLinkQuizAccessOptionsResponseSchema,
    globalShortLinkResourceOptionsResponseSchema,
    globalShortLinkTargetSchema,
    globalShortLinkRecordSchema,
    type GlobalShortLinkQuizAccessOption,
    type GlobalShortLinkResourceOption,
    type GlobalShortLinkCreateInput,
    type GlobalShortLinkRecord
} from '@universo-react/types'
import apiClient from './apiClient'

export interface ListGlobalShortLinksInput {
    applicationId: string
    includeReleased?: boolean
    limit?: number
    offset?: number
}

export interface GlobalShortLinksPage {
    items: GlobalShortLinkRecord[]
    hasMore: boolean
}

export interface ListGlobalShortLinkQuizAccessOptionsInput {
    applicationId: string
    locale: 'en' | 'ru'
}

export interface ListGlobalShortLinkResourceOptionsInput {
    applicationId: string
    locale: 'en' | 'ru'
}

export const listGlobalShortLinks = async ({
    applicationId,
    includeReleased = false,
    limit = 100,
    offset = 0
}: ListGlobalShortLinksInput): Promise<GlobalShortLinksPage> => {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new RangeError('limit must be an integer between 1 and 100')
    }
    if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError('offset must be a non-negative integer')

    const fetchItems = async (requestLimit: number, requestOffset: number) => {
        const response = await apiClient.get<{ items: unknown[] }>('/global-short-links', {
            params: { applicationId, includeReleased, limit: requestLimit, offset: requestOffset }
        })
        return response.data.items.map((item) => globalShortLinkRecordSchema.parse(item))
    }

    const requestLimit = Math.min(limit + 1, 100)
    const fetchedItems = await fetchItems(requestLimit, offset)
    const items = fetchedItems.slice(0, limit)
    let hasMore = fetchedItems.length > limit

    // The backend caps a request at 100, so probe one row beyond a full 100-row page.
    if (limit === 100 && fetchedItems.length === 100) {
        hasMore = (await fetchItems(1, offset + limit)).length > 0
    }

    return { items, hasMore }
}

export const listGlobalShortLinkQuizAccessOptions = async ({
    applicationId,
    locale
}: ListGlobalShortLinkQuizAccessOptionsInput): Promise<GlobalShortLinkQuizAccessOption[]> => {
    const response = await apiClient.get<unknown>(
        `/global-short-links/applications/${encodeURIComponent(applicationId)}/quiz-access-options`,
        { params: { locale } }
    )
    return globalShortLinkQuizAccessOptionsResponseSchema.parse(response.data).items
}

export const listGlobalShortLinkResourceOptions = async ({
    applicationId,
    locale
}: ListGlobalShortLinkResourceOptionsInput): Promise<GlobalShortLinkResourceOption[]> => {
    const response = await apiClient.get<unknown>(
        `/global-short-links/applications/${encodeURIComponent(applicationId)}/application-resource-options`,
        { params: { locale } }
    )
    return globalShortLinkResourceOptionsResponseSchema.parse(response.data).items
}

export const createGlobalShortLink = async (input: GlobalShortLinkCreateInput): Promise<GlobalShortLinkRecord> => {
    const response = await apiClient.post<unknown>('/global-short-links', input)
    return globalShortLinkRecordSchema.parse(response.data)
}

export const releaseGlobalShortLink = async (linkId: string): Promise<GlobalShortLinkRecord> => {
    const response = await apiClient.post<unknown>(`/global-short-links/${encodeURIComponent(linkId)}/release`)
    return globalShortLinkRecordSchema.parse(response.data)
}

export class GlobalShortLinkUnavailableError extends Error {
    readonly status: number

    constructor(status: number) {
        super('GLOBAL_SHORT_LINK_UNAVAILABLE')
        this.name = 'GlobalShortLinkUnavailableError'
        this.status = status
    }
}

export const resolvePublicGlobalShortLink = async (slug: string) => {
    const response = await fetch(`/api/v1/public/l/${encodeURIComponent(slug)}`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
    })
    if (!response.ok) throw new GlobalShortLinkUnavailableError(response.status)

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('target' in payload)) {
        throw new GlobalShortLinkUnavailableError(502)
    }
    const parsedTarget = globalShortLinkTargetSchema.safeParse(payload.target)
    if (!parsedTarget.success) throw new GlobalShortLinkUnavailableError(502)
    return parsedTarget.data
}

export const getGlobalShortLinkErrorCode = (error: unknown): string | null => {
    if (!error || typeof error !== 'object') return null
    const data = (error as { response?: { data?: unknown } }).response?.data
    if (!data || typeof data !== 'object') return null
    const record = data as Record<string, unknown>
    if (typeof record.code === 'string') return record.code
    if (typeof record.error === 'string') return record.error
    return null
}

export const buildGlobalShortLinkUrl = (slug: string, origin = window.location.origin): string =>
    new URL(`/l/${encodeURIComponent(slug)}`, origin).toString()

export const buildPublicGuestAccessUrl = (applicationId: string, slug: string, origin = window.location.origin): string =>
    new URL(`/public/a/${encodeURIComponent(applicationId)}/links/${encodeURIComponent(slug)}`, origin).toString()
