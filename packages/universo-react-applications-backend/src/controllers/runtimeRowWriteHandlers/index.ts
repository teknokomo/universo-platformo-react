import type { DbExecutor } from '@universo-react/utils'

import { RuntimeRecordCommandService } from '../../services/runtimeRecordBehavior'
import { createQueryHelper } from '../../shared/runtimeHelpers'
import { createBulkUpdateRowHandler } from './bulkUpdate'
import { createCopyRowHandler } from './copy'
import { createCreateRowHandler } from './create'
import { createDeleteRowHandler } from './delete'
import { createRestoreRowHandler } from './restore'
import type { RuntimeRowWriteDeps } from './types'
import { createUpdateCellHandler } from './updateCell'

/**
 * Runtime row write handlers (single-cell and bulk updates, create, copy,
 * soft delete and restore). Extracted from `runtimeRowsController`; shared helpers
 * live in `./runtimeRowSupport/*`.
 */
export interface RuntimeRowWriteHandlerContext {
    getDbExecutor: () => DbExecutor
}

export function createRuntimeRowWriteHandlers({ getDbExecutor }: RuntimeRowWriteHandlerContext) {
    const deps: RuntimeRowWriteDeps = {
        getDbExecutor,
        query: createQueryHelper(getDbExecutor),
        recordCommandService: new RuntimeRecordCommandService()
    }

    const updateCell = createUpdateCellHandler(deps)
    const bulkUpdateRow = createBulkUpdateRowHandler(deps)
    const createRow = createCreateRowHandler(deps)
    const copyRow = createCopyRowHandler(deps)
    const deleteRow = createDeleteRowHandler(deps)
    const restoreRow = createRestoreRowHandler(deps)

    return { updateCell, bulkUpdateRow, createRow, copyRow, deleteRow, restoreRow }
}
