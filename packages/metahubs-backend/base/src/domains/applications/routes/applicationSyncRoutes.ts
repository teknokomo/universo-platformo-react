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
import stableStringify from 'json-stable-stringify'
import { AttributeDataType, AttributeValidationRules } from '@universo/types'
import { validateNumberOrThrow } from '@universo/utils'
import {
    Application,
    Connector,
    ConnectorPublication,
    ApplicationSchemaStatus,
    ensureApplicationAccess,
    type ApplicationRole
} from '@universo/applications-backend'
import { Publication } from '../../../database/entities/Publication'
import { PublicationVersion } from '../../../database/entities/PublicationVersion'
import { SnapshotSerializer, MetahubSnapshot } from '../../publications/services/SnapshotSerializer'
import { getDDLServices, generateSchemaName, generateTableName, generateColumnName, generateMigrationName, KnexClient } from '../../ddl'
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

const asyncHandler = (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
}

const ADMIN_ROLES: ApplicationRole[] = ['owner', 'admin', 'editor']

// Dashboard layout config (MVP) - show/hide template sections.
const dashboardLayoutConfigSchema = z.object({
    showSideMenu: z.boolean().optional(),
    showAppNavbar: z.boolean().optional(),
    showHeader: z.boolean().optional(),
    showBreadcrumbs: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    showDatePicker: z.boolean().optional(),
    showOptionsMenu: z.boolean().optional(),
    showOverviewTitle: z.boolean().optional(),
    showOverviewCards: z.boolean().optional(),
    showSessionsChart: z.boolean().optional(),
    showPageViewsChart: z.boolean().optional(),
    showDetailsTitle: z.boolean().optional(),
    showDetailsTable: z.boolean().optional(),
    showDetailsSidePanel: z.boolean().optional(),
    showFooter: z.boolean().optional()
})

const defaultDashboardLayoutConfig = {
    showSideMenu: true,
    showAppNavbar: true,
    showHeader: true,
    showBreadcrumbs: true,
    showSearch: true,
    showDatePicker: true,
    showOptionsMenu: true,
    showOverviewTitle: true,
    showOverviewCards: true,
    showSessionsChart: true,
    showPageViewsChart: true,
    showDetailsTitle: true,
    showDetailsTable: true,
    showDetailsSidePanel: true,
    showFooter: true
} as const

const UI_LAYOUT_DIFF_MARKER = 'ui.layout.update'
const UI_LAYOUTS_DIFF_MARKER = 'ui.layouts.update'
const SYSTEM_METADATA_DIFF_MARKER = 'schema.metadata.update'

/**
 * Checks if a field stores VLC (versioned/localized content) as JSONB.
 * STRING fields with versioned=true or localized=true are stored as JSONB.
 */
function isVLCField(field: { dataType: AttributeDataType; validationRules?: Record<string, unknown> }): boolean {
    if (field.dataType !== AttributeDataType.STRING) {
        return false
    }
    const rules = field.validationRules as Partial<AttributeValidationRules> | undefined
    return rules?.versioned === true || rules?.localized === true
}

/**
 * Prepares a value for insertion into a JSONB column.
 * Knex handles object serialization automatically, but primitives need JSON.stringify.
 * PostgreSQL JSONB requires valid JSON: strings must be quoted, etc.
 */
function prepareJsonbValue(value: unknown): unknown {
    if (value === undefined || value === null) {
        return null
    }
    // Objects and arrays: Knex serializes them automatically
    if (typeof value === 'object') {
        return value
    }
    // Primitives (string, number, boolean): wrap in JSON.stringify for valid JSONB
    // PostgreSQL JSONB requires: '"string"' not just 'string'
    return JSON.stringify(value)
}

/**
 * Validates numeric values against NUMERIC(precision, scale) constraints.
 * Throws an error if the value is invalid or overflows.
 *
 * This ensures data integrity - if data passed metahub validation,
 * it should pass application sync too. Any overflow indicates
 * validation was bypassed during element creation.
 */
