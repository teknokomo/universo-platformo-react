import { z } from 'zod'
import type { RuntimeDatasourceFilter, RuntimeDatasourceSort } from '@universo/types'
import {
    catalogRecordBehaviorSchema,
    linkedCollectionRuntimeViewConfigSchema,
    dashboardLayoutConfigSchema,
    runtimePageBlockSchema,
    reportDefinitionSchema
} from '@universo/types'
import type { RuntimeRecordCommand } from './types'

export type { DashboardLayoutConfig } from '@universo/types'

const AUTH_CSRF_STORAGE_KEY = 'up.auth.csrf'

let csrfTokenPromise: Promise<string> | null = null

const runtimePermissionsSchema = z
    .object({
        manageMembers: z.boolean().optional().default(false),
        manageApplication: z.boolean().optional().default(false),
        createContent: z.boolean().optional().default(true),
        editContent: z.boolean().optional().default(true),
        deleteContent: z.boolean().optional().default(true),
        readReports: z.boolean().optional().default(false)
    })
    .optional()

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
            kind: z.string().optional(),
            codename: z.string(),
            tableName: z.string().nullable(),
            name: z.string(),
            runtimeConfig: linkedCollectionRuntimeViewConfigSchema.optional(),
            recordBehavior: catalogRecordBehaviorSchema.optional(),
            pageBlocks: z.array(runtimePageBlockSchema).optional()
        })
        .optional(),
    linkedCollection: z.object({
        id: z.string(),
        kind: z.string().optional(),
        codename: z.string(),
        tableName: z.string().nullable(),
        name: z.string(),
        runtimeConfig: linkedCollectionRuntimeViewConfigSchema.optional(),
        recordBehavior: catalogRecordBehaviorSchema.optional(),
        pageBlocks: z.array(runtimePageBlockSchema).optional()
    }),
    sections: z
        .array(
            z.object({
                id: z.string(),
                kind: z.string().optional(),
                codename: z.string(),
                tableName: z.string().nullable(),
                name: z.string(),
                runtimeConfig: linkedCollectionRuntimeViewConfigSchema.optional(),
                recordBehavior: catalogRecordBehaviorSchema.optional()
            })
        )
        .optional()
        .default([]),
    linkedCollections: z
        .array(
            z.object({
                id: z.string(),
                kind: z.string().optional(),
                codename: z.string(),
                tableName: z.string().nullable(),
                name: z.string(),
                runtimeConfig: linkedCollectionRuntimeViewConfigSchema.optional(),
                recordBehavior: catalogRecordBehaviorSchema.optional()
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
    settings: z.record(z.unknown()).optional().default({}),
    workspacesEnabled: z.boolean().optional().default(false),
    currentWorkspaceId: z.string().nullable().optional(),
    permissions: runtimePermissionsSchema,
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
                startPage: z.string().nullable().optional(),
                startSectionId: z.string().nullable().optional(),
                maxPrimaryItems: z.number().nullable().optional(),
                overflowLabelKey: z.string().nullable().optional(),
                workspacePlacement: z.enum(['primary', 'overflow', 'hidden']).optional().default('primary'),
                items: z.array(
                    z.object({
                        id: z.string(),
                        kind: z.enum(['catalog', 'section', 'page', 'catalogs_all', 'hub', 'link']),
                        title: z.string(),
                        icon: z.string().nullable().optional(),
                        href: z.string().nullable().optional(),
                        sectionId: z.string().nullable().optional(),
                        linkedCollectionId: z.string().nullable().optional(),
                        treeEntityId: z.string().nullable().optional(),
                        sortOrder: z.number().optional().default(0),
                        isActive: z.boolean().optional().default(true)
                    })
                ),
                overflowItems: z
                    .array(
                        z.object({
                            id: z.string(),
                            kind: z.enum(['catalog', 'section', 'page', 'catalogs_all', 'hub', 'link']),
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
                    .optional()
                    .default([])
            })
        )
        .optional()
        .default([]),
    activeMenuId: z.string().nullable().optional()
})

export type AppDataResponse = z.infer<typeof appDataResponseSchema>

/** @deprecated Use AppDataResponse instead */
export type ApplicationRuntimeResponse = AppDataResponse

const runtimeLedgerMetadataSchema = z.object({
    id: z.string(),
    codename: z.string(),
    presentation: z.unknown().optional(),
    fields: z
        .array(
            z.object({
                codename: z.string(),
                dataType: z.string().optional(),
                role: z.string().nullable().optional()
            })
        )
        .optional()
        .default([])
})

const runtimeLedgerListResponseSchema = z.object({
    ledgers: z.array(runtimeLedgerMetadataSchema).optional().default([])
})

const runtimeLedgerFactsResponseSchema = z.object({
    rows: z
        .array(
            z.object({
                id: z.string(),
                createdAt: z.unknown().optional(),
                data: z.record(z.unknown()).optional().default({})
            })
        )
        .optional()
        .default([]),
    limit: z.number().optional().default(100),
    offset: z.number().optional().default(0)
})

const runtimeLedgerProjectionResponseSchema = z.object({
    projection: z.record(z.unknown()).optional().default({}),
    rows: z.array(z.record(z.unknown())).optional().default([]),
    limit: z.number().optional().default(100),
    offset: z.number().optional().default(0)
})

const runtimeReportRunResponseSchema = z.object({
    rows: z.array(z.record(z.unknown())).optional().default([]),
    total: z.number().optional().default(0),
    aggregations: z.record(z.unknown()).optional().default({}),
    definition: reportDefinitionSchema
})

export type RuntimeLedgerMetadataResponse = z.infer<typeof runtimeLedgerMetadataSchema>
export type RuntimeLedgerFactsResponse = z.infer<typeof runtimeLedgerFactsResponseSchema>
export type RuntimeLedgerProjectionResponse = z.infer<typeof runtimeLedgerProjectionResponseSchema>
export type RuntimeReportRunResponse = z.infer<typeof runtimeReportRunResponseSchema>

export async function fetchAppData(options: {
    apiBaseUrl: string
    applicationId: string
    limit: number
    offset: number
    locale: string
    linkedCollectionId?: string
    sectionId?: string
    search?: string
    sort?: RuntimeDatasourceSort[]
    filters?: RuntimeDatasourceFilter[]
}): Promise<AppDataResponse> {
    const { apiBaseUrl, applicationId, limit, offset, locale, linkedCollectionId, sectionId, search, sort, filters } = options
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
    if (search?.trim()) {
        url.searchParams.set('search', search.trim())
    }
    if (sort?.length) {
        url.searchParams.set('sort', JSON.stringify(sort))
    }
    if (filters?.length) {
        url.searchParams.set('filters', JSON.stringify(filters))
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

export async function fetchRuntimeLedgers(options: {
    apiBaseUrl: string
    applicationId: string
}): Promise<RuntimeLedgerMetadataResponse[]> {
    const { apiBaseUrl, applicationId } = options
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const url = buildApiUrl(normalizedBase, `/applications/${applicationId}/runtime/ledgers`)

    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Ledger metadata API request failed'))
    }

    const parsed = runtimeLedgerListResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Ledger metadata API response validation failed')
    }
    return parsed.data.ledgers
}

async function resolveRuntimeLedgerId(options: {
    apiBaseUrl: string
    applicationId: string
    ledgerId?: string | null
    ledgerCodename?: string | null
}): Promise<string> {
    if (options.ledgerId?.trim()) {
        return options.ledgerId.trim()
    }

    const ledgerCodename = options.ledgerCodename?.trim()
    if (!ledgerCodename) {
        throw new Error('Ledger datasource requires ledgerId or ledgerCodename')
    }

    const ledgers = await fetchRuntimeLedgers(options)
    const ledger = ledgers.find((item) => item.codename === ledgerCodename)
    if (!ledger) {
        throw new Error(`Ledger datasource target was not found: ${ledgerCodename}`)
    }
    return ledger.id
}

export async function fetchRuntimeLedgerFacts(options: {
    apiBaseUrl: string
    applicationId: string
    ledgerId?: string | null
    ledgerCodename?: string | null
    limit: number
    offset: number
}): Promise<RuntimeLedgerFactsResponse> {
    const { apiBaseUrl, applicationId, limit, offset } = options
    const ledgerId = await resolveRuntimeLedgerId(options)
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const url = new URL(buildApiUrl(normalizedBase, `/applications/${applicationId}/runtime/ledgers/${ledgerId}/facts`))
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url.toString(), { credentials: 'include' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Ledger facts API request failed'))
    }

    const parsed = runtimeLedgerFactsResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Ledger facts API response validation failed')
    }
    return parsed.data
}

