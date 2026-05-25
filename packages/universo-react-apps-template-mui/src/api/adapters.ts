import {
    fetchAppData,
    fetchAppRow,
    createAppRow,
    updateAppRow,
    deleteAppRow,
    restoreAppRow,
    copyAppRow,
    fetchTabularRows,
    runAppRecordCommand,
    runAppWorkflowAction,
    reorderAppRows
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

        fetchList: ({ limit, offset, locale, objectCollectionId, sectionId, workspaceId, search, sort, filters, lifecycleState }) =>
            fetchAppData({
                apiBaseUrl,
                applicationId,
                limit,
                offset,
                locale,
                objectCollectionId,
                sectionId,
                workspaceId,
                search,
                sort,
                filters,
                lifecycleState
            }),

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

        updateRow: (rowId, data, objectCollectionId, expectedVersion) =>
            updateAppRow({ apiBaseUrl, applicationId, rowId, data, objectCollectionId, sectionId: objectCollectionId, expectedVersion }),

        deleteRow: (rowId, objectCollectionId, expectedVersion) =>
            deleteAppRow({ apiBaseUrl, applicationId, rowId, objectCollectionId, sectionId: objectCollectionId, expectedVersion }),

        restoreRow: (rowId, objectCollectionId, expectedVersion, restoreTarget) =>
            restoreAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                objectCollectionId,
                sectionId: objectCollectionId,
                expectedVersion,
                restoreTarget
            }),

        copyRow: (rowId, data) =>
            copyAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                objectCollectionId: data?.objectCollectionId,
                sectionId: data?.sectionId ?? data?.objectCollectionId,
                copyChildTables: data?.copyChildTables,
                data: data?.data,
                expectedVersion: data?.expectedVersion
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
            }),

        reorderRows: ({ objectCollectionId, sectionId, orderedRowIds, expectedVersionsByRowId }) =>
            reorderAppRows({
                apiBaseUrl,
                applicationId,
                objectCollectionId,
                sectionId: sectionId ?? objectCollectionId,
                orderedRowIds,
                expectedVersionsByRowId
            })
    }
}