function validateNumericValue(options: {
    value: unknown
    field: { codename: string; validationRules?: Record<string, unknown> }
    tableName: string
    elementId: string
}): number | null {
    const { value, field, tableName, elementId } = options

    if (value === undefined || value === null) {
        return null
    }

    if (typeof value !== 'number') {
        // Let DB handle type mismatch
        return value as unknown as number
    }

    const rules = field.validationRules as Partial<AttributeValidationRules> | undefined

    try {
        return validateNumberOrThrow(
            value,
            {
                precision: rules?.precision,
                scale: rules?.scale,
                min: rules?.min ?? undefined,
                max: rules?.max ?? undefined,
                nonNegative: rules?.nonNegative
            },
            {
                fieldName: field.codename,
                elementId
            }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
            `[SchemaSync] Failed to sync element ${elementId} to ${tableName}: ${message}. ` +
                `This indicates the element contains invalid data that bypassed metahub validation.`
        )
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
        for (const [objectId, rawElements] of Object.entries(snapshot.elements ?? {})) {
            const elements = (rawElements ?? []) as SnapshotElementRow[]
            if (!elements || elements.length === 0) continue

            const entity = entityMap.get(objectId)
            if (!entity) continue

            const tableName = generateTableName(entity.id, entity.kind)
            // Build field map: codename -> { columnName, field definition }
            const fieldByCodename = new Map<string, { columnName: string; field: EntityField }>(
                entity.fields.map((field: EntityField) => [field.codename, { columnName: generateColumnName(field.id), field }])
            )
            const dataColumns = Array.from(fieldByCodename.values()).map((v) => v.columnName)

            const rows = elements.map((element: SnapshotElementRow) => {
                const data = element.data ?? {}
                const missingRequired = entity.fields
                    .filter((field: EntityField) => field.isRequired)
                    .filter((field: EntityField) => {
                        if (!Object.prototype.hasOwnProperty.call(data, field.codename)) return true
                        const value = (data as Record<string, unknown>)[field.codename]
                        return value === null || value === undefined
                    })

                if (missingRequired.length > 0) {
                    const message =
                        `[SchemaSync] Skipping predefined element ${element.id} for ${tableName} ` +
                        `due to missing required fields: ${missingRequired.map((f: EntityField) => f.codename).join(', ')}`
                    console.warn(message)
                    warnings.push(message)
                    return null
                }

                const row: Record<string, unknown> = {
                    id: element.id,
                    _upl_created_at: now,
                    _upl_created_by: userId ?? null,
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null
                }

                for (const [codename, { columnName, field }] of fieldByCodename.entries()) {
                    if (Object.prototype.hasOwnProperty.call(data, codename)) {
                        const rawValue = (data as Record<string, unknown>)[codename]
                        // VLC fields (versioned/localized STRING) are JSONB columns
                        if (isVLCField(field)) {
                            row[columnName] = prepareJsonbValue(rawValue)
                        } else if (field.dataType === AttributeDataType.JSON) {
                            // JSON type is also JSONB, prepare value
                            row[columnName] = prepareJsonbValue(rawValue)
                        } else if (field.dataType === AttributeDataType.NUMBER) {
                            // Validate and normalize NUMBER values - throws on invalid data
                            row[columnName] = validateNumericValue({
                                value: rawValue,
                                field: { codename, validationRules: field.validationRules },
                                tableName,
                                elementId: element.id
                            })
                        } else {
                            row[columnName] = rawValue
                        }
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

type PersistedAppLayout = {
    id: string
    templateKey: string
    name: Record<string, unknown>
    description: Record<string, unknown> | null
    config: Record<string, unknown>
    isActive: boolean
    isDefault: boolean
    sortOrder: number
}

function normalizeSnapshotLayouts(snapshot: MetahubSnapshot): PersistedAppLayout[] {
    const rows = (Array.isArray(snapshot.layouts) ? snapshot.layouts : [])
        .map((layout) => ({
            id: String(layout.id ?? ''),
            templateKey: typeof layout.templateKey === 'string' && layout.templateKey.length > 0 ? layout.templateKey : 'dashboard',
            name: layout.name && typeof layout.name === 'object' ? layout.name : {},
            description: layout.description && typeof layout.description === 'object' ? layout.description : null,
            config: layout.config && typeof layout.config === 'object' ? layout.config : {},
            isActive: Boolean(layout.isActive),
            isDefault: Boolean(layout.isDefault),
            sortOrder: typeof layout.sortOrder === 'number' ? layout.sortOrder : 0
        }))
        .filter((layout) => layout.id.length > 0)

    const desiredDefaultLayoutId = typeof snapshot.defaultLayoutId === 'string' ? snapshot.defaultLayoutId : null
    if (desiredDefaultLayoutId) {
        for (const row of rows) {
            row.isDefault = row.id === desiredDefaultLayoutId
        }
    }

    if (rows.length > 0 && !rows.some((row) => row.isDefault)) {
        const fallback = rows.find((row) => row.isActive) ?? rows[0]
        fallback.isDefault = true
    }

    return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}

type DiffTableFieldDetails = {
    id: string
    codename: string
    dataType: string
    isRequired: boolean
}

type DiffTableDetails = {
    id: string
    codename: string
    tableName: string | null
    fields: DiffTableFieldDetails[]
    predefinedElementsCount: number
    predefinedElementsPreview: Array<{
        id: string
        data: Record<string, unknown>
        sortOrder: number
    }>
}

type DiffStructuredChange = {
    type: string
    description: string
    entityCodename?: string
    fieldCodename?: string
    tableName?: string
    dataType?: string
    oldValue?: unknown
    newValue?: unknown
}

type EntityField = EntityDefinition['fields'][number]
type SnapshotElementRow = {
    id: string
    data?: Record<string, unknown>
    sortOrder?: number
}

function buildCreateTableDetails(options: {
    entities: EntityDefinition[]
    snapshot: MetahubSnapshot
    includeEntityIds?: Set<string>
}): DiffTableDetails[] {
    const { entities, snapshot, includeEntityIds } = options
    const catalogEntities = entities.filter((entity) => entity.kind === 'catalog')

    return catalogEntities
        .filter((entity) => (includeEntityIds ? includeEntityIds.has(entity.id) : true))
        .map((entity) => {
            const fields = (entity.fields ?? []).map((f: EntityField) => ({
                id: f.id,
                codename: f.codename,
                dataType: f.dataType,
                isRequired: Boolean(f.isRequired)
            }))

            const elements = (snapshot.elements && (snapshot.elements as Record<string, unknown[]>)[entity.id]) as unknown[] | undefined
            const predefinedElements = Array.isArray(elements)
                ? elements.map((el) => {
                      const normalized = (el ?? {}) as Record<string, unknown>
                      return {
                          id: String(normalized.id ?? ''),
                          data: (normalized.data as Record<string, unknown>) ?? {},
                          sortOrder: typeof normalized.sortOrder === 'number' ? normalized.sortOrder : 0
                      }
                  })
                : []

            return {
                id: entity.id,
                codename: entity.codename,
                tableName: generateTableName(entity.id, entity.kind),
                fields,
                predefinedElementsCount: predefinedElements.length,
                predefinedElementsPreview: predefinedElements.slice(0, 50)
            }
        })
}

function mapStructuredChange(change: SchemaChange): DiffStructuredChange {
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

async function persistPublishedLayouts(options: { schemaName: string; snapshot: MetahubSnapshot; userId?: string | null }): Promise<void> {
    const { schemaName, snapshot, userId } = options
    const knex = KnexClient.getInstance()

    try {
        const { generator } = getDDLServices()
        await generator.ensureSystemTables(schemaName)
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[SchemaSync] Failed to ensure _app_layouts for layouts (ignored)', e)
    }

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) return

    const now = new Date()
    const nextLayouts = normalizeSnapshotLayouts(snapshot)

    await knex.transaction(async (trx) => {
        const existingRows = await trx
            .withSchema(schemaName)
            .from('_app_layouts')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        for (const row of nextLayouts) {
            const payload = {
                template_key: row.templateKey,
                name: row.name,
                description: row.description,
                config: row.config,
                is_active: row.isActive,
                is_default: row.isDefault,
                sort_order: row.sortOrder,
                owner_id: null
            }

            if (existingIds.has(row.id)) {
                await trx
                    .withSchema(schemaName)
                    .from('_app_layouts')
                    .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: trx.raw('_upl_version + 1')
                    })
            } else {
                await trx
                    .withSchema(schemaName)
                    .into('_app_layouts')
                    .insert({
                        id: row.id,
                        ...payload,
                        _upl_created_at: now,
                        _upl_created_by: userId ?? null,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _app_published: true,
                        _app_archived: false,
                        _app_deleted: false
                    })
            }
        }

        const nextIds = nextLayouts.map((row) => row.id)
        if (nextIds.length > 0) {
            await trx
                .withSchema(schemaName)
                .from('_app_layouts')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await trx.withSchema(schemaName).from('_app_layouts').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    })
}

async function getPersistedDashboardLayoutConfig(options: { schemaName: string }): Promise<Record<string, unknown>> {
    const { schemaName } = options
    const knex = KnexClient.getInstance()

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) {
        return {}
    }

    const preferredDefault = await knex
        .withSchema(schemaName)
        .from('_app_layouts')
        .where({ is_default: true, _upl_deleted: false, _app_deleted: false })
        .select(['config'])
        .first()

    const fallbackActive = preferredDefault
        ? null
        : await knex
              .withSchema(schemaName)
              .from('_app_layouts')
              .where({ is_active: true, _upl_deleted: false, _app_deleted: false })
              .orderBy([
                  { column: 'sort_order', order: 'asc' },
                  { column: '_upl_created_at', order: 'asc' }
              ])
              .select(['config'])
              .first()

    const value = (preferredDefault?.config ?? fallbackActive?.config) as unknown
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

async function getPersistedPublishedLayouts(options: {
    schemaName: string
}): Promise<{ layouts: PersistedAppLayout[]; defaultLayoutId: string | null }> {
    const { schemaName } = options
    const knex = KnexClient.getInstance()

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) {
        return { layouts: [], defaultLayoutId: null }
    }

    const rows = await knex
        .withSchema(schemaName)
        .from('_app_layouts')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select(['id', 'template_key', 'name', 'description', 'config', 'is_active', 'is_default', 'sort_order'])
        .orderBy([
            { column: 'sort_order', order: 'asc' },
            { column: '_upl_created_at', order: 'asc' }
        ])

    const layouts = rows.map((row: any) => ({
        id: String(row.id),
        templateKey: typeof row.template_key === 'string' && row.template_key.length > 0 ? row.template_key : 'dashboard',
        name: row.name && typeof row.name === 'object' ? row.name : {},
        description: row.description && typeof row.description === 'object' ? row.description : null,
        config: row.config && typeof row.config === 'object' ? row.config : {},
        isActive: Boolean(row.is_active),
        isDefault: Boolean(row.is_default),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
    }))
    const defaultLayoutId = layouts.find((layout) => layout.isDefault)?.id ?? null
    return { layouts, defaultLayoutId }
}

function buildMergedDashboardLayoutConfig(snapshot: MetahubSnapshot): Record<string, unknown> {
    const parsed = dashboardLayoutConfigSchema.safeParse(snapshot.layoutConfig ?? {})
    return {
        ...defaultDashboardLayoutConfig,
        ...(parsed.success ? parsed.data : {})
    }
}

async function hasDashboardLayoutConfigChanges(options: { schemaName: string; snapshot: MetahubSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedDashboardLayoutConfig({ schemaName })
    const next = buildMergedDashboardLayoutConfig(snapshot)

    // Stable compare to avoid false positives due to key ordering.
    return stableStringify(current) !== stableStringify(next)
}

async function hasPublishedLayoutsChanges(options: { schemaName: string; snapshot: MetahubSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedPublishedLayouts({ schemaName })
    const normalizedLayouts = normalizeSnapshotLayouts(snapshot)
    const next = {
        layouts: normalizedLayouts,
        defaultLayoutId: normalizedLayouts.find((layout) => layout.isDefault)?.id ?? null
    }

    return stableStringify(current) !== stableStringify(next)
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
                await ensureApplicationAccess(ds, userId, applicationId, ADMIN_ROLES)
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
                    const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName: application.schemaName!, snapshot })
                    const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName: application.schemaName!, snapshot })

                    application.schemaStatus = ApplicationSchemaStatus.SYNCED
                    application.schemaError = null
                    application.schemaSyncedAt = new Date()
                    await applicationRepo.save(application)

                    // Keep system metadata in sync even when DDL didn't change.
                    // This covers non-DDL evolutions (e.g., new metadata columns like sort_order) and keeps runtime UI stable.
                    await generator.syncSystemMetadata(application.schemaName!, catalogDefs, { userId })

                    await persistPublishedLayouts({ schemaName: application.schemaName!, snapshot, userId })

                    return res.json({
                        status: uiNeedsUpdate || layoutsNeedUpdate ? 'ui_updated' : 'no_changes',
                        message: uiNeedsUpdate || layoutsNeedUpdate ? 'UI layout settings updated' : 'Schema is already up to date'
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

                    await persistPublishedLayouts({ schemaName: application.schemaName!, snapshot, userId })

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
                    const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName: application.schemaName!, snapshot })
                    const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName: application.schemaName!, snapshot })

                    await generator.syncSystemMetadata(application.schemaName!, catalogDefs, { userId })

                    application.schemaStatus = ApplicationSchemaStatus.SYNCED
                    application.schemaError = null
                    application.schemaSyncedAt = new Date()
                    await applicationRepo.save(application)

                    await persistPublishedLayouts({ schemaName: application.schemaName!, snapshot, userId })

                    // Record a migration even if DDL didn't change, so the applied snapshot hash is updated.
                    // This prevents the diff endpoint from repeatedly suggesting a sync when only UI/meta changed.
                    const latestMigration = await migrationManager.getLatestMigration(application.schemaName!)
                    const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
                    if (snapshotHash && lastAppliedHash !== snapshotHash) {
                        const snapshotBefore = (application.schemaSnapshot as SchemaSnapshot | null) ?? null
                        const snapshotAfter = generator.generateSnapshot(catalogDefs)
                        const metaOnlyDiff = {
                            hasChanges: false,
                            additive: [],
                            destructive: [],
                            summary: 'System metadata updated (no DDL changes)'
                        }

                        await migrationManager.recordMigration(
                            application.schemaName!,
                            generateMigrationName('system_sync'),
                            snapshotBefore,
                            snapshotAfter,
                            metaOnlyDiff,
                            undefined,
                            migrationMeta,
                            publicationSnapshot,
                            userId
                        )

                        application.schemaSnapshot = snapshotAfter as unknown as Record<string, unknown>
                        await applicationRepo.save(application)
                    }

                    return res.json({
                        status: uiNeedsUpdate || layoutsNeedUpdate ? 'ui_updated' : 'no_changes',
                        message: uiNeedsUpdate || layoutsNeedUpdate ? 'UI layout settings updated' : 'Schema is already up to date'
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

                const migrationResult = await migrator.applyAllChanges(application.schemaName!, diff, catalogDefs, confirmDestructive, {
                    recordMigration: true,
                    migrationDescription: 'schema_sync',
                    migrationMeta,
                    publicationSnapshot,
                    userId
                })

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

                await persistPublishedLayouts({ schemaName: application.schemaName!, snapshot, userId })

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
                await ensureApplicationAccess(ds, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
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
                const createTables = buildCreateTableDetails({ entities: catalogDefs, snapshot })

                // Keep human-readable additive strings for backward compatibility.
                // Frontend should prefer `diff.details.create.tables` for i18n-friendly rendering.
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
                return res.json({
                    schemaExists: true,
                    schemaName,
                    diff: {
                        hasChanges: uiNeedsUpdate || layoutsNeedUpdate,
                        hasDestructiveChanges: false,
                        additive: [
                            ...(uiNeedsUpdate ? [UI_LAYOUT_DIFF_MARKER] : []),
                            ...(layoutsNeedUpdate ? [UI_LAYOUTS_DIFF_MARKER] : [])
                        ],
                        destructive: [],
                        summaryKey: uiNeedsUpdate || layoutsNeedUpdate ? 'ui.layout.changed' : 'schema.upToDate',
                        summary: uiNeedsUpdate || layoutsNeedUpdate ? 'UI layout settings have changed' : 'Schema is already up to date'
                    }
                })
            }

            const oldSnapshot = application.schemaSnapshot as SchemaSnapshot | null
            const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)
            const hasDestructiveChanges = diff.destructive.length > 0

            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName, snapshot })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName, snapshot })
            const addedTableEntityIds = new Set<string>(
                diff.additive
                    .filter((change: SchemaChange) => change.type === 'ADD_TABLE' && Boolean(change.entityId))
                    .map((change: SchemaChange) => String(change.entityId))
            )
            const createTables = buildCreateTableDetails({
                entities: catalogDefs,
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

            // Snapshot hash can change without any DDL changes (e.g., attribute reorder, labels, validations).
            // We still need to allow users to "apply" changes so system metadata tables are synced and the
            // applied snapshot hash is advanced by the sync endpoint.
            const systemMetadataNeedsUpdate =
                Boolean(snapshotHash && lastAppliedHash && snapshotHash !== lastAppliedHash) &&
                !diff.hasChanges &&
                !uiNeedsUpdate &&
                !layoutsNeedUpdate
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
                    hasChanges: diff.hasChanges || uiNeedsUpdate || layoutsNeedUpdate || systemMetadataNeedsUpdate,
                    hasDestructiveChanges,
                    additive,
                    destructive: diff.destructive.map((c: SchemaChange) => c.description),
                    summaryKey: systemMetadataNeedsUpdate
                        ? 'schema.metadata.changed'
                        : !diff.hasChanges && (uiNeedsUpdate || layoutsNeedUpdate)
                        ? 'ui.layout.changed'
                        : undefined,
                    summary: systemMetadataNeedsUpdate
                        ? 'System metadata will be updated'
                        : !diff.hasChanges && (uiNeedsUpdate || layoutsNeedUpdate)
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
        })
    )

    return router
}
