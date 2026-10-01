import { qColumn, qSchemaTable } from '@universo-react/database'
import {
    getLayoutWidgetDefinition,
    isCompatibleWidgetBindingEntity,
    MARKETING_MAX_RUNTIME_RECORDS,
    MAX_WIDGET_BINDING_RESOLVED_RECORDS,
    type LayoutWidgetDefinition,
    type WidgetBindingSlotDefinition,
    type WidgetBindingTarget
} from '@universo-react/types'
import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import { resolveRuntimeCodenameText, runtimeCodenameTextSql, runtimeObjectFilterSql } from '../shared/runtimeHelpers'
import { buildPublicMarketingLifecyclePredicate } from '../shared/marketingRuntimeLifecycleSql'
import { PUBLIC_MARKETING_ROW_LIMIT } from '../shared/marketingRuntimeLimits'
import type { LoadedWidgetBindingRecord } from '../services/widgetBindingResolver'
import type { WidgetBindingRecordQuery } from '../services/widgetBindingQuery'
import { isWidgetBindingSemanticKeyValid } from './widgetBindingSemanticKey'

export class PublicMarketingMaterializationError extends Error {
    constructor(message = 'Public marketing materialization is invalid') {
        super(message)
        this.name = 'PublicMarketingMaterializationError'
    }
}

interface RuntimeObjectMetadataRow {
    id: unknown
    codename: unknown
    tableName: unknown
    kind: unknown
    config: unknown
}

interface RuntimeComponentMetadataRow {
    objectId: unknown
    codename: unknown
    columnName: unknown
    dataType: unknown
    isRequired: unknown
    validationRules: unknown
    targetObjectId: unknown
    targetObjectKind: unknown
    targetObjectCodename: unknown
}

interface PublishedObjectMetadata {
    readonly id: string
    readonly codename: string
    readonly tableName: string
    readonly kind: string
    readonly config: unknown
}

interface PublishedComponentMetadata {
    readonly codename: string
    readonly columnName: string
    readonly dataType: string
    readonly isRequired: boolean
    readonly validationRules: unknown
    readonly targetObjectId: string | null
    readonly targetObjectKind: string | null
    readonly targetObjectCodename: string | null
}

interface CompatiblePublishedObject {
    readonly object: PublishedObjectMetadata
    readonly components: ReadonlyMap<string, PublishedComponentMetadata>
}

interface PublicMarketingBindingLoadRequest {
    readonly widgetKey: string
    readonly rendererConfig: unknown
    readonly query: WidgetBindingRecordQuery
}

export type PublicMarketingBindingRecordLoader = (
    request: PublicMarketingBindingLoadRequest
) => Promise<readonly LoadedWidgetBindingRecord[]>

interface PublicMarketingBindingRuntimeScope {
    readonly schemaName: string
    readonly workspaceId: string | null
}

const CODE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/u

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const assertCodename = (value: string): void => {
    if (typeof value !== 'string' || !CODE_NAME_PATTERN.test(value)) {
        throw new PublicMarketingMaterializationError('Public marketing binding target is invalid')
    }
}

const isObjectCapabilityEnabled = (config: unknown, capability: 'dataSchema' | 'records'): boolean => {
    if (!isRecord(config) || !isRecord(config.capabilities)) return false
    const value = config.capabilities[capability]
    return isRecord(value) && value.enabled === true
}

const getBindingSlot = (definition: LayoutWidgetDefinition | undefined, slotKey: string): WidgetBindingSlotDefinition => {
    const slot = definition?.bindingSlots?.find((candidate) => candidate.key === slotKey)
    if (!slot) throw new PublicMarketingMaterializationError('Public marketing binding slot is not registered')
    return slot
}

const getComponentRequirement = (slot: WidgetBindingSlotDefinition, field: string) => {
    const requirement = slot.requirements.components.find((candidate) => candidate.field === field)
    if (!requirement) throw new PublicMarketingMaterializationError('Public marketing binding projection is invalid')
    return requirement
}

