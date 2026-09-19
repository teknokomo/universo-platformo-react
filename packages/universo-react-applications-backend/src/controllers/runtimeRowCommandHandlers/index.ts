import type { DbExecutor } from '@universo-react/utils'

import { RuntimePostingMovementService } from '../../services/runtimePostingMovements'
import { RuntimeRecordCommandService } from '../../services/runtimeRecordBehavior'
import { createQueryHelper } from '../../shared/runtimeHelpers'
import { createLibraryRelationHandler } from './library'
import { createRecordStateCommandHandlers } from './posting'
import { createContentProgressHandler } from './progress'
import { createReorderRowsHandler } from './reorder'
import type { RuntimeRowCommandHandlerDeps } from './types'
import { createWorkflowActionHandler } from './workflow'

/**
 * Runtime row command handlers: record state commands (post/unpost/void),
 * workflow actions, learning-content progress, library relations and manual
 * reordering. Extracted from `runtimeRowsController`; shared helpers live in `./runtimeRowSupport/*`
 * and are referenced at request time.
 */
export interface RuntimeRowCommandHandlerContext {
    getDbExecutor: () => DbExecutor
}

export function createRuntimeRowCommandHandlers({ getDbExecutor }: RuntimeRowCommandHandlerContext) {
    const deps: RuntimeRowCommandHandlerDeps = {
        getDbExecutor,
        query: createQueryHelper(getDbExecutor),
        recordCommandService: new RuntimeRecordCommandService(),
        postingMovementService: new RuntimePostingMovementService()
    }

    const { runRecordStateCommand, postRow, unpostRow, voidRow } = createRecordStateCommandHandlers(deps)
    const runWorkflowAction = createWorkflowActionHandler(deps)
    const updateContentProgress = createContentProgressHandler(deps)
    const setLibraryRelation = createLibraryRelationHandler(deps)
    const reorderRows = createReorderRowsHandler(deps)

    return {
        runRecordStateCommand,
        postRow,
        unpostRow,
        voidRow,
        runWorkflowAction,
        updateContentProgress,
        setLibraryRelation,
        reorderRows
    }
}
