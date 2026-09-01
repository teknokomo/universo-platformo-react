import { z } from 'zod'
import type { RecordsUnionDatasource, ReportFilter, RuntimeDatasourceFilter, RuntimeDatasourceSort } from '@universo-react/types'
import {
    objectRecordBehaviorSchema,
    objectCollectionRuntimeViewConfigSchema,
    dashboardLayoutConfigSchema,
    playCanvasRuntimeManifestSchema,
    runtimePageBlockSchema,
    reportDefinitionSchema,
    workflowActionSchema,
    readLocalizedTextValue,
    applicationTemplateKeySchema,
    marketingPageRuntimeViewModelSchema,
    type MarketingPageRuntimeViewModel
} from '@universo-react/types'
import { extractErrorMessage, fetchWithCsrf } from './client'
export { buildAppsApiUrl, extractErrorMessage, fetchWithCsrf } from './client'
export * from './runtimeRows'

export type { DashboardLayoutConfig } from '@universo-react/types'

export const runtimePermissionsSchema = z
    .object({
        manageMembers: z.boolean().optional().default(false),
        manageApplication: z.boolean().optional().default(false),
        createContent: z.boolean().optional().default(false),
        editContent: z.boolean().optional().default(false),
        deleteContent: z.boolean().optional().default(false),
        readReports: z.boolean().optional().default(false)
    })
    .default({})

const runtimeObjectCollectionSchema = z.object({
    id: z.string(),
    kind: z.string().optional(),
    codename: z.string(),
    tableName: z.string().nullable(),
    name: z.string(),
    runtimeConfig: objectCollectionRuntimeViewConfigSchema.optional(),
    recordBehavior: objectRecordBehaviorSchema.optional(),
    pageBlocks: z.array(runtimePageBlockSchema).optional(),
    workflowActions: z.array(workflowActionSchema).optional()
})

const runtimeOptionCodenameSchema = z.preprocess(
    (value) => (typeof value === 'string' ? value : readLocalizedTextValue(value)),
    z.string().optional()
)

const runtimeRefOptionSchema = z.object({
    id: z.string(),
    label: z.string(),
    codename: runtimeOptionCodenameSchema,
    isDefault: z.boolean().optional(),
    sortOrder: z.number().optional()
})

const runtimeColumnChildSchema = z.object({
    id: z.string(),
    codename: z.string(),
    field: z.string(),
    dataType: z.string(),
    headerName: z.string(),
    isRequired: z.boolean().optional().default(false),
    isDisplayComponent: z.boolean().optional(),
    validationRules: z.record(z.unknown()).optional().default({}),
    uiConfig: z.record(z.unknown()).optional().default({}),
    refTargetEntityId: z.string().nullable().optional(),
    refTargetEntityKind: z.string().nullable().optional(),
    refTargetConstantId: z.string().nullable().optional(),
    refOptions: z.array(runtimeRefOptionSchema).optional(),
    enumOptions: z.array(runtimeRefOptionSchema).optional()
})

const runtimeColumnSchema = runtimeColumnChildSchema.extend({
    dataType: z.enum(['BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE']),
    childColumns: z.array(runtimeColumnChildSchema).optional()
})

const runtimeZoneWidgetSchema = z.object({
    id: z.string(),
    layoutId: z.string().optional(),
    widgetKey: z.string(),
    sortOrder: z.number(),
    config: z.record(z.unknown()).optional().default({}),
    isActive: z.boolean().optional().default(true)
})

const runtimeMenuItemSchema = z.object({
    id: z.string(),
    kind: z.enum(['section', 'hub', 'link']),
    title: z.string(),
    icon: z.string().nullable().optional(),
    href: z.string().nullable().optional(),
    sectionId: z.string().nullable().optional(),
    objectCollectionId: z.string().nullable().optional(),
    hubId: z.string().nullable().optional(),
    treeEntityId: z.string().nullable().optional(),
    sortOrder: z.number().optional().default(0),
    isActive: z.boolean().optional().default(true)
})

