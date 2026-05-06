import type { Request, Response } from 'express'
import { z } from 'zod'
import { generateSchemaName, uuidToLockKey, type SchemaChange, type SchemaSnapshot } from '@universo/schema-ddl'
import type { ApplicationLayoutChange, ApplicationLayoutSyncResolution } from '@universo/types'
import { parseWorkspaceModePolicy, resolveWorkspaceModeDecision, WorkspacePolicyError, type DbExecutor } from '@universo/utils'
import { ensureApplicationAccess, type ApplicationRole } from '../routes/guards'
import { findApplicationCopySource } from '../persistence/applicationsStore'
import {
    findFirstConnectorByApplicationId,
    findFirstConnectorPublicationLinkByConnectorId,
    updateConnectorPublicationSchemaOptions
} from '../persistence/connectorsStore'
import type { LoadPublishedApplicationSyncContext } from '../services/applicationSyncContracts'
import { extractInstalledReleaseVersion, type ApplicationReleaseBundle } from '../services/applicationReleaseBundle'
import { acquireApplicationSyncAdvisoryLock, getApplicationSyncDdlServices, releaseApplicationSyncAdvisoryLock } from '../ddl'
import { resolveUserId } from '../shared/runtimeHelpers'
import {
    applicationReleaseBundleSchema,
    buildApplicationLayoutChanges,
    buildApplicationSyncSourceFromBundle,
    buildApplicationSyncSourceFromPublication,
    buildCreateTableDetails,
    createExistingApplicationReleaseBundle,
    createPublicationApplicationReleaseBundle,
    hasDashboardLayoutConfigChanges,
    hasPublishedLayoutsChanges,
    hasPublishedWidgetsChanges,
    mapStructuredChange,
    syncApplicationSchemaFromSource,
    UI_LAYOUT_DIFF_MARKER,
    UI_LAYOUTS_DIFF_MARKER,
    UI_LAYOUT_ZONES_DIFF_MARKER,
    SYSTEM_METADATA_DIFF_MARKER,
    type DiffStructuredChange
} from '../routes/applicationSyncRoutes'

const ADMIN_ROLES: ApplicationRole[] = ['owner', 'admin']
const SAFE_BULK_LAYOUT_RESOLUTIONS = new Set<ApplicationLayoutSyncResolution>(['keep_local', 'copy_source_as_application', 'skip_source'])
const WORKSPACE_INSTALLED_SCHEMA_STATUSES = new Set<string>(['synced', 'outdated', 'update_available', 'maintenance', 'error'])

const requiresExplicitLayoutResolution = (change: ApplicationLayoutChange): boolean =>
    change.type === 'LAYOUT_CONFLICT' || change.type === 'LAYOUT_DEFAULT_COLLISION' || change.type === 'LAYOUT_SOURCE_REMOVED'

const buildLayoutResolutionResponse = (layoutChanges: ApplicationLayoutChange[]) => ({
    error: 'APPLICATION_LAYOUT_RESOLUTION_REQUIRED',
    message: 'Layout conflicts require explicit resolution before sync can continue.',
    diff: {
        layoutChanges
    }
})

const buildStaleLayoutDiffResponse = (layoutChanges: ApplicationLayoutChange[]) => ({
    error: 'APPLICATION_LAYOUT_STALE_DIFF',
    message: 'The layout diff changed since it was last reviewed. Refresh and confirm the current resolutions before syncing.',
    diff: {
        layoutChanges
    }
})

