import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import type { EntityDefinition, FieldDefinition } from '@universo/schema-ddl'
import {
    BUILTIN_ENTITY_TYPE_REGISTRY,
    MetaEntityKind,
    SHARED_OBJECT_KINDS,
    getLegacyCompatibleObjectKind,
    getLegacyCompatibleObjectKindForKindKey,
    isEnabledComponentConfig,
    type CatalogSystemFieldsSnapshot,
    type ComponentManifest,
    type EntityKind,
    type EntityTypeUIConfig,
    type EnumerationValueDefinition,
    type MetahubScriptDefinition,
    type MetahubSnapshotVersionEnvelope,
    type SharedBehavior,
    type SharedEntityKind,
    type VersionedLocalizedContent
} from '@universo/types'
import { serialization } from '@universo/utils'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { MetahubScriptsService } from '../../scripts/services/MetahubScriptsService'
import { EntityTypeService } from '../../entities/services/EntityTypeService'
import { ActionService } from '../../entities/services/ActionService'
import { EventBindingService } from '../../entities/services/EventBindingService'
import { CURRENT_STRUCTURE_VERSION, structureVersionToSemver } from '../../metahubs/services/structureVersions'
import { generateTableName } from '../../ddl'
import { getCodenameText } from '../../shared/codename'
import { buildMergedSharedEntityList, type SharedEntityListItem } from '../../shared/mergedSharedEntityList'
import { SharedContainerService } from '../../shared/services/SharedContainerService'
import { SharedEntityOverridesService, type SharedEntityOverrideRow } from '../../shared/services/SharedEntityOverridesService'
import { createLogger } from '../../../utils/logger'

const log = createLogger('SnapshotSerializer')

const resolveLegacyCompatibleKind = (kind: unknown, config?: unknown): 'catalog' | 'hub' | 'set' | 'enumeration' | null => {
    if (kind === MetaEntityKind.CATALOG || kind === MetaEntityKind.HUB || kind === MetaEntityKind.SET || kind === MetaEntityKind.ENUMERATION) {
        return kind
    }

    const fromConfig = getLegacyCompatibleObjectKind(config)
    if (fromConfig && fromConfig !== 'document') {
        return fromConfig
    }

    const fromKindKey = getLegacyCompatibleObjectKindForKindKey(kind)
    return fromKindKey && fromKindKey !== 'document' ? fromKindKey : null
}

export type SnapshotCodenameValue = VersionedLocalizedContent<string> | string

const mergeEntitySnapshotConfig = (definitionConfig: unknown, entityConfig: unknown): Record<string, unknown> => {
    const baseDefinitionConfig = ensureRecord(definitionConfig)
    const baseEntityConfig = ensureRecord(entityConfig)
    const definitionCompatibility = ensureRecord(baseDefinitionConfig.compatibility)
    const entityCompatibility = ensureRecord(baseEntityConfig.compatibility)

    if (Object.keys(definitionCompatibility).length === 0 && Object.keys(entityCompatibility).length === 0) {
        return {
            ...baseDefinitionConfig,
            ...baseEntityConfig
        }
    }

    return {
        ...baseDefinitionConfig,
        ...baseEntityConfig,
        compatibility: {
            ...definitionCompatibility,
            ...entityCompatibility
        }
    }
}

export interface MetahubSnapshot {
    version: 1
    versionEnvelope: MetahubSnapshotVersionEnvelope
    generatedAt: string
    metahubId: string
    entities: Record<string, MetaEntitySnapshot>
    entityTypeDefinitions?: Record<string, MetahubEntityTypeDefinitionSnapshot>
    elements?: Record<string, MetaElementSnapshot[]>
    enumerationValues?: Record<string, MetaEnumerationValueSnapshot[]>
    constants?: Record<string, MetaConstantSnapshot[]>
    sharedAttributes?: MetaFieldSnapshot[]
    sharedConstants?: MetaConstantSnapshot[]
    sharedEnumerationValues?: MetaEnumerationValueSnapshot[]
    sharedEntityOverrides?: MetahubSharedEntityOverrideSnapshot[]
    systemFields?: Record<string, CatalogSystemFieldsSnapshot>
    scripts?: MetahubSnapshotScript[]
    /**
     * Active UI layouts captured at publication time.
     * MVP: only the Dashboard template is supported.
     */
    layouts?: MetahubLayoutSnapshot[]
    catalogLayouts?: MetahubCatalogLayoutSnapshot[]
    /**
     * Zone/widget assignments for layouts.
     */
    layoutZoneWidgets?: MetahubLayoutZoneWidgetSnapshot[]
    catalogLayoutWidgetOverrides?: MetahubCatalogLayoutWidgetOverrideSnapshot[]
    /**
     * Default layout id (must reference one of `layouts` when present).
     */
    defaultLayoutId?: string | null
    /**
     * UI layout configuration captured at publication time.
     * This is used by runtime UI (apps-template-mui) to render Dashboard sections.
     *
     * NOTE: This represents the DEFAULT layout config for backward/forward compatibility.
     */
    layoutConfig?: Record<string, unknown>
}

