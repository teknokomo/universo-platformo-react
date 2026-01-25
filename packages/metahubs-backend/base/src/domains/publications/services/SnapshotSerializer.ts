import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import type { EntityDefinition, FieldDefinition } from '@universo/schema-ddl'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { generateTableName } from '../../ddl'

export interface MetahubSnapshot {
    version: 1
    generatedAt: string
    metahubId: string
    entities: Record<string, MetaEntitySnapshot>
    elements?: Record<string, MetaElementSnapshot[]>
}

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
        private readonly hubsService?: MetahubHubsService
        // Hub repository removed - hubs are now in isolated schemas (_mhb_hubs)
    ) { }

    /**
     * Serializes the entire Metahub metadata tree into a JSON snapshot
     */
    async serializeMetahub(metahubId: string): Promise<MetahubSnapshot> {
        // Fetch catalogs from dynamic schema
        const catalogs = await this.objectsService.findAll(metahubId)
        // Note: findAll already orders by created_at, but we might want sortOrder if we add it to _mhb_objects
        // Currently _mhb_objects doesn't have sort_order in standard schema, using order by name or created_at

        const entities: Record<string, MetaEntitySnapshot> = {}
        const elementsByObject: Record<string, MetaElementSnapshot[]> = {}

        const objectIds = catalogs.map((catalog) => catalog.id)
        const allElements = this.elementsService && objectIds.length > 0
            ? await this.elementsService.findAllByObjectIds(metahubId, objectIds)
            : []
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
                fields: attributes.map(attr => ({
                    id: attr.id,
                    codename: attr.codename,
                    dataType: attr.dataType,
                    isRequired: attr.isRequired,
                    targetEntityId: attr.targetCatalogId ?? undefined,
                    presentation: {
                        name: attr.name || {},
                        description: attr.description || {}
                    },
                    validationRules: (attr.validationRules || {}) as any,
                    uiConfig: (attr.uiConfig || {}) as any,
                    sortOrder: attr.sortOrder
                })),
                hubs: hubIds
            }
        }

        return {
            metahubId,
            generatedAt: new Date().toISOString(),
            version: 1,
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
            const newItems = items.filter(item => {
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
                targetEntityId: field.targetEntityId
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
                        targetEntityId: field.targetEntityId ?? null,
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
                    elements: [...list]
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

        return {
            version: snapshot.version,
            metahubId: snapshot.metahubId,
            entities,
            elements
        }
    }
}
