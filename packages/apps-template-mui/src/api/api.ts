import { z } from 'zod'
import { linkedCollectionRuntimeViewConfigSchema, dashboardLayoutConfigSchema } from '@universo/types'

export type { DashboardLayoutConfig } from '@universo/types'

const AUTH_CSRF_STORAGE_KEY = 'up.auth.csrf'

let csrfTokenPromise: Promise<string> | null = null

const getSessionStorage = (): Storage | null => {
    try {
        return typeof window !== 'undefined' ? window.sessionStorage : null
    } catch {
        return null
    }
}

function buildApiUrl(apiBaseUrl: string, path: string): string {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const apiPath = `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`

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

async function resolveCsrfToken(apiBaseUrl: string): Promise<string> {
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

/**
 * Extract a human-readable error message from an HTTP response body.
 * Tries to parse JSON and pull `error` / `message` fields; falls back to raw text.
 */
async function extractErrorMessage(res: Response, fallbackPrefix: string): Promise<string> {
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

export const appDataResponseSchema = z.object({
    section: z
        .object({
            id: z.string(),
            codename: z.string(),
            tableName: z.string(),
            name: z.string(),
            runtimeConfig: linkedCollectionRuntimeViewConfigSchema.optional()
        })
        .optional(),
    linkedCollection: z.object({
        id: z.string(),
        codename: z.string(),
        tableName: z.string(),
        name: z.string(),
        runtimeConfig: linkedCollectionRuntimeViewConfigSchema.optional()
    }),
    sections: z
        .array(
            z.object({
                id: z.string(),
                codename: z.string(),
                tableName: z.string(),
                name: z.string(),
                runtimeConfig: linkedCollectionRuntimeViewConfigSchema.optional()
            })
        )
        .optional()
        .default([]),
    linkedCollections: z
        .array(
            z.object({
                id: z.string(),
                codename: z.string(),
                tableName: z.string(),
                name: z.string(),
                runtimeConfig: linkedCollectionRuntimeViewConfigSchema.optional()
            })
        )
        .optional()
        .default([]),
    activeSectionId: z.string().optional(),
    activeLinkedCollectionId: z.string().optional(),
    columns: z.array(
        z.object({
            id: z.string(),
            codename: z.string(),
            field: z.string(),
            dataType: z.enum(['BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE']),
            headerName: z.string(),
            isRequired: z.boolean().optional().default(false),
            isDisplayAttribute: z.boolean().optional(),
            validationRules: z.record(z.unknown()).optional().default({}),
            uiConfig: z.record(z.unknown()).optional().default({}),
            refTargetEntityId: z.string().nullable().optional(),
            refTargetEntityKind: z.string().nullable().optional(),
            refTargetConstantId: z.string().nullable().optional(),
            refOptions: z
                .array(
                    z.object({
                        id: z.string(),
                        label: z.string(),
                        codename: z.string().optional(),
                        isDefault: z.boolean().optional(),
                        sortOrder: z.number().optional()
                    })
                )
                .optional(),
            enumOptions: z
                .array(
                    z.object({
                        id: z.string(),
                        label: z.string(),
                        codename: z.string().optional(),
                        isDefault: z.boolean().optional(),
                        sortOrder: z.number().optional()
                    })
                )
                .optional(),
            // Child column definitions for TABLE-type attributes
            childColumns: z
                .array(
                    z.object({
                        id: z.string(),
                        codename: z.string(),
                        field: z.string(),
                        dataType: z.string(),
                        headerName: z.string(),
                        isRequired: z.boolean().optional().default(false),
                        isDisplayAttribute: z.boolean().optional(),
                        validationRules: z.record(z.unknown()).optional().default({}),
                        uiConfig: z.record(z.unknown()).optional().default({}),
                        refTargetEntityId: z.string().nullable().optional(),
                        refTargetEntityKind: z.string().nullable().optional(),
                        refTargetConstantId: z.string().nullable().optional(),
                        refOptions: z
                            .array(
                                z.object({
                                    id: z.string(),
                                    label: z.string(),
                                    codename: z.string().optional(),
                                    isDefault: z.boolean().optional(),
                                    sortOrder: z.number().optional()
                                })
                            )
                            .optional(),
                        enumOptions: z
                            .array(
                                z.object({
                                    id: z.string(),
                                    label: z.string(),
                                    codename: z.string().optional(),
                                    isDefault: z.boolean().optional(),
                                    sortOrder: z.number().optional()
                                })
                            )
                            .optional()
                    })
                )
                .optional()
        })
    ),
    rows: z.array(z.record(z.unknown()).and(z.object({ id: z.string() }))),
    pagination: z.object({
        total: z.number(),
        limit: z.number(),
        offset: z.number()
    }),
    workspaceLimit: z
        .object({
            maxRows: z.number().int().positive().nullable(),
            currentRows: z.number().int().nonnegative(),
            canCreate: z.boolean()
        })
        .optional(),
    // Added by backend for dashboard rendering; optional for backward compatibility.
    layoutConfig: dashboardLayoutConfigSchema,
    zoneWidgets: z
        .object({
            left: z.array(
                z.object({
                    id: z.string(),
                    widgetKey: z.string(),
                    sortOrder: z.number(),
                    config: z.record(z.unknown()).optional().default({}),
                    isActive: z.boolean().optional().default(true)
                })
            ),
            right: z
                .array(
                    z.object({
                        id: z.string(),
                        widgetKey: z.string(),
                        sortOrder: z.number(),
                        config: z.record(z.unknown()).optional().default({}),
                        isActive: z.boolean().optional().default(true)
                    })
                )
                .optional()
                .default([]),
            center: z
                .array(
                    z.object({
                        id: z.string(),
                        widgetKey: z.string(),
                        sortOrder: z.number(),
                        config: z.record(z.unknown()).optional().default({}),
                        isActive: z.boolean().optional().default(true)
                    })
                )
                .optional()
                .default([])
        })
        .optional(),
    menus: z
        .array(
            z.object({
                id: z.string(),
                widgetId: z.string(),
                showTitle: z.boolean().optional().default(true),
                title: z.string(),
                autoShowAllCatalogs: z.boolean().optional().default(false),
                items: z.array(
                    z.object({
                        id: z.string(),
                        kind: z.enum(['catalog', 'section', 'catalogs_all', 'hub', 'link']),
                        title: z.string(),
                        icon: z.string().nullable().optional(),
                        href: z.string().nullable().optional(),
                        sectionId: z.string().nullable().optional(),
                        linkedCollectionId: z.string().nullable().optional(),
                        treeEntityId: z.string().nullable().optional(),
                        sortOrder: z.number().optional().default(0),
                        isActive: z.boolean().optional().default(true)
                    })
                )
            })
        )
        .optional()
        .default([]),
    activeMenuId: z.string().nullable().optional()
})

export type AppDataResponse = z.infer<typeof appDataResponseSchema>

/** @deprecated Use AppDataResponse instead */
export type ApplicationRuntimeResponse = AppDataResponse

export async function fetchAppData(options: {
    apiBaseUrl: string
    applicationId: string
    limit: number
    offset: number
    locale: string
    linkedCollectionId?: string
    sectionId?: string
}): Promise<AppDataResponse> {
    const { apiBaseUrl, applicationId, limit, offset, locale, linkedCollectionId, sectionId } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const runtimePath = `${normalizedBase}/applications/${applicationId}/runtime`
    const isAbsoluteBase = /^https?:\/\//i.test(normalizedBase)
    const url = isAbsoluteBase ? new URL(runtimePath) : new URL(runtimePath, window.location.origin)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('locale', locale)
    if (resolvedSectionId) {
        url.searchParams.set('linkedCollectionId', resolvedSectionId)
    }

    const res = await fetch(url.toString(), { credentials: 'include' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'App data API request failed'))
    }

    const json = await res.json()
    const parsed = appDataResponseSchema.safeParse(json)
    if (!parsed.success) {
        throw new Error('App data API response validation failed')
    }
    return parsed.data
}

/** Build the base API URL for a given application's runtime endpoint. */
function buildAppApiUrl(apiBaseUrl: string, applicationId: string, path = ''): string {
    return buildApiUrl(apiBaseUrl, `/applications/${applicationId}/runtime${path}`)
}

/** Fetch a single row (raw data, VLC not resolved — for edit forms). */
export async function fetchAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    linkedCollectionId?: string
    sectionId?: string
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, linkedCollectionId, sectionId } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`)
    if (resolvedSectionId) {
        url += `?linkedCollectionId=${encodeURIComponent(resolvedSectionId)}`
    }

    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Fetch row failed'))
    }
    return res.json()
}

/** Create a new row. Returns the created row with its id. */
export async function createAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    linkedCollectionId?: string
    sectionId?: string
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, linkedCollectionId, sectionId, data } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const url = buildAppApiUrl(apiBaseUrl, applicationId, '/rows')

    const body: Record<string, unknown> = { data }
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Create row failed'))
    }
    return res.json()
}

/** Update an existing row (bulk update via /rows/:rowId). */
export async function updateAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    linkedCollectionId?: string
    sectionId?: string
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, linkedCollectionId, sectionId, data } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`)

    const body: Record<string, unknown> = { data }
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Update row failed'))
    }
    return res.json()
}

