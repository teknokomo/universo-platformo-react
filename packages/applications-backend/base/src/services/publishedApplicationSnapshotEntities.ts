import type { EntityDefinition, FieldDefinition } from '@universo/schema-ddl'
import { getCodenamePrimary } from '@universo/utils'
import { AttributeDataType, type CatalogSystemFieldsSnapshot } from '@universo/types'
import type {
    PublishedApplicationSnapshot,
    SnapshotCodenameValue,
    SnapshotFieldDefinition
} from './applicationSyncContracts'

type SnapshotConstantRecord = {
    id: string
    codename?: SnapshotCodenameValue | null
    dataType?: string | null
    presentation?: Record<string, unknown> | null
    value?: unknown
}

type SetConstantRefPayload = {
    id: string
    codename: string | null
    dataType: string | null
    value: unknown
    name: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

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
    bySetId: Map<string, Map<string, SnapshotConstantRecord>>
    byConstantId: Map<string, SnapshotConstantRecord>
} => {
    const bySetId = new Map<string, Map<string, SnapshotConstantRecord>>()
    const byConstantId = new Map<string, SnapshotConstantRecord>()
    const constants = snapshot.constants

    if (!constants || typeof constants !== 'object') {
        return { bySetId, byConstantId }
    }

    for (const [setId, setConstants] of Object.entries(constants)) {
        if (!Array.isArray(setConstants)) {
            continue
        }

        const setLookup = new Map<string, SnapshotConstantRecord>()
        for (const constant of setConstants) {
            if (!isRecord(constant)) {
                continue
            }

            const id = typeof constant.id === 'string' && constant.id.length > 0 ? constant.id : null
            if (!id) {
                continue
            }

            const normalizedConstant: SnapshotConstantRecord = {
                id,
                codename:
                    typeof constant.codename === 'string' || isRecord(constant.codename)
                        ? (constant.codename as SnapshotCodenameValue)
                        : null,
                dataType: typeof constant.dataType === 'string' ? constant.dataType : null,
                presentation: isRecord(constant.presentation) ? constant.presentation : null,
                value: Object.prototype.hasOwnProperty.call(constant, 'value') ? constant.value : null
            }

            setLookup.set(id, normalizedConstant)
            byConstantId.set(id, normalizedConstant)
        }

        if (setLookup.size > 0) {
            bySetId.set(setId, setLookup)
        }
    }

    return { bySetId, byConstantId }
}

const toSetConstantRefPayload = (
    targetConstantId: string,
    constant: SnapshotConstantRecord | null
): SetConstantRefPayload | { id: string } => {
    if (!constant) {
        return { id: targetConstantId }
    }

    const presentationName = isRecord(constant.presentation) ? constant.presentation.name : null

    return {
        id: constant.id,
        codename: resolveSnapshotCodenameText(constant.codename),
        dataType: typeof constant.dataType === 'string' ? constant.dataType : null,
        value: Object.prototype.hasOwnProperty.call(constant, 'value') ? constant.value : null,
        name: presentationName ?? null
    }
}

const normalizeSnapshotFieldDefinition = (field: SnapshotFieldDefinition): FieldDefinition => ({
    ...field,
    codename: resolveSnapshotCodenameText(field.codename) ?? '',
    childFields: field.childFields?.map((child) => normalizeSnapshotFieldDefinition(child))
})

const enrichFieldWithSetConstantRef = (
    field: FieldDefinition,
    lookups: {
        bySetId: Map<string, Map<string, SnapshotConstantRecord>>
        byConstantId: Map<string, SnapshotConstantRecord>
    }
): FieldDefinition => {
    const nextField: FieldDefinition = {
        ...field,
        ...(field.childFields ? { childFields: field.childFields.map((child) => enrichFieldWithSetConstantRef(child, lookups)) } : {})
    }

    if (
        nextField.dataType !== AttributeDataType.REF ||
        nextField.targetEntityKind !== 'set' ||
        typeof nextField.targetConstantId !== 'string' ||
        nextField.targetConstantId.length === 0
    ) {
        return nextField
    }

    const fromSetLookup =
        typeof nextField.targetEntityId === 'string' && nextField.targetEntityId.length > 0
            ? lookups.bySetId.get(nextField.targetEntityId)?.get(nextField.targetConstantId)
            : undefined
    const constant = fromSetLookup ?? lookups.byConstantId.get(nextField.targetConstantId) ?? null
    const baseUiConfig = isRecord(nextField.uiConfig) ? nextField.uiConfig : {}

    nextField.uiConfig = {
        ...baseUiConfig,
        targetConstantId: nextField.targetConstantId,
        setConstantRef: toSetConstantRefPayload(nextField.targetConstantId, constant)
    }

    return nextField
}

const normalizeExecutableEntityFields = (
    fields: SnapshotFieldDefinition[],
    lookups: {
        bySetId: Map<string, Map<string, SnapshotConstantRecord>>
        byConstantId: Map<string, SnapshotConstantRecord>
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
        if (field.dataType !== AttributeDataType.TABLE || field.parentAttributeId) {
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

    return Object.values(snapshot.entities ?? {})
        .map((entity) => {
            const entityConfig = isRecord(entity.config) ? entity.config : {}
            const normalizedEntity: EntityDefinition = {
                ...entity,
                codename: resolveSnapshotCodenameText(entity.codename) ?? '',
                config: {
                    ...entityConfig,
                    ...(snapshotSystemFields?.[entity.id] ? { systemFields: snapshotSystemFields[entity.id] } : {})
                },
                fields: normalizeExecutableEntityFields(entity.fields ?? [], constantLookups)
            }

            assertExecutableEntityContract(normalizedEntity)
            return normalizedEntity
        })
        .sort((left, right) => left.id.localeCompare(right.id))
}
