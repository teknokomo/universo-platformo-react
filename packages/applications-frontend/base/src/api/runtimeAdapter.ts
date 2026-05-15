import type { CrudDataAdapter, AppDataResponse } from '@universo/apps-template-mui'
import {
    getApplicationRuntime,
    getApplicationRuntimeRow,
    listApplicationRuntimeTabularRows,
    createApplicationRuntimeRow,
    updateApplicationRuntimeRow,
    deleteApplicationRuntimeRow,
    copyApplicationRuntimeRow,
    runApplicationRuntimeRecordCommand,
    reorderApplicationRuntimeRows
} from './applications'
import { applicationsQueryKeys } from './queryKeys'

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

        fetchRow: (rowId, objectCollectionId) =>
            getApplicationRuntimeRow({ applicationId, rowId, objectCollectionId, sectionId: objectCollectionId }),

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

        createRow: (data, objectCollectionId) =>
            createApplicationRuntimeRow({ applicationId, data, objectCollectionId, sectionId: objectCollectionId }),

        updateRow: (rowId, data, objectCollectionId) =>
            updateApplicationRuntimeRow({ applicationId, rowId, data, objectCollectionId, sectionId: objectCollectionId }),

        deleteRow: (rowId, objectCollectionId) =>
            deleteApplicationRuntimeRow({ applicationId, rowId, objectCollectionId, sectionId: objectCollectionId }),

        copyRow: (rowId, data) =>
            copyApplicationRuntimeRow({
                applicationId,
                rowId,
                objectCollectionId: data?.objectCollectionId,
                sectionId: data?.sectionId ?? data?.objectCollectionId,
                copyChildTables: data?.copyChildTables
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

        reorderRows: ({ objectCollectionId, sectionId, orderedRowIds }) =>
            reorderApplicationRuntimeRows({
                applicationId,
                objectCollectionId,
                sectionId,
                orderedRowIds
            })
    }
}
