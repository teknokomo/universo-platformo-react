import type { AppDataResponse } from './api'
import type { CrudDataAdapter } from './types'
import type { FieldValidationRules } from '../components/dialogs/FormDialog'

/**
 * Build the tabular API URL for a specific child table endpoint.
 */
function buildTabularUrl(
    apiBaseUrl: string,
    applicationId: string,
    parentRecordId: string,
    attributeId: string,
    catalogId: string,
    childRowId?: string
): string {
    const base = apiBaseUrl.replace(/\/$/, '')
    let path = `${base}/applications/${applicationId}/runtime/rows/${parentRecordId}/tabular/${attributeId}`
    if (childRowId) {
        path += `/${childRowId}`
    }
    path += `?catalogId=${encodeURIComponent(catalogId)}`

    if (/^https?:\/\//i.test(base)) return new URL(path).toString()
    return new URL(path, window.location.origin).toString()
}

/**
 * Extract a human-readable error message from an HTTP response.
 */
async function extractError(res: Response, prefix: string): Promise<string> {
    const text = await res.text().catch(() => '')
    if (text) {
        try {
            const json = JSON.parse(text)
            const msg = json?.error ?? json?.message
            if (typeof msg === 'string' && msg.trim()) return `${prefix} (${res.status}): ${msg}`
        } catch {
            // not JSON
        }
        return `${prefix} (${res.status}): ${text}`
    }
    return `${prefix} (${res.status}): ${res.statusText}`
}

export interface TabularPartAdapterParams {
    apiBaseUrl: string
    applicationId: string
    catalogId: string
    parentRecordId: string
    attributeId: string
    /** Column definitions for the child table (used to build AppDataResponse). */
    childFields: Array<{
        id: string
        label: string
        type: string
        required?: boolean
        validationRules?: FieldValidationRules
        refTargetEntityId?: string | null
        refTargetEntityKind?: string | null
        refOptions?: Array<{
            id: string
            label: string
            codename?: string
            isDefault?: boolean
            sortOrder?: number
        }>
        enumOptions?: Array<{
            id: string
            label: string
            codename?: string
            isDefault?: boolean
            sortOrder?: number
        }>
        enumPresentationMode?: 'select' | 'radio' | 'label'
        defaultEnumValueId?: string | null
        enumAllowEmpty?: boolean
        enumLabelEmptyDisplay?: 'empty' | 'dash'
        tableUiConfig?: Record<string, unknown>
        attributeId?: string
    }>
}

const normalizeDataType = (value: string): AppDataResponse['columns'][number]['dataType'] => {
    if (value === 'BOOLEAN' || value === 'STRING' || value === 'NUMBER' || value === 'DATE' || value === 'REF' || value === 'JSON') {
        return value
    }
    return 'STRING'
}

/**
 * @deprecated Used only by `RuntimeTabularPartView` which is deprecated.
 * Use the direct API helpers (`fetchTabularRows`, `createTabularRow`, etc.) with
 * `RuntimeInlineTabularEditor` instead. Will be removed in a future version.
 *
 * CrudDataAdapter implementation for TABLE attribute child rows.
 *
 * Uses the tabular CRUD endpoints:
 * - GET    `/:appId/runtime/rows/:recordId/tabular/:attrId?catalogId=…`
 * - POST   `/:appId/runtime/rows/:recordId/tabular/:attrId?catalogId=…`
 * - PATCH  `/:appId/runtime/rows/:recordId/tabular/:attrId/:childRowId?catalogId=…`
 * - DELETE `/:appId/runtime/rows/:recordId/tabular/:attrId/:childRowId?catalogId=…`
 */
export function createTabularPartAdapter(params: TabularPartAdapterParams): CrudDataAdapter {
    const { apiBaseUrl, applicationId, catalogId, parentRecordId, attributeId, childFields } = params

    const url = (resolvedCatalogId: string, childRowId?: string) =>
        buildTabularUrl(apiBaseUrl, applicationId, parentRecordId, attributeId, resolvedCatalogId, childRowId)

    return {
        queryKeyPrefix: ['tabular', parentRecordId, attributeId] as const,

        async fetchList(listParams): Promise<AppDataResponse> {
            const resolvedCatalogId = listParams.catalogId ?? catalogId
            const { limit, offset } = listParams

            // Pass limit/offset to backend for server-side pagination
            const listUrl = `${url(resolvedCatalogId)}&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`
            const res = await fetch(listUrl, { credentials: 'include' })
            if (!res.ok) throw new Error(await extractError(res, 'Fetch tabular rows failed'))

            const json = (await res.json()) as { items: Array<Record<string, unknown> & { id: string }>; total: number }

            // Map child fields → AppDataResponse column format
            const columns: AppDataResponse['columns'] = childFields.map((f) => ({
                id: f.attributeId ?? f.id,
                codename: f.id,
                field: f.id,
                dataType: normalizeDataType(f.type),
                headerName: f.label,
                isRequired: f.required ?? false,
                validationRules: f.validationRules ?? {},
                uiConfig: {
                    ...(f.tableUiConfig ?? {}),
                    ...(f.enumPresentationMode ? { enumPresentationMode: f.enumPresentationMode } : {}),
                    ...(typeof f.defaultEnumValueId === 'string' ? { defaultEnumValueId: f.defaultEnumValueId } : {}),
                    ...(typeof f.enumAllowEmpty === 'boolean' ? { enumAllowEmpty: f.enumAllowEmpty } : {}),
                    ...(f.enumLabelEmptyDisplay ? { enumLabelEmptyDisplay: f.enumLabelEmptyDisplay } : {})
                },
                refTargetEntityId: f.refTargetEntityId ?? null,
                refTargetEntityKind: f.refTargetEntityKind ?? null,
                refOptions: f.refOptions,
                enumOptions: f.enumOptions
            }))

            return {
                catalog: { id: resolvedCatalogId, codename: '', tableName: '', name: '' },
                catalogs: [],
                columns,
                rows: json.items,
                pagination: { total: json.total, limit, offset },
                menus: []
            }
        },

        /**
         * Fetches a single child row by loading the full list and filtering.
         *
         * Note: This is intentionally inefficient because the backend currently
         * has no dedicated GET-by-id endpoint for child rows. When such an
         * endpoint is added, this method should call it directly.
         */
        async fetchRow(rowId: string, overrideCatalogId?: string): Promise<Record<string, unknown>> {
            const resolvedCatalogId = overrideCatalogId ?? catalogId
            // The LIST endpoint already returns full row data —
            // return a single item by fetching the list and filtering.
            const res = await fetch(url(resolvedCatalogId), { credentials: 'include' })
            if (!res.ok) throw new Error(await extractError(res, 'Fetch tabular row failed'))

            const json = (await res.json()) as { items: Array<Record<string, unknown> & { id: string }> }
            const row = json.items.find((r) => r.id === rowId)
            if (!row) throw new Error('Child row not found')

            return { id: row.id, data: row }
        },

        async createRow(data: Record<string, unknown>, overrideCatalogId?: string): Promise<Record<string, unknown>> {
            const resolvedCatalogId = overrideCatalogId ?? catalogId
            const res = await fetch(url(resolvedCatalogId), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data })
            })
            if (!res.ok) throw new Error(await extractError(res, 'Create tabular row failed'))
            return res.json()
        },

        async updateRow(rowId: string, data: Record<string, unknown>, overrideCatalogId?: string): Promise<Record<string, unknown>> {
            const resolvedCatalogId = overrideCatalogId ?? catalogId
            const res = await fetch(url(resolvedCatalogId, rowId), {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data })
            })
            if (!res.ok) throw new Error(await extractError(res, 'Update tabular row failed'))
            return res.json()
        },

        async deleteRow(rowId: string, overrideCatalogId?: string): Promise<void> {
            const resolvedCatalogId = overrideCatalogId ?? catalogId
            const res = await fetch(url(resolvedCatalogId, rowId), {
                method: 'DELETE',
                credentials: 'include'
            })
            if (!res.ok) throw new Error(await extractError(res, 'Delete tabular row failed'))
        }
    }
}
