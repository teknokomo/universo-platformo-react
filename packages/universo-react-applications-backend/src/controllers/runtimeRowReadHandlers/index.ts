import type { DbExecutor } from '@universo-react/utils'

import { createQueryHelper } from '../../shared/runtimeHelpers'
import { createGetRowHandler } from './getRow'
import { createGetRuntimeHandler } from './getRuntime'
import type { RuntimeRowReadHandlerDeps } from './types'
import { createUnionDatasourceHandler } from './unionDatasource'

export { resolveRuntimeReadActiveObjectCollection } from './dataLoaders'

/**
 * Read-only runtime row handlers (records union, runtime table payload and a
 * single row). Extracted from `runtimeRowsController` so the controller stays a
 * composition root; shared helpers live in `./runtimeRowSupport/*`.
 */
export interface RuntimeRowReadHandlerContext {
    getDbExecutor: () => DbExecutor
}

export function createRuntimeRowReadHandlers({ getDbExecutor }: RuntimeRowReadHandlerContext) {
    const deps: RuntimeRowReadHandlerDeps = {
        getDbExecutor,
        query: createQueryHelper(getDbExecutor)
    }

    const listRecordsUnionDatasource = createUnionDatasourceHandler(deps)
    const getRuntime = createGetRuntimeHandler(deps)
    const getRow = createGetRowHandler(deps)

    return { listRecordsUnionDatasource, getRuntime, getRow }
}
