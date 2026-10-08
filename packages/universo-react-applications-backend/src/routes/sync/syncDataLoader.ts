/**
 * Application Sync - Data Loaders
 *
 * Functions for loading application runtime data and exporting an existing
 * application as a release bundle. Publication and bundle source builders
 * live in syncReleaseBundleSources.
 */

import {
    generateTableName,
    generateColumnName,
    generateChildTableName,
    hasPhysicalRuntimeTable,
    type EntityDefinition
} from '@universo-react/schema-ddl'
import stableStringify from 'json-stable-stringify'
import { quoteQualifiedIdentifier } from '@universo-react/migrations-core'
import {
    ComponentDefinitionDataType,
    CURRENT_METAHUB_SNAPSHOT_FORMAT_VERSION,
    decodeLayoutConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    encodeSnapshotLayoutConfigEnvelope,
    parseApplicationLayoutConfig,
    type ApplicationPackageDefinition,
    type PackageSourceDescriptor
} from '@universo-react/types'
import { validateMarketingSnapshotTransportLayouts, validateSnapshotLayoutIdentities, type DbExecutor } from '@universo-react/utils'
import {
    createApplicationReleaseBundle,
    extractInstalledReleaseVersion,
    resolveApplicationReleaseSnapshotHash,
    type ApplicationReleaseBundle
} from '../../services/applicationReleaseBundle'
import type { PublishedApplicationSnapshot, SnapshotEnumerationValueDefinition } from '../../services/applicationSyncContracts'
import { TARGET_APP_STRUCTURE_VERSION } from '../../constants'
import {
    type SyncableApplicationRecord,
    type RuntimeApplicationObjectRow,
    type RuntimeApplicationComponentRow,
    type RuntimeApplicationEnumerationValueRow,
    type RuntimeApplicationLayoutRow,
    type RuntimeApplicationWidgetRow
} from './syncTypes'
import {
    isRecord,
    quoteSchemaName,
    quoteObjectName,
    runtimeCodenameTextSql,
    buildDynamicRuntimeActiveRowSql,
    normalizeRuntimeEntityKind,
    normalizeRuntimePresentation,
    normalizeRuntimeSnapshotValue,
    resolveEntityLifecycleContract,
    extractSetConstantRefConfig,
    parseApplicationTemplateKey
} from './syncHelpers'
import { resolveRuntimeApplicationReleaseBaseSnapshot, resolveRuntimeApplicationReleaseLineage } from './syncReleaseBundleSources'
import {
    classifyPlacementLineage,
    decodePlacementWidgetConfigEnvelope,
    resolvePlacementBindingPolicy,
    resolvePlacementBindingValidation,
    resolvePlacementRegistryDefinition,
    validatePlacementGraph
} from '../../persistence/applicationLayoutWidgetPlacement'

export {
    buildApplicationSyncSourceFromBundle,
    buildApplicationSyncSourceFromPublication,
    createPublicationApplicationReleaseBundle,
    resolveRuntimeApplicationReleaseBaseSnapshot,
    resolveRuntimeApplicationReleaseLineage
} from './syncReleaseBundleSources'

// --- Runtime data loaders ---

