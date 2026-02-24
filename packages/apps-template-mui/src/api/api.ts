import { z } from 'zod'

export const dashboardLayoutConfigSchema = z
    .object({
        showSideMenu: z.boolean().optional(),
        showAppNavbar: z.boolean().optional(),
        showHeader: z.boolean().optional(),
        showBreadcrumbs: z.boolean().optional(),
        showSearch: z.boolean().optional(),
        showDatePicker: z.boolean().optional(),
        showOptionsMenu: z.boolean().optional(),
        showLanguageSwitcher: z.boolean().optional(),
        showOverviewTitle: z.boolean().optional(),
        showOverviewCards: z.boolean().optional(),
        showSessionsChart: z.boolean().optional(),
        showPageViewsChart: z.boolean().optional(),
        showDetailsTitle: z.boolean().optional(),
        showDetailsTable: z.boolean().optional(),
        showColumnsContainer: z.boolean().optional(),
        showProductTree: z.boolean().optional(),
        showUsersByCountryChart: z.boolean().optional(),
        showRightSideMenu: z.boolean().optional(),
        showFooter: z.boolean().optional()
    })
    .optional()

export type DashboardLayoutConfig = z.infer<typeof dashboardLayoutConfigSchema>

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
    catalog: z.object({
        id: z.string(),
        codename: z.string(),
        tableName: z.string(),
        name: z.string()
    }),
    catalogs: z
        .array(
            z.object({
                id: z.string(),
                codename: z.string(),
                tableName: z.string(),
                name: z.string()
            })
        )
        .optional()
        .default([]),
    activeCatalogId: z.string().optional(),
    columns: z.array(
        z.object({
            id: z.string(),
            codename: z.string(),
            field: z.string(),
            dataType: z.enum(['BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE']),
            headerName: z.string(),
            isRequired: z.boolean().optional().default(false),
            validationRules: z.record(z.unknown()).optional().default({}),
            uiConfig: z.record(z.unknown()).optional().default({}),
            refTargetEntityId: z.string().nullable().optional(),
            refTargetEntityKind: z.string().nullable().optional(),
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
                        validationRules: z.record(z.unknown()).optional().default({}),
                        uiConfig: z.record(z.unknown()).optional().default({}),
                        refTargetEntityId: z.string().nullable().optional(),
                        refTargetEntityKind: z.string().nullable().optional(),
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
                        kind: z.enum(['catalog', 'catalogs_all', 'link']),
                        title: z.string(),
                        icon: z.string().nullable().optional(),
                        href: z.string().nullable().optional(),
                        catalogId: z.string().nullable().optional(),
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
    catalogId?: string
}): Promise<AppDataResponse> {
    const { apiBaseUrl, applicationId, limit, offset, locale, catalogId } = options
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const runtimePath = `${normalizedBase}/applications/${applicationId}/runtime`
    const isAbsoluteBase = /^https?:\/\//i.test(normalizedBase)
    const url = isAbsoluteBase ? new URL(runtimePath) : new URL(runtimePath, window.location.origin)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('locale', locale)
    if (catalogId) {
        url.searchParams.set('catalogId', catalogId)
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
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const apiPath = `${normalizedBase}/applications/${applicationId}/runtime${path}`
    const isAbsoluteBase = /^https?:\/\//i.test(normalizedBase)
    if (isAbsoluteBase) return new URL(apiPath).toString()
    return new URL(apiPath, window.location.origin).toString()
}

/** Fetch a single row (raw data, VLC not resolved — for edit forms). */
export async function fetchAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    catalogId?: string
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, catalogId } = options
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`)
    if (catalogId) {
        url += `?catalogId=${encodeURIComponent(catalogId)}`
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
    catalogId?: string
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, catalogId, data } = options
    const url = buildAppApiUrl(apiBaseUrl, applicationId, '/rows')

    const body: Record<string, unknown> = { data }
    if (catalogId) body.catalogId = catalogId

    const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
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
    catalogId?: string
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, catalogId, data } = options
    const url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`)

    const body: Record<string, unknown> = { data }
    if (catalogId) body.catalogId = catalogId

    const res = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
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
    catalogId?: string
}): Promise<void> {
    const { apiBaseUrl, applicationId, rowId, catalogId } = options
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`)
    if (catalogId) {
        url += `?catalogId=${encodeURIComponent(catalogId)}`
    }

    const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include'
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Delete row failed'))
    }
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
    catalogId: string
}): Promise<TabularRowsResponse> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, catalogId } = options
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${attributeId}`)
    url += `?catalogId=${encodeURIComponent(catalogId)}`

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
    catalogId: string
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, catalogId, data } = options
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${attributeId}`)
    url += `?catalogId=${encodeURIComponent(catalogId)}`

    const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
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
    catalogId: string
    childRowId: string
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, catalogId, childRowId, data } = options
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${attributeId}/${encodeURIComponent(childRowId)}`)
    url += `?catalogId=${encodeURIComponent(catalogId)}`

    const res = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
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
    catalogId: string
    childRowId: string
}): Promise<void> {
    const { apiBaseUrl, applicationId, parentRecordId, attributeId, catalogId, childRowId } = options
    let url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${attributeId}/${encodeURIComponent(childRowId)}`)
    url += `?catalogId=${encodeURIComponent(catalogId)}`

    const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include'
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Delete tabular row failed'))
    }
}
