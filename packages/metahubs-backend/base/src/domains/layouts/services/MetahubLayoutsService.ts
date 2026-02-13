import { z } from 'zod'
import {
    DASHBOARD_LAYOUT_WIDGETS,
    DASHBOARD_LAYOUT_ZONES,
    type DashboardLayoutWidgetKey,
    type DashboardLayoutZone,
    type VersionedLocalizedContent
} from '@universo/types'
import { escapeLikeWildcards } from '@universo/utils'
import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { DEFAULT_DASHBOARD_ZONE_WIDGETS, buildDashboardLayoutConfig } from '../../shared'

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

const layoutTemplateKeySchema = z.literal('dashboard')
const layoutZoneSchema = z.enum(DASHBOARD_LAYOUT_ZONES)
const layoutWidgetKeySchema = z.enum(
    DASHBOARD_LAYOUT_WIDGETS.map((w) => w.key) as [DashboardLayoutWidgetKey, ...DashboardLayoutWidgetKey[]]
)

const allowedZonesMap = new Map<DashboardLayoutWidgetKey, readonly DashboardLayoutZone[]>(
    DASHBOARD_LAYOUT_WIDGETS.map((w) => [w.key, w.allowedZones])
)

const multiInstanceSet = new Set<DashboardLayoutWidgetKey>(DASHBOARD_LAYOUT_WIDGETS.filter((w) => w.multiInstance).map((w) => w.key))