export async function loadApplicationRuntimeEntities(exec: DbExecutor, schemaName: string): Promise<EntityDefinition[]> {
    const schemaIdent = quoteSchemaName(schemaName)
    const objectRows = await exec.query<RuntimeApplicationObjectRow>(
        `
            SELECT id, kind, ${runtimeCodenameTextSql('codename')} AS codename, table_name, presentation, config
            FROM ${schemaIdent}._app_objects
            WHERE _upl_deleted = false
              AND _app_deleted = false
            ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
        `
    )
    const componentRows = await exec.query<RuntimeApplicationComponentRow>(
        `
            SELECT
                id,
                object_id,
                ${runtimeCodenameTextSql('codename')} AS codename,
                sort_order,
                column_name,
                data_type,
                is_required,
                is_display_component,
                target_object_id,
                target_object_kind,
                parent_component_id,
                presentation,
                validation_rules,
                ui_config
            FROM ${schemaIdent}._app_components
            WHERE _upl_deleted = false
              AND _app_deleted = false
            ORDER BY object_id ASC, parent_component_id ASC NULLS FIRST, sort_order ASC, id ASC
        `
    )

    const fieldNodes = new Map<
        string,
        {
            objectId: string
            parentComponentId: string | null
            sortOrder: number
            field: EntityDefinition['fields'][number]
        }
    >()

    for (const row of componentRows) {
        const id = typeof row.id === 'string' ? row.id : null
        const objectId = typeof row.object_id === 'string' ? row.object_id : null
        const codename = typeof row.codename === 'string' ? row.codename : null
        const dataType = typeof row.data_type === 'string' ? (row.data_type as ComponentDefinitionDataType) : null
        const columnName = typeof row.column_name === 'string' ? row.column_name : null

        if (!id || !objectId || !codename || !dataType || !columnName) {
            continue
        }

        const uiConfig = isRecord(row.ui_config) ? row.ui_config : {}
        const targetConstantId =
            row.target_object_kind === 'set' && typeof uiConfig.targetConstantId === 'string' ? uiConfig.targetConstantId : null

        fieldNodes.set(id, {
            objectId,
            parentComponentId: typeof row.parent_component_id === 'string' ? row.parent_component_id : null,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            field: {
                id,
                codename,
                dataType,
                isRequired: row.is_required === true,
                isDisplayComponent: row.is_display_component === true,
                targetEntityId: typeof row.target_object_id === 'string' ? row.target_object_id : null,
                targetEntityKind: normalizeRuntimeEntityKind(row.target_object_kind),
                targetConstantId,
                parentComponentId: typeof row.parent_component_id === 'string' ? row.parent_component_id : null,
                presentation: normalizeRuntimePresentation(row.presentation),
                validationRules: isRecord(row.validation_rules) ? row.validation_rules : {},
                uiConfig,
                physicalColumnName: columnName
            }
        })
    }

    const sortFieldNodes = (left: { sortOrder: number; field: { id: string } }, right: { sortOrder: number; field: { id: string } }) =>
        left.sortOrder - right.sortOrder || left.field.id.localeCompare(right.field.id)

    const childNodesByParent = new Map<string, Array<{ sortOrder: number; field: EntityDefinition['fields'][number] }>>()
    const topLevelNodesByObject = new Map<string, Array<{ sortOrder: number; field: EntityDefinition['fields'][number] }>>()

    for (const node of fieldNodes.values()) {
        if (node.parentComponentId) {
            const children = childNodesByParent.get(node.parentComponentId) ?? []
            children.push({ sortOrder: node.sortOrder, field: node.field })
            childNodesByParent.set(node.parentComponentId, children)
            continue
        }

        const fields = topLevelNodesByObject.get(node.objectId) ?? []
        fields.push({ sortOrder: node.sortOrder, field: node.field })
        topLevelNodesByObject.set(node.objectId, fields)
    }

    for (const [parentId, children] of childNodesByParent.entries()) {
        const parentNode = fieldNodes.get(parentId)
        if (!parentNode) continue
        parentNode.field.childFields = [...children].sort(sortFieldNodes).map((child) => child.field)
    }

    const entities: EntityDefinition[] = []
    for (const row of objectRows) {
        const id = typeof row.id === 'string' ? row.id : null
        const kind = normalizeRuntimeEntityKind(row.kind)
        const codename = typeof row.codename === 'string' ? row.codename : null
        const tableName = typeof row.table_name === 'string' && row.table_name.trim().length > 0 ? row.table_name : null

        if (!id || !kind || !codename) {
            continue
        }

        const physicalTableEnabled = tableName !== null

        const topLevelFields = [...(topLevelNodesByObject.get(id) ?? [])].sort(sortFieldNodes).map((node) => node.field)

        entities.push({
            id,
            kind,
            codename,
            presentation: normalizeRuntimePresentation(row.presentation),
            fields: topLevelFields,
            physicalTableEnabled,
            physicalTableName: tableName ?? undefined,
            config: isRecord(row.config) ? row.config : {}
        })
    }

    return entities
}

