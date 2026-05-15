import { getCodenamePrimary } from '@universo/utils'
import { ComponentDefinitionDataType } from '@universo/types'
import type { EntityDefinition, Component } from '../ddl'
import type { MetaFixedValueSnapshot, MetahubSnapshot } from '../publications/services/SnapshotSerializer'

type SetFixedValueRefPayload = {
    id: string
    codename: string | null
    dataType: string | null
    value: unknown
    name: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const resolveSnapshotCodenameText = (value: MetaFixedValueSnapshot['codename'] | null | undefined): string | null => {
    const text = getCodenamePrimary(value).trim()
    return text.length > 0 ? text : null
}

const buildSetConstantLookups = (
    snapshot: MetahubSnapshot
): {
    byValueGroupId: Map<string, Map<string, MetaFixedValueSnapshot>>
    byFixedValueId: Map<string, MetaFixedValueSnapshot>
} => {
    const byValueGroupId = new Map<string, Map<string, MetaFixedValueSnapshot>>()
    const byFixedValueId = new Map<string, MetaFixedValueSnapshot>()
    const constants = snapshot.fixedValues

    if (!constants || typeof constants !== 'object') {
        return { byValueGroupId, byFixedValueId }
    }

    for (const [valueGroupId, setConstants] of Object.entries(constants)) {
        const setLookup = new Map<string, MetaFixedValueSnapshot>()
        for (const fixedValue of setConstants ?? []) {
            if (!fixedValue || typeof fixedValue !== 'object') continue
            if (typeof fixedValue.id !== 'string' || fixedValue.id.length === 0) continue

            setLookup.set(fixedValue.id, fixedValue)
            byFixedValueId.set(fixedValue.id, fixedValue)
        }
        if (setLookup.size > 0) {
            byValueGroupId.set(valueGroupId, setLookup)
        }
    }

    return { byValueGroupId, byFixedValueId }
}

const toSetFixedValueRefPayload = (
    targetConstantId: string,
    fixedValueRecord: MetaFixedValueSnapshot | null
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

const enrichFieldWithSetConstantRef = (
    field: Component,
    lookups: {
        byValueGroupId: Map<string, Map<string, MetaFixedValueSnapshot>>
        byFixedValueId: Map<string, MetaFixedValueSnapshot>
    }
): Component => {
    const nextField: Component = {
        ...field,
        ...(field.childFields
            ? { childFields: field.childFields.map((child: Component) => enrichFieldWithSetConstantRef(child, lookups)) }
            : {})
    }

    if (
        nextField.dataType !== ComponentDefinitionDataType.REF ||
        nextField.targetEntityKind !== 'set' ||
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

export const enrichDefinitionsWithValueGroupFixedValues = (entities: EntityDefinition[], snapshot: MetahubSnapshot): EntityDefinition[] => {
    const lookups = buildSetConstantLookups(snapshot)
    if (lookups.byValueGroupId.size === 0 && lookups.byFixedValueId.size === 0) {
        return entities
    }

    return entities.map((entity) => ({
        ...entity,
        fields: (entity.fields ?? []).map((field: Component) => enrichFieldWithSetConstantRef(field, lookups))
    }))
}
