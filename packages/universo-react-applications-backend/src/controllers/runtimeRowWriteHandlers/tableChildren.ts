import type { DbExecutor } from '@universo-react/utils'
import { generateUuidV7, isUuidV7 } from '@universo-react/utils'
import { generateChildTableName } from '@universo-react/schema-ddl'
import {
    IDENTIFIER_REGEX,
    UpdateFailure,
    getTableRowCountError,
    getTableRowLimits,
    normalizeRuntimeTableChildInsertValueByMeta,
    quoteIdentifier,
    type RuntimeSchemaContext,
    type RuntimeTableChildComponentMeta
} from '../../shared/runtimeHelpers'
import {
    type RuntimeObjectCollectionAttr,
    isRuntimeGeneratedSiblingRowKeyAttr,
    isRuntimeServerOwnedAttr
} from '../../services/runtimeRowSupport/contracts'
import { resolveRuntimeCodenameText } from '../../shared/runtimeCodenameText'

export interface RuntimeSiblingRowKeyRemapTarget {
    tableCodename: string
    valueFieldCodename: string
    newKey: string
}

export type RuntimeSiblingRowKeyRemap = Map<string, RuntimeSiblingRowKeyRemapTarget>

const siblingRowKeyRemapKey = (tableCodename: string, fieldCodename: string, oldKey: string): string =>
    `${tableCodename}\u0000${fieldCodename}\u0000${oldKey.toLowerCase()}`

const getSiblingRowSelectConfig = (uiConfig: Record<string, unknown> | string | null | undefined) => {
    let config: Record<string, unknown> | null = null
    if (uiConfig && typeof uiConfig === 'object' && !Array.isArray(uiConfig)) config = uiConfig
    else if (typeof uiConfig === 'string') {
        try {
            const parsed: unknown = JSON.parse(uiConfig)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed as Record<string, unknown>
        } catch {
            throw new UpdateFailure(400, { error: 'Invalid sibling row selection metadata' })
        }
    }
    const selector = config?.siblingRowSelect
    if (!selector || typeof selector !== 'object' || Array.isArray(selector)) return null
    const record = selector as Record<string, unknown>
    if (typeof record.tableCodename !== 'string' || typeof record.valueFieldCodename !== 'string') {
        throw new UpdateFailure(400, { error: 'Invalid sibling row selection metadata' })
    }
    return {
        tableCodename: record.tableCodename.trim(),
        valueFieldCodename: record.valueFieldCodename.trim(),
        requiredWithRows: record.requiredWithRows === true
    }
}

