import {
    fetchAppData,
    fetchAppRow,
    createAppRow,
    updateAppRow,
    deleteAppRow,
    copyAppRow,
    fetchTabularRows,
    runAppRecordCommand,
    runAppWorkflowAction
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

        fetchList: ({ limit, offset, locale, objectCollectionId, sectionId, search, sort, filters }) =>
            fetchAppData({ apiBaseUrl, applicationId, limit, offset, locale, objectCollectionId, sectionId, search, sort, filters }),

        fetchRow: (rowId, objectCollectionId) =>
            fetchAppRow({ apiBaseUrl, applicationId, rowId, objectCollectionId, sectionId: objectCollectionId }),

        fetchTabularRows: async ({ parentRowId, componentId, objectCollectionId, sectionId }) => {
            const resolvedSectionId = sectionId ?? objectCollectionId
            if (!resolvedSectionId) return []
            const response = await fetchTabularRows({
                apiBaseUrl,
                applicationId,
                parentRecordId: parentRowId,
                componentId,
                objectCollectionId: resolvedSectionId,
                sectionId: resolvedSectionId
            })
            return response.items
        },

        createRow: (data, objectCollectionId) =>
            createAppRow({ apiBaseUrl, applicationId, data, objectCollectionId, sectionId: objectCollectionId }),

        updateRow: (rowId, data, objectCollectionId) =>
            updateAppRow({ apiBaseUrl, applicationId, rowId, data, objectCollectionId, sectionId: objectCollectionId }),

        deleteRow: (rowId, objectCollectionId) =>
            deleteAppRow({ apiBaseUrl, applicationId, rowId, objectCollectionId, sectionId: objectCollectionId }),

        copyRow: (rowId, data) =>
            copyAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                objectCollectionId: data?.objectCollectionId,
                sectionId: data?.sectionId ?? data?.objectCollectionId,
                copyChildTables: data?.copyChildTables
            }),

        recordCommand: (rowId, command, data) =>
            runAppRecordCommand({
                apiBaseUrl,
                applicationId,
                rowId,
                command,
                objectCollectionId: data?.objectCollectionId,
                sectionId: data?.sectionId ?? data?.objectCollectionId,
                expectedVersion: data?.expectedVersion
            }),

        workflowAction: (rowId, actionCodename, data) =>
            runAppWorkflowAction({
                apiBaseUrl,
                applicationId,
                rowId,
                actionCodename,
                objectCollectionId: data.objectCollectionId,
                sectionId: data.sectionId ?? data.objectCollectionId,
                expectedVersion: data.expectedVersion
            })
    }
}