const assertTargetSelector = (slot: WidgetBindingSlotDefinition, target: WidgetBindingTarget): void => {
    if (target.entityKind !== 'object' || !slot.selectorKinds.includes(target.selector.kind)) {
        throw new PublicMarketingMaterializationError('Public marketing binding selector is invalid')
    }

    if (target.selector.kind === 'semantic-key') {
        const requirement = getComponentRequirement(slot, target.selector.field)
        if (!isWidgetBindingSemanticKeyValid(target.selector.value, requirement)) {
            throw new PublicMarketingMaterializationError('Public marketing semantic selector is invalid')
        }
        return
    }

    if (target.selector.kind === 'relation-set') {
        if (slot.relation?.parentSlot !== target.selector.parentSlot) {
            throw new PublicMarketingMaterializationError('Public marketing relation selector is invalid')
        }
        return
    }

    if (target.selector.kind !== 'record-set') {
        throw new PublicMarketingMaterializationError('Public marketing binding selector is invalid')
    }
}

const assertProjection = (
    definition: LayoutWidgetDefinition | undefined,
    slot: WidgetBindingSlotDefinition,
    query: WidgetBindingRecordQuery
): void => {
    if (query.projection.length !== slot.requirements.components.length) {
        throw new PublicMarketingMaterializationError('Public marketing binding projection is invalid')
    }
    const actual = new Map(query.projection.map((field) => [field.field, field.componentCodename]))
    if (actual.size !== query.projection.length) {
        throw new PublicMarketingMaterializationError('Public marketing binding projection is invalid')
    }
    for (const required of slot.requirements.components) {
        if (actual.get(required.field) !== required.componentCodename) {
            throw new PublicMarketingMaterializationError('Public marketing binding projection is invalid')
        }
    }

    assertTargetSelector(slot, query.target)
    if (query.target.selector.kind !== query.kind) {
        throw new PublicMarketingMaterializationError('Public marketing binding selector does not match its query')
    }

    if (query.kind === 'semantic-key') {
        const selector = query.target.selector
        if (selector.kind !== 'semantic-key') {
            throw new PublicMarketingMaterializationError('Public marketing semantic selector is invalid')
        }
        const requirement = getComponentRequirement(slot, selector.field)
        if (
            query.selector.componentCodename !== requirement.componentCodename ||
            query.selector.value !== selector.value ||
            query.limit !== 2
        ) {
            throw new PublicMarketingMaterializationError('Public marketing semantic selector does not match its query')
        }
        return
    }

    const maxRecords = slot.maxResolvedRecords
    const orderRequirement = slot.orderByField ? getComponentRequirement(slot, slot.orderByField) : undefined
    const visibilityRequirement = slot.visibilityField ? getComponentRequirement(slot, slot.visibilityField) : undefined
    if (
        !maxRecords ||
        !orderRequirement ||
        query.ordered.orderByComponentCodename !== orderRequirement.componentCodename ||
        query.ordered.limit < 1 ||
        query.ordered.limit > maxRecords ||
        query.ordered.limit > MAX_WIDGET_BINDING_RESOLVED_RECORDS ||
        (visibilityRequirement?.componentCodename ?? undefined) !== query.ordered.visibilityComponentCodename
    ) {
        throw new PublicMarketingMaterializationError('Public marketing ordered selector does not match its query')
    }

    if (query.kind === 'relation-set') {
        const relation = slot.relation
        const relationRequirement = relation ? getComponentRequirement(slot, relation.field) : undefined
        const parentSlot = relation ? getBindingSlot(definition, relation.parentSlot) : undefined
        if (
            !relation ||
            query.target.selector.kind !== 'relation-set' ||
            query.target.selector.parentSlot !== relation.parentSlot ||
            !relationRequirement ||
            relationRequirement.valueType !== 'ref' ||
            query.selector.relationComponentCodename !== relationRequirement.componentCodename ||
            query.selector.parentTarget.entityKind !== 'object' ||
            !Array.isArray(query.selector.parentRecordIds) ||
            query.selector.parentRecordIds.length === 0 ||
            query.selector.parentRecordIds.length > MAX_WIDGET_BINDING_RESOLVED_RECORDS ||
            query.selector.parentRecordIds.some((id) => !isUuidV7(id)) ||
            new Set(query.selector.parentRecordIds).size !== query.selector.parentRecordIds.length ||
            !parentSlot
        ) {
            throw new PublicMarketingMaterializationError('Public marketing relation selector does not match its query')
        }
        assertTargetSelector(parentSlot, query.selector.parentTarget)
        return
    }

    if (query.kind !== 'record-set') {
        throw new PublicMarketingMaterializationError('Public marketing ordered selector is invalid')
    }
}