export async function fetchRuntimeLedgerProjection(options: {
    apiBaseUrl: string
    applicationId: string
    ledgerId?: string | null
    ledgerCodename?: string | null
    projectionCodename: string
    filters?: Record<string, unknown>
    limit: number
    offset: number
}): Promise<RuntimeLedgerProjectionResponse> {
    const { apiBaseUrl, applicationId, projectionCodename, filters, limit, offset } = options
    const ledgerId = await resolveRuntimeLedgerId(options)
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const url = buildApiUrl(normalizedBase, `/applications/${applicationId}/runtime/ledgers/${ledgerId}/query`)

    const res = await fetchWithCsrf(apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectionCodename, filters, limit, offset })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Ledger projection API request failed'))
    }

    const parsed = runtimeLedgerProjectionResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Ledger projection API response validation failed')
    }
    return parsed.data
}

export async function runRuntimeReport(options: {
    apiBaseUrl: string
    applicationId: string
    reportId?: string
    reportCodename?: string
    limit?: number
    offset?: number
    workspaceId?: string | null
}): Promise<RuntimeReportRunResponse> {
    const { apiBaseUrl, applicationId, reportId, reportCodename, limit, offset, workspaceId } = options
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const url = new URL(buildApiUrl(normalizedBase, `/applications/${applicationId}/runtime/reports/run`))
    if (workspaceId?.trim()) {
        url.searchParams.set('workspaceId', workspaceId.trim())
    }

    const res = await fetchWithCsrf(apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, reportCodename, limit, offset })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Runtime report API request failed'))
    }

    const parsed = runtimeReportRunResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Runtime report API response validation failed')
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

export async function runAppRecordCommand(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    command: RuntimeRecordCommand
    linkedCollectionId?: string
    sectionId?: string
    expectedVersion?: number
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, command, linkedCollectionId, sectionId, expectedVersion } = options
    const resolvedSectionId = sectionId ?? linkedCollectionId
    const url = buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}/${command}`)
    const body: Record<string, unknown> = {}
    if (resolvedSectionId) body.linkedCollectionId = resolvedSectionId
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Record command failed'))
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
