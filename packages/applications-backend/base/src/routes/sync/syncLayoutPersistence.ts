/**
 * Application Sync - Layout Persistence
 *
 * Persists published layouts, widgets, and dashboard layout config.
 * Detects changes to decide if UI needs updating.
 */

import stableStringify from 'json-stable-stringify'
import type { DDLServices } from '@universo/schema-ddl'
import type { ApplicationLayoutChange, ApplicationLayoutSyncResolution } from '@universo/types'
import { generateUuidV7 } from '@universo/utils'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { type ApplicationSyncTransaction, getApplicationSyncDdlServices, getApplicationSyncKnex } from '../../ddl'
import { hashApplicationLayoutContent } from '../../utils/applicationLayoutHash'
import {
    type PersistedAppLayout,
    type PersistedAppLayoutZoneWidget,
    type PersistedAppLayoutRowDb,
    type PersistedAppWidgetRowDb
} from './syncTypes'
import {
    buildMergedDashboardLayoutConfig,
    isRecord,
    normalizeSnapshotLayouts,
    normalizeSnapshotLayoutZoneWidgets,
    quoteSchemaName
} from './syncHelpers'

// --- Layout persistence ---

const normalizeLayoutZone = (value: unknown): PersistedAppLayoutZoneWidget['zone'] => {
    return value === 'left' || value === 'right' || value === 'top' || value === 'bottom' || value === 'center' ? value : 'center'
}

const isLocallyModifiedLayout = (row: { source_kind?: unknown; source_content_hash?: unknown; local_content_hash?: unknown }): boolean =>
    String(row.source_kind) === 'metahub' &&
    typeof row.source_content_hash === 'string' &&
    typeof row.local_content_hash === 'string' &&
    row.source_content_hash !== row.local_content_hash

const resolveLayoutScope = (linkedCollectionId: string | null | undefined): string => linkedCollectionId ?? 'global'

const toLocalizedTitle = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})