/**
 * A request-local registry-driven loader for anonymous published marketing
 * widgets. Every table read is derived from a registered slot and a validated
 * Object/Component contract; no content table is scanned or returned wholesale.
 */
export const createPublicMarketingBindingRecordLoader = (
    executor: DbExecutor,
    scope: PublicMarketingBindingRuntimeScope
): PublicMarketingBindingRecordLoader => {
    if (scope.workspaceId !== null && !isUuidV7(scope.workspaceId)) {
        throw new PublicMarketingMaterializationError('Public marketing workspace id is invalid')
    }

    const objectMetadataByCodename = new Map<string, Promise<PublishedObjectMetadata>>()
    const componentMetadataByObjectAndContract = new Map<string, Promise<ReadonlyMap<string, PublishedComponentMetadata>>>()
    const workspaceScopeByTable = new Map<string, Promise<boolean>>()
    let totalLoadedRecords = 0

    const readObjectMetadata = async (entityCodename: string): Promise<PublishedObjectMetadata> => {
        const existing = objectMetadataByCodename.get(entityCodename)
        if (existing) return existing

        const pending = (async () => {
            const objectsTable = qSchemaTable(scope.schemaName, '_app_objects')
            const rows = await executor.query<RuntimeObjectMetadataRow>(
                `
                SELECT
                    o.id,
                    ${runtimeCodenameTextSql('o.codename')} AS codename,
                    o.table_name AS "tableName",
                    o.kind,
                    o.config
                FROM ${objectsTable} o
                WHERE o.kind = 'object'
                  AND ${runtimeObjectFilterSql('o.kind', 'o.config')}
                  AND ${runtimeCodenameTextSql('o.codename')} = $1
                  AND ${buildPublicMarketingLifecyclePredicate('o')}
                ORDER BY o.id ASC
                LIMIT 2
                `,
                [entityCodename]
            )
            if (rows.length !== 1) {
                throw new PublicMarketingMaterializationError('Published marketing Object is unavailable or ambiguous')
            }

            const row = rows[0]
            const id = typeof row?.id === 'string' ? row.id : ''
            const codename = resolveRuntimeCodenameText(row?.codename)
            const tableName = typeof row?.tableName === 'string' ? row.tableName : ''
            if (!isUuidV7(id) || codename !== entityCodename || !tableName) {
                throw new PublicMarketingMaterializationError('Published marketing Object metadata is invalid')
            }
            return { id, codename, tableName, kind: String(row?.kind ?? ''), config: row?.config }
        })()
        objectMetadataByCodename.set(entityCodename, pending)
        return pending
    }

    const readComponentMetadata = async (
        object: PublishedObjectMetadata,
        slot: WidgetBindingSlotDefinition
    ): Promise<ReadonlyMap<string, PublishedComponentMetadata>> => {
        const requiredCodenames = slot.requirements.components.map(({ componentCodename }) => componentCodename)
        const cacheKey = `${object.id}\u0000${requiredCodenames.slice().sort().join('\u0000')}`
        const existing = componentMetadataByObjectAndContract.get(cacheKey)
        if (existing) return existing

        const pending = (async () => {
            const componentsTable = qSchemaTable(scope.schemaName, '_app_components')
            const objectsTable = qSchemaTable(scope.schemaName, '_app_objects')
            const rows = await executor.query<RuntimeComponentMetadataRow>(
                `
                SELECT
                    c.object_id AS "objectId",
                    ${runtimeCodenameTextSql('c.codename')} AS codename,
                    c.column_name AS "columnName",
                    c.data_type AS "dataType",
                    c.is_required AS "isRequired",
                    c.validation_rules AS "validationRules",
                    c.target_object_id AS "targetObjectId",
                    c.target_object_kind AS "targetObjectKind",
                    ${runtimeCodenameTextSql('target_object.codename')} AS "targetObjectCodename"
                FROM ${componentsTable} c
                LEFT JOIN ${objectsTable} target_object
                  ON target_object.id = c.target_object_id
                 AND target_object.kind = 'object'
                 AND ${buildPublicMarketingLifecyclePredicate('target_object')}
                WHERE c.object_id = $1::uuid
                  AND c.parent_component_id IS NULL
                  AND ${runtimeCodenameTextSql('c.codename')} = ANY($2::text[])
                  AND ${buildPublicMarketingLifecyclePredicate('c')}
                ORDER BY c.sort_order ASC, c._upl_created_at ASC, c.id ASC
                LIMIT $3
                `,
                [object.id, requiredCodenames, requiredCodenames.length + 1]
            )
            if (rows.length !== requiredCodenames.length) {
                throw new PublicMarketingMaterializationError('Published marketing Component contract is incomplete')
            }

            const components = new Map<string, PublishedComponentMetadata>()
            for (const row of rows) {
                if (row.objectId !== object.id) {
                    throw new PublicMarketingMaterializationError('Published marketing Component owner is invalid')
                }
                const codename = resolveRuntimeCodenameText(row.codename)
                const columnName = typeof row.columnName === 'string' ? row.columnName : ''
                if (!requiredCodenames.includes(codename) || !columnName || components.has(codename)) {
                    throw new PublicMarketingMaterializationError('Published marketing Component metadata is invalid')
                }
                try {
                    qColumn(columnName)
                } catch {
                    throw new PublicMarketingMaterializationError('Published marketing Component column is unsafe')
                }
                const targetObjectId = typeof row.targetObjectId === 'string' ? row.targetObjectId : null
                if (targetObjectId !== null && !isUuidV7(targetObjectId)) {
                    throw new PublicMarketingMaterializationError('Published marketing relation target is invalid')
                }
                components.set(codename, {
                    codename,
                    columnName,
                    dataType: String(row.dataType ?? ''),
                    isRequired: row.isRequired === true,
                    validationRules: row.validationRules,
                    targetObjectId,
                    targetObjectKind: typeof row.targetObjectKind === 'string' ? row.targetObjectKind : null,
                    targetObjectCodename:
                        typeof row.targetObjectCodename === 'string' && row.targetObjectCodename.length > 0
                            ? resolveRuntimeCodenameText(row.targetObjectCodename)
                            : null
                })
            }
            return components
        })()
        componentMetadataByObjectAndContract.set(cacheKey, pending)
        return pending
    }

    const getCompatibleObject = async (slot: WidgetBindingSlotDefinition, entityCodename: string): Promise<CompatiblePublishedObject> => {
        assertCodename(entityCodename)
        const object = await readObjectMetadata(entityCodename)
        if (
            object.kind !== 'object' ||
            !isObjectCapabilityEnabled(object.config, 'dataSchema') ||
            !isObjectCapabilityEnabled(object.config, 'records')
        ) {
            throw new PublicMarketingMaterializationError('Published marketing Object capabilities are incompatible')
        }
        const components = await readComponentMetadata(object, slot)
        const compatible = isCompatibleWidgetBindingEntity(slot, {
            kind: object.kind,
            config: object.config,
            components: [...components.values()].map(({ codename, dataType, isRequired, validationRules }) => ({
                codename,
                dataType,
                isRequired,
                validationRules
            }))
        })
        if (!compatible) throw new PublicMarketingMaterializationError('Published marketing Object/Component contract is incompatible')

        const physicalColumns = new Set<string>()
        for (const component of components.values()) {
            if (physicalColumns.has(component.columnName)) {
                throw new PublicMarketingMaterializationError('Published marketing Component columns are ambiguous')
            }
            physicalColumns.add(component.columnName)
        }
        return { object, components }
    }

    const isWorkspaceScoped = async (tableName: string): Promise<boolean> => {
        const existing = workspaceScopeByTable.get(tableName)
        if (existing) return existing
        const pending = executor
            .query<{ workspaceScoped: unknown }>(
                `
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = $1
                      AND table_name = $2
                      AND column_name = 'workspace_id'
                ) AS "workspaceScoped"
                `,
                [scope.schemaName, tableName]
            )
            .then((rows) => rows[0]?.workspaceScoped === true)
        workspaceScopeByTable.set(tableName, pending)
        return pending
    }

    return async ({ widgetKey, rendererConfig, query }): Promise<readonly LoadedWidgetBindingRecord[]> => {
        assertCodename(query.target.entityCodename)
        const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
        const slot = getBindingSlot(definition, query.slot)
        assertProjection(definition, slot, query)

        const compatible = await getCompatibleObject(slot, query.target.entityCodename)
        const componentByCodename = compatible.components
        const componentByField = new Map(
            slot.requirements.components.map((requirement) => {
                const component = componentByCodename.get(requirement.componentCodename)
                if (!component) throw new PublicMarketingMaterializationError('Published marketing Component is unavailable')
                return [requirement.field, component] as const
            })
        )

        const childTable = qSchemaTable(scope.schemaName, compatible.object.tableName)
        const childWorkspaceScoped = await isWorkspaceScoped(compatible.object.tableName)
        if (scope.workspaceId !== null && !childWorkspaceScoped) {
            throw new PublicMarketingMaterializationError('Published marketing Object is missing workspace isolation')
        }

        let parent: CompatiblePublishedObject | undefined
        let parentWorkspaceScoped = false
        if (query.kind === 'relation-set') {
            const relation = slot.relation
            if (!relation) throw new PublicMarketingMaterializationError('Published marketing relation is not registered')
            const parentSlot = getBindingSlot(definition, relation.parentSlot)
            parent = await getCompatibleObject(parentSlot, query.selector.parentTarget.entityCodename)
            const relationRequirement = getComponentRequirement(slot, relation.field)
            const relationComponent = componentByCodename.get(relationRequirement.componentCodename)
            if (
                !relationComponent ||
                relationComponent.dataType.trim().toUpperCase() !== 'REF' ||
                relationComponent.targetObjectId !== parent.object.id ||
                relationComponent.targetObjectKind !== 'object' ||
                relationComponent.targetObjectCodename !== parent.object.codename
            ) {
                throw new PublicMarketingMaterializationError('Published marketing relation target does not match its parent slot')
            }
            parentWorkspaceScoped = await isWorkspaceScoped(parent.object.tableName)
            if (scope.workspaceId !== null && !parentWorkspaceScoped) {
                throw new PublicMarketingMaterializationError('Published marketing parent Object is missing workspace isolation')
            }
        }

        const parameters: unknown[] = []
        let workspaceParameter: string | undefined
        if (scope.workspaceId !== null) {
            parameters.push(scope.workspaceId)
            workspaceParameter = `$${parameters.length}`
        }
        const workspacePredicate = (alias: string, isScoped: boolean): string => {
            if (!isScoped) return ''
            return scope.workspaceId === null
                ? `AND ${alias}.${qColumn('workspace_id')} IS NULL`
                : `AND ${alias}.${qColumn('workspace_id')} = ${workspaceParameter}`
        }

        const predicates = [buildPublicMarketingLifecyclePredicate('record'), workspacePredicate('record', childWorkspaceScoped)]
        if (query.kind === 'semantic-key') {
            const selector = query.target.selector
            if (selector.kind !== 'semantic-key') {
                throw new PublicMarketingMaterializationError('Published marketing semantic selector is invalid')
            }
            const selectorComponent = componentByField.get(selector.field)
            if (!selectorComponent) throw new PublicMarketingMaterializationError('Published marketing semantic Component is unavailable')
            parameters.push(query.selector.value)
            predicates.push(`AND record.${qColumn(selectorComponent.columnName)} = $${parameters.length}`)
        } else if (query.kind === 'relation-set') {
            const relationComponent = componentByField.get(slot.relation!.field)
            const parentTable = qSchemaTable(scope.schemaName, parent!.object.tableName)
            parameters.push(query.selector.parentRecordIds)
            const parentIdsParameter = `$${parameters.length}::uuid[]`
            predicates.push(`AND record.${qColumn(relationComponent!.columnName)} = ANY(${parentIdsParameter})`)
            predicates.push(
                `AND EXISTS (
                    SELECT 1
                    FROM ${parentTable} parent_record
                    WHERE parent_record.id = record.${qColumn(relationComponent!.columnName)}
                      AND ${buildPublicMarketingLifecyclePredicate('parent_record')}
                      ${workspacePredicate('parent_record', parentWorkspaceScoped)}
                )`
            )
        }

        const visibilityField = query.kind === 'semantic-key' ? slot.visibilityField : undefined
        const visibilityComponentCodename =
            query.kind === 'semantic-key'
                ? visibilityField
                    ? getComponentRequirement(slot, visibilityField).componentCodename
                    : undefined
                : query.ordered.visibilityComponentCodename
        if (visibilityComponentCodename) {
            const visibilityComponent = componentByCodename.get(visibilityComponentCodename)
            if (!visibilityComponent)
                throw new PublicMarketingMaterializationError('Published marketing visibility Component is unavailable')
            predicates.push(`AND record.${qColumn(visibilityComponent.columnName)} = true`)
        }

        const projection = query.projection.map(({ componentCodename }, index) => {
            const component = componentByCodename.get(componentCodename)
            if (!component) throw new PublicMarketingMaterializationError('Published marketing projection Component is unavailable')
            return `record.${qColumn(component.columnName)} AS ${qColumn(`binding_${index}`)}`
        })
        const selectedColumns = [`record.${qColumn('id')} AS ${qColumn('record_id')}`, ...projection]
        let orderBy = `record.${qColumn('id')} ASC`
        let requestedLimit = query.kind === 'semantic-key' ? query.limit : query.ordered.limit
        if (query.kind !== 'semantic-key') {
            const orderComponent = componentByCodename.get(query.ordered.orderByComponentCodename)
            if (!orderComponent) throw new PublicMarketingMaterializationError('Published marketing order Component is unavailable')
            orderBy = `record.${qColumn(orderComponent.columnName)} ASC NULLS LAST, record.${qColumn('id')} ASC`
            requestedLimit = Math.min(requestedLimit, PUBLIC_MARKETING_ROW_LIMIT)
        }
        parameters.push(requestedLimit + 1)

        const rows = await executor.query<Record<string, unknown>>(
            `
            SELECT ${selectedColumns.join(', ')}
            FROM ${childTable} record
            WHERE ${predicates.filter(Boolean).join('\n              ')}
            ORDER BY ${orderBy}
            LIMIT $${parameters.length}
            `,
            parameters
        )
        if (rows.length > requestedLimit) {
            throw new PublicMarketingMaterializationError('Published marketing binding exceeds its registered record limit')
        }
        totalLoadedRecords += rows.length
        if (totalLoadedRecords > MARKETING_MAX_RUNTIME_RECORDS) {
            throw new PublicMarketingMaterializationError('Public marketing runtime exceeds its aggregate record limit')
        }

        return rows.map((row) => {
            const recordId = typeof row.record_id === 'string' ? row.record_id : ''
            if (!isUuidV7(recordId)) throw new PublicMarketingMaterializationError('Published marketing record identity is invalid')
            const data: Record<string, unknown> = {}
            query.projection.forEach(({ field }, index) => {
                const value = row[`binding_${index}`]
                if (value !== undefined) data[field] = value
            })
            return { recordId, data }
        })
    }
}