export interface MetahubLayoutSnapshot {
    id: string
    templateKey: string
    name: Record<string, unknown>
    description?: Record<string, unknown> | null
    config: Record<string, unknown>
    isDefault: boolean
    isActive: boolean
    sortOrder: number
}

export interface MetahubCatalogLayoutSnapshot extends MetahubLayoutSnapshot {
    catalogId: string
    baseLayoutId: string
}

export interface MetahubSnapshotScript extends Omit<MetahubScriptDefinition, 'codename' | 'sourceCode'> {
    codename: SnapshotCodenameValue
    sourceCode?: string
}

export interface MetahubEntityTypeDefinitionSnapshot {
    id: string
    kindKey: EntityKind | string
    codename: SnapshotCodenameValue
    presentation: Record<string, unknown>
    components: ComponentManifest
    ui: EntityTypeUIConfig
    config: Record<string, unknown>
    isBuiltin: boolean
    published?: boolean
}

export interface MetahubEntityActionSnapshot {
    id: string
    codename: SnapshotCodenameValue
    presentation: Record<string, unknown>
    actionType: 'script' | 'builtin'
    scriptId: string | null
    config: Record<string, unknown>
    sortOrder: number
}

export interface MetahubEventBindingSnapshot {
    id: string
    eventName: string
    actionId: string
    priority: number
    isActive: boolean
    config: Record<string, unknown>
}

export interface MetahubSharedEntityOverrideSnapshot {
    id: string
    entityKind: SharedEntityKind
    sharedEntityId: string
    targetObjectId: string
    isExcluded: boolean
    isActive: boolean | null
    sortOrder: number | null
}

export interface MetahubLayoutZoneWidgetSnapshot {
    id: string
    layoutId: string
    zone: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
}

/** @deprecated Use MetahubLayoutZoneWidgetSnapshot instead. */
export type MetahubLayoutZoneModuleSnapshot = MetahubLayoutZoneWidgetSnapshot

export interface MetahubCatalogLayoutWidgetOverrideSnapshot {
    id: string
    catalogLayoutId: string
    baseWidgetId: string
    zone?: string | null
    sortOrder?: number | null
    config?: Record<string, unknown> | null
    isActive?: boolean | null
    isDeletedOverride?: boolean
}

export interface MetaEntitySnapshot extends Omit<EntityDefinition, 'codename' | 'fields'> {
    codename: SnapshotCodenameValue
    fields: MetaFieldSnapshot[]
    hubs: string[]
    tableName?: string
    config?: Record<string, unknown>
    actions?: MetahubEntityActionSnapshot[]
    eventBindings?: MetahubEventBindingSnapshot[]
}

type SnapshotAttributeRecord = {
    id: string
    codename: SnapshotCodenameValue
    dataType: FieldDefinition['dataType']
    isRequired: boolean
    isDisplayAttribute?: boolean | null
    targetEntityId?: string | null
    targetEntityKind?: EntityKind | null
    targetConstantId?: string | null
    name?: VersionedLocalizedContent<string> | null
    description?: VersionedLocalizedContent<string> | null
    validationRules?: Record<string, unknown> | null
    uiConfig?: Record<string, unknown> | null
    sortOrder?: number | null
    parentAttributeId?: string | null
    system?: {
        isSystem?: boolean | null
    } | null
}

type SnapshotConstantRecord = {
    id: string
    setId?: string | null
    codename: SnapshotCodenameValue
    dataType: string
    name?: VersionedLocalizedContent<string> | null
    validationRules?: Record<string, unknown> | null
    uiConfig?: Record<string, unknown> | null
    value?: unknown
    sortOrder?: number | null
}

type SnapshotEnumerationValueRecord = {
    id: string
    objectId?: string | null
    codename: SnapshotCodenameValue
    presentation?: EnumerationValueDefinition['presentation'] | null
    name?: VersionedLocalizedContent<string> | null
    description?: VersionedLocalizedContent<string> | null
    sortOrder?: number | null
    isDefault?: boolean | null
}

export interface MetaFieldSnapshot extends Omit<FieldDefinition, 'codename' | 'childFields'> {
    codename: SnapshotCodenameValue
    childFields?: MetaFieldSnapshot[]
    sortOrder: number
}

export interface MetaEnumerationValueSnapshot extends Omit<EnumerationValueDefinition, 'codename'> {
    codename: SnapshotCodenameValue
}

export interface MetaElementSnapshot {
    id: string
    objectId: string
    data: Record<string, unknown>
    sortOrder: number
}

export interface MetaConstantSnapshot {
    id: string
    objectId: string
    codename: SnapshotCodenameValue
    dataType: string
    presentation: Record<string, unknown>
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    value: unknown
    sortOrder: number
}

