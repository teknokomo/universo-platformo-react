import type { EntityDefinition, Component } from '@universo-react/schema-ddl'
import { generateUuidV7, getCodenamePrimary, isUuidV7, serialization } from '@universo-react/utils'
import { ComponentDefinitionDataType, type ObjectSystemFieldsSnapshot } from '@universo-react/types'
import type { PublishedApplicationSnapshot, SnapshotCodenameValue, SnapshotComponent } from './applicationSyncContracts'

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

export type SnapshotPhysicalIdentityRemap = {
    sourceToNew: Map<string, string>
}

export const createSnapshotPhysicalIdentityRemap = (): SnapshotPhysicalIdentityRemap => ({
    sourceToNew: new Map()
})

const snapshotIdentityRemapCacheLimit = 128
const snapshotIdentityRemapsByObject = new WeakMap<object, SnapshotPhysicalIdentityRemap>()
const snapshotIdentityRemapsByContent = new Map<string, SnapshotPhysicalIdentityRemap>()

const resolveSnapshotPhysicalIdentityRemap = (snapshot: PublishedApplicationSnapshot): SnapshotPhysicalIdentityRemap => {
    const objectRemap = snapshotIdentityRemapsByObject.get(snapshot)
    if (objectRemap) return objectRemap

    const serializedSnapshot = serialization.stableStringify(snapshot)
    if (typeof serializedSnapshot !== 'string') return createSnapshotPhysicalIdentityRemap()

    const contentRemap = snapshotIdentityRemapsByContent.get(serializedSnapshot)
    if (contentRemap) {
        snapshotIdentityRemapsByObject.set(snapshot, contentRemap)
        return contentRemap
    }

    const newRemap = createSnapshotPhysicalIdentityRemap()
    if (snapshotIdentityRemapsByContent.size >= snapshotIdentityRemapCacheLimit) {
        const oldestKey = snapshotIdentityRemapsByContent.keys().next().value
        if (typeof oldestKey === 'string') snapshotIdentityRemapsByContent.delete(oldestKey)
    }
    snapshotIdentityRemapsByContent.set(serializedSnapshot, newRemap)
    snapshotIdentityRemapsByObject.set(snapshot, newRemap)
    return newRemap
}

/** Allocate a fresh UUID v7 while preserving an explicit source-to-new mapping. */
export const allocateSnapshotPhysicalIdentity = (
    sourceKey: string,
    remap: SnapshotPhysicalIdentityRemap,
    sourceIds: Set<string>,
    allocatedIds: Set<string>
): string => {
    const existingId = remap.sourceToNew.get(sourceKey)
    if (existingId && isUuidV7(existingId) && !sourceIds.has(existingId)) {
        allocatedIds.add(existingId)
        return existingId
    }

    let newId = generateUuidV7()
    while (sourceIds.has(newId) || allocatedIds.has(newId)) newId = generateUuidV7()

    remap.sourceToNew.set(sourceKey, newId)
    allocatedIds.add(newId)
    return newId
}

const resolveSnapshotCodenameText = (value: SnapshotCodenameValue | null | undefined): string | null => {
    const text = getCodenamePrimary(value).trim()
    return text.length > 0 ? text : null
}

const resolveSnapshotSystemFields = (snapshot: PublishedApplicationSnapshot): Record<string, ObjectSystemFieldsSnapshot> | null => {
    if (!snapshot.systemFields || typeof snapshot.systemFields !== 'object') {
        return null
    }

    return snapshot.systemFields as Record<string, ObjectSystemFieldsSnapshot>
}

const mergeEntityTypeRuntimeConfig = (
    entity: PublishedApplicationSnapshot['entities'][string],
    snapshot: PublishedApplicationSnapshot
): Record<string, unknown> => {
    const definitions: Record<string, unknown> = isRecord(snapshot.entityTypeDefinitions) ? snapshot.entityTypeDefinitions : {}
    const definitionValue = definitions[entity.kind]
    const definition: Record<string, unknown> = isRecord(definitionValue) ? definitionValue : {}
    const definitionConfig = isRecord(definition?.config) ? definition.config : {}
    const entityConfig = isRecord(entity.config) ? entity.config : {}
    const definitionCapabilities = isRecord(definition?.capabilities) ? definition.capabilities : {}

    return {
        ...definitionConfig,
        ...entityConfig,
        ...(Object.keys(definitionCapabilities).length > 0 ? { capabilities: definitionCapabilities } : {})
    }
}

