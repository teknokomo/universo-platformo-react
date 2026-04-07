import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import type { EntityDefinition, FieldDefinition } from '@universo/schema-ddl'
import {
    MetaEntityKind,
    type CatalogSystemFieldsSnapshot,
    type EnumerationValueDefinition,
    type MetahubScriptDefinition,
    type MetahubSnapshotVersionEnvelope,
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
import { CURRENT_STRUCTURE_VERSION, structureVersionToSemver } from '../../metahubs/services/structureVersions'
import { generateTableName } from '../../ddl'
import { getCodenameText } from '../../shared/codename'
import { createLogger } from '../../../utils/logger'

const log = createLogger('SnapshotSerializer')

export type SnapshotCodenameValue = VersionedLocalizedContent<string> | string

export interface MetahubSnapshot {
    version: 1
    versionEnvelope: MetahubSnapshotVersionEnvelope
    generatedAt: string
    metahubId: string
    entities: Record<string, MetaEntitySnapshot>
    elements?: Record<string, MetaElementSnapshot[]>
    enumerationValues?: Record<string, MetaEnumerationValueSnapshot[]>
    constants?: Record<string, MetaConstantSnapshot[]>
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
}

type SnapshotAttributeRecord = {
    id: string
    codename: SnapshotCodenameValue
    dataType: FieldDefinition['dataType']
    isRequired: boolean
    isDisplayAttribute?: boolean | null
    targetEntityId?: string | null
    targetEntityKind?: MetaEntityKind | null
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
        private readonly scriptsService?: MetahubScriptsService
    ) {}

    private static toSnapshotCodenameValue(value: unknown): SnapshotCodenameValue {
        return typeof value === 'string' || (value && typeof value === 'object') ? (value as SnapshotCodenameValue) : ''
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
        // Fetch entities from dynamic schema
        const catalogs = await this.objectsService.findAllByKind(metahubId, MetaEntityKind.CATALOG)
        const sets = await this.objectsService.findAllByKind(metahubId, MetaEntityKind.SET)
        const enumerations = await this.objectsService.findAllByKind(metahubId, MetaEntityKind.ENUMERATION)
        // Note: findAll already orders by created_at, but we might want sortOrder if we add it to _mhb_objects
        // Currently _mhb_objects doesn't have sort_order in standard schema, using order by name or created_at

        const entities: Record<string, MetaEntitySnapshot> = {}
        const elementsByObject: Record<string, MetaElementSnapshot[]> = {}
        const enumerationValuesByObject: Record<string, MetaEnumerationValueSnapshot[]> = {}
        const constantsByObject: Record<string, MetaConstantSnapshot[]> = {}
        const systemFieldsByObject: Record<string, CatalogSystemFieldsSnapshot> = {}
        const publishedScripts = this.scriptsService
            ? (await this.scriptsService.listScripts(metahubId, { onlyActive: true }))
                  .filter((script) => script.isActive)
                  .map<MetahubSnapshotScript>((script) => ({
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

        const objectIds = catalogs.map((catalog) => catalog.id)
        const allElements =
            this.elementsService && objectIds.length > 0 ? await this.elementsService.findAllByObjectIds(metahubId, objectIds) : []
        const elementsMap = new Map<string, MetaElementSnapshot[]>()

        for (const element of allElements) {
            const list = elementsMap.get(element.objectId) ?? []
            list.push(element)
            elementsMap.set(element.objectId, list)
        }

        const hubs = await this.fetchAllHubs(metahubId)

        for (const hub of hubs) {
            const hubId = hub.id as string
            const hubName = hub.name as unknown as import('@universo/types').VersionedLocalizedContent<string>
            const hubDescription = hub.description as unknown as import('@universo/types').VersionedLocalizedContent<string>
            entities[hubId] = {
                id: hubId,
                kind: 'hub',
                codename: SnapshotSerializer.toSnapshotCodenameValue(hub.codename),
                presentation: {
                    name: hubName,
                    description: hubDescription
                },
                config: {
                    sortOrder: (hub.sort_order as number) ?? 0,
                    parentHubId: typeof hub.parent_hub_id === 'string' ? hub.parent_hub_id : null
                },
                fields: [],
                hubs: []
            }
        }

        for (const catalog of catalogs) {
            // Fetch ALL attributes (root + child) for snapshot completeness
            const allAttributes = (await this.attributesService.findAllFlatForSnapshot(
                metahubId,
                catalog.id,
                undefined,
                'all'
            )) as SnapshotAttributeRecord[]
            const businessAttributes = allAttributes.filter((attribute) => attribute.system?.isSystem !== true)
            const rootAttributes = businessAttributes.filter((attribute) => !attribute.parentAttributeId)
            const childAttributesByParent = new Map<string, SnapshotAttributeRecord[]>()

            for (const attr of businessAttributes) {
                if (attr.parentAttributeId) {
                    const list = childAttributesByParent.get(attr.parentAttributeId) ?? []
                    list.push(attr)
                    childAttributesByParent.set(attr.parentAttributeId, list)
                }
            }

            systemFieldsByObject[catalog.id] = await this.attributesService.getCatalogSystemFieldsSnapshot(metahubId, catalog.id)

            // Get associated hubs from config
            const hubIds: string[] = catalog.config?.hubs || []

            const catalogElements = elementsMap.get(catalog.id) ?? []
            if (catalogElements.length > 0) {
                elementsByObject[catalog.id] = catalogElements
            }

            entities[catalog.id] = {
                id: catalog.id,
                kind: 'catalog',
                codename: SnapshotSerializer.toSnapshotCodenameValue(catalog.codename),
                tableName: catalog.table_name,
                presentation: {
                    name: catalog.presentation?.name || {},
                    description: catalog.presentation?.description || {}
                },
                config: {
                    ...(catalog.config ?? {}),
                    isSingleHub: catalog.config?.isSingleHub ?? false,
                    isRequiredHub: catalog.config?.isRequiredHub ?? false
                },
                fields: rootAttributes.map((attr) => {
                    const resolvedTargetEntityId = attr.targetEntityId ?? undefined
                    const resolvedTargetEntityKind: MetaEntityKind | undefined = attr.targetEntityKind ?? undefined

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

                    // Include child fields for TABLE attributes
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
                }),
                hubs: hubIds
            }
        }

        if (this.constantsService && sets.length > 0) {
            for (const set of sets) {
                const constants = (await this.constantsService.findAll(metahubId, set.id)) as SnapshotConstantRecord[]
                if (!constants.length) continue
                constantsByObject[set.id] = constants.map((constant) => ({
                    id: constant.id,
                    objectId: constant.setId ?? set.id,
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
        }

        if (this.enumerationValuesService && enumerations.length > 0) {
            const valuesEntries = await Promise.all(
                enumerations.map(async (enumeration) => {
                    const values = (await this.enumerationValuesService!.findAll(
                        metahubId,
                        enumeration.id
                    )) as unknown as SnapshotEnumerationValueRecord[]
                    const normalizedValues: MetaEnumerationValueSnapshot[] = values.map((value) => ({
                        id: value.id,
                        objectId: value.objectId ?? enumeration.id,
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
                    return [enumeration.id, normalizedValues] as const
                })
            )
            for (const [enumerationId, values] of valuesEntries) {
                if (values.length > 0) {
                    enumerationValuesByObject[enumerationId] = values
                }
            }
        }

        for (const enumeration of enumerations) {
            const hubIds: string[] = enumeration.config?.hubs || []
            entities[enumeration.id] = {
                id: enumeration.id,
                kind: MetaEntityKind.ENUMERATION,
                codename: SnapshotSerializer.toSnapshotCodenameValue(enumeration.codename),
                tableName: generateTableName(enumeration.id, MetaEntityKind.ENUMERATION),
                presentation: {
                    name: enumeration.presentation?.name || {},
                    description: enumeration.presentation?.description || {}
                },
                config: {
                    ...(enumeration.config ?? {}),
                    isSingleHub: enumeration.config?.isSingleHub ?? false,
                    isRequiredHub: enumeration.config?.isRequiredHub ?? false
                },
                fields: [],
                hubs: hubIds
            }
        }

        for (const set of sets) {
            const hubIds: string[] = set.config?.hubs || []
            entities[set.id] = {
                id: set.id,
                kind: MetaEntityKind.SET,
                codename: SnapshotSerializer.toSnapshotCodenameValue(set.codename),
                tableName: generateTableName(set.id, MetaEntityKind.SET),
                presentation: {
                    name: set.presentation?.name || {},
                    description: set.presentation?.description || {}
                },
                config: {
                    ...(set.config ?? {}),
                    isSingleHub: set.config?.isSingleHub ?? false,
                    isRequiredHub: set.config?.isRequiredHub ?? false
                },
                fields: [],
                hubs: hubIds
            }
        }

        return {
            metahubId,
            generatedAt: new Date().toISOString(),
            version: 1,
            versionEnvelope: {
                structureVersion: versionEnvelope?.structureVersion ?? structureVersionToSemver(CURRENT_STRUCTURE_VERSION),
                templateVersion: versionEnvelope?.templateVersion ?? null,
                snapshotFormatVersion: 1
            },
            entities,
            elements: Object.keys(elementsByObject).length > 0 ? elementsByObject : undefined,
            enumerationValues: Object.keys(enumerationValuesByObject).length > 0 ? enumerationValuesByObject : undefined,
            constants: Object.keys(constantsByObject).length > 0 ? constantsByObject : undefined,
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

        return Object.values(snapshot.entities).map((entity) => ({
            ...entity,
            id: entity.id,
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
        }))
    }

    private static normalizeSnapshotForHash(snapshot: MetahubSnapshot): Record<string, unknown> {
        return serialization.normalizePublicationSnapshotForHash(snapshot, {
            defaultVersionEnvelope: {
                structureVersion: structureVersionToSemver(CURRENT_STRUCTURE_VERSION),
                templateVersion: null,
                snapshotFormatVersion: 1
            }
        })
    }
}
