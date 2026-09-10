import { createHash } from 'crypto'
import { ComponentDefinitionDataType } from '@universo-react/types'
import { getCodenamePrimary, serialization } from '@universo-react/utils'
import type {
    PublishedApplicationRuntimeSource,
    PublishedApplicationSnapshot,
    SnapshotEntityDefinition,
    SnapshotEnumerationValueDefinition,
    SnapshotComponent
} from './applicationSyncContracts'
import {
    allocateSnapshotPhysicalIdentity,
    createSnapshotPhysicalIdentityRemap,
    normalizeSnapshotFieldIdentities,
    resolveExecutablePayloadEntities,
    type SnapshotPhysicalIdentityRemap
} from './publishedApplicationSnapshotEntities'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const resolveSnapshotCodenameText = (value: unknown): string | null => {
    if (typeof value === 'string') {
        return value
    }

    if (value && typeof value === 'object') {
        return getCodenamePrimary(value as Parameters<typeof getCodenamePrimary>[0])
    }

    return null
}

const isEnumerationStandardKind = (kind: unknown): boolean => kind === 'enumeration'

const calculatePublicationSnapshotHash = (snapshot: PublishedApplicationSnapshot): string =>
    createHash('sha256')
        .update(serialization.stableStringify(serialization.normalizePublicationSnapshotForHash(snapshot)) ?? '')
        .digest('hex')

const runtimeSnapshotIdentityRemapsByObject = new WeakMap<object, SnapshotPhysicalIdentityRemap>()
const runtimeSourceIdentityRemapCacheLimit = 128
const runtimeSourceIdentityRemaps = new Map<string, SnapshotPhysicalIdentityRemap>()

const resolveRuntimeSnapshotIdentityRemap = (snapshot: PublishedApplicationSnapshot): SnapshotPhysicalIdentityRemap => {
    const existingRemap = runtimeSnapshotIdentityRemapsByObject.get(snapshot)
    if (existingRemap) return existingRemap

    const remap = createSnapshotPhysicalIdentityRemap()
    runtimeSnapshotIdentityRemapsByObject.set(snapshot, remap)
    return remap
}

const buildRuntimeSourceIdentityKey = (source: PublishedApplicationRuntimeSource): string =>
    [source.publicationId, source.publicationVersionId].join('\u0000')

const resolveRuntimeSourceIdentityRemap = (source: PublishedApplicationRuntimeSource): SnapshotPhysicalIdentityRemap => {
    const key = buildRuntimeSourceIdentityKey(source)
    const existingRemap = runtimeSourceIdentityRemaps.get(key)
    if (existingRemap) return existingRemap

    const remap = createSnapshotPhysicalIdentityRemap()
    if (runtimeSourceIdentityRemaps.size >= runtimeSourceIdentityRemapCacheLimit) {
        const oldestKey = runtimeSourceIdentityRemaps.keys().next().value
        if (typeof oldestKey === 'string') runtimeSourceIdentityRemaps.delete(oldestKey)
    }
    runtimeSourceIdentityRemaps.set(key, remap)
    return remap
}

const collectDuplicatedEnumerationValueIds = (snapshot: PublishedApplicationSnapshot): Set<string> => {
    const ownersByValueId = new Map<string, Set<string>>()

    for (const [objectId, values] of Object.entries(snapshot.optionValues ?? {})) {
        const typedValues = Array.isArray(values) ? (values as SnapshotEnumerationValueDefinition[]) : []
        for (const value of typedValues) {
            const valueId = typeof value.id === 'string' && value.id.length > 0 ? value.id : null
            if (!valueId) {
                continue
            }

            const objectOwners = ownersByValueId.get(valueId) ?? new Set<string>()
            objectOwners.add(objectId)
            ownersByValueId.set(valueId, objectOwners)
        }
    }

    return new Set(
        Array.from(ownersByValueId.entries())
            .filter(([, objectIds]) => objectIds.size > 1)
            .map(([valueId]) => valueId)
    )
}

const buildEnumerationValueIdMap = (
    snapshot: PublishedApplicationSnapshot,
    duplicatedValueIds: Set<string>,
    remap: SnapshotPhysicalIdentityRemap
): Map<string, Map<string, string>> => {
    const scopedIdsByObject = new Map<string, Map<string, string>>()

    if (duplicatedValueIds.size === 0) {
        return scopedIdsByObject
    }

    const sourceValueIds = new Set<string>()
    for (const values of Object.values(snapshot.optionValues ?? {})) {
        const typedValues = Array.isArray(values) ? (values as SnapshotEnumerationValueDefinition[]) : []
        for (const value of typedValues) {
            if (typeof value.id === 'string' && value.id.length > 0) sourceValueIds.add(value.id)
        }
    }

    const allocatedIds = new Set<string>(remap.sourceToNew.values())

    for (const [objectId, values] of Object.entries(snapshot.optionValues ?? {})) {
        const typedValues = Array.isArray(values) ? (values as SnapshotEnumerationValueDefinition[]) : []
        const scopedIds = new Map<string, string>()

        for (const value of typedValues) {
            if (!duplicatedValueIds.has(value.id)) {
                continue
            }

            scopedIds.set(
                value.id,
                allocateSnapshotPhysicalIdentity(`enumeration:${objectId}:${value.id}`, remap, sourceValueIds, allocatedIds)
            )
        }

        if (scopedIds.size > 0) {
            scopedIdsByObject.set(objectId, scopedIds)
        }
    }

    return scopedIdsByObject
}