export async function buildApplicationLayoutChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
}): Promise<ApplicationLayoutChange[]> {
    const { schemaName, snapshot } = options
    const knex = getApplicationSyncKnex()

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) {
        return []
    }

    const nextLayouts = normalizeSnapshotLayouts(snapshot)
    const nextWidgets = normalizeSnapshotLayoutZoneWidgets(snapshot)
    const widgetsByLayoutId = new Map<string, typeof nextWidgets>()
    for (const widget of nextWidgets) {
        const bucket = widgetsByLayoutId.get(widget.layoutId) ?? []
        bucket.push(widget)
        widgetsByLayoutId.set(widget.layoutId, bucket)
    }

    const existingRows = (await knex
        .withSchema(schemaName)
        .from('_app_layouts')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select([
            'id',
            'catalog_id',
            'name',
            'is_active',
            'is_default',
            'source_kind',
            'source_layout_id',
            'source_content_hash',
            'local_content_hash',
            'sync_state',
            'is_source_excluded'
        ])) as Array<{
        id: unknown
        catalog_id: unknown
        name: unknown
        is_active: unknown
        is_default: unknown
        source_kind: unknown
        source_layout_id: unknown
        source_content_hash: unknown
        local_content_hash: unknown
        sync_state: unknown
        is_source_excluded: unknown
    }>

    const existingById = new Map(existingRows.map((row) => [String(row.id), row]))
    const defaultsByScope = new Map<string, typeof existingRows>()
    for (const row of existingRows) {
        if (row.is_default !== true || row.is_active !== true) continue
        const scope = resolveLayoutScope(typeof row.catalog_id === 'string' ? row.catalog_id : null)
        const bucket = defaultsByScope.get(scope) ?? []
        bucket.push(row)
        defaultsByScope.set(scope, bucket)
    }

    const changes: ApplicationLayoutChange[] = []

    for (const row of nextLayouts) {
        const sourceHash = hashApplicationLayoutContent({ layout: row, widgets: widgetsByLayoutId.get(row.id) ?? [] })
        const scope = resolveLayoutScope(row.linkedCollectionId)
        const existing = existingById.get(row.id)

        if (row.isDefault) {
            const competingDefault = (defaultsByScope.get(scope) ?? []).find((candidate) => {
                if (String(candidate.id) === row.id) return false
                return String(candidate.source_kind) === 'application' || isLocallyModifiedLayout(candidate)
            })
            if (competingDefault) {
                changes.push({
                    type: 'LAYOUT_DEFAULT_COLLISION',
                    scope,
                    sourceLayoutId: row.id,
                    applicationLayoutId: String(competingDefault.id),
                    sourceKind: 'metahub',
                    currentSyncState: isLocallyModifiedLayout(competingDefault) ? 'local_modified' : undefined,
                    recommendedResolution: 'copy_source_as_application',
                    title: toLocalizedTitle(row.name),
                    message: 'Source default conflicts with an application-selected default in the same scope.'
                })
            }
        }

        if (!existing) {
            continue
        }

        if (existing.is_source_excluded === true) {
            changes.push({
                type: 'LAYOUT_WARNING',
                scope,
                sourceLayoutId: row.id,
                applicationLayoutId: String(existing.id),
                sourceKind: 'metahub',
                currentSyncState: 'source_excluded',
                recommendedResolution: 'skip_source',
                title: toLocalizedTitle(row.name),
                message: 'This metahub layout is currently excluded in the application and will remain excluded unless explicitly restored.'
            })
            continue
        }

        const locallyModified = isLocallyModifiedLayout(existing)
        const currentSourceHash = typeof existing.source_content_hash === 'string' ? existing.source_content_hash : null
        if (!locallyModified && currentSourceHash && currentSourceHash !== sourceHash) {
            changes.push({
                type: 'LAYOUT_SOURCE_UPDATED',
                scope,
                sourceLayoutId: row.id,
                applicationLayoutId: String(existing.id),
                sourceKind: 'metahub',
                currentSyncState: 'source_updated',
                recommendedResolution: 'keep_local',
                title: toLocalizedTitle(row.name),
                message: 'The metahub layout changed and will overwrite the application copy unless you keep or skip the local state.'
            })
        }
        if (locallyModified && currentSourceHash && currentSourceHash !== sourceHash) {
            changes.push({
                type: 'LAYOUT_CONFLICT',
                scope,
                sourceLayoutId: row.id,
                applicationLayoutId: String(existing.id),
                sourceKind: 'metahub',
                currentSyncState: 'local_modified',
                recommendedResolution: 'copy_source_as_application',
                title: toLocalizedTitle(row.name),
                message: 'Both the metahub source and the application copy changed since the last sync.'
            })
        }
    }

    const nextLayoutIds = new Set(nextLayouts.map((row) => row.id))
    for (const row of existingRows) {
        if (String(row.source_kind) !== 'metahub' || row.is_source_excluded === true || nextLayoutIds.has(String(row.id))) {
            continue
        }
        if (!isLocallyModifiedLayout(row)) {
            continue
        }
        changes.push({
            type: 'LAYOUT_SOURCE_REMOVED',
            scope: resolveLayoutScope(typeof row.catalog_id === 'string' ? row.catalog_id : null),
            sourceLayoutId: String(row.id),
            applicationLayoutId: String(row.id),
            sourceKind: 'metahub',
            currentSyncState: 'source_removed',
            recommendedResolution: 'keep_local',
            title: toLocalizedTitle(row.name),
            message: 'The metahub source layout was removed, but the application still carries local changes.'
        })
    }

    return changes.sort((left, right) => {
        if (left.scope !== right.scope) return left.scope.localeCompare(right.scope)
        return left.type.localeCompare(right.type)
    })
}

