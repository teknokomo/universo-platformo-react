import type { WidgetBindingEntityCompatibilityContext, WidgetBindingSlotDefinition } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { MetahubValidationError } from '../shared/domainErrors'
import {
    MAX_WIDGET_BINDING_SOURCE_OPTIONS,
    type BindingComponentRow,
    type BindingObjectRow,
    type BindingSourceRequirements
} from './widgetBindingsStore'
import {
    bindingRequirements,
    relationReferenceRequirement,
    resolvePageInfo,
    resolveSourceName,
    isSourceCompatible
} from './widgetBindingValidation'
import { relationTargetMatchesParent } from './widgetBindingRelationCompatibility'
import type { WidgetBindingSelectedSourceOption, WidgetBindingSourcesDto } from './widgetBindingSchemas'

interface WidgetBindingSourceDiscoveryStore {
    listCandidates(
        db: SqlQueryable,
        schemaName: string,
        requirements: BindingSourceRequirements,
        offset: number,
        search?: string
    ): Promise<BindingObjectRow[]>
    listComponents(db: SqlQueryable, schemaName: string, objectIds: readonly string[]): Promise<BindingComponentRow[]>
    listRelationCompatibleObjectIds(
        db: SqlQueryable,
        schemaName: string,
        childObjectIds: readonly string[],
        parentObjectId: string,
        parentFieldCodename: string,
        parentFieldRequired: boolean
    ): Promise<string[]>
    countRecords(
        db: SqlQueryable,
        schemaName: string,
        objectIds: readonly string[]
    ): Promise<Array<{ object_id: string; records_count: number }>>
    findObjectByCodename(
        db: SqlQueryable,
        schemaName: string,
        requirements: BindingSourceRequirements,
        codename: string
    ): Promise<BindingObjectRow | null>
}

interface WidgetBindingSourceDiscoveryInput {
    readonly db: SqlQueryable
    readonly schemaName: string
    readonly widgetKey: string
    readonly slot: WidgetBindingSlotDefinition
    readonly locale: string
    readonly offset: number
    readonly search?: string
    readonly parentObject?: BindingObjectRow
    readonly selectedSourceKey?: string
}

export const discoverWidgetBindingSourcesForSlot = async (
    store: WidgetBindingSourceDiscoveryStore,
    input: WidgetBindingSourceDiscoveryInput
): Promise<WidgetBindingSourcesDto> => {
    const { db, schemaName, widgetKey, slot, locale, offset, search, parentObject, selectedSourceKey } = input
    if (slot.relation && !parentObject) {
        throw new MetahubValidationError('Select the parent source before discovering relation sources')
    }
    if (!slot.relation && parentObject) {
        throw new MetahubValidationError('This slot does not use a parent source')
    }

    const candidates = await store.listCandidates(db, schemaName, bindingRequirements(slot), offset, search)
    const hasMore = candidates.length > MAX_WIDGET_BINDING_SOURCE_OPTIONS
    const visible = candidates.slice(0, MAX_WIDGET_BINDING_SOURCE_OPTIONS)
    const components = await store.listComponents(
        db,
        schemaName,
        visible.map(({ id }) => id)
    )
    const componentsByObject = new Map<string, BindingComponentRow[]>()
    for (const component of components) {
        const rows = componentsByObject.get(component.object_id) ?? []
        rows.push(component)
        componentsByObject.set(component.object_id, rows)
    }

    const selectorKinds = slot.selectorKinds.filter((kind) => kind !== 'relation-set' || Boolean(slot.relation))
    const compatibilityContext: WidgetBindingEntityCompatibilityContext | undefined = parentObject
        ? { relationParent: { id: parentObject.id, kind: parentObject.kind, codename: parentObject.codename } }
        : undefined
    let compatibleSources = visible.filter((object) =>
        isSourceCompatible(object, componentsByObject.get(object.id) ?? [], slot, compatibilityContext)
    )
    if (slot.relation && parentObject) {
        const reference = relationReferenceRequirement(slot)
        compatibleSources = compatibleSources.filter((object) =>
            relationTargetMatchesParent(componentsByObject.get(object.id) ?? [], slot, parentObject)
        )
        const compatibleIds = await store.listRelationCompatibleObjectIds(
            db,
            schemaName,
            compatibleSources.map(({ id }) => id),
            parentObject.id,
            reference.componentCodename,
            reference.required
        )
        const compatibleIdSet = new Set(compatibleIds)
        compatibleSources = compatibleSources.filter(({ id }) => compatibleIdSet.has(id))
    }

    const recordCounts = await store.countRecords(
        db,
        schemaName,
        compatibleSources.map(({ id }) => id)
    )
    const recordCountByObject = new Map(recordCounts.map(({ object_id, records_count }) => [object_id, records_count]))
    const sources = compatibleSources.map((object) => ({
        sourceKey: object.codename,
        label: resolveSourceName(object, locale),
        recordsCount: recordCountByObject.get(object.id) ?? 0,
        selectorKinds
    }))

    let selectedSource: WidgetBindingSelectedSourceOption | null | undefined
    if (selectedSourceKey !== undefined) {
        const object = await store.findObjectByCodename(db, schemaName, bindingRequirements(slot), selectedSourceKey)
        if (!object) {
            selectedSource = null
        } else {
            const objectComponents = await store.listComponents(db, schemaName, [object.id])
            const metadataCompatible = isSourceCompatible(object, objectComponents, slot, compatibilityContext)
            let relationCompatible = true
            if (metadataCompatible && slot.relation && parentObject) {
                const reference = relationReferenceRequirement(slot)
                relationCompatible = relationTargetMatchesParent(objectComponents, slot, parentObject)
                if (relationCompatible) {
                    const compatibleIds = await store.listRelationCompatibleObjectIds(
                        db,
                        schemaName,
                        [object.id],
                        parentObject.id,
                        reference.componentCodename,
                        reference.required
                    )
                    relationCompatible = compatibleIds.includes(object.id)
                }
            }
            const selectedCounts = await store.countRecords(db, schemaName, [object.id])
            selectedSource = {
                sourceKey: object.codename,
                label: resolveSourceName(object, locale),
                recordsCount: selectedCounts[0]?.records_count ?? 0,
                selectorKinds,
                compatible: metadataCompatible && relationCompatible
            }
        }
    }

    return {
        widgetKey,
        slot: slot.key,
        selectorKinds,
        sources,
        ...(selectedSourceKey === undefined ? {} : { selectedSource: selectedSource ?? null }),
        ...resolvePageInfo(offset, MAX_WIDGET_BINDING_SOURCE_OPTIONS, hasMore)
    }
}