export async function loadApplicationRuntimeElements(
    exec: DbExecutor,
    schemaName: string,
    entities: EntityDefinition[]
): Promise<Record<string, unknown[]>> {
    const result: Record<string, unknown[]> = {}

    for (const entity of entities) {
        if (entity.kind !== 'object' || !hasPhysicalRuntimeTable(entity)) {
            continue
        }

        const tableName = entity.physicalTableName ?? generateTableName(entity.id, entity.kind)
        const tableIdent = quoteQualifiedIdentifier(schemaName, tableName)
        const runtimeRowCondition = buildDynamicRuntimeActiveRowSql(resolveEntityLifecycleContract(entity), entity.config)
        const topLevelFields = entity.fields.filter(
            (field) => field.dataType !== ComponentDefinitionDataType.TABLE && !field.parentComponentId
        )
        const tableFields = entity.fields.filter(
            (field) =>
                field.dataType === ComponentDefinitionDataType.TABLE && !field.parentComponentId && (field.childFields?.length ?? 0) > 0
        )
        const selectColumns = [
            'id',
            ...topLevelFields.map((field) => quoteObjectName(field.physicalColumnName ?? generateColumnName(field.id)))
        ]

        const rows = await exec.query<Record<string, unknown>>(
            `
                SELECT ${selectColumns.join(', ')}
                FROM ${tableIdent}
                                WHERE ${runtimeRowCondition}
                ORDER BY _upl_created_at ASC NULLS LAST, id ASC
            `
        )

        const childRowsByTableField = new Map<string, Map<string, Array<Record<string, unknown>>>>()
        for (const tableField of tableFields) {
            const childFields = tableField.childFields ?? []
            if (childFields.length === 0) continue

            const childTableName = tableField.physicalColumnName ?? generateChildTableName(tableField.id)
            const childTableIdent = quoteQualifiedIdentifier(schemaName, childTableName)
            const childSelectColumns = [
                '_tp_parent_id',
                '_tp_sort_order',
                ...childFields.map((field) => quoteObjectName(field.physicalColumnName ?? generateColumnName(field.id)))
            ]

            const childRows = await exec.query<Record<string, unknown>>(
                `
                    SELECT ${childSelectColumns.join(', ')}, id
                    FROM ${childTableIdent}
                                        WHERE ${runtimeRowCondition}
                    ORDER BY _tp_parent_id ASC, _tp_sort_order ASC, _upl_created_at ASC NULLS LAST, id ASC
                `
            )

            const rowsByParent = new Map<string, Array<Record<string, unknown>>>()
            for (const row of childRows) {
                const parentId = typeof row._tp_parent_id === 'string' ? row._tp_parent_id : null
                if (!parentId) continue

                const mappedRow: Record<string, unknown> = {
                    _tp_sort_order: typeof row._tp_sort_order === 'number' ? row._tp_sort_order : 0
                }
                for (const childField of childFields) {
                    const columnName = childField.physicalColumnName ?? generateColumnName(childField.id)
                    mappedRow[childField.codename] = normalizeRuntimeSnapshotValue(row[columnName], childField)
                }

                const list = rowsByParent.get(parentId) ?? []
                list.push(mappedRow)
                rowsByParent.set(parentId, list)
            }

            childRowsByTableField.set(tableField.id, rowsByParent)
        }

        const elements = rows.map((row, index) => {
            const elementId = typeof row.id === 'string' ? row.id : String(row.id ?? '')
            const data: Record<string, unknown> = {}

            for (const field of topLevelFields) {
                const columnName = field.physicalColumnName ?? generateColumnName(field.id)
                data[field.codename] = normalizeRuntimeSnapshotValue(row[columnName], field)
            }

            for (const tableField of tableFields) {
                const childRows = childRowsByTableField.get(tableField.id)?.get(elementId) ?? []
                data[tableField.codename] = childRows
            }

            return {
                id: elementId,
                data,
                sortOrder: index
            }
        })

        if (elements.length > 0) {
            result[entity.id] = elements
        }
    }

    return result
}

export async function loadApplicationRuntimeEnumerationValues(
    exec: DbExecutor,
    schemaName: string,
    entities: EntityDefinition[]
): Promise<Record<string, SnapshotEnumerationValueDefinition[]>> {
    const optionListIds = new Set(entities.filter((entity) => entity.kind === 'enumeration').map((entity) => entity.id))
    if (optionListIds.size === 0) {
        return {}
    }

    const schemaIdent = quoteSchemaName(schemaName)
    let rows: RuntimeApplicationEnumerationValueRow[] = []

    try {
        rows = await exec.query<RuntimeApplicationEnumerationValueRow>(
            `
                                SELECT id, object_id, ${runtimeCodenameTextSql(
                                    'codename'
                                )} AS codename, presentation, sort_order, is_default
                FROM ${schemaIdent}._app_values
                WHERE _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY object_id ASC, sort_order ASC, id ASC
            `
        )
    } catch {
        return {}
    }

    const result: Record<string, SnapshotEnumerationValueDefinition[]> = {}
    for (const row of rows) {
        const objectId = typeof row.object_id === 'string' ? row.object_id : null
        const id = typeof row.id === 'string' ? row.id : null
        const codename = typeof row.codename === 'string' ? row.codename : null
        if (!objectId || !id || !codename || !optionListIds.has(objectId)) {
            continue
        }

        const list = result[objectId] ?? []
        list.push({
            id,
            objectId,
            codename,
            presentation: isRecord(row.presentation)
                ? (row.presentation as unknown as SnapshotEnumerationValueDefinition['presentation'])
                : ({ name: {} } as SnapshotEnumerationValueDefinition['presentation']),
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            isDefault: row.is_default === true
        })
        result[objectId] = list
    }

    return result
}

