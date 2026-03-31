/**
 * Application Sync - Layout Persistence
 *
 * Persists published layouts, widgets, and dashboard layout config.
 * Detects changes to decide if UI needs updating.
 */

import stableStringify from 'json-stable-stringify'
import type { DDLServices } from '@universo/schema-ddl'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import {
    type ApplicationSyncTransaction,
    getApplicationSyncDdlServices,
    getApplicationSyncKnex
} from '../../ddl'
import {
    type PersistedAppLayout,
    type PersistedAppLayoutZoneWidget,
    type PersistedAppLayoutRowDb,
    type PersistedAppWidgetRowDb,
} from './syncTypes'
import {
    isRecord,
    normalizeSnapshotLayouts,
    normalizeSnapshotLayoutZoneWidgets,
    buildMergedDashboardLayoutConfig,
} from './syncHelpers'

// --- Layout persistence ---

export async function persistPublishedLayouts(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    userId?: string | null
    trx?: ApplicationSyncTransaction
}): Promise<void> {
    const { schemaName, snapshot, userId, trx } = options
    const knex = getApplicationSyncKnex()
    const executor = trx ?? knex

    try {
        const { generator } = getApplicationSyncDdlServices()
        await generator.ensureSystemTables(schemaName, trx)
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[SchemaSync] Failed to ensure _app_layouts for layouts (ignored)', e)
    }

    const hasLayouts = await executor.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) return

    const now = new Date()
    const nextLayouts = normalizeSnapshotLayouts(snapshot)

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        const existingRows = await activeTrx
            .withSchema(schemaName)
            .from('_app_layouts')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        // Clear is_default on all existing active layouts to avoid unique partial
        // index violation (idx_app_layouts_default_active) when inserting a new
        // default layout while the old one still exists.
        if (existingRows.length > 0) {
            await activeTrx
                .withSchema(schemaName)
                .from('_app_layouts')
                .where({ _upl_deleted: false, _app_deleted: false, is_default: true })
                .update({ is_default: false })
        }

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
                await activeTrx
                    .withSchema(schemaName)
                    .from('_app_layouts')
                    .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: activeTrx.raw('_upl_version + 1')
                    })
            } else {
                await activeTrx
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
            await activeTrx
                .withSchema(schemaName)
                .from('_app_layouts')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await activeTrx.withSchema(schemaName).from('_app_layouts').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    }

    if (trx) {
        await applyPersist(trx)
    } else {
        await knex.transaction(applyPersist)
    }
}

export async function persistPublishedWidgets(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    userId?: string | null
    trx?: ApplicationSyncTransaction
}): Promise<void> {
    const { schemaName, snapshot, userId, trx } = options
    const knex = getApplicationSyncKnex()
    const executor = trx ?? knex
    const hasTable = await executor.schema.withSchema(schemaName).hasTable('_app_widgets')
    if (!hasTable) return

    const now = new Date()
    const nextRows = normalizeSnapshotLayoutZoneWidgets(snapshot)

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        const existingRows = await activeTrx
            .withSchema(schemaName)
            .from('_app_widgets')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        for (const row of nextRows) {
            const payload = {
                layout_id: row.layoutId,
                zone: row.zone,
                widget_key: row.widgetKey,
                sort_order: row.sortOrder,
                config: row.config
            }
            if (existingIds.has(row.id)) {
                await activeTrx
                    .withSchema(schemaName)
                    .from('_app_widgets')
                    .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: activeTrx.raw('_upl_version + 1')
                    })
            } else {
                await activeTrx
                    .withSchema(schemaName)
                    .into('_app_widgets')
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

        const nextIds = nextRows.map((row) => row.id)
        if (nextIds.length > 0) {
            await activeTrx
                .withSchema(schemaName)
                .from('_app_widgets')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await activeTrx.withSchema(schemaName).from('_app_widgets').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    }

    if (trx) {
        await applyPersist(trx)
    } else {
        await knex.transaction(applyPersist)
    }
}

// --- Layout/config queries ---

