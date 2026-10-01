import { resolveEntityTableName, type EntityDefinition, type SchemaChange } from '@universo-react/schema-ddl'
import { ComponentDefinitionDataType } from '@universo-react/types'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import {
    ENUMERATION_KIND,
    type DiffEntityGroupDetails,
    type DiffStructuredChange,
    type DiffTableDetails,
    type EntityField,
    type SnapshotElementRow,
    type SnapshotEnumerationValue
} from './syncTypes'
import {
    isRecord,
    normalizeReferenceId,
    resolveElementPreviewLabel,
    resolveLocalizedPreviewText,
    resolveSetConstantPreviewValue
} from './syncHelpers'

// --- Preview label maps ---

export function buildPreviewLabelMaps(
    entities: EntityDefinition[],
    snapshot: PublishedApplicationSnapshot
): {
    objectElementLabels: Map<string, Map<string, string>>
    enumerationValueLabels: Map<string, Map<string, string>>
} {
    const entityMap = new Map(entities.map((entity) => [entity.id, entity]))
    const objectElementLabels = new Map<string, Map<string, string>>()
    const enumerationValueLabels = new Map<string, Map<string, string>>()

    for (const [objectId, rawElements] of Object.entries(snapshot.elements ?? {})) {
        const entity = entityMap.get(objectId)
        if (!entity || entity.kind !== 'object') continue

        const labels = new Map<string, string>()
        for (const rawElement of rawElements ?? []) {
            const element = (rawElement ?? {}) as SnapshotElementRow
            if (!element.id || !isRecord(element.data)) continue

            const label = resolveElementPreviewLabel(entity, element.data as Record<string, unknown>)
            if (label) {
                labels.set(element.id, label)
            }
        }
        if (labels.size > 0) {
            objectElementLabels.set(objectId, labels)
        }
    }

    for (const [objectId, values] of Object.entries(snapshot.optionValues ?? {})) {
        const labels = new Map<string, string>()
        const typedValues = Array.isArray(values) ? (values as SnapshotEnumerationValue[]) : []
        for (const value of typedValues) {
            const presentation = isRecord(value.presentation) ? (value.presentation as Record<string, unknown>) : null
            const localizedName = resolveLocalizedPreviewText(presentation?.name)
            const id = typeof value.id === 'string' ? value.id : null
            const label = localizedName || resolveLocalizedPreviewText(value.codename) || id
            if (id && label) {
                labels.set(id, label)
            }
        }
        if (labels.size > 0) {
            enumerationValueLabels.set(objectId, labels)
        }
    }

    return { objectElementLabels, enumerationValueLabels }
}

// --- Diff builders ---

export function buildCreateTableDetails(options: {
    entities: EntityDefinition[]
    snapshot: PublishedApplicationSnapshot
    includeEntityIds?: Set<string>
}): DiffTableDetails[] {
    const { entities, snapshot, includeEntityIds } = options
    const objectEntities = entities.filter((entity) => entity.kind === 'object')
    const { objectElementLabels, enumerationValueLabels } = buildPreviewLabelMaps(entities, snapshot)
    const flattenFieldDetails = (fields: EntityField[] = []): DiffTableDetails['fields'] =>
        fields.flatMap((field) => {
            const current = {
                id: field.id,
                codename: field.codename,
                dataType: field.dataType,
                isRequired: Boolean(field.isRequired),
                parentComponentId: field.parentComponentId ?? null
            }
            const childFields = Array.isArray(field.childFields) ? flattenFieldDetails(field.childFields as EntityField[]) : []
            return [current, ...childFields]
        })

    return objectEntities
        .filter((entity) => (includeEntityIds ? includeEntityIds.has(entity.id) : true))
        .map((entity) => {
            const fields = flattenFieldDetails(entity.fields ?? [])

            const elements = (snapshot.elements && (snapshot.elements as Record<string, unknown[]>)[entity.id]) as unknown[] | undefined
            const records = Array.isArray(elements)
                ? elements.map((el) => {
                      const normalized = (el ?? {}) as Record<string, unknown>
                      const rawData = (normalized.data as Record<string, unknown>) ?? {}
                      const previewData: Record<string, unknown> = {}

                      for (const field of entity.fields ?? []) {
                          const rawValue = rawData[field.codename]
                          if (rawValue === null || rawValue === undefined) {
                              previewData[field.codename] = rawValue
                              continue
                          }

                          if (field.dataType !== ComponentDefinitionDataType.REF) {
                              previewData[field.codename] = rawValue
                              continue
                          }

                          const refId = normalizeReferenceId(rawValue)
                          if (!refId) {
                              previewData[field.codename] = rawValue
                              continue
                          }

                          if (field.targetEntityKind === ENUMERATION_KIND && field.targetEntityId) {
                              const label = enumerationValueLabels.get(field.targetEntityId)?.get(refId)
                              previewData[field.codename] = label ?? refId
                              continue
                          }

                          if (field.targetEntityKind === 'set') {
                              previewData[field.codename] = resolveSetConstantPreviewValue(field, refId)
                              continue
                          }

                          if (field.targetEntityKind === 'object' && field.targetEntityId) {
                              const label = objectElementLabels.get(field.targetEntityId)?.get(refId)
                              previewData[field.codename] = label ?? refId
                              continue
                          }

                          previewData[field.codename] = refId
                      }

                      return {
                          id: String(normalized.id ?? ''),
                          data: previewData,
                          sortOrder: typeof normalized.sortOrder === 'number' ? normalized.sortOrder : 0
                      }
                  })
                : []

            return {
                id: entity.id,
                codename: entity.codename,
                tableName: resolveEntityTableName(entity),
                fields,
                recordsCount: records.length,
                recordsPreview: records.slice(0, 50)
            }
        })
}

