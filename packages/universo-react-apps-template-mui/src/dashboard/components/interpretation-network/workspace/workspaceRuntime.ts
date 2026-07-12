import type { AppDataResponse } from '../../../../api/api'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'
import type { fetchAppData } from '../../../../api/api'
import type { RuntimeRow } from '../model'

export type WorkspaceDataRequest = Parameters<typeof fetchAppData>[0]

const WORKSPACE_PAGE_SIZE = 100
const RESERVED_RUNTIME_ROUTE_SEGMENTS = new Set(['admin', 'workspaces'])
const MATRIX_FOCUS_QUERY_PARAM = 'matrixCell'

export const readSubmittedText = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value.trim()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const locales = (value as { locales?: Record<string, { content?: unknown }> }).locales
    const localized = locales?.[locale]?.content ?? locales?.en?.content ?? locales?.ru?.content
    return typeof localized === 'string' ? localized.trim() : ''
}

const readSubmittedTextByField = (data: Record<string, unknown>, locale: string, fields: string[]): string => {
    for (const field of fields) {
        const value = readSubmittedText(data[field], locale)
        if (value) return value
    }
    return ''
}

export const readSubmittedTextByConfiguredField = (
    data: Record<string, unknown>,
    locale: string,
    configuredField: string,
    fields: FieldConfig[],
    fallbacks: string[]
): string => {
    const lookupKeys = [configuredField, ...fallbacks]
    for (const lookupKey of lookupKeys) {
        const field = fields.find((candidate) => candidate.codename === lookupKey || candidate.id === lookupKey)
        if (!field?.id) continue
        const value = readSubmittedText(data[field.id], locale)
        if (value) return value
    }
    return readSubmittedTextByField(data, locale, lookupKeys)
}

export const readRuntimeRowVersion = (row: RuntimeRow | null | undefined): number | undefined => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isInteger(value) && value > 0 ? value : undefined
}

export const fetchAllWorkspaceData = async (
    fetchAppDataFn: typeof fetchAppData,
    base: Omit<WorkspaceDataRequest, 'limit' | 'offset'>
): Promise<AppDataResponse> => {
    const firstPage = await fetchAppDataFn({ ...base, limit: WORKSPACE_PAGE_SIZE, offset: 0 })
    const total = firstPage.pagination?.total ?? firstPage.rows.length
    if (total <= firstPage.rows.length) return firstPage

    const pages: AppDataResponse[] = [firstPage]
    for (let offset = firstPage.rows.length; offset < total; offset += WORKSPACE_PAGE_SIZE) {
        const page = await fetchAppDataFn({ ...base, limit: WORKSPACE_PAGE_SIZE, offset })
        pages.push(page)
        if (page.rows.length === 0) break
    }

    return {
        ...firstPage,
        rows: pages.flatMap((page) => page.rows),
        pagination: {
            ...firstPage.pagination,
            total,
            limit: total,
            offset: 0
        }
    }
}

const readRuntimePathSegments = (applicationId?: string | null): string[] => {
    if (typeof window === 'undefined' || !applicationId) return []
    const rawSegments = window.location.pathname.split('/').filter(Boolean)
    const appMarkerIndex = rawSegments.findIndex(
        (segment, index) => segment === 'a' && decodeURIComponent(rawSegments[index + 1] ?? '') === applicationId
    )
    if (appMarkerIndex < 0) return []
    return rawSegments.slice(appMarkerIndex + 2).map((segment) => decodeURIComponent(segment))
}

export const readRouteStructureId = (applicationId?: string | null): string | null => {
    const segments = readRuntimePathSegments(applicationId)
    if (segments.length < 2 || RESERVED_RUNTIME_ROUTE_SEGMENTS.has(segments[0])) return null
    return segments[segments.length - 1] || null
}

export const readRouteMatrixCellId = (): string | null => {
    if (typeof window === 'undefined') return null
    const value = new URLSearchParams(window.location.search).get(MATRIX_FOCUS_QUERY_PARAM)
    return value?.trim() || null
}

export const buildStructureRuntimePath = (
    applicationId: string | undefined,
    structureSectionId: string | null | undefined,
    structureId: string | null,
    focusedCellId?: string | null
): string | null => {
    if (typeof window === 'undefined' || !applicationId) return null
    const segments = readRuntimePathSegments(applicationId)
    const firstRuntimeSegment = segments[0]
    const baseSegments = ['a', encodeURIComponent(applicationId)]

    if (firstRuntimeSegment && !RESERVED_RUNTIME_ROUTE_SEGMENTS.has(firstRuntimeSegment)) {
        baseSegments.push(encodeURIComponent(firstRuntimeSegment))
    } else if (structureSectionId?.trim()) {
        baseSegments.push(encodeURIComponent(structureSectionId.trim()))
    } else if (structureId) {
        return null
    }

    if (structureId) {
        baseSegments.push(encodeURIComponent(structureId))
    }

    const searchParams = new URLSearchParams(window.location.search)
    if (focusedCellId?.trim()) {
        searchParams.set(MATRIX_FOCUS_QUERY_PARAM, focusedCellId.trim())
    } else {
        searchParams.delete(MATRIX_FOCUS_QUERY_PARAM)
    }
    const search = searchParams.toString()

    return `/${baseSegments.join('/')}${search ? `?${search}` : ''}${window.location.hash}`
}
