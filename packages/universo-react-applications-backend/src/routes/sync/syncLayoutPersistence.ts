/**
 * Application Sync - Layout Persistence
 *
 * The route layer validates and materializes the publication snapshot.  All
 * application-schema reads and writes are delegated to the SQL-first store so
 * the sync path shares the same executor, lock hierarchy, and transaction
 * boundary as authoring mutations.
 */

import { createHash } from 'node:crypto'
import stableStringify from 'json-stable-stringify'
import { createKnexExecutor } from '@universo-react/database'
import type { DDLServices } from '@universo-react/schema-ddl'
import {
    DASHBOARD_LAYOUT_ZONES,
    MARKETING_LAYOUT_ZONES,
    type ApplicationLayoutChange,
    type ApplicationTemplateKey
} from '@universo-react/types'
import { validateMarketingSnapshotLayouts, type DbExecutor } from '@universo-react/utils'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { type ApplicationSyncTransaction, getApplicationSyncDdlServices } from '../../ddl'
import { hashApplicationLayoutContent } from '../../utils/applicationLayoutHash'
import {
    applicationLayoutsTableExists,
    getPersistedDashboardLayoutConfig as readPersistedDashboardLayoutConfig,
    getPersistedPublishedLayouts as readPersistedPublishedLayouts,
    getPersistedPublishedWidgets as readPersistedPublishedWidgets,
    listApplicationLayoutSyncRows,
    readMigrationRow,
    syncApplicationLayouts,
    updateMigrationMeta,
    type ApplicationLayoutSyncLayoutRow,
    type ApplicationLayoutSyncPolicy,
    type SyncLayoutInput,
    type SyncWidgetInput
} from '../../persistence/applicationLayoutSyncStore'
import { syncApplicationWidgets } from '../../persistence/applicationLayoutWidgetSyncStore'
import { buildMergedDashboardLayoutConfig, isRecord, parseApplicationTemplateKey } from './syncHelpers'
import type { PersistedAppLayout, PersistedAppLayoutZoneWidget } from './syncTypes'
import { materializeTrustedSnapshotLayoutsAndWidgets } from './trustedLayoutResolver'

const normalizeLayoutZone = (value: unknown, templateKey: ApplicationTemplateKey): PersistedAppLayoutZoneWidget['zone'] => {
    const zones = templateKey === 'dashboard' ? DASHBOARD_LAYOUT_ZONES : MARKETING_LAYOUT_ZONES
    if (typeof value === 'string' && (zones as readonly string[]).includes(value)) {
        return value as PersistedAppLayoutZoneWidget['zone']
    }
    throw new Error(`[SchemaSync] Invalid ${templateKey} persisted widget zone`)
}

const isLocallyModifiedLayout = (row: { source_kind?: unknown; source_content_hash?: unknown; local_content_hash?: unknown }): boolean =>
    String(row.source_kind) === 'metahub' &&
    typeof row.source_content_hash === 'string' &&
    typeof row.local_content_hash === 'string' &&
    row.source_content_hash !== row.local_content_hash

const resolveLayoutScope = (scopeEntityId: string | null | undefined): string => scopeEntityId ?? 'global'

const toLocalizedTitle = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})

type SyncExecutorOptions = {
    trx?: ApplicationSyncTransaction
    requestExecutor?: DbExecutor
}

const createSyncExecutor = ({ trx, requestExecutor }: SyncExecutorOptions = {}): DbExecutor => {
    if (trx) return createKnexExecutor(trx)
    if (requestExecutor) return requestExecutor
    throw new Error('[SchemaSync] Request-scoped executor or trusted sync transaction is required')
}

const hashApplicationLayoutWidgetContent = (widget: PersistedAppLayoutZoneWidget): string => {
    const payload = stableStringify({
        sourceBaseWidgetId: widget.sourceBaseWidgetId ?? null,
        zone: widget.zone,
        widgetKey: widget.widgetKey,
        sortOrder: widget.sortOrder,
        config: widget.config,
        isActive: widget.isActive !== false
    })
    return createHash('sha256')
        .update(payload ?? '{}')
        .digest('hex')
}