export function loadApplicationRuntimeFixedValues(entities: EntityDefinition[]): Record<string, unknown[]> {
    const fixedValuesByValueGroupId = new Map<string, Map<string, Record<string, unknown>>>()

    const registerFieldFixedValue = (field: EntityDefinition['fields'][number]): void => {
        const valueGroupId = typeof field.targetEntityId === 'string' && field.targetEntityKind === 'set' ? field.targetEntityId : null
        const setConstantRef = extractSetConstantRefConfig(field.uiConfig)
        const constantId =
            typeof field.targetConstantId === 'string' && field.targetConstantId.trim().length > 0
                ? field.targetConstantId.trim()
                : setConstantRef?.id ?? null

        if (valueGroupId && constantId && setConstantRef) {
            const fixedValues = fixedValuesByValueGroupId.get(valueGroupId) ?? new Map<string, Record<string, unknown>>()
            fixedValues.set(constantId, {
                id: constantId,
                codename: setConstantRef.codename ?? constantId,
                dataType: setConstantRef.dataType ?? 'STRING',
                presentation: setConstantRef.name ? { name: setConstantRef.name } : {},
                validationRules: {},
                uiConfig: {},
                value: setConstantRef.value ?? null,
                sortOrder: 0
            })
            fixedValuesByValueGroupId.set(valueGroupId, fixedValues)
        }

        for (const childField of field.childFields ?? []) {
            registerFieldFixedValue(childField)
        }
    }

    for (const entity of entities) {
        for (const field of entity.fields) {
            if (field.parentComponentId) {
                continue
            }

            registerFieldFixedValue(field)
        }
    }

    return Object.fromEntries(
        [...fixedValuesByValueGroupId.entries()]
            .map(([valueGroupId, fixedValueEntries]) => [
                valueGroupId,
                [...fixedValueEntries.values()].sort((left, right) => {
                    const leftCodename = typeof left.codename === 'string' ? left.codename : ''
                    const rightCodename = typeof right.codename === 'string' ? right.codename : ''
                    if (leftCodename !== rightCodename) {
                        return leftCodename.localeCompare(rightCodename)
                    }

                    const leftId = typeof left.id === 'string' ? left.id : ''
                    const rightId = typeof right.id === 'string' ? right.id : ''
                    return leftId.localeCompare(rightId)
                })
            ])
            .filter(([, constants]) => constants.length > 0)
    )
}

export async function loadApplicationRuntimePackages(exec: DbExecutor, schemaName: string): Promise<ApplicationPackageDefinition[]> {
    const schemaIdent = quoteSchemaName(schemaName)

    try {
        const rows = await exec.query<{
            package_name: string
            version: string
            source?: unknown
            is_active: boolean
        }>(
            `
                SELECT package_name, version, source, is_active
                FROM ${schemaIdent}._app_packages
                WHERE _upl_deleted = false
                  AND _app_deleted = false
                  AND is_active = true
                ORDER BY package_name ASC, version ASC
            `
        )

        return rows
            .filter((row) => typeof row.package_name === 'string' && typeof row.version === 'string')
            .map((row) => ({
                packageName: row.package_name,
                version: row.version,
                source: normalizeRuntimePackageSource(row.source),
                isActive: row.is_active !== false
            }))
    } catch {
        return []
    }
}

const normalizeRuntimePackageSource = (value: unknown): PackageSourceDescriptor => {
    const source = isRecord(value) ? (value as Partial<PackageSourceDescriptor>) : {}

    return {
        kind: 'workspace',
        packageName: typeof source.packageName === 'string' ? source.packageName : '',
        importName: typeof source.importName === 'string' ? source.importName : '',
        upstreamPackageName: typeof source.upstreamPackageName === 'string' ? source.upstreamPackageName : '',
        upstreamVersion: typeof source.upstreamVersion === 'string' ? source.upstreamVersion : '',
        runtimeTargets: Array.isArray(source.runtimeTargets)
            ? source.runtimeTargets.filter((target): target is 'server' | 'client' => target === 'server' || target === 'client')
            : []
    }
}

// --- Layout loader ---

