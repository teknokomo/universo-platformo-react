import type { CrudDataAdapter, AppDataResponse } from '@universo/apps-template-mui'
import {
    getApplicationRuntime,
    getApplicationRuntimeRow,
    listApplicationRuntimeTabularRows,
    createApplicationRuntimeRow,
    updateApplicationRuntimeRow,
    deleteApplicationRuntimeRow,
    copyApplicationRuntimeRow,
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

        fetchList: ({ limit, offset, locale, catalogId, sectionId }) =>
            getApplicationRuntime(applicationId, {
                limit,
                offset,
                locale,
                catalogId,
                sectionId
            }) as Promise<AppDataResponse>,

        fetchRow: (rowId, catalogId) => getApplicationRuntimeRow({ applicationId, rowId, catalogId, sectionId: catalogId }),

        fetchTabularRows: async ({ parentRowId, attributeId, catalogId, sectionId }) => {
            const resolvedSectionId = sectionId ?? catalogId
            if (!resolvedSectionId) return []
            return listApplicationRuntimeTabularRows({
                applicationId,
                rowId: parentRowId,
                attributeId,
                catalogId: resolvedSectionId,
                sectionId: resolvedSectionId
            })
        },

        createRow: (data, catalogId) => createApplicationRuntimeRow({ applicationId, data, catalogId, sectionId: catalogId }),

        updateRow: (rowId, data, catalogId) => updateApplicationRuntimeRow({ applicationId, rowId, data, catalogId, sectionId: catalogId }),

        deleteRow: (rowId, catalogId) => deleteApplicationRuntimeRow({ applicationId, rowId, catalogId, sectionId: catalogId }),

        copyRow: (rowId, data) =>
            copyApplicationRuntimeRow({
                applicationId,
                rowId,
                catalogId: data?.catalogId,
                sectionId: data?.sectionId ?? data?.catalogId,
                copyChildTables: data?.copyChildTables
            }),

        reorderRows: ({ catalogId, sectionId, orderedRowIds }) =>
            reorderApplicationRuntimeRows({
                applicationId,
                catalogId,
                sectionId,
                orderedRowIds
            })
    }
}
