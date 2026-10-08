import { qColumn, qSchema, qSchemaTable } from '@universo-react/database'
import {
    isCompatibleWidgetBindingEntity,
    MAX_WIDGET_BINDING_COMPONENTS,
    MAX_WIDGET_BINDING_SLOTS,
    MAX_WIDGET_BINDING_RESOLVED_RECORDS,
    MAX_WIDGET_BINDING_TARGETS,
    type WidgetBindingEntityMetadata,
    type WidgetBindingSlotDefinition
} from '@universo-react/types'
import { isUuidV7, isValidUuid, type DbExecutor } from '@universo-react/utils'
import { resolveRuntimeCodenameText, runtimeCodenameTextSql, runtimeObjectFilterSql } from '../shared/runtimeHelpers'
import { buildRuntimeRecordAccessClause, readRuntimeRecordParentAccessConfigs } from '../services/runtimeRowSupport/access'
import { readRuntimeRecordAccessConfig, type RuntimeObjectCollectionAttr } from '../services/runtimeRowSupport/contracts'
import type { RolePermission } from '../routes/guards'
import type { WidgetBindingRecordQuery } from '../services/widgetBindingQuery'
import { isWidgetBindingSemanticKeyValid } from './widgetBindingSemanticKey'

export interface RuntimeWidgetBindingObjectMetadata {
    readonly id: unknown
    readonly codename: unknown
    readonly kind: unknown
    readonly tableName: unknown
    readonly config: unknown
}

export interface RuntimeWidgetBindingComponentMetadata {
    readonly id?: unknown
    readonly objectId: unknown
    readonly codename: unknown
    readonly columnName: unknown
    readonly dataType: unknown
    readonly presentation?: unknown
    readonly isRequired: unknown
    readonly validationRules: unknown
    readonly targetObjectId?: unknown
    readonly targetObjectKind?: unknown
    readonly uiConfig?: unknown
}

export interface RuntimeWidgetBindingMetadata {
    readonly objectsByCodename: ReadonlyMap<string, RuntimeWidgetBindingObjectMetadata>
    readonly componentsByObjectId: ReadonlyMap<string, readonly RuntimeWidgetBindingComponentMetadata[]>
}

export interface PublishedDashboardMenuEntityMetadata {
    readonly id: unknown
    readonly codename: unknown
    readonly kind: unknown
    readonly presentation: unknown
    readonly config: unknown
    readonly tableName: unknown
}

export class WidgetBindingRuntimeDataError extends Error {
    constructor(message = 'Widget binding runtime data is unavailable') {
        super(message)
        this.name = 'WidgetBindingRuntimeDataError'
    }
}

