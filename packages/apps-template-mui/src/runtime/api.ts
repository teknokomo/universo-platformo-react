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
        showOverviewTitle: z.boolean().optional(),
        showOverviewCards: z.boolean().optional(),
        showSessionsChart: z.boolean().optional(),
        showPageViewsChart: z.boolean().optional(),
        showDetailsTitle: z.boolean().optional(),
        showDetailsTable: z.boolean().optional(),
        showDetailsSidePanel: z.boolean().optional(),
        showFooter: z.boolean().optional()
    })
    .optional()

export type DashboardLayoutConfig = z.infer<typeof dashboardLayoutConfigSchema>

export const runtimeResponseSchema = z.object({
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
            dataType: z.enum(['BOOLEAN', 'STRING', 'NUMBER']),
            headerName: z.string()
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
            )
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

export type ApplicationRuntimeResponse = z.infer<typeof runtimeResponseSchema>

export async function fetchApplicationRuntime(options: {
    apiBaseUrl: string
    applicationId: string
    limit: number
    offset: number
    locale: string
    catalogId?: string
}): Promise<ApplicationRuntimeResponse> {
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
        const text = await res.text().catch(() => '')
        throw new Error(`Runtime API request failed (${res.status}): ${text || res.statusText}`)
    }

    const json = await res.json()
    const parsed = runtimeResponseSchema.safeParse(json)
    if (!parsed.success) {
        throw new Error('Runtime API response validation failed')
    }
    return parsed.data
}
