import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import type { DbExecutor } from '@universo-react/utils'
import { buildRuntimeRecordRuleLockKey } from './runtimeRecordRuleLockKey'

/** Share one transaction lock between runtime writers and Marketing seed paths. */
export const acquireMarketingRowCapLock = async (
    executor: Pick<DbExecutor, 'query'>,
    schemaName: string,
    tableName: string
): Promise<void> => {
    await acquireAdvisoryXactLock(executor, `marketing-row-cap:${buildRuntimeRecordRuleLockKey(schemaName, tableName)}`)
}