const MAX_RUNTIME_WIDGET_BINDING_OBJECTS = MAX_WIDGET_BINDING_SLOTS * MAX_WIDGET_BINDING_TARGETS
const MAX_RUNTIME_WIDGET_BINDING_COMPONENT_ROWS = 8192
const MAX_COMPONENTS_PER_OBJECT = MAX_WIDGET_BINDING_COMPONENTS * MAX_WIDGET_BINDING_SLOTS
const MAX_PUBLISHED_DASHBOARD_MENU_ENTITIES = 256
const NO_RUNTIME_PERMISSIONS: Record<RolePermission, boolean> = {
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false,
    readReports: false
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const hasRuntimeCapability = (config: unknown, capability: 'dataSchema' | 'records'): boolean => {
    if (!isRecord(config) || !isRecord(config.capabilities)) return false
    const setting = config.capabilities[capability]
    return isRecord(setting) && setting.enabled === true
}

const lifecyclePredicate = (alias: string): string =>
    `${alias}.${qColumn('_upl_deleted')} = false
        AND ${alias}.${qColumn('_app_deleted')} = false
        AND ${alias}.${qColumn('_upl_archived')} = false
        AND ${alias}.${qColumn('_app_archived')} = false
        AND ${alias}.${qColumn('_app_published')} = true`

/** Load published Page and Hub metadata plus Objects explicitly selected for primary navigation. */
export const loadPublishedDashboardMenuEntities = async (
    executor: DbExecutor,
    schemaName: string
): Promise<readonly PublishedDashboardMenuEntityMetadata[]> => {
    const table = qSchemaTable(schemaName, '_app_objects')
    const rows = await executor.query<Record<string, unknown>>(
        `SELECT ${qColumn('id')}, ${runtimeCodenameTextSql(qColumn('codename'))} AS ${qColumn('codename')},
                ${qColumn('kind')}, ${qColumn('presentation')}, ${qColumn('config')}, ${qColumn('table_name')}
         FROM ${table}
         WHERE (
                ${qColumn('kind')} IN ('hub', 'page')
                OR (
                    ${qColumn('kind')} = 'object'
                    AND ${qColumn('config')} -> 'runtime' ->> 'menuVisibility' = 'primary'
                )
           )
           AND ${qColumn('_upl_deleted')} = false
           AND ${qColumn('_app_deleted')} = false
           AND ${qColumn('_upl_archived')} = false
           AND ${qColumn('_app_archived')} = false
           AND ${qColumn('_app_published')} = true
         ORDER BY ${runtimeCodenameTextSql(qColumn('codename'))} ASC, ${qColumn('id')} ASC
         LIMIT $1`,
        [MAX_PUBLISHED_DASHBOARD_MENU_ENTITIES + 1]
    )
    if (rows.length > MAX_PUBLISHED_DASHBOARD_MENU_ENTITIES) {
        throw new WidgetBindingRuntimeDataError('Published Dashboard menu metadata exceeds its limit')
    }
    return rows.map((row) => ({
        id: row.id,
        codename: row.codename,
        kind: row.kind,
        presentation: row.presentation,
        config: row.config,
        tableName: row.table_name
    }))
}

const assertSlotQuery = (query: WidgetBindingRecordQuery, slot: WidgetBindingSlotDefinition): void => {
    if (
        query.slot !== slot.key ||
        query.target.entityKind !== 'object' ||
        query.target.selector.kind !== query.kind ||
        !slot.selectorKinds.includes(query.kind)
    ) {
        throw new WidgetBindingRuntimeDataError('Widget binding selector does not match its registered slot')
    }

    const projection = new Map(query.projection.map(({ field, componentCodename }) => [field, componentCodename]))
    if (projection.size !== query.projection.length || projection.size !== slot.requirements.components.length) {
        throw new WidgetBindingRuntimeDataError('Widget binding projection is invalid')
    }
    for (const requirement of slot.requirements.components) {
        if (projection.get(requirement.field) !== requirement.componentCodename) {
            throw new WidgetBindingRuntimeDataError('Widget binding projection is invalid')
        }
    }

    if (query.kind === 'semantic-key') {
        const targetSelector = query.target.selector
        const semanticKey = slot.requirements.components.find(({ semanticKey: isKey }) => isKey)
        if (
            targetSelector.kind !== 'semantic-key' ||
            !semanticKey ||
            targetSelector.field !== semanticKey.field ||
            query.selector.componentCodename !== semanticKey.componentCodename ||
            query.selector.value !== targetSelector.value ||
            !isWidgetBindingSemanticKeyValid(targetSelector.value, semanticKey) ||
            query.limit !== 2
        ) {
            throw new WidgetBindingRuntimeDataError('Widget binding semantic selector is invalid')
        }
        return
    }

    const order = slot.requirements.components.find(({ field }) => field === slot.orderByField)
    const visibility = slot.requirements.components.find(({ field }) => field === slot.visibilityField)
    if (
        !slot.maxResolvedRecords ||
        !order ||
        query.ordered.orderByComponentCodename !== order.componentCodename ||
        query.ordered.limit < 1 ||
        query.ordered.limit > slot.maxResolvedRecords ||
        query.ordered.limit > MAX_WIDGET_BINDING_RESOLVED_RECORDS ||
        query.ordered.visibilityComponentCodename !== visibility?.componentCodename
    ) {
        throw new WidgetBindingRuntimeDataError('Widget binding ordered selector is invalid')
    }

    if (query.kind === 'relation-set') {
        const relation = slot.relation
        const relationRequirement = relation && slot.requirements.components.find(({ field }) => field === relation.field)
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
            new Set(query.selector.parentRecordIds).size !== query.selector.parentRecordIds.length
        ) {
            throw new WidgetBindingRuntimeDataError('Widget binding relation selector is invalid')
        }
    }

    if (query.kind === 'learner-enrollment-set') {
        const targetSelector = query.target.selector
        const requiredProjection = new Map([
            ['title', 'TargetTitle'],
            ['assignedUser', 'AssignedUserId'],
            ['targetKind', 'TargetType']
        ])
        if (
            targetSelector.kind !== 'learner-enrollment-set' ||
            !['course', 'track'].includes(query.selector.targetKind) ||
            query.selector.targetKind !== targetSelector.targetKind ||
            slot.key !== 'rows' ||
            slot.requirements.components.length !== requiredProjection.size ||
            slot.requirements.components.some(({ field, componentCodename }) => requiredProjection.get(field) !== componentCodename)
        ) {
            throw new WidgetBindingRuntimeDataError('Widget binding learner enrollment selector is invalid')
        }
    }
}

