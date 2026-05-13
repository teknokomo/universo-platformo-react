import { z } from 'zod'
import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import {
    DASHBOARD_LAYOUT_WIDGETS,
    DASHBOARD_LAYOUT_ZONES,
    isEnabledComponentConfig,
    type DashboardLayoutWidgetKey,
    type DashboardLayoutZone,
    resolveSharedBehavior,
    type SharedBehavior,
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
    scopeEntityId: string | null
    baseLayoutId: string | null
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
    isInherited?: boolean
    createdAt: string
    updatedAt: string
}

export interface LayoutWidgetScopeVisibilityRow {
    scopeEntityId: string
    kind: string
    codename: unknown
    name: unknown
    layoutId: string | null
    layoutName: unknown
    isVisible: boolean
    isOverridden: boolean
}

export interface LayoutListOptions {
    limit?: number
    offset?: number
    sortBy?: 'name' | 'created' | 'updated'
    sortOrder?: 'asc' | 'desc'
    search?: string
    scopeEntityId?: string
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

type LayoutScopeRow = {
    id: string
    scope_entity_id?: string | null
    base_layout_id?: string | null
    config?: unknown
}

type LayoutWidgetOverrideDbRow = {
    id: string
    layout_id: string
    base_widget_id: string
    zone?: unknown
    sort_order?: unknown
    config?: unknown
    is_active?: unknown
    is_deleted_override?: unknown
    _upl_created_at?: unknown
    _upl_updated_at?: unknown
}

type ScopeEntityComponentRow = {
    id: string
    kind: string
    components?: unknown
}

type LayoutCapableScopeEntityRow = ScopeEntityComponentRow & {
    codename?: unknown
    presentation?: unknown
    config?: unknown
}

type ResolvedLayoutWidgetState = {
    id: string
    layoutId: string
    widgetKey: DashboardLayoutWidgetKey
    zone: DashboardLayoutZone
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
    createdAt: string
    updatedAt: string
    isInherited: boolean
    baseWidgetId: string | null
    baseZone: DashboardLayoutZone | null
    baseSortOrder: number | null
    baseIsActive: boolean | null
}

export const LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY = '__skipDefaultZoneWidgetSeed'

const DASHBOARD_WIDGET_VISIBILITY_CONFIG_KEYS = Object.keys(buildDashboardLayoutConfig([]))

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const resolveWidgetSharedBehavior = (config: unknown): Required<SharedBehavior> => {
    if (!isRecord(config) || !isRecord(config.sharedBehavior)) {
        return resolveSharedBehavior(undefined)
    }

    return resolveSharedBehavior(config.sharedBehavior as Partial<SharedBehavior>)
}

const stripDashboardWidgetVisibilityConfig = (config: unknown): Record<string, unknown> => {
    if (!isRecord(config)) {
        return {}
    }

    const nextConfig = { ...config }
    for (const key of DASHBOARD_WIDGET_VISIBILITY_CONFIG_KEYS) {
        delete nextConfig[key]
    }

    return nextConfig
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

export const createLayoutSchema = z
    .object({
        scopeEntityId: z.string().uuid().optional(),
        baseLayoutId: z.string().uuid().optional(),
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

    private buildAutoScopedLayoutName(presentation: unknown, codename: unknown): VersionedLocalizedContent<string> {
        const now = new Date().toISOString()
        const createLocaleEntry = (content: string) => ({
            content,
            version: 1,
            isActive: true,
            createdAt: now,
            updatedAt: now
        })
        const presentationRecord = isRecord(presentation) ? presentation : {}
        const sourceName = presentationRecord.name
        if (isRecord(sourceName) && isRecord(sourceName.locales)) {
            const locales: VersionedLocalizedContent<string>['locales'] = {}
            for (const [locale, value] of Object.entries(sourceName.locales)) {
                const content = isRecord(value) && typeof value.content === 'string' ? value.content.trim() : ''
                if (!content) continue
                locales[locale] = createLocaleEntry(content)
            }
            if (Object.keys(locales).length > 0) {
                const primary =
                    typeof sourceName._primary === 'string' && locales[sourceName._primary] ? sourceName._primary : Object.keys(locales)[0]
                return {
                    _schema: '1',
                    _primary: primary,
                    locales
                }
            }
        }

        const fallback = typeof codename === 'string' && codename.trim() ? codename.trim() : 'Scoped layout'
        return {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: createLocaleEntry(fallback),
                ru: createLocaleEntry(fallback)
            }
        }
    }

    private mapRow(row: DbRow): MetahubLayoutRow {
        return {
            id: String(row.id),
            scopeEntityId: typeof row.scope_entity_id === 'string' ? row.scope_entity_id : null,
            baseLayoutId: typeof row.base_layout_id === 'string' ? row.base_layout_id : null,
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

    private buildLayoutScopeWhereSql(scopeEntityId: string | null | undefined, nextParamIndex: number): { sql: string; params: unknown[] } {
        if (scopeEntityId) {
            return { sql: `scope_entity_id = $${nextParamIndex}`, params: [scopeEntityId] }
        }

        return { sql: 'scope_entity_id IS NULL', params: [] }
    }

    private async getLayoutScopeRow(db: SqlQueryable, schemaName: string, layoutId: string): Promise<LayoutScopeRow | null> {
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        return queryOne<LayoutScopeRow>(
            db,
            `SELECT id, scope_entity_id, base_layout_id, config
             FROM ${lt}
             WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId]
        )
    }

    private async assertScopeEntitySupportsLayout(db: SqlQueryable, schemaName: string, scopeEntityId: string): Promise<void> {
        const ot = qSchemaTable(schemaName, '_mhb_objects')
        const tt = qSchemaTable(schemaName, '_mhb_entity_type_definitions')
        const entityRow = await queryOne<ScopeEntityComponentRow>(
            db,
            `SELECT o.id, o.kind, t.components
               FROM ${ot} o
               JOIN ${tt} t
                 ON t.kind_key = o.kind
                AND t._upl_deleted = false
                AND t._mhb_deleted = false
              WHERE o.id = $1
                AND o._upl_deleted = false
                AND o._mhb_deleted = false
              LIMIT 1`,
            [scopeEntityId]
        )

        if (!entityRow) {
            throw new MetahubNotFoundError('Entity', scopeEntityId)
        }

        const components =
            entityRow.components && typeof entityRow.components === 'object' ? (entityRow.components as Record<string, unknown>) : {}
        if (!isEnabledComponentConfig(components.layoutConfig as Parameters<typeof isEnabledComponentConfig>[0])) {
            throw new MetahubValidationError(`Entity "${entityRow.kind}" does not support custom layouts`)
        }
    }

    private async resolveCreateBaseLayout(
        db: SqlQueryable,
        schemaName: string,
        scopeEntityId: string | null | undefined,
        requestedBaseLayoutId: string | undefined
    ): Promise<LayoutScopeRow | null> {
        if (!scopeEntityId) {
            return null
        }

        const lt = qSchemaTable(schemaName, '_mhb_layouts')

        if (requestedBaseLayoutId) {
            const baseLayout = await queryOne<LayoutScopeRow>(
                db,
                `SELECT id, scope_entity_id, base_layout_id, config FROM ${lt}
                 WHERE id = $1
                   AND scope_entity_id IS NULL
                   AND _upl_deleted = false
                   AND _mhb_deleted = false`,
                [requestedBaseLayoutId]
            )

            if (!baseLayout) {
                throw this.createConflictError('Base layout must reference an existing global layout')
            }

            return baseLayout
        }

        const fallbackBaseLayout = await queryOne<LayoutScopeRow>(
            db,
            `SELECT id, scope_entity_id, base_layout_id, config FROM ${lt}
             WHERE scope_entity_id IS NULL
               AND is_active = true
               AND _upl_deleted = false
               AND _mhb_deleted = false
             ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
             LIMIT 1`,
            []
        )

        if (!fallbackBaseLayout) {
            throw this.createConflictError('Scoped layouts require an existing global base layout')
        }

        return fallbackBaseLayout
    }

    private resolveScopedWidgetActiveOverride(isActive: boolean, baseIsActive: boolean | null): boolean | null {
        if (baseIsActive === null) {
            return isActive
        }

        return isActive === baseIsActive ? null : isActive
    }

    private async softDeleteLayoutWidgetOverride(
        db: SqlQueryable,
        schemaName: string,
        overrideId: string,
        userId?: string | null
    ): Promise<void> {
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const now = new Date()

        await db.query(
            `UPDATE ${ot} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
             WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = false`,
            [now, userId ?? null, overrideId]
        )
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

    private isScopedEntityLayout(scope: LayoutScopeRow | DbRow | null | undefined): boolean {
        return typeof scope?.scope_entity_id === 'string' && typeof scope?.base_layout_id === 'string'
    }

    private async listResolvedLayoutWidgetStates(
        db: SqlQueryable,
        schemaName: string,
        layoutScope: LayoutScopeRow
    ): Promise<ResolvedLayoutWidgetState[]> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        if (!this.isScopedEntityLayout(layoutScope)) {
            const rows = await queryMany<DbRow>(
                db,
                `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
                 ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
                [layoutScope.id]
            )

            return rows.map((row) => ({
                id: String(row.id),
                layoutId: String(row.layout_id),
                widgetKey: String(row.widget_key) as DashboardLayoutWidgetKey,
                zone: String(row.zone) as DashboardLayoutZone,
                sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1,
                config: (row.config as Record<string, unknown>) ?? {},
                isActive: row.is_active !== false,
                createdAt: String(row._upl_created_at),
                updatedAt: String(row._upl_updated_at),
                isInherited: false,
                baseWidgetId: null,
                baseZone: null,
                baseSortOrder: null,
                baseIsActive: null
            }))
        }

        const baseLayoutId = String(layoutScope.base_layout_id)
        const baseRows = await queryMany<DbRow>(
            db,
            `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
             ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
            [baseLayoutId]
        )
        const ownedRows = await queryMany<DbRow>(
            db,
            `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
             ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
            [layoutScope.id]
        )
        const overrideRows = await queryMany<LayoutWidgetOverrideDbRow>(
            db,
            `SELECT * FROM ${ot} WHERE layout_id = $1 AND ${ACTIVE}
             ORDER BY _upl_created_at ASC`,
            [layoutScope.id]
        )
        const overrideMap = new Map(overrideRows.map((row) => [String(row.base_widget_id), row]))

        const resolved: ResolvedLayoutWidgetState[] = []

        for (const row of baseRows) {
            const baseWidgetId = String(row.id)
            const override = overrideMap.get(baseWidgetId)
            const baseConfig = (row.config as Record<string, unknown>) ?? {}
            const sharedBehavior = resolveWidgetSharedBehavior(baseConfig)
            if (override?.is_deleted_override === true && sharedBehavior.canExclude) {
                continue
            }

            resolved.push({
                id: baseWidgetId,
                layoutId: layoutScope.id,
                widgetKey: String(row.widget_key) as DashboardLayoutWidgetKey,
                zone:
                    sharedBehavior.positionLocked || !override?.zone
                        ? (String(row.zone) as DashboardLayoutZone)
                        : (String(override.zone) as DashboardLayoutZone),
                sortOrder:
                    !sharedBehavior.positionLocked && typeof override?.sort_order === 'number'
                        ? override.sort_order
                        : typeof row.sort_order === 'number'
                        ? row.sort_order
                        : 1,
                config: baseConfig,
                isActive:
                    sharedBehavior.canDeactivate && typeof override?.is_active === 'boolean' ? override.is_active : row.is_active !== false,
                createdAt: String(row._upl_created_at),
                updatedAt: String(override?._upl_updated_at ?? row._upl_updated_at),
                isInherited: true,
                baseWidgetId,
                baseZone: String(row.zone) as DashboardLayoutZone,
                baseSortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1,
                baseIsActive: row.is_active !== false
            })
        }

        for (const row of ownedRows) {
            resolved.push({
                id: String(row.id),
                layoutId: String(row.layout_id),
                widgetKey: String(row.widget_key) as DashboardLayoutWidgetKey,
                zone: String(row.zone) as DashboardLayoutZone,
                sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1,
                config: (row.config as Record<string, unknown>) ?? {},
                isActive: row.is_active !== false,
                createdAt: String(row._upl_created_at),
                updatedAt: String(row._upl_updated_at),
                isInherited: false,
                baseWidgetId: null,
                baseZone: null,
                baseSortOrder: null,
                baseIsActive: null
            })
        }

        return resolved.sort((a, b) => {
            if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return a.id.localeCompare(b.id)
        })
    }

    private async upsertLayoutWidgetOverride(
        db: SqlQueryable,
        schemaName: string,
        args: {
            layoutId: string
            baseWidgetId: string
            patch: {
                zone?: DashboardLayoutZone | null
                sortOrder?: number | null
                isActive?: boolean | null
                isDeletedOverride?: boolean
            }
            userId?: string | null
        }
    ): Promise<void> {
        const { layoutId, baseWidgetId, patch, userId } = args
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const now = new Date()

        const existing = await queryOne<LayoutWidgetOverrideDbRow>(
            db,
            `SELECT * FROM ${ot}
             WHERE layout_id = $1 AND base_widget_id = $2 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId, baseWidgetId]
        )

        const existingZone = typeof existing?.zone === 'string' ? (String(existing.zone) as DashboardLayoutZone) : null
        const existingSortOrder = typeof existing?.sort_order === 'number' ? existing.sort_order : null
        const existingIsActive = typeof existing?.is_active === 'boolean' ? existing.is_active : null
        const nextZone = patch.zone !== undefined ? patch.zone : existingZone
        const nextSortOrder = patch.sortOrder !== undefined ? patch.sortOrder : existingSortOrder
        const nextConfig = null
        const nextIsActive = patch.isActive !== undefined ? patch.isActive : existingIsActive
        const nextIsDeletedOverride = patch.isDeletedOverride === true

        if (!nextIsDeletedOverride && nextZone === null && nextSortOrder === null && nextConfig === null && nextIsActive === null) {
            if (existing?.id) {
                await this.softDeleteLayoutWidgetOverride(db, schemaName, existing.id, userId)
            }
            return
        }

        if (existing) {
            await db.query(
                `UPDATE ${ot}
                 SET zone = $1,
                     sort_order = $2,
                     config = $3,
                     is_active = $4,
                     is_deleted_override = $5,
                     _upl_updated_at = $6,
                     _upl_updated_by = $7,
                     _upl_version = _upl_version + 1
                 WHERE id = $8`,
                [nextZone, nextSortOrder, nextConfig, nextIsActive, nextIsDeletedOverride, now, userId ?? null, existing.id]
            )
            return
        }

        await db.query(
            `INSERT INTO ${ot} (
                layout_id, base_widget_id, zone, sort_order, config, is_active, is_deleted_override,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                _mhb_published, _mhb_archived, _mhb_deleted
             ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $8, $9,
                1, false, false, false,
                true, false, false
             )`,
            [layoutId, baseWidgetId, nextZone, nextSortOrder, nextConfig, nextIsActive, nextIsDeletedOverride, now, userId ?? null]
        )
    }

    private async normalizeResolvedScopedLayoutSortOrders(
        db: SqlQueryable,
        schemaName: string,
        layoutScope: LayoutScopeRow,
        widgets: ResolvedLayoutWidgetState[],
        userId?: string | null
    ): Promise<void> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const now = new Date()

        for (const zone of DASHBOARD_LAYOUT_ZONES) {
            const zoneItems = widgets
                .filter((item) => item.zone === zone)
                .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))

            for (let index = 0; index < zoneItems.length; index += 1) {
                const item = zoneItems[index]
                const nextSortOrder = index + 1
                if (item.isInherited && item.baseWidgetId) {
                    const sharedBehavior = resolveWidgetSharedBehavior(item.config)
                    await this.upsertLayoutWidgetOverride(db, schemaName, {
                        layoutId: layoutScope.id,
                        baseWidgetId: item.baseWidgetId,
                        patch: {
                            zone:
                                !sharedBehavior.positionLocked && item.baseZone !== null && item.zone !== item.baseZone ? item.zone : null,
                            sortOrder:
                                !sharedBehavior.positionLocked && item.baseSortOrder !== null && nextSortOrder !== item.baseSortOrder
                                    ? nextSortOrder
                                    : null,
                            isActive:
                                sharedBehavior.canDeactivate && item.baseIsActive !== null && item.isActive !== item.baseIsActive
                                    ? item.isActive
                                    : null,
                            isDeletedOverride: false
                        },
                        userId
                    })
                } else {
                    await db.query(
                        `UPDATE ${wt} SET zone = $1, sort_order = $2,
                            _upl_updated_at = $3, _upl_updated_by = $4, _upl_version = _upl_version + 1
                         WHERE id = $5 AND _upl_deleted = false AND _mhb_deleted = false`,
                        [item.zone, nextSortOrder, now, userId ?? null, item.id]
                    )
                }
            }
        }
    }

    private mapResolvedLayoutWidgetState(row: ResolvedLayoutWidgetState): DashboardLayoutZoneWidgetRow {
        return {
            id: row.id,
            layoutId: row.layoutId,
            zone: row.zone,
            widgetKey: row.widgetKey,
            sortOrder: row.sortOrder,
            config: row.config,
            isActive: row.isActive,
            isInherited: row.isInherited,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
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
        const layoutRow = await this.getLayoutScopeRow(db, schemaName, layoutId)
        if (!layoutRow) {
            return
        }

        const currentConfig = layoutRow?.config && typeof layoutRow.config === 'object' ? layoutRow.config : {}
        let nextConfig = stripDashboardWidgetVisibilityConfig(currentConfig)

        if (!this.isScopedEntityLayout(layoutRow)) {
            const widgetRows = await queryMany<ZoneWidgetConfigRow>(
                db,
                `SELECT widget_key, zone, is_active FROM ${wt}
                 WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
                [layoutId]
            )
            const activeWidgets = widgetRows.filter((row) => row.is_active !== false)
            nextConfig = {
                ...nextConfig,
                ...buildDashboardLayoutConfig(
                    activeWidgets.map((row) => ({
                        widgetKey: String(row.widget_key) as DashboardLayoutWidgetKey,
                        zone: String(row.zone) as DashboardLayoutZone
                    }))
                )
            }
        }

        await db.query(
            `UPDATE ${lt} SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
             WHERE id = $4 AND _upl_deleted = false AND _mhb_deleted = false`,
            [JSON.stringify(nextConfig), new Date(), userId ?? null, layoutId]
        )
    }

    private async ensureDefaultZoneWidgets(db: SqlQueryable, schemaName: string, layoutId: string, userId?: string | null): Promise<void> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')

        const layoutRow = await this.getLayoutScopeRow(db, schemaName, layoutId)

        if (!layoutRow) {
            return
        }

        if (this.isScopedEntityLayout(layoutRow)) {
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
        const { limit = 20, offset = 0, sortBy = 'updated', sortOrder = 'desc', search, scopeEntityId, includeDeleted = false } = options

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

        const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId ?? null, idx)
        conditions.push(scopeClause.sql)
        params.push(...scopeClause.params)
        idx += scopeClause.params.length

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

    async listLayoutWidgetScopeVisibility(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        userId?: string | null
    ): Promise<LayoutWidgetScopeVisibilityRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ot = qSchemaTable(schemaName, '_mhb_objects')
        const tt = qSchemaTable(schemaName, '_mhb_entity_type_definitions')
        const overridesTable = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')

        const base = await queryOne<{
            layout_id: string
            widget_id: string
            widget_is_active: boolean
        }>(
            this.exec,
            `SELECT l.id AS layout_id,
                    w.id AS widget_id,
                    w.is_active AS widget_is_active
               FROM ${lt} l
               JOIN ${wt} w
                 ON w.layout_id = l.id
                AND w.id = $2
                AND w._upl_deleted = false
                AND w._mhb_deleted = false
              WHERE l.id = $1
                AND l.scope_entity_id IS NULL
                AND l._upl_deleted = false
                AND l._mhb_deleted = false
              LIMIT 1`,
            [layoutId, widgetId]
        )

        if (!base) {
            throw this.createNotFoundError('Global layout widget not found')
        }

        const scopeRows = await queryMany<LayoutCapableScopeEntityRow>(
            this.exec,
            `SELECT o.id, o.kind, o.codename, o.presentation, o.config, t.components
               FROM ${ot} o
               JOIN ${tt} t
                 ON t.kind_key = o.kind
                AND t._upl_deleted = false
                AND t._mhb_deleted = false
              WHERE o._upl_deleted = false
                AND o._mhb_deleted = false
              ORDER BY o.kind ASC, COALESCE(o.presentation::text, o.codename::text, o.id::text) ASC`,
            []
        )
        const layoutCapableScopes = scopeRows.filter((row) => {
            const components = row.components && typeof row.components === 'object' ? (row.components as Record<string, unknown>) : {}
            return isEnabledComponentConfig(components.layoutConfig as Parameters<typeof isEnabledComponentConfig>[0])
        })

        if (layoutCapableScopes.length === 0) {
            return []
        }

        const scopeIds = layoutCapableScopes.map((row) => row.id)
        const scopedLayoutRows = await queryMany<{
            id: string
            scope_entity_id: string
            name?: unknown
            is_default?: boolean
            is_active?: boolean
            sort_order?: number
            _upl_created_at?: string
        }>(
            this.exec,
            `SELECT id, scope_entity_id, name, is_default, is_active, sort_order, _upl_created_at
               FROM ${lt}
              WHERE base_layout_id = $1
                AND scope_entity_id = ANY($2::uuid[])
                AND _upl_deleted = false
                AND _mhb_deleted = false
              ORDER BY scope_entity_id ASC,
                       is_default DESC,
                       is_active DESC,
                       sort_order ASC,
                       _upl_created_at ASC`,
            [layoutId, scopeIds]
        )

        const scopedLayoutByScope = new Map<string, (typeof scopedLayoutRows)[number]>()
        for (const row of scopedLayoutRows) {
            if (!scopedLayoutByScope.has(row.scope_entity_id)) {
                scopedLayoutByScope.set(row.scope_entity_id, row)
            }
        }

        const scopedLayoutIds = Array.from(scopedLayoutByScope.values()).map((row) => row.id)
        const overrideRows =
            scopedLayoutIds.length > 0
                ? await queryMany<{
                      layout_id: string
                      is_active?: boolean | null
                      is_deleted_override?: boolean
                  }>(
                      this.exec,
                      `SELECT layout_id, is_active, is_deleted_override
                         FROM ${overridesTable}
                        WHERE base_widget_id = $1
                          AND layout_id = ANY($2::uuid[])
                          AND _upl_deleted = false
                          AND _mhb_deleted = false`,
                      [widgetId, scopedLayoutIds]
                  )
                : []

        const overrideByLayoutId = new Map(overrideRows.map((row) => [row.layout_id, row]))
        const baseVisible = base.widget_is_active !== false

        return layoutCapableScopes.map((scope) => {
            const scopedLayout = scopedLayoutByScope.get(scope.id) ?? null
            const override = scopedLayout ? overrideByLayoutId.get(scopedLayout.id) ?? null : null
            const isVisible =
                override?.is_deleted_override === true ? false : typeof override?.is_active === 'boolean' ? override.is_active : baseVisible
            const presentation =
                scope.presentation && typeof scope.presentation === 'object' ? (scope.presentation as Record<string, unknown>) : {}

            return {
                scopeEntityId: scope.id,
                kind: scope.kind,
                codename: scope.codename ?? null,
                name: presentation.name ?? null,
                layoutId: scopedLayout?.id ?? null,
                layoutName: scopedLayout?.name ?? null,
                isVisible,
                isOverridden: Boolean(override)
            }
        })
    }

    private async findOrCreateScopedLayout(
        tx: SqlQueryable,
        schemaName: string,
        params: {
            baseLayout: LayoutScopeRow
            baseLayoutId: string
            scopeEntityId: string
            userId?: string | null
        }
    ): Promise<LayoutScopeRow> {
        const { baseLayout, baseLayoutId, scopeEntityId, userId } = params
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const ot = qSchemaTable(schemaName, '_mhb_objects')

        const scopedLayout = await queryOne<LayoutScopeRow>(
            tx,
            `SELECT id, scope_entity_id, base_layout_id, config
               FROM ${lt}
              WHERE scope_entity_id = $1
                AND base_layout_id = $2
                AND _upl_deleted = false
                AND _mhb_deleted = false
              ORDER BY is_default DESC,
                       is_active DESC,
                       sort_order ASC,
                       _upl_created_at ASC
              LIMIT 1
              FOR UPDATE`,
            [scopeEntityId, baseLayoutId]
        )

        if (scopedLayout) {
            return scopedLayout
        }

        const scopeEntity = await queryOne<{ presentation?: unknown; codename?: unknown }>(
            tx,
            `SELECT presentation, codename
               FROM ${ot}
              WHERE id = $1
                AND _upl_deleted = false
                AND _mhb_deleted = false
              LIMIT 1`,
            [scopeEntityId]
        )
        const now = new Date()
        const scopedName = this.buildAutoScopedLayoutName(scopeEntity?.presentation, scopeEntity?.codename)
        const created = await queryOneOrThrow<DbRow>(
            tx,
            `INSERT INTO ${lt} (scope_entity_id, base_layout_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                _mhb_published, _mhb_archived, _mhb_deleted)
             VALUES ($1, $2, 'dashboard', $3, NULL, $4, true, true, 0, NULL,
                $5, $6, $5, $6,
                1, false, false, false,
                true, false, false)
             RETURNING id, scope_entity_id, base_layout_id, config`,
            [
                scopeEntityId,
                baseLayoutId,
                JSON.stringify(scopedName),
                JSON.stringify(stripDashboardWidgetVisibilityConfig(baseLayout.config)),
                now,
                userId ?? null
            ]
        )

        return {
            id: String(created.id),
            scope_entity_id: typeof created.scope_entity_id === 'string' ? created.scope_entity_id : scopeEntityId,
            base_layout_id: typeof created.base_layout_id === 'string' ? created.base_layout_id : baseLayoutId,
            config: created.config
        }
    }

    async setLayoutWidgetScopeVisibility(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        scopeEntityId: string,
        isVisible: boolean,
        userId?: string | null
    ): Promise<LayoutWidgetScopeVisibilityRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')

        await this.exec.transaction(async (tx: SqlQueryable) => {
            await this.assertScopeEntitySupportsLayout(tx, schemaName, scopeEntityId)

            const baseLayout = await queryOne<LayoutScopeRow>(
                tx,
                `SELECT id, scope_entity_id, base_layout_id, config
                   FROM ${lt}
                  WHERE id = $1
                    AND scope_entity_id IS NULL
                    AND _upl_deleted = false
                    AND _mhb_deleted = false
                  FOR UPDATE`,
                [layoutId]
            )
            if (!baseLayout) {
                throw this.createNotFoundError('Global layout not found')
            }

            const baseWidget = await queryOne<DbRow>(
                tx,
                `SELECT *
                   FROM ${wt}
                  WHERE id = $1
                    AND layout_id = $2
                    AND _upl_deleted = false
                    AND _mhb_deleted = false
                  FOR UPDATE`,
                [widgetId, layoutId]
            )
            if (!baseWidget) {
                throw this.createNotFoundError('Global layout widget not found')
            }

            const baseIsActive = baseWidget.is_active !== false
            const sharedBehavior = resolveWidgetSharedBehavior(baseWidget.config)
            if (isVisible !== baseIsActive && !sharedBehavior.canDeactivate) {
                throw new MetahubValidationError('Inherited widget activation is locked by the base layout and cannot be changed.', {
                    widgetId,
                    layoutId,
                    scopeEntityId
                })
            }

            const scopedLayout = await this.findOrCreateScopedLayout(tx, schemaName, {
                baseLayout,
                baseLayoutId: layoutId,
                scopeEntityId,
                userId
            })

            await this.upsertLayoutWidgetOverride(tx, schemaName, {
                layoutId: scopedLayout.id,
                baseWidgetId: widgetId,
                patch: {
                    isActive: this.resolveScopedWidgetActiveOverride(isVisible, baseIsActive),
                    isDeletedOverride: false
                },
                userId
            })

            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, scopedLayout.id, userId ?? null)
        })

