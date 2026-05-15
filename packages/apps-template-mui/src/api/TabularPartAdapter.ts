import { fetchWithCsrf, type AppDataResponse } from './api'
import type { CrudDataAdapter } from './types'
import type { FieldValidationRules } from '../components/dialogs/FormDialog'

/**
 * Build the tabular API URL for a specific child table endpoint.
 */
function buildTabularUrl(
    apiBaseUrl: string,
    applicationId: string,
    parentRecordId: string,
    componentId: string,
    objectCollectionId: string,
    childRowId?: string
): string {
    const base = apiBaseUrl.replace(/\/$/, '')
    let path = `${base}/applications/${applicationId}/runtime/rows/${parentRecordId}/tabular/${componentId}`
    if (childRowId) {
        path += `/${childRowId}`
    }
    path += `?objectCollectionId=${encodeURIComponent(objectCollectionId)}`

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
    objectCollectionId: string
    parentRecordId: string
    componentId: string
    permissions?: Partial<AppDataResponse['permissions']>
    /** Column definitions for the child table (used to build AppDataResponse). */
    childFields: Array<{
        id: string
        label: string
        type: string
        required?: boolean
        validationRules?: FieldValidationRules
        refTargetEntityId?: string | null
        refTargetEntityKind?: string | null
        refTargetConstantId?: string | null
        refSetConstantLabel?: string | null
        refSetConstantDataType?: string | null
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
        componentId?: string
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
 * CrudDataAdapter implementation for TABLE component child rows.
 *
 * Uses the tabular CRUD endpoints:
 * - GET    `/:appId/runtime/rows/:recordId/tabular/:attrId?objectCollectionId=…`
 * - POST   `/:appId/runtime/rows/:recordId/tabular/:attrId?objectCollectionId=…`
 * - PATCH  `/:appId/runtime/rows/:recordId/tabular/:attrId/:childRowId?objectCollectionId=…`
 * - DELETE `/:appId/runtime/rows/:recordId/tabular/:attrId/:childRowId?objectCollectionId=…`
 */
export function createTabularPartAdapter(params: TabularPartAdapterParams): CrudDataAdapter {
    const { apiBaseUrl, applicationId, objectCollectionId, parentRecordId, componentId, childFields, permissions } = params
    const normalizedPermissions: AppDataResponse['permissions'] = {
        manageMembers: permissions?.manageMembers === true,
        manageApplication: permissions?.manageApplication === true,
        createContent: permissions?.createContent === true,
        editContent: permissions?.editContent === true,
        deleteContent: permissions?.deleteContent === true,
        readReports: permissions?.readReports === true
    }

    const url = (resolvedObjectId: string, childRowId?: string) =>
        buildTabularUrl(apiBaseUrl, applicationId, parentRecordId, componentId, resolvedObjectId, childRowId)

    return {
        queryKeyPrefix: ['tabular', parentRecordId, componentId] as const,

        async fetchList(listParams): Promise<AppDataResponse> {
            const resolvedObjectId = listParams.objectCollectionId ?? objectCollectionId
            const { limit, offset } = listParams

            // Pass limit/offset to backend for server-side pagination
            const listUrl = `${url(resolvedObjectId)}&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`
            const res = await fetch(listUrl, { credentials: 'include' })
            if (!res.ok) throw new Error(await extractError(res, 'Fetch tabular rows failed'))

            const json = (await res.json()) as { items: Array<Record<string, unknown> & { id: string }>; total: number }

            // Map child fields → AppDataResponse column format
            const columns: AppDataResponse['columns'] = childFields.map((f) => ({
                id: f.componentId ?? f.id,
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
                    ...(f.enumLabelEmptyDisplay ? { enumLabelEmptyDisplay: f.enumLabelEmptyDisplay } : {}),
                    ...(typeof f.refSetConstantDataType === 'string' ? { setConstantDataType: f.refSetConstantDataType } : {})
                },
                refTargetEntityId: f.refTargetEntityId ?? null,
                refTargetEntityKind: f.refTargetEntityKind ?? null,
                refTargetConstantId: f.refTargetConstantId ?? null,
                refOptions: f.refOptions,
                enumOptions: f.enumOptions
            }))

            const runtimeSection = {
                id: resolvedObjectId,
                codename: '',
                tableName: '',
                name: ''
            }

            return {
                section: runtimeSection,
                sections: [runtimeSection],
                activeSectionId: resolvedObjectId,
                objectCollection: runtimeSection,
                objectCollections: [runtimeSection],
                activeObjectCollectionId: resolvedObjectId,
                columns,
                rows: json.items,
                pagination: { total: json.total, limit, offset },
                permissions: normalizedPermissions,
                workspacesEnabled: false,
                currentWorkspaceId: null,
                settings: {},
                layoutConfig: {},
                zoneWidgets: {
                    left: [],
                    right: [],
                    center: []
                },
                menus: [],
                activeMenuId: null
            }
        },

        /**
         * Fetches a single child row by loading the full list and filtering.
         *
         * Note: This is intentionally inefficient because the backend currently
         * has no dedicated GET-by-id endpoint for child rows. When such an
         * endpoint is added, this method should call it directly.
         */
        async fetchRow(rowId: string, overrideObjectId?: string): Promise<Record<string, unknown>> {
            const resolvedObjectId = overrideObjectId ?? objectCollectionId
            // The LIST endpoint already returns full row data —
            // return a single item by fetching the list and filtering.
            const res = await fetch(url(resolvedObjectId), { credentials: 'include' })
            if (!res.ok) throw new Error(await extractError(res, 'Fetch tabular row failed'))

            const json = (await res.json()) as { items: Array<Record<string, unknown> & { id: string }> }
            const row = json.items.find((r) => r.id === rowId)
            if (!row) throw new Error('Child row not found')

            return { id: row.id, data: row }
        },

        async createRow(data: Record<string, unknown>, overrideObjectId?: string): Promise<Record<string, unknown>> {
            const resolvedObjectId = overrideObjectId ?? objectCollectionId
            const res = await fetchWithCsrf(apiBaseUrl, url(resolvedObjectId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data })
            })
            if (!res.ok) throw new Error(await extractError(res, 'Create tabular row failed'))
            return res.json()
        },

        async updateRow(rowId: string, data: Record<string, unknown>, overrideObjectId?: string): Promise<Record<string, unknown>> {
            const resolvedObjectId = overrideObjectId ?? objectCollectionId
            const res = await fetchWithCsrf(apiBaseUrl, url(resolvedObjectId, rowId), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data })
            })
            if (!res.ok) throw new Error(await extractError(res, 'Update tabular row failed'))
            return res.json()
        },

        async deleteRow(rowId: string, overrideObjectId?: string): Promise<void> {
            const resolvedObjectId = overrideObjectId ?? objectCollectionId
            const res = await fetchWithCsrf(apiBaseUrl, url(resolvedObjectId, rowId), { method: 'DELETE' })
            if (!res.ok) throw new Error(await extractError(res, 'Delete tabular row failed'))
        },

        async copyRow(rowId: string, data?: { objectCollectionId?: string; sectionId?: string }): Promise<Record<string, unknown>> {
            const resolvedObjectId = data?.sectionId ?? data?.objectCollectionId ?? objectCollectionId
            const copyUrl = `${url(resolvedObjectId, rowId)}/copy`
            const res = await fetchWithCsrf(apiBaseUrl, copyUrl, { method: 'POST' })
            if (!res.ok) throw new Error(await extractError(res, 'Copy tabular row failed'))
            return res.json()
        }
    }
}
