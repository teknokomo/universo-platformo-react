import { fetchAppData, fetchAppRow, createAppRow, updateAppRow, deleteAppRow } from './api'
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

        fetchList: ({ limit, offset, locale, catalogId }) => fetchAppData({ apiBaseUrl, applicationId, limit, offset, locale, catalogId }),

        fetchRow: (rowId, catalogId) => fetchAppRow({ apiBaseUrl, applicationId, rowId, catalogId }),

        createRow: (data, catalogId) => createAppRow({ apiBaseUrl, applicationId, data, catalogId }),

        updateRow: (rowId, data, catalogId) => updateAppRow({ apiBaseUrl, applicationId, rowId, data, catalogId }),

        deleteRow: (rowId, catalogId) => deleteAppRow({ apiBaseUrl, applicationId, rowId, catalogId })
    }
}
