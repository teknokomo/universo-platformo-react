/**
 * Application Schema Sync Routes
 *
 * These routes handle schema creation, synchronization and diff calculation
 * for Applications. They use the Application → Connector → ConnectorPublication → Publication
 * chain to determine the structure.
 */

import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { Application, Connector, ConnectorPublication, ApplicationSchemaStatus } from '@universo/applications-backend'
import { Publication } from '../../../database/entities/Publication'
import { PublicationVersion } from '../../../database/entities/PublicationVersion'
import { SnapshotSerializer, MetahubSnapshot } from '../../publications/services/SnapshotSerializer'
import { getDDLServices, generateSchemaName, generateTableName, generateColumnName, KnexClient } from '../../ddl'
import type { SchemaSnapshot, SchemaChange, EntityDefinition } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'

interface RequestUser {
    id?: string
    sub?: string
}

const resolveUserId = (req: Request): string | undefined => {
    const user = req.user as RequestUser | undefined
    return user?.id ?? user?.sub
}

const asyncHandler = (
    fn: (req: Request, res: Response) => Promise<Response | void>
): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
}

async function ensureApplicationAccess(
    ds: DataSource,
    userId: string,
    applicationId: string,
    allowedRoles: string[]
): Promise<void> {
    const result = await ds.query(
        `SELECT role FROM applications.applications_users 
         WHERE application_id = $1 AND user_id = $2`,
        [applicationId, userId]
    )

    const error = new Error('Access denied')
        ; (error as NodeJS.ErrnoException).code = 'FORBIDDEN'

    if (result.length === 0) {
        throw error
    }

    if (result.length > 1) {
        console.warn(`Multiple roles found for user ${userId} in application ${applicationId}`)
    }

    if (!allowedRoles.includes(result[0].role)) {
        throw error
    }
}

async function seedPredefinedElements(
    schemaName: string,
    snapshot: MetahubSnapshot,
    entities: EntityDefinition[],
    userId?: string | null
): Promise<string[]> {
    if (!snapshot.elements || Object.keys(snapshot.elements).length === 0) {
        return []
    }

    const entityMap = new Map<string, EntityDefinition>(entities.map((entity) => [entity.id, entity]))
    const knex = KnexClient.getInstance()
    const now = new Date()
    const warnings: string[] = []

    await knex.transaction(async (trx) => {
        for (const [objectId, elements] of Object.entries(snapshot.elements ?? {})) {
            if (!elements || elements.length === 0) continue

            const entity = entityMap.get(objectId)
            if (!entity) continue

            const tableName = generateTableName(entity.id, entity.kind)
            const columnByCodename = new Map<string, string>(
                entity.fields.map((field) => [field.codename, generateColumnName(field.id)])
            )
            const dataColumns = Array.from(columnByCodename.values())

            const rows = elements.map((element) => {
                const data = element.data ?? {}
                const missingRequired = entity.fields
                    .filter((field) => field.isRequired)
                    .filter((field) => {
                        if (!Object.prototype.hasOwnProperty.call(data, field.codename)) return true
                        const value = (data as Record<string, unknown>)[field.codename]
                        return value === null || value === undefined
                    })

                if (missingRequired.length > 0) {
                    const message = `[SchemaSync] Skipping predefined element ${element.id} for ${tableName} ` +
                        `due to missing required fields: ${missingRequired.map((f) => f.codename).join(', ')}`
                    console.warn(message)
                    warnings.push(message)
                    return null
                }

                const row: Record<string, unknown> = {
                    id: element.id,
                    _upl_created_at: now,
                    _upl_created_by: userId ?? null,
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null,
                }

                for (const [codename, columnName] of columnByCodename.entries()) {
                    if (Object.prototype.hasOwnProperty.call(data, codename)) {
                        row[columnName] = (data as Record<string, unknown>)[codename]
                    } else {
                        row[columnName] = null
                    }
                }

                return row
            })

            const validRows = rows.filter((row): row is Record<string, unknown> => row !== null)
            if (validRows.length === 0) continue

            const mergeColumns = ['_upl_updated_at', '_upl_updated_by', ...dataColumns]
            await trx.withSchema(schemaName).table(tableName).insert(validRows).onConflict('id').merge(mergeColumns)
        }
    })

    return warnings
}