export class SnapshotSerializer {
    constructor(
        private readonly objectsService: MetahubObjectsService,
        private readonly attributesService: MetahubAttributesService,
        private readonly elementsService?: MetahubElementsService,
        private readonly hubsService?: MetahubHubsService, // Hub repository removed - hubs are now in isolated schemas (_mhb_hubs)
        private readonly enumerationValuesService?: MetahubEnumerationValuesService,
        private readonly constantsService?: MetahubConstantsService,
        private readonly scriptsService?: MetahubScriptsService,
        private readonly sharedContainerService?: SharedContainerService,
        private readonly sharedEntityOverridesService?: SharedEntityOverridesService,
        private readonly entityTypeService?: EntityTypeService,
        private readonly actionService?: ActionService,
        private readonly eventBindingService?: EventBindingService
    ) {}

    private static toSnapshotCodenameValue(value: unknown): SnapshotCodenameValue {
        return typeof value === 'string' || (value && typeof value === 'object') ? (value as SnapshotCodenameValue) : ''
    }

    private static buildFieldSnapshots(attributes: SnapshotAttributeRecord[]): MetaFieldSnapshot[] {
        const rootAttributes = attributes.filter((attribute) => !attribute.parentAttributeId)
        const childAttributesByParent = new Map<string, SnapshotAttributeRecord[]>()

        for (const attr of attributes) {
            if (!attr.parentAttributeId) {
                continue
            }

            const list = childAttributesByParent.get(attr.parentAttributeId) ?? []
            list.push(attr)
            childAttributesByParent.set(attr.parentAttributeId, list)
        }

        return rootAttributes.map((attr) => {
            const resolvedTargetEntityId = attr.targetEntityId ?? undefined
            const resolvedTargetEntityKind: EntityKind | undefined = attr.targetEntityKind ?? undefined

            const fieldDef: MetaFieldSnapshot = {
                id: attr.id,
                codename: SnapshotSerializer.toSnapshotCodenameValue(attr.codename),
                dataType: attr.dataType,
                isRequired: attr.isRequired,
                isDisplayAttribute: attr.isDisplayAttribute ?? false,
                targetEntityId: resolvedTargetEntityId,
                targetEntityKind: resolvedTargetEntityKind,
                targetConstantId: attr.targetConstantId ?? null,
                presentation: {
                    name: (attr.name || {}) as MetaFieldSnapshot['presentation']['name'],
                    description: (attr.description || {}) as MetaFieldSnapshot['presentation']['description']
                },
                validationRules: attr.validationRules || {},
                uiConfig: attr.uiConfig || {},
                sortOrder: attr.sortOrder ?? 0
            }

            if (attr.dataType === 'TABLE') {
                const children = childAttributesByParent.get(attr.id) ?? []
                fieldDef.childFields = children.map((child) => ({
                    id: child.id,
                    codename: SnapshotSerializer.toSnapshotCodenameValue(child.codename),
                    dataType: child.dataType,
                    isRequired: child.isRequired,
                    isDisplayAttribute: child.isDisplayAttribute ?? false,
                    targetEntityId: child.targetEntityId ?? undefined,
                    targetEntityKind: child.targetEntityKind ?? undefined,
                    targetConstantId: child.targetConstantId ?? null,
                    presentation: {
                        name: (child.name || {}) as MetaFieldSnapshot['presentation']['name'],
                        description: (child.description || {}) as MetaFieldSnapshot['presentation']['description']
                    },
                    validationRules: child.validationRules || {},
                    uiConfig: child.uiConfig || {},
                    sortOrder: child.sortOrder ?? 0,
                    parentAttributeId: attr.id
                }))
            }

            return fieldDef
        })
    }

    private static mapConstantSnapshots(constants: SnapshotConstantRecord[], fallbackObjectId: string): MetaConstantSnapshot[] {
        return constants.map((constant) => ({
            id: constant.id,
            objectId: constant.setId ?? fallbackObjectId,
            codename: SnapshotSerializer.toSnapshotCodenameValue(constant.codename),
            dataType: constant.dataType,
            presentation: {
                name: constant.name ?? {}
            },
            validationRules: (constant.validationRules ?? {}) as Record<string, unknown>,
            uiConfig: (constant.uiConfig ?? {}) as Record<string, unknown>,
            value: constant.value ?? null,
            sortOrder: constant.sortOrder ?? 0
        }))
    }

    private static mapEnumerationValueSnapshots(
        values: SnapshotEnumerationValueRecord[],
        fallbackObjectId: string
    ): MetaEnumerationValueSnapshot[] {
        return values.map((value) => ({
            id: value.id,
            objectId: value.objectId ?? fallbackObjectId,
            codename: SnapshotSerializer.toSnapshotCodenameValue(value.codename),
            presentation:
                value.presentation && typeof value.presentation === 'object'
                    ? value.presentation
                    : {
                          name: (value.name ?? {}) as EnumerationValueDefinition['presentation']['name'],
                          description: (value.description ?? {}) as EnumerationValueDefinition['presentation']['description']
                      },
            sortOrder: value.sortOrder ?? 0,
            isDefault: value.isDefault ?? false
        }))
    }

