import { fetchAppData, fetchAppRow, createAppRow, updateAppRow, deleteAppRow, copyAppRow, fetchTabularRows } from './api'
import { appQueryKeys } from './mutations'
import type { CrudDataAdapter } from './types'

/**
 * Create a `CrudDataAdapter` for the standalone (direct HTTP fetch) mode.
 *
 * Uses the fetchAppData/fetchAppRow/createAppRow/updateAppRow/deleteAppRow
 * functions from `api.ts` which make raw `fetch()` calls with credentials.
 */
export function createStandaloneAdapter(params: { apiBaseUrl: string; applicationId: string }): CrudDataAdapter {
    const { apiBaseUrl, applicationId } = params

    return {
        queryKeyPrefix: appQueryKeys.list(applicationId),

        fetchList: ({ limit, offset, locale, catalogId, sectionId }) =>
            fetchAppData({ apiBaseUrl, applicationId, limit, offset, locale, catalogId, sectionId }),

        fetchRow: (rowId, catalogId) => fetchAppRow({ apiBaseUrl, applicationId, rowId, catalogId, sectionId: catalogId }),

        fetchTabularRows: async ({ parentRowId, attributeId, catalogId, sectionId }) => {
            const resolvedSectionId = sectionId ?? catalogId
            if (!resolvedSectionId) return []
            const response = await fetchTabularRows({
                apiBaseUrl,
                applicationId,
                parentRecordId: parentRowId,
                attributeId,
                catalogId: resolvedSectionId,
                sectionId: resolvedSectionId
            })
            return response.items
        },

        createRow: (data, catalogId) => createAppRow({ apiBaseUrl, applicationId, data, catalogId, sectionId: catalogId }),

        updateRow: (rowId, data, catalogId) => updateAppRow({ apiBaseUrl, applicationId, rowId, data, catalogId, sectionId: catalogId }),

        deleteRow: (rowId, catalogId) => deleteAppRow({ apiBaseUrl, applicationId, rowId, catalogId, sectionId: catalogId }),

        copyRow: (rowId, data) =>
            copyAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                catalogId: data?.catalogId,
                sectionId: data?.sectionId ?? data?.catalogId,
                copyChildTables: data?.copyChildTables
            })
    }
}
