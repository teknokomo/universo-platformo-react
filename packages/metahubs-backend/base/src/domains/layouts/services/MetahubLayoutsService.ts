import { z } from 'zod'
import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import {
    DASHBOARD_LAYOUT_WIDGETS,
    DASHBOARD_LAYOUT_ZONES,
    type DashboardLayoutWidgetKey,
    type DashboardLayoutZone,
    type VersionedLocalizedContent
} from '@universo/types'
import { escapeLikeWildcards } from '@universo/utils'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { DEFAULT_DASHBOARD_ZONE_WIDGETS, buildDashboardLayoutConfig } from '../../shared'
import { MetahubNotFoundError, MetahubConflictError, MetahubValidationError } from '../../shared/domainErrors'

export type LayoutTemplateKey = 'dashboard'

export interface MetahubLayoutRow {
    id: string
    templateKey: LayoutTemplateKey
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    config: Record<string, unknown>
    isActive: boolean
    isDefault: boolean
    sortOrder: number
    version: number
    createdAt: string
    updatedAt: string
}

export interface DashboardLayoutZoneWidgetRow {
    id: string
    layoutId: string
    zone: DashboardLayoutZone
    widgetKey: DashboardLayoutWidgetKey
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export interface LayoutListOptions {
    limit?: number
    offset?: number
    sortBy?: 'name' | 'created' | 'updated'
    sortOrder?: 'asc' | 'desc'
    search?: string
    includeDeleted?: boolean
}

type DbRow = Record<string, unknown>

type ZoneSortOrderRow = {
    id: string
    sort_order?: number
}

type ZoneWidgetConfigRow = {
    widget_key: unknown
    zone: unknown
    is_active?: boolean
}

export const LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY = '__skipDefaultZoneWidgetSeed'

const layoutTemplateKeySchema = z.literal('dashboard')
const layoutZoneSchema = z.enum(DASHBOARD_LAYOUT_ZONES)
const layoutWidgetKeySchema = z.enum(
    DASHBOARD_LAYOUT_WIDGETS.map((w) => w.key) as [DashboardLayoutWidgetKey, ...DashboardLayoutWidgetKey[]]
)

const allowedZonesMap = new Map<DashboardLayoutWidgetKey, readonly DashboardLayoutZone[]>(
    DASHBOARD_LAYOUT_WIDGETS.map((w) => [w.key, w.allowedZones])
)

const multiInstanceSet = new Set<DashboardLayoutWidgetKey>(DASHBOARD_LAYOUT_WIDGETS.filter((w) => w.multiInstance).map((w) => w.key))

export const createLayoutSchema = z
    .object({
        templateKey: layoutTemplateKeySchema.default('dashboard'),
        name: z.any(),
        description: z.any().optional().nullable(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        config: z.record(z.unknown()).optional()
    })
    .strict()

export const updateLayoutSchema = z
    .object({
        templateKey: layoutTemplateKeySchema.optional(),
        name: z.any().optional(),
        description: z.any().optional().nullable(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        config: z.record(z.unknown()).optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const assignLayoutZoneWidgetSchema = z
    .object({
        zone: layoutZoneSchema,
        widgetKey: layoutWidgetKeySchema,
        sortOrder: z.number().int().positive().optional(),
        config: z.record(z.unknown()).optional()
    })
    .strict()

export const moveLayoutZoneWidgetSchema = z
    .object({
        widgetId: z.string().uuid(),
        targetZone: layoutZoneSchema.optional(),
        targetIndex: z.number().int().min(0).optional()
    })
    .strict()

export const updateLayoutZoneWidgetConfigSchema = z
    .object({
        config: z.record(z.unknown())
    })
    .strict()

export const toggleLayoutZoneWidgetActiveSchema = z
    .object({
        isActive: z.boolean()
    })
    .strict()

export class MetahubLayoutsService {
    constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

    private createConflictError(message: string): MetahubConflictError {
        return new MetahubConflictError(message)
    }

    private createNotFoundError(message: string): MetahubNotFoundError {
        return new MetahubNotFoundError(message, '')
    }

    private shouldSkipDefaultZoneWidgetSeed(layoutConfig: unknown): boolean {
        if (!layoutConfig || typeof layoutConfig !== 'object') {
            return false
        }

        return (layoutConfig as Record<string, unknown>)[LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY] === true
    }

    private mapRow(row: DbRow): MetahubLayoutRow {
        return {
            id: String(row.id),
            templateKey: (row.template_key ?? 'dashboard') as LayoutTemplateKey,
            name: row.name as VersionedLocalizedContent<string>,
            description: (row.description as VersionedLocalizedContent<string> | null) ?? null,
            config: (row.config as Record<string, unknown>) ?? {},
            isActive: Boolean(row.is_active),
            isDefault: Boolean(row.is_default),
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            version: typeof row._upl_version === 'number' ? row._upl_version : 1,
            createdAt: String(row._upl_created_at),
            updatedAt: String(row._upl_updated_at)
        }
    }

    private mapZoneWidgetRow(row: DbRow): DashboardLayoutZoneWidgetRow {
        return {
            id: String(row.id),
            layoutId: String(row.layout_id),
            zone: String(row.zone) as DashboardLayoutZone,
            widgetKey: String(row.widget_key) as DashboardLayoutWidgetKey,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1,
            config: (row.config as Record<string, unknown>) ?? {},
            isActive: row.is_active !== false,
            createdAt: String(row._upl_created_at),
            updatedAt: String(row._upl_updated_at)
        }
    }

    private assertWidgetAllowedInZone(widgetKey: DashboardLayoutWidgetKey, zone: DashboardLayoutZone): void {
        const allowedZones = allowedZonesMap.get(widgetKey)
        if (!allowedZones || !allowedZones.includes(zone)) {
            throw new MetahubValidationError(`Widget "${widgetKey}" is not allowed in zone "${zone}"`)
        }
    }

    private async normalizeZoneSortOrders(
        db: SqlQueryable,
        schemaName: string,
        layoutId: string,
        zone: DashboardLayoutZone,
        userId?: string | null
    ): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_widgets')
        const rows = await queryMany<ZoneSortOrderRow>(
            db,
            `SELECT id, sort_order FROM ${qt}
             WHERE layout_id = $1 AND zone = $2 AND _upl_deleted = false AND _mhb_deleted = false
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [layoutId, zone]
        )

        const now = new Date()
        for (let i = 0; i < rows.length; i += 1) {
            const nextOrder = i + 1
            if (rows[i].sort_order === nextOrder) continue
            await db.query(
                `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                 WHERE id = $4`,
                [nextOrder, now, userId ?? null, rows[i].id]
            )
        }
    }

    private async syncLayoutConfigFromZoneWidgets(
        db: SqlQueryable,
        schemaName: string,
        layoutId: string,
        userId?: string | null
    ): Promise<void> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const widgets = await queryMany<ZoneWidgetConfigRow>(
            db,
            `SELECT widget_key, zone, is_active FROM ${wt}
             WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId]
        )
        const layoutRow = await queryOne<{ config?: unknown }>(
            db,
            `SELECT config FROM ${lt} WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId]
        )

        const activeWidgets = widgets.filter((row) => row.is_active !== false)
        const currentConfig = layoutRow?.config && typeof layoutRow.config === 'object' ? layoutRow.config : {}
        const nextConfig = {
            ...currentConfig,
            ...buildDashboardLayoutConfig(
                activeWidgets.map((row) => ({
                    widgetKey: String(row.widget_key) as DashboardLayoutWidgetKey,
                    zone: String(row.zone) as DashboardLayoutZone
                }))
            )
        }

        await db.query(
            `UPDATE ${lt} SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
             WHERE id = $4 AND _upl_deleted = false AND _mhb_deleted = false`,
            [JSON.stringify(nextConfig), new Date(), userId ?? null, layoutId]
        )
    }

    private async ensureDefaultZoneWidgets(db: SqlQueryable, schemaName: string, layoutId: string, userId?: string | null): Promise<void> {
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')

        const layoutRow = await queryOne<{ config?: unknown }>(
            db,
            `SELECT config FROM ${lt} WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId]
        )

        if (!layoutRow) {
            return
        }

        if (this.shouldSkipDefaultZoneWidgetSeed(layoutRow.config)) {
            return
        }

        const [countRow] = await db.query<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM ${wt}
             WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId]
        )
        const count = countRow?.count ?? 0
        if (count > 0) {
            return
        }

        const now = new Date()
        for (const item of DEFAULT_DASHBOARD_ZONE_WIDGETS) {
            await db.query(
                `INSERT INTO ${wt} (layout_id, zone, widget_key, sort_order, config, is_active,
                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                    _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                    _mhb_published, _mhb_archived, _mhb_deleted)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $8, 1, false, false, false, true, false, false)`,
                [
                    layoutId,
                    item.zone,
                    item.widgetKey,
                    item.sortOrder,
                    JSON.stringify(item.config ?? {}),
                    item.isActive !== false,
                    now,
                    userId ?? null
                ]
            )
        }
        await this.syncLayoutConfigFromZoneWidgets(db, schemaName, layoutId, userId)
    }

