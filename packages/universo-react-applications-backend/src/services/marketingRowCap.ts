import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import type { DbExecutor } from '@universo-react/utils'
import { quoteIdentifier } from '../shared/runtimeSqlIdentifiers'
import { UpdateFailure } from '../shared/updateFailure'
import { buildPublicMarketingLifecyclePredicate } from '../shared/marketingRuntimeLifecycleSql'
import { PUBLIC_MARKETING_ROW_LIMIT } from '../shared/marketingRuntimeLimits'
import { listMarketingWidgetBindingSourcesForRuntimeWrites } from '../persistence/marketingWidgetBindingStore'
import { buildRuntimeRecordRuleLockKey } from './runtimeRecordRuleLockKey'

/** Share one transaction lock between runtime writers and Marketing seed paths. */
export const acquireMarketingRowCapLock = async (
    executor: Pick<DbExecutor, 'query'>,
    schemaName: string,
    tableName: string
): Promise<void> => {
    await acquireAdvisoryXactLock(executor, `marketing-row-cap:${buildRuntimeRecordRuleLockKey(schemaName, tableName)}`)
}

/**
 * Published marketing objects are read back through the anonymous runtime,
 * which caps each object and fails closed above the limit. Runtime writes must
 * enforce the same cap so an authenticated author cannot break the public page
 * for every visitor by adding one more row.
 */
export const assertMarketingRuntimeRowCap = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
    tableName: string
    runtimeRowCondition: string
    objectCodename: string
}): Promise<void> => {
    // Read the live binding set under the same lock used by publication and
    // workspace seed paths. Otherwise a concurrent binding change can commit
    // between the metadata probe and this write, bypassing the row cap.
    await acquireMarketingRowCapLock(params.manager, params.schemaIdent, params.tableName)
    const marketingWidgetBindingSources = await listMarketingWidgetBindingSourcesForRuntimeWrites(
        params.manager,
        params.schemaName,
        params.objectCodename
    )
    if (!marketingWidgetBindingSources.has(params.objectCodename)) return
    // Serialize the count with concurrent writers so two requests at the
    // boundary cannot both pass the check; the lock order (cap -> rules ->
    // row) matches create/restore/module writes.
    const rows = (await params.manager.query(
        `SELECT COUNT(*)::text AS count
         FROM ${params.schemaIdent}.${quoteIdentifier(params.tableName)}
         WHERE (${params.runtimeRowCondition})
           AND ${buildPublicMarketingLifecyclePredicate()}`,
        []
    )) as Array<{ count: string }>
    const countText = rows[0]?.count
    if (typeof countText !== 'string' || !/^\d+$/.test(countText)) {
        throw new UpdateFailure(500, {
            error: 'Unable to validate the published marketing object row count',
            code: 'MARKETING_ROW_COUNT_INVALID'
        })
    }
    if (BigInt(countText) >= BigInt(PUBLIC_MARKETING_ROW_LIMIT)) {
        throw new UpdateFailure(409, {
            error: `Published marketing object ${params.objectCodename} reached the public runtime row limit (${PUBLIC_MARKETING_ROW_LIMIT})`,
            code: 'MARKETING_ROW_LIMIT_REACHED'
        })
    }
}