export const appDataResponseSchema = z.object({
    section: runtimeObjectCollectionSchema.optional(),
    objectCollection: runtimeObjectCollectionSchema,
    sections: z.array(runtimeObjectCollectionSchema).optional().default([]),
    objectCollections: z.array(runtimeObjectCollectionSchema).optional().default([]),
    activeSectionId: z.string().optional(),
    activeObjectCollectionId: z.string().nullable().optional(),
    columns: z.array(
        runtimeColumnSchema.extend({
            dataType: z.enum(['BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE'])
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
    workflowCapabilities: z.record(z.boolean()).optional(),
    // Added by backend for dashboard rendering; optional for backward compatibility.
    layoutConfig: dashboardLayoutConfigSchema,
    zoneWidgets: z
        .object({
            left: z.array(runtimeZoneWidgetSchema),
            right: z.array(runtimeZoneWidgetSchema).optional().default([]),
            center: z.array(runtimeZoneWidgetSchema).optional().default([])
        })
        .optional(),
    menus: z
        .array(
            z.object({
                id: z.string(),
                widgetId: z.string(),
                showTitle: z.boolean().optional().default(true),
                title: z.string(),
                autoShowAllSections: z.boolean().optional().default(false),
                startPage: z.string().nullable().optional(),
                startSectionId: z.string().nullable().optional(),
                maxPrimaryItems: z.number().nullable().optional(),
                overflowLabelKey: z.string().nullable().optional(),
                workspacePlacement: z.enum(['primary', 'overflow', 'hidden']).optional().default('primary'),
                items: z.array(runtimeMenuItemSchema),
                overflowItems: z.array(runtimeMenuItemSchema).optional().default([])
            })
        )
        .optional()
        .default([]),
    activeMenuId: z.string().nullable().optional()
})

export type AppDataResponse = z.infer<typeof appDataResponseSchema>

export const runtimeTemplateResponseSchema = z
    .object({
        templateKey: applicationTemplateKeySchema,
        config: z.record(z.unknown()).optional().default({})
    })
    .strict()

export type RuntimeTemplateResponse = z.infer<typeof runtimeTemplateResponseSchema>
export type MarketingPageRuntimeResponse = MarketingPageRuntimeViewModel

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

const runtimePlayCanvasManifestsResponseSchema = z.object({
    manifests: z.array(playCanvasRuntimeManifestSchema).default([])
})

export type RuntimeLedgerMetadataResponse = z.infer<typeof runtimeLedgerMetadataSchema>
export type RuntimeLedgerFactsResponse = z.infer<typeof runtimeLedgerFactsResponseSchema>
export type RuntimeLedgerProjectionResponse = z.infer<typeof runtimeLedgerProjectionResponseSchema>
export type RuntimeReportRunResponse = z.infer<typeof runtimeReportRunResponseSchema>
export type RuntimePlayCanvasManifestResponse = z.infer<typeof runtimePlayCanvasManifestsResponseSchema>

/** Build the base API URL for a given application's runtime endpoint. */
const buildAppApiUrl = (apiBaseUrl: string, applicationId: string, path = ''): string => {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const apiPath = `${normalizedBase}/applications/${applicationId}/runtime${path}`

    if (/^https?:\/\//i.test(normalizedBase)) {
        return new URL(apiPath).toString()
    }

    return new URL(apiPath, window.location.origin).toString()
}

export async function fetchRuntimeTemplate(options: { apiBaseUrl: string; applicationId: string }): Promise<RuntimeTemplateResponse> {
    const res = await fetch(buildAppApiUrl(options.apiBaseUrl, options.applicationId, '/template'), { credentials: 'include' })
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Runtime template API request failed'))
    const parsed = runtimeTemplateResponseSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Runtime template API response validation failed')
    return parsed.data
}

export async function fetchMarketingPageRuntime(options: {
    apiBaseUrl: string
    applicationId: string
    locale: string
    workspaceId?: string | null
}): Promise<MarketingPageRuntimeResponse> {
    const url = new URL(buildAppApiUrl(options.apiBaseUrl, options.applicationId, '/marketing-page'))
    url.searchParams.set('locale', options.locale)
    if (options.workspaceId?.trim()) url.searchParams.set('workspaceId', options.workspaceId.trim())
    const res = await fetch(url.toString(), { credentials: 'include' })
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Marketing page runtime API request failed'))
    const parsed = marketingPageRuntimeViewModelSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Marketing page runtime response validation failed')
    return parsed.data
}

export async function fetchAppData(options: {
    apiBaseUrl: string
    applicationId: string
    limit: number
    offset: number
    locale: string
    objectCollectionId?: string
    objectCollectionCodename?: string | null
    sectionId?: string
    sectionCodename?: string | null
    workspaceId?: string | null
    search?: string
    sort?: RuntimeDatasourceSort[]
    filters?: RuntimeDatasourceFilter[]
    lifecycleState?: 'active' | 'deleted'
    libraryView?: 'all' | 'recent' | 'starred' | 'shared'
}): Promise<AppDataResponse> {
    const {
        apiBaseUrl,
        applicationId,
        limit,
        offset,
        locale,
        objectCollectionId,
        objectCollectionCodename,
        sectionId,
        sectionCodename,
        workspaceId,
        search,
        sort,
        filters,
        lifecycleState,
        libraryView
    } = options
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const runtimePath = `${normalizedBase}/applications/${applicationId}/runtime`
    const isAbsoluteBase = /^https?:\/\//i.test(normalizedBase)
    const url = isAbsoluteBase ? new URL(runtimePath) : new URL(runtimePath, window.location.origin)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('locale', locale)
    if (sectionId) {
        url.searchParams.set('sectionId', sectionId)
        if (objectCollectionId) {
            url.searchParams.set('objectCollectionId', objectCollectionId)
        }
    } else if (objectCollectionId) {
        url.searchParams.set('objectCollectionId', objectCollectionId)
    } else {
        const resolvedCodename = sectionCodename?.trim() || objectCollectionCodename?.trim()
        if (resolvedCodename) {
            url.searchParams.set('objectCollectionCodename', resolvedCodename)
        }
    }
    if (workspaceId?.trim()) {
        url.searchParams.set('workspaceId', workspaceId.trim())
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
    if (lifecycleState === 'deleted') {
        url.searchParams.set('lifecycleState', lifecycleState)
    }
    if (libraryView && libraryView !== 'all') {
        url.searchParams.set('libraryView', libraryView)
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

export async function fetchRuntimeRecordsUnion(options: {
    apiBaseUrl: string
    applicationId: string
    datasource: RecordsUnionDatasource
    limit: number
    offset: number
    locale: string
    workspaceId?: string | null
}): Promise<AppDataResponse> {
    const { apiBaseUrl, applicationId, datasource, limit, offset, locale, workspaceId } = options
    const url = new URL(buildAppApiUrl(apiBaseUrl, applicationId, '/datasources/records/union'))
    if (workspaceId?.trim()) {
        url.searchParams.set('workspaceId', workspaceId.trim())
    }

    const res = await fetchWithCsrf(apiBaseUrl, url.toString(), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            datasource,
            limit,
            offset,
            locale
        })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Runtime records union API request failed'))
    }

    const parsed = appDataResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Runtime records union API response validation failed')
    }
    return parsed.data
}

export async function fetchRuntimePlayCanvasManifests(options: {
    apiBaseUrl: string
    applicationId: string
}): Promise<RuntimePlayCanvasManifestResponse> {
    const { apiBaseUrl, applicationId } = options
    const res = await fetch(buildAppApiUrl(apiBaseUrl, applicationId, '/playcanvas-manifests'), { credentials: 'include' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Runtime PlayCanvas manifest API request failed'))
    }

    const parsed = runtimePlayCanvasManifestsResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Runtime PlayCanvas manifest API response validation failed')
    }
    return parsed.data
}

const runtimeLibraryRelationResponseSchema = z.object({
    relationKey: z.enum(['recent', 'starred', 'shared']),
    active: z.boolean(),
    changed: z.boolean()
})

type RuntimeLibraryRelationKey = z.infer<typeof runtimeLibraryRelationResponseSchema>['relationKey']

export async function setRuntimeLibraryRelation(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    objectCollectionId: string
    relationKey: RuntimeLibraryRelationKey
    active: boolean
    principalType?: 'workspaceMember' | 'user'
    principalId?: string
}): Promise<{ relationKey: RuntimeLibraryRelationKey; active: boolean; changed: boolean }> {
    const { apiBaseUrl, applicationId, rowId, objectCollectionId, relationKey, active, principalType, principalId } = options
    const res = await fetchWithCsrf(apiBaseUrl, buildAppApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}/library/${relationKey}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            objectCollectionId,
            active,
            ...(principalType && principalId ? { principalType, principalId } : {})
        })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Runtime library action failed'))
    }

    const parsed = runtimeLibraryRelationResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Runtime library action response validation failed')
    }
    return parsed.data
}

