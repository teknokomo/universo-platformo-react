import type { DbExecutor } from '@universo/utils/database'
import { createKnexExecutor } from './knexExecutor'
import { getKnex } from './KnexClient'

/**
 * Returns a pool-level DbExecutor backed by the shared Knex instance.
 * Domain packages import this instead of getKnex() directly.
 */
export function getPoolExecutor(): DbExecutor {
    return createKnexExecutor(getKnex())
}