export function buildCreateEntityGroupDetails(options: {
    entities: EntityDefinition[]
    snapshot: PublishedApplicationSnapshot
    includeEntityIds?: Set<string>
}): DiffEntityGroupDetails[] {
    const { entities, snapshot, includeEntityIds } = options
    const createTablesByEntityId = new Map(
        buildCreateTableDetails({ entities, snapshot, includeEntityIds }).map((table) => [table.id, table])
    )
    const snapshotEntities = isRecord(snapshot.entities) ? Object.values(snapshot.entities) : []
    const entityTypeDefinitions = isRecord(snapshot.entityTypeDefinitions) ? snapshot.entityTypeDefinitions : {}
    const fixedValuesByEntityId = isRecord(snapshot.fixedValues) ? snapshot.fixedValues : {}
    const optionValuesByEntityId = isRecord(snapshot.optionValues) ? snapshot.optionValues : {}

    const flattenFieldDetails = (fields: unknown[] = []): DiffEntityGroupDetails['entities'][number]['fields'] =>
        fields.flatMap((field) => {
            if (!isRecord(field)) {
                return []
            }

            const fieldId = typeof field.id === 'string' ? field.id : ''
            const presentation = isRecord(field.presentation) ? field.presentation : {}
            const current = {
                id: fieldId,
                codename: field.codename,
                name: presentation.name,
                dataType: typeof field.dataType === 'string' ? field.dataType : '',
                isRequired: Boolean(field.isRequired),
                parentComponentId: typeof field.parentComponentId === 'string' ? field.parentComponentId : null
            }
            const childFields = Array.isArray(field.childFields) ? flattenFieldDetails(field.childFields) : []
            return [current, ...childFields]
        })

    const getCollectionCount = (collection: Record<string, unknown>, entityId: string): number => {
        const values = collection[entityId]
        return Array.isArray(values) ? values.length : 0
    }

    const getPageBlockCount = (entity: Record<string, unknown>): number => {
        const config = isRecord(entity.config) ? entity.config : {}
        const blockContent = isRecord(config.blockContent) ? config.blockContent : {}
        return Array.isArray(blockContent.blocks) ? blockContent.blocks.length : 0
    }

    const getLinkedEntityCount = (entityId: string): number =>
        snapshotEntities.filter((candidate) => {
            if (!isRecord(candidate) || candidate.id === entityId) {
                return false
            }

            const directHubs = Array.isArray(candidate.hubs) ? candidate.hubs : []
            if (directHubs.includes(entityId)) {
                return true
            }

            const config = isRecord(candidate.config) ? candidate.config : {}
            const configHubs = Array.isArray(config.hubs) ? config.hubs : []
            return configHubs.includes(entityId)
        }).length

    const buildEntityMetrics = (
        kind: string,
        entityId: string,
        rawEntity: Record<string, unknown>,
        fieldsCount: number,
        recordsCount: number
    ): DiffEntityGroupDetails['entities'][number]['metrics'] => {
        if (kind === 'object') {
            return [
                { key: 'fields', count: fieldsCount },
                { key: 'elements', count: recordsCount }
            ]
        }

        if (kind === 'set') {
            const constantsCount = getCollectionCount(fixedValuesByEntityId, entityId)
            return constantsCount > 0 ? [{ key: 'constants', count: constantsCount }] : []
        }

        if (kind === ENUMERATION_KIND) {
            const valuesCount = getCollectionCount(optionValuesByEntityId, entityId)
            return valuesCount > 0 ? [{ key: 'values', count: valuesCount }] : []
        }

        if (kind === 'page') {
            const blocksCount = getPageBlockCount(rawEntity)
            return blocksCount > 0 ? [{ key: 'blocks', count: blocksCount }] : []
        }

        if (kind === 'hub') {
            const linkedEntitiesCount = getLinkedEntityCount(entityId)
            return linkedEntitiesCount > 0 ? [{ key: 'linkedEntities', count: linkedEntitiesCount }] : []
        }

        const fallbackMetrics = [
            fieldsCount > 0 ? { key: 'fields', count: fieldsCount } : null,
            recordsCount > 0 ? { key: 'elements', count: recordsCount } : null
        ].filter((metric): metric is { key: string; count: number } => Boolean(metric))
        return fallbackMetrics
    }

    const groups = new Map<string, DiffEntityGroupDetails>()
    for (const rawEntity of snapshotEntities) {
        if (!isRecord(rawEntity)) {
            continue
        }

        const entityId = typeof rawEntity.id === 'string' ? rawEntity.id : ''
        if (!entityId || (includeEntityIds && !includeEntityIds.has(entityId))) {
            continue
        }

        const kind = typeof rawEntity.kind === 'string' ? rawEntity.kind : 'unknown'
        const rawType = entityTypeDefinitions[kind]
        const entityType = isRecord(rawType) ? rawType : {}
        const entityTypePresentation = isRecord(entityType.presentation) ? entityType.presentation : {}
        const entityTypeUi = isRecord(entityType.ui) ? entityType.ui : {}
        const sortOrder = typeof entityTypeUi.sidebarOrder === 'number' ? entityTypeUi.sidebarOrder : Number.MAX_SAFE_INTEGER

        if (!groups.has(kind)) {
            groups.set(kind, {
                kindKey: kind,
                typeCodename: entityType.codename,
                typeName: entityTypePresentation.name,
                sortOrder,
                entities: []
            })
        }

        const presentation: Record<string, unknown> = isRecord(rawEntity.presentation) ? rawEntity.presentation : {}
        const tableDetails = createTablesByEntityId.get(entityId)
        const fields = Array.isArray(rawEntity.fields) ? flattenFieldDetails(rawEntity.fields) : []
        const fallbackTableName = entities.find((entity) => entity.id === entityId) ?? null
        const recordsCount = tableDetails?.recordsCount ?? 0
        groups.get(kind)?.entities.push({
            id: entityId,
            kind,
            codename: rawEntity.codename,
            name: presentation.name,
            description: presentation.description,
            tableName: tableDetails?.tableName ?? (fallbackTableName ? resolveEntityTableName(fallbackTableName) : null),
            fields,
            recordsCount,
            recordsPreview: tableDetails?.recordsPreview ?? [],
            metrics: buildEntityMetrics(kind, entityId, rawEntity, fields.length, recordsCount)
        })
    }

    return Array.from(groups.values())
        .sort((left, right) => left.sortOrder - right.sortOrder || left.kindKey.localeCompare(right.kindKey))
        .map((group) => ({
            ...group,
            entities: group.entities.sort((left, right) => {
                const leftOrder = entities.findIndex((entity) => entity.id === left.id)
                const rightOrder = entities.findIndex((entity) => entity.id === right.id)
                const normalizedLeftOrder = leftOrder >= 0 ? leftOrder : Number.MAX_SAFE_INTEGER
                const normalizedRightOrder = rightOrder >= 0 ? rightOrder : Number.MAX_SAFE_INTEGER
                return normalizedLeftOrder - normalizedRightOrder || left.id.localeCompare(right.id)
            })
        }))
}

export function mapStructuredChange(change: SchemaChange): DiffStructuredChange {
    return {
        type: String(change.type),
        description: change.description,
        entityCodename: change.entityCodename,
        fieldCodename: change.fieldCodename,
        tableName: change.tableName,
        dataType: typeof change.newValue === 'string' ? change.newValue : undefined,
        oldValue: change.oldValue,
        newValue: change.newValue
    }
}
