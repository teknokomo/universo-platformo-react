import { qColumn, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import type { RuntimeSurfaceReady } from '../shared/interpretationNetworkRuntimeContracts'
import { activeWorkspaceWhere } from '../shared/runtimeWorkspaceSql'

type RuntimeContract = RuntimeSurfaceReady['contracts'][keyof RuntimeSurfaceReady['contracts']]

export type PublicRuntimeSelectedColumn = {
    readonly field: string
    readonly alias: string
    readonly maxBytes?: number
    readonly oversizedAlias?: string
}

export type PublicRuntimeFilter =
    | { readonly field: string; readonly operator: 'equals'; readonly value: unknown }
    | { readonly field: string; readonly operator: 'is-null' }

const quoteAlias = (alias: string): string => {
    if (!/^[a-z][A-Za-z0-9]*$/u.test(alias)) throw new Error('Invalid public SQL alias')
    return `"${alias}"`
}

const selectColumn = (column: PublicRuntimeSelectedColumn, reference: string, values: unknown[]): string[] => {
    const { alias, maxBytes, oversizedAlias } = column
    if (maxBytes === undefined) {
        if (oversizedAlias !== undefined) throw new Error('A byte sentinel requires a bounded public column')
        return [`${reference} AS ${quoteAlias(alias)}`]
    }
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !oversizedAlias) {
        throw new Error('Invalid bounded public column metadata')
    }
    values.push(maxBytes)
    const maxBytesParameter = `$${values.length}`
    return [
        `CASE WHEN ${reference} IS NULL OR octet_length(${reference}::text) <= ${maxBytesParameter} THEN ${reference} ELSE NULL END AS ${quoteAlias(
            alias
        )}`,
        `(${reference} IS NOT NULL AND octet_length(${reference}::text) > ${maxBytesParameter}) AS ${quoteAlias(oversizedAlias)}`
    ]
}

const selectColumns = (columns: readonly PublicRuntimeSelectedColumn[], values: unknown[]): string =>
    [qColumn('id'), ...columns.flatMap((column) => selectColumn(column, qColumn(column.field), values))].join(', ')

const objectTableIdent = (schemaName: string, contract: RuntimeContract): string => qSchemaTable(schemaName, contract.object.table_name)

const matrixTableIdent = (schemaName: string, contract: RuntimeContract): string => {
    if (!contract.childTableName) throw new Error('Interpretation Network matrix table metadata is unavailable')
    return qSchemaTable(schemaName, contract.childTableName)
}

/** Load one active runtime entity row by its internal identity. */
export async function findPublicInterpretationNetworkRuntimeRecord(
    executor: DbExecutor,
    surface: RuntimeSurfaceReady,
    contract: RuntimeContract,
    id: string,
    columns: readonly PublicRuntimeSelectedColumn[]
): Promise<Record<string, unknown> | null> {
    const values: unknown[] = []
    const selectedColumns = selectColumns(columns, values)
    values.push(id)
    const idParameter = values.length
    const activeWhere = activeWorkspaceWhere(surface.workspaceId, values)
    const rows = await executor.query<Record<string, unknown>>(
        `SELECT ${selectedColumns} FROM ${objectTableIdent(surface.schemaName, contract)} WHERE id = $${idParameter} AND ${qColumn(
            '_app_published'
        )} = true AND ${activeWhere} LIMIT 1`,
        values
    )
    return rows[0] ?? null
}

/** Read one bounded page from an active runtime entity table. */
export async function listPublicInterpretationNetworkRuntimeRows(input: {
    executor: DbExecutor
    surface: RuntimeSurfaceReady
    contract: RuntimeContract
    columns: readonly PublicRuntimeSelectedColumn[]
    filters: readonly PublicRuntimeFilter[]
    limit: number
    offset: number
    priorityId?: string
}): Promise<Record<string, unknown>[]> {
    const values: unknown[] = []
    const selectedColumns = selectColumns(input.columns, values)
    const where = input.filters.map((filter) => {
        if (filter.operator === 'is-null') return `${qColumn(filter.field)} IS NULL`
        values.push(filter.value)
        return `${qColumn(filter.field)} = $${values.length}`
    })
    const activeWhere = activeWorkspaceWhere(input.surface.workspaceId, values)
    let priorityOrder = ''
    if (input.priorityId) {
        values.push(input.priorityId)
        priorityOrder = `CASE WHEN ${qColumn('id')} = $${values.length} THEN 0 ELSE 1 END ASC, `
    }
    values.push(input.limit + 1)
    const limitParam = `$${values.length}`
    values.push(input.offset)
    const offsetParam = `$${values.length}`
    const rows = await input.executor.query<Record<string, unknown>>(
        `SELECT ${selectedColumns} FROM ${objectTableIdent(input.surface.schemaName, input.contract)}
         WHERE ${(where.length > 0 ? where : ['TRUE']).concat(`${qColumn('_app_published')} = true`, activeWhere).join(' AND ')}
         ORDER BY ${priorityOrder}${qColumn('_upl_created_at')} ASC NULLS LAST, ${qColumn('id')} ASC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        values
    )
    return rows
}

/** Read a bounded, sorted page of active Interpretation Matrix child rows. */
export async function listPublicInterpretationNetworkMatrixRows(input: {
    executor: DbExecutor
    surface: RuntimeSurfaceReady
    columns: readonly PublicRuntimeSelectedColumn[]
    parentId: string
    limit: number
    offset: number
    cellIdentity?: string
    cellIdentityColumn?: string
}): Promise<Record<string, unknown>[]> {
    const child = input.surface.contracts.Interpretation
    const cellAlias = 'cell'
    const parentAlias = 'parent'
    const cellRef = (column: string): string => `${quoteAlias(cellAlias)}.${qColumn(column)}`
    const parentRef = (column: string): string => `${quoteAlias(parentAlias)}.${qColumn(column)}`
    const values: unknown[] = [input.parentId]
    const select = [
        cellRef('id'),
        cellRef('_tp_sort_order'),
        ...input.columns.flatMap((column) => selectColumn(column, cellRef(column.field), values))
    ].join(', ')
    const activeCellWhere = activeWorkspaceWhere(input.surface.workspaceId, values, cellAlias)
    const activeParentWhere = activeWorkspaceWhere(input.surface.workspaceId, values, parentAlias)
    const where = [
        `${cellRef('_tp_parent_id')} = $1`,
        `${cellRef('_app_published')} = true`,
        activeCellWhere,
        `${parentRef('_app_published')} = true`,
        activeParentWhere
    ]
    if (input.cellIdentity !== undefined) {
        if (!input.cellIdentityColumn) throw new Error('Interpretation Network cell identity column is unavailable')
        values.push(input.cellIdentity)
        where.push(`${cellRef(input.cellIdentityColumn)} = $${values.length}`)
    }
    values.push(input.limit + 1)
    const limitParam = `$${values.length}`
    values.push(input.offset)
    const offsetParam = `$${values.length}`
    return input.executor.query<Record<string, unknown>>(
        `SELECT ${select} FROM ${matrixTableIdent(input.surface.schemaName, child)} AS ${quoteAlias(cellAlias)}
         INNER JOIN ${objectTableIdent(input.surface.schemaName, child)} AS ${quoteAlias(parentAlias)}
            ON ${parentRef('id')} = ${cellRef('_tp_parent_id')}
         WHERE ${where.join(' AND ')}
         ORDER BY ${cellRef('_tp_sort_order')} ASC, ${cellRef('_upl_created_at')} ASC NULLS LAST, ${cellRef('id')} ASC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        values
    )
}