/** Read only live Object/Component metadata named by registered layout bindings. */
export const loadRuntimeWidgetBindingMetadata = async (
    executor: DbExecutor,
    schemaName: string,
    componentCodenamesByEntity: ReadonlyMap<string, readonly string[]>
): Promise<RuntimeWidgetBindingMetadata> => {
    const requests = [...componentCodenamesByEntity.entries()]
    const requested = requests.map(([codename]) => codename)
    if (requested.length === 0) return { objectsByCodename: new Map(), componentsByObjectId: new Map() }
    if (
        requested.length > MAX_RUNTIME_WIDGET_BINDING_OBJECTS ||
        new Set(requested).size !== requested.length ||
        requests.some(
            ([codename, componentCodenames]) =>
                !/^[A-Za-z][A-Za-z0-9._-]*$/u.test(codename) ||
                componentCodenames.length > MAX_COMPONENTS_PER_OBJECT ||
                new Set(componentCodenames).size !== componentCodenames.length ||
                componentCodenames.some((componentCodename) => !/^[A-Za-z][A-Za-z0-9._-]*$/u.test(componentCodename))
        )
    ) {
        throw new WidgetBindingRuntimeDataError('Widget binding Entity codename is invalid')
    }
    const requestedComponentsByEntity = new Map(requests.map(([codename, components]) => [codename, new Set(components)]))
    const objectsTable = qSchemaTable(schemaName, '_app_objects')
    const objectRows = await executor.query<Record<string, unknown>>(
        `SELECT ${qColumn('id')}, ${runtimeCodenameTextSql(qColumn('codename'))} AS ${qColumn('codename')},
                ${qColumn('kind')}, ${qColumn('table_name')}, ${qColumn('config')}
         FROM ${objectsTable}
         WHERE ${runtimeObjectFilterSql(qColumn('kind'), qColumn('config'))}
           AND ${qColumn('kind')} = 'object'
           AND ${runtimeCodenameTextSql(qColumn('codename'))} = ANY($1::text[])
           AND ${qColumn('_upl_deleted')} = false
           AND ${qColumn('_app_deleted')} = false
           AND ${qColumn('_upl_archived')} = false
           AND ${qColumn('_app_archived')} = false
           AND ${qColumn('_app_published')} = true
         ORDER BY ${qColumn('id')} ASC
         LIMIT $2`,
        [requested, requested.length + 1]
    )
    if (objectRows.length > requested.length) throw new WidgetBindingRuntimeDataError('Widget binding Object metadata exceeds its limit')
    const objectsByCodename = new Map<string, RuntimeWidgetBindingObjectMetadata>()
    const objectIds: string[] = []
    const objectCodenameById = new Map<string, string>()
    for (const row of objectRows) {
        const id = typeof row.id === 'string' ? row.id : ''
        const codename = resolveRuntimeCodenameText(row.codename)
        if (!isUuidV7(id) || !codename || !requested.includes(codename) || objectsByCodename.has(codename)) {
            throw new WidgetBindingRuntimeDataError('Widget binding Entity metadata is ambiguous')
        }
        objectIds.push(id)
        objectCodenameById.set(id, codename)
        objectsByCodename.set(codename, { id, codename, kind: row.kind, tableName: row.table_name, config: row.config })
        const config = isRecord(row.config) ? row.config : null
        const requestedForObject = requestedComponentsByEntity.get(codename)
        if (!requestedForObject) continue
        const accessConfig = readRuntimeRecordAccessConfig(config)
        if (accessConfig?.ownerFieldCodename) requestedForObject.add(accessConfig.ownerFieldCodename)
        for (const parentAccessConfig of readRuntimeRecordParentAccessConfigs(config) ?? []) {
            requestedForObject.add(parentAccessConfig.parentFieldCodename)
        }
    }

    const requestedComponents = [...new Set([...requestedComponentsByEntity.values()].flatMap((components) => [...components]))]
    if (
        requestedComponents.some((codename) => !/^[A-Za-z][A-Za-z0-9._-]*$/u.test(codename)) ||
        [...requestedComponentsByEntity.values()].some((components) => components.size > MAX_COMPONENTS_PER_OBJECT)
    ) {
        throw new WidgetBindingRuntimeDataError('Widget binding Component metadata exceeds its limit')
    }
    const requestedComponentsByObjectId = new Map<string, ReadonlySet<string>>()
    for (const [codename, components] of requestedComponentsByEntity) {
        const object = objectsByCodename.get(codename)
        if (object && typeof object.id === 'string') requestedComponentsByObjectId.set(object.id, components)
    }

    const componentsByObjectId = new Map<string, RuntimeWidgetBindingComponentMetadata[]>()
    if (objectIds.length > 0) {
        const componentsTable = qSchemaTable(schemaName, '_app_components')
        const rows = await executor.query<Record<string, unknown>>(
            `SELECT ${qColumn('id')}, ${qColumn('object_id')},
                    ${runtimeCodenameTextSql(qColumn('codename'))} AS ${qColumn('codename')},
                    ${qColumn('column_name')}, ${qColumn('data_type')}, ${qColumn('presentation')}, ${qColumn('is_required')},
                    ${qColumn('validation_rules')}, ${qColumn('target_object_id')}, ${qColumn('target_object_kind')}, ${qColumn(
                'ui_config'
            )}
             FROM ${componentsTable}
             WHERE ${qColumn('object_id')} = ANY($1::uuid[])
               AND ${runtimeCodenameTextSql(qColumn('codename'))} = ANY($2::text[])
               AND ${qColumn('_upl_deleted')} = false
               AND ${qColumn('_app_deleted')} = false
               AND ${qColumn('_upl_archived')} = false
               AND ${qColumn('_app_archived')} = false
               AND ${qColumn('_app_published')} = true
             ORDER BY ${qColumn('object_id')} ASC, ${qColumn('id')} ASC
             LIMIT $3`,
            [objectIds, requestedComponents, MAX_RUNTIME_WIDGET_BINDING_COMPONENT_ROWS + 1]
        )
        if (rows.length > MAX_RUNTIME_WIDGET_BINDING_COMPONENT_ROWS) {
            throw new WidgetBindingRuntimeDataError('Widget binding Component metadata exceeds its limit')
        }
        for (const row of rows) {
            const objectId = typeof row.object_id === 'string' ? row.object_id : ''
            if (!isUuidV7(objectId) || !objectIds.includes(objectId)) {
                throw new WidgetBindingRuntimeDataError('Widget binding Component metadata is invalid')
            }
            const objectCodename = objectCodenameById.get(objectId)
            const codename = resolveRuntimeCodenameText(row.codename)
            if (!objectCodename || !requestedComponentsByObjectId.get(objectId)?.has(codename)) continue
            const component = {
                id: row.id,
                objectId,
                codename,
                columnName: row.column_name,
                dataType: row.data_type,
                presentation: row.presentation,
                isRequired: row.is_required,
                validationRules: row.validation_rules,
                targetObjectId: row.target_object_id,
                targetObjectKind: row.target_object_kind,
                uiConfig: row.ui_config
            }
            const list = componentsByObjectId.get(objectId) ?? []
            list.push(component)
            componentsByObjectId.set(objectId, list)
        }
    }
    return { objectsByCodename, componentsByObjectId }
}