    private static stripSharedMetadata<T extends object>(item: SharedEntityListItem<T>): T {
        const { isShared, isActive, isExcluded, effectiveSortOrder, sharedBehavior, ...rawItem } = item
        void isShared
        void isActive
        void isExcluded
        void effectiveSortOrder
        void sharedBehavior
        return rawItem as T
    }

    private static resolveRuntimeSharedOverrides(
        snapshot: MetahubSnapshot,
        entityKind: SharedEntityKind,
        targetObjectId: string
    ): SharedEntityOverrideRow[] {
        return (snapshot.sharedEntityOverrides ?? [])
            .filter((override) => override.entityKind === entityKind && override.targetObjectId === targetObjectId)
            .map((override) => ({
                id: override.id,
                entityKind: override.entityKind,
                sharedEntityId: override.sharedEntityId,
                targetObjectId: override.targetObjectId,
                isExcluded: override.isExcluded,
                isActive: override.isActive,
                sortOrder: override.sortOrder,
                version: 1
            }))
    }

    public static materializeSharedEntitiesForRuntime(snapshot: MetahubSnapshot): MetahubSnapshot {
        const sharedAttributes = snapshot.sharedAttributes ?? []
        const sharedConstants = snapshot.sharedConstants ?? []
        const sharedEnumerationValues = snapshot.sharedEnumerationValues ?? []
        const sharedOverrides = snapshot.sharedEntityOverrides ?? []

        if (
            sharedAttributes.length === 0 &&
            sharedConstants.length === 0 &&
            sharedEnumerationValues.length === 0 &&
            sharedOverrides.length === 0
        ) {
            return snapshot
        }

        const entities = Object.fromEntries(
            Object.entries(snapshot.entities ?? {}).map(([entityId, entity]) => {
                if (resolveLegacyCompatibleKind(entity.kind, entity.config) !== MetaEntityKind.CATALOG || sharedAttributes.length === 0) {
                    return [entityId, entity]
                }

                const mergedFields = buildMergedSharedEntityList({
                    localItems: entity.fields ?? [],
                    sharedItems: sharedAttributes,
                    overrides: SnapshotSerializer.resolveRuntimeSharedOverrides(snapshot, 'attribute', entityId),
                    getId: (item) => item.id,
                    getSortOrder: (item) => item.sortOrder,
                    getSharedBehavior: (item) =>
                        ((item.uiConfig as Record<string, unknown> | undefined)?.sharedBehavior as SharedBehavior | undefined) ?? undefined,
                    includeInactive: false
                }).map((item) => SnapshotSerializer.stripSharedMetadata(item))

                return [entityId, { ...entity, fields: mergedFields }]
            })
        )

        const constantsByObjectId: Record<string, MetaConstantSnapshot[]> = { ...(snapshot.constants ?? {}) }
        for (const entity of Object.values(snapshot.entities ?? {})) {
            if (resolveLegacyCompatibleKind(entity.kind, entity.config) !== MetaEntityKind.SET) {
                continue
            }

            const localConstants = snapshot.constants?.[entity.id] ?? []
            const mergedConstants = buildMergedSharedEntityList({
                localItems: localConstants,
                sharedItems: sharedConstants,
                overrides: SnapshotSerializer.resolveRuntimeSharedOverrides(snapshot, 'constant', entity.id),
                getId: (item) => item.id,
                getSortOrder: (item) => item.sortOrder,
                getSharedBehavior: (item) =>
                    ((item.uiConfig as Record<string, unknown> | undefined)?.sharedBehavior as SharedBehavior | undefined) ?? undefined,
                includeInactive: false
            }).map((item) => SnapshotSerializer.stripSharedMetadata(item))

            if (mergedConstants.length > 0) {
                constantsByObjectId[entity.id] = mergedConstants
            } else {
                delete constantsByObjectId[entity.id]
            }
        }

        const enumerationValuesByObjectId: Record<string, MetaEnumerationValueSnapshot[]> = {
            ...(snapshot.enumerationValues ?? {})
        }
        for (const entity of Object.values(snapshot.entities ?? {})) {
            if (resolveLegacyCompatibleKind(entity.kind, entity.config) !== MetaEntityKind.ENUMERATION) {
                continue
            }

            const localValues = snapshot.enumerationValues?.[entity.id] ?? []
            const mergedValues = buildMergedSharedEntityList({
                localItems: localValues,
                sharedItems: sharedEnumerationValues,
                overrides: SnapshotSerializer.resolveRuntimeSharedOverrides(snapshot, 'value', entity.id),
                getId: (item) => item.id,
                getSortOrder: (item) => item.sortOrder,
                getSharedBehavior: (item) =>
                    ((item.presentation as unknown as Record<string, unknown> | undefined)?.sharedBehavior as SharedBehavior | undefined) ??
                    undefined,
                includeInactive: false
            }).map((item) => SnapshotSerializer.stripSharedMetadata(item))

            if (mergedValues.length > 0) {
                enumerationValuesByObjectId[entity.id] = mergedValues
            } else {
                delete enumerationValuesByObjectId[entity.id]
            }
        }

        return {
            ...snapshot,
            entities,
            constants: Object.keys(constantsByObjectId).length > 0 ? constantsByObjectId : undefined,
            enumerationValues: Object.keys(enumerationValuesByObjectId).length > 0 ? enumerationValuesByObjectId : undefined
        }
    }

