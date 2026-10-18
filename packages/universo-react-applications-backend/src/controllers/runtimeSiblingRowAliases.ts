import { generateUuidV7 } from '@universo-react/utils'
import { isRuntimeGeneratedSiblingRowKeyAttr } from '../services/runtimeRowSupport/contracts'

interface SiblingAliasChildAttr {
    codename: unknown
    data_type: string
    ui_config?: Record<string, unknown> | null
}

interface SiblingAliasTableInput {
    tableCodename: unknown
    childAttrs: SiblingAliasChildAttr[]
    childRows: unknown[]
}

export interface RuntimeSiblingRowAliasTarget {
    tableCodename: string
    valueFieldCodename: string
    key: string
}

const ROW_ALIAS_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

const getSiblingSelector = (attr: SiblingAliasChildAttr): { tableCodename: string; valueFieldCodename: string } | null => {
    const config = attr.ui_config?.siblingRowSelect
    if (!config || typeof config !== 'object' || Array.isArray(config)) return null
    const tableCodename = (config as Record<string, unknown>).tableCodename
    const valueFieldCodename = (config as Record<string, unknown>).valueFieldCodename
    if (typeof tableCodename !== 'string' || typeof valueFieldCodename !== 'string') return null
    return { tableCodename: tableCodename.trim(), valueFieldCodename: valueFieldCodename.trim() }
}

export const buildRuntimeSiblingRowAliases = (
    tables: SiblingAliasTableInput[]
): { aliases: Map<string, RuntimeSiblingRowAliasTarget> } | { error: string } => {
    const aliases = new Map<string, RuntimeSiblingRowAliasTarget>()

    for (const table of tables) {
        const tableCodename = typeof table.tableCodename === 'string' ? table.tableCodename.trim() : ''
        for (const row of table.childRows) {
            if (!row || typeof row !== 'object' || Array.isArray(row)) continue
            const rowData = row as Record<string, unknown>
            if (!Object.prototype.hasOwnProperty.call(rowData, '$rowAlias')) continue
            const alias = rowData.$rowAlias
            if (typeof alias !== 'string' || !ROW_ALIAS_PATTERN.test(alias)) {
                return { error: 'Invalid sibling row alias' }
            }
            if (aliases.has(alias)) return { error: 'Sibling row aliases must be unique within one request' }
            const generatedKeys = table.childAttrs.filter(isRuntimeGeneratedSiblingRowKeyAttr)
            if (!tableCodename || generatedKeys.length !== 1 || typeof generatedKeys[0]?.codename !== 'string') {
                return { error: 'Sibling row aliases require exactly one generated UUID v7 key field in the target TABLE' }
            }
            aliases.set(alias, {
                tableCodename,
                valueFieldCodename: generatedKeys[0].codename as string,
                key: generateUuidV7()
            })
        }
    }

    return { aliases }
}

export const resolveRuntimeSiblingRowReference = (
    value: unknown,
    attr: SiblingAliasChildAttr,
    aliases: ReadonlyMap<string, RuntimeSiblingRowAliasTarget>
): { value: unknown } | { error: string } => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, '$rowRef')) {
        return { value }
    }

    const reference = value as Record<string, unknown>
    if (Object.keys(reference).length !== 1 || typeof reference.$rowRef !== 'string' || !ROW_ALIAS_PATTERN.test(reference.$rowRef)) {
        return { error: 'Invalid sibling row reference' }
    }
    const target = aliases.get(reference.$rowRef)
    const selector = getSiblingSelector(attr)
    if (!target || !selector) return { error: 'Sibling row reference is unavailable for this field' }
    if (selector.tableCodename !== target.tableCodename || selector.valueFieldCodename !== target.valueFieldCodename) {
        return { error: 'Sibling row reference does not match this selector field' }
    }
    return { value: target.key }
}

export const getRuntimeSiblingRowAliasTarget = (
    row: Record<string, unknown>,
    aliases: ReadonlyMap<string, RuntimeSiblingRowAliasTarget>
): RuntimeSiblingRowAliasTarget | null => {
    const alias = row.$rowAlias
    return typeof alias === 'string' ? aliases.get(alias) ?? null : null
}
