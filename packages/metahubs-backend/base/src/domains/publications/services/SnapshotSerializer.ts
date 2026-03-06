import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import type { EntityDefinition, FieldDefinition } from '@universo/schema-ddl'
import { MetaEntityKind, type EnumerationValueDefinition, type MetahubSnapshotVersionEnvelope } from '@universo/types'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { CURRENT_STRUCTURE_VERSION, structureVersionToSemver } from '../../metahubs/services/structureVersions'
import { generateTableName } from '../../ddl'

export interface MetahubSnapshot {
    version: 1
    versionEnvelope: MetahubSnapshotVersionEnvelope
    generatedAt: string
    metahubId: string
    entities: Record<string, MetaEntitySnapshot>
    elements?: Record<string, MetaElementSnapshot[]>
    enumerationValues?: Record<string, EnumerationValueDefinition[]>
    constants?: Record<string, MetaConstantSnapshot[]>
    /**
     * Active UI layouts captured at publication time.
     * MVP: only the Dashboard template is supported.
     */
    layouts?: MetahubLayoutSnapshot[]
    /**
     * Zone/widget assignments for layouts.
     */
    layoutZoneWidgets?: MetahubLayoutZoneWidgetSnapshot[]
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

export interface MetaEntitySnapshot extends EntityDefinition {
    fields: MetaFieldSnapshot[]
    hubs: string[]
    tableName?: string
    config?: Record<string, unknown>
}

export interface MetaFieldSnapshot extends FieldDefinition {
    sortOrder: number
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
    codename: string
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
        private readonly constantsService?: MetahubConstantsService
    ) {}

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
        const enumerationValuesByObject: Record<string, EnumerationValueDefinition[]> = {}
        const constantsByObject: Record<string, MetaConstantSnapshot[]> = {}

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
                codename: hub.codename as string,
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
            const allAttributes = await this.attributesService.findAllFlat(metahubId, catalog.id)
            const rootAttributes = allAttributes.filter((a: any) => !a.parentAttributeId)
            const childAttributesByParent = new Map<string, typeof allAttributes>()

            for (const attr of allAttributes) {
                if ((attr as any).parentAttributeId) {
                    const list = childAttributesByParent.get((attr as any).parentAttributeId) ?? []
                    list.push(attr)
                    childAttributesByParent.set((attr as any).parentAttributeId, list)
                }
            }

            // Get associated hubs from config
            const hubIds: string[] = catalog.config?.hubs || []

            const catalogElements = elementsMap.get(catalog.id) ?? []
            if (catalogElements.length > 0) {
                elementsByObject[catalog.id] = catalogElements
            }

            entities[catalog.id] = {
                id: catalog.id,
                kind: 'catalog',
                codename: catalog.codename,
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
                        codename: attr.codename,
                        dataType: attr.dataType,
                        isRequired: attr.isRequired,
                        isDisplayAttribute: attr.isDisplayAttribute ?? false,
                        targetEntityId: resolvedTargetEntityId,
                        targetEntityKind: resolvedTargetEntityKind,
                        targetConstantId: attr.targetConstantId ?? null,
                        presentation: {
                            name: attr.name || {},
                            description: attr.description || {}
                        },
                        validationRules: (attr.validationRules || {}) as any,
                        uiConfig: (attr.uiConfig || {}) as any,
                        sortOrder: attr.sortOrder
                    }

