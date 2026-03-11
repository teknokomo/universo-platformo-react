import { AttributeDataType } from '@universo/types'
import type { EntityDefinition, FieldDefinition } from '../ddl'
import type { MetaConstantSnapshot, MetahubSnapshot } from '../publications/services/SnapshotSerializer'

type SetConstantRefPayload = {
    id: string
    codename: string | null
    dataType: string | null
    value: unknown
    name: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const buildSetConstantLookups = (
    snapshot: MetahubSnapshot
): {
    bySetId: Map<string, Map<string, MetaConstantSnapshot>>
    byConstantId: Map<string, MetaConstantSnapshot>
} => {
    const bySetId = new Map<string, Map<string, MetaConstantSnapshot>>()
    const byConstantId = new Map<string, MetaConstantSnapshot>()
    const constants = snapshot.constants

    if (!constants || typeof constants !== 'object') {
        return { bySetId, byConstantId }
    }

    for (const [setId, setConstants] of Object.entries(constants)) {
        const setLookup = new Map<string, MetaConstantSnapshot>()
        for (const constant of setConstants ?? []) {
            if (!constant || typeof constant !== 'object') continue
            if (typeof constant.id !== 'string' || constant.id.length === 0) continue

            setLookup.set(constant.id, constant)
            byConstantId.set(constant.id, constant)
        }
        if (setLookup.size > 0) {
            bySetId.set(setId, setLookup)
        }
    }

    return { bySetId, byConstantId }
}

const toSetConstantRefPayload = (
    targetConstantId: string,
    constant: MetaConstantSnapshot | null
): SetConstantRefPayload | { id: string } => {
    if (!constant) {
        return { id: targetConstantId }
    }

    const presentationName = isRecord(constant.presentation) ? constant.presentation.name : null

    return {
        id: constant.id,
        codename: typeof constant.codename === 'string' ? constant.codename : null,
        dataType: typeof constant.dataType === 'string' ? constant.dataType : null,
        value: Object.prototype.hasOwnProperty.call(constant, 'value') ? constant.value : null,
        name: presentationName ?? null
    }
}

const enrichFieldWithSetConstantRef = (
    field: FieldDefinition,
    lookups: {
        bySetId: Map<string, Map<string, MetaConstantSnapshot>>
        byConstantId: Map<string, MetaConstantSnapshot>
    }
): FieldDefinition => {
    const nextField: FieldDefinition = {
        ...field,
        ...(field.childFields
            ? { childFields: field.childFields.map((child: FieldDefinition) => enrichFieldWithSetConstantRef(child, lookups)) }
            : {})
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

export const enrichDefinitionsWithSetConstants = (entities: EntityDefinition[], snapshot: MetahubSnapshot): EntityDefinition[] => {
    const lookups = buildSetConstantLookups(snapshot)
    if (lookups.bySetId.size === 0 && lookups.byConstantId.size === 0) {
        return entities
    }

    return entities.map((entity) => ({
        ...entity,
        fields: (entity.fields ?? []).map((field: FieldDefinition) => enrichFieldWithSetConstantRef(field, lookups))
    }))
}
