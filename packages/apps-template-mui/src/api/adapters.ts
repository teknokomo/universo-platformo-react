import {
    fetchAppData,
    fetchAppRow,
    createAppRow,
    updateAppRow,
    deleteAppRow,
    copyAppRow,
    fetchTabularRows,
    runAppRecordCommand
} from './api'
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

        fetchList: ({ limit, offset, locale, linkedCollectionId, sectionId, search, sort, filters }) =>
            fetchAppData({ apiBaseUrl, applicationId, limit, offset, locale, linkedCollectionId, sectionId, search, sort, filters }),

        fetchRow: (rowId, linkedCollectionId) =>
            fetchAppRow({ apiBaseUrl, applicationId, rowId, linkedCollectionId, sectionId: linkedCollectionId }),

        fetchTabularRows: async ({ parentRowId, attributeId, linkedCollectionId, sectionId }) => {
            const resolvedSectionId = sectionId ?? linkedCollectionId
            if (!resolvedSectionId) return []
            const response = await fetchTabularRows({
                apiBaseUrl,
                applicationId,
                parentRecordId: parentRowId,
                attributeId,
                linkedCollectionId: resolvedSectionId,
                sectionId: resolvedSectionId
            })
            return response.items
        },

        createRow: (data, linkedCollectionId) =>
            createAppRow({ apiBaseUrl, applicationId, data, linkedCollectionId, sectionId: linkedCollectionId }),

        updateRow: (rowId, data, linkedCollectionId) =>
            updateAppRow({ apiBaseUrl, applicationId, rowId, data, linkedCollectionId, sectionId: linkedCollectionId }),

        deleteRow: (rowId, linkedCollectionId) =>
            deleteAppRow({ apiBaseUrl, applicationId, rowId, linkedCollectionId, sectionId: linkedCollectionId }),

        copyRow: (rowId, data) =>
            copyAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                linkedCollectionId: data?.linkedCollectionId,
                sectionId: data?.sectionId ?? data?.linkedCollectionId,
                copyChildTables: data?.copyChildTables
            }),

        recordCommand: (rowId, command, data) =>
            runAppRecordCommand({
                apiBaseUrl,
                applicationId,
                rowId,
                command,
                linkedCollectionId: data?.linkedCollectionId,
                sectionId: data?.sectionId ?? data?.linkedCollectionId,
                expectedVersion: data?.expectedVersion
            })
    }
}
