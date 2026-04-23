/**
 * Application Sync - Sync Engine
 *
 * Core sync engine that applies schema changes, orchestrates
 * runtime sync, and provides diff building utilities.
 */

import { createKnexExecutor } from '@universo/database'
import {
    generateSchemaName,
    resolveEntityTableName,
    generateMigrationName,
    type DDLServices,
    type SchemaChange,
    type SchemaSnapshot,
    type EntityDefinition
} from '@universo/schema-ddl'
import { ApplicationSchemaStatus, FieldDefinitionDataType, type ApplicationLayoutSyncResolution } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { updateApplicationSyncFields } from '../../persistence/applicationsStore'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { buildInstalledReleaseMetadataFromBundle } from '../../services/applicationReleaseBundle'
import { persistApplicationSchemaSyncState } from '../../services/ApplicationSchemaSyncStateStore'
import { persistConnectorSyncTouch } from '../../services/ConnectorSyncTouchStore'
import {
    ensureApplicationRuntimeWorkspaceSchema,
    persistWorkspaceSeedTemplate,
    syncWorkspaceSeededElementsForAllActiveWorkspaces
} from '../../services/applicationWorkspaces'
import { type ApplicationSyncTransaction, getApplicationSyncDdlServices, getApplicationSyncKnex } from '../../ddl'
import { TARGET_APP_STRUCTURE_VERSION } from '../../constants'
import {
    type SyncableApplicationRecord,
    type ApplicationSchemaSyncSource,
    type DiffStructuredChange,
    type DiffTableDetails,
    type EntityField,
    type SnapshotElementRow,
    type SnapshotEnumerationValue,
    ENUMERATION_KIND
} from './syncTypes'
import {
    isRecord,
    compareStableValues,
    applyApplicationSyncState,
    toWorkspaceAwareSnapshot,
    toWorkspaceAwareSchemaSnapshot,
    toStructuralSchemaSnapshot,
    normalizeReferenceId,
    resolveLocalizedPreviewText,
    resolveSetConstantPreviewValue,
    resolveElementPreviewLabel
} from './syncHelpers'
import { seedPredefinedElements, syncEnumerationValues } from './syncSeeding'
import {
    persistPublishedLayouts,
    persistPublishedWidgets,
    persistSeedWarnings,
    hasDashboardLayoutConfigChanges,
    hasPublishedLayoutsChanges,
    hasPublishedWidgetsChanges
} from './syncLayoutPersistence'
import { hasPublishedScriptsChanges, persistPublishedScripts } from './syncScriptPersistence'

// --- Connector sync touch ---

export async function persistConnectorSyncTouchIfPresent(
    trx: ApplicationSyncTransaction,
    connectorId: string | null | undefined,
    userId?: string | null
): Promise<void> {
    if (!connectorId) {
        return
    }

    await persistConnectorSyncTouch(createKnexExecutor(trx), {
        connectorId,
        userId
    })
}

// --- Main sync engine ---