export async function persistPublishedLayouts(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    snapshotHash?: string | null
    userId?: string | null
    trx?: ApplicationSyncTransaction
    layoutResolutionPolicy?: {
        default?: ApplicationLayoutSyncResolution
        bySourceLayoutId?: Record<string, ApplicationLayoutSyncResolution>
    }
}): Promise<void> {
    const { schemaName, snapshot, snapshotHash, userId, trx, layoutResolutionPolicy } = options
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
    const nextWidgets = normalizeSnapshotLayoutZoneWidgets(snapshot)
    const widgetsByLayoutId = new Map<string, typeof nextWidgets>()
    for (const widget of nextWidgets) {
        const bucket = widgetsByLayoutId.get(widget.layoutId) ?? []
        bucket.push(widget)
        widgetsByLayoutId.set(widget.layoutId, bucket)
    }

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        const existingRows = await activeTrx
            .withSchema(schemaName)
            .from('_app_layouts')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id', 'source_kind', 'source_content_hash', 'local_content_hash', 'sync_state', 'is_source_excluded'])
        const existingIds = new Set(existingRows.map((row) => String(row.id)))
        const existingById = new Map(existingRows.map((row) => [String(row.id), row]))

        for (const row of nextLayouts) {
            const sourceContentHash = hashApplicationLayoutContent({ layout: row, widgets: widgetsByLayoutId.get(row.id) ?? [] })
            let isDefault = row.isDefault
            if (isDefault) {
                const defaultRows = await activeTrx
                    .withSchema(schemaName)
                    .from('_app_layouts')
                    .where({ _upl_deleted: false, _app_deleted: false, is_default: true })
                    .whereRaw('catalog_id IS NOT DISTINCT FROM ?', [row.linkedCollectionId])
                    .whereNot({ id: row.id })
                    .select(['id', 'source_kind', 'source_content_hash', 'local_content_hash'])
                const hasAppOwnedDefault = defaultRows.some((defaultRow) => String(defaultRow.source_kind) === 'application')
                const hasLocalModifiedDefault = defaultRows.some(
                    (defaultRow) =>
                        String(defaultRow.source_kind) === 'metahub' &&
                        defaultRow.source_content_hash &&
                        defaultRow.local_content_hash &&
                        defaultRow.source_content_hash !== defaultRow.local_content_hash
                )
                if (hasAppOwnedDefault || hasLocalModifiedDefault) {
                    isDefault = false
                } else if (defaultRows.length > 0) {
                    await activeTrx
                        .withSchema(schemaName)
                        .from('_app_layouts')
                        .where({ _upl_deleted: false, _app_deleted: false, is_default: true })
                        .whereRaw('catalog_id IS NOT DISTINCT FROM ?', [row.linkedCollectionId])
                        .whereNot({ id: row.id })
                        .update({ is_default: false, _upl_updated_at: now, _upl_updated_by: userId ?? null })
                }
            }
            const payload = {
                catalog_id: row.linkedCollectionId,
                template_key: row.templateKey,
                name: row.name,
                description: row.description,
                config: row.config,
                is_active: row.isActive,
                is_default: isDefault,
                sort_order: row.sortOrder,
                owner_id: null,
                source_kind: 'metahub',
                source_layout_id: row.id,
                source_snapshot_hash: snapshotHash ?? null,
                source_content_hash: sourceContentHash,
                local_content_hash: sourceContentHash,
                sync_state: 'clean',
                is_source_excluded: false
            }

            if (existingIds.has(row.id)) {
                const existing = existingById.get(row.id) as
                    | {
                          source_kind?: string
                          source_content_hash?: string | null
                          local_content_hash?: string | null
                          is_source_excluded?: boolean
                      }
                    | undefined
                const locallyModified =
                    existing?.source_kind === 'metahub' &&
                    existing.source_content_hash &&
                    existing.local_content_hash &&
                    existing.source_content_hash !== existing.local_content_hash
                const resolution = layoutResolutionPolicy?.bySourceLayoutId?.[row.id] ?? layoutResolutionPolicy?.default
                if (existing?.is_source_excluded) {
                    if (resolution === 'overwrite_local') {
                        await activeTrx
                            .withSchema(schemaName)
                            .from('_app_layouts')
                            .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                            .update({
                                ...payload,
                                is_source_excluded: false,
                                source_deleted_at: null,
                                source_deleted_by: null,
                                _upl_updated_at: now,
                                _upl_updated_by: userId ?? null,
                                _upl_version: activeTrx.raw('_upl_version + 1')
                            })
                    }
                    continue
                }
                if (locallyModified && existing.source_content_hash !== sourceContentHash && resolution !== 'overwrite_local') {
                    if (resolution === 'copy_source_as_application') {
                        const existingCopy = await activeTrx
                            .withSchema(schemaName)
                            .from('_app_layouts')
                            .where({
                                _upl_deleted: false,
                                _app_deleted: false,
                                source_kind: 'application',
                                source_layout_id: row.id,
                                source_content_hash: sourceContentHash
                            })
                            .first(['id'])

                        if (!existingCopy) {
                            const copiedLayoutId = generateUuidV7()
                            await activeTrx
                                .withSchema(schemaName)
                                .into('_app_layouts')
                                .insert({
                                    id: copiedLayoutId,
                                    catalog_id: row.linkedCollectionId,
                                    template_key: row.templateKey,
                                    name: row.name,
                                    description: row.description,
                                    config: row.config,
                                    is_active: row.isActive,
                                    is_default: false,
                                    sort_order: row.sortOrder,
                                    owner_id: null,
                                    source_kind: 'application',
                                    source_layout_id: row.id,
                                    source_content_hash: sourceContentHash,
                                    local_content_hash: sourceContentHash,
                                    sync_state: 'clean',
                                    is_source_excluded: false,
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

                            for (const widget of widgetsByLayoutId.get(row.id) ?? []) {
                                const copiedWidgetId = generateUuidV7()
                                await activeTrx
                                    .withSchema(schemaName)
                                    .into('_app_widgets')
                                    .insert({
                                        id: copiedWidgetId,
                                        layout_id: copiedLayoutId,
                                        zone: widget.zone,
                                        widget_key: widget.widgetKey,
                                        sort_order: widget.sortOrder,
                                        config: widget.config,
                                        is_active: widget.isActive !== false,
                                        source_widget_id: widget.id,
                                        source_content_hash: sourceContentHash,
                                        local_content_hash: sourceContentHash,
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

                        await activeTrx
                            .withSchema(schemaName)
                            .from('_app_layouts')
                            .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                            .update({
                                source_snapshot_hash: snapshotHash ?? null,
                                source_content_hash: sourceContentHash,
                                sync_state: 'local_modified',
                                _upl_updated_at: now,
                                _upl_updated_by: userId ?? null,
                                _upl_version: activeTrx.raw('_upl_version + 1')
                            })
                        continue
                    }

                    if (resolution === 'keep_local') {
                        await activeTrx
                            .withSchema(schemaName)
                            .from('_app_layouts')
                            .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                            .update({
                                source_snapshot_hash: snapshotHash ?? null,
                                source_content_hash: sourceContentHash,
                                sync_state: 'local_modified',
                                _upl_updated_at: now,
                                _upl_updated_by: userId ?? null,
                                _upl_version: activeTrx.raw('_upl_version + 1')
                            })
                        continue
                    }

                    if (resolution === 'skip_source') {
                        await activeTrx
                            .withSchema(schemaName)
                            .from('_app_layouts')
                            .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                            .update({
                                sync_state: 'source_updated',
                                _upl_updated_at: now,
                                _upl_updated_by: userId ?? null,
                                _upl_version: activeTrx.raw('_upl_version + 1')
                            })
                        continue
                    }

                    await activeTrx
                        .withSchema(schemaName)
                        .from('_app_layouts')
                        .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                        .update({
                            sync_state: 'conflict',
                            source_snapshot_hash: snapshotHash ?? null,
                            source_content_hash: sourceContentHash,
                            _upl_updated_at: now,
                            _upl_updated_by: userId ?? null,
                            _upl_version: activeTrx.raw('_upl_version + 1')
                        })
                    continue
                }
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
        const missingRows = await activeTrx
            .withSchema(schemaName)
            .from('_app_layouts')
            .where({ _upl_deleted: false, _app_deleted: false, source_kind: 'metahub', is_source_excluded: false })
            .modify((queryBuilder) => {
                if (nextIds.length > 0) {
                    queryBuilder.whereNotIn('id', nextIds)
                }
            })
            .select(['id', 'source_content_hash', 'local_content_hash'])

        for (const missingRow of missingRows) {
            const rowId = String(missingRow.id)
            const locallyModified =
                typeof missingRow.source_content_hash === 'string' &&
                typeof missingRow.local_content_hash === 'string' &&
                missingRow.source_content_hash !== missingRow.local_content_hash
            const resolution = layoutResolutionPolicy?.bySourceLayoutId?.[rowId] ?? layoutResolutionPolicy?.default

            if (locallyModified && resolution !== 'overwrite_local' && resolution !== 'skip_source') {
                await activeTrx
                    .withSchema(schemaName)
                    .from('_app_layouts')
                    .where({ id: rowId, _upl_deleted: false, _app_deleted: false })
                    .update({
                        source_kind: 'application',
                        source_layout_id: null,
                        source_snapshot_hash: null,
                        source_content_hash: null,
                        sync_state: 'clean',
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: activeTrx.raw('_upl_version + 1')
                    })
                continue
            }

            if (locallyModified && resolution === 'skip_source') {
                await activeTrx
                    .withSchema(schemaName)
                    .from('_app_layouts')
                    .where({ id: rowId, _upl_deleted: false, _app_deleted: false })
                    .update({
                        sync_state: 'source_removed',
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: activeTrx.raw('_upl_version + 1')
                    })
                continue
            }

            await activeTrx
                .withSchema(schemaName)
                .from('_app_layouts')
                .where({ id: rowId, _upl_deleted: false, _app_deleted: false })
                .update({
                    is_active: false,
                    is_default: false,
                    sync_state: 'source_removed',
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null,
                    _upl_version: activeTrx.raw('_upl_version + 1')
                })
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
        const syncableLayouts = await activeTrx
            .withSchema(schemaName)
            .from('_app_layouts')
            .where({ _upl_deleted: false, _app_deleted: false, source_kind: 'metahub', is_source_excluded: false })
            .where({ sync_state: 'clean' })
            .select(['id'])
        const syncableLayoutIds = new Set(syncableLayouts.map((row) => String(row.id)))
        const syncableRows = nextRows.filter((row) => syncableLayoutIds.has(row.layoutId))
        const existingRows = await activeTrx
            .withSchema(schemaName)
            .from('_app_widgets')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        for (const row of syncableRows) {
            const payload = {
                layout_id: row.layoutId,
                zone: row.zone,
                widget_key: row.widgetKey,
                sort_order: row.sortOrder,
                config: row.config,
                is_active: row.isActive !== false,
                source_widget_id: row.id
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

        const nextIds = syncableRows.map((row) => row.id)
        if (nextIds.length > 0) {
            await activeTrx
                .withSchema(schemaName)
                .from('_app_widgets')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereIn('layout_id', Array.from(syncableLayoutIds))
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await activeTrx
                .withSchema(schemaName)
                .from('_app_widgets')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereIn('layout_id', Array.from(syncableLayoutIds))
                .del()
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
        .where({ catalog_id: null, is_default: true, _upl_deleted: false, _app_deleted: false })
        .select(['config'])
        .first()

    const fallbackActive = preferredDefault
        ? null
        : await knex
              .withSchema(schemaName)
              .from('_app_layouts')
              .where({ catalog_id: null, is_active: true, _upl_deleted: false, _app_deleted: false })
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
        .where({ _upl_deleted: false, _app_deleted: false, source_kind: 'metahub', is_source_excluded: false })
        .whereNot({ sync_state: 'conflict' })
        .select(['id', 'catalog_id', 'template_key', 'name', 'description', 'config', 'is_active', 'is_default', 'sort_order'])
        .orderBy([
            { column: 'catalog_id', order: 'asc', nulls: 'first' },
            { column: 'sort_order', order: 'asc' },
            { column: '_upl_created_at', order: 'asc' }
        ])) as PersistedAppLayoutRowDb[]

    const layouts = rows.map((row) => ({
        id: String(row.id),
        linkedCollectionId: typeof row.catalog_id === 'string' && row.catalog_id.length > 0 ? row.catalog_id : null,
        templateKey: typeof row.template_key === 'string' && row.template_key.length > 0 ? row.template_key : 'dashboard',
        name: isRecord(row.name) ? row.name : {},
        description: isRecord(row.description) ? row.description : null,
        config: isRecord(row.config) ? row.config : {},
        isActive: Boolean(row.is_active),
        isDefault: Boolean(row.is_default),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
    }))
    const defaultLayoutId = layouts.find((layout) => layout.linkedCollectionId === null && layout.isDefault)?.id ?? null
    return { layouts, defaultLayoutId }
}

export async function getPersistedPublishedWidgets(options: { schemaName: string }): Promise<PersistedAppLayoutZoneWidget[]> {
    const { schemaName } = options
    const knex = getApplicationSyncKnex()

    const hasTable = await knex.schema.withSchema(schemaName).hasTable('_app_widgets')
    if (!hasTable) {
        return []
    }

    const schemaIdent = quoteSchemaName(schemaName)
    const rows = (await knex.raw(
        `
        SELECT
            w.id,
            w.layout_id,
            w.zone,
            w.widget_key,
            w.sort_order,
            w.config,
            w.is_active,
            w._upl_created_at
        FROM ${schemaIdent}._app_widgets AS w
        INNER JOIN ${schemaIdent}._app_layouts AS l ON w.layout_id = l.id
        WHERE w._upl_deleted = false
          AND w._app_deleted = false
          AND l._upl_deleted = false
          AND l._app_deleted = false
          AND l.source_kind = ?
          AND l.is_source_excluded = false
          AND l.sync_state <> ?
        ORDER BY w.layout_id ASC, w.zone ASC, w.sort_order ASC, w._upl_created_at ASC
        `,
        ['metahub', 'conflict']
    )) as { rows?: PersistedAppWidgetRowDb[] }
    const normalizedRows = rows.rows ?? []

    return normalizedRows.map((row) => ({
        id: String(row.id),
        layoutId: String(row.layout_id),
        zone: normalizeLayoutZone(row.zone),
        widgetKey: String(row.widget_key),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
        config: isRecord(row.config) ? row.config : {},
        isActive: row.is_active !== false
    }))
}

// --- Change detection ---

export async function hasDashboardLayoutConfigChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
}): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedDashboardLayoutConfig({ schemaName })
    const next = buildMergedDashboardLayoutConfig(snapshot)

    // Stable compare to avoid false positives due to key ordering.
    return stableStringify(current) !== stableStringify(next)
}

export async function hasPublishedLayoutsChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
}): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedPublishedLayouts({ schemaName })
    const normalizedLayouts = normalizeSnapshotLayouts(snapshot)
    const next = {
        layouts: normalizedLayouts,
        defaultLayoutId: normalizedLayouts.find((layout) => layout.isDefault)?.id ?? null
    }

    return stableStringify(current) !== stableStringify(next)
}

export async function hasPublishedWidgetsChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
}): Promise<boolean> {
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
