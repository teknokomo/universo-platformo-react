import type { DbExecutor } from '@universo-react/utils'
import { generateUuidV7, isUuidV7 } from '@universo-react/utils'
import { generateChildTableName } from '@universo-react/schema-ddl'
import {
    IDENTIFIER_REGEX,
    UpdateFailure,
    coerceRuntimeValue,
    ensureEnumerationValueBelongsToTarget,
    formatRuntimeFieldPath,
    getDefaultEnumValueId,
    getEnumPresentationMode,
    getRuntimeInputValue,
    getSetConstantConfig,
    getTableRowCountError,
    getTableRowLimits,
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValueByMeta,
    normalizeRuntimeTableChildInsertValue,
    quoteIdentifier,
    resolveRefId,
    resolveRuntimeCodenameText,
    runtimeCodenameTextSql,
    toRuntimeInputFormatErrorBody
} from '../../shared/runtimeHelpers'
import {
    isRuntimeEnumerationKind,
    isRuntimeGeneratedSiblingRowKeyAttr,
    isRuntimeSetKind,
    type RuntimeObjectCollectionAttr
} from '../../services/runtimeRowSupport/contracts'
import { hasRuntimeServerOwnedInput } from '../runtimeRowSupport/validation'
import {
    assertSiblingRowKeyHasNoReferences,
    isGeneratedSiblingRowSelectKey,
    validateExistingSiblingRowSelectsForTarget,
    validateSiblingRowSelectTargets
} from '../runtimeChildRowsSiblingValidation'
import {
    buildRuntimeSiblingRowAliases,
    getRuntimeSiblingRowAliasTarget,
    resolveRuntimeSiblingRowReference,
    type RuntimeSiblingRowAliasTarget
} from '../runtimeSiblingRowAliases'
import { insertRuntimeChildRowsBatch } from './tableChildren'
import type { RuntimeTableChildAttrRow, RuntimeWriteTableDataEntry } from './types'