export async function syncApplicationSchemaFromSource(options: {
    application: SyncableApplicationRecord
    exec: DbExecutor
    userId: string
    confirmDestructive: boolean
    connectorId?: string | null
    source: ApplicationSchemaSyncSource
    layoutResolutionPolicy?: { default?: ApplicationLayoutSyncResolution; bySourceLayoutId?: Record<string, ApplicationLayoutSyncResolution> }
}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const { application, exec, userId, confirmDestructive, connectorId, source, layoutResolutionPolicy } = options
    const { generator, migrator, migrationManager } = getApplicationSyncDdlServices()
    const knex = getApplicationSyncKnex()

    if (!application.schemaName) {
        application.schemaName = generateSchemaName(application.id)
        await updateApplicationSyncFields(exec, {
            applicationId: application.id,
            schemaName: application.schemaName,
            userId
        })
    }

    const schemaExists = await generator.schemaExists(application.schemaName)
    const migrationMeta = {
        publicationSnapshotHash: source.snapshotHash,
        publicationId: source.publicationId ?? undefined,
        publicationVersionId: source.publicationVersionId ?? undefined
    }
    const trackedSchemaSnapshot = toWorkspaceAwareSchemaSnapshot(
        application.schemaSnapshot as SchemaSnapshot | null,
        application.workspacesEnabled
    )
    const expectedReleaseSchemaSnapshot = toWorkspaceAwareSchemaSnapshot(
        source.incrementalPayload.schemaSnapshot,
        application.workspacesEnabled
    )
    const releaseSchemaSnapshotMatchesTrackedState = compareStableValues(
        toStructuralSchemaSnapshot(trackedSchemaSnapshot),
        toStructuralSchemaSnapshot(expectedReleaseSchemaSnapshot)
    )

    if (schemaExists) {
        const latestMigration = await migrationManager.getLatestMigration(application.schemaName)
        const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
        if (lastAppliedHash && lastAppliedHash === source.snapshotHash && releaseSchemaSnapshotMatchesTrackedState) {
            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName: application.schemaName, snapshot: source.snapshot })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName: application.schemaName, snapshot: source.snapshot })
            const widgetsNeedUpdate = await hasPublishedWidgetsChanges({
                schemaName: application.schemaName,
                snapshot: source.snapshot
            })
            const scriptsNeedUpdate = await hasPublishedScriptsChanges({
                schemaName: application.schemaName,
                snapshot: source.snapshot
            })
            const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate
            const hasRuntimeMetadataChanges = hasUiChanges || scriptsNeedUpdate

            const schemaSyncedAt = new Date()
            const installedReleaseMetadata = buildInstalledReleaseMetadataFromBundle(
                source.bundle,
                source.installSourceKind,
                schemaSyncedAt.toISOString()
            ) as unknown as Record<string, unknown>
            const schemaSnapshot = toWorkspaceAwareSnapshot(
                (application.schemaSnapshot as Record<string, unknown> | null) ??
                    (generator.generateSnapshot(source.entities) as unknown as Record<string, unknown>),
                application.workspacesEnabled
            )
            const { seedWarnings } = await knex.transaction(async (trx) => {
                await generator.syncSystemMetadata(application.schemaName!, source.entities, {
                    trx,
                    userId,
                    removeMissing: true
                })

                const runtimeSyncResult = await runPublishedApplicationRuntimeSync({
                    trx,
                    applicationId: application.id,
                    schemaName: application.schemaName!,
                    snapshotHash: source.snapshotHash,
                    snapshot: source.snapshot,
                    entities: source.entities,
                    migrationManager,
                    userId,
                    workspacesEnabled: application.workspacesEnabled,
                    layoutResolutionPolicy
                })

                await persistApplicationSchemaSyncState(createKnexExecutor(trx), {
                    applicationId: application.id,
                    schemaStatus: ApplicationSchemaStatus.SYNCED,
                    schemaError: null,
                    schemaSyncedAt,
                    schemaSnapshot,
                    lastSyncedPublicationVersionId: source.publicationVersionId,
                    appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                    installedReleaseMetadata,
                    userId
                })

                await persistConnectorSyncTouchIfPresent(trx, connectorId, userId)

                return runtimeSyncResult
            })

            applyApplicationSyncState(application, {
                schemaStatus: ApplicationSchemaStatus.SYNCED,
                schemaError: null,
                schemaSyncedAt,
                schemaSnapshot,
                lastSyncedPublicationVersionId: source.publicationVersionId,
                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                installedReleaseMetadata
            })

            return {
                statusCode: 200,
                body: {
                    status: hasRuntimeMetadataChanges || seedWarnings.length > 0 ? 'ui_updated' : 'no_changes',
                    message: hasUiChanges
                        ? 'UI layout settings updated'
                        : scriptsNeedUpdate
                        ? 'Runtime scripts updated'
                        : 'Schema is already up to date',
                    ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                }
            }
        }
    }

    application.schemaStatus = ApplicationSchemaStatus.MAINTENANCE
    await updateApplicationSyncFields(exec, {
        applicationId: application.id,
        schemaStatus: ApplicationSchemaStatus.MAINTENANCE,
        userId
    })

    try {
        if (!schemaExists) {
            const schemaSyncedAt = new Date()
            const installedReleaseMetadata = buildInstalledReleaseMetadataFromBundle(
                source.bundle,
                source.installSourceKind,
                schemaSyncedAt.toISOString()
            ) as unknown as Record<string, unknown>
            const result = await generator.generateFullSchema(application.schemaName!, source.bootstrapPayload.entities, {
                recordMigration: true,
                migrationDescription: 'initial_schema',
                migrationManager,
                migrationMeta,
                publicationSnapshot: source.publicationSnapshot,
                userId,
                afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
                    await runSchemaSyncStep(`initialSync:${application.id}:runtimeSync`, async () =>
                        runPublishedApplicationRuntimeSync({
                            trx,
                            applicationId: application.id,
                            schemaName: application.schemaName!,
                            snapshotHash: source.snapshotHash,
                            snapshot: source.snapshot,
                            entities: source.entities,
                            migrationManager,
                            migrationId,
                            userId,
                            workspacesEnabled: application.workspacesEnabled,
                            layoutResolutionPolicy
                        })
                    )

                    await runSchemaSyncStep(`initialSync:${application.id}:persistSchemaState`, async () =>
                        persistApplicationSchemaSyncState(createKnexExecutor(trx), {
                            applicationId: application.id,
                            schemaStatus: ApplicationSchemaStatus.SYNCED,
                            schemaError: null,
                            schemaSyncedAt,
                            schemaSnapshot: toWorkspaceAwareSnapshot(
                                snapshotAfter as unknown as Record<string, unknown>,
                                application.workspacesEnabled
                            ),
                            lastSyncedPublicationVersionId: source.publicationVersionId,
                            appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                            installedReleaseMetadata,
                            userId
                        })
                    )

                    await runSchemaSyncStep(`initialSync:${application.id}:connectorTouch`, async () =>
                        persistConnectorSyncTouchIfPresent(trx, connectorId, userId)
                    )
                }
            })

            if (!result.success) {
                application.schemaStatus = ApplicationSchemaStatus.ERROR
                application.schemaError = result.errors.join('; ')
                await updateApplicationSyncFields(exec, {
                    applicationId: application.id,
                    schemaStatus: ApplicationSchemaStatus.ERROR,
                    schemaError: result.errors.join('; '),
                    userId
                })

                return {
                    statusCode: 500,
                    body: {
                        status: 'error',
                        message: 'Schema creation failed',
                        errors: result.errors
                    }
                }
            }

            const schemaSnapshot = toWorkspaceAwareSnapshot(source.bootstrapPayload.schemaSnapshot, application.workspacesEnabled)
            applyApplicationSyncState(application, {
                schemaStatus: ApplicationSchemaStatus.SYNCED,
                schemaError: null,
                schemaSyncedAt,
                schemaSnapshot: schemaSnapshot as unknown as Record<string, unknown>,
                lastSyncedPublicationVersionId: source.publicationVersionId,
                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                installedReleaseMetadata
            })
            const latestMigration = await migrationManager.getLatestMigration(application.schemaName!)
            const seedWarnings = Array.isArray(latestMigration?.meta?.seedWarnings) ? latestMigration.meta.seedWarnings : []

            return {
                statusCode: 200,
                body: {
                    status: 'created',
                    schemaName: result.schemaName,
                    tablesCreated: result.tablesCreated,
                    message: `Schema created with ${result.tablesCreated.length} table(s)`,
                    ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                }
            }
        }

        const oldSnapshot = trackedSchemaSnapshot
        if (source.bundle.incrementalMigration.fromVersion && !source.incrementalBaseSchemaSnapshot) {
            application.schemaStatus = ApplicationSchemaStatus.ERROR
            await updateApplicationSyncFields(exec, {
                applicationId: application.id,
                schemaStatus: ApplicationSchemaStatus.ERROR,
                schemaError: 'Release bundle is missing base schema snapshot for incremental apply.',
                userId
            })

            return {
                statusCode: 409,
                body: {
                    status: 'error',
                    error: 'Release schema snapshot mismatch',
                    message: 'Bundle incremental apply requires a trusted base schema snapshot for the installed release.'
                }
            }
        }

        if (
            !compareStableValues(
                oldSnapshot,
                toWorkspaceAwareSchemaSnapshot(source.incrementalBaseSchemaSnapshot ?? null, application.workspacesEnabled)
            )
        ) {
            application.schemaStatus = ApplicationSchemaStatus.ERROR
            await updateApplicationSyncFields(exec, {
                applicationId: application.id,
                schemaStatus: ApplicationSchemaStatus.ERROR,
                schemaError: 'Target schema snapshot does not match the release bundle base snapshot.',
                userId
            })

            return {
                statusCode: 409,
                body: {
                    status: 'error',
                    error: 'Release schema snapshot mismatch',
                    message:
                        'Bundle incremental apply expects the tracked application schema snapshot to match the embedded base snapshot of the release.'
                }
            }
        }

        const diff = source.incrementalDiff
        const hasDestructiveChanges = diff.destructive.length > 0

        if (!diff.hasChanges) {
            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName: application.schemaName!, snapshot: source.snapshot })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName: application.schemaName!, snapshot: source.snapshot })
            const widgetsNeedUpdate = await hasPublishedWidgetsChanges({
                schemaName: application.schemaName!,
                snapshot: source.snapshot
            })
            const scriptsNeedUpdate = await hasPublishedScriptsChanges({
                schemaName: application.schemaName!,
                snapshot: source.snapshot
            })
            const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate
            const hasRuntimeMetadataChanges = hasUiChanges || scriptsNeedUpdate

            const latestMigration = await migrationManager.getLatestMigration(application.schemaName!)
            const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
            const snapshotBefore = toWorkspaceAwareSchemaSnapshot(
                (application.schemaSnapshot as SchemaSnapshot | null) ?? null,
                application.workspacesEnabled
            )
            const snapshotAfter = toWorkspaceAwareSchemaSnapshot(source.incrementalPayload.schemaSnapshot, application.workspacesEnabled)
            const metaOnlyDiff = {
                hasChanges: false,
                additive: [],
                destructive: [],
                summary: 'System metadata updated (no DDL changes)'
            }

            const schemaSyncedAt = new Date()
            const installedReleaseMetadata = buildInstalledReleaseMetadataFromBundle(
                source.bundle,
                source.installSourceKind,
                schemaSyncedAt.toISOString()
            ) as unknown as Record<string, unknown>
            const { seedWarnings } = await knex.transaction(async (trx) => {
                await generator.syncSystemMetadata(application.schemaName!, source.entities, {
                    trx,
                    userId,
                    removeMissing: true
                })

                let migrationId: string | undefined
                if (lastAppliedHash !== source.snapshotHash) {
                    migrationId = await migrationManager.recordMigration(
                        application.schemaName!,
                        generateMigrationName('system_sync'),
                        snapshotBefore,
                        snapshotAfter as SchemaSnapshot,
                        metaOnlyDiff,
                        trx,
                        migrationMeta,
                        source.publicationSnapshot,
                        userId
                    )
                }

                const runtimeSyncResult = await runPublishedApplicationRuntimeSync({
                    trx,
                    applicationId: application.id,
                    schemaName: application.schemaName!,
                    snapshotHash: source.snapshotHash,
                    snapshot: source.snapshot,
                    entities: source.entities,
                    migrationManager,
                    migrationId,
                    userId,
                    workspacesEnabled: application.workspacesEnabled,
                    layoutResolutionPolicy
                })

                await persistApplicationSchemaSyncState(createKnexExecutor(trx), {
                    applicationId: application.id,
                    schemaStatus: ApplicationSchemaStatus.SYNCED,
                    schemaError: null,
                    schemaSyncedAt,
                    schemaSnapshot: toWorkspaceAwareSnapshot(
                        snapshotAfter as unknown as Record<string, unknown>,
                        application.workspacesEnabled
                    ),
                    lastSyncedPublicationVersionId: source.publicationVersionId,
                    appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                    installedReleaseMetadata,
                    userId
                })

                await persistConnectorSyncTouchIfPresent(trx, connectorId, userId)

                return runtimeSyncResult
            })

            applyApplicationSyncState(application, {
                schemaStatus: ApplicationSchemaStatus.SYNCED,
                schemaError: null,
                schemaSyncedAt,
                schemaSnapshot: toWorkspaceAwareSnapshot(
                    snapshotAfter as unknown as Record<string, unknown>,
                    application.workspacesEnabled
                ),
                lastSyncedPublicationVersionId: source.publicationVersionId,
                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                installedReleaseMetadata
            })

            const hasElementChanges = seedWarnings.length > 0
            return {
                statusCode: 200,
                body: {
                    status: hasRuntimeMetadataChanges || hasElementChanges ? 'ui_updated' : 'no_changes',
                    message: hasUiChanges
                        ? 'UI layout settings updated'
                        : scriptsNeedUpdate
                        ? 'Runtime scripts updated'
                        : hasElementChanges
                        ? 'Predefined elements updated'
                        : 'Schema is already up to date',
                    ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                }
            }
        }

        if (hasDestructiveChanges && !confirmDestructive) {
            application.schemaStatus = ApplicationSchemaStatus.OUTDATED
            await updateApplicationSyncFields(exec, {
                applicationId: application.id,
                schemaStatus: ApplicationSchemaStatus.OUTDATED,
                userId
            })

            return {
                statusCode: 200,
                body: {
                    status: 'pending_confirmation',
                    diff: {
                        hasChanges: diff.hasChanges,
                        hasDestructiveChanges,
                        additive: diff.additive.map((c: SchemaChange) => c.description),
                        destructive: diff.destructive.map((c: SchemaChange) => c.description),
                        summary: diff.summary
                    },
                    message: 'Destructive changes detected. Set confirmDestructive=true to proceed.'
                }
            }
        }

        const schemaSyncedAt = new Date()
        const installedReleaseMetadata = buildInstalledReleaseMetadataFromBundle(
            source.bundle,
            source.installSourceKind,
            schemaSyncedAt.toISOString()
        ) as unknown as Record<string, unknown>
        const migrationResult = await migrator.applyAllChanges(
            application.schemaName!,
            diff,
            source.incrementalPayload.entities,
            confirmDestructive,
            {
                recordMigration: true,
                migrationDescription: 'schema_sync',
                migrationMeta,
                publicationSnapshot: source.publicationSnapshot,
                userId,
                afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
                    await runPublishedApplicationRuntimeSync({
                        trx,
                        applicationId: application.id,
                        schemaName: application.schemaName!,
                        snapshotHash: source.snapshotHash,
                        snapshot: source.snapshot,
                        entities: source.entities,
                        migrationManager,
                        migrationId,
                        userId,
                        workspacesEnabled: application.workspacesEnabled,
                        layoutResolutionPolicy
                    })

                    await persistApplicationSchemaSyncState(createKnexExecutor(trx), {
                        applicationId: application.id,
                        schemaStatus: ApplicationSchemaStatus.SYNCED,
                        schemaError: null,
                        schemaSyncedAt,
                        schemaSnapshot: toWorkspaceAwareSnapshot(
                            snapshotAfter as unknown as Record<string, unknown>,
                            application.workspacesEnabled
                        ),
                        lastSyncedPublicationVersionId: source.publicationVersionId,
                        appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                        installedReleaseMetadata,
                        userId
                    })

                    await persistConnectorSyncTouchIfPresent(trx, connectorId, userId)
                }
            }
        )

        if (!migrationResult.success) {
            application.schemaStatus = ApplicationSchemaStatus.ERROR
            application.schemaError = migrationResult.errors.join('; ')
            await updateApplicationSyncFields(exec, {
                applicationId: application.id,
                schemaStatus: ApplicationSchemaStatus.ERROR,
                schemaError: migrationResult.errors.join('; '),
                userId
            })

            return {
                statusCode: 500,
                body: {
                    status: 'error',
                    message: 'Schema migration failed',
                    errors: migrationResult.errors
                }
            }
        }

        const newSnapshot = toWorkspaceAwareSnapshot(
            generator.generateSnapshot(source.entities) as unknown as Record<string, unknown>,
            application.workspacesEnabled
        )
        applyApplicationSyncState(application, {
            schemaStatus: ApplicationSchemaStatus.SYNCED,
            schemaError: null,
            schemaSyncedAt,
            schemaSnapshot: newSnapshot as unknown as Record<string, unknown>,
            lastSyncedPublicationVersionId: source.publicationVersionId,
            appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
            installedReleaseMetadata
        })
        const latestMigration = await migrationManager.getLatestMigration(application.schemaName!)
        const seedWarnings = Array.isArray(latestMigration?.meta?.seedWarnings) ? latestMigration.meta.seedWarnings : []

        return {
            statusCode: 200,
            body: {
                status: 'migrated',
                schemaName: application.schemaName,
                changesApplied: migrationResult.changesApplied,
                message: 'Schema migration applied successfully',
                ...(seedWarnings.length > 0 ? { seedWarnings } : {})
            }
        }
    } catch (error) {
        application.schemaStatus = ApplicationSchemaStatus.ERROR
        application.schemaError = error instanceof Error ? error.message : 'Unknown error'
        await updateApplicationSyncFields(exec, {
            applicationId: application.id,
            schemaStatus: ApplicationSchemaStatus.ERROR,
            schemaError: error instanceof Error ? error.message : 'Unknown error',
            userId
        })

        return {
            statusCode: 500,
            body: {
                status: 'error',
                message: 'Schema sync failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }
}

// --- Preview label maps ---

export function buildPreviewLabelMaps(
    entities: EntityDefinition[],
    snapshot: PublishedApplicationSnapshot
): {
    catalogElementLabels: Map<string, Map<string, string>>
    enumerationValueLabels: Map<string, Map<string, string>>
} {
    const entityMap = new Map(entities.map((entity) => [entity.id, entity]))
    const catalogElementLabels = new Map<string, Map<string, string>>()
    const enumerationValueLabels = new Map<string, Map<string, string>>()

    for (const [objectId, rawElements] of Object.entries(snapshot.elements ?? {})) {
        const entity = entityMap.get(objectId)
        if (!entity || entity.kind !== 'catalog') continue

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
            catalogElementLabels.set(objectId, labels)
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

    return { catalogElementLabels, enumerationValueLabels }
}

// --- Diff builders ---

export function buildCreateTableDetails(options: {
    entities: EntityDefinition[]
    snapshot: PublishedApplicationSnapshot
    includeEntityIds?: Set<string>
}): DiffTableDetails[] {
    const { entities, snapshot, includeEntityIds } = options
    const catalogEntities = entities.filter((entity) => entity.kind === 'catalog')
    const { catalogElementLabels, enumerationValueLabels } = buildPreviewLabelMaps(entities, snapshot)

    return catalogEntities
        .filter((entity) => (includeEntityIds ? includeEntityIds.has(entity.id) : true))
        .map((entity) => {
            const fields = (entity.fields ?? []).map((f: EntityField) => ({
                id: f.id,
                codename: f.codename,
                dataType: f.dataType,
                isRequired: Boolean(f.isRequired),
                parentAttributeId: f.parentAttributeId ?? null
            }))

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

                          if (field.dataType !== FieldDefinitionDataType.REF) {
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

                          if (field.targetEntityKind === 'catalog' && field.targetEntityId) {
                              const label = catalogElementLabels.get(field.targetEntityId)?.get(refId)
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

async function runSchemaSyncStep<T>(_label: string, fn: () => Promise<T>): Promise<T> {
    return fn()
}

// --- Runtime sync orchestrator ---

export async function runPublishedApplicationRuntimeSync(options: {
    trx: ApplicationSyncTransaction
    applicationId: string
    schemaName: string
    snapshotHash?: string | null
    snapshot: PublishedApplicationSnapshot
    entities: EntityDefinition[]
    migrationManager: DDLServices['migrationManager']
    migrationId?: string
    userId?: string | null
    workspacesEnabled?: boolean
    layoutResolutionPolicy?: { default?: ApplicationLayoutSyncResolution; bySourceLayoutId?: Record<string, ApplicationLayoutSyncResolution> }
}): Promise<{ seedWarnings: string[] }> {
    const { trx, applicationId, schemaName, snapshotHash, snapshot, entities, migrationManager, migrationId, userId, layoutResolutionPolicy } =
        options

    await runSchemaSyncStep(`runtimeSync:${applicationId}:layouts`, async () =>
        persistPublishedLayouts({
            schemaName,
            snapshotHash,
            snapshot,
            userId,
            trx,
            layoutResolutionPolicy
        })
    )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:scripts`, async () =>
        persistPublishedScripts({
            schemaName,
            snapshot,
            userId,
            trx
        })
    )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:widgets`, async () =>
        persistPublishedWidgets({
            schemaName,
            snapshot,
            userId,
            trx
        })
    )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:enumerations`, async () =>
        syncEnumerationValues(schemaName, snapshot, userId, trx)
    )

    if (options.workspacesEnabled) {
        await runSchemaSyncStep(`runtimeSync:${applicationId}:workspaceTemplate`, async () =>
            persistWorkspaceSeedTemplate(createKnexExecutor(trx), {
                schemaName,
                elements: snapshot.elements ?? {},
                actorUserId: userId
            })
        )

        await runSchemaSyncStep(`runtimeSync:${applicationId}:workspaceSchema`, async () =>
            ensureApplicationRuntimeWorkspaceSchema(createKnexExecutor(trx), {
                schemaName,
                applicationId,
                entities,
                actorUserId: userId
            })
        )
        await runSchemaSyncStep(`runtimeSync:${applicationId}:workspaceSeededElements`, async () =>
            syncWorkspaceSeededElementsForAllActiveWorkspaces(createKnexExecutor(trx), {
                schemaName,
                actorUserId: userId
            })
        )
    }

    const seedWarnings = options.workspacesEnabled
        ? []
        : await runSchemaSyncStep(`runtimeSync:${applicationId}:seedElements`, async () =>
              seedPredefinedElements(schemaName, snapshot, entities, userId, trx)
          )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:seedWarnings`, async () =>
        persistSeedWarnings(schemaName, migrationManager, seedWarnings, {
            trx,
            migrationId
        })
    )

    return { seedWarnings }
}
