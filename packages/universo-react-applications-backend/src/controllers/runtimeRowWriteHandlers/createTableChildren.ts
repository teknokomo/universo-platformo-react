import type { DbExecutor } from '@universo-react/utils'
import { generateUuidV7, isUuidV7 } from '@universo-react/utils'
import { generateChildTableName } from '@universo-react/schema-ddl'
import {
    IDENTIFIER_REGEX,
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
    normalizeRuntimeTableChildInsertValue,
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
    buildRuntimeSiblingRowAliases,
    getRuntimeSiblingRowAliasTarget,
    resolveRuntimeSiblingRowReference,
    type RuntimeSiblingRowAliasTarget
} from '../runtimeSiblingRowAliases'
import type { RuntimeTableChildAttrRow, RuntimeWriteTableDataEntryWithAttr } from './types'

export const prepareCreateTableChildRows = async (params: {
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
                if (!isUuidV7(siblingKey)) {
                    return {
                        kind: 'failure',
                        statusCode: 400,
                        body: { error: `Invalid generated sibling row key: ${childFieldPath}` }
                    }
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
            const { hasUserValue, value: childInputValue } = getRuntimeInputValue(rowData, cAttr.column_name, cAttr.codename)
            const resolvedSiblingReference = resolveRuntimeSiblingRowReference(
                childInputValue,
                cAttr,
                params.siblingRowAliases ?? new Map()
            )
            if ('error' in resolvedSiblingReference) {
                return { kind: 'failure', statusCode: 400, body: { error: resolvedSiblingReference.error } }
            }
            let cRaw = resolvedSiblingReference.value
            if (cAttr.ui_config?.siblingRowSelect && typeof cRaw === 'string' && isUuidV7(cRaw)) {
                cRaw = cRaw.toLowerCase()
            }

            if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasUserValue) {
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
                    return { kind: 'failure', statusCode: 400, body: { error: `Required field missing: ${childFieldPath}` } }
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

export const buildCreateTableEntries = async (params: {
    manager: DbExecutor
    schemaIdent: string
    data: Record<string, unknown>
    tableAttrs: RuntimeObjectCollectionAttr[]
}): Promise<
    { kind: 'ok'; entries: RuntimeWriteTableDataEntryWithAttr[] } | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const tableInputs: Array<{
        tableAttr: RuntimeObjectCollectionAttr
        childAttrs: RuntimeTableChildAttrRow[]
        childRows: Array<Record<string, unknown>>
        tabTableName: string
    }> = []

    for (const tAttr of params.tableAttrs) {
        const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
        const { value: raw } = getRuntimeInputValue(params.data, tAttr.column_name, tAttr.codename)
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

        if (childRows.length > 0) {
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
    }

    const aliasResult = buildRuntimeSiblingRowAliases(
        tableInputs.map((input) => ({
            tableCodename: resolveRuntimeCodenameText(input.tableAttr.codename),
            childAttrs: input.childAttrs,
            childRows: input.childRows
        }))
    )
    if ('error' in aliasResult) return { kind: 'failure', statusCode: 400, body: { error: aliasResult.error } }

    const tableDataEntries: RuntimeWriteTableDataEntryWithAttr[] = []
    for (const input of tableInputs) {
        const preparedResult = await prepareCreateTableChildRows({
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
            rows: preparedResult.rows,
            tabTableName: input.tabTableName,
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
