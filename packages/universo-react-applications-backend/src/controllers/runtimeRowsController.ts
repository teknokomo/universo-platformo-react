import type { DbExecutor } from '@universo-react/utils'
import { createRuntimeRowReadHandlers } from './runtimeRowReadHandlers'
import { createRuntimeRowCommandHandlers } from './runtimeRowCommandHandlers'
import { createRuntimeRowWriteHandlers } from './runtimeRowWriteHandlers'

export { mapRuntimeZoneWidgets, type RuntimeObjectCollectionAttr } from '../services/runtimeRowSupport/contracts'
export { buildRuntimeRecordAccessClause } from '../services/runtimeRowSupport/access'

export function createRuntimeRowsController(getDbExecutor: () => DbExecutor) {
    const { postRow, unpostRow, voidRow, runWorkflowAction, updateContentProgress, setLibraryRelation, reorderRows } =
        createRuntimeRowCommandHandlers({ getDbExecutor })
    const { listRecordsUnionDatasource, getRuntime, getRow } = createRuntimeRowReadHandlers({ getDbExecutor })

    // ============ UPDATE SINGLE CELL ============
    const { updateCell, bulkUpdateRow, createRow, copyRow, deleteRow, restoreRow } = createRuntimeRowWriteHandlers({ getDbExecutor })

    return {
        listRecordsUnionDatasource,
        getRuntime,
        updateCell,
        bulkUpdateRow,
        createRow,
        copyRow,
        postRow,
        unpostRow,
        voidRow,
        runWorkflowAction,
        getRow,
        deleteRow,
        restoreRow,
        updateContentProgress,
        setLibraryRelation,
        reorderRows
    }
}
