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
} from '@universo/schema-ddl'
import { quoteQualifiedIdentifier } from '@universo/migrations-core'
import { FieldDefinitionDataType } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
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
    type RuntimeApplicationAttributeRow,
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
    resolveApplicationReleaseVersion
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
    const attributeRows = await exec.query<RuntimeApplicationAttributeRow>(
        `
            SELECT
                id,
                object_id,
                ${runtimeCodenameTextSql('codename')} AS codename,
                sort_order,
                column_name,
                data_type,
                is_required,
                is_display_attribute,
                target_object_id,
                target_object_kind,
                parent_attribute_id,
                presentation,
                validation_rules,
                ui_config
            FROM ${schemaIdent}._app_attributes
            WHERE _upl_deleted = false
              AND _app_deleted = false
            ORDER BY object_id ASC, parent_attribute_id ASC NULLS FIRST, sort_order ASC, id ASC
        `
    )

    const fieldNodes = new Map<
        string,
        {
            objectId: string
            parentAttributeId: string | null
            sortOrder: number
            field: EntityDefinition['fields'][number]
        }
    >()

    for (const row of attributeRows) {
        const id = typeof row.id === 'string' ? row.id : null
        const objectId = typeof row.object_id === 'string' ? row.object_id : null
        const codename = typeof row.codename === 'string' ? row.codename : null
        const dataType = typeof row.data_type === 'string' ? (row.data_type as FieldDefinitionDataType) : null
        const columnName = typeof row.column_name === 'string' ? row.column_name : null

        if (!id || !objectId || !codename || !dataType || !columnName) {
            continue
        }

        const uiConfig = isRecord(row.ui_config) ? row.ui_config : {}
        const targetConstantId =
            row.target_object_kind === 'set' && typeof uiConfig.targetConstantId === 'string' ? uiConfig.targetConstantId : null

        fieldNodes.set(id, {
            objectId,
            parentAttributeId: typeof row.parent_attribute_id === 'string' ? row.parent_attribute_id : null,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            field: {
                id,
                codename,
                dataType,
                isRequired: row.is_required === true,
                isDisplayAttribute: row.is_display_attribute === true,
                targetEntityId: typeof row.target_object_id === 'string' ? row.target_object_id : null,
                targetEntityKind: normalizeRuntimeEntityKind(row.target_object_kind),
                targetConstantId,
                parentAttributeId: typeof row.parent_attribute_id === 'string' ? row.parent_attribute_id : null,
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
        if (node.parentAttributeId) {
            const children = childNodesByParent.get(node.parentAttributeId) ?? []
            children.push({ sortOrder: node.sortOrder, field: node.field })
            childNodesByParent.set(node.parentAttributeId, children)
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
        if (entity.kind !== 'catalog' || !hasPhysicalRuntimeTable(entity)) {
            continue
        }

        const tableName = entity.physicalTableName ?? generateTableName(entity.id, entity.kind)
        const tableIdent = quoteQualifiedIdentifier(schemaName, tableName)
        const runtimeRowCondition = buildDynamicRuntimeActiveRowSql(resolveEntityLifecycleContract(entity), entity.config)
        const topLevelFields = entity.fields.filter((field) => field.dataType !== FieldDefinitionDataType.TABLE && !field.parentAttributeId)
        const tableFields = entity.fields.filter(
            (field) => field.dataType === FieldDefinitionDataType.TABLE && !field.parentAttributeId && (field.childFields?.length ?? 0) > 0
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
            if (field.parentAttributeId) {
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

// --- Layout loader ---

export async function loadApplicationRuntimeLayouts(
    exec: DbExecutor,
    schemaName: string
): Promise<{
    layouts: unknown[]
    layoutZoneWidgets: unknown[]
    defaultLayoutId: string | null
    layoutConfig: Record<string, unknown>
}> {
    const schemaIdent = quoteSchemaName(schemaName)

    try {
        const layouts = await exec.query<RuntimeApplicationLayoutRow>(
            `
                SELECT
                  id, template_key, name, description, config, is_active, is_default, sort_order,
                  source_kind, source_layout_id, source_snapshot_hash, source_content_hash,
                  local_content_hash, sync_state, is_source_excluded
                FROM ${schemaIdent}._app_layouts
                WHERE _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY sort_order ASC, _upl_created_at ASC
            `
        )

        const normalizedLayouts = layouts.map((row) => ({
            id: String(row.id ?? ''),
            templateKey: typeof row.template_key === 'string' && row.template_key.length > 0 ? row.template_key : 'dashboard',
            name: isRecord(row.name) ? row.name : {},
            description: isRecord(row.description) ? row.description : null,
            config: isRecord(row.config) ? row.config : {},
            isActive: row.is_active === true,
            isDefault: row.is_default === true,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            sourceKind: typeof row.source_kind === 'string' ? row.source_kind : 'metahub',
            sourceLayoutId: typeof row.source_layout_id === 'string' ? row.source_layout_id : null,
            sourceSnapshotHash: typeof row.source_snapshot_hash === 'string' ? row.source_snapshot_hash : null,
            sourceContentHash: typeof row.source_content_hash === 'string' ? row.source_content_hash : null,
            localContentHash: typeof row.local_content_hash === 'string' ? row.local_content_hash : null,
            syncState: typeof row.sync_state === 'string' ? row.sync_state : 'clean',
            isSourceExcluded: row.is_source_excluded === true
        }))

        const defaultLayoutId = normalizedLayouts.find((layout) => layout.isActive && layout.isDefault)?.id ?? null
        const layoutConfig =
            normalizedLayouts.find((layout) => layout.isActive && layout.isDefault)?.config ??
            normalizedLayouts.find((layout) => layout.isActive)?.config ??
            {}

        let normalizedWidgets: unknown[] = []
        try {
            const widgets = await exec.query<RuntimeApplicationWidgetRow>(
                `
                    SELECT id, layout_id, zone, widget_key, sort_order, config, is_active
                    FROM ${schemaIdent}._app_widgets
                    WHERE _upl_deleted = false
                      AND _app_deleted = false
                    ORDER BY layout_id ASC, zone ASC, sort_order ASC, _upl_created_at ASC
                `
            )

            normalizedWidgets = widgets.map((row) => ({
                id: String(row.id ?? ''),
                layoutId: String(row.layout_id ?? ''),
                zone: typeof row.zone === 'string' ? row.zone : 'center',
                widgetKey: typeof row.widget_key === 'string' ? row.widget_key : '',
                sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
                config: isRecord(row.config) ? row.config : {},
                isActive: row.is_active !== false
            }))
        } catch {
            normalizedWidgets = []
        }

        return {
            layouts: normalizedLayouts,
            layoutZoneWidgets: normalizedWidgets,
            defaultLayoutId,
            layoutConfig: isRecord(layoutConfig) ? layoutConfig : {}
        }
    } catch {
        return {
            layouts: [],
            layoutZoneWidgets: [],
            defaultLayoutId: null,
            layoutConfig: {}
        }
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
        applicationKey: options.application.slug ?? options.application.id,
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
    const artifacts = validateApplicationReleaseBundleArtifacts(bundle)
    const snapshot = bundle.snapshot
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
        throw new Error('Invalid application release bundle snapshot')
    }

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
    if (runtimeLayouts.layouts.length > 0) {
        snapshot.layouts = runtimeLayouts.layouts
        snapshot.defaultLayoutId = runtimeLayouts.defaultLayoutId
        snapshot.layoutConfig = runtimeLayouts.layoutConfig
    }
    if (runtimeLayouts.layoutZoneWidgets.length > 0) {
        snapshot.layoutZoneWidgets = runtimeLayouts.layoutZoneWidgets
    }

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
        applicationKey: application.slug ?? application.id,
        releaseVersion: releaseLineage.releaseVersion,
        sourceKind: 'application',
        snapshot,
        snapshotHash,
        previousReleaseVersion: releaseLineage.previousReleaseVersion,
        previousSchemaSnapshot
    })
}
