import { type DbExecutor } from '@universo-react/utils'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { type RolePermission } from '../../routes/guards'
import {
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    formatRuntimeFieldLabel,
    buildRuntimeActiveRowCondition
} from '../../shared/runtimeHelpers'
import {
    type RuntimeDateOffsetDerivationRule,
    type RuntimeDateOrderRule,
    type RuntimeFieldCondition,
    type RuntimeObjectCollectionAttr,
    type RuntimeRequiredWhenRule
} from './contracts'
import {
    buildRuntimeAttrLookup,
    findRuntimeAttrByFieldKey,
    loadRuntimeObjectAttrs,
    readRuntimeAttrStringValue,
    readRuntimeAttrValue,
    resolveRuntimeObjectByCodename,
    resolveRuntimeObjectCollectionByCodename
} from './objects'
import {
    buildRuntimeRecordAccessClause,
    isRecordValue,
    readRuntimeRecordParentAccessConfigs,
    readRuntimeRecordPickerReferenceConfig
} from './access'

export const readRuntimeDateOrderRules = (config: Record<string, unknown> | null | undefined): RuntimeDateOrderRule[] => {
    const validationRoot = isRecordValue(config?.runtimeValidations)
        ? config.runtimeValidations
        : isRecordValue(config?.runtimeValidation)
        ? config.runtimeValidation
        : null
    const rawRules = Array.isArray(validationRoot?.dateOrder) ? validationRoot.dateOrder : []

    return rawRules.flatMap((rawRule): RuntimeDateOrderRule[] => {
        if (!isRecordValue(rawRule)) return []
        const startField = typeof rawRule.startField === 'string' ? rawRule.startField.trim() : ''
        const endField = typeof rawRule.endField === 'string' ? rawRule.endField.trim() : ''
        if (!startField || !endField) return []

        return [
            {
                startField,
                endField,
                allowEqual: rawRule.allowEqual !== false,
                message: typeof rawRule.message === 'string' && rawRule.message.trim().length > 0 ? rawRule.message.trim() : undefined
            }
        ]
    })
}

export const readRuntimeFieldCondition = (value: unknown): RuntimeFieldCondition | null => {
    if (!isRecordValue(value)) return null
    const rawField = value.field ?? value.fieldId ?? value.codename
    if (typeof rawField !== 'string' || rawField.trim().length === 0) return null

    const condition: RuntimeFieldCondition = { field: rawField.trim() }
    if ('equals' in value) condition.equals = value.equals
    if ('value' in value && !('equals' in value)) condition.equals = value.value
    if ('notEquals' in value) condition.notEquals = value.notEquals
    if (Array.isArray(value.in)) condition.in = value.in
    if (Array.isArray(value.notIn)) condition.notIn = value.notIn
    return condition
}

export const readRuntimeRequiredWhenRules = (config: Record<string, unknown> | null | undefined): RuntimeRequiredWhenRule[] => {
    const validationRoot = isRecordValue(config?.runtimeValidations)
        ? config.runtimeValidations
        : isRecordValue(config?.runtimeValidation)
        ? config.runtimeValidation
        : null
    const rawRules = Array.isArray(validationRoot?.requiredWhen) ? validationRoot.requiredWhen : []

    return rawRules.flatMap((rawRule): RuntimeRequiredWhenRule[] => {
        if (!isRecordValue(rawRule)) return []
        const rawField = rawRule.field ?? rawRule.fieldId ?? rawRule.codename
        const field = typeof rawField === 'string' ? rawField.trim() : ''
        const when = readRuntimeFieldCondition(rawRule.when)
        if (!field || !when) return []

        return [
            {
                field,
                when,
                message: typeof rawRule.message === 'string' && rawRule.message.trim().length > 0 ? rawRule.message.trim() : undefined
            }
        ]
    })
}

export const readRuntimeDateOffsetDerivationRules = (
    config: Record<string, unknown> | null | undefined
): RuntimeDateOffsetDerivationRule[] => {
    const derivationRoot = isRecordValue(config?.runtimeDerivations)
        ? config.runtimeDerivations
        : isRecordValue(config?.runtimeDerivedFields)
        ? config.runtimeDerivedFields
        : null
    const rawRules = Array.isArray(derivationRoot?.dateOffset) ? derivationRoot.dateOffset : []

    return rawRules.flatMap((rawRule): RuntimeDateOffsetDerivationRule[] => {
        if (!isRecordValue(rawRule)) return []
        const targetField = typeof rawRule.targetField === 'string' ? rawRule.targetField.trim() : ''
        const startField = typeof rawRule.startField === 'string' ? rawRule.startField.trim() : ''
        const offsetDaysField = typeof rawRule.offsetDaysField === 'string' ? rawRule.offsetDaysField.trim() : ''
        if (!targetField || !startField || !offsetDaysField) return []

        const when = readRuntimeFieldCondition(rawRule.when)
        const clearWhen = readRuntimeFieldCondition(rawRule.clearWhen)

        return [
            {
                targetField,
                startField,
                offsetDaysField,
                when: when ?? undefined,
                clearWhen: clearWhen ?? undefined
            }
        ]
    })
}

