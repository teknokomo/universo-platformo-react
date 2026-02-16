import type { CrudDataAdapter, AppDataResponse } from '@universo/apps-template-mui'
import {
  getApplicationRuntime,
  getApplicationRuntimeRow,
  createApplicationRuntimeRow,
  updateApplicationRuntimeRow,
  deleteApplicationRuntimeRow
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

    fetchList: ({ limit, offset, locale, catalogId }) =>
      getApplicationRuntime(applicationId, {
        limit,
        offset,
        locale,
        catalogId
      }) as Promise<AppDataResponse>,

    fetchRow: (rowId, catalogId) =>
      getApplicationRuntimeRow({ applicationId, rowId, catalogId }),

    createRow: (data, catalogId) =>
      createApplicationRuntimeRow({ applicationId, data, catalogId }),

    updateRow: (rowId, data, catalogId) =>
      updateApplicationRuntimeRow({ applicationId, rowId, data, catalogId }),

    deleteRow: (rowId, catalogId) =>
      deleteApplicationRuntimeRow({ applicationId, rowId, catalogId })
  }
}