/** Soft-delete a row. */
export async function deleteAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    linkedCollectionId?: string
    sectionId?: string
}): Promise<void> {
    const { apiBaseUrl, applicationId, rowId, linkedCollectionId, sectionId } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`)
    if (resolvedSectionId) {
        url += `?linkedCollectionId=${encodeURIComponent(resolvedSectionId)}`
    }

    const res = await fetchWithCsrf(apiBaseUrl, url, { method: 'DELETE' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Delete row failed'))
    }
}

/** Copy an existing row. */
export async function copyAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    linkedCollectionId?: string
    sectionId?: string
    copyChildTables?: boolean
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, linkedCollectionId, sectionId, copyChildTables = true } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}/copy`)
    const body: Record<string, unknown> = { copyChildTables }
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Copy row failed'))
    }
    return res.json()
}

// ---------------------------------------------------------------------------
// Tabular (TABLE attribute child rows) API helpers
// ---------------------------------------------------------------------------

/** Zod schema for the tabular child rows API response. */
export const tabularRowsResponseSchema = z.object({
    items: z.array(z.record(z.unknown()).and(z.object({ id: z.string() }))),
    total: z.number()
})

export type TabularRowsResponse = z.infer<typeof tabularRowsResponseSchema>

/** Fetch child rows for a TABLE attribute. */
export async function fetchTabularRows(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    attributeId: string
    linkedCollectionId: string
    sectionId?: string
}): Promise<TabularRowsResponse> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, linkedCollectionId, sectionId } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${attributeId}`)
    url += `?linkedCollectionId=${encodeURIComponent(resolvedSectionId)}`

    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Fetch tabular rows failed'))
    }
    const json = await res.json()
    const parsed = tabularRowsResponseSchema.safeParse(json)
    if (!parsed.success) {
        throw new Error('Tabular rows response validation failed')
    }
    return parsed.data
}

/** Create a new child row in a TABLE attribute. */
export async function createTabularRow(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    attributeId: string
    linkedCollectionId: string
    sectionId?: string
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, linkedCollectionId, sectionId, data } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${attributeId}`)
    url += `?linkedCollectionId=${encodeURIComponent(resolvedSectionId)}`

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Create tabular row failed'))
    }
    return res.json()
}