export async function loadApplicationRuntimeLayouts(
    exec: DbExecutor,
    schemaName: string
): Promise<{
    layouts: unknown[]
    scopedLayouts: unknown[]
    layoutZoneWidgets: unknown[]
    layoutWidgetOverrides: unknown[]
    defaultLayoutId: string | null
    layoutConfig: Record<string, unknown>
}> {
    const schemaIdent = quoteSchemaName(schemaName)

    const requireString = (value: unknown, field: string, context: string): string => {
        if (typeof value !== 'string' || value.length === 0) {
            throw new Error(`[SchemaSync] Runtime ${context} ${field} is invalid`)
        }
        return value
    }
    const requireRecord = (value: unknown, field: string, context: string): Record<string, unknown> => {
        if (!isRecord(value)) throw new Error(`[SchemaSync] Runtime ${context} ${field} is invalid`)
        return value
    }
    const requireBoolean = (value: unknown, field: string, context: string): boolean => {
        if (typeof value !== 'boolean') throw new Error(`[SchemaSync] Runtime ${context} ${field} is invalid`)
        return value
    }
    const requireInteger = (value: unknown, field: string, context: string): number => {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            throw new Error(`[SchemaSync] Runtime ${context} ${field} is invalid`)
        }
        return value
    }

    const layouts = await exec.query<RuntimeApplicationLayoutRow>(
        `
            SELECT
              id, scope_entity_id, template_key, name, description, config, is_active, is_default, sort_order,
              source_kind, source_layout_id, source_snapshot_hash, source_content_hash,
              local_content_hash, sync_state, is_source_excluded
            FROM ${schemaIdent}._app_layouts
            WHERE _upl_deleted = false
              AND _app_deleted = false
            ORDER BY scope_entity_id NULLS FIRST, sort_order ASC, _upl_created_at ASC, id ASC
        `
    )

    const normalizedLayouts = layouts.map((row) => {
        const id = requireString(row.id, 'id', 'layout')
        const scopeEntityId =
            row.scope_entity_id === null || row.scope_entity_id === undefined
                ? null
                : requireString(row.scope_entity_id, 'scopeEntityId', `layout ${id}`)
        const templateKey = parseApplicationTemplateKey(row.template_key, `runtime layout ${id}`)
        const decoded = decodeLayoutConfigEnvelope(requireRecord(row.config, 'config', `layout ${id}`), { templateKey })
        const rendererConfig = parseApplicationLayoutConfig(templateKey, decoded.rendererConfig)
        const composition = decoded.neutral.composition
        if (!composition) throw new Error(`[SchemaSync] Runtime layout ${id} is missing canonical composition metadata`)
        if (scopeEntityId === null && composition.mode !== 'independent') {
            throw new Error(`[SchemaSync] Runtime global layout ${id} cannot use overlay composition`)
        }
        if (scopeEntityId !== null && composition.mode === 'overlay' && composition.baseLayoutId === id) {
            throw new Error(`[SchemaSync] Runtime layout ${id} cannot use itself as a base layout`)
        }

        return {
            id,
            scopeEntityId,
            templateKey,
            name: requireRecord(row.name, 'name', `layout ${id}`),
            description:
                row.description === null || row.description === undefined
                    ? null
                    : requireRecord(row.description, 'description', `layout ${id}`),
            config: encodeSnapshotLayoutConfigEnvelope({ rendererConfig, neutral: decoded.neutral }, { templateKey }),
            composition,
            isActive: requireBoolean(row.is_active, 'isActive', `layout ${id}`),
            isDefault: requireBoolean(row.is_default, 'isDefault', `layout ${id}`),
            sortOrder: requireInteger(row.sort_order, 'sortOrder', `layout ${id}`)
        }
    })

    const globalLayouts = normalizedLayouts.filter((layout) => layout.scopeEntityId === null)
    const scopedLayouts = normalizedLayouts.filter((layout) => layout.scopeEntityId !== null)
    const globalLayoutIds = new Set(globalLayouts.map((layout) => layout.id))
    const layoutById = new Map(normalizedLayouts.map((layout) => [layout.id, layout]))
    for (const layout of scopedLayouts) {
        if (layout.composition.mode === 'overlay' && !globalLayoutIds.has(layout.composition.baseLayoutId)) {
            throw new Error(`[SchemaSync] Runtime scoped layout ${layout.id} references a missing global base layout`)
        }
    }

    const serializeLayout = (layout: (typeof normalizedLayouts)[number]) => ({
        id: layout.id,
        ...(layout.scopeEntityId === null ? {} : { scopeEntityId: layout.scopeEntityId }),
        templateKey: layout.templateKey,
        name: layout.name,
        description: layout.description,
        config: layout.config,
        isActive: layout.isActive,
        isDefault: layout.isDefault,
        sortOrder: layout.sortOrder,
        baseLayoutId: layout.composition.baseLayoutId,
        compositionMode: layout.composition.mode
    })

    const defaultLayoutId = globalLayouts.find((layout) => layout.isActive && layout.isDefault)?.id ?? null
    const dashboardLayouts = globalLayouts.filter((layout) => layout.templateKey === 'dashboard')
    const dashboardLayout =
        dashboardLayouts.find((layout) => layout.isActive && layout.isDefault) ?? dashboardLayouts.find((layout) => layout.isActive)
    const layoutConfig = dashboardLayout
        ? parseApplicationLayoutConfig(
              'dashboard',
              decodeLayoutConfigEnvelope(dashboardLayout.config, { templateKey: 'dashboard' }).rendererConfig
          )
        : {}

    const widgets = await exec.query<RuntimeApplicationWidgetRow>(
        `
            SELECT
              id, layout_id, instance_key, parent_widget_id, slot_key,
              zone, widget_key, sort_order, config, source_config, is_active,
              source_widget_id, source_base_widget_id
            FROM ${schemaIdent}._app_widgets
            WHERE _upl_deleted = false
              AND _app_deleted = false
            ORDER BY layout_id ASC, zone ASC, sort_order ASC, _upl_created_at ASC, id ASC
        `
    )
    const normalizedWidgets = widgets.map((row) => {
        const id = requireString(row.id, 'id', 'widget')
        const layoutId = requireString(row.layout_id, 'layoutId', `widget ${id}`)
        const layout = layoutById.get(layoutId)
        if (!layout) throw new Error(`[SchemaSync] Runtime widget ${id} references an unknown layout ${layoutId}`)
        const zone = requireString(row.zone, 'zone', `widget ${id}`)
        const widgetKey = requireString(row.widget_key, 'widgetKey', `widget ${id}`)
        const instanceKey = requireString(row.instance_key, 'instanceKey', `widget ${id}`)
        const parentWidgetId =
            row.parent_widget_id === null || row.parent_widget_id === undefined
                ? null
                : requireString(row.parent_widget_id, 'parentWidgetId', `widget ${id}`)
        const slotKey = row.slot_key === null || row.slot_key === undefined ? null : requireString(row.slot_key, 'slotKey', `widget ${id}`)
        const sourceWidgetId =
            row.source_widget_id === null || row.source_widget_id === undefined
                ? null
                : requireString(row.source_widget_id, 'sourceWidgetId', `widget ${id}`)
        const sourceBaseWidgetId =
            row.source_base_widget_id === null || row.source_base_widget_id === undefined
                ? null
                : requireString(row.source_base_widget_id, 'sourceBaseWidgetId', `widget ${id}`)
        const lineage = classifyPlacementLineage(sourceWidgetId, sourceBaseWidgetId)
        const bindingsInheritedFromBase =
            layout.scopeEntityId !== null && layout.composition.mode === 'overlay' && sourceBaseWidgetId !== null
        const configRecord = requireRecord(row.config, 'config', `widget ${id}`)
        const bindingValidation = resolvePlacementBindingValidation(
            widgetKey,
            configRecord,
            lineage.kind === 'source-linked',
            bindingsInheritedFromBase
        )
        const hasSourceConfig = row.source_config !== null && row.source_config !== undefined
        const decoded = decodePlacementWidgetConfigEnvelope(configRecord, {
            templateKey: layout.templateKey,
            widgetKey,
            zone,
            instanceKey,
            requireBindings: bindingValidation.requireBindings && !hasSourceConfig
        })
        if (bindingValidation.rejectBindings && decoded.neutral.bindings !== undefined) {
            throw new Error(`[SchemaSync] Runtime widget ${id} bindings violate its registered source policy`)
        }
        const neutral = { ...decoded.neutral }
        if (hasSourceConfig) {
            const sourceConfigRecord = requireRecord(row.source_config, 'source_config', `widget ${id}`)
            const sourceBindingValidation = resolvePlacementBindingValidation(
                widgetKey,
                sourceConfigRecord,
                lineage.kind === 'source-linked',
                bindingsInheritedFromBase
            )
            const sourceDecoded = decodePlacementWidgetConfigEnvelope(sourceConfigRecord, {
                templateKey: layout.templateKey,
                widgetKey,
                zone,
                instanceKey,
                requireBindings: sourceBindingValidation.requireBindings
            })
            if (sourceBindingValidation.rejectBindings && sourceDecoded.neutral.bindings !== undefined) {
                throw new Error(`[SchemaSync] Runtime widget ${id} source bindings violate its registered source policy`)
            }
            if (
                decoded.neutral.bindings !== undefined &&
                stableStringify(decoded.neutral.bindings) !== stableStringify(sourceDecoded.neutral.bindings)
            ) {
                throw new Error(`[SchemaSync] Runtime widget ${id} bindings do not match its source config`)
            }
            if (sourceDecoded.neutral.bindings === undefined) delete neutral.bindings
            else neutral.bindings = sourceDecoded.neutral.bindings
        }
        return {
            id,
            layoutId,
            instanceKey,
            parentWidgetId,
            slotKey,
            zone,
            widgetKey,
            sortOrder: requireInteger(row.sort_order, 'sortOrder', `widget ${id}`),
            config: encodeLayoutWidgetConfigEnvelope(
                { rendererConfig: decoded.rendererConfig, neutral },
                { templateKey: layout.templateKey, widgetKey, zone, requireBindings: bindingValidation.requireBindings }
            ),
            isActive: requireBoolean(row.is_active, 'isActive', `widget ${id}`),
            sourceWidgetId,
            sourceBaseWidgetId
        }
    })

    for (const layout of normalizedLayouts) {
        const layoutWidgets = normalizedWidgets.filter((widget) => widget.layoutId === layout.id)
        if (layoutWidgets.length === 0) continue
        validatePlacementGraph(
            layoutWidgets.map((widget) => {
                const decoded = decodePlacementWidgetConfigEnvelope(widget.config, {
                    templateKey: layout.templateKey,
                    widgetKey: widget.widgetKey,
                    zone: widget.zone,
                    instanceKey: widget.instanceKey,
                    requireBindings: false
                })
                return {
                    id: widget.id,
                    layoutId: widget.layoutId,
                    instanceKey: widget.instanceKey,
                    parentWidgetId: widget.parentWidgetId,
                    slotKey: widget.slotKey,
                    templateKey: layout.templateKey,
                    widgetKey: widget.widgetKey,
                    zone: widget.zone,
                    rendererConfig: decoded.rendererConfig
                }
            }),
            { resolveRegistryDefinition: resolvePlacementRegistryDefinition }
        )
    }

    const snapshotWidgetIdBySourceId = new Map<string, string>()
    for (const widget of normalizedWidgets) {
        const layout = layoutById.get(widget.layoutId)
        if (!layout) throw new Error(`[SchemaSync] Runtime widget ${widget.id} references an unknown layout`)
        if (layout.scopeEntityId !== null) continue
        snapshotWidgetIdBySourceId.set(widget.id, widget.id)
        if (widget.sourceWidgetId) snapshotWidgetIdBySourceId.set(widget.sourceWidgetId, widget.id)
    }
    const widgetById = new Map(normalizedWidgets.map((widget) => [widget.id, widget]))
    const resolveSnapshotParentWidgetId = (widget: (typeof normalizedWidgets)[number]): string | null => {
        if (widget.parentWidgetId === null) return null
        const parent = widgetById.get(widget.parentWidgetId)
        if (!parent || parent.layoutId !== widget.layoutId) {
            throw new Error(`[SchemaSync] Runtime widget ${widget.id} references a missing parent placement`)
        }
        if (!parent.sourceBaseWidgetId) return parent.id
        const mappedBaseParent = snapshotWidgetIdBySourceId.get(parent.sourceBaseWidgetId)
        if (!mappedBaseParent) {
            throw new Error(`[SchemaSync] Runtime widget ${widget.id} references an unmappable inherited parent placement`)
        }
        return mappedBaseParent
    }
    const layoutZoneWidgets: unknown[] = []
    const layoutWidgetOverrides: unknown[] = []
    for (const widget of normalizedWidgets) {
        const layout = layoutById.get(widget.layoutId)
        if (!layout) throw new Error(`[SchemaSync] Runtime widget ${widget.id} references an unknown layout`)
        if (layout.scopeEntityId !== null && layout.composition.mode === 'overlay' && widget.sourceBaseWidgetId) {
            const baseWidgetId = snapshotWidgetIdBySourceId.get(widget.sourceBaseWidgetId)
            const baseWidget = baseWidgetId ? widgetById.get(baseWidgetId) : undefined
            if (!baseWidget || baseWidget.layoutId !== layout.composition.baseLayoutId) {
                throw new Error(`[SchemaSync] Runtime widget ${widget.id} references a missing overlay base widget`)
            }
            const baseDecoded = decodePlacementWidgetConfigEnvelope(baseWidget.config, {
                templateKey: layout.templateKey,
                widgetKey: baseWidget.widgetKey,
                zone: baseWidget.zone,
                instanceKey: baseWidget.instanceKey,
                requireBindings: resolvePlacementBindingPolicy(baseWidget.widgetKey, baseWidget.config).sourceMode === 'required'
            })
            const inheritedNeutral = { ...baseDecoded.neutral }
            if (resolvePlacementBindingPolicy(baseWidget.widgetKey, baseWidget.config).inheritBindings) delete inheritedNeutral.bindings
            const inheritedBaseConfig = encodeLayoutWidgetConfigEnvelope(
                { rendererConfig: baseDecoded.rendererConfig, neutral: inheritedNeutral },
                { templateKey: layout.templateKey, widgetKey: baseWidget.widgetKey, zone: widget.zone, requireBindings: false }
            )
            const parentSnapshotId = resolveSnapshotParentWidgetId(widget)
            if (
                widget.isActive === baseWidget.isActive &&
                widget.zone === baseWidget.zone &&
                widget.sortOrder === baseWidget.sortOrder &&
                widget.instanceKey === baseWidget.instanceKey &&
                parentSnapshotId === baseWidget.parentWidgetId &&
                widget.slotKey === baseWidget.slotKey &&
                stableStringify(widget.config) === stableStringify(inheritedBaseConfig)
            ) {
                continue
            }
            layoutWidgetOverrides.push({
                id: widget.id,
                layoutId: widget.layoutId,
                baseWidgetId,
                instanceKey: widget.instanceKey,
                parentWidgetId: parentSnapshotId,
                slotKey: widget.slotKey,
                zone: widget.zone,
                sortOrder: widget.sortOrder,
                config: widget.config,
                isActive: widget.isActive,
                isDeletedOverride: !widget.isActive
            })
            continue
        }
        layoutZoneWidgets.push({
            id: widget.id,
            layoutId: widget.layoutId,
            instanceKey: widget.instanceKey,
            parentWidgetId: resolveSnapshotParentWidgetId(widget),
            slotKey: widget.slotKey,
            zone: widget.zone,
            widgetKey: widget.widgetKey,
            sortOrder: widget.sortOrder,
            config: widget.config,
            isActive: widget.isActive
        })
    }

    return {
        layouts: globalLayouts.map(serializeLayout),
        scopedLayouts: scopedLayouts.map(serializeLayout),
        layoutZoneWidgets,
        layoutWidgetOverrides,
        defaultLayoutId,
        layoutConfig: isRecord(layoutConfig) ? layoutConfig : {}
    }
}

