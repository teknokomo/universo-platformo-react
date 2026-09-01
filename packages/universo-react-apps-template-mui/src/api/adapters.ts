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

const withWorkspaceId = (workspaceId?: string | null): { workspaceId?: string } => {
    const normalizedWorkspaceId = workspaceId?.trim()
    return normalizedWorkspaceId ? { workspaceId: normalizedWorkspaceId } : {}
}

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
                ...withWorkspaceId(workspaceId),
                search,
                sort,
                filters,
                lifecycleState
            }),

        fetchRow: (rowId, target) =>
            fetchAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                objectCollectionId: target?.objectCollectionId,
                sectionId: target?.sectionId ?? target?.objectCollectionId,
                ...withWorkspaceId(target?.workspaceId)
            }),

        fetchTabularRows: async ({ parentRowId, componentId, objectCollectionId, sectionId, workspaceId }) => {
            const resolvedSectionId = sectionId ?? objectCollectionId
            if (!resolvedSectionId) return []
            const response = await fetchTabularRows({
                apiBaseUrl,
                applicationId,
                parentRecordId: parentRowId,
                componentId,
                objectCollectionId: resolvedSectionId,
                sectionId: resolvedSectionId,
                ...withWorkspaceId(workspaceId)
            })
            return response.items
        },

        createRow: (data, target) =>
            createAppRow({
                apiBaseUrl,
                applicationId,
                data,
                objectCollectionId: target?.objectCollectionId,
                sectionId: target?.sectionId ?? target?.objectCollectionId,
                ...withWorkspaceId(target?.workspaceId)
            }),

        updateRow: (rowId, data, target, expectedVersion) =>
            updateAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                data,
                objectCollectionId: target?.objectCollectionId,
                sectionId: target?.sectionId ?? target?.objectCollectionId,
                ...withWorkspaceId(target?.workspaceId),
                expectedVersion
            }),

        deleteRow: (rowId, target, expectedVersion) =>
            deleteAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                objectCollectionId: target?.objectCollectionId,
                sectionId: target?.sectionId ?? target?.objectCollectionId,
                ...withWorkspaceId(target?.workspaceId),
                expectedVersion
            }),

        restoreRow: (rowId, target, expectedVersion, restoreTarget) =>
            restoreAppRow({
                apiBaseUrl,
                applicationId,
                rowId,
                objectCollectionId: target?.objectCollectionId,
                sectionId: target?.sectionId ?? target?.objectCollectionId,
                ...withWorkspaceId(target?.workspaceId),
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
                ...withWorkspaceId(data?.workspaceId),
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
                ...withWorkspaceId(data?.workspaceId),
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
                ...withWorkspaceId(data.workspaceId),
                expectedVersion: data.expectedVersion
            }),

        reorderRows: ({ objectCollectionId, sectionId, workspaceId, orderedRowIds, expectedVersionsByRowId }) =>
            reorderAppRows({
                apiBaseUrl,
                applicationId,
                objectCollectionId,
                sectionId: sectionId ?? objectCollectionId,
                ...withWorkspaceId(workspaceId),
                orderedRowIds,
                expectedVersionsByRowId
            })
    }
}
