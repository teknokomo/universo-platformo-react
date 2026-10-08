import type { DbExecutor } from '@universo-react/utils'
import { buildRuntimeRecordAccessClause } from '../services/runtimeRowSupport/access'
import { loadRuntimeObjectAttrs } from '../services/runtimeRowSupport/objectMetadata'
import {
    buildRuntimeActiveRowCondition,
    resolveRuntimeCodenameText,
    type RuntimeSchemaContext,
    type resolveTabularContext
} from '../shared/runtimeHelpers'

type RuntimeChildContext = Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>

/** Load a nested table's parent only when its configured record ACL allows this caller. */
export const loadRuntimeChildParentRecord = async (params: {
    manager: DbExecutor
    ctx: RuntimeSchemaContext
    tc: RuntimeChildContext
    recordId: string
    minimumAccessLevel: 'read' | 'edit'
    lock?: boolean
}): Promise<(Record<string, unknown> & { id: string }) | null> => {
    const attrs = await loadRuntimeObjectAttrs(params.manager, params.ctx.schemaIdent, params.tc.object.id)
    const values: unknown[] = [params.recordId]
    const accessClause = await buildRuntimeRecordAccessClause({
        manager: params.manager,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectCodename: resolveRuntimeCodenameText(params.tc.object.codename),
        attrs,
        config: params.tc.object.config,
        outerRowIdSql: 'parentRecord.id',
        values,
        minimumAccessLevel: params.minimumAccessLevel
    })
    const activeCondition = buildRuntimeActiveRowCondition(
        params.tc.lifecycleContract,
        params.tc.object.config,
        'parentRecord',
        params.ctx.currentWorkspaceId
    )
    const lockClause = params.lock ? 'FOR UPDATE OF parentRecord' : ''
    const rows = (await params.manager.query(
        `
        SELECT parentRecord.*
        FROM ${params.tc.parentTableIdent} AS parentRecord
        WHERE parentRecord.id = $1
          AND ${activeCondition}
          AND (${accessClause ?? 'TRUE'})
        ${lockClause}
        `,
        values
    )) as Array<Record<string, unknown> & { id: string }>

    return rows[0] ?? null
}