    async listLayouts(metahubId: string, options: LayoutListOptions, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const { limit = 20, offset = 0, sortBy = 'updated', sortOrder = 'desc', search, includeDeleted = false } = options

        const conditions: string[] = []
        const params: unknown[] = []
        let idx = 1

        if (!includeDeleted) {
            conditions.push('_upl_deleted = false AND _mhb_deleted = false')
        }
        if (search) {
            const escaped = escapeLikeWildcards(search)
            conditions.push(`(COALESCE(name::text, '') ILIKE $${idx} OR COALESCE(description::text, '') ILIKE $${idx})`)
            params.push(`%${escaped}%`)
            idx++
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        const [totalRow] = await this.exec.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM ${lt} ${whereClause}`, params)
        const total = totalRow?.count ?? 0

        const orderColumn =
            sortBy === 'name'
                ? "COALESCE(name->'locales'->(name->>'_primary')->>'content', name->'locales'->'en'->>'content', '')"
                : sortBy === 'created'
                ? '_upl_created_at'
                : '_upl_updated_at'
        const dir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        const dataParams = [...params, limit, offset]
        const rows = await queryMany<DbRow>(
            this.exec,
            `SELECT * FROM ${lt} ${whereClause}
             ORDER BY ${orderColumn} ${dir}, sort_order ASC, _upl_created_at ASC
             LIMIT $${idx} OFFSET $${idx + 1}`,
            dataParams
        )

        return {
            items: rows.map((r) => this.mapRow(r)),
            pagination: { total, limit, offset }
        }
    }

    async getLayoutById(metahubId: string, layoutId: string, userId?: string): Promise<MetahubLayoutRow | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const row = await queryOne<DbRow>(
            this.exec,
            `SELECT * FROM ${lt} WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId]
        )
        return row ? this.mapRow(row) : null
    }

    async createLayout(metahubId: string, input: z.infer<typeof createLayoutSchema>, userId?: string | null): Promise<MetahubLayoutRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const now = new Date()

        const isActive = input.isActive ?? true
        const isDefault = input.isDefault ?? false
        if (isDefault && !isActive) {
            throw this.createConflictError('Default layout must be active')
        }

        return this.exec.transaction(async (tx: SqlQueryable) => {
            if (isDefault) {
                await tx.query(
                    `UPDATE ${lt} SET is_default = false, _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                     WHERE _upl_deleted = false AND _mhb_deleted = false`,
                    [now, userId ?? null]
                )
            }

            const defaultConfig = buildDashboardLayoutConfig(DEFAULT_DASHBOARD_ZONE_WIDGETS.filter((w) => w.isActive !== false))
            const created = await queryOneOrThrow<DbRow>(
                tx,
                `INSERT INTO ${lt} (template_key, name, description, config, is_active, is_default, sort_order, owner_id,
                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                    _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                    _mhb_published, _mhb_archived, _mhb_deleted)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $10, 1, false, false, false, true, false, false)
                 RETURNING *`,
                [
                    input.templateKey ?? 'dashboard',
                    JSON.stringify(input.name),
                    input.description ? JSON.stringify(input.description) : null,
                    JSON.stringify(input.config ?? defaultConfig),
                    isActive,
                    isDefault,
                    input.sortOrder ?? 0,
                    null,
                    now,
                    userId ?? null
                ]
            )

            await this.ensureDefaultZoneWidgets(tx, schemaName, String(created.id), userId ?? null)
            return this.mapRow(created)
        })
    }

    async updateLayout(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof updateLayoutSchema>,
        userId?: string | null
    ): Promise<MetahubLayoutRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const now = new Date()

        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        // BUG-3 fix: All reads + writes inside a single transaction to prevent TOCTOU races
        return this.exec.transaction(async (tx: SqlQueryable) => {
            const existing = await queryOne<DbRow>(tx, `SELECT * FROM ${lt} WHERE id = $1 AND ${ACTIVE} FOR UPDATE`, [layoutId])
            if (!existing) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }

            const nextIsActive = input.isActive ?? Boolean(existing.is_active)
            const nextIsDefault = input.isDefault ?? Boolean(existing.is_default)

            if (nextIsDefault && !nextIsActive) {
                throw this.createConflictError('Default layout must be active')
            }

            // Prevent unsetting the last default layout.
            if (Boolean(existing.is_default) && !nextIsDefault) {
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_default = true`
                )
                const defaultCount = countRow?.count ?? 0
                if (Number.isFinite(defaultCount) && defaultCount <= 1) {
                    throw this.createConflictError('At least one default layout is required')
                }
            }

            // Prevent deactivating the last active layout.
            if (!nextIsActive) {
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_active = true`
                )
                const activeCount = countRow?.count ?? 0
                if (Number.isFinite(activeCount) && activeCount <= 1) {
                    throw this.createConflictError('At least one active layout is required')
                }
            }

            if (nextIsDefault) {
                await tx.query(
                    `UPDATE ${lt} SET is_default = false, _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                     WHERE ${ACTIVE} AND id != $3`,
                    [now, userId ?? null, layoutId]
                )
            }

            const updateData: Record<string, unknown> = {
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null
            }
            if (input.templateKey) updateData.template_key = input.templateKey
            if (input.name !== undefined) updateData.name = JSON.stringify(input.name)
            if (input.description !== undefined)
                updateData.description = input.description != null ? JSON.stringify(input.description) : null
            if (input.config !== undefined) updateData.config = input.config != null ? JSON.stringify(input.config) : null
            if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder
            if (input.isActive !== undefined) updateData.is_active = nextIsActive
            if (input.isDefault !== undefined) updateData.is_default = nextIsDefault

            const updated = input.expectedVersion
                ? await updateWithVersionCheck({
                      executor: tx as DbExecutor,
                      schemaName,
                      tableName: '_mhb_layouts',
                      entityId: layoutId,
                      entityType: 'layout',
                      expectedVersion: input.expectedVersion,
                      updateData
                  })
                : await incrementVersion(tx, schemaName, '_mhb_layouts', layoutId, updateData)

            return this.mapRow(updated)
        })
    }

    async deleteLayout(metahubId: string, layoutId: string, userId?: string | null): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
        const now = new Date()

        // BUG-2 fix: All reads + writes inside a single transaction to prevent TOCTOU races
        await this.exec.transaction(async (tx: SqlQueryable) => {
            const existing = await queryOne<DbRow>(tx, `SELECT * FROM ${lt} WHERE id = $1 AND ${ACTIVE} FOR UPDATE`, [layoutId])
            if (!existing) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            if (existing.is_default) {
                throw this.createConflictError('Cannot delete default layout')
            }

            if (existing.is_active) {
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_active = true`
                )
                const activeCount = countRow?.count ?? 0
                if (Number.isFinite(activeCount) && activeCount <= 1) {
                    throw this.createConflictError('At least one active layout is required')
                }
            }

            // Cascade: soft-delete all zone widgets belonging to this layout
            await tx.query(
                `UPDATE ${wt} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                    _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                 WHERE layout_id = $3 AND ${ACTIVE}`,
                [now, userId ?? null, layoutId]
            )

            // Soft-delete the layout itself
            await tx.query(
                `UPDATE ${lt} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                    _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                 WHERE id = $3`,
                [now, userId ?? null, layoutId]
            )
        })
    }

    async listLayoutZoneWidgets(metahubId: string, layoutId: string, userId?: string | null): Promise<DashboardLayoutZoneWidgetRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        const layout = await queryOne<DbRow>(this.exec, `SELECT * FROM ${lt} WHERE id = $1 AND ${ACTIVE}`, [layoutId])
        if (!layout) {
            throw new MetahubNotFoundError('Layout', layoutId)
        }

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureDefaultZoneWidgets(tx, schemaName, layoutId, userId ?? null)
            const rows = await queryMany<DbRow>(
                tx,
                `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
                 ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
                [layoutId]
            )
            return rows.map((row) => this.mapZoneWidgetRow(row))
        })
    }

    async assignLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof assignLayoutZoneWidgetSchema>,
        userId?: string | null
    ): Promise<DashboardLayoutZoneWidgetRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        this.assertWidgetAllowedInZone(input.widgetKey, input.zone)

        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureDefaultZoneWidgets(tx, schemaName, layoutId, userId ?? null)

            const now = new Date()
            const zoneRows = await queryMany<{ id: string }>(tx, `SELECT id FROM ${wt} WHERE layout_id = $1 AND zone = $2 AND ${ACTIVE}`, [
                layoutId,
                input.zone
            ])
            const nextSortOrder = input.sortOrder ?? zoneRows.length + 1

            const isMulti = multiInstanceSet.has(input.widgetKey)

            if (!isMulti) {
                // Single-instance widget: update existing or insert new
                const existing = await queryOne<DbRow>(tx, `SELECT * FROM ${wt} WHERE layout_id = $1 AND widget_key = $2 AND ${ACTIVE}`, [
                    layoutId,
                    input.widgetKey
                ])

                if (existing) {
                    const configValue = input.config ?? existing.config ?? {}
                    await tx.query(
                        `UPDATE ${wt} SET zone = $1, sort_order = $2, config = $3,
                            _upl_updated_at = $4, _upl_updated_by = $5, _upl_version = _upl_version + 1
                         WHERE id = $6`,
                        [input.zone, nextSortOrder, JSON.stringify(configValue), now, userId ?? null, existing.id]
                    )
                    if (existing.zone !== input.zone) {
                        await this.normalizeZoneSortOrders(tx, schemaName, layoutId, existing.zone as DashboardLayoutZone, userId ?? null)
                    }

                    await this.normalizeZoneSortOrders(tx, schemaName, layoutId, input.zone, userId ?? null)
                    await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

                    const updated = await queryOneOrThrow<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1`, [existing.id])
                    return this.mapZoneWidgetRow(updated)
                }
            }

            // Multi-instance widget always inserts; single-instance falls through here when no existing row
            const inserted = await queryOneOrThrow<DbRow>(
                tx,
                `INSERT INTO ${wt} (layout_id, zone, widget_key, sort_order, config, is_active,
                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                    _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                    _mhb_published, _mhb_archived, _mhb_deleted)
                 VALUES ($1, $2, $3, $4, $5, true, $6, $7, $6, $7, 1, false, false, false, true, false, false)
                 RETURNING *`,
                [layoutId, input.zone, input.widgetKey, nextSortOrder, JSON.stringify(input.config ?? {}), now, userId ?? null]
            )

            await this.normalizeZoneSortOrders(tx, schemaName, layoutId, input.zone, userId ?? null)
            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

            return this.mapZoneWidgetRow(inserted)
        })
    }

    async moveLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof moveLayoutZoneWidgetSchema>,
        userId?: string | null
    ): Promise<DashboardLayoutZoneWidgetRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)

        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureDefaultZoneWidgets(tx, schemaName, layoutId, userId ?? null)

            const current = await queryOne<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1 AND layout_id = $2 AND ${ACTIVE}`, [
                input.widgetId,
                layoutId
            ])
            if (!current) throw new MetahubNotFoundError('Layout widget', input.widgetId)

            const widgetKey = String(current.widget_key) as DashboardLayoutWidgetKey
            const sourceZone = String(current.zone) as DashboardLayoutZone
            const targetZone = input.targetZone ?? sourceZone
            this.assertWidgetAllowedInZone(widgetKey, targetZone)

            const targetRows = await queryMany<{ id: string; sort_order: number }>(
                tx,
                `SELECT id, sort_order FROM ${wt}
                 WHERE layout_id = $1 AND zone = $2 AND ${ACTIVE} AND id != $3
                 ORDER BY sort_order ASC, _upl_created_at ASC`,
                [layoutId, targetZone, input.widgetId]
            )

            const clampedIndex =
                typeof input.targetIndex === 'number' ? Math.max(0, Math.min(input.targetIndex, targetRows.length)) : targetRows.length
            const targetSortOrder = clampedIndex + 1

            await tx.query(
                `UPDATE ${wt} SET zone = $1, sort_order = $2,
                    _upl_updated_at = $3, _upl_updated_by = $4, _upl_version = _upl_version + 1
                 WHERE id = $5`,
                [targetZone, targetSortOrder, new Date(), userId ?? null, current.id]
            )

            await this.normalizeZoneSortOrders(tx, schemaName, layoutId, sourceZone, userId ?? null)
            if (targetZone !== sourceZone) {
                await this.normalizeZoneSortOrders(tx, schemaName, layoutId, targetZone, userId ?? null)
            }

            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

            const rows = await queryMany<DbRow>(
                tx,
                `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
                 ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
                [layoutId]
            )
            return rows.map((row) => this.mapZoneWidgetRow(row))
        })
    }

    async removeLayoutZoneWidget(metahubId: string, layoutId: string, widgetId: string, userId?: string | null): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        await this.exec.transaction(async (tx: SqlQueryable) => {
            const current = await queryOne<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1 AND layout_id = $2 AND ${ACTIVE}`, [
                widgetId,
                layoutId
            ])
            if (!current) return

            const now = new Date()
            await tx.query(
                `UPDATE ${wt} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                    _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                 WHERE id = $3`,
                [now, userId ?? null, current.id]
            )

            await this.normalizeZoneSortOrders(tx, schemaName, layoutId, current.zone as DashboardLayoutZone, userId ?? null)
            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
        })
    }

    /**
     * Update the JSONB config of a specific zone widget.
     * Used primarily to store menu configuration inside menuWidget.
     */
    async updateLayoutZoneWidgetConfig(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        config: Record<string, unknown>,
        userId?: string | null
    ): Promise<DashboardLayoutZoneWidgetRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            const current = await queryOne<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1 AND layout_id = $2 AND ${ACTIVE}`, [
                widgetId,
                layoutId
            ])
            if (!current) {
                throw this.createNotFoundError('Zone widget not found')
            }

            const now = new Date()
            await tx.query(
                `UPDATE ${wt} SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                 WHERE id = $4`,
                [JSON.stringify(config), now, userId ?? null, current.id]
            )

            const updated = await queryOneOrThrow<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1`, [current.id])

            return this.mapZoneWidgetRow(updated)
        })
    }

    /**
     * Toggle the is_active flag of a specific zone widget.
     * When deactivated, the widget is excluded from published layout config.
     */
    async toggleLayoutZoneWidgetActive(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        isActive: boolean,
        userId?: string | null
    ): Promise<DashboardLayoutZoneWidgetRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            const current = await queryOne<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1 AND layout_id = $2 AND ${ACTIVE}`, [
                widgetId,
                layoutId
            ])
            if (!current) {
                throw this.createNotFoundError('Zone widget not found')
            }

            const now = new Date()
            await tx.query(
                `UPDATE ${wt} SET is_active = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                 WHERE id = $4`,
                [isActive, now, userId ?? null, current.id]
            )

            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

            const updated = await queryOneOrThrow<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1`, [current.id])
            return this.mapZoneWidgetRow(updated)
        })
    }
}
