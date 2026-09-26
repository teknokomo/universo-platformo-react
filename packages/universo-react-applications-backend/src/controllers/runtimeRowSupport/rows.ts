import { type DbExecutor } from '@universo-react/utils'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    getRuntimeInputValue,
    buildRuntimeActiveRowCondition,
    RUNTIME_WRITABLE_TYPES
} from '../../shared/runtimeHelpers'
import { type RuntimeCopyRelation } from './contracts'
import { buildRuntimeAttrLookup, loadRuntimeObjectAttrs, resolveRuntimeObjectByCodename } from './objects'
import { assertRuntimeEntityMutationAllowed } from '../../shared/entityMutationPolicy'
import { PUBLIC_MARKETING_ROW_LIMIT } from '../../persistence/publicApplicationRuntimeStore'
import { isMarketingSeedObject } from '../../services/marketingSeedGuard'
import { buildRuntimeRecordRuleLockKey } from '../../services/runtimeRecordRules'

/**
 * Published marketing objects are read back through the anonymous runtime,
 * which caps each object and fails closed above the limit. Runtime writes must
 * enforce the same cap so an authenticated author cannot break the public page
 * for every visitor by adding one more row.
 */
export const assertMarketingRuntimeRowCap = async (params: {
    manager: DbExecutor
    schemaIdent: string
    tableName: string
    runtimeRowCondition: string
    objectCodename: string
}): Promise<void> => {
    if (!isMarketingSeedObject(params.objectCodename)) return
    // Serialize the count with concurrent writers so two requests at the
    // boundary cannot both pass the check; the lock order (cap -> rules ->
    // row) matches create/restore/module writes.
    await acquireAdvisoryXactLock(
        params.manager,
        `marketing-row-cap:${buildRuntimeRecordRuleLockKey(params.schemaIdent, params.tableName)}`
    )
    const rows = (await params.manager.query(
        `SELECT COUNT(*)::text AS count FROM ${params.schemaIdent}.${quoteIdentifier(params.tableName)} WHERE ${
            params.runtimeRowCondition
        }`,
        []
    )) as Array<{ count: string }>
    const count = Number(rows[0]?.count ?? 0)
    if (count >= PUBLIC_MARKETING_ROW_LIMIT) {
        throw new UpdateFailure(409, {
            error: `Published marketing object ${params.objectCodename} reached the public runtime row limit (${PUBLIC_MARKETING_ROW_LIMIT})`,
            code: 'MARKETING_ROW_LIMIT_REACHED'
        })
    }
}

export const loadRuntimeRowById = async (manager: DbExecutor, dataTableIdent: string, rowId: string, runtimeRowCondition = 'TRUE') => {
    const rows = (await manager.query(
        `
      SELECT *
      FROM ${dataTableIdent}
      WHERE id = $1
        AND ${runtimeRowCondition}
      LIMIT 1
    `,
        [rowId]
    )) as Array<Record<string, unknown>>

    return rows[0] ?? null
}

export const collectTouchedComponentIds = (
    attrs: Array<{ id: string; codename: unknown; column_name: string }>,
    payload: Record<string, unknown>
) => {
    const touched = new Set<string>()

    for (const cmp of attrs) {
        const { hasUserValue } = getRuntimeInputValue(payload, cmp.column_name, cmp.codename)
        if (hasUserValue) {
            touched.add(cmp.id)
        }
    }

    return [...touched]
}

