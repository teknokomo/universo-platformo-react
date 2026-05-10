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

        fetchList: ({ limit, offset, locale, linkedCollectionId, sectionId, search, sort, filters }) =>
            getApplicationRuntime(applicationId, {
                limit,
                offset,
                locale,
                linkedCollectionId,
                sectionId,
                search,
                sort,
                filters
            }) as Promise<AppDataResponse>,

        fetchRow: (rowId, linkedCollectionId) =>
            getApplicationRuntimeRow({ applicationId, rowId, linkedCollectionId, sectionId: linkedCollectionId }),

        fetchTabularRows: async ({ parentRowId, attributeId, linkedCollectionId, sectionId }) => {
            const resolvedSectionId = sectionId ?? linkedCollectionId
            if (!resolvedSectionId) return []
            return listApplicationRuntimeTabularRows({
                applicationId,
                rowId: parentRowId,
                attributeId,
                linkedCollectionId: resolvedSectionId,
                sectionId: resolvedSectionId
            })
        },

        createRow: (data, linkedCollectionId) =>
            createApplicationRuntimeRow({ applicationId, data, linkedCollectionId, sectionId: linkedCollectionId }),

        updateRow: (rowId, data, linkedCollectionId) =>
            updateApplicationRuntimeRow({ applicationId, rowId, data, linkedCollectionId, sectionId: linkedCollectionId }),

        deleteRow: (rowId, linkedCollectionId) =>
            deleteApplicationRuntimeRow({ applicationId, rowId, linkedCollectionId, sectionId: linkedCollectionId }),

        copyRow: (rowId, data) =>
            copyApplicationRuntimeRow({
                applicationId,
                rowId,
                linkedCollectionId: data?.linkedCollectionId,
                sectionId: data?.sectionId ?? data?.linkedCollectionId,
                copyChildTables: data?.copyChildTables
            }),

        recordCommand: (rowId, command, data) =>
            runApplicationRuntimeRecordCommand({
                applicationId,
                rowId,
                command,
                linkedCollectionId: data?.linkedCollectionId,
                sectionId: data?.sectionId ?? data?.linkedCollectionId,
                expectedVersion: data?.expectedVersion
            }),

        reorderRows: ({ linkedCollectionId, sectionId, orderedRowIds }) =>
            reorderApplicationRuntimeRows({
                applicationId,
                linkedCollectionId,
                sectionId,
                orderedRowIds
            })
    }
}