    private static mapEntityActionSnapshots(
        actions: Array<{
            id: string
            codename: unknown
            presentation: unknown
            actionType: 'script' | 'builtin'
            scriptId: string | null
            config: unknown
            sortOrder: number
        }>
    ): MetahubEntityActionSnapshot[] {
        return actions.map((action) => ({
            id: action.id,
            codename: SnapshotSerializer.toSnapshotCodenameValue(action.codename),
            presentation: ensureRecord(action.presentation),
            actionType: action.actionType,
            scriptId: action.scriptId ?? null,
            config: ensureRecord(action.config),
            sortOrder: Number(action.sortOrder ?? 0)
        }))
    }

    private static mapEventBindingSnapshots(
        eventBindings: Array<{
            id: string
            eventName: string
            actionId: string
            priority: number
            isActive: boolean
            config: unknown
        }>
    ): MetahubEventBindingSnapshot[] {
        return eventBindings.map((binding) => ({
            id: binding.id,
            eventName: binding.eventName,
            actionId: binding.actionId,
            priority: Number(binding.priority ?? 0),
            isActive: binding.isActive !== false,
            config: ensureRecord(binding.config)
        }))
    }

    private async loadSnapshotTypeDefinitions(metahubId: string): Promise<{
        typeByKind: Map<string, { components: ComponentManifest; config?: Record<string, unknown> }>
        entityTypeDefinitions?: Record<string, MetahubEntityTypeDefinitionSnapshot>
    }> {
        const typeByKind = new Map<string, { components: ComponentManifest; config?: Record<string, unknown> }>()
        for (const [kindKey, definition] of BUILTIN_ENTITY_TYPE_REGISTRY.entries()) {
            typeByKind.set(kindKey, definition)
        }

        if (!this.entityTypeService) {
            return { typeByKind }
        }

        const customDefinitions = await this.entityTypeService.listCustomTypes(metahubId)
        const entityTypeDefinitions: Record<string, MetahubEntityTypeDefinitionSnapshot> = {}

        for (const definition of customDefinitions) {
            typeByKind.set(definition.kindKey, {
                components: definition.components,
                config: ensureRecord(definition.config)
            })
            entityTypeDefinitions[definition.kindKey] = {
                id: definition.id ?? definition.kindKey,
                kindKey: definition.kindKey,
                codename: SnapshotSerializer.toSnapshotCodenameValue(definition.codename),
                presentation: ensureRecord(definition.presentation),
                components: definition.components,
                ui: definition.ui,
                config: ensureRecord(definition.config),
                isBuiltin: definition.isBuiltin === true,
                published: definition.published === true
            }
        }

        return {
            typeByKind,
            entityTypeDefinitions: Object.keys(entityTypeDefinitions).length > 0 ? entityTypeDefinitions : undefined
        }
    }

    private async loadSystemFieldsSnapshotForObject(
        metahubId: string,
        objectId: string,
        kind: string,
        typeConfig?: Record<string, unknown>
    ): Promise<CatalogSystemFieldsSnapshot | null> {
        if (
            resolveLegacyCompatibleKind(kind, typeConfig) === MetaEntityKind.CATALOG &&
            typeof this.attributesService.getCatalogSystemFieldsSnapshot === 'function'
        ) {
            return this.attributesService.getCatalogSystemFieldsSnapshot(metahubId, objectId)
        }

        if (
            typeof this.attributesService.listObjectSystemAttributes !== 'function' ||
            typeof this.attributesService.getObjectSystemFieldsSnapshot !== 'function'
        ) {
            return null
        }

        const systemAttributes = await this.attributesService.listObjectSystemAttributes(metahubId, objectId)
        if (!systemAttributes.length) {
            return null
        }

        return this.attributesService.getObjectSystemFieldsSnapshot(metahubId, objectId)
    }