export async function createExistingApplicationReleaseBundle(options: {
    exec: DbExecutor
    application: SyncableApplicationRecord
}): Promise<ApplicationReleaseBundle> {
    const { exec, application } = options

    if (!application.schemaName) {
        throw new Error('Application schema is not initialized yet. Sync or apply a release bundle first.')
    }

    const entities = await loadApplicationRuntimeEntities(exec, application.schemaName)
    if (entities.length === 0) {
        throw new Error('Application runtime metadata is empty. Sync the application before exporting a release bundle.')
    }

    const elements = await loadApplicationRuntimeElements(exec, application.schemaName, entities)
    const optionValues = await loadApplicationRuntimeEnumerationValues(exec, application.schemaName, entities)
    const runtimeFixedValues = loadApplicationRuntimeFixedValues(entities)
    const runtimePackages = await loadApplicationRuntimePackages(exec, application.schemaName)
    const runtimeLayouts = await loadApplicationRuntimeLayouts(exec, application.schemaName)
    const installedReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
    const snapshot: PublishedApplicationSnapshot = {
        versionEnvelope: {
            structureVersion: String(
                typeof application.appStructureVersion === 'number' && Number.isFinite(application.appStructureVersion)
                    ? application.appStructureVersion
                    : TARGET_APP_STRUCTURE_VERSION
            ),
            templateVersion: installedReleaseVersion,
            snapshotFormatVersion: CURRENT_METAHUB_SNAPSHOT_FORMAT_VERSION
        },
        entities: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
    }

    if (Object.keys(elements).length > 0) {
        snapshot.elements = elements
    }
    if (Object.keys(optionValues).length > 0) {
        snapshot.optionValues = optionValues
    }
    if (Object.keys(runtimeFixedValues).length > 0) {
        snapshot.fixedValues = runtimeFixedValues
    }
    if (runtimePackages.length > 0) {
        snapshot.packages = runtimePackages
    }
    if (runtimeLayouts.layouts.length > 0) {
        snapshot.layouts = runtimeLayouts.layouts
        snapshot.defaultLayoutId = runtimeLayouts.defaultLayoutId
        snapshot.layoutConfig = runtimeLayouts.layoutConfig
    }
    if (runtimeLayouts.scopedLayouts.length > 0) {
        snapshot.scopedLayouts = runtimeLayouts.scopedLayouts
    }
    if (runtimeLayouts.layoutZoneWidgets.length > 0) {
        snapshot.layoutZoneWidgets = runtimeLayouts.layoutZoneWidgets
    }
    if (runtimeLayouts.layoutWidgetOverrides.length > 0) {
        snapshot.layoutWidgetOverrides = runtimeLayouts.layoutWidgetOverrides
    }

    // Validate the reconstructed snapshot before exposing it as a release
    // bundle. Imports already preflight this contract; exports must not emit a
    // bundle that the next application would reject or partially materialize.
    validateMarketingSnapshotTransportLayouts(snapshot)
    validateSnapshotLayoutIdentities(snapshot)

    const snapshotHash = resolveApplicationReleaseSnapshotHash(snapshot)
    const releaseLineage = resolveRuntimeApplicationReleaseLineage(application, snapshotHash)
    const previousSchemaSnapshotSelection = resolveRuntimeApplicationReleaseBaseSnapshot({
        application,
        releaseLineage,
        snapshotHash
    })
    const previousSchemaSnapshot = previousSchemaSnapshotSelection.snapshot

    if (releaseLineage.previousReleaseVersion && !previousSchemaSnapshot) {
        throw new Error(
            `Installed release metadata is missing ${previousSchemaSnapshotSelection.expectedKey} for incremental runtime export.`
        )
    }

    return createApplicationReleaseBundle({
        applicationId: application.id,
        applicationKey: application.id,
        releaseVersion: releaseLineage.releaseVersion,
        sourceKind: 'application',
        snapshot,
        snapshotHash,
        previousReleaseVersion: releaseLineage.previousReleaseVersion,
        previousSchemaSnapshot
    })
}