export const runtimeValuesEqual = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true
    if (left == null || right == null) return false
    return String(left) === String(right)
}

export const runtimeValuePresent = (value: unknown): boolean => {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim().length > 0
    return true
}

export const matchesRuntimeFieldCondition = (
    condition: RuntimeFieldCondition,
    attrsByKey: Map<string, RuntimeObjectCollectionAttr>,
    row: Record<string, unknown>
): string | boolean => {
    const conditionAttr = attrsByKey.get(condition.field)
    if (!conditionAttr) return `Runtime required validation references missing field: ${condition.field}`

    const currentValue = readRuntimeAttrValue(row, conditionAttr)
    let hasOperator = false

    if ('equals' in condition) {
        hasOperator = true
        if (!runtimeValuesEqual(currentValue, condition.equals)) return false
    }

    if ('notEquals' in condition) {
        hasOperator = true
        if (runtimeValuesEqual(currentValue, condition.notEquals)) return false
    }

    if (condition.in) {
        hasOperator = true
        if (!condition.in.some((candidate) => runtimeValuesEqual(currentValue, candidate))) return false
    }

    if (condition.notIn) {
        hasOperator = true
        if (condition.notIn.some((candidate) => runtimeValuesEqual(currentValue, candidate))) return false
    }

    return hasOperator ? true : runtimeValuePresent(currentValue)
}

export const parseRuntimeDateValue = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    if (value instanceof Date) {
        return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    }
    if (typeof value !== 'string' && typeof value !== 'number') return Number.NaN

    const raw = String(value).trim()
    if (!raw) return Number.NaN
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
    if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1])
        const month = Number(dateOnlyMatch[2])
        const day = Number(dateOnlyMatch[3])
        const time = Date.UTC(year, month - 1, day)
        const date = new Date(time)
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : Number.NaN
    }

    const dateTime = new Date(raw)
    if (Number.isNaN(dateTime.getTime())) return Number.NaN
    return Date.UTC(dateTime.getUTCFullYear(), dateTime.getUTCMonth(), dateTime.getUTCDate())
}

export const formatRuntimeDateOnly = (time: number): string => new Date(time).toISOString().slice(0, 10)

export const addRuntimeDateOnlyDays = (time: number, days: number): string => {
    const date = new Date(time)
    date.setUTCDate(date.getUTCDate() + days)
    return formatRuntimeDateOnly(date.getTime())
}

export const readRuntimeOffsetDays = (value: unknown): number | null => {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : Number.NaN
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0 || numeric > 3650) return null
    return numeric
}