    /**
     * Serializes the entire Metahub metadata tree into a JSON snapshot.
     *
     * **Important:** The snapshot returned here does NOT include layout data.
     * Callers MUST also invoke `attachLayoutsToSnapshot()` (from publicationsRoutes)
     * after this method to inject layout and zone-widget information into the
     * snapshot before it is persisted or published.
     */
    async serializeMetahub(metahubId: string, versionEnvelope?: Partial<MetahubSnapshotVersionEnvelope>): Promise<MetahubSnapshot> {
        const { typeByKind, entityTypeDefinitions } = await this.loadSnapshotTypeDefinitions(metahubId)
        const objectKinds = [...typeByKind.keys()].filter((kind) => {
            const definition = typeByKind.get(kind)
            return resolveLegacyCompatibleKind(kind, definition?.config) !== MetaEntityKind.HUB
        })
        const objectsByKindEntries = await Promise.all(
            objectKinds.map(async (kind) => [kind, await this.objectsService.findAllByKind(metahubId, kind)] as const)
        )
        const serializedObjects = objectsByKindEntries.flatMap(([kind, objects]) => objects.map((object) => ({ kind, object })))

        const entities: Record<string, MetaEntitySnapshot> = {}
        const elementsByObject: Record<string, MetaElementSnapshot[]> = {}
        const enumerationValuesByObject: Record<string, MetaEnumerationValueSnapshot[]> = {}
        const constantsByObject: Record<string, MetaConstantSnapshot[]> = {}
        const sharedAttributes: MetaFieldSnapshot[] = []
        const sharedConstants: MetaConstantSnapshot[] = []
        const sharedEnumerationValues: MetaEnumerationValueSnapshot[] = []
        const sharedEntityOverrides: MetahubSharedEntityOverrideSnapshot[] = []
        const systemFieldsByObject: Record<string, CatalogSystemFieldsSnapshot> = {}
        const publishedScripts = this.scriptsService
            ? (await this.scriptsService.listPublishedScripts(metahubId)).map<MetahubSnapshotScript>((script) => ({
                  id: script.id,
                  codename: script.codename,
                  presentation: script.presentation,
                  attachedToKind: script.attachedToKind,
                  attachedToId: script.attachedToId,
                  moduleRole: script.moduleRole,
                  sourceKind: script.sourceKind,
                  sdkApiVersion: script.sdkApiVersion,
                  sourceCode: script.sourceCode,
                  manifest: script.manifest,
                  serverBundle: script.serverBundle,
                  clientBundle: script.clientBundle,
                  checksum: script.checksum,
                  isActive: script.isActive,
                  config: script.config
              }))
            : []

        const elementObjectIds = serializedObjects
            .filter(({ kind, object }) => {
                const resolvedKind = typeof object.kind === 'string' ? object.kind : kind
                const definition = typeByKind.get(String(resolvedKind))
                return definition ? isEnabledComponentConfig(definition.components.predefinedElements) : false
            })
            .map(({ object }) => object.id)
        const allElements =
            this.elementsService && elementObjectIds.length > 0
                ? await this.elementsService.findAllByObjectIds(metahubId, elementObjectIds)
                : []
        const elementsMap = new Map<string, MetaElementSnapshot[]>()

        for (const element of allElements) {
            const list = elementsMap.get(element.objectId) ?? []
            list.push(element)
            elementsMap.set(element.objectId, list)
        }

        const hubs = await this.fetchAllHubs(metahubId)

        if (this.sharedContainerService) {
            const [sharedCatalogPoolId, sharedSetPoolId, sharedEnumerationPoolId] = await Promise.all([
                this.sharedContainerService.findContainerObjectId(metahubId, SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL),
                this.sharedContainerService.findContainerObjectId(metahubId, SHARED_OBJECT_KINDS.SHARED_SET_POOL),
                this.sharedContainerService.findContainerObjectId(metahubId, SHARED_OBJECT_KINDS.SHARED_ENUM_POOL)
            ])

            if (sharedCatalogPoolId) {
                const allSharedAttributes = (await this.attributesService.findAllFlatForSnapshot(
                    metahubId,
                    sharedCatalogPoolId,
                    undefined,
                    'all'
                )) as SnapshotAttributeRecord[]
                sharedAttributes.push(
                    ...SnapshotSerializer.buildFieldSnapshots(
                        allSharedAttributes.filter((attribute) => attribute.system?.isSystem !== true)
                    )
                )
            }

            if (sharedSetPoolId && this.constantsService) {
                sharedConstants.push(
                    ...SnapshotSerializer.mapConstantSnapshots(
                        (await this.constantsService.findAll(metahubId, sharedSetPoolId)) as SnapshotConstantRecord[],
                        sharedSetPoolId
                    )
                )
            }

            if (sharedEnumerationPoolId && this.enumerationValuesService) {
                sharedEnumerationValues.push(
                    ...SnapshotSerializer.mapEnumerationValueSnapshots(
                        (await this.enumerationValuesService.findAll(
                            metahubId,
                            sharedEnumerationPoolId
                        )) as SnapshotEnumerationValueRecord[],
                        sharedEnumerationPoolId
                    )
                )
            }
        }

        if (this.sharedEntityOverridesService) {
            sharedEntityOverrides.push(
                ...(await this.sharedEntityOverridesService.findAll(metahubId)).map((override) => ({
                    id: override.id,
                    entityKind: override.entityKind,
                    sharedEntityId: override.sharedEntityId,
                    targetObjectId: override.targetObjectId,
                    isExcluded: override.isExcluded,
                    isActive: override.isActive,
                    sortOrder: override.sortOrder
                }))
            )
        }

        for (const hub of hubs) {
            const hubId = hub.id as string
            const hubName = hub.name as unknown as import('@universo/types').VersionedLocalizedContent<string>
            const hubDescription = hub.description as unknown as import('@universo/types').VersionedLocalizedContent<string>
            const hubKind = typeof hub.kind === 'string' && hub.kind.trim().length > 0 ? hub.kind : MetaEntityKind.HUB
            const hubDefinition = typeByKind.get(hubKind)
            entities[hubId] = {
                id: hubId,
                kind: hubKind,
                codename: SnapshotSerializer.toSnapshotCodenameValue(hub.codename),
                presentation: {
                    name: hubName,
                    description: hubDescription
                },
                config: mergeEntitySnapshotConfig(hubDefinition?.config, {
                    sortOrder: (hub.sort_order as number) ?? 0,
                    parentHubId: typeof hub.parent_hub_id === 'string' ? hub.parent_hub_id : null
                }),
                fields: [],
                hubs: []
            }
        }

        for (const { kind: kindFromQuery, object } of serializedObjects) {
            const kind = typeof object.kind === 'string' ? object.kind : kindFromQuery
            const definition = typeByKind.get(kind)
            if (!definition) {
                continue
            }

            const objectPresentation = ensureRecord(object.presentation)
            const physicalTableConfig = isEnabledComponentConfig(definition.components.physicalTable)
                ? definition.components.physicalTable
                : null
            const legacyCompatibleKind = resolveLegacyCompatibleKind(kind, definition.config)

            const hubIds = Array.isArray(object.config?.hubs)
                ? object.config.hubs.filter((hubId: unknown): hubId is string => typeof hubId === 'string')
                : []

            const entitySnapshot: MetaEntitySnapshot = {
                id: object.id,
                kind: kind as MetaEntitySnapshot['kind'],
                codename: SnapshotSerializer.toSnapshotCodenameValue(object.codename),
                tableName:
                    typeof object.table_name === 'string' && object.table_name.trim().length > 0
                        ? object.table_name
                        : physicalTableConfig
                        ? generateTableName(object.id, kind, physicalTableConfig.prefix)
                        : legacyCompatibleKind === MetaEntityKind.SET || legacyCompatibleKind === MetaEntityKind.ENUMERATION
                        ? generateTableName(object.id, legacyCompatibleKind)
                        : undefined,
                presentation: {
                    name: (objectPresentation.name ?? {}) as MetaEntitySnapshot['presentation']['name'],
                    description: (objectPresentation.description ?? {}) as MetaEntitySnapshot['presentation']['description']
                },
                config: mergeEntitySnapshotConfig(definition.config, object.config),
                fields: [],
                hubs: hubIds
            }

            if (isEnabledComponentConfig(definition.components.dataSchema)) {
                const allAttributes = (await this.attributesService.findAllFlatForSnapshot(
                    metahubId,
                    object.id,
                    undefined,
                    'all'
                )) as SnapshotAttributeRecord[]
                const businessAttributes = allAttributes.filter((attribute) => attribute.system?.isSystem !== true)
                entitySnapshot.fields = SnapshotSerializer.buildFieldSnapshots(businessAttributes)

                const systemFields = await this.loadSystemFieldsSnapshotForObject(metahubId, object.id, kind, definition.config)
                if (systemFields) {
                    systemFieldsByObject[object.id] = systemFields
                }
            }

            const objectElements = elementsMap.get(object.id) ?? []
            if (objectElements.length > 0) {
                elementsByObject[object.id] = objectElements
            }

            if (this.constantsService && isEnabledComponentConfig(definition.components.constants)) {
                const constants = (await this.constantsService.findAll(metahubId, object.id)) as SnapshotConstantRecord[]
                if (constants.length > 0) {
                    constantsByObject[object.id] = SnapshotSerializer.mapConstantSnapshots(constants, object.id)
                }
            }

            if (this.enumerationValuesService && isEnabledComponentConfig(definition.components.enumerationValues)) {
                const values = (await this.enumerationValuesService.findAll(metahubId, object.id)) as SnapshotEnumerationValueRecord[]
                if (values.length > 0) {
                    enumerationValuesByObject[object.id] = SnapshotSerializer.mapEnumerationValueSnapshots(values, object.id)
                }
            }

            if (this.actionService && isEnabledComponentConfig(definition.components.actions)) {
                const actions = await this.actionService.listByObjectId(metahubId, object.id)
                if (actions.length > 0) {
                    entitySnapshot.actions = SnapshotSerializer.mapEntityActionSnapshots(actions)
                }
            }

            if (this.eventBindingService && isEnabledComponentConfig(definition.components.events)) {
                const eventBindings = await this.eventBindingService.listByObjectId(metahubId, object.id)
                if (eventBindings.length > 0) {
                    entitySnapshot.eventBindings = SnapshotSerializer.mapEventBindingSnapshots(eventBindings)
                }
            }

            entities[object.id] = entitySnapshot
        }

        return {
            metahubId,
            generatedAt: new Date().toISOString(),
            version: 1,
            versionEnvelope: {
                structureVersion: versionEnvelope?.structureVersion ?? structureVersionToSemver(CURRENT_STRUCTURE_VERSION),
                templateVersion: versionEnvelope?.templateVersion ?? null,
                snapshotFormatVersion: 3
            },
            entities,
            entityTypeDefinitions,
            elements: Object.keys(elementsByObject).length > 0 ? elementsByObject : undefined,
            enumerationValues: Object.keys(enumerationValuesByObject).length > 0 ? enumerationValuesByObject : undefined,
            constants: Object.keys(constantsByObject).length > 0 ? constantsByObject : undefined,
            sharedAttributes: sharedAttributes.length > 0 ? sharedAttributes : undefined,
            sharedConstants: sharedConstants.length > 0 ? sharedConstants : undefined,
            sharedEnumerationValues: sharedEnumerationValues.length > 0 ? sharedEnumerationValues : undefined,
            sharedEntityOverrides: sharedEntityOverrides.length > 0 ? sharedEntityOverrides : undefined,
            systemFields: Object.keys(systemFieldsByObject).length > 0 ? systemFieldsByObject : undefined,
            scripts: publishedScripts.length > 0 ? publishedScripts : undefined
        }
    }

