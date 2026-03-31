import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  generateSchemaName,
  uuidToLockKey,
  type SchemaChange,
  type SchemaSnapshot
} from '@universo/schema-ddl'
import type { DbExecutor } from '@universo/utils'
import { ensureApplicationAccess, type ApplicationRole } from '../routes/guards'
import {
  findApplicationCopySource,
} from '../persistence/applicationsStore'
import {
  findFirstConnectorByApplicationId,
  findFirstConnectorPublicationLinkByConnectorId
} from '../persistence/connectorsStore'
import type { LoadPublishedApplicationSyncContext } from '../services/applicationSyncContracts'
import {
  extractInstalledReleaseVersion,
  type ApplicationReleaseBundle
} from '../services/applicationReleaseBundle'
import { resolveExecutablePayloadEntities } from '../services/publishedApplicationSnapshotEntities'
import {
  acquireApplicationSyncAdvisoryLock,
  getApplicationSyncDdlServices,
  releaseApplicationSyncAdvisoryLock
} from '../ddl'
import { resolveUserId } from '../shared/runtimeHelpers'
import {
  applicationReleaseBundleSchema,
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
        confirmDestructive: z.boolean().optional().default(false)
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
        const source = buildApplicationSyncSourceFromPublication({
          application,
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
          application,
          exec,
          userId,
          confirmDestructive,
          connectorId: connector.id,
          source
        })

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

      const { snapshot, snapshotHash } = syncContext
      if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
        return res.status(400).json({ error: 'Invalid publication snapshot' })
      }
      const executableCatalogDefs = resolveExecutablePayloadEntities(snapshot)

      const { generator, migrator, migrationManager } = getApplicationSyncDdlServices()

      const schemaName = application.schemaName || generateSchemaName(application.id)
      const schemaExists = await generator.schemaExists(schemaName)

      if (!schemaExists) {
        const createTables = buildCreateTableDetails({ entities: executableCatalogDefs, snapshot })

        const additive = createTables.map((t) => `Create table "${t.codename}" with ${t.fields.length} field(s)`)

        return res.json({
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
      if (lastAppliedHash && snapshotHash && lastAppliedHash === snapshotHash) {
        const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName, snapshot })
        const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName, snapshot })
        const widgetsNeedUpdate = await hasPublishedWidgetsChanges({ schemaName, snapshot })
        const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate
        return res.json({
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
            summary: hasUiChanges ? 'UI layout settings have changed' : 'Schema is already up to date'
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
        schemaExists: true,
        schemaName,
        diff: {
          hasChanges: diff.hasChanges || uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate || systemMetadataNeedsUpdate,
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