                    // Include child fields for TABLE attributes
                    if (attr.dataType === 'TABLE') {
                        const children = childAttributesByParent.get(attr.id) ?? []
                        fieldDef.childFields = children.map((child) => ({
                            id: child.id,
                            codename: child.codename,
                            dataType: child.dataType,
                            isRequired: child.isRequired,
                            isDisplayAttribute: child.isDisplayAttribute ?? false,
                            targetEntityId: child.targetEntityId ?? undefined,
                            targetEntityKind: child.targetEntityKind ?? undefined,
                            targetConstantId: child.targetConstantId ?? null,
                            presentation: {
                                name: child.name || {},
                                description: child.description || {}
                            },
                            validationRules: (child.validationRules || {}) as any,
                            uiConfig: (child.uiConfig || {}) as any,
                            sortOrder: child.sortOrder,
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
                const constants = await this.constantsService.findAll(metahubId, set.id)
                if (!constants.length) continue
                constantsByObject[set.id] = constants.map((constant: any) => ({
                    id: constant.id,
                    objectId: constant.setId ?? set.id,
                    codename: constant.codename,
                    dataType: constant.dataType,
                    presentation: {
                        codename: constant.codenameLocalized ?? null,
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
                    const values = await this.enumerationValuesService!.findAll(metahubId, enumeration.id)
                    const normalizedValues: EnumerationValueDefinition[] = values.map((value: any) => ({
                        id: value.id,
                        objectId: value.objectId,
                        codename: value.codename,
                        presentation:
                            value.presentation && typeof value.presentation === 'object'
                                ? value.presentation
                                : {
                                      name: value.name ?? {},
                                      description: value.description ?? {}
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
                codename: enumeration.codename,
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
                codename: set.codename,
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
            constants: Object.keys(constantsByObject).length > 0 ? constantsByObject : undefined
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
            console.warn(`[SnapshotSerializer] Hit max iterations (${maxIterations}) fetching hubs for metahub ${metahubId}`)
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
        return Object.values(snapshot.entities).map((entity) => ({
            ...entity,
            id: entity.id,
            fields: entity.fields.flatMap((field) => {
                const mapped = {
                    ...field,
                    targetEntityId: field.targetEntityId,
                    targetEntityKind: field.targetEntityKind,
                    targetConstantId: field.targetConstantId,
                    childFields: field.childFields?.map((child) => ({
                        ...child,
                        targetEntityId: child.targetEntityId,
                        targetEntityKind: child.targetEntityKind,
                        targetConstantId: child.targetConstantId
                    })),
                    parentAttributeId: field.parentAttributeId
                }

                // Flatten TABLE child fields into the entity.fields array
                const children = (field.childFields ?? []).map((child) => ({
                    ...child,
                    targetEntityId: child.targetEntityId,
                    targetEntityKind: child.targetEntityKind,
                    targetConstantId: child.targetConstantId,
                    parentAttributeId: field.id
                }))

                return [mapped, ...children]
            })
        }))
    }

    private static normalizeSnapshotForHash(snapshot: MetahubSnapshot): Record<string, unknown> {
        const entities = Object.values(snapshot.entities)
            .map((entity) => ({
                id: entity.id,
                kind: entity.kind,
                codename: entity.codename,
                tableName: entity.tableName,
                presentation: entity.presentation ?? {},
                config: entity.config ?? {},
                hubs: [...(entity.hubs ?? [])].sort(),
                fields: [...entity.fields]
                    .map((field) => ({
                        id: field.id,
                        codename: field.codename,
                        dataType: field.dataType,
                        isRequired: field.isRequired,
                        isDisplayAttribute: field.isDisplayAttribute ?? false,
                        targetEntityId: field.targetEntityId ?? null,
                        targetEntityKind: field.targetEntityKind ?? null,
                        targetConstantId: field.targetConstantId ?? null,
                        presentation: field.presentation ?? {},
                        validationRules: field.validationRules ?? {},
                        uiConfig: field.uiConfig ?? {},
                        sortOrder: field.sortOrder ?? 0,
                        parentAttributeId: field.parentAttributeId ?? null,
                        // Normalize child fields for TABLE attributes
                        childFields: field.childFields
                            ? [...field.childFields]
                                  .map((child) => {
                                      const childSortOrder = (child as MetaFieldSnapshot).sortOrder ?? 0
                                      return {
                                          id: child.id,
                                          codename: child.codename,
                                          dataType: child.dataType,
                                          isRequired: child.isRequired,
                                          isDisplayAttribute: child.isDisplayAttribute ?? false,
                                          targetEntityId: child.targetEntityId ?? null,
                                          targetEntityKind: child.targetEntityKind ?? null,
                                          targetConstantId: child.targetConstantId ?? null,
                                          presentation: child.presentation ?? {},
                                          validationRules: child.validationRules ?? {},
                                          uiConfig: child.uiConfig ?? {},
                                          sortOrder: childSortOrder
                                      }
                                  })
                                  .sort((a, b) => {
                                      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                                      if (a.codename !== b.codename) return a.codename.localeCompare(b.codename)
                                      return a.id.localeCompare(b.id)
                                  })
                            : undefined
                    }))
                    .sort((a, b) => {
                        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                        if (a.codename !== b.codename) return a.codename.localeCompare(b.codename)
                        return a.id.localeCompare(b.id)
                    })
            }))
            .sort((a, b) => {
                if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
                if (a.codename !== b.codename) return a.codename.localeCompare(b.codename)
                return a.id.localeCompare(b.id)
            })

        const elements = snapshot.elements
            ? Object.entries(snapshot.elements)
                  .map(([objectId, list]) => ({
                      objectId,
                      elements: list
                          .map((element) => ({
                              id: element.id,
                              data: element.data ?? {},
                              sortOrder: element.sortOrder ?? 0
                          }))
                          .sort((a, b) => {
                              if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                              return a.id.localeCompare(b.id)
                          })
                  }))
                  .sort((a, b) => a.objectId.localeCompare(b.objectId))
            : []

        const enumerationValues = snapshot.enumerationValues
            ? Object.entries(snapshot.enumerationValues)
                  .map(([objectId, list]) => ({
                      objectId,
                      values: list
                          .map((value) => ({
                              id: value.id,
                              codename: value.codename,
                              presentation: value.presentation ?? {},
                              sortOrder: value.sortOrder ?? 0,
                              isDefault: Boolean(value.isDefault)
                          }))
                          .sort((a, b) => {
                              if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                              if (a.codename !== b.codename) return a.codename.localeCompare(b.codename)
                              return a.id.localeCompare(b.id)
                          })
                  }))
                  .sort((a, b) => a.objectId.localeCompare(b.objectId))
            : []

        const constants = snapshot.constants
            ? Object.entries(snapshot.constants)
                  .map(([objectId, list]) => ({
                      objectId,
                      constants: list
                          .map((constant) => ({
                              id: constant.id,
                              codename: constant.codename,
                              dataType: constant.dataType,
                              presentation: constant.presentation ?? {},
                              validationRules: constant.validationRules ?? {},
                              uiConfig: constant.uiConfig ?? {},
                              value: constant.value ?? null,
                              sortOrder: constant.sortOrder ?? 0
                          }))
                          .sort((a, b) => {
                              if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                              if (a.codename !== b.codename) return a.codename.localeCompare(b.codename)
                              return a.id.localeCompare(b.id)
                          })
                  }))
                  .sort((a, b) => a.objectId.localeCompare(b.objectId))
            : []

        const layouts = snapshot.layouts
            ? snapshot.layouts
                  .map((layout) => ({
                      id: layout.id,
                      templateKey: layout.templateKey,
                      name: layout.name ?? {},
                      description: layout.description ?? null,
                      config: layout.config ?? {},
                      isDefault: Boolean(layout.isDefault),
                      isActive: Boolean(layout.isActive),
                      sortOrder: layout.sortOrder ?? 0
                  }))
                  .sort((a, b) => {
                      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
                      return a.id.localeCompare(b.id)
                  })
            : []

        const layoutZoneWidgets = snapshot.layoutZoneWidgets
            ? snapshot.layoutZoneWidgets
                  .map((item) => ({
                      id: item.id,
                      layoutId: item.layoutId,
                      zone: item.zone,
                      widgetKey: item.widgetKey,
                      sortOrder: item.sortOrder ?? 0,
                      config: item.config ?? {},
                      isActive: Boolean(item.isActive)
                  }))
                  .sort((a, b) => {
                      if (a.layoutId !== b.layoutId) return a.layoutId.localeCompare(b.layoutId)
                      if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
                      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                      return a.id.localeCompare(b.id)
                  })
            : []

        return {
            version: snapshot.version,
            versionEnvelope: snapshot.versionEnvelope ?? {
                structureVersion: structureVersionToSemver(CURRENT_STRUCTURE_VERSION),
                templateVersion: null,
                snapshotFormatVersion: 1
            },
            metahubId: snapshot.metahubId,
            entities,
            elements,
            enumerationValues,
            constants,
            layouts,
            layoutZoneWidgets,
            defaultLayoutId: snapshot.defaultLayoutId ?? null,
            layoutConfig: snapshot.layoutConfig ?? {}
        }
    }
}
