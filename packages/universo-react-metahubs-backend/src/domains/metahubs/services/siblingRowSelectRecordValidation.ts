import { ComponentDefinitionDataType } from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import { MetahubRecordReferenceMissingError, MetahubRecordReferencedError, MetahubValidationError } from '../../shared/domainErrors'

type SiblingRowRecordComponent = {
    id: string
    codename: string
    dataType: ComponentDefinitionDataType
    parentComponentId: string | null
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
}

type SiblingRowSelectConfig = {
    tableCodename: string
    valueFieldCodename: string
    labelFieldCodename: string
    requiredWithRows: boolean
    requireEachTargetReferenced: boolean
}

const SIBLING_ROW_LABEL_TYPES = new Set<ComponentDefinitionDataType>([
    ComponentDefinitionDataType.STRING,
    ComponentDefinitionDataType.NUMBER,
    ComponentDefinitionDataType.BOOLEAN,
    ComponentDefinitionDataType.DATE
])

export const assertSiblingRowTargetsExist = (
    components: readonly SiblingRowRecordComponent[],
    data: Record<string, unknown>,
    previousData?: Record<string, unknown>
): void => {
    const rootComponents = components.filter((component) => !component.parentComponentId)
    const componentsById = new Map(components.map((component) => [component.id, component]))
    const childComponentsByParent = new Map<string, SiblingRowRecordComponent[]>()
    for (const component of components) {
        if (!component.parentComponentId) continue
        const children = childComponentsByParent.get(component.parentComponentId) ?? []
        children.push(component)
        childComponentsByParent.set(component.parentComponentId, children)
    }

    const failConfiguration = (component: SiblingRowRecordComponent, reason: string): never => {
        throw new MetahubValidationError('Invalid sibling row selection configuration', {
            componentCodename: component.codename,
            reason
        })
    }
    const readConfigString = (config: Record<string, unknown>, key: string): string | null => {
        const value = config[key]
        return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
    }
    const readRowValue = (row: Record<string, unknown>, component: SiblingRowRecordComponent): unknown => {
        if (Object.prototype.hasOwnProperty.call(row, component.codename)) return row[component.codename]
        return row[component.id]
    }
    const readRecordValue = (record: Record<string, unknown>, component: SiblingRowRecordComponent): unknown => {
        if (Object.prototype.hasOwnProperty.call(record, component.codename)) return record[component.codename]
        return record[component.id]
    }

    for (const component of components) {
        const uiConfig = component.uiConfig
        if (!uiConfig || !Object.prototype.hasOwnProperty.call(uiConfig, 'siblingRowSelect')) continue

        const rawConfig = uiConfig.siblingRowSelect
        if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
            failConfiguration(component, 'invalid_configuration')
        }
        const configRecord = rawConfig as Record<string, unknown>
        const requireConfigString = (key: string): string => {
            const value = readConfigString(configRecord, key)
            if (!value) failConfiguration(component, 'incomplete_configuration')
            return value as string
        }
        const siblingConfig: SiblingRowSelectConfig = {
            tableCodename: requireConfigString('tableCodename'),
            valueFieldCodename: requireConfigString('valueFieldCodename'),
            labelFieldCodename: requireConfigString('labelFieldCodename'),
            requiredWithRows: configRecord.requiredWithRows === true,
            requireEachTargetReferenced: configRecord.requireEachTargetReferenced === true
        }

        const sourceTable = component.parentComponentId ? componentsById.get(component.parentComponentId) : undefined
        if (
            !sourceTable ||
            sourceTable.parentComponentId !== null ||
            sourceTable.dataType !== ComponentDefinitionDataType.TABLE ||
            component.dataType !== ComponentDefinitionDataType.STRING
        ) {
            failConfiguration(component, 'invalid_source_field')
        }
        const validSourceTable = sourceTable as SiblingRowRecordComponent

        const targetTables = rootComponents.filter((candidate) => candidate.codename === siblingConfig.tableCodename)
        if (targetTables.length !== 1 || targetTables[0]?.dataType !== ComponentDefinitionDataType.TABLE) {
            failConfiguration(component, 'invalid_target_table')
        }
        const targetTable = targetTables[0] as SiblingRowRecordComponent
        if (targetTable.id === validSourceTable.id) failConfiguration(component, 'target_table_is_not_sibling')

        const targetChildren = childComponentsByParent.get(targetTable.id) ?? []
        const findTargetField = (fieldName: string): SiblingRowRecordComponent => {
            const matches = targetChildren.filter((candidate) => candidate.codename === fieldName || candidate.id === fieldName)
            if (matches.length !== 1) failConfiguration(component, 'invalid_target_field')
            return matches[0] as SiblingRowRecordComponent
        }
        const valueField = findTargetField(siblingConfig.valueFieldCodename)
        const labelField = findTargetField(siblingConfig.labelFieldCodename)
        if (
            valueField.dataType !== ComponentDefinitionDataType.STRING ||
            valueField.validationRules?.localized === true ||
            valueField.validationRules?.versioned === true ||
            valueField.id === labelField.id
        ) {
            failConfiguration(component, 'invalid_target_value_field')
        }
        if (!SIBLING_ROW_LABEL_TYPES.has(labelField.dataType)) {
            failConfiguration(component, 'invalid_target_label_field')
        }
        const normalizeSiblingKey = (value: string): string => (valueField.uiConfig?.generateUuidV7 === true ? value.toLowerCase() : value)

        const rawSourceRows = readRecordValue(data, validSourceTable)
        if (rawSourceRows !== null && rawSourceRows !== undefined && !Array.isArray(rawSourceRows)) {
            failConfiguration(component, 'invalid_source_rows')
        }
        const sourceRows = Array.isArray(rawSourceRows) ? rawSourceRows : []

        const rawTargetRows = readRecordValue(data, targetTable)
        if (rawTargetRows !== null && rawTargetRows !== undefined && !Array.isArray(rawTargetRows)) {
            failConfiguration(component, 'invalid_target_rows')
        }
        const targetRows = Array.isArray(rawTargetRows) ? rawTargetRows : []
        const hasTargetRows = targetRows.length > 0
        const targetKeys = new Set<string>()
        const referencedTargetKeys = new Set<string>()
        for (const targetRow of targetRows) {
            if (!targetRow || typeof targetRow !== 'object' || Array.isArray(targetRow)) {
                failConfiguration(component, 'invalid_target_row')
            }
            const value = readRowValue(targetRow as Record<string, unknown>, valueField)
            if (value === null || value === undefined || value === '') {
                if (valueField.uiConfig?.generateUuidV7 === true) failConfiguration(component, 'missing_target_key')
                continue
            }
            if (typeof value !== 'string' || value.trim().length === 0) {
                failConfiguration(component, 'invalid_target_key')
            }
            const rawKey = (value as string).trim()
            if (valueField.uiConfig?.generateUuidV7 === true && !isUuidV7(rawKey)) failConfiguration(component, 'invalid_target_key')
            const key = normalizeSiblingKey(rawKey)
            if (targetKeys.has(key)) {
                throw new MetahubValidationError(
                    'Sibling row target keys must be unique',
                    { componentCodename: component.codename, reason: 'duplicate_target_key' },
                    'RECORD_SIBLING_TARGET_KEY_DUPLICATE'
                )
            }
            targetKeys.add(key)
        }

        const previousRows = previousData ? readRecordValue(previousData, targetTable) : undefined
        const previousKeys = new Set<string>()
        if (Array.isArray(previousRows)) {
            for (const previousRow of previousRows) {
                if (!previousRow || typeof previousRow !== 'object' || Array.isArray(previousRow)) continue
                const value = readRowValue(previousRow as Record<string, unknown>, valueField)
                if (typeof value === 'string' && value.trim().length > 0) previousKeys.add(normalizeSiblingKey(value.trim()))
            }
        }

        for (const sourceRow of sourceRows) {
            if (!sourceRow || typeof sourceRow !== 'object' || Array.isArray(sourceRow)) {
                failConfiguration(component, 'invalid_source_row')
            }
            const rawValue = readRowValue(sourceRow as Record<string, unknown>, component)
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                if (siblingConfig.requiredWithRows && hasTargetRows) {
                    throw new MetahubValidationError('Sibling row selection is required when target rows exist', {
                        componentCodename: component.codename,
                        reason: 'required_with_targets'
                    })
                }
                continue
            }
            if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
                throw new MetahubValidationError('Invalid sibling row selection value', {
                    componentCodename: component.codename,
                    reason: 'invalid_value'
                })
            }

            const rawKey = rawValue.trim()
            const key = normalizeSiblingKey(rawKey)
            if (!targetKeys.has(key)) {
                if (previousKeys.has(key)) {
                    throw new MetahubRecordReferencedError('Row', { componentCodename: component.codename })
                }
                throw new MetahubRecordReferenceMissingError(component.codename, rawKey)
            }
            referencedTargetKeys.add(key)
        }

        if (siblingConfig.requireEachTargetReferenced) {
            for (const targetKey of targetKeys) {
                if (referencedTargetKeys.has(targetKey)) continue
                throw new MetahubValidationError(
                    'Every sibling target row must be referenced by at least one source row',
                    { componentCodename: component.codename, reason: 'unreferenced_target' },
                    'RECORD_SIBLING_TARGET_UNREFERENCED'
                )
            }
        }
    }
}