const buildSetConstantLookups = (
    snapshot: PublishedApplicationSnapshot
): {
    byValueGroupId: Map<string, Map<string, SnapshotFixedValueRecord>>
    byFixedValueId: Map<string, SnapshotFixedValueRecord>
} => {
    const byValueGroupId = new Map<string, Map<string, SnapshotFixedValueRecord>>()
    const byFixedValueId = new Map<string, SnapshotFixedValueRecord>()
    const constants = snapshot.fixedValues ?? snapshot.constants

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

const normalizeSnapshotComponent = (field: SnapshotComponent): Component => ({
    ...field,
    codename: resolveSnapshotCodenameText(field.codename) ?? '',
    childFields: field.childFields?.map((child) => normalizeSnapshotComponent(child))
})

const collectDuplicatedFieldIds = (snapshot: PublishedApplicationSnapshot): Set<string> => {
    const ownersByFieldId = new Map<string, Set<string>>()

    const visitFields = (entityId: string, fields: SnapshotComponent[]): void => {
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

        const fields = Array.isArray(entity.fields) ? (entity.fields as SnapshotComponent[]) : []
        visitFields(entity.id, fields)
    }

    return new Set(
        Array.from(ownersByFieldId.entries())
            .filter(([, entityIds]) => entityIds.size > 1)
            .map(([fieldId]) => fieldId)
    )
}

const collectAllFieldIds = (snapshot: PublishedApplicationSnapshot): Set<string> => {
    const fieldIds = new Set<string>()

    const collect = (fields: SnapshotComponent[]): void => {
        for (const field of fields) {
            fieldIds.add(field.id)
            if (Array.isArray(field.childFields)) collect(field.childFields)
        }
    }

    for (const entity of Object.values(snapshot.entities ?? {})) {
        if (Array.isArray(entity.fields)) collect(entity.fields)
    }

    return fieldIds
}

const rewriteDuplicatedFieldIdsForEntity = (
    entityId: string,
    fields: SnapshotComponent[],
    duplicatedFieldIds: Set<string>,
    remap: SnapshotPhysicalIdentityRemap,
    sourceFieldIds: Set<string>,
    allocatedIds: Set<string>
): SnapshotComponent[] => {
    if (fields.length === 0 || duplicatedFieldIds.size === 0) {
        return fields
    }

    const remappedIds = new Map<string, string>()

    const registerIds = (fieldList: SnapshotComponent[]): void => {
        for (const field of fieldList) {
            if (duplicatedFieldIds.has(field.id) && !remappedIds.has(field.id)) {
                remappedIds.set(
                    field.id,
                    allocateSnapshotPhysicalIdentity(`field:${entityId}:${field.id}`, remap, sourceFieldIds, allocatedIds)
                )
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

    const rewriteField = (field: SnapshotComponent): SnapshotComponent => ({
        ...field,
        id: remappedIds.get(field.id) ?? field.id,
        ...(typeof field.parentComponentId === 'string'
            ? { parentComponentId: remappedIds.get(field.parentComponentId) ?? field.parentComponentId }
            : field.parentComponentId === null
            ? { parentComponentId: null }
            : {}),
        ...(Array.isArray(field.childFields) && field.childFields.length > 0
            ? { childFields: field.childFields.map((child) => rewriteField(child)) }
            : {})
    })

    return fields.map((field) => rewriteField(field))
}

export const normalizeSnapshotFieldIdentities = (
    snapshot: PublishedApplicationSnapshot,
    remap: SnapshotPhysicalIdentityRemap = createSnapshotPhysicalIdentityRemap()
): PublishedApplicationSnapshot => {
    const duplicatedFieldIds = collectDuplicatedFieldIds(snapshot)
    if (duplicatedFieldIds.size === 0) return snapshot

    const sourceFieldIds = collectAllFieldIds(snapshot)
    const allocatedIds = new Set<string>(remap.sourceToNew.values())
    const entities = Object.fromEntries(
        Object.entries(snapshot.entities ?? {}).map(([entityId, entity]) => [
            entityId,
            {
                ...entity,
                fields: Array.isArray(entity.fields)
                    ? rewriteDuplicatedFieldIdsForEntity(entityId, entity.fields, duplicatedFieldIds, remap, sourceFieldIds, allocatedIds)
                    : entity.fields
            }
        ])
    ) as PublishedApplicationSnapshot['entities']

    return { ...snapshot, entities }
}

const enrichFieldWithSetConstantRef = (
    field: Component,
    lookups: {
        byValueGroupId: Map<string, Map<string, SnapshotFixedValueRecord>>
        byFixedValueId: Map<string, SnapshotFixedValueRecord>
    }
): Component => {
    const nextField: Component = {
        ...field,
        ...(field.childFields ? { childFields: field.childFields.map((child) => enrichFieldWithSetConstantRef(child, lookups)) } : {})
    }

    if (
        nextField.dataType !== ComponentDefinitionDataType.REF ||
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
    fields: SnapshotComponent[],
    lookups: {
        byValueGroupId: Map<string, Map<string, SnapshotFixedValueRecord>>
        byFixedValueId: Map<string, SnapshotFixedValueRecord>
    }
): Component[] => {
    const fieldOrder: string[] = []
    const fieldMap = new Map<string, Component>()

    const upsertField = (field: Component): void => {
        if (!fieldMap.has(field.id)) {
            fieldOrder.push(field.id)
        }

        fieldMap.set(field.id, field)
    }

    for (const field of fields) {
        const enrichedField = enrichFieldWithSetConstantRef(normalizeSnapshotComponent(field), lookups)
        const normalizedChildren = (enrichedField.childFields ?? []).map((child) => ({
            ...child,
            parentComponentId: child.parentComponentId ?? enrichedField.id
        }))

        const normalizedField: Component = {
            ...enrichedField,
            parentComponentId: enrichedField.parentComponentId ?? null,
            ...(normalizedChildren.length > 0 ? { childFields: normalizedChildren } : {})
        }

        upsertField(normalizedField)

        if (normalizedField.parentComponentId) {
            continue
        }

        for (const child of normalizedChildren) {
            upsertField({
                ...child,
                parentComponentId: child.parentComponentId ?? normalizedField.id
            })
        }
    }

    return fieldOrder.map((fieldId) => fieldMap.get(fieldId)!).filter(Boolean)
}

const assertExecutableEntityContract = (entity: EntityDefinition): void => {
    const fields = entity.fields ?? []
    const fieldsByParent = new Map<string, number>()

    for (const field of fields) {
        if (!field.parentComponentId) {
            continue
        }

        fieldsByParent.set(field.parentComponentId, (fieldsByParent.get(field.parentComponentId) ?? 0) + 1)
    }

    for (const field of fields) {
        if (field.dataType !== ComponentDefinitionDataType.TABLE || field.parentComponentId) {
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

export const resolveExecutablePayloadEntities = (
    snapshot: PublishedApplicationSnapshot,
    remap?: SnapshotPhysicalIdentityRemap
): EntityDefinition[] => {
    const identityRemap = remap ?? resolveSnapshotPhysicalIdentityRemap(snapshot)
    const normalizedSnapshot = normalizeSnapshotFieldIdentities(snapshot, identityRemap)
    const snapshotSystemFields = resolveSnapshotSystemFields(normalizedSnapshot)
    const constantLookups = buildSetConstantLookups(normalizedSnapshot)

    return Object.values(normalizedSnapshot.entities ?? {})
        .map((entity) => {
            const entityConfig = mergeEntityTypeRuntimeConfig(entity, normalizedSnapshot)
            const physicalTableName =
                typeof entity.tableName === 'string' && entity.tableName.trim().length > 0
                    ? entity.tableName
                    : typeof entity.physicalTableName === 'string' && entity.physicalTableName.trim().length > 0
                    ? entity.physicalTableName
                    : undefined
            const normalizedEntity: EntityDefinition = {
                ...entity,
                codename: resolveSnapshotCodenameText(entity.codename) ?? '',
                physicalTableEnabled:
                    typeof entity.physicalTableEnabled === 'boolean' ? entity.physicalTableEnabled : Boolean(physicalTableName),
                ...(physicalTableName ? { physicalTableName } : {}),
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
