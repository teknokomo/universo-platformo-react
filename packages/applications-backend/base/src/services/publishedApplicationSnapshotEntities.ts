import { createHash } from 'crypto'
import type { EntityDefinition, FieldDefinition } from '@universo/schema-ddl'
import { getCodenamePrimary } from '@universo/utils'
import { FieldDefinitionDataType, type CatalogSystemFieldsSnapshot } from '@universo/types'
import type { PublishedApplicationSnapshot, SnapshotCodenameValue, SnapshotFieldDefinition } from './applicationSyncContracts'

type SnapshotFixedValueRecord = {
    id: string
    codename?: SnapshotCodenameValue | null
    dataType?: string | null
    presentation?: Record<string, unknown> | null
    value?: unknown
}

type SetFixedValueRefPayload = {
    id: string
    codename: string | null
    dataType: string | null
    value: unknown
    name: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isSetStandardKind = (kind: unknown): boolean => kind === 'set'

const buildDeterministicScopedUuid = (seed: string): string => {
    const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('')
    hex[12] = '5'
    hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16)

    return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex
        .slice(20, 32)
        .join('')}`
}

const resolveSnapshotCodenameText = (value: SnapshotCodenameValue | null | undefined): string | null => {
    const text = getCodenamePrimary(value).trim()
    return text.length > 0 ? text : null
}

const resolveSnapshotSystemFields = (snapshot: PublishedApplicationSnapshot): Record<string, CatalogSystemFieldsSnapshot> | null => {
    if (!snapshot.systemFields || typeof snapshot.systemFields !== 'object') {
        return null
    }

    return snapshot.systemFields as Record<string, CatalogSystemFieldsSnapshot>
}

const buildSetConstantLookups = (
    snapshot: PublishedApplicationSnapshot
): {
    byValueGroupId: Map<string, Map<string, SnapshotFixedValueRecord>>
    byFixedValueId: Map<string, SnapshotFixedValueRecord>
} => {
    const byValueGroupId = new Map<string, Map<string, SnapshotFixedValueRecord>>()
    const byFixedValueId = new Map<string, SnapshotFixedValueRecord>()
    const constants = snapshot.fixedValues

    if (!constants || typeof constants !== 'object') {
        return { byValueGroupId, byFixedValueId }
    }

    for (const [valueGroupId, setConstants] of Object.entries(constants)) {
        if (!Array.isArray(setConstants)) {
            continue
        }

        const setLookup = new Map<string, SnapshotFixedValueRecord>()
        for (const fixedValue of setConstants) {
            if (!isRecord(fixedValue)) {
                continue
            }

            const id = typeof fixedValue.id === 'string' && fixedValue.id.length > 0 ? fixedValue.id : null
            if (!id) {
                continue
            }

            const normalizedFixedValue: SnapshotFixedValueRecord = {
                id,
                codename:
                    typeof fixedValue.codename === 'string' || isRecord(fixedValue.codename)
                        ? (fixedValue.codename as SnapshotCodenameValue)
                        : null,
                dataType: typeof fixedValue.dataType === 'string' ? fixedValue.dataType : null,
                presentation: isRecord(fixedValue.presentation) ? fixedValue.presentation : null,
                value: Object.prototype.hasOwnProperty.call(fixedValue, 'value') ? fixedValue.value : null
            }

            setLookup.set(id, normalizedFixedValue)
            byFixedValueId.set(id, normalizedFixedValue)
        }

        if (setLookup.size > 0) {
            byValueGroupId.set(valueGroupId, setLookup)
        }
    }

    return { byValueGroupId, byFixedValueId }
}

const toSetFixedValueRefPayload = (
    targetConstantId: string,
    fixedValueRecord: SnapshotFixedValueRecord | null
): SetFixedValueRefPayload | { id: string } => {
    if (!fixedValueRecord) {
        return { id: targetConstantId }
    }

    const presentationName = isRecord(fixedValueRecord.presentation) ? fixedValueRecord.presentation.name : null

    return {
        id: fixedValueRecord.id,
        codename: resolveSnapshotCodenameText(fixedValueRecord.codename),
        dataType: typeof fixedValueRecord.dataType === 'string' ? fixedValueRecord.dataType : null,
        value: Object.prototype.hasOwnProperty.call(fixedValueRecord, 'value') ? fixedValueRecord.value : null,
        name: presentationName ?? null
    }
}

const normalizeSnapshotFieldDefinition = (field: SnapshotFieldDefinition): FieldDefinition => ({
    ...field,
    codename: resolveSnapshotCodenameText(field.codename) ?? '',
    childFields: field.childFields?.map((child) => normalizeSnapshotFieldDefinition(child))
})

const collectDuplicatedFieldIds = (snapshot: PublishedApplicationSnapshot): Set<string> => {
    const ownersByFieldId = new Map<string, Set<string>>()

    const visitFields = (entityId: string, fields: SnapshotFieldDefinition[]): void => {
        for (const field of fields) {
            const fieldId = typeof field.id === 'string' && field.id.length > 0 ? field.id : null
            if (fieldId) {
                const entityOwners = ownersByFieldId.get(fieldId) ?? new Set<string>()
                entityOwners.add(entityId)
                ownersByFieldId.set(fieldId, entityOwners)
            }

            if (Array.isArray(field.childFields) && field.childFields.length > 0) {
                visitFields(entityId, field.childFields)
            }
        }
    }

    for (const entity of Object.values(snapshot.entities ?? {})) {
        if (!isRecord(entity) || typeof entity.id !== 'string') {
            continue
        }

        const fields = Array.isArray(entity.fields) ? (entity.fields as SnapshotFieldDefinition[]) : []
        visitFields(entity.id, fields)
    }

    return new Set(
        Array.from(ownersByFieldId.entries())
            .filter(([, entityIds]) => entityIds.size > 1)
            .map(([fieldId]) => fieldId)
    )
}

const rewriteDuplicatedFieldIdsForEntity = (
    entityId: string,
    fields: SnapshotFieldDefinition[],
    duplicatedFieldIds: Set<string>
): SnapshotFieldDefinition[] => {
    if (fields.length === 0 || duplicatedFieldIds.size === 0) {
        return fields
    }

    const remappedIds = new Map<string, string>()

    const registerIds = (fieldList: SnapshotFieldDefinition[]): void => {
        for (const field of fieldList) {
            if (duplicatedFieldIds.has(field.id) && !remappedIds.has(field.id)) {
                remappedIds.set(field.id, buildDeterministicScopedUuid(`application-runtime-field:${entityId}:${field.id}`))
            }

            if (Array.isArray(field.childFields) && field.childFields.length > 0) {
                registerIds(field.childFields)
            }
        }
    }

    registerIds(fields)

    if (remappedIds.size === 0) {
        return fields
    }

    const rewriteField = (field: SnapshotFieldDefinition): SnapshotFieldDefinition => ({
        ...field,
        id: remappedIds.get(field.id) ?? field.id,
        ...(typeof field.parentAttributeId === 'string'
            ? { parentAttributeId: remappedIds.get(field.parentAttributeId) ?? field.parentAttributeId }
            : field.parentAttributeId === null
            ? { parentAttributeId: null }
            : {}),
        ...(Array.isArray(field.childFields) && field.childFields.length > 0
            ? { childFields: field.childFields.map((child) => rewriteField(child)) }
            : {})
    })

    return fields.map((field) => rewriteField(field))
}

const enrichFieldWithSetConstantRef = (
    field: FieldDefinition,
    lookups: {
        byValueGroupId: Map<string, Map<string, SnapshotFixedValueRecord>>
        byFixedValueId: Map<string, SnapshotFixedValueRecord>
    }
): FieldDefinition => {
    const nextField: FieldDefinition = {
        ...field,
        ...(field.childFields ? { childFields: field.childFields.map((child) => enrichFieldWithSetConstantRef(child, lookups)) } : {})
    }

    if (
        nextField.dataType !== FieldDefinitionDataType.REF ||
        !isSetStandardKind(nextField.targetEntityKind) ||
        typeof nextField.targetConstantId !== 'string' ||
        nextField.targetConstantId.length === 0
    ) {
        return nextField
    }

    const fromSetLookup =
        typeof nextField.targetEntityId === 'string' && nextField.targetEntityId.length > 0
            ? lookups.byValueGroupId.get(nextField.targetEntityId)?.get(nextField.targetConstantId)
            : undefined
    const fixedValue = fromSetLookup ?? lookups.byFixedValueId.get(nextField.targetConstantId) ?? null
    const baseUiConfig = isRecord(nextField.uiConfig) ? nextField.uiConfig : {}

    nextField.uiConfig = {
        ...baseUiConfig,
        targetConstantId: nextField.targetConstantId,
        setConstantRef: toSetFixedValueRefPayload(nextField.targetConstantId, fixedValue)
    }

    return nextField
}

const normalizeExecutableEntityFields = (
    fields: SnapshotFieldDefinition[],
    lookups: {
        byValueGroupId: Map<string, Map<string, SnapshotFixedValueRecord>>
        byFixedValueId: Map<string, SnapshotFixedValueRecord>
    }
): FieldDefinition[] => {
    const fieldOrder: string[] = []
    const fieldMap = new Map<string, FieldDefinition>()

    const upsertField = (field: FieldDefinition): void => {
        if (!fieldMap.has(field.id)) {
            fieldOrder.push(field.id)
        }

        fieldMap.set(field.id, field)
    }

    for (const field of fields) {
        const enrichedField = enrichFieldWithSetConstantRef(normalizeSnapshotFieldDefinition(field), lookups)
        const normalizedChildren = (enrichedField.childFields ?? []).map((child) => ({
            ...child,
            parentAttributeId: child.parentAttributeId ?? enrichedField.id
        }))

        const normalizedField: FieldDefinition = {
            ...enrichedField,
            parentAttributeId: enrichedField.parentAttributeId ?? null,
            ...(normalizedChildren.length > 0 ? { childFields: normalizedChildren } : {})
        }

        upsertField(normalizedField)

        if (normalizedField.parentAttributeId) {
            continue
        }

        for (const child of normalizedChildren) {
            upsertField({
                ...child,
                parentAttributeId: child.parentAttributeId ?? normalizedField.id
            })
        }
    }

    return fieldOrder.map((fieldId) => fieldMap.get(fieldId)!).filter(Boolean)
}

const assertExecutableEntityContract = (entity: EntityDefinition): void => {
    const fields = entity.fields ?? []
    const fieldsByParent = new Map<string, number>()

    for (const field of fields) {
        if (!field.parentAttributeId) {
            continue
        }

        fieldsByParent.set(field.parentAttributeId, (fieldsByParent.get(field.parentAttributeId) ?? 0) + 1)
    }

    for (const field of fields) {
        if (field.dataType !== FieldDefinitionDataType.TABLE || field.parentAttributeId) {
            continue
        }

        const nestedChildrenCount = field.childFields?.length ?? 0
        if (nestedChildrenCount === 0) {
            continue
        }

        const flatChildrenCount = fieldsByParent.get(field.id) ?? 0
        if (flatChildrenCount < nestedChildrenCount) {
            throw new Error(`Executable payload is missing flattened TABLE child fields for entity "${entity.id}" field "${field.id}".`)
        }
    }
}

export const resolveExecutablePayloadEntities = (snapshot: PublishedApplicationSnapshot): EntityDefinition[] => {
    const snapshotSystemFields = resolveSnapshotSystemFields(snapshot)
    const constantLookups = buildSetConstantLookups(snapshot)
    const duplicatedFieldIds = collectDuplicatedFieldIds(snapshot)

    return Object.values(snapshot.entities ?? {})
        .map((entity) => {
            const entityConfig = isRecord(entity.config) ? entity.config : {}
            const normalizedSnapshotFields = rewriteDuplicatedFieldIdsForEntity(entity.id, entity.fields ?? [], duplicatedFieldIds)
            const normalizedEntity: EntityDefinition = {
                ...entity,
                codename: resolveSnapshotCodenameText(entity.codename) ?? '',
                ...(typeof entity.tableName === 'string' && entity.tableName.trim().length > 0
                    ? { physicalTableName: entity.tableName }
                    : typeof entity.physicalTableName === 'string' && entity.physicalTableName.trim().length > 0
                    ? { physicalTableName: entity.physicalTableName }
                    : {}),
                config: {
                    ...entityConfig,
                    ...(snapshotSystemFields?.[entity.id] ? { systemFields: snapshotSystemFields[entity.id] } : {})
                },
                fields: normalizeExecutableEntityFields(normalizedSnapshotFields, constantLookups)
            }

            assertExecutableEntityContract(normalizedEntity)
            return normalizedEntity
        })
        .sort((left, right) => left.id.localeCompare(right.id))
}