export const applyRuntimeDateOffsetDerivations = ({
    config,
    attrs,
    row
}: {
    config: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): { row: Record<string, unknown>; error: string | null } => {
    const rules = readRuntimeDateOffsetDerivationRules(config)
    if (rules.length === 0) return { row, error: null }

    const attrsByKey = buildRuntimeAttrLookup(attrs)
    const nextRow = { ...row }

    for (const rule of rules) {
        const targetAttr = attrsByKey.get(rule.targetField)
        const startAttr = attrsByKey.get(rule.startField)
        const offsetAttr = attrsByKey.get(rule.offsetDaysField)
        if (!targetAttr || !startAttr || !offsetAttr) {
            return {
                row,
                error: `Runtime date derivation references missing field: ${
                    !targetAttr ? rule.targetField : !startAttr ? rule.startField : rule.offsetDaysField
                }`
            }
        }
        if (targetAttr.data_type !== 'DATE' || startAttr.data_type !== 'DATE' || offsetAttr.data_type !== 'NUMBER') {
            return {
                row,
                error: `Runtime date derivation fields must be DATE, DATE, NUMBER: ${rule.targetField}, ${rule.startField}, ${rule.offsetDaysField}`
            }
        }

        if (rule.clearWhen) {
            const clearConditionResult = matchesRuntimeFieldCondition(rule.clearWhen, attrsByKey, nextRow)
            if (typeof clearConditionResult === 'string') return { row, error: clearConditionResult }
            if (clearConditionResult) {
                nextRow[targetAttr.column_name] = null
                continue
            }
        }

        if (rule.when) {
            const conditionResult = matchesRuntimeFieldCondition(rule.when, attrsByKey, nextRow)
            if (typeof conditionResult === 'string') return { row, error: conditionResult }
            if (!conditionResult) continue
        }

        const startValue = parseRuntimeDateValue(readRuntimeAttrValue(nextRow, startAttr))
        const offsetDays = readRuntimeOffsetDays(readRuntimeAttrValue(nextRow, offsetAttr))
        if (startValue === null || Number.isNaN(startValue)) {
            return { row, error: `Runtime date derivation requires valid date: ${formatRuntimeFieldLabel(startAttr.codename)}` }
        }
        if (offsetDays === null) {
            return { row, error: `Runtime date derivation requires valid day offset: ${formatRuntimeFieldLabel(offsetAttr.codename)}` }
        }

        nextRow[targetAttr.column_name] = addRuntimeDateOnlyDays(startValue, offsetDays)
    }

    return { row: nextRow, error: null }
}

export const validateRuntimeRequiredWhenRules = ({
    config,
    attrs,
    row
}: {
    config: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): string | null => {
    const requiredRules = readRuntimeRequiredWhenRules(config)
    if (requiredRules.length === 0) return null

    const attrsByKey = buildRuntimeAttrLookup(attrs)
    for (const rule of requiredRules) {
        const targetAttr = attrsByKey.get(rule.field)
        if (!targetAttr) {
            return `Runtime required validation references missing field: ${rule.field}`
        }

        const conditionResult = matchesRuntimeFieldCondition(rule.when, attrsByKey, row)
        if (typeof conditionResult === 'string') return conditionResult
        if (!conditionResult) continue

        const value = readRuntimeAttrValue(row, targetAttr)
        if (!runtimeValuePresent(value)) {
            const targetLabel = formatRuntimeFieldLabel(targetAttr.codename)
            const conditionLabel = formatRuntimeFieldLabel(rule.when.field)
            return rule.message ?? `Required field missing: ${targetLabel} is required when ${conditionLabel} matches`
        }
    }

    return null
}

export const validateRuntimeDateOrderRules = ({
    config,
    attrs,
    row
}: {
    config: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): string | null => {
    const dateOrderRules = readRuntimeDateOrderRules(config)
    if (dateOrderRules.length === 0) return null

    const attrsByKey = buildRuntimeAttrLookup(attrs)
    for (const rule of dateOrderRules) {
        const startAttr = attrsByKey.get(rule.startField)
        const endAttr = attrsByKey.get(rule.endField)
        if (!startAttr || !endAttr) {
            return `Runtime date validation references missing field: ${!startAttr ? rule.startField : rule.endField}`
        }
        if (startAttr.data_type !== 'DATE' || endAttr.data_type !== 'DATE') {
            return `Runtime date validation fields must be DATE fields: ${rule.startField}, ${rule.endField}`
        }

        const startValue = parseRuntimeDateValue(readRuntimeAttrValue(row, startAttr))
        const endValue = parseRuntimeDateValue(readRuntimeAttrValue(row, endAttr))
        if (endValue === null) continue

        const startLabel = formatRuntimeFieldLabel(startAttr.codename)
        const endLabel = formatRuntimeFieldLabel(endAttr.codename)

        if (startValue === null) {
            return rule.message ?? `Invalid date order: ${endLabel} requires ${startLabel}`
        }
        if (Number.isNaN(startValue) || Number.isNaN(endValue)) {
            return rule.message ?? `Invalid date order: ${startLabel} and ${endLabel} must contain valid dates`
        }

        const violatesOrder = rule.allowEqual ? endValue < startValue : endValue <= startValue
        if (violatesOrder) {
            return rule.message ?? `Invalid date order: ${endLabel} must be ${rule.allowEqual ? 'on or after' : 'after'} ${startLabel}`
        }
    }

    return null
}

export const validateRuntimeRecordPickerReferences = async ({
    manager,
    schemaIdent,
    currentWorkspaceId,
    currentUserId,
    permissions,
    attrs,
    row
}: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions: Record<RolePermission, boolean>
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): Promise<string | null> => {
    const attrsByKey = buildRuntimeAttrLookup(attrs)

    for (const attr of attrs) {
        const pickerConfig = readRuntimeRecordPickerReferenceConfig(attr)
        if (!pickerConfig) continue

        const targetAttr = attrsByKey.get(pickerConfig.targetObjectCodenameField)
        const targetObjectCodename = readRuntimeAttrStringValue(row, targetAttr)
        const targetRecordId = readRuntimeAttrStringValue(row, attr)

        if (!targetObjectCodename && !targetRecordId) continue
        if (!targetObjectCodename || !targetRecordId) {
            return `Invalid runtime record picker reference for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        if (pickerConfig.allowedObjectCodenames && !pickerConfig.allowedObjectCodenames.includes(targetObjectCodename)) {
            return `Unsupported target object for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        if (!UUID_REGEX.test(targetRecordId)) {
            return `Invalid target record ID for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        const targetObject = await resolveRuntimeObjectByCodename(manager, schemaIdent, targetObjectCodename, { includePages: true })
        if (!targetObject) {
            return `Target object not found for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        if (targetObject.kind === 'page') {
            if (targetObject.id !== targetRecordId) {
                return `Target record not found for ${formatRuntimeFieldLabel(attr.codename)}`
            }
            continue
        }

        if (!targetObject.table_name) {
            return `Target object not found for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        const targetAttrs = await loadRuntimeObjectAttrs(manager, schemaIdent, targetObject.id)
        const targetTableIdent = `${schemaIdent}.${quoteIdentifier(targetObject.table_name)}`
        const targetActiveCondition = buildRuntimeActiveRowCondition(
            targetObject.lifecycleContract,
            targetObject.config,
            undefined,
            currentWorkspaceId
        )
        const targetValues: unknown[] = [targetRecordId]
        const targetAccessClause = await buildRuntimeRecordAccessClause({
            manager,
            schemaIdent,
            currentWorkspaceId: currentWorkspaceId ?? null,
            currentUserId: currentUserId ?? null,
            permissions,
            objectCodename: resolveRuntimeCodenameText(targetObject.codename),
            attrs: targetAttrs,
            config: targetObject.config,
            outerRowIdSql: `${targetTableIdent}.id`,
            values: targetValues
        })
        const targetWhereSql = ['id = $1', targetActiveCondition, targetAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')
        const targetRows = (await manager.query(
            `
      SELECT id
      FROM ${targetTableIdent}
      WHERE ${targetWhereSql}
      LIMIT 1
    `,
            targetValues
        )) as Array<{ id: string }>

        if (!targetRows[0]?.id) {
            return `Target record not found for ${formatRuntimeFieldLabel(attr.codename)}`
        }
    }

    return null
}

export const validateRuntimeParentRecordAccessReferences = async ({
    manager,
    schemaIdent,
    currentWorkspaceId,
    currentUserId,
    permissions,
    objectConfig,
    attrs,
    row,
    minimumAccessLevel = 'edit'
}: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions: Record<RolePermission, boolean>
    objectConfig: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
    minimumAccessLevel?: 'read' | 'edit'
}): Promise<string | null> => {
    const parentAccessConfigs = readRuntimeRecordParentAccessConfigs(objectConfig)
    if (!parentAccessConfigs) return 'Parent record access metadata is invalid'
    if (parentAccessConfigs.length === 0) return null

    for (const parentAccessConfig of parentAccessConfigs) {
        const parentFieldAttr = findRuntimeAttrByFieldKey(attrs, parentAccessConfig.parentFieldCodename)
        const parentRecordId = readRuntimeAttrStringValue(row, parentFieldAttr)

        if (
            !parentFieldAttr ||
            parentFieldAttr.data_type !== 'REF' ||
            !IDENTIFIER_REGEX.test(parentFieldAttr.column_name) ||
            !parentRecordId ||
            !UUID_REGEX.test(parentRecordId)
        ) {
            return `Parent record is required for ${formatRuntimeFieldLabel(parentAccessConfig.parentFieldCodename)}`
        }

        const parentObject = await resolveRuntimeObjectCollectionByCodename(manager, schemaIdent, parentAccessConfig.parentObjectCodename)
        if (!parentObject || (parentFieldAttr.target_object_id && parentFieldAttr.target_object_id !== parentObject.id)) {
            return `Parent record target is invalid for ${formatRuntimeFieldLabel(parentAccessConfig.parentFieldCodename)}`
        }

        const parentTableIdent = `${schemaIdent}.${quoteIdentifier(parentObject.tableName)}`
        const parentLifecycleContract = resolveApplicationLifecycleContractFromConfig(parentObject.config)
        const parentActiveCondition = buildRuntimeActiveRowCondition(
            parentLifecycleContract,
            parentObject.config,
            undefined,
            currentWorkspaceId
        )
        const parentValues: unknown[] = [parentRecordId]
        const parentAccessClause = await buildRuntimeRecordAccessClause({
            manager,
            schemaIdent,
            currentWorkspaceId: currentWorkspaceId ?? null,
            currentUserId: currentUserId ?? null,
            permissions,
            objectCodename: parentObject.codename,
            attrs: parentObject.attrs,
            config: parentObject.config,
            outerRowIdSql: `${parentTableIdent}.id`,
            values: parentValues,
            minimumAccessLevel
        })
        const parentWhereSql = ['id = $1', parentActiveCondition, parentAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')
        const parentRows = (await manager.query(
            `
      SELECT id
      FROM ${parentTableIdent}
      WHERE ${parentWhereSql}
      LIMIT 1
    `,
            parentValues
        )) as Array<{ id: string }>

        if (!parentRows[0]?.id) {
            return `Parent record is not editable for ${formatRuntimeFieldLabel(parentAccessConfig.parentFieldCodename)}`
        }
    }

    return null
}
