import type { EntityDefinition } from '@universo-react/schema-ddl'
import {
    ComponentDefinitionDataType,
    normalizeInterpretationNetworkHexColor,
    type ComponentDefinitionValidationRules
} from '@universo-react/types'
import { validateNumberOrThrow } from '@universo-react/utils'
import { isRecord, isVLCField, normalizeReferenceId, prepareJsonbValue, resolveLocalizedPreviewText } from './syncValueHelpers'
import type { EntityField } from './syncTypes'

// --- Seeding helpers ---

export function extractSetConstantRefConfig(
    uiConfig: unknown
): { id: string; codename?: string; dataType?: string; value?: unknown; name?: unknown } | null {
    if (!isRecord(uiConfig)) return null
    const candidate = uiConfig.setConstantRef
    if (!isRecord(candidate)) return null
    if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) return null

    return {
        id: candidate.id.trim(),
        codename: typeof candidate.codename === 'string' ? candidate.codename : undefined,
        dataType: typeof candidate.dataType === 'string' ? candidate.dataType : undefined,
        value: candidate.value,
        name: candidate.name
    }
}

export function resolveSetReferenceId(
    value: unknown,
    field: { targetConstantId?: string | null; uiConfig?: Record<string, unknown> }
): string | null {
    if (typeof field.targetConstantId === 'string' && field.targetConstantId.trim().length > 0) {
        return field.targetConstantId.trim()
    }

    const setConstantRef = extractSetConstantRefConfig(field.uiConfig)
    if (setConstantRef?.id) {
        return setConstantRef.id
    }

    return normalizeReferenceId(value)
}

/**
 * Normalize a child field value for TABLE row seeding.
 * Applies the same type-specific handling as parent seed logic.
 */
export function normalizeChildFieldValue(
    value: unknown,
    field: {
        dataType: ComponentDefinitionDataType
        validationRules?: Record<string, unknown>
        targetEntityKind?: string | null
        targetConstantId?: string | null
        uiConfig?: Record<string, unknown>
    },
    codename: string,
    tableName: string,
    elementId: string
): unknown {
    if (value === null || value === undefined) return null
    if (field.dataType === ComponentDefinitionDataType.STRING && field.validationRules?.format === 'hexColor') {
        try {
            return normalizeInterpretationNetworkHexColor(value)
        } catch {
            throw new Error('Invalid configured colour value')
        }
    }
    if (isVLCField(field)) return prepareJsonbValue(value)
    if (field.dataType === ComponentDefinitionDataType.JSON) return prepareJsonbValue(value)
    if (field.dataType === ComponentDefinitionDataType.NUMBER) {
        return validateNumericValue({
            value,
            field: { codename, validationRules: field.validationRules },
            tableName,
            elementId
        })
    }
    if (field.dataType === ComponentDefinitionDataType.REF) {
        if (field.targetEntityKind === 'set') {
            return resolveSetReferenceId(value, field)
        }
        return normalizeReferenceId(value)
    }
    return value
}