/** Update a child row in a TABLE attribute. */
export async function updateTabularRow(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    attributeId: string
    linkedCollectionId: string
    sectionId?: string
    childRowId: string
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, linkedCollectionId, sectionId, childRowId, data } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${attributeId}/${encodeURIComponent(childRowId)}`)
    url += `?linkedCollectionId=${encodeURIComponent(resolvedSectionId)}`

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Update tabular row failed'))
    }
    return res.json()
}

/** Delete a child row in a TABLE attribute. */
export async function deleteTabularRow(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    attributeId: string
    linkedCollectionId: string
    sectionId?: string
    childRowId: string
}): Promise<void> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, linkedCollectionId, sectionId, childRowId } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${attributeId}/${encodeURIComponent(childRowId)}`)
    url += `?linkedCollectionId=${encodeURIComponent(resolvedSectionId)}`

    const res = await fetchWithCsrf(apiBaseUrl, url, { method: 'DELETE' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Delete tabular row failed'))
    }
}

/** Copy a child row in a TABLE attribute. */
export async function copyTabularRow(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    attributeId: string
    linkedCollectionId: string
    sectionId?: string
    childRowId: string
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, linkedCollectionId, sectionId, childRowId } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    let url = buildAppApiUrl(
        apiBaseUrl,
        applicationId,
        `/rows/${parentRecordId}/tabular/${attributeId}/${encodeURIComponent(childRowId)}/copy`
    )
    url += `?linkedCollectionId=${encodeURIComponent(resolvedSectionId)}`

    const res = await fetchWithCsrf(apiBaseUrl, url, { method: 'POST' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Copy tabular row failed'))
    }
    return res.json()
}
