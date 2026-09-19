import type { DbExecutor } from '@universo-react/utils'
import { generateChildTableName } from '@universo-react/schema-ddl'
import {
    IDENTIFIER_REGEX,
    UpdateFailure,
    getTableRowLimits,
    normalizeRuntimeTableChildInsertValueByMeta,
    quoteIdentifier,
    type RuntimeSchemaContext,
    type RuntimeTableChildComponentMeta
} from '../../shared/runtimeHelpers'
import { type RuntimeObjectCollectionAttr, isRuntimeServerOwnedAttr } from '../runtimeRowSupport/contracts'

export const insertRuntimeChildRowsBatch = async (params: {
    executor: DbExecutor
    schemaIdent: string
    tabTableName: string
    parentRowId: string
    childRows: Array<Record<string, unknown>>
    childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
    userId: string
}): Promise<void> => {
    const tabTableIdent = `${params.schemaIdent}.${quoteIdentifier(params.tabTableName)}`
    const dataColSet = new Set<string>()
    for (const rd of params.childRows) {
        for (const cn of Object.keys(rd)) {
            if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
        }
    }
    const dataColumns = [...dataColSet]
    const headerCols: string[] = ['_tp_parent_id', '_tp_sort_order']
    if (params.workspacesEnabled && params.currentWorkspaceId) {
        headerCols.push(quoteIdentifier('workspace_id'))
    }
    if (params.userId) headerCols.push('_upl_created_by')
    const allColumns = [...headerCols, ...dataColumns.map((c) => quoteIdentifier(c))]
    const allValues: unknown[] = []
    const valueTuples: string[] = []
    let pIdx = 1

    for (let rowIdx = 0; rowIdx < params.childRows.length; rowIdx++) {
        const rowData = params.childRows[rowIdx]
        const ph: string[] = []
        ph.push(`$${pIdx++}`)
        allValues.push(params.parentRowId)
        ph.push(`$${pIdx++}`)
        allValues.push(rowIdx)
        if (params.workspacesEnabled && params.currentWorkspaceId) {
            ph.push(`$${pIdx++}`)
            allValues.push(params.currentWorkspaceId)
        }
        if (params.userId) {
            ph.push(`$${pIdx++}`)
            allValues.push(params.userId)
        }
        for (const cn of dataColumns) {
            ph.push(`$${pIdx++}`)
            allValues.push(normalizeRuntimeTableChildInsertValueByMeta(rowData[cn] ?? null, params.childAttrsByColumn.get(cn)))
        }
        valueTuples.push(`(${ph.join(', ')})`)
    }

    await params.executor.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, allValues)
}

export const copyRuntimeChildTableRows = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    tableAttr: RuntimeObjectCollectionAttr
    runtimeRowCondition: string
    sourceParentId: string
    copiedParentId: string
}): Promise<void> => {
    const { minRows } = getTableRowLimits(params.tableAttr.validation_rules)
    const fallbackTabTableName = generateChildTableName(params.tableAttr.id)
    const tabTableName =
        typeof params.tableAttr.column_name === 'string' && IDENTIFIER_REGEX.test(params.tableAttr.column_name)
            ? params.tableAttr.column_name
            : fallbackTabTableName
    if (!IDENTIFIER_REGEX.test(tabTableName)) return
    const tabTableIdent = `${params.ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

    const childAttrs = (await params.executor.query(
        `
          SELECT codename, column_name, data_type, validation_rules, ui_config
          FROM ${params.ctx.schemaIdent}._app_components
          WHERE parent_component_id = $1
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
        `,
        [params.tableAttr.id]
    )) as Array<{
        codename: string
        column_name: string
        data_type?: string | null
        validation_rules?: Record<string, unknown>
        ui_config?: Record<string, unknown> | null
    }>

    const validChildColumns = childAttrs
        .filter((cmp) => !isRuntimeServerOwnedAttr(cmp))
        .map((cmp) => cmp.column_name)
        .filter((column) => IDENTIFIER_REGEX.test(column))
    const childAttrsByColumn = new Map(childAttrs.map((cmp) => [cmp.column_name, cmp]))
    const sourceChildRows = (await params.executor.query(
        `
          SELECT ${validChildColumns.length > 0 ? validChildColumns.map((column) => quoteIdentifier(column)).join(', ') + ',' : ''}
                 _tp_sort_order
          FROM ${tabTableIdent}
          WHERE _tp_parent_id = $1
            AND ${params.runtimeRowCondition}
          ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
        `,
        [params.sourceParentId]
    )) as Array<Record<string, unknown>>

    if (minRows !== null && sourceChildRows.length < minRows) {
        throw new UpdateFailure(400, {
            error: `TABLE ${params.tableAttr.codename} requires at least ${minRows} row(s)`
        })
    }

    if (sourceChildRows.length === 0) return

    const headerColumns = [
        '_tp_parent_id',
        '_tp_sort_order',
        ...(params.ctx.workspacesEnabled && params.ctx.currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
        ...(params.ctx.userId ? ['_upl_created_by'] : [])
    ]
    const allColumns = [...headerColumns, ...validChildColumns.map((column) => quoteIdentifier(column))]
    const copyValues: unknown[] = []
    const valueTuples: string[] = []
    let copyParamIndex = 1
    for (let index = 0; index < sourceChildRows.length; index++) {
        const sourceChild = sourceChildRows[index]
        const tuple: string[] = []
        tuple.push(`$${copyParamIndex++}`)
        copyValues.push(params.copiedParentId)
        tuple.push(`$${copyParamIndex++}`)
        copyValues.push(index)
        if (params.ctx.workspacesEnabled && params.ctx.currentWorkspaceId) {
            tuple.push(`$${copyParamIndex++}`)
            copyValues.push(params.ctx.currentWorkspaceId)
        }
        if (params.ctx.userId) {
            tuple.push(`$${copyParamIndex++}`)
            copyValues.push(params.ctx.userId)
        }
        for (const column of validChildColumns) {
            tuple.push(`$${copyParamIndex++}`)
            copyValues.push(normalizeRuntimeTableChildInsertValueByMeta(sourceChild[column] ?? null, childAttrsByColumn.get(column)))
        }
        valueTuples.push(`(${tuple.join(', ')})`)
    }
    await params.executor.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, copyValues)
}
