import type { Knex } from 'knex'
import type { MetahubTemplateSeed, TemplateSeedComponent, TemplateSeedElement } from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { createLogger } from '../../../utils/logger'

const log = createLogger('TemplateSeedElements')

const TEMPLATE_SEED_MARKER_KEY = '__templateSeed'

export const buildTemplateSeedElementMapKey = (entityCodename: string, elementCodename: string): string =>
    `${entityCodename}:${elementCodename}`

const buildEnumerationValueMapKey = (enumerationCodename: string, valueCodename: string): string =>
    `${enumerationCodename}:${valueCodename}`

const readSeedMarkerCodename = (data: unknown): string | null => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const marker = (data as Record<string, unknown>)[TEMPLATE_SEED_MARKER_KEY]
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return null
    const codename = (marker as Record<string, unknown>).codename
    return typeof codename === 'string' && codename.trim() ? codename.trim() : null
}

const withSeedMarker = (data: Record<string, unknown>, element: TemplateSeedElement): Record<string, unknown> => {
    if (!element.codename) return data
    return {
        ...data,
        [TEMPLATE_SEED_MARKER_KEY]: {
            codename: element.codename
        }
    }
}

export const buildTemplateSeedComponentMap = (
    entities: NonNullable<MetahubTemplateSeed['entities']>
): Map<string, Map<string, TemplateSeedComponent>> => {
    const result = new Map<string, Map<string, TemplateSeedComponent>>()

    for (const entity of entities) {
        const componentMap = new Map<string, TemplateSeedComponent>()
        for (const component of entity.components ?? []) {
            componentMap.set(component.codename, component)
        }
        result.set(entity.codename, componentMap)
    }

    return result
}

export const resolveTemplateSeedElementData = (
    data: Record<string, unknown>,
    componentMap: Map<string, TemplateSeedComponent>,
    enumerationValueIdMap: Map<string, string>,
    elementIdMap: Map<string, string>
): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {}

    for (const [field, value] of Object.entries(data)) {
        const component = componentMap.get(field)
        if (!component) {
            resolved[field] = value
            continue
        }

        if (component.dataType === 'REF') {
            resolved[field] = resolveTemplateSeedReferenceValue(value, component, enumerationValueIdMap, elementIdMap)
            continue
        }

        if (component.dataType === 'TABLE' && Array.isArray(value)) {
            const childComponentMap = new Map<string, TemplateSeedComponent>()
            for (const child of component.childComponents ?? []) {
                childComponentMap.set(child.codename, child)
            }
            resolved[field] = value.map((row) =>
                row && typeof row === 'object' && !Array.isArray(row)
                    ? resolveTemplateSeedElementData(row as Record<string, unknown>, childComponentMap, enumerationValueIdMap, elementIdMap)
                    : row
            )
            continue
        }

        const dynamicRelationEndpoint = resolveDynamicTemplateSeedRelationEndpoint(field, value, data, elementIdMap)
        if (dynamicRelationEndpoint !== undefined) {
            resolved[field] = dynamicRelationEndpoint
            continue
        }

        resolved[field] = value
    }

    return resolved
}

const resolveTemplateSeedReferenceValue = (
    value: unknown,
    component: TemplateSeedComponent,
    enumerationValueIdMap: Map<string, string>,
    elementIdMap: Map<string, string>
): unknown => {
    if (typeof value !== 'string' || !component.targetEntityCodename) {
        return value
    }

    if (component.targetEntityKind === 'enumeration') {
        return enumerationValueIdMap.get(buildEnumerationValueMapKey(component.targetEntityCodename, value)) ?? value
    }

    return elementIdMap.get(buildTemplateSeedElementMapKey(component.targetEntityCodename, value)) ?? value
}