const connectorSchemaOptionsSchema = z
    .object({
        workspaceModeRequested: z.enum(['enabled', 'not_requested']).nullable().optional(),
        acknowledgedIrreversibleWorkspaceEnablementAt: z.string().datetime().optional(),
        acknowledgeIrreversibleWorkspaceEnablement: z.boolean().optional()
    })
    .strict()

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const normalizeConnectorSchemaOptions = (
    storedOptions: unknown,
    requestedOptions: unknown
): {
    options: Record<string, unknown>
    workspaceModeRequested: boolean | null
    acknowledgementReceived: boolean
} => {
    const stored = isRecord(storedOptions) ? storedOptions : {}
    const parsedRequest = requestedOptions === undefined ? null : connectorSchemaOptionsSchema.parse(requestedOptions)
    const merged: Record<string, unknown> = {
        ...stored,
        ...(parsedRequest ?? {})
    }

    if (parsedRequest?.acknowledgeIrreversibleWorkspaceEnablement === true && !merged.acknowledgedIrreversibleWorkspaceEnablementAt) {
        merged.acknowledgedIrreversibleWorkspaceEnablementAt = new Date().toISOString()
    }
    delete merged.acknowledgeIrreversibleWorkspaceEnablement

    const rawRequested = merged.workspaceModeRequested
    const workspaceModeRequested = rawRequested === 'enabled' ? true : rawRequested === 'not_requested' ? false : null
    const acknowledgementReceived = typeof merged.acknowledgedIrreversibleWorkspaceEnablementAt === 'string'

    return { options: merged, workspaceModeRequested, acknowledgementReceived }
}

const resolveWorkspaceRequestedLabel = (requested: boolean | null): 'enabled' | 'not_requested' | null =>
    requested === true ? 'enabled' : requested === false ? 'not_requested' : null

const isAppliedSyncResult = (result: { statusCode: number; body?: unknown }): boolean => {
    if (result.statusCode < 200 || result.statusCode >= 300 || !isRecord(result.body)) {
        return false
    }

    return result.body.status !== 'pending_confirmation' && result.body.status !== 'error'
}

const buildWorkspaceModePreview = ({
    policy,
    requested,
    applicationWorkspacesEnabled,
    schemaAlreadyInstalled,
    acknowledgementReceived
}: {
    policy: ReturnType<typeof parseWorkspaceModePolicy>
    requested: boolean | null
    applicationWorkspacesEnabled: boolean
    schemaAlreadyInstalled: boolean
    acknowledgementReceived: boolean
}) => {
    const enablingWorkspaces = !applicationWorkspacesEnabled && (policy === 'required' || (policy === 'optional' && requested === true))
    const effectiveWorkspacesEnabled =
        applicationWorkspacesEnabled || policy === 'required' || (policy === 'optional' && requested === true)

    return {
        policy,
        requested: resolveWorkspaceRequestedLabel(requested),
        applicationWorkspacesEnabled,
        effectiveWorkspacesEnabled,
        schemaAlreadyInstalled,
        requiresAcknowledgement: enablingWorkspaces && !acknowledgementReceived,
        canChoose: policy === 'optional' && !applicationWorkspacesEnabled
    }
}