export const createLayoutSchema = z.object({
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

export const updateLayoutSchema = z.object({
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

export const assignLayoutZoneWidgetSchema = z.object({
    zone: layoutZoneSchema,
    widgetKey: layoutWidgetKeySchema,
    sortOrder: z.number().int().positive().optional(),
    config: z.record(z.unknown()).optional()
})

export const moveLayoutZoneWidgetSchema = z.object({
    widgetId: z.string().uuid(),
    targetZone: layoutZoneSchema.optional(),
    targetIndex: z.number().int().min(0).optional()
})

export const updateLayoutZoneWidgetConfigSchema = z.object({
    config: z.record(z.unknown())
})

export const toggleLayoutZoneWidgetActiveSchema = z.object({
    isActive: z.boolean()
})

export class MetahubLayoutsService {
    constructor(private readonly schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    private mapRow(row: any): MetahubLayoutRow {
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

    private mapZoneWidgetRow(row: any): DashboardLayoutZoneWidgetRow {
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
            throw new Error(`Widget "${widgetKey}" is not allowed in zone "${zone}"`)
        }
    }

    private async normalizeZoneSortOrders(
        trx: any,
        schemaName: string,
        layoutId: string,
        zone: DashboardLayoutZone,
        userId?: string | null
    ): Promise<void> {
        const rows = await trx
            .withSchema(schemaName)
            .from('_mhb_widgets')
            .where({ layout_id: layoutId, zone, _upl_deleted: false, _mhb_deleted: false })
            .orderBy([
                { column: 'sort_order', order: 'asc' },
                { column: '_upl_created_at', order: 'asc' }
            ])
            .select(['id', 'sort_order'])

        for (let i = 0; i < rows.length; i += 1) {
            const nextOrder = i + 1
            if (rows[i].sort_order === nextOrder) continue
            await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: rows[i].id })
                .update({
                    sort_order: nextOrder,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: userId ?? null,
                    _upl_version: trx.raw('_upl_version + 1')
                })
        }
    }

    private async syncLayoutConfigFromZoneWidgets(trx: any, schemaName: string, layoutId: string, userId?: string | null): Promise<void> {
        const widgets = await trx
            .withSchema(schemaName)
            .from('_mhb_widgets')
            .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
            .select(['widget_key', 'zone', 'is_active'])

        const activeWidgets = widgets.filter((row: any) => row.is_active !== false)
        const nextConfig = buildDashboardLayoutConfig(
            activeWidgets.map((row: any) => ({
                widgetKey: row.widget_key as DashboardLayoutWidgetKey,
                zone: row.zone as DashboardLayoutZone
            }))
        )

        await trx
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ id: layoutId, _upl_deleted: false, _mhb_deleted: false })
            .update({
                config: nextConfig,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null,
                _upl_version: trx.raw('_upl_version + 1')
            })
    }

    private async ensureDefaultZoneWidgets(trx: any, schemaName: string, layoutId: string, userId?: string | null): Promise<void> {
        const countRow = (await trx
            .withSchema(schemaName)
            .from('_mhb_widgets')
            .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
            .count('* as count')
            .first()) as { count?: string | number } | undefined
        const count = countRow ? Number(countRow.count) : 0
        if (Number.isFinite(count) && count > 0) {
            return
        }

        const now = new Date()
        await trx
            .withSchema(schemaName)
            .into('_mhb_widgets')
            .insert(
                DEFAULT_DASHBOARD_ZONE_WIDGETS.map((item) => ({
                    layout_id: layoutId,
                    zone: item.zone,
                    widget_key: item.widgetKey,
                    sort_order: item.sortOrder,
                    config: item.config ?? {},
                    is_active: item.isActive !== false,
                    _upl_created_at: now,
                    _upl_created_by: userId ?? null,
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                }))
            )
        await this.syncLayoutConfigFromZoneWidgets(trx, schemaName, layoutId, userId)
    }

    async listLayouts(metahubId: string, options: LayoutListOptions, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const { limit = 20, offset = 0, sortBy = 'updated', sortOrder = 'desc', search, includeDeleted = false } = options

        const baseQuery = this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .modify((qb) => {
                if (!includeDeleted) {
                    qb.where({ _upl_deleted: false, _mhb_deleted: false })
                }
                if (search) {
                    const escaped = escapeLikeWildcards(search)
                    qb.andWhereRaw(`(COALESCE(name::text, '') ILIKE ? OR COALESCE(description::text, '') ILIKE ?)`, [
                        `%${escaped}%`,
                        `%${escaped}%`
                    ])
                }
            })

        const totalRow = await baseQuery.clone().count<{ count: string }[]>('* as count').first()
        const total = totalRow ? Number(totalRow.count) : 0

        const orderColumn =
            sortBy === 'name'
                ? "COALESCE(name->'locales'->>(name->>'_primary'), name->'locales'->>'en', '')"
                : sortBy === 'created'
                ? '_upl_created_at'
                : '_upl_updated_at'

        const rows = await baseQuery
            .clone()
            .select('*')
            .orderByRaw(`${orderColumn} ${sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`)
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')
            .limit(limit)
            .offset(offset)

        return {
            items: rows.map((r: any) => this.mapRow(r)),
            pagination: { total, limit, offset }
        }
    }

    async getLayoutById(metahubId: string, layoutId: string, userId?: string): Promise<MetahubLayoutRow | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ id: layoutId, _upl_deleted: false, _mhb_deleted: false })
            .first()
        return row ? this.mapRow(row) : null
    }

    async createLayout(metahubId: string, input: z.infer<typeof createLayoutSchema>, userId?: string | null): Promise<MetahubLayoutRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const now = new Date()

        const isActive = input.isActive ?? true
        const isDefault = input.isDefault ?? false
        if (isDefault && !isActive) {
            throw new Error('Default layout must be active')
        }

        return this.knex.transaction(async (trx) => {
            if (isDefault) {
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_layouts')
                    .where({ _upl_deleted: false, _mhb_deleted: false })
                    .update({
                        is_default: false,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: trx.raw('_upl_version + 1')
                    })
            }

            const [created] = await trx
                .withSchema(schemaName)
                .into('_mhb_layouts')
                .insert({
                    template_key: input.templateKey ?? 'dashboard',
                    name: input.name,
                    description: input.description ?? null,
                    config: input.config ?? buildDashboardLayoutConfig(
                        DEFAULT_DASHBOARD_ZONE_WIDGETS.filter((w) => w.isActive !== false)
                    ),
                    is_active: isActive,
                    is_default: isDefault,
                    sort_order: input.sortOrder ?? 0,
                    owner_id: null,
                    _upl_created_at: now,
                    _upl_created_by: userId ?? null,
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('*')

            await this.ensureDefaultZoneWidgets(trx, schemaName, created.id, userId ?? null)
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

        // BUG-3 fix: All reads + writes inside a single transaction to prevent TOCTOU races
        return this.knex.transaction(async (trx) => {
            const existing = await trx
                .withSchema(schemaName)
                .from('_mhb_layouts')
                .where({ id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .forUpdate()
                .first()
            if (!existing) {
                throw new Error('Layout not found')
            }

            const nextIsActive = input.isActive ?? Boolean(existing.is_active)
            const nextIsDefault = input.isDefault ?? Boolean(existing.is_default)

            if (nextIsDefault && !nextIsActive) {
                throw new Error('Default layout must be active')
            }

            // Prevent unsetting the last default layout.
            if (Boolean(existing.is_default) && !nextIsDefault) {
                const defaultCountRow = await trx
                    .withSchema(schemaName)
                    .from('_mhb_layouts')
                    .where({ _upl_deleted: false, _mhb_deleted: false, is_default: true })
                    .count<{ count: string }[]>('* as count')
                    .first()
                const defaultCount = defaultCountRow ? Number(defaultCountRow.count) : 0
                if (Number.isFinite(defaultCount) && defaultCount <= 1) {
                    throw new Error('At least one default layout is required')
                }
            }

            // Prevent deactivating the last active layout.
            if (!nextIsActive) {
                const activeCountRow = await trx
                    .withSchema(schemaName)
                    .from('_mhb_layouts')
                    .where({ _upl_deleted: false, _mhb_deleted: false, is_active: true })
                    .count<{ count: string }[]>('* as count')
                    .first()
                const activeCount = activeCountRow ? Number(activeCountRow.count) : 0
                if (Number.isFinite(activeCount) && activeCount <= 1) {
                    throw new Error('At least one active layout is required')
                }
            }

            if (nextIsDefault) {
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_layouts')
                    .where({ _upl_deleted: false, _mhb_deleted: false })
                    .whereNot({ id: layoutId })
                    .update({
                        is_default: false,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: trx.raw('_upl_version + 1')
                    })
            }

            const updateData: Record<string, unknown> = {
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null
            }
            if (input.templateKey) updateData.template_key = input.templateKey
            if (input.name !== undefined) updateData.name = input.name
            if (input.description !== undefined) updateData.description = input.description
            if (input.config !== undefined) updateData.config = input.config
            if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder
            if (input.isActive !== undefined) updateData.is_active = nextIsActive
            if (input.isDefault !== undefined) updateData.is_default = nextIsDefault

            const updated = input.expectedVersion
                ? await updateWithVersionCheck({
                      knex: trx as any,
                      schemaName,
                      tableName: '_mhb_layouts',
                      entityId: layoutId,
                      entityType: 'layout',
                      expectedVersion: input.expectedVersion,
                      updateData
                  })
                : await incrementVersion(trx as any, schemaName, '_mhb_layouts', layoutId, updateData)

            return this.mapRow(updated)
        })
    }

    async deleteLayout(metahubId: string, layoutId: string, userId?: string | null): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const now = new Date()

        // BUG-2 fix: All reads + writes inside a single transaction to prevent TOCTOU races
        await this.knex.transaction(async (trx) => {
            const existing = await trx
                .withSchema(schemaName)
                .from('_mhb_layouts')
                .where({ id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .forUpdate()
                .first()
            if (!existing) {
                throw new Error('Layout not found')
            }
            if (existing.is_default) {
                throw new Error('Cannot delete default layout')
            }

            const activeCountRow = await trx
                .withSchema(schemaName)
                .from('_mhb_layouts')
                .where({ _upl_deleted: false, _mhb_deleted: false, is_active: true })
                .count<{ count: string }[]>('* as count')
                .first()
            const activeCount = activeCountRow ? Number(activeCountRow.count) : 0
            if (Number.isFinite(activeCount) && activeCount <= 1) {
                throw new Error('At least one active layout is required')
            }

            // Cascade: soft-delete all zone widgets belonging to this layout
            await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .update({
                    _mhb_deleted: true,
                    _mhb_deleted_at: now,
                    _mhb_deleted_by: userId ?? null,
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null,
                    _upl_version: trx.raw('_upl_version + 1')
                })

            // Soft-delete the layout itself
            await trx
                .withSchema(schemaName)
                .from('_mhb_layouts')
                .where({ id: layoutId })
                .update({
                    _mhb_deleted: true,
                    _mhb_deleted_at: now,
                    _mhb_deleted_by: userId ?? null,
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null,
                    _upl_version: trx.raw('_upl_version + 1')
                })
        })
    }

    async listLayoutZoneWidgets(metahubId: string, layoutId: string, userId?: string | null): Promise<DashboardLayoutZoneWidgetRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)

        const layout = await this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ id: layoutId, _upl_deleted: false, _mhb_deleted: false })
            .first()
        if (!layout) {
            throw new Error('Layout not found')
        }

        return this.knex.transaction(async (trx) => {
            await this.ensureDefaultZoneWidgets(trx, schemaName, layoutId, userId ?? null)
            const rows = await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .orderBy([
                    { column: 'zone', order: 'asc' },
                    { column: 'sort_order', order: 'asc' },
                    { column: '_upl_created_at', order: 'asc' }
                ])
            return rows.map((row: any) => this.mapZoneWidgetRow(row))
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

        return this.knex.transaction(async (trx) => {
            await this.ensureDefaultZoneWidgets(trx, schemaName, layoutId, userId ?? null)

            const now = new Date()
            const zoneRows = await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ layout_id: layoutId, zone: input.zone, _upl_deleted: false, _mhb_deleted: false })
                .select(['id'])
            const nextSortOrder = input.sortOrder ?? zoneRows.length + 1

            const isMulti = multiInstanceSet.has(input.widgetKey)

            if (!isMulti) {
                // Single-instance widget: update existing or insert new
                const existing = await trx
                    .withSchema(schemaName)
                    .from('_mhb_widgets')
                    .where({ layout_id: layoutId, widget_key: input.widgetKey, _upl_deleted: false, _mhb_deleted: false })
                    .first()

                if (existing) {
                    await trx
                        .withSchema(schemaName)
                        .from('_mhb_widgets')
                        .where({ id: existing.id })
                        .update({
                            zone: input.zone,
                            sort_order: nextSortOrder,
                            config: input.config ?? existing.config ?? {},
                            _upl_updated_at: now,
                            _upl_updated_by: userId ?? null,
                            _upl_version: trx.raw('_upl_version + 1')
                        })
                    if (existing.zone !== input.zone) {
                        await this.normalizeZoneSortOrders(trx, schemaName, layoutId, existing.zone as DashboardLayoutZone, userId ?? null)
                    }

                    await this.normalizeZoneSortOrders(trx, schemaName, layoutId, input.zone, userId ?? null)
                    await this.syncLayoutConfigFromZoneWidgets(trx, schemaName, layoutId, userId ?? null)

                    const updated = await trx.withSchema(schemaName).from('_mhb_widgets').where({ id: existing.id }).first()
                    return this.mapZoneWidgetRow(updated)
                }
            }

            // Multi-instance widget always inserts; single-instance falls through here when no existing row
            const [inserted] = await trx
                .withSchema(schemaName)
                .into('_mhb_widgets')
                .insert({
                    layout_id: layoutId,
                    zone: input.zone,
                    widget_key: input.widgetKey,
                    sort_order: nextSortOrder,
                    config: input.config ?? {},
                    is_active: true,
                    _upl_created_at: now,
                    _upl_created_by: userId ?? null,
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('*')

            await this.normalizeZoneSortOrders(trx, schemaName, layoutId, input.zone, userId ?? null)
            await this.syncLayoutConfigFromZoneWidgets(trx, schemaName, layoutId, userId ?? null)

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

        return this.knex.transaction(async (trx) => {
            await this.ensureDefaultZoneWidgets(trx, schemaName, layoutId, userId ?? null)

            const current = await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: input.widgetId, layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .first()
            if (!current) throw new Error('Layout widget not found')

            const widgetKey = String(current.widget_key) as DashboardLayoutWidgetKey
            const sourceZone = String(current.zone) as DashboardLayoutZone
            const targetZone = input.targetZone ?? sourceZone
            this.assertWidgetAllowedInZone(widgetKey, targetZone)

            const targetRows = await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ layout_id: layoutId, zone: targetZone, _upl_deleted: false, _mhb_deleted: false })
                .whereNot({ id: input.widgetId })
                .orderBy([
                    { column: 'sort_order', order: 'asc' },
                    { column: '_upl_created_at', order: 'asc' }
                ])
                .select(['id', 'sort_order'])

            const clampedIndex =
                typeof input.targetIndex === 'number' ? Math.max(0, Math.min(input.targetIndex, targetRows.length)) : targetRows.length
            const targetSortOrder = clampedIndex + 1

            await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: current.id })
                .update({
                    zone: targetZone,
                    sort_order: targetSortOrder,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: userId ?? null,
                    _upl_version: trx.raw('_upl_version + 1')
                })

            await this.normalizeZoneSortOrders(trx, schemaName, layoutId, sourceZone, userId ?? null)
            if (targetZone !== sourceZone) {
                await this.normalizeZoneSortOrders(trx, schemaName, layoutId, targetZone, userId ?? null)
            }

            await this.syncLayoutConfigFromZoneWidgets(trx, schemaName, layoutId, userId ?? null)

            const rows = await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .orderBy([
                    { column: 'zone', order: 'asc' },
                    { column: 'sort_order', order: 'asc' },
                    { column: '_upl_created_at', order: 'asc' }
                ])
            return rows.map((row: any) => this.mapZoneWidgetRow(row))
        })
    }

    async removeLayoutZoneWidget(metahubId: string, layoutId: string, widgetId: string, userId?: string | null): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        await this.knex.transaction(async (trx) => {
            const current = await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: widgetId, layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .first()
            if (!current) return

            await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: current.id })
                .update({
                    _mhb_deleted: true,
                    _mhb_deleted_at: new Date(),
                    _mhb_deleted_by: userId ?? null,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: userId ?? null,
                    _upl_version: trx.raw('_upl_version + 1')
                })

            await this.normalizeZoneSortOrders(trx, schemaName, layoutId, current.zone as DashboardLayoutZone, userId ?? null)
            await this.syncLayoutConfigFromZoneWidgets(trx, schemaName, layoutId, userId ?? null)
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
        return this.knex.transaction(async (trx) => {
            const current = await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: widgetId, layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .first()
            if (!current) {
                throw new Error('Zone widget not found')
            }

            await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: current.id })
                .update({
                    config: JSON.stringify(config),
                    _upl_updated_at: new Date(),
                    _upl_updated_by: userId ?? null,
                    _upl_version: trx.raw('_upl_version + 1')
                })

            const updated = await trx.withSchema(schemaName).from('_mhb_widgets').where({ id: current.id }).first()

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
        return this.knex.transaction(async (trx) => {
            const current = await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: widgetId, layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .first()
            if (!current) {
                throw new Error('Zone widget not found')
            }

            await trx
                .withSchema(schemaName)
                .from('_mhb_widgets')
                .where({ id: current.id })
                .update({
                    is_active: isActive,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: userId ?? null,
                    _upl_version: trx.raw('_upl_version + 1')
                })

            await this.syncLayoutConfigFromZoneWidgets(trx, schemaName, layoutId, userId ?? null)

            const updated = await trx.withSchema(schemaName).from('_mhb_widgets').where({ id: current.id }).first()
            return this.mapZoneWidgetRow(updated)
        })
    }
}