export function resolveObjectSeedingOrder(entities: EntityDefinition[]): string[] {
    const objects = entities.filter((entity) => entity.kind === 'object')
    const objectById = new Map(objects.map((entity) => [entity.id, entity]))
    const adjacency = new Map<string, Set<string>>()
    const indegree = new Map<string, number>()

    for (const entity of objects) {
        adjacency.set(entity.id, new Set())
        indegree.set(entity.id, 0)
    }

    for (const entity of objects) {
        for (const field of entity.fields ?? []) {
            if (field.dataType !== ComponentDefinitionDataType.REF) continue
            if (field.targetEntityKind !== 'object') continue
            const targetId = field.targetEntityId
            if (typeof targetId !== 'string' || targetId.length === 0 || targetId === entity.id) continue
            if (!objectById.has(targetId)) continue

            const neighbors = adjacency.get(targetId)
            if (!neighbors || neighbors.has(entity.id)) continue
            neighbors.add(entity.id)
            indegree.set(entity.id, (indegree.get(entity.id) ?? 0) + 1)
        }
    }

    const queue = objects
        .filter((entity) => (indegree.get(entity.id) ?? 0) === 0)
        .map((entity) => entity.id)
        .sort((a, b) => {
            const aEntity = objectById.get(a)
            const bEntity = objectById.get(b)
            if (!aEntity || !bEntity) return a.localeCompare(b)
            const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
            return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
        })

    const ordered: string[] = []
    while (queue.length > 0) {
        const current = queue.shift()
        if (!current) continue
        ordered.push(current)

        const nextIds = Array.from(adjacency.get(current) ?? []).sort((a, b) => {
            const aEntity = objectById.get(a)
            const bEntity = objectById.get(b)
            if (!aEntity || !bEntity) return a.localeCompare(b)
            const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
            return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
        })
        for (const nextId of nextIds) {
            const nextDegree = (indegree.get(nextId) ?? 0) - 1
            indegree.set(nextId, nextDegree)
            if (nextDegree === 0) {
                queue.push(nextId)
                queue.sort((a, b) => {
                    const aEntity = objectById.get(a)
                    const bEntity = objectById.get(b)
                    if (!aEntity || !bEntity) return a.localeCompare(b)
                    const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
                    return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
                })
            }
        }
    }

    const unprocessed = objects.map((entity) => entity.id).filter((id) => !ordered.includes(id))
    return [...ordered, ...unprocessed]
}

/**
 * Validates numeric values against NUMERIC(precision, scale) constraints.
 * Throws an error if the value is invalid or overflows.
 *
 * This ensures data integrity - if data passed metahub validation,
 * it should pass application sync too. Any overflow indicates
 * validation was bypassed during element creation.
 */
export function validateNumericValue(options: {
    value: unknown
    field: { codename: string; validationRules?: Record<string, unknown> }
    tableName: string
    elementId: string
}): number | null {
    const { value, field, tableName, elementId } = options

    if (value === undefined || value === null) {
        return null
    }

    if (typeof value !== 'number') {
        // Let DB handle type mismatch
        return value as unknown as number
    }

    const rules = field.validationRules as Partial<ComponentDefinitionValidationRules> | undefined

    try {
        return validateNumberOrThrow(
            value,
            {
                precision: rules?.precision,
                scale: rules?.scale,
                min: rules?.min ?? undefined,
                max: rules?.max ?? undefined,
                nonNegative: rules?.nonNegative
            },
            {
                fieldName: field.codename,
                elementId
            }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
            `[SchemaSync] Failed to sync element ${elementId} to ${tableName}: ${message}. ` +
                `This indicates the element contains invalid data that bypassed metahub validation.`
        )
    }
}

export function resolveFieldDefaultEnumValueId(field: EntityDefinition['fields'][number]): string | null {
    if (!isRecord(field.uiConfig)) return null
    const candidate = field.uiConfig.defaultEnumValueId
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

// --- Preview / diff helpers ---

export function resolveElementPreviewLabel(entity: EntityDefinition, data: Record<string, unknown>): string | null {
    const fields = entity.fields ?? []
    const displayField =
        fields.find((field) => field.isDisplayComponent) ??
        fields.find((field) => field.dataType === ComponentDefinitionDataType.STRING) ??
        fields[0]

    if (!displayField) return null
    const rawValue = data[displayField.codename]
    if (rawValue === null || rawValue === undefined) return null

    const localized = resolveLocalizedPreviewText(rawValue)
    if (localized) return localized

    if (typeof rawValue === 'string') return rawValue
    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') return String(rawValue)
    return null
}

export function resolveSetConstantPreviewValue(field: EntityField, fallbackRefId: string): unknown {
    const setConstantRef = extractSetConstantRefConfig(field.uiConfig)
    if (!setConstantRef) return fallbackRefId

    const value = setConstantRef.value
    if (value === null || value === undefined) {
        const localizedName = resolveLocalizedPreviewText(setConstantRef.name)
        return localizedName ?? setConstantRef.codename ?? setConstantRef.id
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value
    }

    const localizedValue = resolveLocalizedPreviewText(value)
    if (localizedValue) return localizedValue

    const localizedName = resolveLocalizedPreviewText(setConstantRef.name)
    if (localizedName) return localizedName

    try {
        return JSON.stringify(value)
    } catch {
        return setConstantRef.codename ?? setConstantRef.id
    }
}
