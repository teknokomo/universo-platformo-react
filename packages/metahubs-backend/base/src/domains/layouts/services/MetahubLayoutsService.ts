import { z } from 'zod'
import type { VersionedLocalizedContent } from '@universo/types'
import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'

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

export interface LayoutListOptions {
    limit?: number
    offset?: number
    sortBy?: 'name' | 'created' | 'updated'
    sortOrder?: 'asc' | 'desc'
    search?: string
    includeDeleted?: boolean
}

const layoutTemplateKeySchema = z.literal('dashboard')

export const createLayoutSchema = z.object({
    templateKey: layoutTemplateKeySchema.default('dashboard'),
    name: z.any(),
    description: z.any().optional().nullable(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().optional()
})

export const updateLayoutSchema = z.object({
    templateKey: layoutTemplateKeySchema.optional(),
    name: z.any().optional(),
    description: z.any().optional().nullable(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    config: z.record(z.unknown()).optional(),
    expectedVersion: z.number().int().positive().optional()
})

export class MetahubLayoutsService {
    constructor(private readonly schemaService: MetahubSchemaService) { }

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

    async listLayouts(metahubId: string, options: LayoutListOptions, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const {
            limit = 20,
            offset = 0,
            sortBy = 'updated',
            sortOrder = 'desc',
            search,
            includeDeleted = false
        } = options

        const baseQuery = this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .modify((qb) => {
                if (!includeDeleted) {
                    qb.where({ _upl_deleted: false, _mhb_deleted: false })
                }
                if (search) {
                    qb.andWhereRaw(
                        `(COALESCE(name::text, '') ILIKE ? OR COALESCE(description::text, '') ILIKE ?)`,
                        [`%${search}%`, `%${search}%`]
                    )
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

    async createLayout(
        metahubId: string,
        input: z.infer<typeof createLayoutSchema>,
        userId?: string | null
    ): Promise<MetahubLayoutRow> {
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
                    config: {},
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

        const existing = await this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ id: layoutId, _upl_deleted: false, _mhb_deleted: false })
            .first()
        if (!existing) {
            throw new Error('Layout not found')
        }

        const nextIsActive = input.isActive ?? Boolean(existing.is_active)
        const nextIsDefault = input.isDefault ?? Boolean(existing.is_default)

        if (nextIsDefault && !nextIsActive) {
            throw new Error('Default layout must be active')
        }

        // Prevent deactivating the last active layout.
        if (!nextIsActive) {
            const activeCountRow = await this.knex
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

        // If setting default, unset other defaults in one transaction.
        return this.knex.transaction(async (trx) => {
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

            const updated =
                input.expectedVersion
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

        const existing = await this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ id: layoutId, _upl_deleted: false, _mhb_deleted: false })
            .first()
        if (!existing) {
            throw new Error('Layout not found')
        }
        if (existing.is_default) {
            throw new Error('Cannot delete default layout')
        }

        const activeCountRow = await this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ _upl_deleted: false, _mhb_deleted: false, is_active: true })
            .count<{ count: string }[]>('* as count')
            .first()
        const activeCount = activeCountRow ? Number(activeCountRow.count) : 0
        if (Number.isFinite(activeCount) && activeCount <= 1) {
            throw new Error('At least one active layout is required')
        }

        await this.knex
            .withSchema(schemaName)
            .from('_mhb_layouts')
            .where({ id: layoutId })
            .update({
                _mhb_deleted: true,
                _mhb_deleted_at: now,
                _mhb_deleted_by: userId ?? null,
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null,
                _upl_version: this.knex.raw('_upl_version + 1')
            })
    }
}