export function createSyncController(
    getDbExecutor: () => DbExecutor,
    loadPublishedApplicationSyncContext: LoadPublishedApplicationSyncContext
) {
    return {
        async sync(req: Request, res: Response) {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const exec = getDbExecutor()

            try {
                await ensureApplicationAccess(exec, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const syncSchema = z.object({
                confirmDestructive: z.boolean().optional().default(false),
                layoutResolutionPolicy: z
                    .object({
                        default: z.enum(['overwrite_local', 'keep_local', 'copy_source_as_application', 'skip_source']).optional(),
                        bySourceLayoutId: z
                            .record(z.enum(['overwrite_local', 'keep_local', 'copy_source_as_application', 'skip_source']))
                            .optional()
                    })
                    .optional(),
                schemaOptions: connectorSchemaOptionsSchema.optional()
            })
            const parsed = syncSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }
            const { confirmDestructive } = parsed.data

            const lockKey = uuidToLockKey(`app-sync:${applicationId}`)
            const lockAcquired = await acquireApplicationSyncAdvisoryLock(lockKey)
            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Sync already in progress',
                    message: 'Another sync operation is already running for this application. Please try again later.'
                })
            }

            try {
                const application = await findApplicationCopySource(exec, applicationId)
                if (!application) {
                    return res.status(404).json({ error: 'Application not found' })
                }

                const connector = await findFirstConnectorByApplicationId(exec, applicationId)
                if (!connector) {
                    return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
                }

                const connectorPublication = await findFirstConnectorPublicationLinkByConnectorId(exec, connector.id)
                if (!connectorPublication) {
                    return res.status(400).json({ error: 'Connector is not linked to any Publication. Link a Publication first.' })
                }

                const syncContext = await loadPublishedApplicationSyncContext(exec, connectorPublication.publicationId)
                if (!syncContext) {
                    return res.status(400).json({
                        error: 'Publication sync context unavailable',
                        message: 'Linked publication must exist and have a valid active version to sync.'
                    })
                }

                const {
                    publicationId,
                    publicationVersionId,
                    snapshotHash,
                    snapshot,
                    entities: catalogDefs,
                    publicationSnapshot
                } = syncContext
                if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                    return res.status(400).json({ error: 'Invalid publication snapshot' })
                }

                const connectorSchemaOptions = normalizeConnectorSchemaOptions(
                    connectorPublication.schemaOptions,
                    parsed.data.schemaOptions
                )
                const schemaAlreadyInstalled =
                    application.schemaSnapshot != null ||
                    (typeof application.schemaStatus === 'string' && WORKSPACE_INSTALLED_SCHEMA_STATUSES.has(application.schemaStatus))

                let policy
                let effectiveWorkspacesEnabled: boolean
                try {
                    policy = parseWorkspaceModePolicy(isRecord(snapshot.runtimePolicy) ? snapshot.runtimePolicy.workspaceMode : undefined)
                    effectiveWorkspacesEnabled = resolveWorkspaceModeDecision({
                        policy,
                        requested: connectorSchemaOptions.workspaceModeRequested,
                        applicationAlreadyEnabled: application.workspacesEnabled === true,
                        schemaAlreadyInstalled,
                        acknowledgementReceived: connectorSchemaOptions.acknowledgementReceived
                    })
                } catch (error) {
                    if (error instanceof WorkspacePolicyError) {
                        return res.status(409).json({
                            error: error.code,
                            message: error.message,
                            runtimePolicy: { workspaceMode: policy }
                        })
                    }
                    throw error
                }

                const applicationForSync = {
                    ...application,
                    workspacesEnabled: effectiveWorkspacesEnabled
                }

                if (application.schemaName) {
                    const layoutChanges = await buildApplicationLayoutChanges({
                        schemaName: application.schemaName,
                        snapshot
                    })
                    const requiredLayoutChanges = layoutChanges.filter(requiresExplicitLayoutResolution)
                    const defaultResolution = parsed.data.layoutResolutionPolicy?.default
                    const perLayoutResolution = parsed.data.layoutResolutionPolicy?.bySourceLayoutId ?? {}

                    if (requiredLayoutChanges.length > 0) {
                        if (defaultResolution === 'overwrite_local') {
                            return res.status(400).json({
                                error: 'APPLICATION_LAYOUT_INVALID_DEFAULT_RESOLUTION',
                                message: 'overwrite_local is allowed only as an explicit per-layout override.',
                                diff: {
                                    layoutChanges
                                }
                            })
                        }

                        const requiredSourceIds = new Set(
                            requiredLayoutChanges.map((change) => change.sourceLayoutId).filter((value): value is string => Boolean(value))
                        )
                        const staleResolutionIds = Object.keys(perLayoutResolution).filter(
                            (sourceLayoutId) => !requiredSourceIds.has(sourceLayoutId)
                        )
                        if (staleResolutionIds.length > 0) {
                            return res.status(409).json(buildStaleLayoutDiffResponse(layoutChanges))
                        }

                        const missingResolutions = requiredLayoutChanges.filter((change) => {
                            const sourceLayoutId = change.sourceLayoutId ?? ''
                            return !perLayoutResolution[sourceLayoutId] && !defaultResolution
                        })
                        if (missingResolutions.length > 0) {
                            return res.status(409).json(buildLayoutResolutionResponse(layoutChanges))
                        }

                        if (defaultResolution && !SAFE_BULK_LAYOUT_RESOLUTIONS.has(defaultResolution)) {
                            return res.status(400).json({
                                error: 'APPLICATION_LAYOUT_INVALID_DEFAULT_RESOLUTION',
                                message:
                                    'Only keep_local, copy_source_as_application, or skip_source can be used as bulk layout resolutions.',
                                diff: {
                                    layoutChanges
                                }
                            })
                        }
                    }
                }

                const source = buildApplicationSyncSourceFromPublication({
                    application: applicationForSync,
                    syncContext: {
                        publicationId,
                        publicationVersionId,
                        snapshotHash,
                        snapshot,
                        entities: catalogDefs,
                        publicationSnapshot
                    }
                })
                const result = await syncApplicationSchemaFromSource({
                    application: applicationForSync,
                    exec,
                    userId,
                    confirmDestructive,
                    connectorId: connector.id,
                    source,
                    layoutResolutionPolicy: parsed.data.layoutResolutionPolicy
                })

                if (isAppliedSyncResult(result) && parsed.data.schemaOptions !== undefined) {
                    await updateConnectorPublicationSchemaOptions(exec, {
                        connectorId: connector.id,
                        linkId: connectorPublication.id,
                        schemaOptions: connectorSchemaOptions.options,
                        userId
                    })
                }

                return res.status(result.statusCode).json(result.body)
            } finally {
                await releaseApplicationSyncAdvisoryLock(lockKey)
            }
        },

        async getReleaseBundle(req: Request, res: Response) {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const exec = getDbExecutor()

            try {
                await ensureApplicationAccess(exec, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const application = await findApplicationCopySource(exec, applicationId)
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            const exportQuery = z.object({
                source: z.enum(['publication', 'application']).optional()
            })
            const parsedQuery = exportQuery.safeParse(req.query)
            if (!parsedQuery.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsedQuery.error.flatten() })
            }

            const requestedSource = parsedQuery.data.source

            let connector = null as Awaited<ReturnType<typeof findFirstConnectorByApplicationId>> | null
            let connectorPublication = null as Awaited<ReturnType<typeof findFirstConnectorPublicationLinkByConnectorId>> | null

            if (requestedSource !== 'application') {
                connector = await findFirstConnectorByApplicationId(exec, applicationId)
                connectorPublication = connector ? await findFirstConnectorPublicationLinkByConnectorId(exec, connector.id) : null

                if (connector && connectorPublication) {
                    const syncContext = await loadPublishedApplicationSyncContext(exec, connectorPublication.publicationId)
                    if (syncContext) {
                        const bundle = createPublicationApplicationReleaseBundle({
                            application,
                            syncContext
                        })

                        return res.json({ bundle })
                    }

                    if (requestedSource === 'publication') {
                        return res.status(400).json({
                            error: 'Publication sync context unavailable',
                            message: 'Linked publication must exist and have a valid active version to sync.'
                        })
                    }
                } else if (requestedSource === 'publication') {
                    if (!connector) {
                        return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
                    }

                    return res.status(400).json({
                        error: 'Connector is not linked to any Publication. Link a Publication first.'
                    })
                }
            }

            try {
                const bundle = await createExistingApplicationReleaseBundle({
                    exec,
                    application
                })

                return res.json({ bundle })
            } catch (error) {
                if (requestedSource === 'application') {
                    const message = error instanceof Error ? error.message : 'Application runtime export is unavailable.'
                    return res.status(400).json({ error: 'Application runtime export unavailable', message })
                }
            }

            if (!connector) {
                return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
            }

            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector is not linked to any Publication. Link a Publication first.' })
            }

            const syncContext = await loadPublishedApplicationSyncContext(exec, connectorPublication.publicationId)
            if (!syncContext) {
                return res.status(400).json({
                    error: 'Publication sync context unavailable',
                    message: 'Linked publication must exist and have a valid active version to sync.'
                })
            }

            const bundle = createPublicationApplicationReleaseBundle({
                application,
                syncContext
            })

            return res.json({ bundle })
        },

        async applyReleaseBundle(req: Request, res: Response) {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const exec = getDbExecutor()

            try {
                await ensureApplicationAccess(exec, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const applySchema = z.object({
                confirmDestructive: z.boolean().optional().default(false),
                bundle: applicationReleaseBundleSchema
            })
            const parsed = applySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const lockKey = uuidToLockKey(`app-sync:${applicationId}`)
            const lockAcquired = await acquireApplicationSyncAdvisoryLock(lockKey)
            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Sync already in progress',
                    message: 'Another sync operation is already running for this application. Please try again later.'
                })
            }

            try {
                const application = await findApplicationCopySource(exec, applicationId)
                if (!application) {
                    return res.status(404).json({ error: 'Application not found' })
                }

                const connector = await findFirstConnectorByApplicationId(exec, applicationId)
                const currentInstalledReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
                const expectedFromVersion = parsed.data.bundle.incrementalMigration.fromVersion ?? null

                if (currentInstalledReleaseVersion && currentInstalledReleaseVersion !== expectedFromVersion) {
                    return res.status(409).json({
                        error: 'Release version mismatch',
                        message: `Bundle expects installed release ${
                            expectedFromVersion ?? 'null'
                        }, but application currently has ${currentInstalledReleaseVersion}.`
                    })
                }

                if (!currentInstalledReleaseVersion && expectedFromVersion && application.schemaName) {
                    return res.status(409).json({
                        error: 'Release version mismatch',
                        message:
                            'Bundle expects an existing installed release, but the target application has no tracked installed_release_metadata.'
                    })
                }

                if (!currentInstalledReleaseVersion && !expectedFromVersion && application.schemaName) {
                    return res.status(409).json({
                        error: 'Release version mismatch',
                        message:
                            'Bundle install is ambiguous for an existing schema without tracked installed_release_metadata. Resync from the publication source or initialize release metadata before applying a baseline bundle.'
                    })
                }

                let source: ReturnType<typeof buildApplicationSyncSourceFromBundle>
                try {
                    source = buildApplicationSyncSourceFromBundle(parsed.data.bundle as unknown as ApplicationReleaseBundle)
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Release bundle artifact validation failed'
                    return res.status(400).json({
                        error: 'Invalid release bundle',
                        message
                    })
                }
                const result = await syncApplicationSchemaFromSource({
                    application,
                    exec,
                    userId,
                    confirmDestructive: parsed.data.confirmDestructive,
                    connectorId: connector?.id ?? null,
                    source
                })

                return res.status(result.statusCode).json(result.body)
            } finally {
                await releaseApplicationSyncAdvisoryLock(lockKey)
            }
        },

        async getDiff(req: Request, res: Response) {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const exec = getDbExecutor()

            try {
                await ensureApplicationAccess(exec, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const application = await findApplicationCopySource(exec, applicationId)
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            const connector = await findFirstConnectorByApplicationId(exec, applicationId)
            if (!connector) {
                return res.status(400).json({ error: 'No connector found' })
            }

            const connectorPublication = await findFirstConnectorPublicationLinkByConnectorId(exec, connector.id)
            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector not linked to Publication' })
            }

            const syncContext = await loadPublishedApplicationSyncContext(exec, connectorPublication.publicationId)
            if (!syncContext) {
                return res.status(400).json({
                    error: 'Publication sync context unavailable',
                    message: 'Linked publication must exist and have a valid active version to sync.'
                })
            }

            const { snapshot, snapshotHash, entities: executableCatalogDefs } = syncContext
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }

            const connectorSchemaOptions = normalizeConnectorSchemaOptions(connectorPublication.schemaOptions, undefined)
            const schemaAlreadyInstalled =
                application.schemaSnapshot != null ||
                (typeof application.schemaStatus === 'string' && WORKSPACE_INSTALLED_SCHEMA_STATUSES.has(application.schemaStatus))
            const workspacePolicy = parseWorkspaceModePolicy(
                isRecord(snapshot.runtimePolicy) ? snapshot.runtimePolicy.workspaceMode : undefined
            )
            const workspaceMode = buildWorkspaceModePreview({
                policy: workspacePolicy,
                requested: connectorSchemaOptions.workspaceModeRequested,
                applicationWorkspacesEnabled: application.workspacesEnabled === true,
                schemaAlreadyInstalled,
                acknowledgementReceived: connectorSchemaOptions.acknowledgementReceived
            })
            const workspaceRuntimePayload = {
                runtimePolicy: { workspaceMode: workspacePolicy },
                schemaOptions: connectorSchemaOptions.options,
                workspaceMode
            }

            const { generator, migrator, migrationManager } = getApplicationSyncDdlServices()

            const schemaName = application.schemaName || generateSchemaName(application.id)
            const schemaExists = await generator.schemaExists(schemaName)

            if (!schemaExists) {
                const createTables = buildCreateTableDetails({ entities: executableCatalogDefs, snapshot })

                const additive = createTables.map((t) => `Create table "${t.codename}" with ${t.fields.length} field(s)`)

                return res.json({
                    ...workspaceRuntimePayload,
                    schemaExists: false,
                    schemaName,
                    diff: {
                        hasChanges: true,
                        hasDestructiveChanges: false,
                        additive,
                        destructive: [],
                        summaryKey: 'schema.create.summary',
                        summaryParams: { tablesCount: createTables.length },
                        summary: `Create ${createTables.length} table(s) in new schema`,
                        details: {
                            create: {
                                tables: createTables
                            },
                            changes: {
                                additive: additive.map((description) => ({
                                    type: 'CREATE_TABLE',
                                    description
                                })),
                                destructive: []
                            }
                        }
                    },
                    messageKey: 'schema.create.message',
                    message: 'Schema does not exist yet. These tables will be created.'
                })
            }

            const latestMigration = await migrationManager.getLatestMigration(schemaName)
            const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
            const layoutChanges = await buildApplicationLayoutChanges({ schemaName, snapshot })
            if (lastAppliedHash && snapshotHash && lastAppliedHash === snapshotHash) {
                const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName, snapshot })
                const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName, snapshot })
                const widgetsNeedUpdate = await hasPublishedWidgetsChanges({ schemaName, snapshot })
                const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate || layoutChanges.length > 0
                return res.json({
                    ...workspaceRuntimePayload,
                    schemaExists: true,
                    schemaName,
                    diff: {
                        hasChanges: hasUiChanges,
                        hasDestructiveChanges: false,
                        additive: [
                            ...(uiNeedsUpdate ? [UI_LAYOUT_DIFF_MARKER] : []),
                            ...(layoutsNeedUpdate ? [UI_LAYOUTS_DIFF_MARKER] : []),
                            ...(widgetsNeedUpdate ? [UI_LAYOUT_ZONES_DIFF_MARKER] : [])
                        ],
                        destructive: [],
                        summaryKey: hasUiChanges ? 'ui.layout.changed' : 'schema.upToDate',
                        summary: hasUiChanges ? 'UI layout settings have changed' : 'Schema is already up to date',
                        details: {
                            layoutChanges
                        }
                    }
                })
            }

            const oldSnapshot = application.schemaSnapshot as SchemaSnapshot | null
            const diff = migrator.calculateDiff(oldSnapshot, executableCatalogDefs)
            const hasDestructiveChanges = diff.destructive.length > 0

            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName, snapshot })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName, snapshot })
            const widgetsNeedUpdate = await hasPublishedWidgetsChanges({ schemaName, snapshot })
            const addedTableEntityIds = new Set<string>(
                diff.additive
                    .filter((change: SchemaChange) => change.type === 'ADD_TABLE' && Boolean(change.entityId))
                    .map((change: SchemaChange) => String(change.entityId))
            )
            const createTables = buildCreateTableDetails({
                entities: executableCatalogDefs,
                snapshot,
                includeEntityIds: addedTableEntityIds
            })
            const additive = diff.additive.map((c: SchemaChange) => c.description)
            if (uiNeedsUpdate) {
                additive.push(UI_LAYOUT_DIFF_MARKER)
            }
            if (layoutsNeedUpdate) {
                additive.push(UI_LAYOUTS_DIFF_MARKER)
            }
            if (widgetsNeedUpdate) {
                additive.push(UI_LAYOUT_ZONES_DIFF_MARKER)
            }
            const systemMetadataNeedsUpdate =
                Boolean(snapshotHash && lastAppliedHash && snapshotHash !== lastAppliedHash) &&
                !diff.hasChanges &&
                !uiNeedsUpdate &&
                !layoutsNeedUpdate &&
                !widgetsNeedUpdate
            if (systemMetadataNeedsUpdate) {
                additive.push(SYSTEM_METADATA_DIFF_MARKER)
            }

            const additiveStructured: DiffStructuredChange[] = diff.additive.map((c: SchemaChange) => mapStructuredChange(c))
            if (uiNeedsUpdate) {
                additiveStructured.push({
                    type: 'UI_LAYOUT_UPDATE',
                    description: UI_LAYOUT_DIFF_MARKER
                })
            }
            if (layoutsNeedUpdate) {
                additiveStructured.push({
                    type: 'UI_LAYOUTS_UPDATE',
                    description: UI_LAYOUTS_DIFF_MARKER
                })
            }
            if (widgetsNeedUpdate) {
                additiveStructured.push({
                    type: 'UI_LAYOUT_ZONES_UPDATE',
                    description: UI_LAYOUT_ZONES_DIFF_MARKER
                })
            }
            if (systemMetadataNeedsUpdate) {
                additiveStructured.push({
                    type: 'SYSTEM_METADATA_UPDATE',
                    description: SYSTEM_METADATA_DIFF_MARKER
                })
            }

            const destructiveStructured: DiffStructuredChange[] = diff.destructive.map((c: SchemaChange) => mapStructuredChange(c))

            return res.json({
                ...workspaceRuntimePayload,
                schemaExists: true,
                schemaName,
                diff: {
                    hasChanges:
                        diff.hasChanges ||
                        uiNeedsUpdate ||
                        layoutsNeedUpdate ||
                        widgetsNeedUpdate ||
                        systemMetadataNeedsUpdate ||
                        layoutChanges.length > 0,
                    hasDestructiveChanges,
                    additive,
                    destructive: diff.destructive.map((c: SchemaChange) => c.description),
                    summaryKey: systemMetadataNeedsUpdate
                        ? 'schema.metadata.changed'
                        : !diff.hasChanges && (uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate)
                        ? 'ui.layout.changed'
                        : undefined,
                    summary: systemMetadataNeedsUpdate
                        ? 'System metadata will be updated'
                        : !diff.hasChanges && (uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate)
                        ? 'UI layout settings have changed'
                        : diff.summary,
                    details: {
                        create: {
                            tables: createTables
                        },
                        layoutChanges,
                        changes: {
                            additive: additiveStructured,
                            destructive: destructiveStructured
                        }
                    }
                }
            })
        }
    }
}