const buildSyncInputs = (
    snapshot: PublishedApplicationSnapshot,
    snapshotHash: string | null
): {
    layouts: SyncLayoutInput[]
    widgets: SyncWidgetInput[]
    widgetsBySourceLayoutId: Map<string, SyncWidgetInput[]>
} => {
    const materialized = materializeTrustedSnapshotLayoutsAndWidgets(snapshot)
    const widgets: SyncWidgetInput[] = materialized.widgets.map((widget) => ({
        ...widget,
        sourceContentHash: hashApplicationLayoutWidgetContent(widget)
    }))
    const widgetsBySourceLayoutId = new Map<string, SyncWidgetInput[]>()
    for (const widget of widgets) {
        const bucket = widgetsBySourceLayoutId.get(widget.layoutId) ?? []
        bucket.push(widget)
        widgetsBySourceLayoutId.set(widget.layoutId, bucket)
    }

    const layouts = materialized.layouts.map((row) => ({
        row,
        sourceContentHash: hashApplicationLayoutContent({ layout: row, widgets: widgetsBySourceLayoutId.get(row.id) ?? [] }),
        sourceSnapshotHash: snapshotHash
    }))
    return { layouts, widgets, widgetsBySourceLayoutId }
}

const buildComparableLayout = (row: ApplicationLayoutSyncLayoutRow, physicalToSource: ReadonlyMap<string, string>): PersistedAppLayout => {
    const rawConfig = isRecord(row.config) ? row.config : {}
    const baseLayoutId = rawConfig.baseLayoutId
    const config =
        typeof baseLayoutId === 'string' && physicalToSource.has(baseLayoutId)
            ? { ...rawConfig, baseLayoutId: physicalToSource.get(baseLayoutId) }
            : rawConfig
    return {
        id: row.source_layout_id ?? row.id,
        scopeEntityId: row.scope_entity_id ?? null,
        templateKey: parseApplicationTemplateKey(row.template_key, `persisted layout ${row.id}`),
        name: isRecord(row.name) ? row.name : {},
        description: isRecord(row.description) ? row.description : null,
        config,
        isActive: row.is_active === true,
        isDefault: row.is_default === true,
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
    }
}

const buildComparableWidget = (
    row: {
        layout_id: string
        source_base_widget_id: string | null
        zone: string
        widget_key: string
        sort_order: number
        config: unknown
        is_active: boolean
    },
    physicalToSource: ReadonlyMap<string, string>
): Record<string, unknown> => ({
    layoutId: physicalToSource.get(row.layout_id) ?? row.layout_id,
    sourceBaseWidgetId: row.source_base_widget_id,
    zone: row.zone,
    widgetKey: row.widget_key,
    sortOrder: row.sort_order,
    config: isRecord(row.config) ? row.config : {},
    isActive: row.is_active
})

export async function buildApplicationLayoutChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    executor: DbExecutor
}): Promise<ApplicationLayoutChange[]> {
    const { schemaName, snapshot, executor: requestExecutor } = options
    validateMarketingSnapshotLayouts(snapshot)
    const nextInputs = buildSyncInputs(snapshot, null)

    const executor = createSyncExecutor({ requestExecutor })
    if (!(await applicationLayoutsTableExists(executor, schemaName))) return []

    const { layouts: nextLayouts, widgetsBySourceLayoutId } = nextInputs
    const existingRows = await listApplicationLayoutSyncRows(executor, schemaName, { includeDeleted: false })
    const existingBySourceId = new Map<string, ApplicationLayoutSyncLayoutRow>()
    for (const row of existingRows) {
        if (row.source_kind !== 'metahub' || !row.source_layout_id || row.is_source_excluded) continue
        if (existingBySourceId.has(row.source_layout_id)) {
            throw new Error('[SchemaSync] Existing application layouts contain duplicate source lineage')
        }
        existingBySourceId.set(row.source_layout_id, row)
    }

    const defaultsByScope = new Map<string, ApplicationLayoutSyncLayoutRow[]>()
    for (const row of existingRows) {
        if (!row.is_default || !row.is_active) continue
        const scope = resolveLayoutScope(row.scope_entity_id)
        const bucket = defaultsByScope.get(scope) ?? []
        bucket.push(row)
        defaultsByScope.set(scope, bucket)
    }

    const changes: ApplicationLayoutChange[] = []
    for (const input of nextLayouts) {
        const row = input.row
        const sourceHash = hashApplicationLayoutContent({ layout: row, widgets: widgetsBySourceLayoutId.get(row.id) ?? [] })
        const scope = resolveLayoutScope(row.scopeEntityId)
        const existing = existingBySourceId.get(row.id)

        if (row.isDefault) {
            const competingDefault = (defaultsByScope.get(scope) ?? []).find((candidate) => {
                if (candidate.source_layout_id === row.id) return false
                return candidate.source_kind === 'application' || isLocallyModifiedLayout(candidate)
            })
            if (competingDefault) {
                changes.push({
                    type: 'LAYOUT_DEFAULT_COLLISION',
                    scope,
                    sourceLayoutId: row.id,
                    applicationLayoutId: competingDefault.id,
                    sourceKind: 'metahub',
                    currentSyncState: isLocallyModifiedLayout(competingDefault) ? 'local_modified' : undefined,
                    recommendedResolution: 'copy_source_as_application',
                    title: toLocalizedTitle(row.name),
                    message: 'Source default conflicts with an application-selected default in the same scope.'
                })
            }
        }

        if (!existing) continue
        if (existing.is_source_excluded) {
            changes.push({
                type: 'LAYOUT_WARNING',
                scope,
                sourceLayoutId: row.id,
                applicationLayoutId: existing.id,
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
                applicationLayoutId: existing.id,
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
                applicationLayoutId: existing.id,
                sourceKind: 'metahub',
                currentSyncState: 'local_modified',
                recommendedResolution: 'copy_source_as_application',
                title: toLocalizedTitle(row.name),
                message: 'Both the metahub source and the application copy changed since the last sync.'
            })
        }
    }

    const nextSourceIds = new Set(nextLayouts.map(({ row }) => row.id))
    for (const row of existingRows) {
        if (row.source_kind !== 'metahub' || row.is_source_excluded || !row.source_layout_id || nextSourceIds.has(row.source_layout_id))
            continue
        if (!isLocallyModifiedLayout(row)) continue
        changes.push({
            type: 'LAYOUT_SOURCE_REMOVED',
            scope: resolveLayoutScope(row.scope_entity_id),
            sourceLayoutId: row.source_layout_id,
            applicationLayoutId: row.id,
            sourceKind: 'metahub',
            currentSyncState: 'source_removed',
            recommendedResolution: 'keep_local',
            title: toLocalizedTitle(row.name),
            message: 'The metahub source layout was removed, but the application still carries local changes.'
        })
    }

    return changes.sort((left, right) =>
        left.scope !== right.scope ? left.scope.localeCompare(right.scope) : left.type.localeCompare(right.type)
    )
}

