import {
    semanticEntitySelectorSchema,
    type WidgetBindingEntityKind,
    type WidgetBindingSlotDefinition,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'
import { z } from 'zod'
import { withTransactionSavepoint, type DbExecutor, type SqlQueryable } from '@universo-react/utils/database'
import { uuidV7Schema } from '@universo-react/utils'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../shared/domainErrors'
import { acquireWidgetBindingObjectLockByCodename } from './widgetBindingPolicyStore'
import { acquireMetahubLayoutGraphLock } from './layoutGraphLocks'
import {
    findWidgetBindingObjectByCodename,
    findWidgetBindingRecordBySemanticKey,
    hasWidgetBindingUsage,
    countWidgetBindingObjectRecords,
    listWidgetBindingComponents,
    listWidgetBindingObjectCandidates,
    listWidgetBindingRelationCompatibleObjectIds,
    listWidgetBindingSemanticRecords,
    loadWidgetBindingObject,
    loadWidgetBindingSourceLayout,
    loadWidgetBindingWidget,
    updateWidgetBindingConfig,
    MAX_WIDGET_BINDING_RECORD_OPTIONS,
    MAX_WIDGET_BINDING_SOURCE_OPTIONS,
    type BindingComponentRow,
    type BindingObjectRow,
    type BindingLayoutRow
} from './widgetBindingsStore'
import type { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'
import {
    discoverRecordPageInputSchema,
    discoverSourcePageInputSchema,
    provisionSourceInputSchema,
    readBindingInputSchema,
    recordPageInputSchema,
    sourceKeySchema,
    sourcePageInputSchema,
    type WidgetBindingReadDto,
    type WidgetBindingRecordOption,
    type WidgetBindingRecordsDto,
    type WidgetBindingRequestContext,
    type WidgetBindingReadItem,
    type WidgetBindingSelectionInput,
    widgetBindingSelectionInputSchema,
    type WidgetBindingSelectedSourceOption,
    type WidgetBindingSourceOption,
    type WidgetBindingSourceProvisioner,
    type WidgetBindingSourcesDto
} from './widgetBindingSchemas'
import {
    assertDiscoveryAllowed,
    assertPlacementVariant,
    assertRebindAllowed,
    bindingRequirements,
    discoveryDefinition,
    encodeRegistryWidgetConfig,
    isSourceCompatible,
    asRecord,
    normalizeLocale,
    parseContext,
    parseResolvedWidget,
    parseWidgetBindingInput,
    projectRecordLabel,
    relationReferenceRequirement,
    requireDefinitionSlot,
    requireSlot,
    resolvePageInfo,
    resolveSourceName,
    searchableRecordComponentCodenames,
    selectorFor,
    semanticKeyRequirement,
    validateBoundRecord,
    validateRegistryBindings,
    validateSourceRequirements,
    withValidatedRendererConfig,
    type ResolvedWidgetContext,
    type ValidatedBindingObject
} from './widgetBindingValidation'

export { widgetBindingSourceProvisionPayloadSchema } from './widgetBindingSchemas'
export type {
    WidgetBindingReadDto,
    WidgetBindingReadItem,
    WidgetBindingRecordOption,
    WidgetBindingRecordsDto,
    WidgetBindingRequestContext,
    WidgetBindingSelectionInput,
    WidgetBindingSelectedSourceOption,
    WidgetBindingSourceOption,
    WidgetBindingSourceProvisioner,
    WidgetBindingSourceProvisionRequest,
    WidgetBindingSourcesDto
} from './widgetBindingSchemas'

export interface WidgetBindingServiceStore {
    loadSourceLayout: typeof loadWidgetBindingSourceLayout
    loadWidget: typeof loadWidgetBindingWidget
    listCandidates: typeof listWidgetBindingObjectCandidates
    listRelationCompatibleObjectIds: typeof listWidgetBindingRelationCompatibleObjectIds
    countRecords: typeof countWidgetBindingObjectRecords
    findObjectByCodename: typeof findWidgetBindingObjectByCodename
    loadObject: typeof loadWidgetBindingObject
    listComponents: typeof listWidgetBindingComponents
    findRecord: typeof findWidgetBindingRecordBySemanticKey
    listRecords: typeof listWidgetBindingSemanticRecords
    hasUsage: typeof hasWidgetBindingUsage
    updateConfig: typeof updateWidgetBindingConfig
}

export interface WidgetBindingServiceDependencies {
    readonly schemaService: Pick<MetahubSchemaService, 'ensureSchema'>
    readonly store?: WidgetBindingServiceStore
    readonly provisionSource?: WidgetBindingSourceProvisioner
    readonly syncLayoutConfig?: (db: SqlQueryable, schemaName: string, layoutId: string, userId?: string | null) => Promise<void>
}

const storeDefaults: WidgetBindingServiceStore = {
    loadSourceLayout: loadWidgetBindingSourceLayout,
    loadWidget: loadWidgetBindingWidget,
    listCandidates: listWidgetBindingObjectCandidates,
    listRelationCompatibleObjectIds: listWidgetBindingRelationCompatibleObjectIds,
    countRecords: countWidgetBindingObjectRecords,
    findObjectByCodename: findWidgetBindingObjectByCodename,
    loadObject: loadWidgetBindingObject,
    listComponents: listWidgetBindingComponents,
    findRecord: findWidgetBindingRecordBySemanticKey,
    listRecords: listWidgetBindingSemanticRecords,
    hasUsage: hasWidgetBindingUsage,
    updateConfig: updateWidgetBindingConfig
}

const relationTargetMatchesParent = (
    components: readonly BindingComponentRow[],
    slot: WidgetBindingSlotDefinition,
    parent: BindingObjectRow
): boolean => {
    const reference = relationReferenceRequirement(slot)
    const component = components.find(({ codename }) => codename === reference.componentCodename)
    return (
        component?.data_type.trim().toUpperCase() === 'REF' &&
        component.target_object_id === parent.id &&
        component.target_object_kind === parent.kind &&
        component.target_object_codename === parent.codename
    )
}

const assertRelationTargetMatchesParent = (
    components: readonly BindingComponentRow[],
    slot: WidgetBindingSlotDefinition,
    parent: BindingObjectRow
): void => {
    if (!relationTargetMatchesParent(components, slot, parent)) {
        throw new MetahubValidationError('Relation Component target does not match the selected parent source')
    }
}

export class WidgetBindingService {
    private readonly store: WidgetBindingServiceStore

    constructor(private readonly dependencies: WidgetBindingServiceDependencies) {
        this.store = dependencies.store ?? storeDefaults
    }

    private async withSchema<T>(
        context: WidgetBindingRequestContext,
        action: (db: DbExecutor, schemaName: string) => Promise<T>
    ): Promise<T> {
        parseContext(context)
        const schemaName = await this.dependencies.schemaService.ensureSchema(context.metahubId, context.userId ?? undefined)
        return withTransactionSavepoint(context.executor, (db) => action(db, schemaName))
    }

    private async loadWidget(db: SqlQueryable, schemaName: string, widgetId: string): Promise<ResolvedWidgetContext> {
        const row = await this.store.loadWidget(db, schemaName, widgetId)
        return parseResolvedWidget(row)
    }

    private async loadWidgetInLayout(
        db: SqlQueryable,
        schemaName: string,
        layoutId: string,
        widgetId: string
    ): Promise<ResolvedWidgetContext> {
        const widget = await this.loadWidget(db, schemaName, widgetId)
        if (widget.row.layout_id !== layoutId) throw new MetahubNotFoundError('Layout widget')
        return widget
    }

    private assertBasePlacementOwnsMarketingBindings(widget: ResolvedWidgetContext): void {
        if (
            widget.templateKey === 'marketing-page' &&
            typeof widget.row.scope_entity_id === 'string' &&
            typeof widget.row.base_layout_id === 'string'
        ) {
            throw new MetahubValidationError('Marketing overlay layouts must inherit Entity bindings from their base placements')
        }
    }

    private async lockAndValidateObject(
        db: SqlQueryable,
        schemaName: string,
        sourceKey: string,
        slot: WidgetBindingSlotDefinition,
        expectedKind?: string
    ): Promise<ValidatedBindingObject> {
        const requirements = bindingRequirements(slot)
        const candidate = await this.store.findObjectByCodename(db, schemaName, requirements, sourceKey)
        if (!candidate || (expectedKind && candidate.kind !== expectedKind)) throw new MetahubNotFoundError('Compatible binding source')

        const locked = await acquireWidgetBindingObjectLockByCodename(db, schemaName, candidate.kind, sourceKey, true)
        if (locked.id !== candidate.id) throw new MetahubNotFoundError('Compatible binding source')
        const object = await this.store.loadObject(db, schemaName, locked.id)
        if (object.kind !== candidate.kind || object.codename !== sourceKey) throw new MetahubNotFoundError('Compatible binding source')
        const components = await this.store.listComponents(db, schemaName, [object.id])
        const policy = validateSourceRequirements(object, components, slot)
        return { object, components, policy }
    }

    /** Validate every persisted source reference before a newly assigned widget becomes active. */
    async validateAssignedConfig(
        db: SqlQueryable,
        schemaName: string,
        input: {
            templateKey: string
            widgetKey: string
            zone: string
            config: Record<string, unknown>
        }
    ): Promise<void> {
        const widget = parseResolvedWidget({
            id: 'pending-assignment',
            layout_id: 'pending-layout',
            template_key: input.templateKey,
            scope_entity_id: null,
            base_layout_id: null,
            widget_key: input.widgetKey,
            zone: input.zone,
            config: input.config,
            widget_version: 1
        })
        const bindings = validateRegistryBindings(widget.definition, widget.neutral.bindings)
        const slotBindings = new Map(bindings.slots.map((binding) => [binding.slot, binding]))
        const objectsBySlot = new Map<string, Array<{ object: BindingObjectRow; components: readonly BindingComponentRow[] }>>()

        for (const slot of widget.definition.bindingSlots ?? []) {
            const binding = slotBindings.get(slot.key)
            if (!binding) continue
            for (const target of binding.targets) {
                const { object, components, policy } = await this.lockAndValidateObject(
                    db,
                    schemaName,
                    target.entityCodename,
                    slot,
                    target.entityKind
                )
                const slotObjects = objectsBySlot.get(slot.key) ?? []
                slotObjects.push({ object, components })
                objectsBySlot.set(slot.key, slotObjects)
                if (target.selector.kind !== 'semantic-key') continue
                const keyComponent = semanticKeyRequirement(slot)
                if (target.selector.field !== keyComponent.field) {
                    throw new MetahubValidationError('Persisted binding selector does not match the registered slot')
                }
                const records = await this.store.findRecord(
                    db,
                    schemaName,
                    object.id,
                    keyComponent.componentCodename,
                    target.selector.value
                )
                if (records.length !== 1) throw new MetahubNotFoundError('Bound Entity record')
                validateBoundRecord(slot, policy, components, records[0].data)
            }
        }

        for (const slot of widget.definition.bindingSlots ?? []) {
            if (!slot.relation || !slotBindings.has(slot.key)) continue
            const childSources = objectsBySlot.get(slot.key) ?? []
            const parentSources = objectsBySlot.get(slot.relation.parentSlot) ?? []
            if (childSources.length === 0 || parentSources.length === 0) {
                throw new MetahubValidationError('Select the parent binding before configuring this relation')
            }

            const reference = relationReferenceRequirement(slot)
            for (const childSource of childSources) {
                const parentSource = parentSources.find(({ object }) => relationTargetMatchesParent(childSource.components, slot, object))
                if (!parentSource) {
                    throw new MetahubValidationError('Relation Component target does not match the selected parent source')
                }
                const compatibleIds = await this.store.listRelationCompatibleObjectIds(
                    db,
                    schemaName,
                    [childSource.object.id],
                    parentSource.object.id,
                    reference.componentCodename,
                    reference.required
                )
                if (!compatibleIds.includes(childSource.object.id)) {
                    throw new MetahubValidationError('Related records do not belong to the selected parent source')
                }
            }
        }
    }

    private async listSourcesForSlot(
        db: SqlQueryable,
        schemaName: string,
        widgetKey: string,
        slot: WidgetBindingSlotDefinition,
        locale: string,
        offset: number,
        search?: string,
        parentObject?: BindingObjectRow,
        selectedSourceKey?: string
    ): Promise<WidgetBindingSourcesDto> {
        if (slot.relation && !parentObject) {
            throw new MetahubValidationError('Select the parent source before discovering relation sources')
        }
        if (!slot.relation && parentObject) {
            throw new MetahubValidationError('This slot does not use a parent source')
        }
        const candidates = await this.store.listCandidates(db, schemaName, bindingRequirements(slot), offset, search)
        const hasMore = candidates.length > MAX_WIDGET_BINDING_SOURCE_OPTIONS
        const visible = candidates.slice(0, MAX_WIDGET_BINDING_SOURCE_OPTIONS)
        const components = await this.store.listComponents(
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
        let compatibleSources = visible.filter((object) => isSourceCompatible(object, componentsByObject.get(object.id) ?? [], slot))
        let relationCompatibleObjectIds: Set<string> | undefined
        if (slot.relation && parentObject) {
            const reference = relationReferenceRequirement(slot)
            compatibleSources = compatibleSources.filter((object) =>
                relationTargetMatchesParent(componentsByObject.get(object.id) ?? [], slot, parentObject)
            )
            relationCompatibleObjectIds = new Set(
                await this.store.listRelationCompatibleObjectIds(
                    db,
                    schemaName,
                    compatibleSources.map(({ id }) => id),
                    parentObject.id,
                    reference.componentCodename,
                    reference.required
                )
            )
            compatibleSources = compatibleSources.filter(({ id }) => relationCompatibleObjectIds?.has(id))
        }
        const recordCounts = await this.store.countRecords(
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
            const object = await this.store.findObjectByCodename(db, schemaName, bindingRequirements(slot), selectedSourceKey)
            if (!object) {
                selectedSource = null
            } else {
                const objectComponents = await this.store.listComponents(db, schemaName, [object.id])
                const metadataCompatible = isSourceCompatible(object, objectComponents, slot)
                let relationCompatible = true
                if (metadataCompatible && slot.relation && parentObject) {
                    const reference = relationReferenceRequirement(slot)
                    relationCompatible = relationTargetMatchesParent(objectComponents, slot, parentObject)
                    if (relationCompatible) {
                        const compatibleIds = await this.store.listRelationCompatibleObjectIds(
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
                const selectedCounts = await this.store.countRecords(db, schemaName, [object.id])
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

    private async listRecordsForSlot(
        db: SqlQueryable,
        schemaName: string,
        widgetKey: string,
        slot: WidgetBindingSlotDefinition,
        sourceKey: string,
        locale: string,
        offset: number,
        search?: string,
        selectedSemanticKey?: string
    ): Promise<WidgetBindingRecordsDto> {
        if (!slot.selectorKinds.includes('semantic-key')) {
            throw new MetahubValidationError('This slot does not select individual semantic records')
        }
        const keyComponent = semanticKeyRequirement(slot)
        const { object, components, policy } = await this.lockAndValidateObject(db, schemaName, sourceKey, slot)
        const rawRows = await this.store.listRecords(
            db,
            schemaName,
            object.id,
            keyComponent.componentCodename,
            MAX_WIDGET_BINDING_RECORD_OPTIONS + 1,
            offset,
            search,
            searchableRecordComponentCodenames(slot)
        )
        const hasMore = rawRows.length > MAX_WIDGET_BINDING_RECORD_OPTIONS
        const records = rawRows.slice(0, MAX_WIDGET_BINDING_RECORD_OPTIONS).flatMap((row) => {
            const data = asRecord(row.data)
            const semanticKey = data[keyComponent.componentCodename]
            if (
                typeof semanticKey !== 'string' ||
                !semanticEntitySelectorSchema.safeParse({ kind: 'semantic-key', field: keyComponent.field, value: semanticKey }).success
            ) {
                return []
            }
            try {
                const validData = validateBoundRecord(slot, policy, components, data)
                return [{ semanticKey, label: projectRecordLabel(slot, validData, locale, 'Unnamed content') }]
            } catch {
                return []
            }
        })
        const uniqueKeys = new Set<string>()
        for (const record of records) {
            if (uniqueKeys.has(record.semanticKey)) throw new MetahubValidationError('Source Entity contains duplicate semantic keys')
            uniqueKeys.add(record.semanticKey)
        }

        let selectedRecord: WidgetBindingRecordOption | null | undefined
        if (selectedSemanticKey !== undefined) {
            const selectedRows = await this.store.findRecord(db, schemaName, object.id, keyComponent.componentCodename, selectedSemanticKey)
            if (selectedRows.length > 1) throw new MetahubValidationError('Source Entity contains duplicate semantic keys')
            if (selectedRows.length === 1) {
                const data = asRecord(selectedRows[0].data)
                const semanticKey = data[keyComponent.componentCodename]
                if (
                    typeof semanticKey === 'string' &&
                    semanticEntitySelectorSchema.safeParse({ kind: 'semantic-key', field: keyComponent.field, value: semanticKey }).success
                ) {
                    const validData = validateBoundRecord(slot, policy, components, data)
                    selectedRecord = { semanticKey, label: projectRecordLabel(slot, validData, locale, 'Unnamed content') }
                } else {
                    selectedRecord = null
                }
            } else {
                selectedRecord = null
            }
        }

        return {
            widgetKey,
            slot: slot.key,
            sourceKey: object.codename,
            records,
            ...(selectedSemanticKey === undefined ? {} : { selectedRecord: selectedRecord ?? null }),
            ...resolvePageInfo(offset, MAX_WIDGET_BINDING_RECORD_OPTIONS, hasMore)
        }
    }

    async listSources(
        context: WidgetBindingRequestContext,
        rawInput: {
            layoutId: string
            widgetId: string
            slot: string
            widgetKey?: string
            variant?: string
            locale?: string
            offset?: number
            search?: string
            parentSourceKey?: string
            selectedSourceKey?: string
        }
    ): Promise<WidgetBindingSourcesDto> {
        const input = parseWidgetBindingInput(sourcePageInputSchema, rawInput)
        return this.withSchema(context, async (db, schemaName) => {
            await acquireMetahubLayoutGraphLock(db, schemaName)
            const widget = await this.loadWidgetInLayout(db, schemaName, input.layoutId, input.widgetId)
            assertRebindAllowed(widget)
            if (input.widgetKey !== undefined && widget.widgetKey !== input.widgetKey) throw new MetahubNotFoundError('Layout widget')
            assertPlacementVariant(widget, input.variant)
            const slot = requireSlot(widget, input.slot)
            let parentObject: BindingObjectRow | undefined
            if (slot.relation) {
                if (!input.parentSourceKey) throw new MetahubValidationError('Select the parent source before configuring this relation')
                const parentSlot = requireSlot(widget, slot.relation.parentSlot)
                const parent = await this.lockAndValidateObject(db, schemaName, input.parentSourceKey, parentSlot)
                parentObject = parent.object
            } else if (input.parentSourceKey !== undefined) {
                throw new MetahubValidationError('This slot does not use a parent source')
            }
            return this.listSourcesForSlot(
                db,
                schemaName,
                widget.widgetKey,
                slot,
                input.locale,
                input.offset,
                input.search,
                parentObject,
                input.selectedSourceKey
            )
        })
    }

    async discoverSources(
        context: WidgetBindingRequestContext,
        rawInput: {
            layoutId: string
            templateKey: 'marketing-page'
            widgetKey: string
            slot: string
            variant?: string
            locale?: string
            offset?: number
            search?: string
            parentSourceKey?: string
            selectedSourceKey?: string
        }
    ): Promise<WidgetBindingSourcesDto> {
        const input = parseWidgetBindingInput(discoverSourcePageInputSchema, rawInput)
        const definition = discoveryDefinition(input.widgetKey, input.variant)
        assertDiscoveryAllowed(definition)
        const slot = requireDefinitionSlot(definition, input.slot)
        return this.withSchema(context, async (db, schemaName) => {
            await acquireMetahubLayoutGraphLock(db, schemaName)
            let parentObject: BindingObjectRow | undefined
            if (slot.relation) {
                if (!input.parentSourceKey) throw new MetahubValidationError('Select the parent source before configuring this relation')
                const parentSlot = requireDefinitionSlot(definition, slot.relation.parentSlot)
                const parent = await this.lockAndValidateObject(db, schemaName, input.parentSourceKey, parentSlot)
                parentObject = parent.object
            } else if (input.parentSourceKey !== undefined) {
                throw new MetahubValidationError('This slot does not use a parent source')
            }
            return this.listSourcesForSlot(
                db,
                schemaName,
                input.widgetKey,
                slot,
                input.locale,
                input.offset,
                input.search,
                parentObject,
                input.selectedSourceKey
            )
        })
    }

    /** Create an empty Object model from a compatible source's registered slot schema. */
    async provisionSource(
        context: WidgetBindingRequestContext,
        rawInput: {
            layoutId: string
            templateKey: 'marketing-page'
            widgetKey: string
            slot: string
            variant?: string
            locale?: string
            templateSourceKey: string
            parentSourceKey?: string
            name: string
        }
    ): Promise<{ readonly widgetKey: string; readonly slot: string; readonly source: WidgetBindingSourceOption }> {
        const input = parseWidgetBindingInput(provisionSourceInputSchema, rawInput)
        const definition = discoveryDefinition(input.widgetKey, input.variant)
        assertDiscoveryAllowed(definition)
        const slot = requireDefinitionSlot(definition, input.slot)
        const provisioner = this.dependencies.provisionSource
        if (!provisioner) throw new MetahubValidationError('Compatible content source provisioning is unavailable')

        return this.withSchema(context, async (db, schemaName) => {
            await acquireMetahubLayoutGraphLock(db, schemaName)
            const layout: BindingLayoutRow = await this.store.loadSourceLayout(db, schemaName, input.layoutId, true)
            if (layout.template_key !== input.templateKey || layout.scope_entity_id !== null || layout.base_layout_id !== null) {
                throw new MetahubNotFoundError('Marketing source layout')
            }

            let parentObject: BindingObjectRow | undefined
            if (slot.relation) {
                if (!input.parentSourceKey) {
                    throw new MetahubValidationError('Select the parent source before creating a relation content model')
                }
                const parentSlot = requireDefinitionSlot(definition, slot.relation.parentSlot)
                parentObject = (await this.lockAndValidateObject(db, schemaName, input.parentSourceKey, parentSlot)).object
            } else if (input.parentSourceKey !== undefined) {
                throw new MetahubValidationError('This slot does not use a parent source')
            }

            const compatibleTemplates = await this.listSourcesForSlot(
                db,
                schemaName,
                input.widgetKey,
                slot,
                input.locale,
                0,
                undefined,
                parentObject,
                input.templateSourceKey
            )
            const templateSource = compatibleTemplates.selectedSource
            if (!templateSource?.compatible) throw new MetahubNotFoundError('Compatible content source')

            const source = await this.lockAndValidateObject(db, schemaName, input.templateSourceKey, slot)
            const created = await provisioner({
                db,
                metahubId: context.metahubId,
                userId: context.userId,
                schemaName,
                templateSource: source.object,
                slot,
                name: input.name.normalize('NFKC').replace(/\s+/gu, ' ').trim(),
                locale: normalizeLocale(input.locale),
                ...(parentObject ? { parentObject } : {})
            })

            return {
                widgetKey: input.widgetKey,
                slot: slot.key,
                source: {
                    ...created,
                    selectorKinds: slot.selectorKinds.filter((kind) => kind !== 'relation-set' || Boolean(slot.relation))
                }
            }
        })
    }

    async listSemanticRecords(
        context: WidgetBindingRequestContext,
        rawInput: {
            layoutId: string
            widgetId: string
            slot: string
            widgetKey?: string
            variant?: string
            sourceKey: string
            locale?: string
            offset?: number
            search?: string
            selectedSemanticKey?: string
        }
    ): Promise<WidgetBindingRecordsDto> {
        const input = parseWidgetBindingInput(recordPageInputSchema, rawInput)
        return this.withSchema(context, async (db, schemaName) => {
            await acquireMetahubLayoutGraphLock(db, schemaName)
            const widget = await this.loadWidgetInLayout(db, schemaName, input.layoutId, input.widgetId)
            assertRebindAllowed(widget)
            if (input.widgetKey !== undefined && widget.widgetKey !== input.widgetKey) throw new MetahubNotFoundError('Layout widget')
            assertPlacementVariant(widget, input.variant)
            const slot = requireSlot(widget, input.slot)
            return this.listRecordsForSlot(
                db,
                schemaName,
                widget.widgetKey,
                slot,
                input.sourceKey,
                input.locale,
                input.offset,
                input.search,
                input.selectedSemanticKey
            )
        })
    }

    async discoverSemanticRecords(
        context: WidgetBindingRequestContext,
        rawInput: {
            layoutId: string
            templateKey: 'marketing-page'
            widgetKey: string
            slot: string
            variant?: string
            sourceKey: string
            locale?: string
            offset?: number
            search?: string
            selectedSemanticKey?: string
        }
    ): Promise<WidgetBindingRecordsDto> {
        const input = parseWidgetBindingInput(discoverRecordPageInputSchema, rawInput)
        const definition = discoveryDefinition(input.widgetKey, input.variant)
        assertDiscoveryAllowed(definition)
        const slot = requireDefinitionSlot(definition, input.slot)
        return this.withSchema(context, async (db, schemaName) => {
            await acquireMetahubLayoutGraphLock(db, schemaName)
            return this.listRecordsForSlot(
                db,
                schemaName,
                input.widgetKey,
                slot,
                input.sourceKey,
                input.locale,
                input.offset,
                input.search,
                input.selectedSemanticKey
            )
        })
    }

    async readBinding(
        context: WidgetBindingRequestContext,
        rawInput: { layoutId: string; widgetId: string; locale?: string }
    ): Promise<WidgetBindingReadDto> {
        const input = readBindingInputSchema.parse(rawInput)
        return this.withSchema(context, async (db, schemaName) => {
            await acquireMetahubLayoutGraphLock(db, schemaName)
            const widget = await this.loadWidgetInLayout(db, schemaName, input.layoutId, input.widgetId)
            const binding: WidgetEntityBindingEnvelope | undefined = widget.neutral.bindings
            const items: WidgetBindingReadItem[] = []
            for (const slotBinding of binding?.slots ?? []) {
                const slot = requireSlot(widget, slotBinding.slot)
                for (const target of slotBinding.targets) {
                    const { object, components, policy } = await this.lockAndValidateObject(
                        db,
                        schemaName,
                        target.entityCodename,
                        slot,
                        target.entityKind
                    )
                    let selectionLabel = resolveSourceName(object, input.locale)
                    let semanticKey: string | undefined
                    if (target.selector.kind === 'semantic-key') {
                        const keyComponent = semanticKeyRequirement(slot)
                        if (target.selector.field !== keyComponent.field) {
                            throw new MetahubValidationError('Persisted binding selector does not match the registered slot')
                        }
                        semanticKey = target.selector.value
                        const records = await this.store.findRecord(
                            db,
                            schemaName,
                            object.id,
                            keyComponent.componentCodename,
                            target.selector.value
                        )
                        if (records.length !== 1) throw new MetahubNotFoundError('Bound Entity record')
                        const data = validateBoundRecord(slot, policy, components, records[0].data)
                        selectionLabel = projectRecordLabel(slot, data, input.locale, 'Unnamed content')
                    }
                    items.push({
                        slot: slot.key,
                        sourceKey: object.codename,
                        sourceName: resolveSourceName(object, input.locale),
                        selectorKind: target.selector.kind,
                        selectionLabel,
                        ...(semanticKey === undefined ? {} : { semanticKey })
                    })
                }
            }
            return { widgetKey: widget.widgetKey, version: widget.row.widget_version, bindings: items }
        })
    }

    /** Replace all placement bindings atomically, including dependent relation slots. */
    async replaceBindings(
        context: WidgetBindingRequestContext,
        rawInput: {
            layoutId: string
            widgetId: string
            expectedVersion: number
            bindings: readonly WidgetBindingSelectionInput[]
            locale?: string
            rendererConfig?: Record<string, unknown>
        }
    ): Promise<{ readonly widgetKey: string; readonly version: number }> {
        const inputSchema = z
            .object({
                layoutId: uuidV7Schema,
                widgetId: uuidV7Schema,
                expectedVersion: z.number().int().positive(),
                bindings: z.array(widgetBindingSelectionInputSchema).max(16),
                locale: z.string().trim().min(2).max(16).default('en'),
                rendererConfig: z.record(z.string(), z.unknown()).optional()
            })
            .strict()
        const input = inputSchema.parse(rawInput)
        return this.withSchema(context, async (db, schemaName) => {
            await acquireMetahubLayoutGraphLock(db, schemaName)
            const initialWidget = await this.loadWidgetInLayout(db, schemaName, input.layoutId, input.widgetId)
            this.assertBasePlacementOwnsMarketingBindings(initialWidget)
            assertRebindAllowed(initialWidget)
            const targetWidget = input.rendererConfig ? withValidatedRendererConfig(initialWidget, input.rendererConfig) : initialWidget

            const selections = new Map<string, WidgetBindingSelectionInput>()
            for (const selection of input.bindings) {
                if (selections.has(selection.slot)) throw new MetahubValidationError('Each binding slot can be selected only once')
                selections.set(selection.slot, selection)
            }
            for (const slot of targetWidget.definition.bindingSlots ?? []) {
                if (slot.relation && !selections.has(slot.relation.parentSlot) && selections.has(slot.key)) {
                    throw new MetahubValidationError('Select the parent binding before configuring this relation')
                }
            }

            const slotTargets = new Map<string, WidgetEntityBindingEnvelope['slots'][number]['targets']>()
            const objectsBySlot = new Map<string, BindingObjectRow>()
            const componentsBySlot = new Map<string, readonly BindingComponentRow[]>()
            const orderedSelections = [...selections.values()].sort((left, right) =>
                `${left.sourceKey}\u0000${left.slot}`.localeCompare(`${right.sourceKey}\u0000${right.slot}`)
            )
            for (const selection of orderedSelections) {
                const slot = requireSlot(targetWidget, selection.slot)
                const selector = selectorFor(slot, selection.selector)
                const { object, components, policy } = await this.lockAndValidateObject(db, schemaName, selection.sourceKey, slot)
                objectsBySlot.set(slot.key, object)
                componentsBySlot.set(slot.key, components)
                if (selector.kind === 'semantic-key') {
                    const keyComponent = semanticKeyRequirement(slot)
                    if (selector.field !== keyComponent.field) {
                        throw new MetahubValidationError('Persisted binding selector does not match the registered slot')
                    }
                    const records = await this.store.findRecord(db, schemaName, object.id, keyComponent.componentCodename, selector.value)
                    if (records.length !== 1) throw new MetahubNotFoundError('Compatible Entity record')
                    validateBoundRecord(slot, policy, components, records[0].data)
                }
                slotTargets.set(slot.key, [
                    {
                        entityKind: object.kind as WidgetBindingEntityKind,
                        entityCodename: object.codename,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ])
            }

            for (const selection of selections.values()) {
                const slot = requireSlot(targetWidget, selection.slot)
                if (!slot.relation) continue
                const childObject = objectsBySlot.get(slot.key)
                const parentObject = objectsBySlot.get(slot.relation.parentSlot)
                if (!childObject || !parentObject) {
                    throw new MetahubValidationError('Select the parent binding before configuring this relation')
                }
                const reference = relationReferenceRequirement(slot)
                assertRelationTargetMatchesParent(componentsBySlot.get(slot.key) ?? [], slot, parentObject)
                const compatibleIds = await this.store.listRelationCompatibleObjectIds(
                    db,
                    schemaName,
                    [childObject.id],
                    parentObject.id,
                    reference.componentCodename,
                    reference.required
                )
                if (!compatibleIds.includes(childObject.id)) {
                    throw new MetahubValidationError('Related records do not belong to the selected parent source')
                }
            }

            const bindings = validateRegistryBindings(targetWidget.definition, {
                version: 1,
                slots: [...slotTargets].map(([slot, targets]) => ({ slot, targets }))
            })
            const currentRow = await this.store.loadWidget(db, schemaName, input.widgetId, true)
            const currentWidget = parseResolvedWidget(currentRow)
            this.assertBasePlacementOwnsMarketingBindings(currentWidget)
            if (currentRow.layout_id !== input.layoutId || currentRow.widget_key !== initialWidget.row.widget_key) {
                throw new MetahubNotFoundError('Layout widget')
            }
            if (currentRow.widget_version !== input.expectedVersion) {
                throw new MetahubConflictError('Widget bindings changed while they were being updated')
            }
            if (currentWidget.definition.key !== initialWidget.definition.key) {
                throw new MetahubConflictError('Widget binding contract changed while it was being updated')
            }

            const writeWidget = input.rendererConfig ? withValidatedRendererConfig(currentWidget, input.rendererConfig) : currentWidget
            const config = encodeRegistryWidgetConfig(writeWidget, bindings)
            const version = await this.store.updateConfig(db, schemaName, {
                widgetId: currentRow.id,
                layoutId: currentRow.layout_id,
                expectedVersion: input.expectedVersion,
                config,
                userId: context.userId
            })
            await this.dependencies.syncLayoutConfig?.(db, schemaName, currentRow.layout_id, context.userId)
            return { widgetKey: currentWidget.widgetKey, version }
        })
    }

    async checkUsage(
        context: WidgetBindingRequestContext,
        rawInput: {
            layoutId: string
            widgetId: string
            slot: string
            sourceKey: string
            semanticKey?: string
            includeCurrentWidget?: boolean
        }
    ): Promise<{ readonly inUse: boolean }> {
        const inputSchema = z
            .object({
                layoutId: uuidV7Schema,
                widgetId: uuidV7Schema,
                slot: z.string().trim().min(1).max(64),
                sourceKey: sourceKeySchema,
                semanticKey: z.string().trim().min(1).max(128).optional(),
                includeCurrentWidget: z.boolean().default(false)
            })
            .strict()
        const input = inputSchema.parse(rawInput)
        return this.withSchema(context, async (db, schemaName) => {
            await acquireMetahubLayoutGraphLock(db, schemaName)
            const widget = await this.loadWidgetInLayout(db, schemaName, input.layoutId, input.widgetId)
            const slot = requireSlot(widget, input.slot)
            const { object } = await this.lockAndValidateObject(db, schemaName, input.sourceKey, slot)
            if (input.semanticKey !== undefined) {
                if (!slot.selectorKinds.includes('semantic-key')) {
                    throw new MetahubValidationError('This slot does not bind individual semantic records')
                }
                const keyComponent = semanticKeyRequirement(slot)
                const selector = selectorFor(slot, { kind: 'semantic-key', value: input.semanticKey })
                if (selector.kind !== 'semantic-key') throw new MetahubValidationError('Invalid semantic selector')
                const matches = await this.store.findRecord(db, schemaName, object.id, keyComponent.componentCodename, selector.value)
                if (matches.length !== 1) throw new MetahubNotFoundError('Compatible Entity record')
            }
            const inUse = await this.store.hasUsage(db, schemaName, {
                entityKind: object.kind,
                entityCodename: object.codename,
                ...(input.semanticKey === undefined ? {} : { semanticKey: input.semanticKey }),
                ...(input.includeCurrentWidget ? {} : { excludeWidgetId: input.widgetId })
            })
            return { inUse }
        })
    }
}
