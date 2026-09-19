/**
 * Application Sync - Data Loaders
 *
 * Functions for loading application runtime data from the database,
 * building release bundles, and resolving release lineage.
 */

import {
    generateTableName,
    generateColumnName,
    generateChildTableName,
    hasPhysicalRuntimeTable,
    type EntityDefinition,
    type SchemaSnapshot
} from '@universo-react/schema-ddl'
import stableStringify from 'json-stable-stringify'
import { quoteQualifiedIdentifier } from '@universo-react/migrations-core'
import {
    ComponentDefinitionDataType,
    decodeLayoutConfigEnvelope,
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    encodeSnapshotLayoutConfigEnvelope,
    parseApplicationLayoutConfig,
    parseApplicationLayoutWidgetConfig,
    type ApplicationPackageDefinition,
    type PackageSourceDescriptor
} from '@universo-react/types'
import { validateMarketingSnapshotTransportLayouts, validateSnapshotLayoutIdentities, type DbExecutor } from '@universo-react/utils'
import {
    createApplicationReleaseBundle,
    extractInstalledReleaseVersion,
    resolveApplicationReleaseSnapshotHash,
    validateApplicationReleaseBundleArtifacts,
    type ApplicationReleaseBundle
} from '../../services/applicationReleaseBundle'
import type { PublishedApplicationSnapshot, SnapshotEnumerationValueDefinition } from '../../services/applicationSyncContracts'
import { TARGET_APP_STRUCTURE_VERSION } from '../../constants'
import {
    type SyncableApplicationRecord,
    type ApplicationSchemaSyncSource,
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
    extractInstalledReleaseMetadataString,
    extractInstalledReleaseMetadataSchemaSnapshot,
    extractSetConstantRefConfig,
    resolveApplicationReleaseVersion,
    parseApplicationTemplateKey
} from './syncHelpers'

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
            SELECT id, layout_id, zone, widget_key, sort_order, config, is_active, source_widget_id, source_base_widget_id
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
        const decoded = decodeLayoutWidgetConfigEnvelope(requireRecord(row.config, 'config', `widget ${id}`), {
            templateKey: layout.templateKey,
            widgetKey,
            zone
        })
        const rendererConfig = parseApplicationLayoutWidgetConfig(widgetKey, decoded.rendererConfig)
        return {
            id,
            layoutId,
            zone,
            widgetKey,
            sortOrder: requireInteger(row.sort_order, 'sortOrder', `widget ${id}`),
            config: encodeLayoutWidgetConfigEnvelope(
                { rendererConfig, neutral: decoded.neutral },
                { templateKey: layout.templateKey, widgetKey, zone }
            ),
            isActive: requireBoolean(row.is_active, 'isActive', `widget ${id}`),
            sourceWidgetId:
                row.source_widget_id === null || row.source_widget_id === undefined
                    ? null
                    : requireString(row.source_widget_id, 'sourceWidgetId', `widget ${id}`),
            sourceBaseWidgetId:
                row.source_base_widget_id === null || row.source_base_widget_id === undefined
                    ? null
                    : requireString(row.source_base_widget_id, 'sourceBaseWidgetId', `widget ${id}`)
        }
    })

    const snapshotWidgetIdBySourceId = new Map<string, string>()
    for (const widget of normalizedWidgets) {
        const layout = layoutById.get(widget.layoutId)
        if (!layout) throw new Error(`[SchemaSync] Runtime widget ${widget.id} references an unknown layout`)
        if (layout.scopeEntityId !== null) continue
        snapshotWidgetIdBySourceId.set(widget.id, widget.id)
        if (widget.sourceWidgetId) snapshotWidgetIdBySourceId.set(widget.sourceWidgetId, widget.id)
    }
    const widgetById = new Map(normalizedWidgets.map((widget) => [widget.id, widget]))
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
            if (
                widget.isActive === baseWidget.isActive &&
                widget.zone === baseWidget.zone &&
                widget.sortOrder === baseWidget.sortOrder &&
                stableStringify(widget.config) === stableStringify(baseWidget.config)
            ) {
                continue
            }
            layoutWidgetOverrides.push({
                id: widget.id,
                layoutId: widget.layoutId,
                baseWidgetId,
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

// --- Release lineage ---

export function resolveRuntimeApplicationReleaseLineage(
    application: SyncableApplicationRecord,
    snapshotHash: string
): { releaseVersion: string; previousReleaseVersion: string | null } {
    const installedReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
    const installedSourceKind = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'sourceKind')
    const installedSnapshotHash = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'snapshotHash')
    const previousReleaseVersion = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'previousReleaseVersion')

    if (installedSourceKind === 'release_bundle' && installedReleaseVersion && installedSnapshotHash === snapshotHash) {
        return {
            releaseVersion: installedReleaseVersion,
            previousReleaseVersion
        }
    }

    const structureVersion =
        typeof application.appStructureVersion === 'number' && Number.isFinite(application.appStructureVersion)
            ? application.appStructureVersion
            : TARGET_APP_STRUCTURE_VERSION

    return {
        releaseVersion: `application-runtime-v${structureVersion}-${snapshotHash.slice(0, 12)}`,
        previousReleaseVersion: installedReleaseVersion
    }
}