export const insertRuntimeChildRowsBatch = async (params: {
    executor: DbExecutor
    schemaIdent: string
    tabTableName: string
    parentRowId: string
    childRows: Array<Record<string, unknown>>
    sortOrders?: readonly number[]
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
        allValues.push(params.sortOrders?.[rowIdx] ?? rowIdx)
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

export const copyRuntimeChildTables = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    tableAttrs: RuntimeObjectCollectionAttr[]
    runtimeRowCondition: string
    sourceParentId: string
    copiedParentId: string
}): Promise<void> => {
    const plans: Array<{
        tableAttr: RuntimeObjectCollectionAttr
        tabTableName: string
        childAttrs: Array<{
            codename: string
            column_name: string
            data_type?: string | null
            validation_rules?: Record<string, unknown>
            ui_config?: Record<string, unknown> | null
        }>
        validChildColumns: string[]
        childRows: Array<Record<string, unknown>>
        childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
    }> = []

    for (const tableAttr of params.tableAttrs) {
        const rowLimits = getTableRowLimits(tableAttr.validation_rules)
        const fallbackTabTableName = generateChildTableName(tableAttr.id)
        const tabTableName =
            typeof tableAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tableAttr.column_name)
                ? tableAttr.column_name
                : fallbackTabTableName
        if (!IDENTIFIER_REGEX.test(tabTableName)) throw new UpdateFailure(400, { error: 'Invalid child TABLE name while copying' })
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
            [tableAttr.id]
        )) as Array<{
            codename: string
            column_name: string
            data_type?: string | null
            validation_rules?: Record<string, unknown>
            ui_config?: Record<string, unknown> | null
        }>
        const validChildColumns = childAttrs
            .filter((attr) => !isRuntimeServerOwnedAttr(attr) || isRuntimeGeneratedSiblingRowKeyAttr(attr))
            .map((attr) => attr.column_name)
            .filter((column) => IDENTIFIER_REGEX.test(column))
        const childRows = (await params.executor.query(
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
        const rowCountError = getTableRowCountError(childRows.length, resolveRuntimeCodenameText(tableAttr.codename), rowLimits)
        if (rowCountError) {
            throw new UpdateFailure(400, { error: rowCountError })
        }
        plans.push({
            tableAttr,
            tabTableName,
            childAttrs,
            validChildColumns,
            childRows,
            childAttrsByColumn: new Map(
                childAttrs.map((attr) => [
                    attr.column_name,
                    {
                        column_name: attr.column_name,
                        data_type: attr.data_type,
                        validation_rules: attr.validation_rules
                    }
                ])
            )
        })
    }

    const siblingRowKeyRemap: RuntimeSiblingRowKeyRemap = new Map()
    for (const plan of plans) {
        const tableCodename = resolveRuntimeCodenameText(plan.tableAttr.codename)
        for (const row of plan.childRows) {
            for (const attr of plan.childAttrs.filter(isRuntimeGeneratedSiblingRowKeyAttr)) {
                const valueFieldCodename = resolveRuntimeCodenameText(attr.codename)
                if (!plan.validChildColumns.includes(attr.column_name) || !valueFieldCodename) continue
                const oldKey = row[attr.column_name]
                if (typeof oldKey !== 'string' || !isUuidV7(oldKey)) {
                    throw new UpdateFailure(400, { error: 'Invalid generated sibling row key in copied data' })
                }
                const remapKey = siblingRowKeyRemapKey(tableCodename, valueFieldCodename, oldKey)
                if (siblingRowKeyRemap.has(remapKey)) {
                    throw new UpdateFailure(409, { error: 'Duplicate generated sibling row key in copied data' })
                }
                const newKey = generateUuidV7()
                siblingRowKeyRemap.set(remapKey, { tableCodename, valueFieldCodename, newKey })
                row[attr.column_name] = newKey
            }
        }
    }

    for (const plan of plans) {
        for (const row of plan.childRows) {
            for (const attr of plan.childAttrs) {
                if (!plan.validChildColumns.includes(attr.column_name) || isRuntimeGeneratedSiblingRowKeyAttr(attr)) continue
                const selector = getSiblingRowSelectConfig(attr.ui_config)
                if (!selector) continue
                const value = row[attr.column_name]
                const hasTargetRows = [...siblingRowKeyRemap.values()].some(
                    (target) => target.tableCodename === selector.tableCodename && target.valueFieldCodename === selector.valueFieldCodename
                )
                if (value === null || value === undefined || value === '') {
                    if (selector.requiredWithRows && hasTargetRows) {
                        throw new UpdateFailure(400, { error: 'A sibling row selection is required while target rows exist' })
                    }
                    continue
                }
                if (typeof value !== 'string' || !isUuidV7(value)) {
                    throw new UpdateFailure(400, { error: 'Sibling row selection must reference a UUID v7 key' })
                }
                const target = siblingRowKeyRemap.get(siblingRowKeyRemapKey(selector.tableCodename, selector.valueFieldCodename, value))
                if (!target) throw new UpdateFailure(400, { error: 'Sibling row selection target is unavailable while copying' })
                row[attr.column_name] = target.newKey
            }
        }
    }

    for (const plan of plans) {
        if (plan.childRows.length === 0) continue
        const childRows = plan.childRows.map((row) =>
            Object.fromEntries(plan.validChildColumns.map((column) => [column, row[column] ?? null]))
        )
        await insertRuntimeChildRowsBatch({
            executor: params.executor,
            schemaIdent: params.ctx.schemaIdent,
            tabTableName: plan.tabTableName,
            parentRowId: params.copiedParentId,
            childRows,
            childAttrsByColumn: plan.childAttrsByColumn,
            workspacesEnabled: params.ctx.workspacesEnabled,
            currentWorkspaceId: params.ctx.currentWorkspaceId,
            userId: params.ctx.userId
        })
    }
}