const resolveDynamicTemplateSeedRelationEndpoint = (
    field: string,
    value: unknown,
    rowData: Record<string, unknown>,
    elementIdMap: Map<string, string>
): unknown => {
    if (field !== 'SourceId' && field !== 'TargetId') {
        return undefined
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
        return undefined
    }

    const kindField = field === 'SourceId' ? 'SourceKind' : 'TargetKind'
    const rawKind = rowData[kindField]
    if (typeof rawKind !== 'string' || rawKind.trim().length === 0) {
        return undefined
    }

    const entityCodename = resolveTemplateSeedRelationEndpointEntityCodename(rawKind)
    if (!entityCodename) {
        return undefined
    }

    return elementIdMap.get(buildTemplateSeedElementMapKey(entityCodename, value)) ?? value
}

const resolveTemplateSeedRelationEndpointEntityCodename = (kind: string): string | null => {
    switch (kind.trim().toLowerCase()) {
        case 'concept':
            return 'Concept'
        case 'interpretation':
            return 'Interpretation'
        case 'material':
            return 'Material'
        default:
            return null
    }
}

const assertExistingElementBelongsToSeed = (
    existing: Record<string, unknown>,
    entityCodename: string,
    element: TemplateSeedElement
): string | null => {
    if (!element.codename) return null
    const markerCodename = readSeedMarkerCodename(existing.data)
    if (markerCodename === element.codename && typeof existing.id === 'string') {
        return existing.id
    }

    throw new Error(
        `Seed element conflict for ${entityCodename}:${element.codename} at sortOrder=${element.sortOrder}. Existing row has no matching seed marker.`
    )
}

export async function createTemplateSeedElements(options: {
    qb: Knex
    schemaName: string
    elementsByEntity: Record<string, TemplateSeedElement[]>
    entities: NonNullable<MetahubTemplateSeed['entities']>
    enumerationValueIdMap: Map<string, string>
    resolveEntityIdByCodename: (codename: string) => string | null
}): Promise<void> {
    const { qb, schemaName, elementsByEntity, entities, enumerationValueIdMap, resolveEntityIdByCodename } = options
    const now = new Date()
    const elementIdMap = new Map<string, string>()
    const componentsByEntity = buildTemplateSeedComponentMap(entities)
    const pendingInserts: Array<{
        id: string
        objectId: string
        componentMap: Map<string, TemplateSeedComponent>
        element: TemplateSeedElement
    }> = []

    for (const [entityCodename, elements] of Object.entries(elementsByEntity)) {
        const objectId = resolveEntityIdByCodename(entityCodename)
        if (!objectId) {
            log.warn(`Entity codename "${entityCodename}" not found or ambiguous, skipping elements`)
            continue
        }
        const componentMap = componentsByEntity.get(entityCodename) ?? new Map<string, TemplateSeedComponent>()

        for (const element of elements) {
            const exists = await qb
                .withSchema(schemaName)
                .from('_mhb_elements')
                .where({
                    object_id: objectId,
                    sort_order: element.sortOrder,
                    _upl_deleted: false,
                    _mhb_deleted: false
                })
                .first()

            if (exists) {
                const existingId = assertExistingElementBelongsToSeed(exists, entityCodename, element)
                if (existingId) {
                    elementIdMap.set(buildTemplateSeedElementMapKey(entityCodename, element.codename!), existingId)
                }
                continue
            }

            const id = generateUuidV7()
            if (element.codename) {
                elementIdMap.set(buildTemplateSeedElementMapKey(entityCodename, element.codename), id)
            }
            pendingInserts.push({ id, objectId, componentMap, element })
        }
    }

    for (const entry of pendingInserts) {
        const resolvedData = withSeedMarker(
            resolveTemplateSeedElementData(entry.element.data ?? {}, entry.componentMap, enumerationValueIdMap, elementIdMap),
            entry.element
        )

        await qb.withSchema(schemaName).into('_mhb_elements').insert({
            id: entry.id,
            object_id: entry.objectId,
            data: resolvedData,
            sort_order: entry.element.sortOrder,
            owner_id: null,
            _upl_created_at: now,
            _upl_created_by: null,
            _upl_updated_at: now,
            _upl_updated_by: null,
            _upl_version: 1,
            _upl_archived: false,
            _upl_deleted: false,
            _upl_locked: false,
            _mhb_published: true,
            _mhb_archived: false,
            _mhb_deleted: false
        })
    }
}