    private async fetchAllHubs(metahubId: string): Promise<Record<string, unknown>[]> {
        if (!this.hubsService) return []

        const limit = 1000
        const maxIterations = 100 // Safety limit: max 100k items
        let offset = 0
        let iteration = 0
        const all: Record<string, unknown>[] = []
        const seenIds = new Set<string>()

        while (iteration < maxIterations) {
            const { items, total } = await this.hubsService.findAll(metahubId, { limit, offset })

            // Detect duplicate items (service bug protection)
            const newItems = items.filter((item) => {
                const id = item.id as string
                if (seenIds.has(id)) return false
                seenIds.add(id)
                return true
            })

            if (newItems.length === 0) break // No new items, stop
            all.push(...newItems)

            if (items.length < limit) break
            if (typeof total === 'number' && all.length >= total) break

            offset += items.length
            iteration++
        }

        if (iteration >= maxIterations) {
            log.warn(`Hit max iterations (${maxIterations}) fetching hubs for metahub ${metahubId}`)
        }

        return all
    }

    /**
     * Calculates SHA-256 hash of the snapshot for deduplication
     */
    calculateHash(snapshot: MetahubSnapshot): string {
        const normalized = SnapshotSerializer.normalizeSnapshotForHash(snapshot)
        const payload = stableStringify(normalized)
        if (payload === undefined) {
            throw new Error('Failed to stringify snapshot for hash calculation')
        }
        return createHash('sha256').update(payload).digest('hex')
    }

