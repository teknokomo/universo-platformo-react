import { readTabularSiblingSelectConfig, resolveTabularSiblingFieldValue, sortTabularSiblingRows } from './tabularSiblingRows'

type Row = Record<string, unknown>

export type TabularGroupingField = {
    id: string
    codename?: string | null
    label: string
    type: string
    uiConfig?: Record<string, unknown>
    childFields?: Array<{ id: string; codename?: string | null; uiConfig?: Record<string, unknown> }>
}

export type TabularGroupingTransition = {
    kind: 'group' | 'ungroup'
    tableLabel: string
    updates: Record<string, Row[]>
    /** False when optional-only stale references can be cleared without confirmation. */
    requiresConfirmation?: boolean
}

type TabularGroupingChildField = NonNullable<TabularGroupingField['childFields']>[number]

const createGroupingKeyNormalizer = (target: TabularGroupingField, valueFieldCodename: string) => {
    const valueField = target.childFields?.find((field) => field.codename === valueFieldCodename || field.id === valueFieldCodename)
    const isUuidKey = valueField?.uiConfig?.generateUuidV7 === true
    return (value: unknown): string | null => {
        if (typeof value !== 'string' || value.trim().length === 0) return null
        const key = value.trim()
        return isUuidKey ? key.toLowerCase() : key
    }
}

const readRows = (field: TabularGroupingField, values: Record<string, unknown>): Row[] => {
    const value = Object.prototype.hasOwnProperty.call(values, field.id)
        ? values[field.id]
        : field.codename
        ? values[field.codename]
        : undefined
    return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === 'object' && !Array.isArray(row)) : []
}

const readSelectorValue = (row: Row, field: TabularGroupingChildField): unknown => {
    for (const key of [field.id, field.codename]) {
        if (key && Object.prototype.hasOwnProperty.call(row, key)) return row[key]
    }
    return undefined
}

const selectorReferencesKey = (
    row: Row,
    field: TabularGroupingChildField,
    normalizeKey: (value: unknown) => string | null,
    keys: Set<string>
) =>
    [field.id, field.codename].some((key) => {
        if (!key || !Object.prototype.hasOwnProperty.call(row, key)) return false
        const selectedKey = normalizeKey(row[key])
        return selectedKey !== null && keys.has(selectedKey)
    })

/** Returns target TABLE ids that contain duplicate sibling-selection keys. */
export const getDuplicateTabularGroupingTargetIds = (
    fields: readonly TabularGroupingField[],
    values: Record<string, unknown>
): string[] => {
    const duplicateTargets = new Set<string>()
    for (const source of fields) {
        if (source.type !== 'TABLE') continue
        for (const selector of source.childFields ?? []) {
            const config = readTabularSiblingSelectConfig(selector)
            if (!config) continue
            const target = fields.find((field) => field.type === 'TABLE' && field.codename === config.tableCodename)
            if (!target) continue
            const normalizeKey = createGroupingKeyNormalizer(target, config.valueFieldCodename)
            const keys = new Set<string>()
            for (const row of readRows(target, values)) {
                const key = normalizeKey(resolveTabularSiblingFieldValue(row, target.childFields ?? [], config.valueFieldCodename))
                if (key === null) continue
                if (keys.has(key)) duplicateTargets.add(target.id)
                else keys.add(key)
            }
        }
    }

    return fields.filter((field) => duplicateTargets.has(field.id)).map((field) => field.id)
}

/** Returns target TABLE ids that have no source rows referring to their semantic keys. */
export const getUnreferencedTabularGroupingTargetIds = (
    fields: readonly TabularGroupingField[],
    values: Record<string, unknown>
): string[] => {
    const invalidTargets = new Set<string>()

    for (const source of fields) {
        if (source.type !== 'TABLE') continue
        const sourceRows = readRows(source, values)
        for (const selector of source.childFields ?? []) {
            const rawConfig = selector.uiConfig?.siblingRowSelect
            if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) continue
            if ((rawConfig as Record<string, unknown>).requireEachTargetReferenced !== true) continue
            const config = readTabularSiblingSelectConfig(selector)
            if (!config) continue
            const target = fields.find((field) => field.type === 'TABLE' && field.codename === config.tableCodename)
            if (!target) continue
            const normalizeKey = createGroupingKeyNormalizer(target, config.valueFieldCodename)
            const targets = readRows(target, values)
            if (targets.length === 0) continue
            const referencedKeys = new Set(
                sourceRows
                    .map((row) => readSelectorValue(row, selector))
                    .map(normalizeKey)
                    .filter((value): value is string => value !== null)
            )
            const allTargetKeys = targets.map((row) =>
                normalizeKey(resolveTabularSiblingFieldValue(row, target.childFields ?? [], config.valueFieldCodename))
            )
            if (allTargetKeys.some((key) => key === null || !referencedKeys.has(key))) {
                invalidTargets.add(target.id)
            }
        }
    }

    return fields.filter((field) => invalidTargets.has(field.id)).map((field) => field.id)
}

