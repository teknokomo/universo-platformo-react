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

const resolveRuntimeTarget = (target?: { objectCollectionId?: string; sectionId?: string }) => ({
    objectCollectionId: target?.objectCollectionId,
    sectionId: target?.sectionId ?? target?.objectCollectionId
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

        fetchList: ({ limit, offset, locale, objectCollectionId, sectionId, search, sort, filters }) =>
            getApplicationRuntime(applicationId, {
                limit,
                offset,
                locale,
                objectCollectionId,
                sectionId,
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

        fetchTabularRows: async ({ parentRowId, componentId, objectCollectionId, sectionId }) => {
            const resolvedSectionId = sectionId ?? objectCollectionId
            if (!resolvedSectionId) return []
            return listApplicationRuntimeTabularRows({
                applicationId,
                rowId: parentRowId,
                componentId,
                objectCollectionId: resolvedSectionId,
                sectionId: resolvedSectionId
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
                expectedVersion: data?.expectedVersion
            }),

        workflowAction: (rowId, actionCodename, data) =>
            runApplicationRuntimeWorkflowAction({
                applicationId,
                rowId,
                actionCodename,
                objectCollectionId: data.objectCollectionId,
                sectionId: data.sectionId ?? data.objectCollectionId,
                expectedVersion: data.expectedVersion
            }),

        reorderRows: ({ objectCollectionId, sectionId, orderedRowIds, expectedVersionsByRowId }) =>
            reorderApplicationRuntimeRows({
                applicationId,
                objectCollectionId,
                sectionId: sectionId ?? objectCollectionId,
                orderedRowIds,
                expectedVersionsByRowId
            })
    }
}