const remapEnumerationReferenceValue = (
    rawValue: unknown,
    targetObjectId: string,
    scopedIdsByObject: Map<string, Map<string, string>>
): unknown => {
    const scopedIds = scopedIdsByObject.get(targetObjectId)
    if (!scopedIds || scopedIds.size === 0) {
        return rawValue
    }

    if (typeof rawValue === 'string') {
        return scopedIds.get(rawValue) ?? rawValue
    }

    if (Array.isArray(rawValue)) {
        const nextValues = rawValue.map((value) => remapEnumerationReferenceValue(value, targetObjectId, scopedIdsByObject))
        const changed = nextValues.some((value, index) => value !== rawValue[index])
        return changed ? nextValues : rawValue
    }

    if (isRecord(rawValue) && typeof rawValue.id === 'string') {
        const remappedId = scopedIds.get(rawValue.id)
        if (!remappedId) {
            return rawValue
        }

        return {
            ...rawValue,
            id: remappedId
        }
    }

    return rawValue
}

const rewriteElementDataForFields = (
    data: Record<string, unknown>,
    fields: SnapshotComponent[],
    scopedIdsByObject: Map<string, Map<string, string>>
): Record<string, unknown> => {
    const fieldByCodename = new Map<string, SnapshotComponent>()
    for (const field of fields) {
        const codename = resolveSnapshotCodenameText(field.codename)
        if (codename) {
            fieldByCodename.set(codename, field)
        }
    }

    let changed = false
    const nextData: Record<string, unknown> = { ...data }

    for (const [key, rawValue] of Object.entries(data)) {
        const field = fieldByCodename.get(key)
        if (!field) {
            continue
        }

        if (field.dataType === ComponentDefinitionDataType.TABLE && Array.isArray(rawValue) && Array.isArray(field.childFields)) {
            const nextRows = rawValue.map((row) => {
                if (!isRecord(row)) {
                    return row
                }

                return rewriteElementDataForFields(row as Record<string, unknown>, field.childFields ?? [], scopedIdsByObject)
            })

            if (nextRows.some((row, index) => row !== rawValue[index])) {
                nextData[key] = nextRows
                changed = true
            }
            continue
        }

        if (
            field.dataType === ComponentDefinitionDataType.REF &&
            isEnumerationStandardKind(field.targetEntityKind) &&
            typeof field.targetEntityId === 'string'
        ) {
            const nextValue = remapEnumerationReferenceValue(rawValue, field.targetEntityId, scopedIdsByObject)
            if (nextValue !== rawValue) {
                nextData[key] = nextValue
                changed = true
            }
        }
    }

    return changed ? nextData : data
}

export const normalizePublishedApplicationRuntimeSnapshot = (
    snapshot: PublishedApplicationSnapshot,
    remap?: SnapshotPhysicalIdentityRemap
): PublishedApplicationSnapshot => {
    const identityRemap = remap ?? resolveRuntimeSnapshotIdentityRemap(snapshot)
    const duplicatedValueIds = collectDuplicatedEnumerationValueIds(snapshot)
    const scopedIdsByObject = buildEnumerationValueIdMap(snapshot, duplicatedValueIds, identityRemap)

    let normalizedSnapshot = snapshot

    if (scopedIdsByObject.size > 0) {
        const optionValues = Object.fromEntries(
            Object.entries(snapshot.optionValues ?? {}).map(([objectId, values]) => {
                const typedValues = Array.isArray(values) ? (values as SnapshotEnumerationValueDefinition[]) : []
                const scopedIds = scopedIdsByObject.get(objectId)

                if (!scopedIds || scopedIds.size === 0) {
                    return [objectId, typedValues]
                }

                return [
                    objectId,
                    typedValues.map((value) => ({
                        ...value,
                        id: scopedIds.get(value.id) ?? value.id
                    }))
                ]
            })
        )

        const elements = Object.fromEntries(
            Object.entries(snapshot.elements ?? {}).map(([objectId, rows]) => {
                const entity = snapshot.entities?.[objectId] as SnapshotEntityDefinition | undefined
                if (!entity || !Array.isArray(rows) || !Array.isArray(entity.fields) || entity.fields.length === 0) {
                    return [objectId, rows]
                }

                return [
                    objectId,
                    rows.map((row) => {
                        if (!isRecord(row) || !isRecord(row.data)) {
                            return row
                        }

                        const nextData = rewriteElementDataForFields(row.data as Record<string, unknown>, entity.fields, scopedIdsByObject)
                        if (nextData === row.data) {
                            return row
                        }

                        return {
                            ...row,
                            data: nextData
                        }
                    })
                ]
            })
        )

        normalizedSnapshot = {
            ...snapshot,
            optionValues,
            elements
        }
    }

    return normalizeSnapshotFieldIdentities(normalizedSnapshot, identityRemap)
}

export const normalizePublishedApplicationRuntimeSource = (
    source: PublishedApplicationRuntimeSource
): PublishedApplicationRuntimeSource => {
    const identityRemap = resolveRuntimeSourceIdentityRemap(source)
    const snapshot = normalizePublishedApplicationRuntimeSnapshot(source.snapshot, identityRemap)

    if (snapshot === source.snapshot) {
        return source
    }

    return {
        ...source,
        snapshot,
        snapshotHash: calculatePublicationSnapshotHash(snapshot),
        entities: resolveExecutablePayloadEntities(snapshot, identityRemap)
    }
}