export async function getPersistedDashboardLayoutConfig(options: { schemaName: string }): Promise<Record<string, unknown>> {
    const { schemaName } = options
    const knex = getApplicationSyncKnex()

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

export async function getPersistedPublishedLayouts(options: {
    schemaName: string
}): Promise<{ layouts: PersistedAppLayout[]; defaultLayoutId: string | null }> {
    const { schemaName } = options
    const knex = getApplicationSyncKnex()

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) {
        return { layouts: [], defaultLayoutId: null }
    }

    const rows = (await knex
        .withSchema(schemaName)
        .from('_app_layouts')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select(['id', 'template_key', 'name', 'description', 'config', 'is_active', 'is_default', 'sort_order'])
        .orderBy([
            { column: 'sort_order', order: 'asc' },
            { column: '_upl_created_at', order: 'asc' }
        ])) as PersistedAppLayoutRowDb[]

    const layouts = rows.map((row) => ({
        id: String(row.id),
        templateKey: typeof row.template_key === 'string' && row.template_key.length > 0 ? row.template_key : 'dashboard',
        name: isRecord(row.name) ? row.name : {},
        description: isRecord(row.description) ? row.description : null,
        config: isRecord(row.config) ? row.config : {},
        isActive: Boolean(row.is_active),
        isDefault: Boolean(row.is_default),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
    }))
    const defaultLayoutId = layouts.find((layout) => layout.isDefault)?.id ?? null
    return { layouts, defaultLayoutId }
}

export async function getPersistedPublishedWidgets(options: { schemaName: string }): Promise<PersistedAppLayoutZoneWidget[]> {
    const { schemaName } = options
    const knex = getApplicationSyncKnex()

    const hasTable = await knex.schema.withSchema(schemaName).hasTable('_app_widgets')
    if (!hasTable) {
        return []
    }

    const rows = (await knex
        .withSchema(schemaName)
        .from('_app_widgets')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select(['id', 'layout_id', 'zone', 'widget_key', 'sort_order', 'config'])
        .orderBy([
            { column: 'layout_id', order: 'asc' },
            { column: 'zone', order: 'asc' },
            { column: 'sort_order', order: 'asc' },
            { column: '_upl_created_at', order: 'asc' }
        ])) as PersistedAppWidgetRowDb[]

    return rows.map((row) => ({
        id: String(row.id),
        layoutId: String(row.layout_id),
        zone: String(row.zone),
        widgetKey: String(row.widget_key),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
        config: isRecord(row.config) ? row.config : {}
    }))
}

// --- Change detection ---

export async function hasDashboardLayoutConfigChanges(options: { schemaName: string; snapshot: PublishedApplicationSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedDashboardLayoutConfig({ schemaName })
    const next = buildMergedDashboardLayoutConfig(snapshot)

    // Stable compare to avoid false positives due to key ordering.
    return stableStringify(current) !== stableStringify(next)
}

export async function hasPublishedLayoutsChanges(options: { schemaName: string; snapshot: PublishedApplicationSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedPublishedLayouts({ schemaName })
    const normalizedLayouts = normalizeSnapshotLayouts(snapshot)
    const next = {
        layouts: normalizedLayouts,
        defaultLayoutId: normalizedLayouts.find((layout) => layout.isDefault)?.id ?? null
    }

    return stableStringify(current) !== stableStringify(next)
}

export async function hasPublishedWidgetsChanges(options: { schemaName: string; snapshot: PublishedApplicationSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options
    const current = await getPersistedPublishedWidgets({ schemaName })
    const next = normalizeSnapshotLayoutZoneWidgets(snapshot)
    return stableStringify(current) !== stableStringify(next)
}

// --- Seed warnings ---

export async function persistSeedWarnings(
    schemaName: string,
    migrationManager: DDLServices['migrationManager'],
    warnings: string[],
    options?: {
        trx?: ApplicationSyncTransaction
        migrationId?: string
    }
): Promise<void> {
    if (warnings.length === 0) return

    const executor = options?.trx ?? getApplicationSyncKnex()

    let migrationRecord: { id: string; meta: Record<string, unknown> } | null = null

    if (options?.migrationId) {
        const row = await executor
            .withSchema(schemaName)
            .table('_app_migrations')
            .select(['id', 'meta'])
            .where({ id: options.migrationId })
            .first()
        if (!row) return
        migrationRecord = {
            id: String(row.id),
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta
        }
    } else if (options?.trx) {
        const row = await executor
            .withSchema(schemaName)
            .table('_app_migrations')
            .select(['id', 'meta'])
            .orderBy('applied_at', 'desc')
            .first()
        if (!row) return
        migrationRecord = {
            id: String(row.id),
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta
        }
    } else {
        const latestMigration = await migrationManager.getLatestMigration(schemaName)
        if (!latestMigration) return
        migrationRecord = {
            id: latestMigration.id,
            meta: latestMigration.meta as unknown as Record<string, unknown>
        }
    }

    const existing = Array.isArray(migrationRecord.meta.seedWarnings) ? migrationRecord.meta.seedWarnings : []
    const mergedWarnings = [...existing, ...warnings]

    await executor
        .withSchema(schemaName)
        .table('_app_migrations')
        .where({ id: migrationRecord.id })
        .update({
            meta: JSON.stringify({
                ...migrationRecord.meta,
                seedWarnings: mergedWarnings
            })
        })
}

