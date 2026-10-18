import { generateChildTableName } from '@universo-react/schema-ddl'
import { generateUuidV7, isUuidV7, type DbExecutor } from '@universo-react/utils'
import { isRuntimeGeneratedSiblingRowKeyAttr } from '../services/runtimeRowSupport/contracts'
import {
    IDENTIFIER_REGEX,
    UpdateFailure,
    getRuntimeInputValue,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    runtimeCodenameTextSql
} from '../shared/runtimeHelpers'
import type { resolveTabularContext } from '../shared/runtimeHelpers'

type TabularContext = Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>

interface SiblingValidationChildAttr {
    id: string
    codename: unknown
    column_name: string
    data_type: string
    ui_config?: Record<string, unknown> | null
}

interface SiblingValidationContext {
    object: { id: string }
    tableAttr: { codename: unknown }
    childAttrs: SiblingValidationChildAttr[]
    tabTableIdent: string
}

interface SiblingRowSelectConfig {
    tableCodename: string
    valueFieldCodename: string
    requiredWithRows?: boolean
    requireEachTargetReferenced?: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeUuidV7Key = (value: unknown): string | null => (typeof value === 'string' && isUuidV7(value) ? value.toLowerCase() : null)

export const isGeneratedSiblingRowSelectKey = (attr: SiblingValidationChildAttr): boolean => isRuntimeGeneratedSiblingRowKeyAttr(attr)

const getSiblingRowSelectConfig = (attr: SiblingValidationChildAttr): SiblingRowSelectConfig | null => {
    const value = attr.ui_config?.siblingRowSelect
    if (value === undefined || value === null) return null
    if (
        !isRecord(value) ||
        typeof value.tableCodename !== 'string' ||
        !value.tableCodename.trim() ||
        typeof value.valueFieldCodename !== 'string' ||
        !value.valueFieldCodename.trim()
    ) {
        throw new UpdateFailure(400, { error: 'Invalid sibling row selection metadata' })
    }
    return {
        tableCodename: value.tableCodename.trim(),
        valueFieldCodename: value.valueFieldCodename.trim(),
        requiredWithRows: value.requiredWithRows === true,
        requireEachTargetReferenced: value.requireEachTargetReferenced === true
    }
}

const resolveSiblingValueTarget = async (
    manager: DbExecutor,
    schemaIdent: string,
    tc: SiblingValidationContext,
    config: SiblingRowSelectConfig
): Promise<{ tableIdent: string; valueColumn: string }> => {
    const tables = (await manager.query(
        `
        SELECT id, column_name
        FROM ${schemaIdent}._app_components
        WHERE object_id = $1
          AND ${runtimeCodenameTextSql('codename')} = $2
          AND data_type = 'TABLE'
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        LIMIT 1
    `,
        [tc.object.id, config.tableCodename]
    )) as Array<{ id: string; column_name?: string | null }>

    const table = tables[0]
    if (!table) throw new UpdateFailure(400, { error: 'Sibling row selection target table does not exist' })
    const tableName =
        typeof table.column_name === 'string' && IDENTIFIER_REGEX.test(table.column_name)
            ? table.column_name
            : generateChildTableName(table.id)
    if (!IDENTIFIER_REGEX.test(tableName)) throw new UpdateFailure(400, { error: 'Invalid sibling row selection target table' })

    const fields = (await manager.query(
        `
        SELECT column_name, data_type, ui_config
        FROM ${schemaIdent}._app_components
        WHERE parent_component_id = $1
          AND ${runtimeCodenameTextSql('codename')} = $2
          AND _upl_deleted = false
          AND _app_deleted = false
        LIMIT 1
    `,
        [table.id, config.valueFieldCodename]
    )) as Array<{ column_name?: string | null; data_type?: string; ui_config?: unknown }>

    const field = fields[0]
    if (!field || typeof field.column_name !== 'string' || !IDENTIFIER_REGEX.test(field.column_name)) {
        throw new UpdateFailure(400, { error: 'Sibling row selection target field does not exist' })
    }
    let uiConfig: Record<string, unknown> | null = null
    if (isRecord(field.ui_config)) uiConfig = field.ui_config
    else if (typeof field.ui_config === 'string') {
        try {
            const parsed: unknown = JSON.parse(field.ui_config)
            if (isRecord(parsed)) uiConfig = parsed
        } catch {
            throw new UpdateFailure(400, { error: 'Invalid sibling row selection target field metadata' })
        }
    }
    if (field.data_type?.toUpperCase() !== 'STRING' || uiConfig?.siblingRowSelectKey !== true || uiConfig.generateUuidV7 !== true) {
        throw new UpdateFailure(400, { error: 'Sibling row selection must target a generated UUID v7 key field' })
    }

    return {
        tableIdent: `${schemaIdent}.${quoteIdentifier(tableName)}`,
        valueColumn: field.column_name
    }
}

/** Validate sibling selectors and server-generated keys before child-row writes. */
export const validateSiblingRowSelectTargets = async (
    manager: DbExecutor,
    schemaIdent: string,
    tc: SiblingValidationContext,
    recordId: string,
    runtimeRowCondition: string,
    updates: Array<{ childRowId?: string; data: Record<string, unknown> }>,
    options: { isCreate?: boolean; validateRequiredWithRows?: boolean; checkGeneratedKeyUniqueness?: boolean } = {}
): Promise<void> => {
    for (const attr of tc.childAttrs) {
        if (!isGeneratedSiblingRowSelectKey(attr)) continue
        for (const update of updates) {
            const input = getRuntimeInputValue(update.data, attr.column_name, attr.codename)
            if (!input.hasUserValue) continue
            if (typeof input.value !== 'string' || !isUuidV7(input.value)) {
                throw new UpdateFailure(400, { error: 'Generated sibling row keys must be UUID v7 values' })
            }
            if (options.checkGeneratedKeyUniqueness ?? options.isCreate === true) {
                const existing = (await manager.query(
                    `
                    SELECT id
                    FROM ${tc.tabTableIdent}
                    WHERE _tp_parent_id = $1
                      AND ${runtimeRowCondition}
                      AND ${quoteIdentifier(attr.column_name)} = $2
                    LIMIT 1
                `,
                    [recordId, input.value]
                )) as Array<{ id: string }>
                if (existing.length > 0) throw new UpdateFailure(409, { error: 'Generated sibling row key already exists' })
            }
        }
    }

    for (const attr of tc.childAttrs) {
        const config = getSiblingRowSelectConfig(attr)
        if (!config) continue
        const enforceRequiredWithRows =
            config.requiredWithRows === true && (options.isCreate === true || options.validateRequiredWithRows === true)
        const shouldValidateTarget =
            updates.some((update) => getRuntimeInputValue(update.data, attr.column_name, attr.codename).hasUserValue) ||
            enforceRequiredWithRows
        if (!shouldValidateTarget) continue
        const resolvedTarget = await resolveSiblingValueTarget(manager, schemaIdent, tc, config)

        for (const update of updates) {
            const input = getRuntimeInputValue(update.data, attr.column_name, attr.codename)
            const rawValue = input.hasUserValue ? input.value : undefined
            const value = rawValue === null || rawValue === '' ? null : rawValue
            if (value === undefined || value === null) {
                if (!config.requiredWithRows || (!enforceRequiredWithRows && !input.hasUserValue)) continue
                const targetRows = (await manager.query(
                    `
                    SELECT 1
                    FROM ${resolvedTarget.tableIdent}
                    WHERE _tp_parent_id = $1
                      AND ${runtimeRowCondition}
                    LIMIT 1
                `,
                    [recordId]
                )) as Array<Record<string, unknown>>
                if (targetRows.length > 0) {
                    throw new UpdateFailure(400, { error: 'A sibling row selection is required while target rows exist' })
                }
                continue
            }
            const normalizedValue = normalizeUuidV7Key(value)
            if (normalizedValue === null) {
                throw new UpdateFailure(400, { error: 'Sibling row selection must reference a UUID v7 key' })
            }
            const targetRows = (await manager.query(
                `
                SELECT 1
                FROM ${resolvedTarget.tableIdent}
                WHERE _tp_parent_id = $1
                  AND ${runtimeRowCondition}
                  AND ${quoteIdentifier(resolvedTarget.valueColumn)} = $2
                LIMIT 1
            `,
                [recordId, normalizedValue]
            )) as Array<Record<string, unknown>>
            if (targetRows.length === 0) {
                throw new UpdateFailure(400, {
                    code: 'RUNTIME_SIBLING_TARGET_MISSING',
                    error: 'Sibling row selection target is unavailable'
                })
            }
        }
    }
}

/** Revalidate persisted dependent rows after sibling target rows are added or replaced. */
export const validateExistingSiblingRowSelectsForTarget = async (
    manager: DbExecutor,
    schemaIdent: string,
    tc: SiblingValidationContext,
    recordId: string,
    runtimeRowCondition: string
): Promise<void> => {
    for (const keyAttr of tc.childAttrs.filter(isGeneratedSiblingRowSelectKey)) {
        if (keyAttr.data_type.toUpperCase() !== 'STRING' || typeof keyAttr.codename !== 'string') {
            throw new UpdateFailure(400, { error: 'Invalid generated sibling row key metadata' })
        }
        const target = await resolveSiblingValueTarget(manager, schemaIdent, tc, {
            tableCodename: resolveRuntimeCodenameText(tc.tableAttr.codename),
            valueFieldCodename: keyAttr.codename
        })
        const targetRows = (await manager.query(
            `SELECT ${quoteIdentifier(target.valueColumn)} FROM ${target.tableIdent} WHERE _tp_parent_id = $1 AND ${runtimeRowCondition}`,
            [recordId]
        )) as Array<Record<string, unknown>>
        const targetKeys = new Set(
            targetRows
                .map((row) => row[target.valueColumn])
                .map(normalizeUuidV7Key)
                .filter((value): value is string => value !== null)
        )

        const selectors = (await manager.query(
            `
            SELECT parent.column_name AS table_name,
                   child.column_name AS value_column,
                   child.ui_config->'siblingRowSelect'->>'requiredWithRows' AS required_with_rows,
                   child.ui_config->'siblingRowSelect'->>'requireEachTargetReferenced' AS require_each_target_referenced
            FROM ${schemaIdent}._app_components AS parent
            JOIN ${schemaIdent}._app_components AS child
              ON child.parent_component_id = parent.id
            WHERE parent.object_id = $1
              AND parent.data_type = 'TABLE'
              AND parent.parent_component_id IS NULL
              AND parent._upl_deleted = false
              AND parent._app_deleted = false
              AND child._upl_deleted = false
              AND child._app_deleted = false
              AND child.ui_config->'siblingRowSelect'->>'tableCodename' = $2
              AND child.ui_config->'siblingRowSelect'->>'valueFieldCodename' = $3
              AND child.data_type = 'STRING'
        `,
            [tc.object.id, resolveRuntimeCodenameText(tc.tableAttr.codename), keyAttr.codename]
        )) as Array<{
            table_name?: string | null
            value_column?: string | null
            required_with_rows?: string | null
            require_each_target_referenced?: string | null
        }>

        for (const selector of selectors) {
            if (
                typeof selector.table_name !== 'string' ||
                !IDENTIFIER_REGEX.test(selector.table_name) ||
                typeof selector.value_column !== 'string' ||
                !IDENTIFIER_REGEX.test(selector.value_column)
            ) {
                throw new UpdateFailure(400, { error: 'Invalid sibling row reference metadata' })
            }
            const selectorTableIdent = `${schemaIdent}.${quoteIdentifier(selector.table_name)}`
            const selectorRows = (await manager.query(
                `SELECT ${quoteIdentifier(
                    selector.value_column
                )} FROM ${selectorTableIdent} WHERE _tp_parent_id = $1 AND ${runtimeRowCondition}`,
                [recordId]
            )) as Array<Record<string, unknown>>
            const requiredWithRows = selector.required_with_rows === 'true'
            const requireEachTargetReferenced = selector.require_each_target_referenced === 'true'
            const referencedKeys = new Set<string>()
            for (const selectorRow of selectorRows) {
                const value = selectorRow[selector.value_column]
                if ((value === null || value === undefined || value === '') && requiredWithRows && targetKeys.size > 0) {
                    throw new UpdateFailure(400, { error: 'A sibling row selection is required while target rows exist' })
                }
                if (value === null || value === undefined || value === '') continue
                const normalizedValue = normalizeUuidV7Key(value)
                if (normalizedValue === null || !targetKeys.has(normalizedValue)) {
                    throw new UpdateFailure(400, {
                        code: 'RUNTIME_SIBLING_TARGET_MISSING',
                        error: 'Sibling row selection target is unavailable'
                    })
                }
                referencedKeys.add(normalizedValue)
            }
            if (requireEachTargetReferenced) {
                for (const targetKey of targetKeys) {
                    if (referencedKeys.has(targetKey)) continue
                    throw new UpdateFailure(400, {
                        code: 'RUNTIME_SIBLING_TARGET_UNREFERENCED',
                        error: 'Every sibling target row must be referenced by at least one source row'
                    })
                }
            }
        }
    }

    await validateRequiredSiblingTargetCoverageForSource(manager, schemaIdent, tc, recordId, runtimeRowCondition)
}

/** Rejects source row mutations that leave a configured sibling target without any references. */
const validateRequiredSiblingTargetCoverageForSource = async (
    manager: DbExecutor,
    schemaIdent: string,
    tc: SiblingValidationContext,
    recordId: string,
    runtimeRowCondition: string
): Promise<void> => {
    for (const attr of tc.childAttrs) {
        const config = getSiblingRowSelectConfig(attr)
        if (!config?.requireEachTargetReferenced) continue
        if (attr.data_type.toUpperCase() !== 'STRING' || !IDENTIFIER_REGEX.test(attr.column_name)) {
            throw new UpdateFailure(400, { error: 'Invalid sibling row selection metadata' })
        }

        const target = await resolveSiblingValueTarget(manager, schemaIdent, tc, config)
        const targetRows = (await manager.query(
            `SELECT ${quoteIdentifier(target.valueColumn)} FROM ${target.tableIdent} WHERE _tp_parent_id = $1 AND ${runtimeRowCondition}`,
            [recordId]
        )) as Array<Record<string, unknown>>
        const targetKeys = new Set(
            targetRows
                .map((row) => row[target.valueColumn])
                .map(normalizeUuidV7Key)
                .filter((value): value is string => value !== null)
        )
        const sourceRows = (await manager.query(
            `SELECT ${quoteIdentifier(attr.column_name)} FROM ${tc.tabTableIdent} WHERE _tp_parent_id = $1 AND ${runtimeRowCondition}`,
            [recordId]
        )) as Array<Record<string, unknown>>
        const referencedKeys = new Set(
            sourceRows
                .map((row) => row[attr.column_name])
                .map(normalizeUuidV7Key)
                .filter((value): value is string => value !== null)
        )

        for (const targetKey of targetKeys) {
            if (referencedKeys.has(targetKey)) continue
            throw new UpdateFailure(400, {
                code: 'RUNTIME_SIBLING_TARGET_UNREFERENCED',
                error: 'Every sibling target row must be referenced by at least one source row'
            })
        }
    }
}

/** Prevent removing a generated sibling key while another active child row refers to it. */
export const assertSiblingRowKeyHasNoReferences = async (
    manager: DbExecutor,
    schemaIdent: string,
    tc: SiblingValidationContext,
    recordId: string,
    runtimeRowCondition: string,
    row: Record<string, unknown>,
    ignoredReferencingTableNames: ReadonlySet<string> = new Set()
): Promise<void> => {
    const keyAttrs = tc.childAttrs.filter(isGeneratedSiblingRowSelectKey)
    for (const keyAttr of keyAttrs) {
        const key = row[keyAttr.column_name]
        if (typeof key !== 'string' || !isUuidV7(key)) {
            throw new UpdateFailure(400, { error: 'Invalid generated sibling row key' })
        }
        const references = (await manager.query(
            `
            SELECT parent.column_name AS table_name,
                   child.column_name AS value_column
            FROM ${schemaIdent}._app_components AS parent
            JOIN ${schemaIdent}._app_components AS child
              ON child.parent_component_id = parent.id
            WHERE parent.object_id = $1
              AND parent.data_type = 'TABLE'
              AND parent.parent_component_id IS NULL
              AND parent._upl_deleted = false
              AND parent._app_deleted = false
              AND child._upl_deleted = false
              AND child._app_deleted = false
              AND child.ui_config->'siblingRowSelect'->>'tableCodename' = $2
              AND child.ui_config->'siblingRowSelect'->>'valueFieldCodename' = $3
              AND child.data_type = 'STRING'
        `,
            [tc.object.id, tc.tableAttr.codename, keyAttr.codename]
        )) as Array<{ table_name?: string | null; value_column?: string | null }>

        for (const reference of references) {
            if (
                typeof reference.table_name !== 'string' ||
                !IDENTIFIER_REGEX.test(reference.table_name) ||
                typeof reference.value_column !== 'string' ||
                !IDENTIFIER_REGEX.test(reference.value_column)
            ) {
                throw new UpdateFailure(400, { error: 'Invalid sibling row reference metadata' })
            }
            if (ignoredReferencingTableNames.has(reference.table_name)) continue
            const referenced = (await manager.query(
                `
                SELECT 1
                FROM ${schemaIdent}.${quoteIdentifier(reference.table_name)}
                WHERE _tp_parent_id = $1
                  AND ${runtimeRowCondition}
                  AND LOWER(${quoteIdentifier(reference.value_column)}) = $2
                LIMIT 1
            `,
                [recordId, key.toLowerCase()]
            )) as Array<Record<string, unknown>>
            if (referenced.length > 0) {
                throw new UpdateFailure(409, {
                    code: 'RUNTIME_SIBLING_TARGET_IN_USE',
                    error: 'Reassign or remove related rows before deleting this group'
                })
            }
        }
    }
}

export const prepareGeneratedSiblingRowKeys = (tc: TabularContext, data: Record<string, unknown>): Record<string, unknown> => {
    const prepared = { ...data }
    for (const attr of tc.childAttrs) {
        if (!isGeneratedSiblingRowSelectKey(attr)) continue
        const key = generateUuidV7()
        prepared[attr.column_name] = key
        prepared[attr.codename] = key
    }
    return prepared
}