export const copyRuntimeConfiguredRelations = async ({
    manager,
    schemaIdent,
    currentWorkspaceId,
    workspacesEnabled,
    userId,
    sourceParentId,
    copiedParentId,
    relations
}: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    workspacesEnabled: boolean
    userId?: string | null
    sourceParentId: string
    copiedParentId: string
    relations: RuntimeCopyRelation[]
}): Promise<void> => {
    const copiedIdsByObjectCodename = new Map<string, Map<string, string>>()

    for (const relation of relations) {
        const relationObject = await resolveRuntimeObjectByCodename(manager, schemaIdent, relation.objectCodename)
        if (!relationObject?.table_name) {
            throw new UpdateFailure(409, {
                error: 'Runtime copy relation is not configured',
                code: 'RUNTIME_COPY_RELATION_INVALID'
            })
        }
        assertRuntimeEntityMutationAllowed(relationObject.config)

        const attrs = await loadRuntimeObjectAttrs(manager, schemaIdent, relationObject.id)
        const attrsByKey = buildRuntimeAttrLookup(attrs)
        const parentAttr = attrsByKey.get(relation.parentFieldCodename)
        const orderAttr = relation.orderFieldCodename ? attrsByKey.get(relation.orderFieldCodename) : undefined
        const refRemapByColumn = new Map(
            relation.refRemaps.flatMap((remap) => {
                const attr = attrsByKey.get(remap.fieldCodename)
                return attr && IDENTIFIER_REGEX.test(attr.column_name) ? [[attr.column_name, remap.sourceObjectCodename] as const] : []
            })
        )

        if (
            !parentAttr ||
            !IDENTIFIER_REGEX.test(parentAttr.column_name) ||
            (relation.orderFieldCodename && (!orderAttr || !IDENTIFIER_REGEX.test(orderAttr.column_name))) ||
            refRemapByColumn.size !== relation.refRemaps.length
        ) {
            throw new UpdateFailure(409, {
                error: 'Runtime copy relation is not configured',
                code: 'RUNTIME_COPY_RELATION_INVALID'
            })
        }

        const writableAttrs = attrs.filter(
            (attr) => IDENTIFIER_REGEX.test(attr.column_name) && attr.data_type !== 'TABLE' && RUNTIME_WRITABLE_TYPES.has(attr.data_type)
        )
        const writableColumns = writableAttrs.map((attr) => attr.column_name)
        if (!writableColumns.includes(parentAttr.column_name)) {
            throw new UpdateFailure(409, {
                error: 'Runtime copy relation is not configured',
                code: 'RUNTIME_COPY_RELATION_INVALID'
            })
        }

        const relationTableIdent = `${schemaIdent}.${quoteIdentifier(relationObject.table_name)}`
        const relationActiveCondition = buildRuntimeActiveRowCondition(
            relationObject.lifecycleContract,
            relationObject.config,
            undefined,
            currentWorkspaceId
        )
        const orderSql = orderAttr
            ? `ORDER BY ${quoteIdentifier(orderAttr.column_name)} ASC NULLS LAST, _upl_created_at ASC NULLS LAST, id ASC`
            : `ORDER BY _upl_created_at ASC NULLS LAST, id ASC`
        const sourceRows = (await manager.query(
            `
      SELECT id, ${writableColumns.map((column) => quoteIdentifier(column)).join(', ')}
      FROM ${relationTableIdent}
      WHERE ${quoteIdentifier(parentAttr.column_name)} = $1
        AND ${relationActiveCondition}
      ${orderSql}
    `,
            [sourceParentId]
        )) as Array<Record<string, unknown> & { id: string }>

        const relationIdMap = new Map<string, string>()
        copiedIdsByObjectCodename.set(relation.objectCodename, relationIdMap)
        if (sourceRows.length === 0) continue

        const insertColumns = [
            ...writableColumns.map((column) => quoteIdentifier(column)),
            ...(workspacesEnabled && currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
            ...(userId ? ['_upl_created_by'] : [])
        ]

        for (const sourceRow of sourceRows) {
            const insertValues: unknown[] = []
            const placeholders: string[] = []

            for (const column of writableColumns) {
                placeholders.push(`$${insertValues.length + 1}`)
                if (column === parentAttr.column_name) {
                    insertValues.push(copiedParentId)
                    continue
                }

                const remapObjectCodename = refRemapByColumn.get(column)
                if (remapObjectCodename) {
                    const sourceRefId = typeof sourceRow[column] === 'string' ? sourceRow[column] : null
                    if (!sourceRefId) {
                        insertValues.push(sourceRow[column] ?? null)
                        continue
                    }
                    const copiedRefId = copiedIdsByObjectCodename.get(remapObjectCodename)?.get(sourceRefId)
                    if (!copiedRefId) {
                        throw new UpdateFailure(409, {
                            error: 'Runtime copy relation reference could not be remapped',
                            code: 'RUNTIME_COPY_RELATION_INVALID'
                        })
                    }
                    insertValues.push(copiedRefId)
                    continue
                }

                insertValues.push(sourceRow[column] ?? null)
            }

            if (workspacesEnabled && currentWorkspaceId) {
                placeholders.push(`$${insertValues.length + 1}`)
                insertValues.push(currentWorkspaceId)
            }
            if (userId) {
                placeholders.push(`$${insertValues.length + 1}`)
                insertValues.push(userId)
            }

            const [inserted] = (await manager.query(
                `
        INSERT INTO ${relationTableIdent} (${insertColumns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING id
      `,
                insertValues
            )) as Array<{ id: string }>

            if (inserted?.id && UUID_REGEX.test(sourceRow.id)) {
                relationIdMap.set(sourceRow.id, inserted.id)
            }
        }
    }
}
