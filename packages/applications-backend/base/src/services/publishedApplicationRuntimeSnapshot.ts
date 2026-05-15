import { createHash } from 'crypto'
import { ComponentDefinitionDataType } from '@universo/types'
import { getCodenamePrimary, serialization } from '@universo/utils'
import type {
    PublishedApplicationRuntimeSource,
    PublishedApplicationSnapshot,
    SnapshotEntityDefinition,
    SnapshotEnumerationValueDefinition,
    SnapshotComponent
} from './applicationSyncContracts'
import { resolveExecutablePayloadEntities } from './publishedApplicationSnapshotEntities'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const buildDeterministicScopedUuid = (seed: string): string => {
    const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('')
    hex[12] = '5'
    hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16)

    return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex
        .slice(20, 32)
        .join('')}`
}

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
    duplicatedValueIds: Set<string>
): Map<string, Map<string, string>> => {
    const scopedIdsByObject = new Map<string, Map<string, string>>()

    if (duplicatedValueIds.size === 0) {
        return scopedIdsByObject
    }

    for (const [objectId, values] of Object.entries(snapshot.optionValues ?? {})) {
        const typedValues = Array.isArray(values) ? (values as SnapshotEnumerationValueDefinition[]) : []
        const scopedIds = new Map<string, string>()

        for (const value of typedValues) {
            if (!duplicatedValueIds.has(value.id)) {
                continue
            }

            scopedIds.set(value.id, buildDeterministicScopedUuid(`application-runtime-enumeration-value:${objectId}:${value.id}`))
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

export const normalizePublishedApplicationRuntimeSnapshot = (snapshot: PublishedApplicationSnapshot): PublishedApplicationSnapshot => {
    const duplicatedValueIds = collectDuplicatedEnumerationValueIds(snapshot)
    const scopedIdsByObject = buildEnumerationValueIdMap(snapshot, duplicatedValueIds)

    if (scopedIdsByObject.size === 0) {
        return snapshot
    }

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

    return {
        ...snapshot,
        optionValues,
        elements
    }
}

export const normalizePublishedApplicationRuntimeSource = (
    source: PublishedApplicationRuntimeSource
): PublishedApplicationRuntimeSource => {
    const snapshot = normalizePublishedApplicationRuntimeSnapshot(source.snapshot)

    if (snapshot === source.snapshot) {
        return source
    }

    return {
        ...source,
        snapshot,
        snapshotHash: calculatePublicationSnapshotHash(snapshot),
        entities: resolveExecutablePayloadEntities(snapshot)
    }
}