/** Returns source TABLE ids containing a missing required selector or a stale sibling key. */
export const getInvalidTabularSiblingSourceIds = (fields: readonly TabularGroupingField[], values: Record<string, unknown>): string[] => {
    const invalidSources = new Set<string>()

    for (const source of fields) {
        if (source.type !== 'TABLE') continue
        const sourceRows = readRows(source, values)
        for (const selector of source.childFields ?? []) {
            const config = readTabularSiblingSelectConfig(selector)
            if (!config) continue
            const target = fields.find((field) => field.type === 'TABLE' && field.codename === config.tableCodename)
            if (!target) continue
            const normalizeKey = createGroupingKeyNormalizer(target, config.valueFieldCodename)
            const targetKeys = new Set(
                readRows(target, values)
                    .map((row) => normalizeKey(resolveTabularSiblingFieldValue(row, target.childFields ?? [], config.valueFieldCodename)))
                    .filter((key): key is string => key !== null)
            )
            const rawConfig = selector.uiConfig?.siblingRowSelect
            const requiredWithRows =
                rawConfig !== null &&
                typeof rawConfig === 'object' &&
                !Array.isArray(rawConfig) &&
                (rawConfig as Record<string, unknown>).requiredWithRows === true
            for (const row of sourceRows) {
                const value = readSelectorValue(row, selector)
                if (value === null || value === undefined || value === '') {
                    if (requiredWithRows && targetKeys.size > 0) invalidSources.add(source.id)
                    continue
                }
                if (typeof value !== 'string' || !targetKeys.has(normalizeKey(value)!)) invalidSources.add(source.id)
            }
        }
    }

    return fields.filter((field) => invalidSources.has(field.id)).map((field) => field.id)
}

/** Lists TABLE fields whose rows must be loaded together before grouping edits are enabled. */
export const getTabularGroupingFieldIds = (fields: readonly TabularGroupingField[]): string[] => {
    const ids = new Set<string>()
    for (const source of fields) {
        if (source.type !== 'TABLE') continue
        for (const selector of source.childFields ?? []) {
            const config = readTabularSiblingSelectConfig(selector)
            if (!config) continue
            const target = fields.find((field) => field.type === 'TABLE' && field.codename === config.tableCodename)
            if (!target) continue
            ids.add(source.id)
            ids.add(target.id)
        }
    }
    return fields.filter((field) => ids.has(field.id)).map((field) => field.id)
}

/** Plan a grouping boundary change without mutating either TABLE before confirmation. */
export const planTabularGroupingTransition = (
    fields: readonly TabularGroupingField[],
    values: Record<string, unknown>,
    changedFieldId: string,
    nextRows: Row[]
): TabularGroupingTransition | null => {
    const target = fields.find((field) => field.id === changedFieldId && field.type === 'TABLE')
    if (!target?.codename) return null
    const previousRows = readRows(target, values)
    const hadRows = previousRows.length > 0
    const hasRows = nextRows.length > 0
    if (hadRows === hasRows) return null

    const updates: Record<string, Row[]> = { [target.id]: nextRows }
    let dependentRowCount = 0
    let hasRequiredGroupingRelationship = false
    let hasOptionalReferencesToRemove = false
    const normalizeTargetKey = (valueFieldCodename: string) => createGroupingKeyNormalizer(target, valueFieldCodename)
    for (const field of fields) {
        if (field.type !== 'TABLE' || field.id === target.id) continue
        const rows = readRows(field, values)
        for (const selector of field.childFields ?? []) {
            const config = readTabularSiblingSelectConfig(selector)
            const rawConfig = selector.uiConfig?.siblingRowSelect
            if (config?.tableCodename !== target.codename || !rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig))
                continue

            const requiredWithRows = (rawConfig as Record<string, unknown>).requiredWithRows === true
            if (requiredWithRows) hasRequiredGroupingRelationship = true
            if (rows.length === 0) continue

            if (hasRows) {
                if (!requiredWithRows) continue
                const orderedTargets = sortTabularSiblingRows(nextRows, target.uiConfig?.rowOrdering, target.childFields ?? [])
                const key = resolveTabularSiblingFieldValue(orderedTargets[0], target.childFields ?? [], config.valueFieldCodename)
                if (typeof key !== 'string' || !key) return null
                updates[field.id] = (updates[field.id] ?? rows).map((row: Row) => ({
                    ...row,
                    [selector.id]: key,
                    ...(selector.codename && Object.prototype.hasOwnProperty.call(row, selector.codename)
                        ? { [selector.codename]: key }
                        : {})
                }))
                dependentRowCount += rows.length
                continue
            }

            const normalizeKey = normalizeTargetKey(config.valueFieldCodename)
            const removedKeys = new Set(
                previousRows
                    .map((row) => normalizeKey(resolveTabularSiblingFieldValue(row, target.childFields ?? [], config.valueFieldCodename)))
                    .filter((key): key is string => key !== null)
            )
            if (removedKeys.size === 0) continue
            const currentRows = updates[field.id] ?? rows
            let clearedAnyReference = false
            const nextSourceRows = currentRows.map((row) => {
                if (!selectorReferencesKey(row, selector, normalizeKey, removedKeys)) return row
                clearedAnyReference = true
                return {
                    ...row,
                    [selector.id]: null,
                    ...(selector.codename && Object.prototype.hasOwnProperty.call(row, selector.codename)
                        ? { [selector.codename]: null }
                        : {})
                }
            })
            if (clearedAnyReference) updates[field.id] = nextSourceRows
            if (clearedAnyReference && !requiredWithRows) hasOptionalReferencesToRemove = true
        }
    }
    const requiresConfirmation = dependentRowCount > 0 || (hadRows && !hasRows && hasRequiredGroupingRelationship)
    return requiresConfirmation || (!hasRows && hasOptionalReferencesToRemove)
        ? { kind: hasRows ? 'group' : 'ungroup', tableLabel: target.label, updates, requiresConfirmation }
        : null
}