    /**
     * Deserializes a snapshot into EntityDefinition array for DDL generator.
     *
     * Child fields of TABLE attributes are represented in two ways:
     * 1. Nested inside the parent field's `childFields` (used by seedPredefinedElements).
     * 2. As separate entries in `entity.fields` with `parentAttributeId` set
     *    (required by SchemaGenerator, SchemaMigrator and diff engine).
     */
    deserializeSnapshot(snapshot: MetahubSnapshot): EntityDefinition[] {
        const toExecutableField = (field: MetaFieldSnapshot, parentAttributeId = field.parentAttributeId ?? null): FieldDefinition => ({
            ...field,
            codename: getCodenameText(field.codename),
            targetEntityId: field.targetEntityId,
            targetEntityKind: field.targetEntityKind,
            targetConstantId: field.targetConstantId,
            childFields: field.childFields?.map((child) => toExecutableField(child, child.parentAttributeId ?? field.id)),
            parentAttributeId
        })

        return Object.values(snapshot.entities).map((entity) => {
            const definition = snapshot.entityTypeDefinitions?.[entity.kind] ?? BUILTIN_ENTITY_TYPE_REGISTRY.get(entity.kind)
            const physicalTableConfig =
                definition && isEnabledComponentConfig(definition.components.physicalTable) ? definition.components.physicalTable : null

            return {
                ...entity,
                id: entity.id,
                physicalTablePrefix: physicalTableConfig?.prefix,
                physicalTableName:
                    entity.tableName ??
                    entity.physicalTableName ??
                    (physicalTableConfig ? generateTableName(entity.id, entity.kind, physicalTableConfig.prefix) : undefined),
                codename: getCodenameText(entity.codename),
                config: {
                    ...(entity.config ?? {}),
                    systemFields: snapshot.systemFields?.[entity.id] ?? null
                },
                fields: entity.fields.flatMap((field) => {
                    const mapped = toExecutableField(field)

                    // Flatten TABLE child fields into the entity.fields array
                    const children = (field.childFields ?? []).map((child) => toExecutableField(child, child.parentAttributeId ?? field.id))

                    return [mapped, ...children]
                })
            }
        })
    }

    private static normalizeSnapshotForHash(snapshot: MetahubSnapshot): Record<string, unknown> {
        return serialization.normalizePublicationSnapshotForHash(snapshot, {
            defaultVersionEnvelope: {
                structureVersion: structureVersionToSemver(CURRENT_STRUCTURE_VERSION),
                templateVersion: null,
                snapshotFormatVersion: 3
            }
        })
    }
}

const ensureRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as Record<string, unknown>
}
