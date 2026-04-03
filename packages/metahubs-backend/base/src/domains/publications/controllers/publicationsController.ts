import type { Request, Response } from 'express'
import { z } from 'zod'
import { isManagedDynamicSchemaName, quoteIdentifier } from '@universo/migrations-core'
import { localizedContent, OptimisticLockError, buildSnapshotEnvelope, getCodenamePrimary, validateSnapshotEnvelope } from '@universo/utils'
import { applyRlsContext } from '@universo/auth-backend'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
import { getRequestDbExecutor, type DbExecutor } from '../../../utils'
import { createEnsureMetahubRouteAccess } from '../../shared/guards'
import { resolveUserId } from '../../shared/routeAuth'
import {
  findMetahubById,
  findBranchByIdAndMetahub,
  findPublicationById,
  findPublicationVersionById,
  findTemplateVersionById,
  listPublicationsByMetahub,
  listPublicationVersions,
  createPublication,
  updatePublication,
  createPublicationVersion,
  deactivatePublicationVersions,
  activatePublicationVersion,
  notifyLinkedAppsUpdateAvailable,
  resetLinkedAppsToSynced,
  softDelete,
  type SqlQueryable,
  type AppRow
} from '../../../persistence'
import { SnapshotSerializer, MetahubSnapshot } from '../services/SnapshotSerializer'
import { getDDLServices, generateSchemaName, uuidToLockKey, acquirePoolAdvisoryLock, releasePoolAdvisoryLock } from '../../ddl'
import type { SchemaSnapshot, SchemaDiff } from '../../ddl'
import { createKnexExecutor } from '@universo/database'
import { runPublishedApplicationRuntimeSync, type PublishedApplicationSnapshot } from '@universo/applications-backend'
import { ApplicationSchemaStatus } from '@universo/types'
import type { MetahubSnapshotTransportEnvelope } from '@universo/types'
import { createLinkedApplication } from '../helpers/createLinkedApplication'
import { MetahubValidationError, MetahubNotFoundError, MetahubDomainError, MetahubSchemaSyncError } from '../../shared/domainErrors'
import { TARGET_APP_STRUCTURE_VERSION } from '../../applications/constants'
import { persistApplicationSchemaSyncState } from '../../applications/services/ApplicationSchemaStateStore'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { structureVersionToSemver } from '../../metahubs/services/structureVersions'
import { enrichDefinitionsWithSetConstants } from '../../shared/setConstantRefs'
import { attachLayoutsToSnapshot } from '../../shared/snapshotLayouts'
import { createLogger } from '../../../utils/logger'

const log = createLogger('Publications')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resolveTemplateVersionLabel = async (exec: SqlQueryable, templateVersionId?: string | null): Promise<string | null> => {
  if (!templateVersionId) return null
  const templateVersion = await findTemplateVersionById(exec, templateVersionId)
  return templateVersion?.versionLabel ?? null
}

