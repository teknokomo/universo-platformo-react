import type { CrudDataAdapter, AppDataResponse } from '@universo-react/apps-template-mui'
import {
    getApplicationRuntime,
    getApplicationRuntimeRow,
    listApplicationRuntimeTabularRows,
    createApplicationRuntimeRow,
    updateApplicationRuntimeRow,
    deleteApplicationRuntimeRow,
    restoreApplicationRuntimeRow,
    copyApplicationRuntimeRow,
    runApplicationRuntimeRecordCommand,
    runApplicationRuntimeWorkflowAction,
    reorderApplicationRuntimeRows
} from './applications'
import { applicationsQueryKeys } from './queryKeys'

const withWorkspaceId = (workspaceId?: string | null): { workspaceId?: string } => {
    const normalizedWorkspaceId = workspaceId?.trim()
    return normalizedWorkspaceId ? { workspaceId: normalizedWorkspaceId } : {}
}

const resolveRuntimeTarget = (target?: { objectCollectionId?: string; sectionId?: string; workspaceId?: string | null }) => ({
    objectCollectionId: target?.objectCollectionId,
    sectionId: target?.sectionId ?? target?.objectCollectionId,
    ...withWorkspaceId(target?.workspaceId)
})

/**
 * Create a `CrudDataAdapter` for the production (auth'd apiClient) mode.
 *
 * Uses the `getApplicationRuntime*` functions which go through the
 * authenticated Axios `apiClient`.
 */
export function createRuntimeAdapter(applicationId: string): CrudDataAdapter {
    return {
        queryKeyPrefix: applicationsQueryKeys.runtimeAll(applicationId),

        fetchList: ({ limit, offset, locale, objectCollectionId, sectionId, workspaceId, search, sort, filters }) =>
            getApplicationRuntime(applicationId, {
                limit,
                offset,
                locale,
                objectCollectionId,
                sectionId,
                ...withWorkspaceId(workspaceId),
                search,
                sort,
                filters
            }) as Promise<AppDataResponse>,

        fetchRow: (rowId, target) =>
            getApplicationRuntimeRow({
                applicationId,
                rowId,
                ...resolveRuntimeTarget(target)
            }),

        fetchTabularRows: async ({ parentRowId, componentId, objectCollectionId, sectionId, workspaceId }) => {
            const resolvedSectionId = sectionId ?? objectCollectionId
            if (!resolvedSectionId) return []
            return listApplicationRuntimeTabularRows({
                applicationId,
                rowId: parentRowId,
                componentId,
                objectCollectionId: resolvedSectionId,
                sectionId: resolvedSectionId,
                ...withWorkspaceId(workspaceId)
            })
        },

        createRow: (data, target) =>
            createApplicationRuntimeRow({
                applicationId,
                data,
                ...resolveRuntimeTarget(target)
            }),

        updateRow: (rowId, data, target, expectedVersion) =>
            updateApplicationRuntimeRow({
                applicationId,
                rowId,
                data,
                ...resolveRuntimeTarget(target),
                expectedVersion
            }),

        deleteRow: (rowId, target, expectedVersion) =>
            deleteApplicationRuntimeRow({
                applicationId,
                rowId,
                ...resolveRuntimeTarget(target),
                expectedVersion
            }),

        restoreRow: (rowId, target, expectedVersion, restoreTarget) =>
            restoreApplicationRuntimeRow({
                applicationId,
                rowId,
                ...resolveRuntimeTarget(target),
                expectedVersion,
                restoreTarget
            }),

        copyRow: (rowId, data) =>
            copyApplicationRuntimeRow({
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
            runApplicationRuntimeRecordCommand({
                applicationId,
                rowId,
                command,
                objectCollectionId: data?.objectCollectionId,
                sectionId: data?.sectionId ?? data?.objectCollectionId,
                ...withWorkspaceId(data?.workspaceId),
                expectedVersion: data?.expectedVersion
            }),

        workflowAction: (rowId, actionCodename, data) =>
            runApplicationRuntimeWorkflowAction({
                applicationId,
                rowId,
                actionCodename,
                objectCollectionId: data.objectCollectionId,
                sectionId: data.sectionId ?? data.objectCollectionId,
                ...withWorkspaceId(data.workspaceId),
                expectedVersion: data.expectedVersion
            }),

        reorderRows: ({ objectCollectionId, sectionId, workspaceId, orderedRowIds, expectedVersionsByRowId }) =>
            reorderApplicationRuntimeRows({
                applicationId,
                objectCollectionId,
                sectionId: sectionId ?? objectCollectionId,
                ...withWorkspaceId(workspaceId),
                orderedRowIds,
                expectedVersionsByRowId
            })
    }
}