export async function persistPublishedLayouts(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    snapshotHash?: string | null
    userId?: string | null
    trx?: ApplicationSyncTransaction
    executor?: DbExecutor
    layoutResolutionPolicy?: ApplicationLayoutSyncPolicy
}): Promise<void> {
    const { schemaName, snapshot, snapshotHash = null, userId = null, trx, executor: requestExecutor, layoutResolutionPolicy } = options
    validateMarketingSnapshotLayouts(snapshot)
    const executor = createSyncExecutor({ trx, requestExecutor })
    const inputs = buildSyncInputs(snapshot, snapshotHash)

    try {
        const { generator } = getApplicationSyncDdlServices()
        await generator.ensureSystemTables(schemaName, trx)
    } catch (error) {
        const syncError = new Error('[SchemaSync] Failed to ensure application layout tables')
        Object.defineProperty(syncError, 'cause', { value: error })
        throw syncError
    }

    if (!(await applicationLayoutsTableExists(executor, schemaName))) return
    await syncApplicationLayouts(executor, schemaName, {
        layouts: inputs.layouts,
        widgetsBySourceLayoutId: inputs.widgetsBySourceLayoutId,
        snapshotHash,
        userId,
        policy: layoutResolutionPolicy
    })
}

export async function persistPublishedWidgets(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    userId?: string | null
    trx?: ApplicationSyncTransaction
    executor?: DbExecutor
}): Promise<void> {
    const { schemaName, snapshot, userId = null, trx, executor: requestExecutor } = options
    validateMarketingSnapshotLayouts(snapshot)
    const inputs = buildSyncInputs(snapshot, null)
    const executor = createSyncExecutor({ trx, requestExecutor })
    await syncApplicationWidgets(executor, schemaName, { widgets: inputs.widgets, userId })
}

export async function getPersistedDashboardLayoutConfig(options: {
    schemaName: string
    executor: DbExecutor
}): Promise<Record<string, unknown>> {
    return readPersistedDashboardLayoutConfig(createSyncExecutor({ requestExecutor: options.executor }), options.schemaName)
}

export async function getPersistedPublishedLayouts(options: {
    schemaName: string
    executor: DbExecutor
}): Promise<{ layouts: PersistedAppLayout[]; defaultLayoutId: string | null }> {
    return readPersistedPublishedLayouts(createSyncExecutor({ requestExecutor: options.executor }), options.schemaName)
}

export async function getPersistedPublishedWidgets(options: {
    schemaName: string
    executor: DbExecutor
}): Promise<PersistedAppLayoutZoneWidget[]> {
    const rows = await readPersistedPublishedWidgets(createSyncExecutor({ requestExecutor: options.executor }), options.schemaName)
    return rows.map((row) => ({
        ...row,
        zone: normalizeLayoutZone(row.zone, row.widgetKey.startsWith('marketing.') ? 'marketing-page' : 'dashboard')
    }))
}

export async function hasDashboardLayoutConfigChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    executor: DbExecutor
}): Promise<boolean> {
    const { schemaName, snapshot, executor } = options
    const normalizedSnapshot = materializeTrustedSnapshotLayoutsAndWidgets(snapshot)
    const defaultLayout = normalizedSnapshot.layouts.find((layout) => layout.scopeEntityId === null && layout.isDefault)
    if (defaultLayout?.templateKey !== 'dashboard') return false
    const current = await getPersistedDashboardLayoutConfig({ schemaName, executor })
    const next = buildMergedDashboardLayoutConfig(snapshot)
    return stableStringify(current) !== stableStringify(next)
}

export async function hasPublishedLayoutsChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    executor: DbExecutor
}): Promise<boolean> {
    const { schemaName, snapshot, executor: requestExecutor } = options
    const executor = createSyncExecutor({ requestExecutor })
    const currentRows = (await listApplicationLayoutSyncRows(executor, schemaName, { includeDeleted: false })).filter(
        (row) => row.source_kind === 'metahub' && row.is_active && !row.is_source_excluded && row.sync_state !== 'conflict'
    )
    const physicalToSource = new Map(
        currentRows.filter((row) => row.source_layout_id).map((row) => [row.id, row.source_layout_id as string])
    )
    const currentLayouts = currentRows.map((row) => buildComparableLayout(row, physicalToSource))
    const normalizedLayouts = materializeTrustedSnapshotLayoutsAndWidgets(snapshot).layouts
    return (
        stableStringify({
            layouts: currentLayouts,
            defaultLayoutId: currentLayouts.find((layout) => layout.scopeEntityId === null && layout.isDefault)?.id ?? null
        }) !==
        stableStringify({
            layouts: normalizedLayouts,
            defaultLayoutId: normalizedLayouts.find((layout) => layout.scopeEntityId === null && layout.isDefault)?.id ?? null
        })
    )
}

export async function hasPublishedWidgetsChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    executor: DbExecutor
}): Promise<boolean> {
    const { schemaName, snapshot, executor: requestExecutor } = options
    const executor = createSyncExecutor({ requestExecutor })
    const layouts = await listApplicationLayoutSyncRows(executor, schemaName, { includeDeleted: false })
    const physicalToSource = new Map(
        layouts
            .filter((row) => row.source_kind === 'metahub' && row.source_layout_id)
            .map((row) => [row.id, row.source_layout_id as string])
    )
    const currentRows = await (async () => {
        const widgets = await readPersistedPublishedWidgets(executor, schemaName)
        return widgets
            .map((row) => ({
                layout_id: row.layoutId,
                source_base_widget_id: row.sourceBaseWidgetId ?? null,
                zone: row.zone,
                widget_key: row.widgetKey,
                sort_order: row.sortOrder,
                config: row.config,
                is_active: row.isActive
            }))
            .map((row) => buildComparableWidget(row, physicalToSource))
    })()
    const nextRows = materializeTrustedSnapshotLayoutsAndWidgets(snapshot)
        .widgets.filter((row) => row.isActive !== false)
        .map((row) => ({
            layoutId: row.layoutId,
            sourceBaseWidgetId: row.sourceBaseWidgetId ?? null,
            zone: row.zone,
            widgetKey: row.widgetKey,
            sortOrder: row.sortOrder,
            config: row.config,
            isActive: row.isActive
        }))
    const sort = (rows: Array<Record<string, unknown>>) =>
        rows.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    return stableStringify(sort(currentRows)) !== stableStringify(sort(nextRows))
}

export async function persistSeedWarnings(
    schemaName: string,
    migrationManager: DDLServices['migrationManager'],
    warnings: string[],
    options?: { trx?: ApplicationSyncTransaction; executor?: DbExecutor; migrationId?: string }
): Promise<void> {
    if (warnings.length === 0) return
    const executor = createSyncExecutor({
        trx: options?.trx,
        requestExecutor: options?.executor
    })
    let migrationRecord: { id: string; meta: Record<string, unknown> } | null = null
    if (options?.migrationId || options?.trx) {
        migrationRecord = await readMigrationRow(executor, schemaName, { migrationId: options.migrationId })
    } else {
        const latestMigration = await migrationManager.getLatestMigration(schemaName)
        if (latestMigration) migrationRecord = { id: latestMigration.id, meta: latestMigration.meta as unknown as Record<string, unknown> }
    }
    if (!migrationRecord) return
    const existing = Array.isArray(migrationRecord.meta.seedWarnings) ? migrationRecord.meta.seedWarnings : []
    await updateMigrationMeta(executor, schemaName, migrationRecord.id, {
        ...migrationRecord.meta,
        seedWarnings: [...existing, ...warnings]
    })
}