export function resolveRuntimeApplicationReleaseBaseSnapshot(options: {
    application: SyncableApplicationRecord
    releaseLineage: { releaseVersion: string; previousReleaseVersion: string | null }
    snapshotHash: string
}): { snapshot: SchemaSnapshot | null; expectedKey: 'baseSchemaSnapshot' | 'releaseSchemaSnapshot' | null } {
    const { application, releaseLineage, snapshotHash } = options

    if (!releaseLineage.previousReleaseVersion) {
        return {
            snapshot: null,
            expectedKey: null
        }
    }

    const installedReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
    const installedSourceKind = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'sourceKind')
    const installedSnapshotHash = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'snapshotHash')
    const reusesStoredBundleLineage =
        installedSourceKind === 'release_bundle' &&
        installedReleaseVersion === releaseLineage.releaseVersion &&
        installedSnapshotHash === snapshotHash

    const expectedKey = reusesStoredBundleLineage ? 'baseSchemaSnapshot' : 'releaseSchemaSnapshot'

    return {
        snapshot: extractInstalledReleaseMetadataSchemaSnapshot(application.installedReleaseMetadata, expectedKey),
        expectedKey
    }
}

// --- Bundle creation + source building ---

export function createPublicationApplicationReleaseBundle(options: {
    application: SyncableApplicationRecord
    syncContext: {
        publicationId: string
        publicationVersionId: string
        snapshotHash: string | null
        snapshot: PublishedApplicationSnapshot
    }
}): ApplicationReleaseBundle {
    const previousReleaseVersion = extractInstalledReleaseVersion(options.application.installedReleaseMetadata)

    return createApplicationReleaseBundle({
        applicationId: options.application.id,
        applicationKey: options.application.id,
        releaseVersion: resolveApplicationReleaseVersion({
            publicationVersionId: options.syncContext.publicationVersionId,
            snapshot: options.syncContext.snapshot,
            snapshotHash: options.syncContext.snapshotHash
        }),
        sourceKind: 'publication',
        snapshot: options.syncContext.snapshot,
        snapshotHash: options.syncContext.snapshotHash,
        publicationId: options.syncContext.publicationId,
        publicationVersionId: options.syncContext.publicationVersionId,
        previousReleaseVersion,
        previousSchemaSnapshot: (options.application.schemaSnapshot as SchemaSnapshot | null) ?? null
    })
}

export function buildApplicationSyncSourceFromPublication(options: {
    application: SyncableApplicationRecord
    syncContext: {
        publicationId: string
        publicationVersionId: string
        snapshotHash: string | null
        snapshot: PublishedApplicationSnapshot
        entities: EntityDefinition[]
        publicationSnapshot: Record<string, unknown>
    }
}): ApplicationSchemaSyncSource {
    validateMarketingSnapshotTransportLayouts(options.syncContext.snapshot)
    validateSnapshotLayoutIdentities(options.syncContext.snapshot)
    const bundle = createPublicationApplicationReleaseBundle({
        application: options.application,
        syncContext: options.syncContext
    })
    const artifacts = validateApplicationReleaseBundleArtifacts(bundle)

    return {
        bundle,
        bootstrapPayload: artifacts.bootstrapPayload,
        incrementalPayload: artifacts.incrementalPayload,
        incrementalBaseSchemaSnapshot: artifacts.incrementalBaseSchemaSnapshot,
        incrementalDiff: artifacts.incrementalDiff,
        installSourceKind: 'publication',
        snapshotHash: artifacts.snapshotHash,
        snapshot: options.syncContext.snapshot,
        entities: artifacts.incrementalPayload.entities,
        publicationSnapshot: options.syncContext.publicationSnapshot,
        publicationId: options.syncContext.publicationId,
        publicationVersionId: options.syncContext.publicationVersionId
    }
}

export function buildApplicationSyncSourceFromBundle(bundle: ApplicationReleaseBundle): ApplicationSchemaSyncSource {
    const snapshot = bundle.snapshot
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
        throw new Error('Invalid application release bundle snapshot')
    }
    validateMarketingSnapshotTransportLayouts(snapshot)
    validateSnapshotLayoutIdentities(snapshot)
    const artifacts = validateApplicationReleaseBundleArtifacts(bundle)

    return {
        bundle,
        bootstrapPayload: artifacts.bootstrapPayload,
        incrementalPayload: artifacts.incrementalPayload,
        incrementalBaseSchemaSnapshot: artifacts.incrementalBaseSchemaSnapshot,
        incrementalDiff: artifacts.incrementalDiff,
        installSourceKind: 'release_bundle',
        snapshotHash: artifacts.snapshotHash,
        snapshot,
        entities: artifacts.incrementalPayload.entities,
        publicationSnapshot: snapshot as unknown as Record<string, unknown>,
        publicationId: bundle.manifest.publicationId ?? null,
        publicationVersionId: bundle.manifest.publicationVersionId ?? null
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
            snapshotFormatVersion: 1
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