async function persistSeedWarnings(
    schemaName: string,
    migrationManager: ReturnType<typeof getDDLServices>['migrationManager'],
    warnings: string[]
): Promise<void> {
    if (warnings.length === 0) return

    const latestMigration = await migrationManager.getLatestMigration(schemaName)
    if (!latestMigration) return

    const existing = Array.isArray(latestMigration.meta.seedWarnings) ? latestMigration.meta.seedWarnings : []
    const mergedWarnings = [...existing, ...warnings]

    const updatedMeta = {
        ...latestMigration.meta,
        seedWarnings: mergedWarnings
    }

    await KnexClient.getInstance()
        .withSchema(schemaName)
        .table('_app_migrations')
        .where({ id: latestMigration.id })
        .update({ meta: JSON.stringify(updatedMeta) })
}

export function createApplicationSyncRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router()

    // ════════════════════════════════════════════════════════════════════
    // POST /application/:applicationId/sync - Create or update schema
    // ════════════════════════════════════════════════════════════════════
    router.post(
        '/application/:applicationId/sync',
        ensureAuth,
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getDataSource()

            // Check access
            try {
                await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'FORBIDDEN') {
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

            const applicationRepo = ds.getRepository(Application)
            const application = await applicationRepo.findOneBy({ id: applicationId })
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            const connectorRepo = ds.getRepository(Connector)
            const connector = await connectorRepo.findOne({
                where: { applicationId }
            })
            if (!connector) {
                return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
            }

            const connectorPublicationRepo = ds.getRepository(ConnectorPublication)
            const connectorPublication = await connectorPublicationRepo.findOne({
                where: { connectorId: connector.id }
            })
            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector is not linked to any Publication. Link a Publication first.' })
            }

            const publicationRepo = ds.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: connectorPublication.publicationId })
            if (!publication) {
                return res.status(400).json({ error: 'Linked publication not found' })
            }

            if (!publication.activeVersionId) {
                return res.status(400).json({
                    error: 'No active version found',
                    message: 'Publication must have an active version to sync. Please create and activate a version in Metahub.'
                })
            }

            const versionRepo = ds.getRepository(PublicationVersion)
            const activeVersion = await versionRepo.findOneBy({ id: publication.activeVersionId })
            if (!activeVersion) {
                return res.status(404).json({ error: 'Active version data not found' })
            }

            const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }

            // Init services for serializer
            const schemaService = new MetahubSchemaService(ds)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            // hubRepo removed - hubs are now in isolated schemas

            const serializer = new SnapshotSerializer(objectsService, attributesService)
            const catalogDefs = serializer.deserializeSnapshot(snapshot)
            const snapshotHash = activeVersion.snapshotHash || serializer.calculateHash(snapshot)

            const { generator, migrator, migrationManager } = getDDLServices()

            if (!application.schemaName) {
                application.schemaName = generateSchemaName(application.id)
                await applicationRepo.save(application)
            }

            const schemaExists = await generator.schemaExists(application.schemaName)
            const publicationSnapshot = snapshot as unknown as Record<string, unknown>
            const migrationMeta = {
                publicationSnapshotHash: snapshotHash,
                publicationId: publication.id,
                publicationVersionId: activeVersion.id
            }

            if (schemaExists) {
                const latestMigration = await migrationManager.getLatestMigration(application.schemaName)
                const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
                if (lastAppliedHash && snapshotHash && lastAppliedHash === snapshotHash) {
                    application.schemaStatus = ApplicationSchemaStatus.SYNCED
                    application.schemaError = null
                    application.schemaSyncedAt = new Date()
                    await applicationRepo.save(application)

                    return res.json({
                        status: 'no_changes',
                        message: 'Schema is already up to date'
                    })
                }
            }

            application.schemaStatus = ApplicationSchemaStatus.PENDING
            await applicationRepo.save(application)

            try {
                if (!schemaExists) {
                    const result = await generator.generateFullSchema(application.schemaName!, catalogDefs, {
                        recordMigration: true,
                        migrationDescription: 'initial_schema',
                        migrationManager,
                        migrationMeta,
                        publicationSnapshot,
                        userId
                    })

                    if (!result.success) {
                        application.schemaStatus = ApplicationSchemaStatus.ERROR
                        application.schemaError = result.errors.join('; ')
                        await applicationRepo.save(application)

                        return res.status(500).json({
                            status: 'error',
                            message: 'Schema creation failed',
                            errors: result.errors
                        })
                    }

                    const schemaSnapshot = generator.generateSnapshot(catalogDefs)
                    application.schemaStatus = ApplicationSchemaStatus.SYNCED
                    application.schemaError = null
                    application.schemaSyncedAt = new Date()
                    application.schemaSnapshot = schemaSnapshot as unknown as Record<string, unknown>
                    await applicationRepo.save(application)

                    const seedWarnings = await seedPredefinedElements(application.schemaName!, snapshot, catalogDefs, userId)
                    await persistSeedWarnings(application.schemaName!, migrationManager, seedWarnings)

                    return res.json({
                        status: 'created',
                        schemaName: result.schemaName,
                        tablesCreated: result.tablesCreated,
                        message: `Schema created with ${result.tablesCreated.length} table(s)`,
                        ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                    })
                }

                const oldSnapshot = application.schemaSnapshot as SchemaSnapshot | null
                const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)
                const hasDestructiveChanges = diff.destructive.length > 0

                if (!diff.hasChanges) {
                    await generator.syncSystemMetadata(application.schemaName!, catalogDefs, { userId })

                    application.schemaStatus = ApplicationSchemaStatus.SYNCED
                    application.schemaError = null
                    await applicationRepo.save(application)

                    return res.json({
                        status: 'no_changes',
                        message: 'Schema is already up to date'
                    })
                }

                if (hasDestructiveChanges && !confirmDestructive) {
                    application.schemaStatus = ApplicationSchemaStatus.OUTDATED
                    await applicationRepo.save(application)

                    return res.json({
                        status: 'pending_confirmation',
                        diff: {
                            hasChanges: diff.hasChanges,
                            hasDestructiveChanges,
                            additive: diff.additive.map((c: SchemaChange) => c.description),
                            destructive: diff.destructive.map((c: SchemaChange) => c.description),
                            summary: diff.summary
                        },
                        message: 'Destructive changes detected. Set confirmDestructive=true to proceed.'
                    })
                }

                const migrationResult = await migrator.applyAllChanges(
                    application.schemaName!,
                    diff,
                    catalogDefs,
                    confirmDestructive,
                    { recordMigration: true, migrationDescription: 'schema_sync', migrationMeta, publicationSnapshot, userId }
                )

                if (!migrationResult.success) {
                    application.schemaStatus = ApplicationSchemaStatus.ERROR
                    application.schemaError = migrationResult.errors.join('; ')
                    await applicationRepo.save(application)

                    return res.status(500).json({
                        status: 'error',
                        message: 'Schema migration failed',
                        errors: migrationResult.errors
                    })
                }

                const newSnapshot = generator.generateSnapshot(catalogDefs)
                application.schemaStatus = ApplicationSchemaStatus.SYNCED
                application.schemaError = null
                application.schemaSyncedAt = new Date()
                application.schemaSnapshot = newSnapshot as unknown as Record<string, unknown>
                await applicationRepo.save(application)

                const seedWarnings = await seedPredefinedElements(application.schemaName!, snapshot, catalogDefs, userId)
                await persistSeedWarnings(application.schemaName!, migrationManager, seedWarnings)

                return res.json({
                    status: 'migrated',
                    schemaName: application.schemaName,
                    changesApplied: migrationResult.changesApplied,
                    message: 'Schema migration applied successfully',
                    ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                })
            } catch (error) {
                application.schemaStatus = ApplicationSchemaStatus.ERROR
                application.schemaError = error instanceof Error ? error.message : 'Unknown error'
                await applicationRepo.save(application)

                return res.status(500).json({
                    status: 'error',
                    message: 'Schema sync failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        })
    )

    // ════════════════════════════════════════════════════════════════════
    // GET /application/:applicationId/diff - Calculate schema diff
    // ════════════════════════════════════════════════════════════════════
    router.get(
        '/application/:applicationId/diff',
        ensureAuth,
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getDataSource()

            try {
                await ensureApplicationAccess(ds, userId, applicationId, ['member', 'editor', 'admin', 'owner'])
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'FORBIDDEN') {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const applicationRepo = ds.getRepository(Application)
            const application = await applicationRepo.findOneBy({ id: applicationId })
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            const connectorRepo = ds.getRepository(Connector)
            const connector = await connectorRepo.findOne({ where: { applicationId } })
            if (!connector) {
                return res.status(400).json({ error: 'No connector found' })
            }

            const connectorPublicationRepo = ds.getRepository(ConnectorPublication)
            const connectorPublication = await connectorPublicationRepo.findOne({
                where: { connectorId: connector.id }
            })
            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector not linked to Publication' })
            }

            const publicationRepo = ds.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: connectorPublication.publicationId })
            if (!publication) {
                return res.status(400).json({ error: 'Linked publication not found' })
            }

            if (!publication.activeVersionId) {
                return res.status(400).json({
                    error: 'No active version found',
                    message: 'Publication must have an active version to sync.'
                })
            }

            const versionRepo = ds.getRepository(PublicationVersion)
            const activeVersion = await versionRepo.findOneBy({ id: publication.activeVersionId })
            if (!activeVersion) {
                return res.status(404).json({ error: 'Active version data not found' })
            }

            const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }

            const schemaService = new MetahubSchemaService(ds)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            // hubRepo removed - hubs are now in isolated schemas

            const serializer = new SnapshotSerializer(objectsService, attributesService)
            const catalogDefs = serializer.deserializeSnapshot(snapshot)
            const snapshotHash = activeVersion.snapshotHash || serializer.calculateHash(snapshot)

            const { generator, migrator, migrationManager } = getDDLServices()

            const schemaName = application.schemaName || generateSchemaName(application.id)
            const schemaExists = await generator.schemaExists(schemaName)

            if (!schemaExists) {
                const additive = catalogDefs.map((cat) => {
                    const fieldCount = cat.fields?.length ?? 0
                    return `Create table "${cat.codename}" with ${fieldCount} field(s)`
                })

                return res.json({
                    schemaExists: false,
                    schemaName,
                    diff: {
                        hasChanges: true,
                        hasDestructiveChanges: false,
                        additive,
                        destructive: [],
                        summary: `Create ${catalogDefs.length} table(s) in new schema`
                    },
                    message: 'Schema does not exist yet. These tables will be created.'
                })
            }

            const latestMigration = await migrationManager.getLatestMigration(schemaName)
            const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
            if (lastAppliedHash && snapshotHash && lastAppliedHash === snapshotHash) {
                return res.json({
                    schemaExists: true,
                    schemaName,
                    diff: {
                        hasChanges: false,
                        hasDestructiveChanges: false,
                        additive: [],
                        destructive: [],
                        summary: 'Schema is already up to date'
                    }
                })
            }

            const oldSnapshot = application.schemaSnapshot as SchemaSnapshot | null
            const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)
            const hasDestructiveChanges = diff.destructive.length > 0

            return res.json({
                schemaExists: true,
                schemaName,
                diff: {
                    hasChanges: diff.hasChanges,
                    hasDestructiveChanges,
                    additive: diff.additive.map((c: SchemaChange) => c.description),
                    destructive: diff.destructive.map((c: SchemaChange) => c.description),
                    summary: diff.summary
                }
            })
        })
    )

    return router
}