export async function fetchRuntimeLedgers(options: {
    apiBaseUrl: string
    applicationId: string
}): Promise<RuntimeLedgerMetadataResponse[]> {
    const { apiBaseUrl, applicationId } = options
    const url = buildAppApiUrl(apiBaseUrl, applicationId, '/ledgers')

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
    const url = new URL(buildAppApiUrl(apiBaseUrl, applicationId, `/ledgers/${ledgerId}/facts`))
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
    const url = buildAppApiUrl(apiBaseUrl, applicationId, `/ledgers/${ledgerId}/query`)

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
    filters?: ReportFilter[]
    limit?: number
    offset?: number
    locale?: string
    workspaceId?: string | null
}): Promise<RuntimeReportRunResponse> {
    const { apiBaseUrl, applicationId, reportId, reportCodename, filters, limit, offset, locale, workspaceId } = options
    const url = new URL(buildAppApiUrl(apiBaseUrl, applicationId, '/reports/run'))
    if (workspaceId?.trim()) {
        url.searchParams.set('workspaceId', workspaceId.trim())
    }

    const res = await fetchWithCsrf(apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            reportId,
            reportCodename,
            ...(filters?.length ? { filters } : {}),
            limit,
            offset,
            locale
        })
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

export async function exportRuntimeReportCsv(options: {
    apiBaseUrl: string
    applicationId: string
    reportId?: string
    reportCodename?: string
    filters?: ReportFilter[]
    limit?: number
    offset?: number
    locale?: string
    workspaceId?: string | null
}): Promise<Blob> {
    const { apiBaseUrl, applicationId, reportId, reportCodename, filters, limit, offset, locale, workspaceId } = options
    const url = new URL(buildAppApiUrl(apiBaseUrl, applicationId, '/reports/export'))
    if (workspaceId?.trim()) {
        url.searchParams.set('workspaceId', workspaceId.trim())
    }

    const res = await fetchWithCsrf(apiBaseUrl, url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            reportId,
            reportCodename,
            ...(filters?.length ? { filters } : {}),
            limit,
            offset,
            locale
        })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Runtime report export failed'))
    }

    return res.blob()
}
