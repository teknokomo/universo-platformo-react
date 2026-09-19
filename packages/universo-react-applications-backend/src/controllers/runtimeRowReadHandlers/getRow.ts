import type { Request, Response } from 'express'
import {
    IDENTIFIER_REGEX,
    UUID_REGEX,
    buildRuntimeActiveRowCondition,
    pgNumericToNumber,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema
} from '../../shared/runtimeHelpers'
import { resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'
import { buildRuntimeRecordAccessClause } from '../runtimeRowSupport/access'

import type { RuntimeRowReadHandlerDeps } from './types'

export const createGetRowHandler = ({ getDbExecutor, query }: RuntimeRowReadHandlerDeps) => {
    const getRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (objectCollectionId && !UUID_REGEX.test(objectCollectionId)) return res.status(400).json({ error: 'Invalid object ID format' })
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`

        const rowValues: unknown[] = [rowId]
        const recordAccessClause = await buildRuntimeRecordAccessClause({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
            attrs,
            config: objectCollection.config,
            outerRowIdSql: `${dataTableIdent}.id`,
            values: rowValues
        })
        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && a.data_type !== 'TABLE')
        const selectColumns = ['id', ...safeAttrs.map((a) => quoteIdentifier(a.column_name)), quoteIdentifier('_upl_version')]
        const whereSql = ['id = $1', runtimeRowCondition, recordAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')

        const rows = (await ctx.manager.query(
            `
        SELECT ${selectColumns.join(', ')}
        FROM ${dataTableIdent}
        WHERE ${whereSql}
      `,
            rowValues
        )) as Array<Record<string, unknown>>

        if (rows.length === 0) return res.status(404).json({ error: 'Row not found' })

        const row = rows[0]
        const rawData: Record<string, unknown> = {}
        for (const cmp of safeAttrs) {
            const raw = row[cmp.column_name] ?? null
            rawData[cmp.column_name] = cmp.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
        }

        return res.json({ id: String(row.id), version: Number(row._upl_version ?? 1), data: rawData })
    }
    return getRow
}
