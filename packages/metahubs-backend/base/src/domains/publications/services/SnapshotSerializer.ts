import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import type { EntityDefinition, FieldDefinition } from '@universo/schema-ddl'
import { MetaEntityKind, type MetahubSnapshotVersionEnvelope } from '@universo/types'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { generateTableName } from '../../ddl'

export interface MetahubSnapshot {
    version: 1
    versionEnvelope: MetahubSnapshotVersionEnvelope
    generatedAt: string
    metahubId: string
    entities: Record<string, MetaEntitySnapshot>
    elements?: Record<string, MetaElementSnapshot[]>
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

export class SnapshotSerializer {
    constructor(
        private readonly objectsService: MetahubObjectsService,
        private readonly attributesService: MetahubAttributesService,
        private readonly elementsService?: MetahubElementsService,
        private readonly hubsService?: MetahubHubsService // Hub repository removed - hubs are now in isolated schemas (_mhb_hubs)
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
        // Fetch catalogs from dynamic schema
        const catalogs = await this.objectsService.findAll(metahubId)
        // Note: findAll already orders by created_at, but we might want sortOrder if we add it to _mhb_objects
        // Currently _mhb_objects doesn't have sort_order in standard schema, using order by name or created_at

        const entities: Record<string, MetaEntitySnapshot> = {}
        const elementsByObject: Record<string, MetaElementSnapshot[]> = {}

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
                tableName: generateTableName(hubId, 'hub'),
                presentation: {
                    name: hubName,
                    description: hubDescription
                },
                config: { sortOrder: (hub.sort_order as number) ?? 0 },
                fields: [],
                hubs: []
            }
        }

        for (const catalog of catalogs) {
            const attributes = await this.attributesService.findAll(metahubId, catalog.id)

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
                fields: attributes.map((attr) => {
                    const resolvedTargetEntityId = attr.targetEntityId ?? attr.targetCatalogId ?? undefined
                    const resolvedTargetEntityKind: MetaEntityKind | undefined =
                        attr.targetEntityKind ?? (attr.targetCatalogId ? MetaEntityKind.CATALOG : undefined)

                    return {
                        id: attr.id,
                        codename: attr.codename,
                        dataType: attr.dataType,
                        isRequired: attr.isRequired,
                        isDisplayAttribute: attr.isDisplayAttribute ?? false,
                        targetEntityId: resolvedTargetEntityId,
                        targetEntityKind: resolvedTargetEntityKind,
                        presentation: {
                            name: attr.name || {},
                            description: attr.description || {}
                        },
                        validationRules: (attr.validationRules || {}) as any,
                        uiConfig: (attr.uiConfig || {}) as any,
                        sortOrder: attr.sortOrder
                    }
                }),
                hubs: hubIds
            }
        }

        return {
            metahubId,
            generatedAt: new Date().toISOString(),
            version: 1,
            versionEnvelope: {
                structureVersion: versionEnvelope?.structureVersion ?? 1,
                templateVersion: versionEnvelope?.templateVersion ?? null,
                snapshotFormatVersion: 1
            },
            entities,
            elements: Object.keys(elementsByObject).length > 0 ? elementsByObject : undefined
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
     * Deserializes a snapshot into EntityDefinition array for DDL generator
     */
    deserializeSnapshot(snapshot: MetahubSnapshot): EntityDefinition[] {
        return Object.values(snapshot.entities).map((entity) => ({
            ...entity,
            id: entity.id,
            fields: entity.fields.map((field) => ({
                ...field,
                targetEntityId: field.targetEntityId,
                targetEntityKind: field.targetEntityKind
            }))
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
                        presentation: field.presentation ?? {},
                        validationRules: field.validationRules ?? {},
                        uiConfig: field.uiConfig ?? {},
                        sortOrder: field.sortOrder ?? 0
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
                      config: item.config ?? {}
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
                structureVersion: 1,
                templateVersion: null,
                snapshotFormatVersion: 1
            },
            metahubId: snapshot.metahubId,
            entities,
            elements,
            layouts,
            layoutZoneWidgets,
            defaultLayoutId: snapshot.defaultLayoutId ?? null,
            layoutConfig: snapshot.layoutConfig ?? {}
        }
    }
}