export const prepareBulkUpdateTableChildRows = async (params: {
    manager: DbExecutor
    schemaIdent: string
    tableFieldPath: string
    tableAttr: RuntimeObjectCollectionAttr
    childRows: Array<Record<string, unknown>>
    childAttrs: RuntimeTableChildAttrRow[]
    siblingRowAliases?: ReadonlyMap<string, RuntimeSiblingRowAliasTarget>
}): Promise<
    { kind: 'ok'; rows: Array<Record<string, unknown>> } | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const preparedRows: Array<Record<string, unknown>> = []
    const generatedSiblingRowKeys = new Set<string>()

    for (let rowIdx = 0; rowIdx < params.childRows.length; rowIdx++) {
        const rowData = params.childRows[rowIdx]
        if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
            return {
                kind: 'failure',
                statusCode: 400,
                body: { error: `Invalid row ${rowIdx + 1} for ${params.tableFieldPath}: row must be an object` }
            }
        }

        const hasRowAlias = Object.prototype.hasOwnProperty.call(rowData, '$rowAlias')
        const rowAliasTarget = getRuntimeSiblingRowAliasTarget(rowData, params.siblingRowAliases ?? new Map())
        if (hasRowAlias && !rowAliasTarget) {
            return { kind: 'failure', statusCode: 400, body: { error: 'Invalid sibling row alias' } }
        }

        const preparedRow: Record<string, unknown> = {}

        for (const cAttr of params.childAttrs) {
            if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue

            const childFieldPath = formatRuntimeFieldPath(params.tableAttr.codename, cAttr.codename)
            const isGeneratedSiblingKey = isRuntimeGeneratedSiblingRowKeyAttr(cAttr)
            const { hasUserValue: hasGeneratedKeyInput, value: generatedKeyInput } = getRuntimeInputValue(
                rowData,
                cAttr.column_name,
                cAttr.codename
            )
            if (
                (hasRuntimeServerOwnedInput(rowData, cAttr) && !isGeneratedSiblingKey) ||
                (isGeneratedSiblingKey && cAttr.ui_config?.serverOwned === true && hasGeneratedKeyInput)
            ) {
                return { kind: 'failure', statusCode: 400, body: { error: `Field is server-owned: ${childFieldPath}` } }
            }
            if (isGeneratedSiblingKey) {
                if (cAttr.data_type.toUpperCase() !== 'STRING') {
                    return { kind: 'failure', statusCode: 400, body: { error: `Invalid generated sibling row key: ${childFieldPath}` } }
                }
                let siblingKey: string
                if (rowAliasTarget) {
                    if (hasGeneratedKeyInput) {
                        return { kind: 'failure', statusCode: 400, body: { error: `Field is server-owned: ${childFieldPath}` } }
                    }
                    if (
                        rowAliasTarget.tableCodename !== resolveRuntimeCodenameText(params.tableAttr.codename) ||
                        rowAliasTarget.valueFieldCodename !== cAttr.codename
                    ) {
                        return {
                            kind: 'failure',
                            statusCode: 400,
                            body: { error: 'Sibling row alias does not match its target TABLE key' }
                        }
                    }
                    siblingKey = rowAliasTarget.key
                } else if (hasGeneratedKeyInput) {
                    if (typeof generatedKeyInput !== 'string' || !isUuidV7(generatedKeyInput)) {
                        return {
                            kind: 'failure',
                            statusCode: 400,
                            body: { error: `Invalid generated sibling row key: ${childFieldPath}` }
                        }
                    }
                    siblingKey = generatedKeyInput
                } else {
                    siblingKey = generateUuidV7()
                }
                siblingKey = siblingKey.toLowerCase()
                if (generatedSiblingRowKeys.has(siblingKey)) {
                    return { kind: 'failure', statusCode: 400, body: { error: `Duplicate generated sibling row key: ${childFieldPath}` } }
                }
                generatedSiblingRowKeys.add(siblingKey)
                preparedRow[cAttr.column_name] = siblingKey
                continue
            }
            const isEnumRef = cAttr.data_type === 'REF' && isRuntimeEnumerationKind(cAttr.target_object_kind)
            const { hasUserValue: hasChildUserValue, value: childInputValue } = getRuntimeInputValue(
                rowData,
                cAttr.column_name,
                cAttr.codename
            )
            const resolvedSiblingReference = resolveRuntimeSiblingRowReference(
                childInputValue,
                cAttr,
                params.siblingRowAliases ?? new Map()
            )
            if ('error' in resolvedSiblingReference) {
                return { kind: 'failure', statusCode: 400, body: { error: resolvedSiblingReference.error } }
            }
            let cRaw = resolvedSiblingReference.value
            const childCodename = resolveRuntimeCodenameText(cAttr.codename)
            if (
                cRaw === undefined &&
                ((Object.prototype.hasOwnProperty.call(rowData, cAttr.column_name) && rowData[cAttr.column_name] === null) ||
                    (childCodename.length > 0 &&
                        Object.prototype.hasOwnProperty.call(rowData, childCodename) &&
                        rowData[childCodename] === null))
            ) {
                cRaw = null
            }
            if (cAttr.ui_config?.siblingRowSelect && typeof cRaw === 'string' && isUuidV7(cRaw)) {
                cRaw = cRaw.toLowerCase()
            }

            if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasChildUserValue) {
                return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${childFieldPath}` } }
            }

            if (cRaw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
                if (defaultEnumValueId) {
                    try {
                        await ensureEnumerationValueBelongsToTarget(
                            params.manager,
                            params.schemaIdent,
                            defaultEnumValueId,
                            cAttr.target_object_id
                        )
                        cRaw = defaultEnumValueId
                    } catch (error) {
                        if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                            cRaw = undefined
                        } else {
                            throw error
                        }
                    }
                }
            }

            const childSetConstantConfig =
                cAttr.data_type === 'REF' && isRuntimeSetKind(cAttr.target_object_kind) ? getSetConstantConfig(cAttr.ui_config) : null
            if (childSetConstantConfig) {
                const providedRefId = resolveRefId(cRaw)
                if (!providedRefId) {
                    cRaw = childSetConstantConfig.id
                } else if (providedRefId !== childSetConstantConfig.id) {
                    return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${childFieldPath}` } }
                } else {
                    cRaw = childSetConstantConfig.id
                }
            }

            if (cRaw === undefined || cRaw === null) {
                if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                    let defaultValue: unknown
                    switch (cAttr.data_type) {
                        case 'STRING':
                            defaultValue = ''
                            break
                        case 'NUMBER':
                            defaultValue = 0
                            break
                        default:
                            defaultValue = ''
                    }
                    preparedRow[cAttr.column_name] = defaultValue
                } else if (cRaw === null && hasChildUserValue) {
                    preparedRow[cAttr.column_name] = null
                }
                continue
            }

            try {
                const cCoerced = normalizeConfiguredRuntimeJsonValue(
                    coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules),
                    cAttr
                )

                if (isEnumRef && typeof cAttr.target_object_id === 'string' && cCoerced) {
                    await ensureEnumerationValueBelongsToTarget(
                        params.manager,
                        params.schemaIdent,
                        String(cCoerced),
                        cAttr.target_object_id
                    )
                }

                preparedRow[cAttr.column_name] = normalizeRuntimeTableChildInsertValue(cCoerced, cAttr.data_type, cAttr.validation_rules)
            } catch (err) {
                const formatError = toRuntimeInputFormatErrorBody(err)
                if (formatError) return { kind: 'failure', statusCode: 400, body: formatError }
                return {
                    kind: 'failure',
                    statusCode: 400,
                    body: { error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}` }
                }
            }
        }

        preparedRows.push(preparedRow)
    }

    return { kind: 'ok', rows: preparedRows }
}

export const buildBulkUpdateTableEntries = async (params: {
    manager: DbExecutor
    schemaIdent: string
    data: Record<string, unknown>
    tableAttrs: RuntimeObjectCollectionAttr[]
}): Promise<
    { kind: 'ok'; entries: RuntimeWriteTableDataEntry[] } | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const tableInputs: Array<{
        tableAttr: RuntimeObjectCollectionAttr
        childAttrs: RuntimeTableChildAttrRow[]
        childRows: Array<Record<string, unknown>>
        tabTableName: string
    }> = []

    for (const tAttr of params.tableAttrs) {
        const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
        const { hasUserValue, value: raw } = getRuntimeInputValue(params.data, tAttr.column_name, tAttr.codename)
        if (!hasUserValue) continue
        if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
            return {
                kind: 'failure',
                statusCode: 400,
                body: { error: `Invalid value for ${tableFieldPath}: TABLE value must be an array` }
            }
        }

        const childRows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
        const rowCountError = getTableRowCountError(childRows.length, tableFieldPath, getTableRowLimits(tAttr.validation_rules))
        if (rowCountError) {
            return { kind: 'failure', statusCode: 400, body: { error: rowCountError } }
        }

        const fallbackTabTableName = generateChildTableName(tAttr.id)
        const tabTableName =
            typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name) ? tAttr.column_name : fallbackTabTableName
        if (!IDENTIFIER_REGEX.test(tabTableName)) {
            return { kind: 'failure', statusCode: 400, body: { error: `Invalid tabular table name for ${tableFieldPath}` } }
        }

        const childAttrsResult = (await params.manager.query(
            `
      SELECT id, ${runtimeCodenameTextSql('codename')} AS codename, column_name, data_type, is_required, validation_rules,
             target_object_id, target_object_kind, ui_config
      FROM ${params.schemaIdent}._app_components
      WHERE parent_component_id = $1
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY sort_order ASC
    `,
            [tAttr.id]
        )) as RuntimeTableChildAttrRow[]

        tableInputs.push({ tableAttr: tAttr, childAttrs: childAttrsResult, childRows, tabTableName })
    }

    const aliasResult = buildRuntimeSiblingRowAliases(
        tableInputs.map((input) => ({
            tableCodename: resolveRuntimeCodenameText(input.tableAttr.codename),
            childAttrs: input.childAttrs,
            childRows: input.childRows
        }))
    )
    if ('error' in aliasResult) return { kind: 'failure', statusCode: 400, body: { error: aliasResult.error } }

    const tableDataEntries: RuntimeWriteTableDataEntry[] = []
    for (const input of tableInputs) {
        const preparedResult = await prepareBulkUpdateTableChildRows({
            manager: params.manager,
            schemaIdent: params.schemaIdent,
            tableFieldPath: formatRuntimeFieldPath(input.tableAttr.codename),
            tableAttr: input.tableAttr,
            childRows: input.childRows,
            childAttrs: input.childAttrs,
            siblingRowAliases: aliasResult.aliases
        })
        if (preparedResult.kind !== 'ok') return preparedResult
        tableDataEntries.push({
            cmp: input.tableAttr,
            childAttrs: input.childAttrs,
            tabTableName: input.tabTableName,
            rows: preparedResult.rows,
            childAttrsByColumn: new Map(
                input.childAttrs.map((childAttr) => [
                    childAttr.column_name,
                    {
                        column_name: childAttr.column_name,
                        data_type: childAttr.data_type,
                        validation_rules: childAttr.validation_rules
                    }
                ])
            )
        })
    }

    return { kind: 'ok', entries: tableDataEntries }
}

const updateRuntimeTableChildRow = async (params: {
    executor: DbExecutor
    tabTableIdent: string
    parentRowId: string
    childRowId: string
    row: Record<string, unknown>
    rowIndex: number
    dataColumns: string[]
    childAttrsByColumn: RuntimeWriteTableDataEntry['childAttrsByColumn']
    userId: string
    runtimeRowCondition: string
    runtimeDeletedRowCondition?: string | null
    runtimeRestoreSetClause?: string | null
}): Promise<void> => {
    const values: unknown[] = []
    const setClauses: string[] = []
    const restoringDeletedRow = Boolean(params.runtimeDeletedRowCondition && params.runtimeRestoreSetClause)
    if (restoringDeletedRow) {
        values.push(params.userId)
        setClauses.push(params.runtimeRestoreSetClause as string)
    }

    for (const columnName of params.dataColumns) {
        if (!IDENTIFIER_REGEX.test(columnName)) continue
        values.push(normalizeRuntimeTableChildInsertValueByMeta(params.row[columnName] ?? null, params.childAttrsByColumn.get(columnName)))
        setClauses.push(`${quoteIdentifier(columnName)} = $${values.length}`)
    }

    values.push(params.rowIndex)
    setClauses.push(`_tp_sort_order = $${values.length}`)
    if (!restoringDeletedRow) {
        setClauses.push('_upl_updated_at = NOW()')
        values.push(params.userId)
        setClauses.push(`_upl_updated_by = $${values.length}`)
    }
    setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')
    values.push(params.childRowId)
    const childRowIdParameter = values.length
    values.push(params.parentRowId)
    const parentRowIdParameter = values.length
    const rowCondition = restoringDeletedRow ? params.runtimeDeletedRowCondition : params.runtimeRowCondition

    const updated = (await params.executor.query(
        `
        UPDATE ${params.tabTableIdent}
        SET ${setClauses.join(', ')}
        WHERE id = $${childRowIdParameter}
          AND _tp_parent_id = $${parentRowIdParameter}
          AND ${rowCondition}
        RETURNING id
    `,
        values
    )) as Array<{ id: string }>

    if (updated.length !== 1) {
        throw new UpdateFailure(409, { error: 'TABLE child row changed while the record was being updated' })
    }
}

const deleteRuntimeTableChildRow = async (params: {
    executor: DbExecutor
    tabTableIdent: string
    parentRowId: string
    childRowId: string
    userId: string
    runtimeRowCondition: string
    runtimeDeleteSetClause: string | null
}): Promise<void> => {
    const updated = params.runtimeDeleteSetClause
        ? ((await params.executor.query(
              `
              UPDATE ${params.tabTableIdent}
              SET ${params.runtimeDeleteSetClause},
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE id = $2
                AND _tp_parent_id = $3
                AND ${params.runtimeRowCondition}
              RETURNING id
          `,
              [params.userId, params.childRowId, params.parentRowId]
          )) as Array<{ id: string }>)
        : ((await params.executor.query(
              `
              DELETE FROM ${params.tabTableIdent}
              WHERE id = $1
                AND _tp_parent_id = $2
                AND ${params.runtimeRowCondition}
              RETURNING id
          `,
              [params.childRowId, params.parentRowId]
          )) as Array<{ id: string }>)

    if (updated.length !== 1) {
        throw new UpdateFailure(409, { error: 'TABLE child row changed while the record was being updated' })
    }
}

export const replaceRuntimeTableChildRows = async (params: {
    executor: DbExecutor
    schemaIdent: string
    objectCollectionId: string
    userId: string
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
    runtimeRowCondition: string
    runtimeDeleteSetClause: string | null
    runtimeDeletedRowCondition: string | null
    runtimeRestoreSetClause: string | null
    parentRowId: string
    entries: RuntimeWriteTableDataEntry[]
}): Promise<void> => {
    for (const entry of params.entries) {
        const { tabTableName, rows: childRows, childAttrsByColumn } = entry
        const tabTableIdent = `${params.schemaIdent}.${quoteIdentifier(tabTableName)}`
        const validationContext = {
            object: { id: params.objectCollectionId },
            tableAttr: { codename: resolveRuntimeCodenameText(entry.cmp.codename) },
            childAttrs: entry.childAttrs,
            tabTableIdent
        }
        const generatedKeyAttrs = entry.childAttrs.filter(isGeneratedSiblingRowSelectKey)

        if (generatedKeyAttrs.length > 0) {
            const identityAttr = generatedKeyAttrs[0]
            if (
                !identityAttr ||
                generatedKeyAttrs.some((attr) => !IDENTIFIER_REGEX.test(attr.column_name) || attr.data_type.toUpperCase() !== 'STRING')
            ) {
                throw new UpdateFailure(400, { error: 'Invalid generated sibling row key metadata' })
            }

            const keyColumns = generatedKeyAttrs.map((attr) => quoteIdentifier(attr.column_name))
            const currentRows = (await params.executor.query(
                `
                SELECT id, ${keyColumns.join(', ')}
                FROM ${tabTableIdent}
                WHERE _tp_parent_id = $1
                  AND ${params.runtimeRowCondition}
                FOR UPDATE
            `,
                [params.parentRowId]
            )) as Array<Record<string, unknown> & { id: string }>

            const currentRowsByIdentity = new Map<string, Record<string, unknown> & { id: string }>()
            for (const row of currentRows) {
                const identity = row[identityAttr.column_name]
                if (typeof identity !== 'string' || !isUuidV7(identity)) {
                    throw new UpdateFailure(409, { error: 'Existing generated sibling row key is invalid' })
                }
                const identityKey = identity.toLowerCase()
                if (currentRowsByIdentity.has(identityKey)) {
                    throw new UpdateFailure(409, { error: 'Duplicate generated sibling row keys exist in this TABLE' })
                }
                for (const keyAttr of generatedKeyAttrs) {
                    const key = row[keyAttr.column_name]
                    if (typeof key !== 'string' || !isUuidV7(key)) {
                        throw new UpdateFailure(409, { error: 'Existing generated sibling row key is invalid' })
                    }
                }
                currentRowsByIdentity.set(identityKey, row)
            }

            const deletedRowsByIdentity = new Map<string, Record<string, unknown> & { id: string }>()
            if (params.runtimeDeletedRowCondition && params.runtimeRestoreSetClause) {
                const deletedRows = (await params.executor.query(
                    `
                    SELECT id, ${keyColumns.join(', ')}
                    FROM ${tabTableIdent}
                    WHERE _tp_parent_id = $1
                      AND ${params.runtimeDeletedRowCondition}
                    FOR UPDATE
                `,
                    [params.parentRowId]
                )) as Array<Record<string, unknown> & { id: string }>

                for (const row of deletedRows) {
                    const identity = row[identityAttr.column_name]
                    if (typeof identity !== 'string' || !isUuidV7(identity)) {
                        throw new UpdateFailure(409, { error: 'Existing generated sibling row key is invalid' })
                    }
                    const identityKey = identity.toLowerCase()
                    if (currentRowsByIdentity.has(identityKey) || deletedRowsByIdentity.has(identityKey)) {
                        throw new UpdateFailure(409, { error: 'Duplicate generated sibling row keys exist in this TABLE' })
                    }
                    for (const keyAttr of generatedKeyAttrs) {
                        const key = row[keyAttr.column_name]
                        if (typeof key !== 'string' || !isUuidV7(key)) {
                            throw new UpdateFailure(409, { error: 'Existing generated sibling row key is invalid' })
                        }
                    }
                    deletedRowsByIdentity.set(identityKey, row)
                }
            }

            const replacementRowsByIdentity = new Map<string, { row: Record<string, unknown>; rowIndex: number }>()
            for (const [rowIndex, row] of childRows.entries()) {
                for (const keyAttr of generatedKeyAttrs) {
                    const key = row[keyAttr.column_name]
                    if (typeof key !== 'string' || !isUuidV7(key)) {
                        throw new UpdateFailure(400, { error: 'Generated sibling row keys must be UUID v7 values' })
                    }
                    row[keyAttr.column_name] = key.toLowerCase()
                }
                const identity = row[identityAttr.column_name] as string
                const identityKey = identity.toLowerCase()
                if (replacementRowsByIdentity.has(identityKey)) {
                    throw new UpdateFailure(400, { error: 'Duplicate generated sibling row keys are not allowed' })
                }
                replacementRowsByIdentity.set(identityKey, { row, rowIndex })
            }

            const ignoredReferencingTables = new Set(params.entries.map((candidate) => candidate.tabTableName))
            for (const [identity, currentRow] of currentRowsByIdentity) {
                const replacement = replacementRowsByIdentity.get(identity)
                if (replacement) {
                    const changedKeyAttrs = generatedKeyAttrs.filter((keyAttr) => {
                        const currentKey = currentRow[keyAttr.column_name]
                        const replacementKey = replacement.row[keyAttr.column_name]
                        return typeof currentKey === 'string' && typeof replacementKey === 'string'
                            ? currentKey.toLowerCase() !== replacementKey.toLowerCase()
                            : currentKey !== replacementKey
                    })
                    if (changedKeyAttrs.length > 0) {
                        await assertSiblingRowKeyHasNoReferences(
                            params.executor,
                            params.schemaIdent,
                            { ...validationContext, childAttrs: changedKeyAttrs },
                            params.parentRowId,
                            params.runtimeRowCondition,
                            currentRow,
                            ignoredReferencingTables
                        )
                    }
                    continue
                }

                await assertSiblingRowKeyHasNoReferences(
                    params.executor,
                    params.schemaIdent,
                    validationContext,
                    params.parentRowId,
                    params.runtimeRowCondition,
                    currentRow,
                    ignoredReferencingTables
                )
            }

            const dataColumns = [...new Set(childRows.flatMap((row) => Object.keys(row).filter((column) => IDENTIFIER_REGEX.test(column))))]
            for (const [identity, currentRow] of currentRowsByIdentity) {
                const replacement = replacementRowsByIdentity.get(identity)
                if (replacement) {
                    await updateRuntimeTableChildRow({
                        executor: params.executor,
                        tabTableIdent,
                        parentRowId: params.parentRowId,
                        childRowId: currentRow.id,
                        row: replacement.row,
                        rowIndex: replacement.rowIndex,
                        dataColumns,
                        childAttrsByColumn,
                        userId: params.userId,
                        runtimeRowCondition: params.runtimeRowCondition
                    })
                } else {
                    await deleteRuntimeTableChildRow({
                        executor: params.executor,
                        tabTableIdent,
                        parentRowId: params.parentRowId,
                        childRowId: currentRow.id,
                        userId: params.userId,
                        runtimeRowCondition: params.runtimeRowCondition,
                        runtimeDeleteSetClause: params.runtimeDeleteSetClause
                    })
                }
            }

            const newRows: Array<Record<string, unknown>> = []
            const newSortOrders: number[] = []
            for (const [identity, replacement] of replacementRowsByIdentity) {
                if (currentRowsByIdentity.has(identity)) continue
                const deletedRow = deletedRowsByIdentity.get(identity)
                if (deletedRow) {
                    await updateRuntimeTableChildRow({
                        executor: params.executor,
                        tabTableIdent,
                        parentRowId: params.parentRowId,
                        childRowId: deletedRow.id,
                        row: replacement.row,
                        rowIndex: replacement.rowIndex,
                        dataColumns,
                        childAttrsByColumn,
                        userId: params.userId,
                        runtimeRowCondition: params.runtimeRowCondition,
                        runtimeDeletedRowCondition: params.runtimeDeletedRowCondition,
                        runtimeRestoreSetClause: params.runtimeRestoreSetClause
                    })
                    continue
                }
                newRows.push(replacement.row)
                newSortOrders.push(replacement.rowIndex)
            }
            if (newRows.length > 0) {
                await insertRuntimeChildRowsBatch({
                    executor: params.executor,
                    schemaIdent: params.schemaIdent,
                    tabTableName,
                    parentRowId: params.parentRowId,
                    childRows: newRows,
                    sortOrders: newSortOrders,
                    childAttrsByColumn,
                    workspacesEnabled: params.workspacesEnabled,
                    currentWorkspaceId: params.currentWorkspaceId,
                    userId: params.userId
                })
            }
            continue
        }

        if (params.runtimeDeleteSetClause) {
            await params.executor.query(
                `
          UPDATE ${tabTableIdent}
          SET ${params.runtimeDeleteSetClause},
              _upl_version = COALESCE(_upl_version, 1) + 1
          WHERE _tp_parent_id = $2
            AND ${params.runtimeRowCondition}
        `,
                [params.userId, params.parentRowId]
            )
        } else {
            await params.executor.query(
                `
          DELETE FROM ${tabTableIdent}
          WHERE _tp_parent_id = $1
            AND ${params.runtimeRowCondition}
        `,
                [params.parentRowId]
            )
        }

        if (childRows.length > 0) {
            await insertRuntimeChildRowsBatch({
                executor: params.executor,
                schemaIdent: params.schemaIdent,
                tabTableName,
                parentRowId: params.parentRowId,
                childRows,
                childAttrsByColumn,
                workspacesEnabled: params.workspacesEnabled,
                currentWorkspaceId: params.currentWorkspaceId,
                userId: params.userId
            })
        }
    }

    for (const entry of params.entries) {
        await validateSiblingRowSelectTargets(
            params.executor,
            params.schemaIdent,
            {
                object: { id: params.objectCollectionId },
                tableAttr: { codename: resolveRuntimeCodenameText(entry.cmp.codename) },
                childAttrs: entry.childAttrs,
                tabTableIdent: `${params.schemaIdent}.${quoteIdentifier(entry.tabTableName)}`
            },
            params.parentRowId,
            params.runtimeRowCondition,
            entry.rows.map((data) => ({ data })),
            { validateRequiredWithRows: true }
        )
    }

    for (const entry of params.entries) {
        await validateExistingSiblingRowSelectsForTarget(
            params.executor,
            params.schemaIdent,
            {
                object: { id: params.objectCollectionId },
                tableAttr: { codename: resolveRuntimeCodenameText(entry.cmp.codename) },
                childAttrs: entry.childAttrs,
                tabTableIdent: `${params.schemaIdent}.${quoteIdentifier(entry.tabTableName)}`
            },
            params.parentRowId,
            params.runtimeRowCondition
        )
    }
}
