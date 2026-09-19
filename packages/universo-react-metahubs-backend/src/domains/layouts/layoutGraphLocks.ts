import type { SqlQueryable } from '@universo-react/utils/database'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'

/**
 * Every layout graph mutation and publication snapshot must use the same
 * transaction-scoped lock so a snapshot cannot mix rows from two graph states.
 */
export const buildMetahubLayoutGraphLockKey = (schemaName: string): string => `mhb-layout-graph:${schemaName}`

export const acquireMetahubLayoutGraphLock = async (db: SqlQueryable, schemaName: string): Promise<void> => {
    await acquireAdvisoryXactLock(db, buildMetahubLayoutGraphLockKey(schemaName))
}