const activeApplicationRowPredicate = (alias?: string): string => {
  const prefix = alias ? `${alias}.` : ''
  return `COALESCE(${prefix}_upl_deleted, false) = false AND COALESCE(${prefix}_app_deleted, false) = false`
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const resolveBearerAccessToken = (req: Request): string | null => {
  const headerValue = req.headers.authorization ?? req.headers.Authorization
  if (typeof headerValue !== 'string') return null
  return headerValue.startsWith('Bearer ') ? headerValue.slice(7) : null
}

const applyRlsContextToExecutor = async (executor: Pick<DbExecutor, 'query' | 'isReleased'>, accessToken: string): Promise<void> => {
  await applyRlsContext(
    {
      query: executor.query,
      isReleased: executor.isReleased
    },
    accessToken
  )
}

const runCommittedRlsTransaction = async <T>(executor: DbExecutor, accessToken: string, work: (tx: DbExecutor) => Promise<T>): Promise<T> => {
  return executor.transaction(async (tx) => {
    await applyRlsContextToExecutor(tx, accessToken)
    return work(tx)
  })
}

const createRlsAwareTransactionExecutor = async (trx: Parameters<typeof createKnexExecutor>[0], accessToken: string) => {
  const executor = createKnexExecutor(trx)

  await applyRlsContextToExecutor(
    {
      query: executor.query,
      isReleased: () => false
    },
    accessToken
  )

  return executor
}

const assertManagedApplicationSchemaName = (schemaName: string): void => {
  if (!schemaName.startsWith('app_') || !isManagedDynamicSchemaName(schemaName)) {
    throw new MetahubValidationError(`Invalid application schema name: ${schemaName}`)
  }
}

const markCreatedApplicationDeleted = async (
  executor: SqlQueryable,
  input: { applicationId: string; schemaName: string; userId?: string }
): Promise<void> => {
  assertManagedApplicationSchemaName(input.schemaName)
  await executor.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(input.schemaName)} CASCADE`)

  await executor.query(
    `
    UPDATE applications.cat_connectors
    SET _upl_deleted = true,
        _upl_deleted_at = NOW(),
        _upl_deleted_by = $2,
        _upl_updated_at = NOW(),
        _upl_version = COALESCE(_upl_version, 1) + 1
    WHERE application_id = $1
      AND ${activeApplicationRowPredicate()}
    `,
    [input.applicationId, input.userId ?? null]
  )

  await executor.query(
    `
    UPDATE applications.rel_connector_publications cp
    SET _upl_deleted = true,
        _upl_deleted_at = NOW(),
        _upl_deleted_by = $2,
        _upl_updated_at = NOW(),
        _upl_version = COALESCE(cp._upl_version, 1) + 1
    FROM applications.cat_connectors c
    WHERE cp.connector_id = c.id
      AND c.application_id = $1
      AND ${activeApplicationRowPredicate('cp')}
    `,
    [input.applicationId, input.userId ?? null]
  )

  await executor.query(
    `
    UPDATE applications.rel_application_users
    SET _upl_deleted = true,
        _upl_deleted_at = NOW(),
        _upl_deleted_by = $2,
        _upl_updated_at = NOW(),
        _upl_version = COALESCE(_upl_version, 1) + 1
    WHERE application_id = $1
      AND ${activeApplicationRowPredicate()}
    `,
    [input.applicationId, input.userId ?? null]
  )

  await executor.query(
    `
    UPDATE applications.cat_applications
    SET _upl_deleted = true,
        _upl_deleted_at = NOW(),
        _upl_deleted_by = $2,
        _upl_updated_at = NOW(),
        _upl_version = COALESCE(_upl_version, 1) + 1
    WHERE id = $1
      AND ${activeApplicationRowPredicate()}
    `,
    [input.applicationId, input.userId ?? null]
  )
}

const markCreatedPublicationVersionDeleted = async (
  executor: SqlQueryable,
  input: { publicationVersionId: string; userId?: string }
): Promise<void> => {
  const rows = await executor.query<{ id: string }>(
    `
    UPDATE metahubs.doc_publication_versions
    SET _upl_deleted = true,
        _upl_deleted_at = NOW(),
        _upl_deleted_by = $2,
        _app_deleted = true,
        _app_deleted_at = NOW(),
        _app_deleted_by = $2,
        _upl_updated_at = NOW(),
        _upl_version = COALESCE(_upl_version, 1) + 1
    WHERE id = $1
      AND COALESCE(_upl_deleted, false) = false
      AND COALESCE(_app_deleted, false) = false
    RETURNING id
    `,
    [input.publicationVersionId, input.userId ?? null]
  )

  if (rows.length > 0) {
    return
  }

  const existingRows = await executor.query<{ id: string; uplDeleted: boolean | null; appDeleted: boolean | null }>(
    `
    SELECT id,
           _upl_deleted AS "uplDeleted",
           _app_deleted AS "appDeleted"
    FROM metahubs.doc_publication_versions
    WHERE id = $1
    LIMIT 1
    `,
    [input.publicationVersionId]
  )

  const existing = existingRows[0]
  if (existing?.uplDeleted === true && existing?.appDeleted === true) {
    return
  }

  throw new MetahubDomainError({
    message: `Failed to compensate publication version ${input.publicationVersionId}`,
    statusCode: 500,
    code: 'PUBLICATION_COMPENSATION_FAILED'
  })
}

const markCreatedPublicationDeleted = async (
  executor: SqlQueryable,
  input: { publicationId: string; userId?: string }
): Promise<void> => {
  const rows = await executor.query<{ id: string }>(
    `
    UPDATE metahubs.doc_publications
    SET active_version_id = NULL,
        _upl_deleted = true,
        _upl_deleted_at = NOW(),
        _upl_deleted_by = $2,
        _app_deleted = true,
        _app_deleted_at = NOW(),
        _app_deleted_by = $2,
        _upl_updated_at = NOW(),
        _upl_version = COALESCE(_upl_version, 1) + 1
    WHERE id = $1
      AND COALESCE(_upl_deleted, false) = false
      AND COALESCE(_app_deleted, false) = false
    RETURNING id
    `,
    [input.publicationId, input.userId ?? null]
  )

  if (rows.length > 0) {
    return
  }

  const existingRows = await executor.query<{ id: string; uplDeleted: boolean | null; appDeleted: boolean | null }>(
    `
    SELECT id,
           _upl_deleted AS "uplDeleted",
           _app_deleted AS "appDeleted"
    FROM metahubs.doc_publications
    WHERE id = $1
    LIMIT 1
    `,
    [input.publicationId]
  )

  const existing = existingRows[0]
  if (existing?.uplDeleted === true && existing?.appDeleted === true) {
    return
  }

  throw new MetahubDomainError({
    message: `Failed to compensate publication ${input.publicationId}`,
    statusCode: 500,
    code: 'PUBLICATION_COMPENSATION_FAILED'
  })
}

const compensateCreatedApplication = async (
  executor: DbExecutor,
  accessToken: string,
  input: { applicationId: string; schemaName: string; userId?: string }
): Promise<void> => {
  await runCommittedRlsTransaction(executor, accessToken, async (tx) => {
    await markCreatedApplicationDeleted(tx, input)
  })
}

const compensateCreatedPublication = async (
  executor: DbExecutor,
  accessToken: string,
  input: {
    publicationId: string
    publicationVersionId: string
    linkedApplication?: { applicationId: string; schemaName: string } | null
    userId?: string
  }
): Promise<void> => {
  await runCommittedRlsTransaction(executor, accessToken, async (tx) => {
    if (input.linkedApplication) {
      await markCreatedApplicationDeleted(tx, {
        applicationId: input.linkedApplication.applicationId,
        schemaName: input.linkedApplication.schemaName,
        userId: input.userId
      })
    }

    await markCreatedPublicationVersionDeleted(tx, {
      publicationVersionId: input.publicationVersionId,
      userId: input.userId
    })
    await markCreatedPublicationDeleted(tx, {
      publicationId: input.publicationId,
      userId: input.userId
    })
  })
}

const assertSchemaGenerationSucceeded = (result: { success: boolean; errors: string[] }, context: string): void => {
  if (result.success) return
  const errorMessage = result.errors.length > 0 ? result.errors.join('; ') : 'Unknown DDL generation failure'
  throw new MetahubSchemaSyncError(context, new Error(errorMessage))
}

async function notifyLinkedApplicationsUpdateAvailable(
  exec: SqlQueryable,
  publicationId: string,
  newActiveVersionId: string
): Promise<void> {
  try {
    await notifyLinkedAppsUpdateAvailable(exec, publicationId, newActiveVersionId)
  } catch (err) {
    log.warn('Failed to notify linked applications of update:', err)
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))

const createPublicationSchema = z
  .object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    autoCreateApplication: z.boolean().optional().default(false),
    createApplicationSchema: z.boolean().optional().default(false),
    versionName: localizedInputSchema.optional(),
    versionDescription: localizedInputSchema.optional(),
    versionNamePrimaryLocale: z.string().optional(),
    versionDescriptionPrimaryLocale: z.string().optional(),
    versionBranchId: z.string().uuid().optional(),
    applicationName: localizedInputSchema.optional(),
    applicationDescription: localizedInputSchema.optional(),
    applicationNamePrimaryLocale: z.string().optional(),
    applicationDescriptionPrimaryLocale: z.string().optional(),
    applicationIsPublic: z.boolean().optional(),
    applicationWorkspacesEnabled: z.boolean().optional()
  })
  .strict()

const updatePublicationSchema = z
  .object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    expectedVersion: z.number().int().positive().optional()
  })
  .strict()

const createVersionSchema = z
  .object({
    name: localizedInputSchema,
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    branchId: z.string().uuid().optional()
  })
  .strict()

const updateVersionSchema = z
  .object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional().nullable(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional()
  })
  .strict()

const syncSchema = z
  .object({
    confirmDestructive: z.boolean().optional().default(false)
  })
  .strict()

const createApplicationForPublicationSchema = z
  .object({
    name: localizedInputSchema.optional(),
    description: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    createApplicationSchema: z.boolean().optional().default(false),
    isPublic: z.boolean().optional(),
    workspacesEnabled: z.boolean().optional()
  })
  .strict()

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createPublicationsController(getDbExecutor: () => DbExecutor) {
  const ensureMetahubRouteAccess = createEnsureMetahubRouteAccess(getDbExecutor)

  const services = (req: Request) => {
    const exec = getRequestDbExecutor(req, getDbExecutor())
    const schemaService = new MetahubSchemaService(exec)
    const objectsService = new MetahubObjectsService(exec, schemaService)
    const attributesService = new MetahubAttributesService(exec, schemaService)
    const elementsService = new MetahubElementsService(exec, schemaService, objectsService, attributesService)

    return { exec, objectsService, attributesService, elementsService }
  }

  // ─── LIST AVAILABLE ─────────────────────────────────────────────────────────

  const listAvailable = async (req: Request, res: Response) => {
    const userId = resolveUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 100)
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)

    const exec = getRequestDbExecutor(req, getDbExecutor())
    const publications = await exec.query<{
      id: string
      codename: string
      schemaName: string
      name: unknown
      description: unknown
      version: number
      createdAt: Date
      metahubId: string
      metahubCodename: string
      metahubName: unknown
    }>(
      `
      SELECT
          p.id,
          p.schema_name as "codename",
          p.schema_name as "schemaName",
          p.name,
          p.description,
          p._upl_version as "version",
          p._upl_created_at as "createdAt",
          m.id as "metahubId",
          COALESCE(m.codename->'locales'->(m.codename->>'_primary')->>'content', m.codename->'locales'->'en'->>'content', m.slug, m.id::text) as "metahubCodename",
          m.name as "metahubName"
      FROM metahubs.doc_publications p
      JOIN metahubs.cat_metahubs m ON m.id = p.metahub_id
      JOIN metahubs.rel_metahub_users mu ON mu.metahub_id = m.id
      WHERE mu.user_id = $1
        AND COALESCE(p._upl_deleted, false) = false
        AND COALESCE(m._upl_deleted, false) = false
      ORDER BY p._upl_created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    )

    const items = publications.map((pub: any) => ({
      id: pub.id,
      codename: pub.codename,
      schemaName: pub.schemaName,
      name: pub.name,
      description: pub.description,
      version: pub.version || 1,
      createdAt: pub.createdAt,
      metahub: {
        id: pub.metahubId,
        codename: pub.metahubCodename,
        name: pub.metahubName
      }
    }))

    const countResult = await exec.query<{ total: string }>(
      `
      SELECT COUNT(*) as total
      FROM metahubs.doc_publications p
      JOIN metahubs.cat_metahubs m ON m.id = p.metahub_id
      JOIN metahubs.rel_metahub_users mu ON mu.metahub_id = m.id
      WHERE mu.user_id = $1
        AND COALESCE(p._upl_deleted, false) = false
        AND COALESCE(m._upl_deleted, false) = false
      `,
      [userId]
    )

    return res.json({
      items,
      total: parseInt(countResult[0]?.total || '0', 10)
    })
  }

  // ─── LIST BY METAHUB ───────────────────────────────────────────────────────

  const list = async (req: Request, res: Response) => {
    const { metahubId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId)
    if (!userId) return
    const { exec } = services(req)

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const publications = await listPublicationsByMetahub(exec, metahubId)

    const enrichedPublications = publications.map((publication) => ({
      id: publication.id,
      metahubId,
      name: publication.name,
      description: publication.description,
      schemaName: publication.schemaName,
      schemaStatus: publication.schemaStatus,
      schemaError: publication.schemaError,
      schemaSyncedAt: publication.schemaSyncedAt,
      accessMode: publication.accessMode,
      autoCreateApplication: publication.autoCreateApplication,
      activeVersionId: publication.activeVersionId,
      version: publication._uplVersion || 1,
      createdAt: publication._uplCreatedAt,
      updatedAt: publication._uplUpdatedAt
    }))

    return res.json({
      items: enrichedPublications,
      total: enrichedPublications.length
    })
  }

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  const create = async (req: Request, res: Response) => {
    const { metahubId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const accessToken = resolveBearerAccessToken(req)
    if (!accessToken) return res.status(401).json({ error: 'Unauthorized' })
    const rootExec = getDbExecutor()
    const exec = getRequestDbExecutor(req, rootExec)

    const parsed = createPublicationSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten()
      })
    }

    const {
      name,
      description,
      namePrimaryLocale,
      descriptionPrimaryLocale,
      autoCreateApplication,
      createApplicationSchema,
      versionName,
      versionDescription,
      versionNamePrimaryLocale,
      versionDescriptionPrimaryLocale,
      versionBranchId,
      applicationName,
      applicationDescription,
      applicationNamePrimaryLocale,
      applicationDescriptionPrimaryLocale,
      applicationIsPublic,
      applicationWorkspacesEnabled
    } = parsed.data

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const existingCountRows = await exec.query<{ count: number }>(
      `
      SELECT COUNT(*)::int AS count
      FROM metahubs.doc_publications
      WHERE metahub_id = $1
        AND COALESCE(_upl_deleted, false) = false
        AND COALESCE(_app_deleted, false) = false
      `,
      [metahubId]
    )
    if ((existingCountRows[0]?.count ?? 0) > 0) {
      return res.status(400).json({
        error: 'Single publication limit reached',
        message:
          'Currently, only one Publication per Metahub is supported. This restriction will be removed in future versions.'
      })
    }

    const effectiveBranchId = versionBranchId ?? metahub.defaultBranchId ?? null
    if (!effectiveBranchId) {
      return res.status(400).json({ error: 'Default branch is not configured' })
    }
    const branch = await findBranchByIdAndMetahub(exec, effectiveBranchId, metahubId)
    if (!branch) {
      return res.status(400).json({ error: 'Branch not found' })
    }

    const schemaService = new MetahubSchemaService(exec, effectiveBranchId)
    const objectsService = new MetahubObjectsService(exec, schemaService)
    const attributesService = new MetahubAttributesService(exec, schemaService)
    const elementsService = new MetahubElementsService(exec, schemaService, objectsService, attributesService)
    const hubsService = new MetahubHubsService(exec, schemaService)
    const enumerationValuesService = new MetahubEnumerationValuesService(exec, schemaService)
    const constantsService = new MetahubConstantsService(exec, schemaService)
    const serializer = new SnapshotSerializer(
      objectsService,
      attributesService,
      elementsService,
      hubsService,
      enumerationValuesService,
      constantsService
    )
    const templateVersionLabel = await resolveTemplateVersionLabel(exec, metahub.templateVersionId)
    const snapshot = await serializer.serializeMetahub(metahubId, {
      structureVersion: structureVersionToSemver(branch.structureVersion),
      templateVersion: templateVersionLabel
    })

    await attachLayoutsToSnapshot({ schemaService, snapshot, metahubId, userId })
    const snapshotHash = serializer.calculateHash(snapshot)

    const result = await runCommittedRlsTransaction(rootExec, accessToken, async (tx) => {
      const publication = await createPublication(tx, {
        metahubId,
        name: buildLocalizedContent(sanitizeLocalizedInput(name || {}), namePrimaryLocale || 'en')!,
        description: description
          ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
          : undefined,
        autoCreateApplication: autoCreateApplication ?? false,
        userId
      })

      const schemaName = generateSchemaName(publication.id)
      await tx.query('UPDATE metahubs.doc_publications SET schema_name = $1 WHERE id = $2', [schemaName, publication.id])

      let applicationData: { application: AppRow; appSchemaName: string } | null = null
      if (autoCreateApplication && metahub) {
        const appName =
          applicationName && Object.keys(applicationName).length > 0
            ? buildLocalizedContent(sanitizeLocalizedInput(applicationName), applicationNamePrimaryLocale || 'en') ?? null
            : publication.name
        const appDescription =
          applicationDescription && Object.keys(applicationDescription).length > 0
            ? buildLocalizedContent(
                sanitizeLocalizedInput(applicationDescription),
                applicationDescriptionPrimaryLocale || 'en'
              ) ?? null
            : publication.description
        const linked = await createLinkedApplication({
          exec: tx,
          publicationId: publication.id,
          publicationName: appName,
          publicationDescription: appDescription,
          metahubName: metahub.name,
          metahubDescription: metahub.description,
          isPublic: applicationIsPublic === true,
          workspacesEnabled: applicationWorkspacesEnabled === true,
          userId
        })
        applicationData = { application: linked.application, appSchemaName: linked.appSchemaName }
      }

      const defaultVersionName = { en: 'Initial Version', ru: 'Начальная версия' }

      const firstVersion = await createPublicationVersion(tx, {
        publicationId: publication.id,
        versionNumber: 1,
        name:
          versionName && Object.keys(versionName).length > 0
            ? buildLocalizedContent(sanitizeLocalizedInput(versionName), versionNamePrimaryLocale || 'en')!
            : buildLocalizedContent(defaultVersionName, 'en')!,
        description:
          versionDescription && Object.keys(versionDescription).length > 0
            ? buildLocalizedContent(sanitizeLocalizedInput(versionDescription), versionDescriptionPrimaryLocale || 'en')
            : null,
        isActive: true,
        snapshotJson: snapshot as unknown as Record<string, unknown>,
        snapshotHash,
        branchId: effectiveBranchId,
        userId
      })

      await tx.query('UPDATE metahubs.doc_publications SET active_version_id = $1 WHERE id = $2', [
        firstVersion.id,
        publication.id
      ])

      return {
        publication: { ...publication, schemaName, activeVersionId: firstVersion.id },
        firstVersion,
        applicationData
      }
    })

    if (createApplicationSchema && result.applicationData) {
      try {
        const { generator, migrationManager } = getDDLServices()
        const rawCatalogDefs = serializer.deserializeSnapshot(snapshot)
        const catalogDefs = enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshot)

        const genResult = await generator.generateFullSchema(result.applicationData.appSchemaName, catalogDefs, {
          recordMigration: true,
          migrationDescription: 'initial_schema_from_publication',
          migrationManager,
          migrationMeta: {
            publicationSnapshotHash: snapshotHash,
            publicationId: result.publication.id,
            publicationVersionId: result.firstVersion.id
          },
          userId,
          publicationSnapshot: snapshot as unknown as Record<string, unknown>,
          afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
            const txExecutor = await createRlsAwareTransactionExecutor(trx, accessToken)

            await runPublishedApplicationRuntimeSync({
              trx,
              applicationId: result.applicationData!.application.id,
              schemaName: result.applicationData!.appSchemaName,
              snapshot: snapshot as unknown as PublishedApplicationSnapshot,
              entities: catalogDefs,
              migrationManager,
              migrationId,
              userId,
              workspacesEnabled: result.applicationData!.application.workspacesEnabled === true
            })

            await persistApplicationSchemaSyncState(txExecutor, {
              applicationId: result.applicationData!.application.id,
              schemaStatus: ApplicationSchemaStatus.SYNCED,
              schemaError: null,
              schemaSyncedAt: new Date(),
              schemaSnapshot: snapshotAfter as unknown as Record<string, unknown>,
              lastSyncedPublicationVersionId: result.firstVersion.id,
              appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
              userId
            })
          }
        })

        assertSchemaGenerationSucceeded(genResult, 'Failed to generate application schema from publication')

        if (genResult.success) {
          result.applicationData.application.schemaStatus = ApplicationSchemaStatus.SYNCED
          result.applicationData.application.schemaSyncedAt = new Date()
          result.applicationData.application.schemaSnapshot = generator.generateSnapshot(catalogDefs) as unknown as Record<
            string,
            unknown
          >
          result.applicationData.application.appStructureVersion = TARGET_APP_STRUCTURE_VERSION
          result.applicationData.application.lastSyncedPublicationVersionId = result.firstVersion.id
        }
      } catch (ddlError) {
        log.error('DDL schema generation failed; compensating publication creation:', ddlError)

        try {
          await compensateCreatedPublication(rootExec, accessToken, {
            publicationId: result.publication.id,
            publicationVersionId: result.firstVersion.id,
            linkedApplication: {
              applicationId: result.applicationData.application.id,
              schemaName: result.applicationData.appSchemaName
            },
            userId
          })
        } catch (cleanupError) {
          log.error('Publication compensation failed after DDL error:', cleanupError)
          throw new MetahubDomainError({
            message: `Failed to create publication schema and cleanup also failed: ${getErrorMessage(cleanupError)}`,
            statusCode: 500,
            code: 'PUBLICATION_COMPENSATION_FAILED'
          })
        }

        throw new MetahubSchemaSyncError('Failed to create publication schema', ddlError instanceof Error ? ddlError : undefined)
      }
    }

    return res.status(201).json({
      id: result.publication.id,
      metahubId,
      name: result.publication.name,
      description: result.publication.description,
      schemaName: result.publication.schemaName,
      schemaStatus: result.publication.schemaStatus,
      schemaError: result.publication.schemaError,
      schemaSyncedAt: result.publication.schemaSyncedAt,
      accessMode: result.publication.accessMode,
      autoCreateApplication: result.publication.autoCreateApplication,
      activeVersionId: result.publication.activeVersionId,
      version: result.publication._uplVersion || 1,
      createdAt: result.publication._uplCreatedAt,
      updatedAt: result.publication._uplUpdatedAt
    })
  }

  // ─── GET SINGLE ─────────────────────────────────────────────────────────────

  const getById = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId)
    if (!userId) return
    const { exec } = services(req)

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    return res.json({
      id: publication.id,
      metahubId,
      name: publication.name,
      description: publication.description,
      schemaName: publication.schemaName,
      schemaStatus: publication.schemaStatus,
      schemaError: publication.schemaError,
      schemaSyncedAt: publication.schemaSyncedAt,
      accessMode: publication.accessMode,
      accessConfig: publication.accessConfig,
      autoCreateApplication: publication.autoCreateApplication,
      activeVersionId: publication.activeVersionId,
      schemaSnapshot: publication.schemaSnapshot,
      version: publication._uplVersion || 1,
      createdAt: publication._uplCreatedAt,
      updatedAt: publication._uplUpdatedAt
    })
  }

  // ─── UPDATE ─────────────────────────────────────────────────────────────────

  const update = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const { exec } = services(req)

    const parsed = updatePublicationSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    }

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const { name, description, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } = parsed.data

    if (expectedVersion !== undefined) {
      const currentVersion = publication._uplVersion || 1
      if (currentVersion !== expectedVersion) {
        throw new OptimisticLockError({
          entityId: publicationId,
          entityType: 'publication',
          expectedVersion,
          actualVersion: currentVersion,
          updatedAt: publication._uplUpdatedAt,
          updatedBy: publication._uplUpdatedBy ?? null
        })
      }
    }

    const updateInput: Parameters<typeof updatePublication>[2] = { userId, expectedVersion }

    if (name) {
      const nameVlc = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
      if (nameVlc) updateInput.name = nameVlc
    }
    if (description) {
      const descVlc = buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
      updateInput.description = descVlc ?? null
    }

    const updated = await updatePublication(exec, publicationId, updateInput)
    if (!updated) {
      throw new OptimisticLockError({
        entityId: publicationId,
        entityType: 'publication',
        expectedVersion: expectedVersion ?? (publication._uplVersion || 1),
        actualVersion: null as unknown as number,
        updatedAt: publication._uplUpdatedAt,
        updatedBy: publication._uplUpdatedBy ?? null
      })
    }

    return res.json({
      id: updated.id,
      metahubId,
      name: updated.name,
      description: updated.description,
      schemaName: updated.schemaName,
      schemaStatus: updated.schemaStatus,
      schemaError: updated.schemaError,
      schemaSyncedAt: updated.schemaSyncedAt,
      accessMode: updated.accessMode,
      accessConfig: updated.accessConfig,
      autoCreateApplication: updated.autoCreateApplication,
      activeVersionId: updated.activeVersionId,
      schemaSnapshot: updated.schemaSnapshot,
      version: updated._uplVersion || 1,
      createdAt: updated._uplCreatedAt,
      updatedAt: updated._uplUpdatedAt
    })
  }

  // ─── DELETE ─────────────────────────────────────────────────────────────────

  const remove = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const confirm = req.query.confirm === 'true'
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const exec = getRequestDbExecutor(req, getDbExecutor())

    if (!confirm) {
      return res.status(400).json({ error: 'Deletion requires confirmation' })
    }

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const lockKey = uuidToLockKey(`publication-delete:${publicationId}`)
    const lockAcquired = await acquirePoolAdvisoryLock(lockKey)
    if (!lockAcquired) {
      return res.status(409).json({
        error: 'Could not acquire publication delete lock. Please retry.'
      })
    }

    let deletedSchemaName: string | null = publication.schemaName
    try {
      await exec.transaction(async (tx) => {
        const metahubLocked = await tx.query<{ id: string }>('SELECT id FROM metahubs.cat_metahubs WHERE id = $1 FOR UPDATE', [
          metahubId
        ])
        if (metahubLocked.length === 0) {
          throw new MetahubNotFoundError('metahub', metahubId)
        }

        const publicationLocked = await tx.query<{ id: string; schemaName: string | null }>(
          'SELECT id, schema_name AS "schemaName" FROM metahubs.doc_publications WHERE id = $1 AND metahub_id = $2 FOR UPDATE',
          [publicationId, metahubId]
        )
        if (publicationLocked.length === 0) {
          throw new MetahubNotFoundError('publication', publicationId)
        }

        deletedSchemaName = publicationLocked[0].schemaName
        if (deletedSchemaName) {
          const { generator } = getDDLServices()
          await generator.dropSchema(deletedSchemaName)
        }

        await resetLinkedAppsToSynced(tx, publicationId)

        await tx.query(
          `UPDATE metahubs.doc_publication_versions
           SET _upl_deleted = true,
               _upl_deleted_at = NOW(),
               _upl_deleted_by = $2,
               _app_deleted = true,
               _app_deleted_at = NOW(),
               _app_deleted_by = $2,
               _upl_updated_at = NOW(),
               _upl_version = _upl_version + 1
           WHERE publication_id = $1 AND _upl_deleted = false AND _app_deleted = false`,
          [publicationId, userId]
        )

        await softDelete(tx, 'metahubs', 'doc_publications', publicationId, userId)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete publication'
      const statusCode = message === 'Metahub not found' || message === 'Publication not found' ? 404 : 500
      return res.status(statusCode).json({ error: message })
    } finally {
      await releasePoolAdvisoryLock(lockKey)
    }

    return res.json({
      success: true,
      message: `Publication and schema "${deletedSchemaName}" deleted`
    })
  }

  // ─── LIST LINKED APPS ──────────────────────────────────────────────────────

  const listLinkedApps = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId)
    if (!userId) return
    const exec = getRequestDbExecutor(req, getDbExecutor())

    if (!(await findMetahubById(exec, metahubId))) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const linkedApps = await exec.query<{
      id: string
      name: unknown
      description: unknown
      slug: string
      createdAt: Date
    }>(
      `
      SELECT DISTINCT a.id, a.name, a.description, a.slug, a._upl_created_at as "createdAt"
      FROM applications.cat_applications a
      JOIN applications.cat_connectors c ON c.application_id = a.id
      JOIN applications.rel_connector_publications cp ON cp.connector_id = c.id
      WHERE cp.publication_id = $1
      ORDER BY a._upl_created_at DESC
      `,
      [publicationId]
    )

    return res.json({ items: linkedApps, total: linkedApps.length })
  }

  // ─── CREATE LINKED APP ─────────────────────────────────────────────────────

  const createLinkedApp = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const accessToken = resolveBearerAccessToken(req)
    if (!accessToken) return res.status(401).json({ error: 'Unauthorized' })
    const rootExec = getDbExecutor()
    const exec = getRequestDbExecutor(req, rootExec)

    const parsed = createApplicationForPublicationSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    }

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }
    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const { name, description, namePrimaryLocale, descriptionPrimaryLocale, createApplicationSchema, isPublic, workspacesEnabled } =
      parsed.data

    const appName =
      name && Object.keys(name).length > 0
        ? buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
        : publication.name
    const appDescription =
      description && Object.keys(description).length > 0
        ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
        : publication.description

    let activeVersion: Awaited<ReturnType<typeof findPublicationVersionById>> | null = null
    if (createApplicationSchema) {
      if (!publication.activeVersionId) {
        return res.status(409).json({ error: 'Publication has no active version to build an application schema from' })
      }

      activeVersion = await findPublicationVersionById(exec, publication.activeVersionId)
      if (!activeVersion?.snapshotJson) {
        return res.status(409).json({ error: 'Publication active version has no snapshot to build an application schema from' })
      }

      const branchId = activeVersion.branchId ?? metahub.defaultBranchId ?? null
      if (!branchId) {
        return res.status(400).json({ error: 'Default branch is not configured for application schema generation' })
      }
    }

    const result = await runCommittedRlsTransaction(rootExec, accessToken, async (tx) => {
      const linked = await createLinkedApplication({
        exec: tx,
        publicationId: publication.id,
        publicationName: appName ?? null,
        publicationDescription: appDescription ?? null,
        metahubName: metahub.name,
        metahubDescription: metahub.description ?? null,
        isPublic: isPublic === true,
        workspacesEnabled: workspacesEnabled === true,
        userId
      })
      return linked
    })

    if (createApplicationSchema && activeVersion?.snapshotJson) {
      try {
        const branchId = activeVersion.branchId ?? metahub.defaultBranchId!
        const snapshotData = activeVersion.snapshotJson as unknown as MetahubSnapshot
        const schemaService = new MetahubSchemaService(exec, branchId)
        const objectsService = new MetahubObjectsService(exec, schemaService)
        const attributesService = new MetahubAttributesService(exec, schemaService)
        const snapshotSerializer = new SnapshotSerializer(objectsService, attributesService)
        const rawCatalogDefs = snapshotSerializer.deserializeSnapshot(snapshotData)
        const catalogDefs = enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshotData)

        const { generator, migrationManager } = getDDLServices()
        const genResult = await generator.generateFullSchema(result.appSchemaName, catalogDefs, {
          recordMigration: true,
          migrationDescription: 'initial_schema_from_publication',
          migrationManager,
          migrationMeta: {
            publicationSnapshotHash: activeVersion.snapshotHash,
            publicationId: publication.id,
            publicationVersionId: activeVersion.id
          },
          userId,
          publicationSnapshot: snapshotData as unknown as Record<string, unknown>,
          afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
            const txExecutor = await createRlsAwareTransactionExecutor(trx, accessToken)

            await runPublishedApplicationRuntimeSync({
              trx,
              applicationId: result.application.id,
              schemaName: result.appSchemaName,
              snapshot: snapshotData as unknown as PublishedApplicationSnapshot,
              entities: catalogDefs,
              migrationManager,
              migrationId,
              userId,
              workspacesEnabled: result.application.workspacesEnabled === true
            })

            await persistApplicationSchemaSyncState(txExecutor, {
              applicationId: result.application.id,
              schemaStatus: ApplicationSchemaStatus.SYNCED,
              schemaError: null,
              schemaSyncedAt: new Date(),
              schemaSnapshot: snapshotAfter as unknown as Record<string, unknown>,
              lastSyncedPublicationVersionId: activeVersion.id,
              appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
              userId
            })
          }
        })

        assertSchemaGenerationSucceeded(genResult, 'Failed to generate application schema for linked publication application')

        if (genResult.success) {
          result.application.schemaStatus = ApplicationSchemaStatus.SYNCED
          result.application.schemaSyncedAt = new Date()
          result.application.schemaSnapshot = generator.generateSnapshot(catalogDefs) as unknown as Record<string, unknown>
          result.application.appStructureVersion = TARGET_APP_STRUCTURE_VERSION
          result.application.lastSyncedPublicationVersionId = activeVersion.id
        }
      } catch (ddlError) {
        log.error('DDL schema generation for new linked application failed; compensating:', ddlError)

        try {
          await compensateCreatedApplication(rootExec, accessToken, {
            applicationId: result.application.id,
            schemaName: result.appSchemaName,
            userId
          })
        } catch (cleanupError) {
          log.error('Linked application compensation failed after DDL error:', cleanupError)
          throw new MetahubDomainError({
            message: `Failed to create application schema and cleanup also failed: ${getErrorMessage(cleanupError)}`,
            statusCode: 500,
            code: 'APPLICATION_COMPENSATION_FAILED'
          })
        }

        throw new MetahubSchemaSyncError('Failed to create linked application schema', ddlError instanceof Error ? ddlError : undefined)
      }
    }

    return res.status(201).json({
      application: {
        id: result.application.id,
        name: result.application.name,
        description: result.application.description,
        slug: result.application.slug,
        schemaName: result.appSchemaName
      },
      connector: {
        id: result.connector.id
      }
    })
  }

  // ─── DIFF ───────────────────────────────────────────────────────────────────

  const diff = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId)
    if (!userId) return
    const { exec, objectsService, attributesService } = services(req)

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    if (!publication.activeVersionId) {
      return res.status(400).json({
        error: 'No active version found',
        message: 'Publication must have an active version to sync.'
      })
    }

    const activeVersion = await findPublicationVersionById(exec, publication.activeVersionId)
    if (!activeVersion) {
      return res.status(404).json({ error: 'Active version data not found' })
    }

    const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
      return res.status(400).json({ error: 'Invalid publication snapshot' })
    }

    const serializer = new SnapshotSerializer(objectsService, attributesService)
    const rawCatalogDefs = serializer.deserializeSnapshot(snapshot)
    const catalogDefs = enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshot)

    const oldSnapshot = publication.schemaSnapshot as SchemaSnapshot | null

    const { generator, migrator } = getDDLServices()
    const schemaDiff: SchemaDiff = migrator.calculateDiff(oldSnapshot, catalogDefs)

    const schemaExists = await generator.schemaExists(publication.schemaName || '')

    return res.json({
      schemaExists,
      diff: {
        hasChanges: schemaDiff.hasChanges,
        summary: schemaDiff.summary,
        additive: schemaDiff.additive.map((c: any) => c.description),
        destructive: schemaDiff.destructive.map((c: any) => c.description)
      }
    })
  }

  // ─── SYNC ───────────────────────────────────────────────────────────────────

  const sync = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const { exec, objectsService, attributesService } = services(req)

    const parsed = syncSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    }

    const { confirmDestructive } = parsed.data

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    if (!publication.activeVersionId) {
      return res.status(400).json({
        error: 'No active version found',
        message: 'Publication must have an active version to sync.'
      })
    }

    const activeVersion = await findPublicationVersionById(exec, publication.activeVersionId)
    if (!activeVersion) {
      return res.status(404).json({ error: 'Active version data not found' })
    }

    const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
      return res.status(400).json({ error: 'Invalid publication snapshot' })
    }

    const serializer = new SnapshotSerializer(objectsService, attributesService)
    const rawCatalogDefs = serializer.deserializeSnapshot(snapshot)
    const catalogDefs = enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshot)

    const { generator, migrator, migrationManager } = getDDLServices()

    const schemaExists = await generator.schemaExists(publication.schemaName || '')

    await updatePublication(exec, publicationId, { schemaStatus: 'pending' })

    try {
      if (!schemaExists) {
        const result = await generator.generateFullSchema(publication.schemaName!, catalogDefs, {
          recordMigration: true,
          migrationDescription: 'initial_schema',
          migrationManager
        })

        if (!result.success) {
          await updatePublication(exec, publicationId, {
            schemaStatus: 'error',
            schemaError: result.errors.join('; ')
          })

          return res.status(500).json({ status: 'error', errors: result.errors })
        }

        const newSchemaSnapshot = generator.generateSnapshot(catalogDefs)

        await updatePublication(exec, publicationId, {
          schemaName: result.schemaName,
          schemaStatus: 'synced',
          schemaError: null,
          schemaSyncedAt: new Date(),
          schemaSnapshot: newSchemaSnapshot as unknown as Record<string, unknown>
        })

        return res.json({
          status: 'created',
          schemaName: result.schemaName,
          tablesCreated: result.tablesCreated
        })
      }

      const oldSnapshot = publication.schemaSnapshot as SchemaSnapshot | null
      const schemaDiff = migrator.calculateDiff(oldSnapshot, catalogDefs)

      if (!schemaDiff.hasChanges) {
        await generator.syncSystemMetadata(publication.schemaName!, catalogDefs, {
          removeMissing: true
        })
        const syncedSnapshot = generator.generateSnapshot(catalogDefs)
        await updatePublication(exec, publicationId, {
          schemaStatus: 'synced',
          schemaSnapshot: syncedSnapshot as unknown as Record<string, unknown>
        })
        return res.json({ status: 'synced', message: 'Schema up to date' })
      }

      if (schemaDiff.destructive.length > 0 && !confirmDestructive) {
        await updatePublication(exec, publicationId, { schemaStatus: 'outdated' })
        return res.json({
          status: 'pending_confirmation',
          diff: {
            summary: schemaDiff.summary,
            destructive: schemaDiff.destructive.map((c: any) => c.description)
          }
        })
      }

      const migrationResult = await migrator.applyAllChanges(publication.schemaName!, schemaDiff, catalogDefs, confirmDestructive, {
        recordMigration: true,
        migrationDescription: 'schema_sync'
      })

      if (!migrationResult.success) {
        await updatePublication(exec, publicationId, {
          schemaStatus: 'error',
          schemaError: migrationResult.errors.join('; ')
        })
        return res.status(500).json({ status: 'error', errors: migrationResult.errors })
      }

      const migratedSnapshot = generator.generateSnapshot(catalogDefs)
      await updatePublication(exec, publicationId, {
        schemaStatus: 'synced',
        schemaError: null,
        schemaSyncedAt: new Date(),
        schemaSnapshot: migratedSnapshot as unknown as Record<string, unknown>
      })

      return res.json({
        status: 'migrated',
        changesApplied: migrationResult.changesApplied
      })
    } catch (error) {
      const schemaError = error instanceof Error ? error.message : 'Unknown error'
      await updatePublication(exec, publicationId, {
        schemaStatus: 'error',
        schemaError
      })
      return res.status(500).json({ status: 'error', message: schemaError })
    }
  }

  // ─── LIST VERSIONS ──────────────────────────────────────────────────────────

  const listVersions = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId)
    if (!userId) return
    const { exec } = services(req)

    const publication = await findPublicationById(exec, publicationId)
    if (!publication || publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const versions = await listPublicationVersions(exec, publicationId)

    const mappedVersions = versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      name: v.name,
      description: v.description,
      isActive: v.isActive,
      createdAt: v._uplCreatedAt,
      createdBy: v._uplCreatedBy,
      branchId: v.branchId
    }))

    return res.json({ items: mappedVersions })
  }

  // ─── CREATE VERSION ─────────────────────────────────────────────────────────

  const createVersion = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const { exec } = services(req)
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }
    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const parsed = createVersionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const { name, description, namePrimaryLocale, descriptionPrimaryLocale, branchId } = parsed.data

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const requestedBranchId = typeof branchId === 'string' ? branchId : null
    const effectiveBranchId = requestedBranchId ?? metahub.defaultBranchId ?? null
    if (!effectiveBranchId) {
      return res.status(400).json({ error: 'Default branch is not configured' })
    }
    const branch = await findBranchByIdAndMetahub(exec, effectiveBranchId, metahubId)
    if (!branch) {
      return res.status(400).json({ error: 'Branch not found' })
    }

    const schemaService = new MetahubSchemaService(exec, effectiveBranchId)
    const objectsService = new MetahubObjectsService(exec, schemaService)
    const attributesService = new MetahubAttributesService(exec, schemaService)
    const elementsService = new MetahubElementsService(exec, schemaService, objectsService, attributesService)
    const hubsService = new MetahubHubsService(exec, schemaService)
    const enumerationValuesService = new MetahubEnumerationValuesService(exec, schemaService)
    const constantsService = new MetahubConstantsService(exec, schemaService)
    const serializer = new SnapshotSerializer(
      objectsService,
      attributesService,
      elementsService,
      hubsService,
      enumerationValuesService,
      constantsService
    )
    const templateVersionLabel = await resolveTemplateVersionLabel(exec, metahub.templateVersionId)
    const snapshot = await serializer.serializeMetahub(metahubId ?? publication.metahubId, {
      structureVersion: structureVersionToSemver(branch.structureVersion),
      templateVersion: templateVersionLabel
    })

    await attachLayoutsToSnapshot({ schemaService, snapshot, metahubId: metahubId ?? publication.metahubId, userId })
    const snapshotHash = serializer.calculateHash(snapshot)

    const existingVersions = await listPublicationVersions(exec, publicationId)
    const lastVersion = existingVersions[0] ?? null
    const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1
    const isDuplicate = lastVersion?.snapshotHash === snapshotHash

    const result = await exec.transaction(async (tx) => {
      await deactivatePublicationVersions(tx, publicationId)

      const version = await createPublicationVersion(tx, {
        publicationId,
        versionNumber: nextVersionNumber,
        name: buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')!,
        description:
          description && Object.keys(description).length > 0
            ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
            : null,
        snapshotJson: snapshot as unknown as Record<string, unknown>,
        snapshotHash,
        branchId: effectiveBranchId,
        isActive: true,
        userId
      })

      await tx.query('UPDATE metahubs.doc_publications SET active_version_id = $1 WHERE id = $2', [version.id, publicationId])

      return version
    })

    await notifyLinkedApplicationsUpdateAvailable(exec, publicationId, result.id)

    return res.status(201).json({
      ...result,
      isDuplicate
    })
  }

  // ─── ACTIVATE VERSION ───────────────────────────────────────────────────────

  const activateVersion = async (req: Request, res: Response) => {
    const { metahubId, publicationId, versionId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const { exec } = services(req)

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }
    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const version = await findPublicationVersionById(exec, versionId)
    if (!version || version.publicationId !== publicationId) {
      return res.status(404).json({ error: 'Version not found' })
    }

    await exec.transaction(async (tx) => {
      await deactivatePublicationVersions(tx, publicationId)
      await activatePublicationVersion(tx, versionId)
      await tx.query('UPDATE metahubs.doc_publications SET active_version_id = $1 WHERE id = $2', [version.id, publicationId])
    })

    await notifyLinkedApplicationsUpdateAvailable(exec, publicationId, version.id)

    const activatedVersion = await findPublicationVersionById(exec, versionId)

    return res.json({ success: true, version: activatedVersion })
  }

  // ─── UPDATE VERSION ─────────────────────────────────────────────────────────

  const updateVersion = async (req: Request, res: Response) => {
    const { metahubId, publicationId, versionId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const { exec } = services(req)

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }
    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const version = await findPublicationVersionById(exec, versionId)
    if (!version || version.publicationId !== publicationId) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const parsed = updateVersionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const { name, description, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

    const setClauses: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (name) {
      const nameVlc = buildLocalizedContent(sanitizeLocalizedInput(name), namePrimaryLocale || 'en')
      if (nameVlc) {
        setClauses.push(`name = $${idx}`)
        params.push(JSON.stringify(nameVlc))
        idx++
      }
    }

    if (description !== undefined) {
      const descVlc =
        description && typeof description === 'object' && Object.keys(description).length > 0
          ? buildLocalizedContent(sanitizeLocalizedInput(description), descriptionPrimaryLocale || 'en')
          : null
      setClauses.push(`description = $${idx}`)
      params.push(descVlc ? JSON.stringify(descVlc) : null)
      idx++
    }

    if (setClauses.length > 0) {
      setClauses.push('_upl_updated_at = NOW()')
      setClauses.push(`_upl_updated_by = $${idx}`)
      params.push(userId)
      idx++
      setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')

      params.push(versionId)
      await exec.query(`UPDATE metahubs.doc_publication_versions SET ${setClauses.join(', ')} WHERE id = $${idx}`, params)
    }

    const updatedVersion = await findPublicationVersionById(exec, versionId)
    return res.json(updatedVersion)
  }

  // ─── DELETE VERSION ─────────────────────────────────────────────────────────

  const deleteVersion = async (req: Request, res: Response) => {
    const { metahubId, publicationId, versionId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const { exec } = services(req)

    const publication = await findPublicationById(exec, publicationId)
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' })
    }
    if (publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found in this Metahub' })
    }

    const version = await findPublicationVersionById(exec, versionId)
    if (!version || version.publicationId !== publicationId) {
      return res.status(404).json({ error: 'Version not found' })
    }

    if (version.isActive) {
      return res.status(400).json({ error: 'Cannot delete an active version' })
    }

    await softDelete(exec, 'metahubs', 'doc_publication_versions', versionId, userId)

    return res.json({ success: true })
  }

  // ─── IMPORT VERSION ─────────────────────────────────────────────────────────

  const importVersion = async (req: Request, res: Response) => {
    const { metahubId, publicationId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return
    const { exec } = services(req)

    // 1. Validate envelope
    let envelope: MetahubSnapshotTransportEnvelope
    try {
      envelope = validateSnapshotEnvelope(req.body)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed'
      return res.status(400).json({ error: 'Invalid snapshot envelope', details: message })
    }

    // 2. Verify publication exists and belongs to this metahub
    const publication = await findPublicationById(exec, publicationId)
    if (!publication || publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    // 3. Create version from imported snapshot
    const versions = await listPublicationVersions(exec, publicationId)
    const nextVersionNumber = Math.max(0, ...versions.map((v) => v.versionNumber)) + 1

    const { buildLocalizedContent: buildLC } = localizedContent
    const versionName = buildLC({ en: `Imported v${nextVersionNumber}` }, 'en')

    const result = await exec.transaction(async (tx) => {
      await deactivatePublicationVersions(tx, publicationId)

      const version = await createPublicationVersion(tx, {
        publicationId,
        versionNumber: nextVersionNumber,
        name: versionName!,
        description: null,
        snapshotJson: envelope.snapshot as Record<string, unknown>,
        snapshotHash: envelope.snapshotHash,
        branchId: null,
        isActive: true,
        userId
      })

      await tx.query(
        'UPDATE metahubs.doc_publications SET active_version_id = $1 WHERE id = $2',
        [version.id, publicationId]
      )

      return version
    })

    await notifyLinkedApplicationsUpdateAvailable(exec, publicationId, result.id)

    return res.status(201).json({
      ...result,
      importedFrom: {
        sourceMetahubId: envelope.metahub.id,
        sourceSnapshotHash: envelope.snapshotHash,
        exportedAt: envelope.exportedAt,
      },
    })
  }

  // ─── EXPORT VERSION ─────────────────────────────────────────────────────────

  const exportVersion = async (req: Request, res: Response) => {
    const { metahubId, publicationId, versionId } = req.params
    const userId = await ensureMetahubRouteAccess(req, res, metahubId)
    if (!userId) return
    const { exec } = services(req)

    const publication = await findPublicationById(exec, publicationId)
    if (!publication || publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    const version = await findPublicationVersionById(exec, versionId)
    if (!version || version.publicationId !== publicationId) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
      return res.status(404).json({ error: 'Metahub not found' })
    }

    const envelope = buildSnapshotEnvelope({
      snapshot: version.snapshotJson as MetahubSnapshotTransportEnvelope['snapshot'],
      metahub: {
        id: metahub.id,
        name: metahub.name as unknown as Record<string, unknown>,
        description: (metahub.description ?? undefined) as unknown as Record<string, unknown> | undefined,
        codename: metahub.codename as unknown as Record<string, unknown>,
        slug: metahub.slug ?? undefined,
      },
      publication: {
        id: publication.id,
        name: publication.name as unknown as Record<string, unknown>,
        versionId: version.id,
        versionNumber: version.versionNumber,
      },
    })

    const primary = getCodenamePrimary(metahub.codename) ?? metahub.id
    const asciiFilename = `metahub-${primary.replace(/[^a-zA-Z0-9\-_.]/g, '_')}-v${version.versionNumber}.json`
    const utf8Filename = `metahub-${primary}-v${version.versionNumber}.json`

    res.type('application/json')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`
    )
    return res.send(JSON.stringify(envelope))
  }

  return {
    listAvailable,
    list,
    create,
    getById,
    update,
    remove,
    listLinkedApps,
    createLinkedApp,
    diff,
    sync,
    listVersions,
    createVersion,
    exportVersion,
    importVersion,
    activateVersion,
    updateVersion,
    deleteVersion
  }
}
