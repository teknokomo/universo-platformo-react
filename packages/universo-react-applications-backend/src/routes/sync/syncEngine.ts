/**
 * Application Sync - Sync Engine
 *
 * Core sync engine that applies schema changes, orchestrates
 * runtime sync, and provides diff building utilities.
 */

import { createKnexExecutor } from '@universo-react/database'
import {
    generateSchemaName,
    generateMigrationName,
    type DDLServices,
    type SchemaChange,
    type SchemaSnapshot,
    type EntityDefinition
} from '@universo-react/schema-ddl'
import { ApplicationSchemaStatus, type ApplicationLayoutSyncResolution } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { updateApplicationSyncFields } from '../../persistence/applicationsStore'
import { lockApplicationLayoutMutationFamily } from '../../persistence/applicationLayoutStoreSupport'
import { APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT } from '../../persistence/applicationLayoutSyncStore'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { buildInstalledReleaseMetadataFromBundle } from '../../services/applicationReleaseBundle'
import { persistApplicationSchemaSyncState } from '../../services/ApplicationSchemaSyncStateStore'
import { persistConnectorSyncTouch } from '../../services/ConnectorSyncTouchStore'
import { acquireMarketingRowCapLock } from '../../services/marketingRowCap'
import {
    ensureApplicationRuntimeWorkspaceSchema,
    persistWorkspaceSeedTemplate,
    syncWorkspaceSeededElementsForAllActiveWorkspaces
} from '../../services/applicationWorkspaces'
import { type ApplicationSyncTransaction, getApplicationSyncDdlServices, getApplicationSyncKnex } from '../../ddl'
import { TARGET_APP_STRUCTURE_VERSION } from '../../constants'
import { type SyncableApplicationRecord, type ApplicationSchemaSyncSource } from './syncTypes'
import {
    compareStableValues,
    applyApplicationSyncState,
    toWorkspaceAwareSnapshot,
    toWorkspaceAwareSchemaSnapshot,
    withWorkspaceRuntimeLayoutWidgets,
    remapSnapshotLayoutScopeEntityIds,
    remapSnapshotMenuWidgetTargets,
    toStructuralSchemaSnapshot
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
import { hasPublishedModulesChanges, persistPublishedModules } from './syncModulePersistence'
import { hasPublishedPackagesChanges, persistPublishedPackages } from './syncPackagePersistence'
import { hasPublishedPlayCanvasManifestChanges, persistPublishedPlayCanvasManifests } from './syncPlayCanvasPersistence'

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

export const buildRuntimeSnapshotForApplicationSync = (
    snapshot: PublishedApplicationSnapshot,
    entities: EntityDefinition[],
    workspacesEnabled?: boolean
): PublishedApplicationSnapshot =>
    withWorkspaceRuntimeLayoutWidgets(
        remapSnapshotMenuWidgetTargets(remapSnapshotLayoutScopeEntityIds(snapshot, entities), entities),
        workspacesEnabled === true
    )

export async function syncApplicationSchemaFromSource(options: {
    application: SyncableApplicationRecord
    exec: DbExecutor
    userId: string
    confirmDestructive: boolean
    connectorId?: string | null
    source: ApplicationSchemaSyncSource
    layoutResolutionPolicy?: {
        default?: ApplicationLayoutSyncResolution
        bySourceLayoutId?: Record<string, ApplicationLayoutSyncResolution>
    }
}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const { application, exec, userId, confirmDestructive, connectorId, source, layoutResolutionPolicy } = options
    const { generator, migrator, migrationManager } = getApplicationSyncDdlServices()
    const knex = getApplicationSyncKnex()

    const isEntityBackedWidgetCopyConflict = (value: unknown): boolean => {
        if (typeof value === 'string') return value.includes(APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT)
        if (value instanceof Error) return value.message.includes(APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT)
        if (Array.isArray(value)) return value.some(isEntityBackedWidgetCopyConflict)
        return false
    }

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
            const runtimeSnapshot = buildRuntimeSnapshotForApplicationSync(source.snapshot, source.entities, application.workspacesEnabled)
            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({
                schemaName: application.schemaName,
                snapshot: runtimeSnapshot,
                executor: exec
            })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({
                schemaName: application.schemaName,
                snapshot: runtimeSnapshot,
                executor: exec
            })
            const widgetsNeedUpdate = await hasPublishedWidgetsChanges({
                schemaName: application.schemaName,
                snapshot: runtimeSnapshot,
                executor: exec
            })
            const modulesNeedUpdate = await hasPublishedModulesChanges({
                schemaName: application.schemaName,
                snapshot: runtimeSnapshot
            })
            const packagesNeedUpdate = await hasPublishedPackagesChanges({
                schemaName: application.schemaName,
                snapshot: runtimeSnapshot
            })
            const playCanvasManifestsNeedUpdate = await hasPublishedPlayCanvasManifestChanges({
                schemaName: application.schemaName,
                snapshot: runtimeSnapshot
            })
            const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate
            const hasRuntimeMetadataChanges = hasUiChanges || modulesNeedUpdate || packagesNeedUpdate || playCanvasManifestsNeedUpdate

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
                await lockApplicationLayoutMutationFamily(createKnexExecutor(trx), application.schemaName!)
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
                    publicationId: source.publicationId,
                    snapshot: source.snapshot,
                    entities: source.entities,
                    migrationManager,
                    userId,
                    workspacesEnabled: application.workspacesEnabled,
                    isPublic: application.isPublic,
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
                    workspacesEnabled: application.workspacesEnabled,
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
                        : modulesNeedUpdate
                        ? 'Runtime modules updated'
                        : packagesNeedUpdate
                        ? 'Runtime packages updated'
                        : playCanvasManifestsNeedUpdate
                        ? 'PlayCanvas runtime manifests updated'
                        : 'Schema is already up to date',
                    ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                }
            }
        }
    }

    const previousSchemaStatus = application.schemaStatus ?? ApplicationSchemaStatus.DRAFT
    const previousSchemaError = application.schemaError ?? null
    const restoreEntityBackedCopyConflict = async () => {
        application.schemaStatus = previousSchemaStatus
        application.schemaError = previousSchemaError
        await updateApplicationSyncFields(exec, {
            applicationId: application.id,
            schemaStatus: previousSchemaStatus,
            schemaError: previousSchemaError,
            userId
        })

        return {
            statusCode: 409,
            body: {
                status: 'conflict',
                error: APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT,
                code: APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT,
                message: 'This layout contains entity-backed content that cannot be copied into application-owned storage.'
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
                            publicationId: source.publicationId,
                            snapshot: source.snapshot,
                            entities: source.entities,
                            migrationManager,
                            migrationId,
                            userId,
                            workspacesEnabled: application.workspacesEnabled,
                            isPublic: application.isPublic,
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
                            workspacesEnabled: application.workspacesEnabled,
                            userId
                        })
                    )

                    await runSchemaSyncStep(`initialSync:${application.id}:connectorTouch`, async () =>
                        persistConnectorSyncTouchIfPresent(trx, connectorId, userId)
                    )
                }
            })

            if (!result.success) {
                if (isEntityBackedWidgetCopyConflict(result.errors)) {
                    return restoreEntityBackedCopyConflict()
                }

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
            const runtimeSnapshot = buildRuntimeSnapshotForApplicationSync(source.snapshot, source.entities, application.workspacesEnabled)
            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({
                schemaName: application.schemaName!,
                snapshot: runtimeSnapshot,
                executor: exec
            })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({
                schemaName: application.schemaName!,
                snapshot: runtimeSnapshot,
                executor: exec
            })
            const widgetsNeedUpdate = await hasPublishedWidgetsChanges({
                schemaName: application.schemaName!,
                snapshot: runtimeSnapshot,
                executor: exec
            })
            const modulesNeedUpdate = await hasPublishedModulesChanges({
                schemaName: application.schemaName!,
                snapshot: runtimeSnapshot
            })
            const packagesNeedUpdate = await hasPublishedPackagesChanges({
                schemaName: application.schemaName!,
                snapshot: runtimeSnapshot
            })
            const playCanvasManifestsNeedUpdate = await hasPublishedPlayCanvasManifestChanges({
                schemaName: application.schemaName!,
                snapshot: runtimeSnapshot
            })
            const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate
            const hasRuntimeMetadataChanges = hasUiChanges || modulesNeedUpdate || packagesNeedUpdate || playCanvasManifestsNeedUpdate

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
                await lockApplicationLayoutMutationFamily(createKnexExecutor(trx), application.schemaName!)
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
                    publicationId: source.publicationId,
                    snapshot: source.snapshot,
                    entities: source.entities,
                    migrationManager,
                    migrationId,
                    userId,
                    workspacesEnabled: application.workspacesEnabled,
                    isPublic: application.isPublic,
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
                    workspacesEnabled: application.workspacesEnabled,
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
                        : modulesNeedUpdate
                        ? 'Runtime modules updated'
                        : packagesNeedUpdate
                        ? 'Runtime packages updated'
                        : playCanvasManifestsNeedUpdate
                        ? 'PlayCanvas runtime manifests updated'
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
                beforeSchemaChanges: async ({ trx, schemaName, tableNames }) => {
                    const executor = createKnexExecutor(trx)
                    await lockApplicationLayoutMutationFamily(executor, schemaName)
                    for (const tableName of tableNames) {
                        await acquireMarketingRowCapLock(executor, schemaName, tableName)
                    }
                },
                afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
                    await runPublishedApplicationRuntimeSync({
                        trx,
                        applicationId: application.id,
                        schemaName: application.schemaName!,
                        snapshotHash: source.snapshotHash,
                        publicationId: source.publicationId,
                        snapshot: source.snapshot,
                        entities: source.entities,
                        migrationManager,
                        migrationId,
                        userId,
                        workspacesEnabled: application.workspacesEnabled,
                        isPublic: application.isPublic,
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
                        workspacesEnabled: application.workspacesEnabled,
                        userId
                    })

                    await persistConnectorSyncTouchIfPresent(trx, connectorId, userId)
                }
            }
        )

        if (!migrationResult.success) {
            if (isEntityBackedWidgetCopyConflict(migrationResult.errors)) {
                return restoreEntityBackedCopyConflict()
            }

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
        if (isEntityBackedWidgetCopyConflict(error)) {
            return restoreEntityBackedCopyConflict()
        }

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

export { buildCreateEntityGroupDetails, buildCreateTableDetails, buildPreviewLabelMaps, mapStructuredChange } from './syncDiffBuilder'

async function runSchemaSyncStep<T>(_label: string, fn: () => Promise<T>): Promise<T> {
    return fn()
}

// --- Runtime sync orchestrator ---

export async function runPublishedApplicationRuntimeSync(options: {
    trx: ApplicationSyncTransaction
    applicationId: string
    schemaName: string
    snapshotHash?: string | null
    publicationId?: string | null
    snapshot: PublishedApplicationSnapshot
    entities: EntityDefinition[]
    migrationManager: DDLServices['migrationManager']
    migrationId?: string
    userId?: string | null
    workspacesEnabled?: boolean
    isPublic?: boolean
    layoutResolutionPolicy?: {
        default?: ApplicationLayoutSyncResolution
        bySourceLayoutId?: Record<string, ApplicationLayoutSyncResolution>
    }
}): Promise<{ seedWarnings: string[] }> {
    const {
        trx,
        applicationId,
        schemaName,
        snapshotHash,
        snapshot,
        entities,
        migrationManager,
        migrationId,
        userId,
        layoutResolutionPolicy
    } = options
    const runtimeSnapshot = buildRuntimeSnapshotForApplicationSync(snapshot, entities, options.workspacesEnabled)

    await runSchemaSyncStep(`runtimeSync:${applicationId}:layouts`, async () =>
        persistPublishedLayouts({
            schemaName,
            snapshotHash,
            snapshot: runtimeSnapshot,
            userId,
            trx,
            layoutResolutionPolicy
        })
    )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:modules`, async () =>
        persistPublishedModules({
            schemaName,
            snapshot: runtimeSnapshot,
            userId,
            trx
        })
    )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:packages`, async () =>
        persistPublishedPackages({
            schemaName,
            snapshot: runtimeSnapshot,
            userId,
            trx
        })
    )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:playcanvasManifests`, async () =>
        persistPublishedPlayCanvasManifests({
            schemaName,
            snapshot: runtimeSnapshot,
            publicationId: options.publicationId ?? null,
            sourceMetahubId: typeof runtimeSnapshot.metahubId === 'string' ? runtimeSnapshot.metahubId : null,
            userId,
            trx
        })
    )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:widgets`, async () =>
        persistPublishedWidgets({
            schemaName,
            snapshot: runtimeSnapshot,
            userId,
            trx
        })
    )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:enumerations`, async () =>
        syncEnumerationValues(schemaName, runtimeSnapshot, userId, trx)
    )

    if (options.workspacesEnabled) {
        await runSchemaSyncStep(`runtimeSync:${applicationId}:workspaceTemplate`, async () =>
            persistWorkspaceSeedTemplate(createKnexExecutor(trx), {
                schemaName,
                elements: runtimeSnapshot.elements ?? {},
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
              seedPredefinedElements(schemaName, runtimeSnapshot, entities, userId, trx)
          )
    await runSchemaSyncStep(`runtimeSync:${applicationId}:seedWarnings`, async () =>
        persistSeedWarnings(schemaName, migrationManager, seedWarnings, {
            trx,
            migrationId
        })
    )

    return { seedWarnings }
}