        return this.listLayoutWidgetScopeVisibility(metahubId, layoutId, widgetId, userId)
    }

    async createLayout(metahubId: string, input: z.infer<typeof createLayoutSchema>, userId?: string | null): Promise<MetahubLayoutRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const now = new Date()
        const scopeEntityId = input.scopeEntityId ?? null

        const isActive = input.isActive ?? true
        const isDefault = input.isDefault ?? false
        if (isDefault && !isActive) {
            throw this.createConflictError('Default layout must be active')
        }

        return this.exec.transaction(async (tx: SqlQueryable) => {
            if (scopeEntityId) {
                await this.assertScopeEntitySupportsLayout(tx, schemaName, scopeEntityId)
            }

            const baseLayout = await this.resolveCreateBaseLayout(tx, schemaName, scopeEntityId, input.baseLayoutId)

            if (isDefault) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 3)
                await tx.query(
                    `UPDATE ${lt} SET is_default = false, _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                     WHERE _upl_deleted = false AND _mhb_deleted = false AND ${scopeClause.sql}`,
                    [now, userId ?? null, ...scopeClause.params]
                )
            }

            const baseLayoutConfig = stripDashboardWidgetVisibilityConfig(baseLayout?.config)
            const nextConfig = scopeEntityId
                ? { ...baseLayoutConfig, ...stripDashboardWidgetVisibilityConfig(input.config) }
                : input.config ?? { ...buildDashboardLayoutConfig([]), [LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY]: true }
            const created = await queryOneOrThrow<DbRow>(
                tx,
                `INSERT INTO ${lt} (scope_entity_id, base_layout_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                    _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                    _mhb_published, _mhb_archived, _mhb_deleted)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $11, $12, 1, false, false, false, true, false, false)
                 RETURNING *`,
                [
                    scopeEntityId,
                    baseLayout?.id ?? null,
                    input.templateKey ?? 'dashboard',
                    JSON.stringify(input.name),
                    input.description ? JSON.stringify(input.description) : null,
                    JSON.stringify(nextConfig),
                    isActive,
                    isDefault,
                    input.sortOrder ?? 0,
                    null,
                    now,
                    userId ?? null
                ]
            )

            if (!scopeEntityId && !this.shouldSkipDefaultZoneWidgetSeed(nextConfig)) {
                await this.ensureDefaultZoneWidgets(tx, schemaName, String(created.id), userId ?? null)
            }
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

            const scopeEntityId = typeof existing.scope_entity_id === 'string' ? existing.scope_entity_id : null

            const nextIsActive = input.isActive ?? Boolean(existing.is_active)
            const nextIsDefault = input.isDefault ?? Boolean(existing.is_default)

            if (nextIsDefault && !nextIsActive) {
                throw this.createConflictError('Default layout must be active')
            }

            // Prevent unsetting the last default layout.
            if (Boolean(existing.is_default) && !nextIsDefault) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 1)
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_default = true AND ${scopeClause.sql}`,
                    scopeClause.params
                )
                const defaultCount = countRow?.count ?? 0
                if (Number.isFinite(defaultCount) && defaultCount <= 1) {
                    throw this.createConflictError('At least one default layout is required')
                }
            }

            // Prevent deactivating the last active layout.
            if (!nextIsActive) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 1)
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_active = true AND ${scopeClause.sql}`,
                    scopeClause.params
                )
                const activeCount = countRow?.count ?? 0
                if (Number.isFinite(activeCount) && activeCount <= 1) {
                    throw this.createConflictError('At least one active layout is required')
                }
            }

            if (nextIsDefault) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 4)
                await tx.query(
                    `UPDATE ${lt} SET is_default = false, _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                     WHERE ${ACTIVE} AND id != $3 AND ${scopeClause.sql}`,
                    [now, userId ?? null, layoutId, ...scopeClause.params]
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
                      executor: tx,
                      schemaName,
                      tableName: '_mhb_layouts',
                      entityId: layoutId,
                      entityType: 'layout',
                      expectedVersion: input.expectedVersion,
                      updateData,
                      wrapInTransaction: false
                  })
                : await incrementVersion(tx, schemaName, '_mhb_layouts', layoutId, updateData)

            return this.mapRow(updated)
        })
    }

    async deleteLayout(metahubId: string, layoutId: string, userId?: string | null): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
        const now = new Date()

        // BUG-2 fix: All reads + writes inside a single transaction to prevent TOCTOU races
        await this.exec.transaction(async (tx: SqlQueryable) => {
            const existing = await queryOne<DbRow>(tx, `SELECT * FROM ${lt} WHERE id = $1 AND ${ACTIVE} FOR UPDATE`, [layoutId])
            if (!existing) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            const scopeEntityId = typeof existing.scope_entity_id === 'string' ? existing.scope_entity_id : null
            if (existing.is_default) {
                throw this.createConflictError('Cannot delete default layout')
            }

            if (!scopeEntityId) {
                const [dependentScopedLayout] = await tx.query<{ id: string }>(
                    `SELECT id FROM ${lt}
                     WHERE base_layout_id = $1 AND ${ACTIVE}
                     LIMIT 1`,
                    [layoutId]
                )

                if (dependentScopedLayout?.id) {
                    throw this.createConflictError('Cannot delete a global layout that is used by scoped layouts')
                }
            }

            if (existing.is_active) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 1)
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_active = true AND ${scopeClause.sql}`,
                    scopeClause.params
                )
                const activeCount = countRow?.count ?? 0
                if (Number.isFinite(activeCount) && activeCount <= 1) {
                    throw this.createConflictError('At least one active layout is required')
                }
            }

            await tx.query(
                `UPDATE ${ot} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                    _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                 WHERE layout_id = $3 AND ${ACTIVE}`,
                [now, userId ?? null, layoutId]
            )

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
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (layoutScope && this.isScopedEntityLayout(layoutScope)) {
                return (await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)).map((row) =>
                    this.mapResolvedLayoutWidgetState(row)
                )
            }

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
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const nextSortOrder = input.sortOrder ?? resolvedWidgets.filter((row) => row.zone === input.zone).length + 1
                const isMulti = multiInstanceSet.has(input.widgetKey)

                if (!isMulti) {
                    const ownedWidget = resolvedWidgets.find((row) => !row.isInherited && row.widgetKey === input.widgetKey)
                    if (ownedWidget) {
                        await tx.query(
                            `UPDATE ${wt} SET zone = $1, sort_order = $2, config = $3,
                                _upl_updated_at = $4, _upl_updated_by = $5, _upl_version = _upl_version + 1
                             WHERE id = $6`,
                            [
                                input.zone,
                                nextSortOrder,
                                JSON.stringify(input.config ?? ownedWidget.config),
                                new Date(),
                                userId ?? null,
                                ownedWidget.id
                            ]
                        )
                    } else {
                        const inheritedWidget = resolvedWidgets.find((row) => row.isInherited && row.widgetKey === input.widgetKey)
                        if (inheritedWidget?.baseWidgetId) {
                            throw new MetahubValidationError(
                                'Inherited widgets cannot be reassigned. Move or toggle the existing widget instead.',
                                {
                                    widgetId: inheritedWidget.id,
                                    widgetKey: inheritedWidget.widgetKey,
                                    layoutId
                                }
                            )
                        } else {
                            await queryOneOrThrow<DbRow>(
                                tx,
                                `INSERT INTO ${wt} (layout_id, zone, widget_key, sort_order, config, is_active,
                                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                                    _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                                    _mhb_published, _mhb_archived, _mhb_deleted)
                                 VALUES ($1, $2, $3, $4, $5, true, $6, $7, $6, $7, 1, false, false, false, true, false, false)
                                 RETURNING *`,
                                [
                                    layoutId,
                                    input.zone,
                                    input.widgetKey,
                                    nextSortOrder,
                                    JSON.stringify(input.config ?? {}),
                                    new Date(),
                                    userId ?? null
                                ]
                            )
                        }
                    }
                } else {
                    await queryOneOrThrow<DbRow>(
                        tx,
                        `INSERT INTO ${wt} (layout_id, zone, widget_key, sort_order, config, is_active,
                            _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                            _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                            _mhb_published, _mhb_archived, _mhb_deleted)
                         VALUES ($1, $2, $3, $4, $5, true, $6, $7, $6, $7, 1, false, false, false, true, false, false)
                         RETURNING *`,
                        [
                            layoutId,
                            input.zone,
                            input.widgetKey,
                            nextSortOrder,
                            JSON.stringify(input.config ?? {}),
                            new Date(),
                            userId ?? null
                        ]
                    )
                }

                const normalizedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, normalizedWidgets, userId ?? null)
                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

                const refreshedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const createdWidget = refreshedWidgets.find((row) => row.widgetKey === input.widgetKey && row.zone === input.zone)
                if (!createdWidget) {
                    throw this.createNotFoundError('Zone widget not found after assignment')
                }
                return this.mapResolvedLayoutWidgetState(createdWidget)
            }

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
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const current = resolvedWidgets.find((row) => row.id === input.widgetId)
                if (!current) throw new MetahubNotFoundError('Layout widget', input.widgetId)
                if (current.isInherited && resolveWidgetSharedBehavior(current.config).positionLocked) {
                    throw new MetahubValidationError('Inherited widget position is locked by the base layout and cannot be moved.', {
                        widgetId: current.id,
                        widgetKey: current.widgetKey,
                        layoutId
                    })
                }

                const sourceZone = current.zone
                const targetZone = input.targetZone ?? sourceZone
                this.assertWidgetAllowedInZone(current.widgetKey, targetZone)

                const remaining = resolvedWidgets.filter((row) => row.id !== input.widgetId)
                const targetZoneItems = remaining.filter((row) => row.zone === targetZone)
                const targetIndex =
                    typeof input.targetIndex === 'number'
                        ? Math.max(0, Math.min(input.targetIndex, targetZoneItems.length))
                        : targetZoneItems.length
                const insertBefore = targetZoneItems[targetIndex]
                const insertIndex = insertBefore ? remaining.findIndex((row) => row.id === insertBefore.id) : remaining.length
                const moved = { ...current, zone: targetZone }
                remaining.splice(insertIndex, 0, moved)

                for (const zone of DASHBOARD_LAYOUT_ZONES) {
                    let sortOrder = 1
                    for (const row of remaining) {
                        if (row.zone !== zone) continue
                        row.sortOrder = sortOrder
                        sortOrder += 1
                    }
                }

                await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, remaining, userId ?? null)
                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                return (await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)).map((row) =>
                    this.mapResolvedLayoutWidgetState(row)
                )
            }

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
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                return
            }

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const current = resolvedWidgets.find((row) => row.id === widgetId)
                if (!current) {
                    return
                }

                if (current.isInherited) {
                    const sharedBehavior = resolveWidgetSharedBehavior(current.config)
                    if (!sharedBehavior.canExclude || !current.baseWidgetId) {
                        throw new MetahubValidationError(
                            'Inherited widget exclusion is disabled by the base layout and cannot be changed.',
                            {
                                widgetId: current.id,
                                widgetKey: current.widgetKey,
                                layoutId
                            }
                        )
                    }

                    await this.upsertLayoutWidgetOverride(tx, schemaName, {
                        layoutId: layoutId,
                        baseWidgetId: current.baseWidgetId,
                        patch: {
                            zone: null,
                            sortOrder: null,
                            isActive: null,
                            isDeletedOverride: true
                        },
                        userId
                    })

                    const refreshedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                    await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, refreshedWidgets, userId ?? null)
                    await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                    return
                }

                await tx.query(
                    `UPDATE ${wt} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                        _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                     WHERE id = $3`,
                    [new Date(), userId ?? null, current.id]
                )

                const refreshedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, refreshedWidgets, userId ?? null)
                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                return
            }

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
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw this.createNotFoundError('Layout not found')
            }

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const currentResolved = resolvedWidgets.find((row) => row.id === widgetId)
                if (!currentResolved) {
                    throw this.createNotFoundError('Zone widget not found')
                }

                if (currentResolved.isInherited) {
                    throw new MetahubValidationError('Inherited widgets inherit config from the base layout and cannot be edited.', {
                        widgetId: currentResolved.id,
                        widgetKey: currentResolved.widgetKey,
                        layoutId
                    })
                }

                const now = new Date()
                await tx.query(
                    `UPDATE ${wt} SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                     WHERE id = $4`,
                    [JSON.stringify(config), now, userId ?? null, currentResolved.id]
                )

                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                const refreshed = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const updated = refreshed.find((row) => row.id === widgetId)
                if (!updated) {
                    throw this.createNotFoundError('Zone widget not found')
                }
                return this.mapResolvedLayoutWidgetState(updated)
            }

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
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw this.createNotFoundError('Layout not found')
            }

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const currentResolved = resolvedWidgets.find((row) => row.id === widgetId)
                if (!currentResolved) {
                    throw this.createNotFoundError('Zone widget not found')
                }

                if (!currentResolved.isInherited) {
                    const now = new Date()
                    await tx.query(
                        `UPDATE ${wt} SET is_active = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                         WHERE id = $4`,
                        [isActive, now, userId ?? null, currentResolved.id]
                    )
                } else if (currentResolved.baseWidgetId) {
                    const sharedBehavior = resolveWidgetSharedBehavior(currentResolved.config)
                    if (!sharedBehavior.canDeactivate && isActive !== currentResolved.baseIsActive) {
                        throw new MetahubValidationError(
                            'Inherited widget activation is locked by the base layout and cannot be changed.',
                            {
                                widgetId: currentResolved.id,
                                widgetKey: currentResolved.widgetKey,
                                layoutId
                            }
                        )
                    }

                    await this.upsertLayoutWidgetOverride(tx, schemaName, {
                        layoutId: layoutId,
                        baseWidgetId: currentResolved.baseWidgetId,
                        patch: {
                            isActive: this.resolveScopedWidgetActiveOverride(isActive, currentResolved.baseIsActive),
                            isDeletedOverride: false
                        },
                        userId
                    })
                }

                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                const refreshed = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const updated = refreshed.find((row) => row.id === widgetId)
                if (!updated) {
                    throw this.createNotFoundError('Zone widget not found')
                }
                return this.mapResolvedLayoutWidgetState(updated)
            }

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