/** Execute one already registry-validated binding query inside its authorized runtime scope. */
export const loadWidgetBindingRuntimeRecords = async (
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string | null
        workspacesEnabled: boolean
        currentUserId?: string | null
        permissions?: Record<RolePermission, boolean>
        query: WidgetBindingRecordQuery
        object: RuntimeWidgetBindingObjectMetadata
        components: readonly RuntimeWidgetBindingComponentMetadata[]
        slot: WidgetBindingSlotDefinition
        parentObject?: RuntimeWidgetBindingObjectMetadata
        parentComponents?: readonly RuntimeWidgetBindingComponentMetadata[]
        parentSlot?: WidgetBindingSlotDefinition
        parentObjectId?: string
    }
) => {
    const { object, query, slot } = input
    if (
        query.target.entityKind !== 'object' ||
        object.kind !== 'object' ||
        object.codename !== query.target.entityCodename ||
        !isUuidV7(String(object.id))
    ) {
        throw new WidgetBindingRuntimeDataError()
    }
    assertSlotQuery(query, slot)
    if (
        (input.workspacesEnabled && (!input.workspaceId || !isUuidV7(input.workspaceId))) ||
        (!input.workspacesEnabled && input.workspaceId !== null)
    ) {
        throw new WidgetBindingRuntimeDataError('Widget binding workspace scope is invalid')
    }
    if (!hasRuntimeCapability(object.config, 'dataSchema') || !hasRuntimeCapability(object.config, 'records')) {
        throw new WidgetBindingRuntimeDataError('Widget binding Object capabilities are incompatible')
    }
    if (input.components.some((component) => String(component.objectId) !== String(object.id))) {
        throw new WidgetBindingRuntimeDataError('Widget binding Component owner is invalid')
    }

    const entity: WidgetBindingEntityMetadata = {
        kind: 'object',
        codename: object.codename,
        config: object.config,
        components: input.components.map((component) => ({
            codename: resolveRuntimeCodenameText(component.codename),
            dataType: String(component.dataType ?? ''),
            isRequired: component.isRequired === true,
            validationRules: component.validationRules,
            uiConfig: component.uiConfig
        }))
    }
    if (!isCompatibleWidgetBindingEntity(slot, entity)) throw new WidgetBindingRuntimeDataError()

    const tableName = typeof object.tableName === 'string' ? object.tableName : ''
    let table: string
    try {
        table = qSchemaTable(input.schemaName, tableName)
    } catch {
        throw new WidgetBindingRuntimeDataError('Widget binding table metadata is invalid')
    }

    const componentsByCodename = new Map<string, RuntimeWidgetBindingComponentMetadata>()
    for (const component of input.components) {
        const codename = resolveRuntimeCodenameText(component.codename)
        if (!codename || componentsByCodename.has(codename))
            throw new WidgetBindingRuntimeDataError('Widget binding Components are ambiguous')
        componentsByCodename.set(codename, component)
    }
    const readColumn = (codename: string): string => {
        const component = componentsByCodename.get(codename)
        if (!component || typeof component.columnName !== 'string' || !component.columnName) {
            throw new WidgetBindingRuntimeDataError('Widget binding Component is unavailable')
        }
        try {
            return qColumn(component.columnName)
        } catch {
            throw new WidgetBindingRuntimeDataError('Widget binding Component column is invalid')
        }
    }

    const selected = query.projection.map(
        ({ componentCodename }, index) => `${readColumn(componentCodename)} AS ${qColumn(`field_${index}`)}`
    )
    if (new Set(selected).size !== selected.length) throw new WidgetBindingRuntimeDataError('Widget binding projection is ambiguous')
    const runtimeVersionSelection =
        query.kind !== 'semantic-key' ? `, COALESCE(record.${qColumn('_upl_version')}, 1)::int AS ${qColumn('_upl_version')}` : ''

    const parameters: unknown[] = []
    const predicates = [lifecyclePredicate('record')]
    if (input.workspacesEnabled) {
        if (!input.workspaceId || !isUuidV7(input.workspaceId))
            throw new WidgetBindingRuntimeDataError('Widget binding workspace is unavailable')
        parameters.push(input.workspaceId)
        predicates.push(`${qColumn('workspace_id')} = $${parameters.length}`)
    }

    const toRuntimeAttrs = (components: readonly RuntimeWidgetBindingComponentMetadata[]): RuntimeObjectCollectionAttr[] =>
        components.map((component) => ({
            id: String(component.id ?? ''),
            codename: component.codename,
            column_name: String(component.columnName ?? ''),
            data_type: String(component.dataType ?? ''),
            is_required: component.isRequired === true,
            validation_rules: isRecord(component.validationRules) ? component.validationRules : undefined,
            target_object_id: typeof component.targetObjectId === 'string' ? component.targetObjectId : null,
            target_object_kind: typeof component.targetObjectKind === 'string' ? component.targetObjectKind : null,
            ui_config: isRecord(component.uiConfig) ? component.uiConfig : undefined
        }))
    const permissions = input.permissions ?? NO_RUNTIME_PERMISSIONS
    const recordAccessClause = await buildRuntimeRecordAccessClause({
        manager: executor,
        schemaIdent: qSchema(input.schemaName),
        currentWorkspaceId: input.workspaceId,
        currentUserId: input.currentUserId ?? null,
        permissions,
        objectCodename: String(object.codename),
        attrs: toRuntimeAttrs(input.components),
        config: isRecord(object.config) ? object.config : null,
        outerRowIdSql: 'record.id',
        values: parameters,
        minimumAccessLevel: 'read'
    })
    if (recordAccessClause) predicates.push(`(${recordAccessClause})`)

    if (query.kind === 'learner-enrollment-set') {
        const actorId = input.currentUserId
        const actorComponent = componentsByCodename.get('AssignedUserId')
        const targetKindComponent = componentsByCodename.get('TargetType')
        if (
            String(object.codename) !== 'Enrollments' ||
            !actorId ||
            !isValidUuid(actorId) ||
            !actorComponent ||
            String(actorComponent.dataType ?? '')
                .trim()
                .toUpperCase() !== 'STRING' ||
            !targetKindComponent ||
            String(targetKindComponent.dataType ?? '')
                .trim()
                .toUpperCase() !== 'STRING'
        ) {
            throw new WidgetBindingRuntimeDataError('Learner enrollment scope is unavailable')
        }
        parameters.push(actorId)
        predicates.push(`${readColumn('AssignedUserId')} = $${parameters.length}`)
        parameters.push(query.selector.targetKind)
        predicates.push(`${readColumn('TargetType')} = $${parameters.length}`)
    }

    let parentTable: string | undefined
    let parentWorkspacePredicate: string | undefined
    if (query.kind === 'semantic-key') {
        parameters.push(query.selector.value)
        predicates.push(`${readColumn(query.selector.componentCodename)} = $${parameters.length}`)
    } else if (query.kind === 'relation-set') {
        const parentObject = input.parentObject
        const parentSlot = input.parentSlot
        if (
            !parentObject ||
            !parentSlot ||
            !input.parentObjectId ||
            query.selector.parentTarget.entityKind !== 'object' ||
            parentObject.kind !== 'object' ||
            parentObject.codename !== query.selector.parentTarget.entityCodename ||
            !isUuidV7(String(parentObject.id)) ||
            String(parentObject.id) !== input.parentObjectId ||
            !isUuidV7(input.parentObjectId)
        ) {
            throw new WidgetBindingRuntimeDataError('Widget binding relation parent is unavailable')
        }
        assertSlotQuery(
            {
                kind: query.selector.parentTarget.selector.kind === 'semantic-key' ? 'semantic-key' : 'record-set',
                target: query.selector.parentTarget,
                slot: parentSlot.key,
                projection: query.selector.parentTarget.projection,
                ...(query.selector.parentTarget.selector.kind === 'semantic-key'
                    ? {
                          selector: {
                              componentCodename:
                                  parentSlot.requirements.components.find(({ semanticKey }) => semanticKey === true)?.componentCodename ??
                                  '',
                              value: query.selector.parentTarget.selector.value
                          },
                          limit: 2 as const
                      }
                    : {
                          ordered: {
                              orderByComponentCodename:
                                  parentSlot.requirements.components.find(({ field }) => field === parentSlot.orderByField)
                                      ?.componentCodename ?? '',
                              ...(parentSlot.visibilityField
                                  ? {
                                        visibilityComponentCodename: parentSlot.requirements.components.find(
                                            ({ field }) => field === parentSlot.visibilityField
                                        )?.componentCodename
                                    }
                                  : {}),
                              limit: parentSlot.maxResolvedRecords ?? 0
                          }
                      })
            } as WidgetBindingRecordQuery,
            parentSlot
        )
        try {
            parentTable = qSchemaTable(input.schemaName, String(parentObject.tableName))
        } catch {
            throw new WidgetBindingRuntimeDataError('Widget binding parent table metadata is invalid')
        }
        parentWorkspacePredicate = input.workspacesEnabled ? `AND parent_record.${qColumn('workspace_id')} = $1` : ''
        const parentRecordAccessClause = await buildRuntimeRecordAccessClause({
            manager: executor,
            schemaIdent: qSchema(input.schemaName),
            currentWorkspaceId: input.workspaceId,
            currentUserId: input.currentUserId ?? null,
            permissions,
            objectCodename: String(parentObject.codename),
            attrs: toRuntimeAttrs(input.parentComponents ?? []),
            config: isRecord(parentObject.config) ? parentObject.config : null,
            outerRowIdSql: 'parent_record.id',
            values: parameters,
            minimumAccessLevel: 'read'
        })
        const relationComponent = componentsByCodename.get(query.selector.relationComponentCodename)
        if (
            !relationComponent ||
            String(relationComponent.targetObjectId) !== input.parentObjectId ||
            !['REF', 'UUID'].includes(
                String(relationComponent.dataType ?? '')
                    .trim()
                    .toUpperCase()
            )
        ) {
            throw new WidgetBindingRuntimeDataError('Widget binding REF targets another Object')
        }
        parameters.push(query.selector.parentRecordIds)
        predicates.push(`${readColumn(query.selector.relationComponentCodename)} = ANY($${parameters.length}::uuid[])`)
        predicates.push(
            `EXISTS (
                SELECT 1
                FROM ${parentTable} parent_record
                WHERE parent_record.${qColumn('id')} = record.${readColumn(query.selector.relationComponentCodename)}
                  AND ${lifecyclePredicate('parent_record')}
                  ${parentWorkspacePredicate}
                  ${parentRecordAccessClause ? `AND (${parentRecordAccessClause})` : ''}
            )`
        )
    }

    let orderColumn = qColumn('id')
    const limit = query.kind === 'semantic-key' ? query.limit : query.ordered.limit
    const visibilityCodename =
        query.kind === 'semantic-key'
            ? slot.visibilityField
                ? slot.requirements.components.find(({ field }) => field === slot.visibilityField)?.componentCodename
                : undefined
            : query.ordered.visibilityComponentCodename
    if (visibilityCodename) predicates.push(`${readColumn(visibilityCodename)} = true`)
    if (query.kind !== 'semantic-key') {
        orderColumn = readColumn(query.ordered.orderByComponentCodename)
    }
    parameters.push(limit + 1)

    const rows = await executor.query<Record<string, unknown>>(
        `SELECT record.${qColumn('id')} AS ${qColumn('record_id')}, ${selected.join(', ')}${runtimeVersionSelection}
         FROM ${table} AS record
         WHERE ${predicates.join(' AND ')}
         ORDER BY ${orderColumn} ASC NULLS LAST, ${qColumn('id')} ASC
         LIMIT $${parameters.length}`,
        parameters
    )
    if (rows.length > limit) throw new WidgetBindingRuntimeDataError('Widget binding query returned too many records')
    return rows.map((row) => {
        const recordId = typeof row.record_id === 'string' ? row.record_id : ''
        if (!isUuidV7(recordId)) throw new WidgetBindingRuntimeDataError('Widget binding record id is invalid')
        const data = Object.fromEntries(query.projection.map(({ field }, index) => [field, row[`field_${index}`]]))
        if (query.kind === 'semantic-key') return { recordId, data }
        const rawVersion = row._upl_version
        const version = typeof rawVersion === 'number' ? rawVersion : typeof rawVersion === 'string' ? Number(rawVersion) : NaN
        if (!Number.isSafeInteger(version) || version < 1) {
            if (query.kind === 'record-set' && (rawVersion === undefined || rawVersion === null)) return { recordId, data }
            throw new WidgetBindingRuntimeDataError('Widget binding record version is invalid')
        }
        return {
            recordId,
            version,
            data: query.kind === 'relation-set' ? { ...data, _upl_version: version } : data
        }
    })
}
