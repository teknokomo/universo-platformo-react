import { qSchemaTable } from '@universo-react/database'
import { applicationTemplateKeySchema, type ApplicationTemplateKey } from '@universo-react/types'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import type { ApplicationLayoutSyncResolution } from '@universo-react/types'
import type { PersistedAppLayout, PersistedAppLayoutZoneWidget } from '../routes/sync/syncTypes'
import { stableLineageUuidV7 } from '../shared/applicationLayoutWidgetLineage'
import {
    applicationLayoutMutationLockKey,
    lockApplicationLayoutMutationFamily,
    lockApplicationLayoutRow,
    lockApplicationLayoutScope,
    lockApplicationLayoutWidgetSet,
    runApplicationLayoutTransaction
} from './applicationLayoutStoreSupport'
type JsonRecord = Record<string, unknown>

export interface ApplicationLayoutSyncLayoutRow {
    id: string
    scope_entity_id: string | null
    template_key: string
    name: unknown
    description: unknown
    config: unknown
    is_active: boolean
    is_default: boolean
    sort_order: number
    source_kind: string
    source_layout_id: string | null
    source_snapshot_hash: string | null
    source_content_hash: string | null
    local_content_hash: string | null
    sync_state: string
    is_source_excluded: boolean
    source_deleted_at: string | null
    source_deleted_by: string | null
    _upl_deleted: boolean
    _app_deleted: boolean
    _upl_created_at: unknown
    version: number
}

export interface ApplicationLayoutSyncWidgetRow {
    id: string
    layout_id: string
    zone: string
    widget_key: string
    sort_order: number
    config: unknown
    source_config: unknown
    is_active: boolean
    source_widget_id: string | null
    source_base_widget_id: string | null
    source_content_hash: string | null
    local_content_hash: string | null
    _upl_deleted: boolean
    _app_deleted: boolean
    _upl_created_at: unknown
    version: number
}

export interface SyncLayoutInput {
    row: PersistedAppLayout
    sourceContentHash: string
    sourceSnapshotHash: string | null
}

export interface SyncWidgetInput extends PersistedAppLayoutZoneWidget {
    sourceContentHash: string
}

export interface ApplicationLayoutSyncPolicy {
    default?: ApplicationLayoutSyncResolution
    bySourceLayoutId?: Record<string, ApplicationLayoutSyncResolution>
}

const activeRowPredicate = '_upl_deleted = false AND _app_deleted = false'

const isRecord = (value: unknown): value is JsonRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const json = (value: unknown): string => JSON.stringify(value ?? null)

const readExists = (value: unknown): boolean => value === true || value === 't' || value === 1 || value === '1'

const requireExactlyOne = <T>(rows: T[], code: string): T => {
    if (rows.length !== 1) throw new Error(code)
    return rows[0] as T
}

interface SourceLayoutWidgetTombstoneRow {
    id: string
    layout_id: string
    is_active: boolean
    _upl_deleted: boolean
    _app_deleted: boolean
}

export const tombstoneApplicationLayoutWidgetsForSourceRemoval = async (
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null
): Promise<void> => {
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const rows = await executor.query<SourceLayoutWidgetTombstoneRow>(
        `
        UPDATE ${widgetsTable}
        SET is_active = false,
            _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _app_deleted = false,
            _app_deleted_at = NULL,
            _app_deleted_by = NULL
        WHERE layout_id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
        RETURNING id, layout_id, is_active, _upl_deleted, _app_deleted
        `,
        [layoutId, userId]
    )

    for (const row of rows) {
        if (row.layout_id !== layoutId || row.is_active !== false || row._upl_deleted !== true || row._app_deleted !== false) {
            throw new Error('[SchemaSync] Source layout widget tombstone invariant violated')
        }
    }
}

export const allocatePhysicalUuid = (usedIds: Set<string>): string => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const id = generateUuidV7()
        if (!usedIds.has(id)) {
            usedIds.add(id)
            return id
        }
    }
    throw new Error('[SchemaSync] Unable to allocate a unique UUID v7 physical identity')
}

export const sourceLayoutIdentity = (row: ApplicationLayoutSyncLayoutRow): string | null => {
    if (row.source_kind !== 'metahub' || row._app_deleted) return null
    if (typeof row.source_layout_id === 'string' && row.source_layout_id.length > 0) return row.source_layout_id
    return null
}

const buildSourceLayoutMap = (
    rows: readonly ApplicationLayoutSyncLayoutRow[],
    nextLayouts: readonly SyncLayoutInput[]
): Map<string, string> => {
    const usedIds = new Set(rows.filter((row) => !row._app_deleted).map((row) => row.id))
    const map = new Map<string, string>()

    for (const next of nextLayouts) {
        const sourceId = next.row.id
        const matches = rows.filter(
            (row) =>
                sourceLayoutIdentity(row) === sourceId || (row.source_kind === 'metahub' && !row.source_layout_id && row.id === sourceId)
        )
        if (matches.length > 1) throw new Error('[SchemaSync] Existing application layouts contain duplicate source lineage')
        const physicalId = matches[0]?.id ?? allocatePhysicalUuid(usedIds)
        map.set(sourceId, physicalId)
    }

    return map
}

const remapLayoutConfig = (config: JsonRecord, sourceToPhysical: ReadonlyMap<string, string>): JsonRecord => {
    const baseLayoutId = config.baseLayoutId
    if (baseLayoutId === undefined || baseLayoutId === null) return config
    if (typeof baseLayoutId !== 'string') throw new Error('[SchemaSync] Layout base reference is malformed')
    const physicalBaseId = sourceToPhysical.get(baseLayoutId)
    if (!physicalBaseId) throw new Error(`[SchemaSync] Layout references missing base layout ${baseLayoutId}`)
    return { ...config, baseLayoutId: physicalBaseId }
}

const layoutRowsSelect = (table: string): string => `
    SELECT
      l.id,
      l.scope_entity_id,
      l.template_key,
      l.name,
      l.description,
      l.config,
      l.is_active,
      l.is_default,
      l.sort_order,
      l.source_kind,
      l.source_layout_id,
      l.source_snapshot_hash,
      l.source_content_hash,
      l.local_content_hash,
      l.sync_state,
      l.is_source_excluded,
      l.source_deleted_at::text,
      l.source_deleted_by,
      l._upl_deleted,
      l._app_deleted,
      l._upl_created_at,
      COALESCE(l._upl_version, 1)::int AS version
    FROM ${table} l
`

const widgetRowsSelect = (table: string): string => `
    SELECT
      w.id,
      w.layout_id,
      w.zone,
      w.widget_key,
      w.sort_order,
      w.config,
      w.source_config,
      w.is_active,
      w.source_widget_id,
      w.source_base_widget_id,
      w.source_content_hash,
      w.local_content_hash,
      w._upl_deleted,
      w._app_deleted,
      w._upl_created_at,
      COALESCE(w._upl_version, 1)::int AS version
    FROM ${table} w
`

export async function applicationLayoutSyncTablesExist(executor: DbExecutor, schemaName: string): Promise<boolean> {
    const rows = await executor.query<{ exists: unknown }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name IN ($2, $3)
            GROUP BY table_schema
            HAVING COUNT(*) = 2
        ) AS exists
        `,
        [schemaName, '_app_layouts', '_app_widgets']
    )
    return readExists(rows[0]?.exists)
}

export async function applicationLayoutsTableExists(executor: DbExecutor, schemaName: string): Promise<boolean> {
    const rows = await executor.query<{ exists: unknown }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = $2
        ) AS exists
        `,
        [schemaName, '_app_layouts']
    )
    return readExists(rows[0]?.exists)
}

export async function applicationWidgetsTableExists(executor: DbExecutor, schemaName: string): Promise<boolean> {
    const rows = await executor.query<{ exists: unknown }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = $2
        ) AS exists
        `,
        [schemaName, '_app_widgets']
    )
    return readExists(rows[0]?.exists)
}

export async function listApplicationLayoutSyncRows(
    executor: DbExecutor,
    schemaName: string,
    options: { includeDeleted?: boolean } = {}
): Promise<ApplicationLayoutSyncLayoutRow[]> {
    const table = qSchemaTable(schemaName, '_app_layouts')
    const predicate = options.includeDeleted === false ? `WHERE ${activeRowPredicate}` : ''
    return executor.query<ApplicationLayoutSyncLayoutRow>(
        `${layoutRowsSelect(table)} ${predicate}
         ORDER BY l.scope_entity_id NULLS FIRST, l.sort_order ASC, l._upl_created_at ASC, l.id ASC`,
        []
    )
}

export async function listApplicationLayoutSyncWidgets(
    executor: DbExecutor,
    schemaName: string,
    options: { includeDeleted?: boolean } = {}
): Promise<ApplicationLayoutSyncWidgetRow[]> {
    const table = qSchemaTable(schemaName, '_app_widgets')
    const predicate = options.includeDeleted === false ? `WHERE ${activeRowPredicate}` : ''
    return executor.query<ApplicationLayoutSyncWidgetRow>(
        `${widgetRowsSelect(table)} ${predicate}
         ORDER BY w.layout_id ASC, w.zone ASC, w.sort_order ASC, w._upl_created_at ASC, w.id ASC`,
        []
    )
}

export const lockApplicationLayoutSyncHierarchy = async (
    executor: DbExecutor,
    schemaName: string,
    nextScopes: readonly (string | null)[] = []
): Promise<void> => {
    await lockApplicationLayoutMutationFamily(executor, schemaName)
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const existing = await executor.query<{ id: string; scope_entity_id: string | null }>(
        `SELECT id, scope_entity_id FROM ${layoutsTable} WHERE _app_deleted = false`,
        []
    )
    const scopes = new Set<string>(nextScopes.map((scope) => scope ?? ''))
    for (const row of existing) scopes.add(row.scope_entity_id ?? '')
    for (const scope of [...scopes].sort((left, right) => left.localeCompare(right))) {
        await lockApplicationLayoutScope(executor, schemaName, scope || null)
    }

    const lockedLayouts = await executor.query<{ id: string }>(
        `SELECT id FROM ${layoutsTable} WHERE _app_deleted = false ORDER BY id ASC`,
        []
    )
    for (const row of lockedLayouts) {
        await lockApplicationLayoutRow(executor, schemaName, row.id)
        await executor.query(`SELECT id FROM ${layoutsTable} WHERE id = $1 AND _app_deleted = false FOR UPDATE`, [row.id])
        await lockApplicationLayoutWidgetSet(executor, schemaName, row.id)
        const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
        await executor.query(`SELECT id FROM ${widgetsTable} WHERE layout_id = $1 AND _app_deleted = false FOR UPDATE`, [row.id])
    }
}

const layoutMutationPayload = (input: SyncLayoutInput, physicalLayoutId: string, config: JsonRecord, isDefault: boolean) => ({
    physicalLayoutId,
    scopeEntityId: input.row.scopeEntityId,
    templateKey: input.row.templateKey,
    name: input.row.name,
    description: input.row.description,
    config,
    isActive: input.row.isActive,
    isDefault,
    sortOrder: input.row.sortOrder,
    sourceLayoutId: input.row.id,
    sourceContentHash: input.sourceContentHash,
    sourceSnapshotHash: input.sourceSnapshotHash
})

const updateLayout = async (
    executor: DbExecutor,
    table: string,
    payload: ReturnType<typeof layoutMutationPayload>,
    userId: string | null,
    extra: { sourceKind?: string; syncState?: string; isSourceExcluded?: boolean; sourceDeletedAt?: string | null } = {}
): Promise<void> => {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${table}
        SET scope_entity_id = $2,
            template_key = $3,
            name = $4::jsonb,
            description = $5::jsonb,
            config = $6::jsonb,
            is_active = $7,
            is_default = $8,
            sort_order = $9,
            owner_id = NULL,
            source_kind = $10,
            source_layout_id = $11,
            source_snapshot_hash = $12,
            source_content_hash = $13,
            local_content_hash = $14,
            sync_state = $15,
            is_source_excluded = $16,
            source_deleted_at = $17,
            source_deleted_by = CASE WHEN $17 IS NULL THEN NULL ELSE source_deleted_by END,
            _upl_updated_at = NOW(),
            _upl_updated_by = $18,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _upl_deleted = false,
            _upl_deleted_at = NULL,
            _upl_deleted_by = NULL,
            _app_deleted = false,
            _app_deleted_at = NULL,
            _app_deleted_by = NULL
        WHERE id = $1 AND _app_deleted = false
        RETURNING id
        `,
        [
            payload.physicalLayoutId,
            payload.scopeEntityId,
            payload.templateKey,
            json(payload.name),
            json(payload.description),
            json(payload.config),
            payload.isActive,
            payload.isDefault,
            payload.sortOrder,
            extra.sourceKind ?? 'metahub',
            payload.sourceLayoutId,
            payload.sourceSnapshotHash,
            payload.sourceContentHash,
            payload.sourceContentHash,
            extra.syncState ?? 'clean',
            extra.isSourceExcluded ?? false,
            extra.sourceDeletedAt ?? null,
            userId
        ]
    )
    requireExactlyOne(rows, '[SchemaSync] Layout update lost its target row')
}

const updateLayoutMetadata = async (
    executor: DbExecutor,
    table: string,
    layoutId: string,
    values: {
        sourceSnapshotHash?: string | null
        sourceContentHash?: string | null
        syncState?: string
        isDefault?: boolean
        isActive?: boolean
    },
    userId: string | null
): Promise<void> => {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${table}
        SET source_snapshot_hash = COALESCE($2, source_snapshot_hash),
            source_content_hash = COALESCE($3, source_content_hash),
            sync_state = COALESCE($4, sync_state),
            is_default = COALESCE($5, is_default),
            is_active = COALESCE($6, is_active),
            _upl_updated_at = NOW(),
            _upl_updated_by = $7,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1 AND _app_deleted = false AND _upl_deleted = false
        RETURNING id
        `,
        [
            layoutId,
            values.sourceSnapshotHash ?? null,
            values.sourceContentHash ?? null,
            values.syncState ?? null,
            values.isDefault ?? null,
            values.isActive ?? null,
            userId
        ]
    )
    requireExactlyOne(rows, '[SchemaSync] Layout metadata update lost its target row')
}

const insertLayout = async (
    executor: DbExecutor,
    table: string,
    payload: ReturnType<typeof layoutMutationPayload>,
    userId: string | null,
    sourceKind = 'metahub',
    syncState = 'clean'
): Promise<void> => {
    const rows = await executor.query<{ id: string }>(
        `
        INSERT INTO ${table} (
            id, scope_entity_id, template_key, name, description, config, is_active, is_default, sort_order,
            owner_id, source_kind, source_layout_id, source_snapshot_hash, source_content_hash, local_content_hash,
            sync_state, is_source_excluded, source_deleted_at, source_deleted_by,
            _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
            _upl_archived, _upl_deleted, _upl_locked, _app_published, _app_archived, _app_deleted
        ) VALUES (
            $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9,
            NULL, $10, $11, $12, $13, $13,
            $14, false, NULL, NULL,
            NOW(), $15, NOW(), $15, 1,
            false, false, false, true, false, false
        )
        RETURNING id
        `,
        [
            payload.physicalLayoutId,
            payload.scopeEntityId,
            payload.templateKey,
            json(payload.name),
            json(payload.description),
            json(payload.config),
            payload.isActive,
            payload.isDefault,
            payload.sortOrder,
            sourceKind,
            payload.sourceLayoutId,
            payload.sourceSnapshotHash,
            payload.sourceContentHash,
            syncState,
            userId
        ]
    )
    requireExactlyOne(rows, '[SchemaSync] Layout insert did not return its physical identity')
}

export const widgetSourceId = (row: SyncWidgetInput): string =>
    row.sourceBaseWidgetId ?? (row.sourceLineageKey ? stableLineageUuidV7(row.layoutId, row.sourceLineageKey) : row.id)

export const insertApplicationLayoutSyncWidget = async (
    executor: DbExecutor,
    table: string,
    physicalWidgetId: string,
    physicalLayoutId: string,
    row: SyncWidgetInput,
    sourceContentHash: string | null,
    userId: string | null,
    options: { ownership?: 'inherited' | 'application' } = {}
): Promise<void> => {
    const isApplicationOwned = options.ownership === 'application'
    const result = await executor.query<{ id: string }>(
        `
        INSERT INTO ${table} (
            id, layout_id, zone, widget_key, sort_order, config, source_config, is_active,
            source_widget_id, source_base_widget_id, source_content_hash, local_content_hash,
            _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
            _upl_archived, _upl_deleted, _upl_locked, _app_published, _app_archived, _app_deleted
        ) VALUES (
            $1, $2, $3, $4, $5, $6::jsonb, ${isApplicationOwned ? 'NULL::jsonb' : '$6::jsonb'}, $7,
            ${isApplicationOwned ? 'NULL' : '$8'}, ${isApplicationOwned ? 'NULL' : '$9'}, ${isApplicationOwned ? 'NULL' : '$10'}, $10,
            NOW(), $11, NOW(), $11, 1,
            false, false, false, true, false, false
        )
        RETURNING id
        `,
        [
            physicalWidgetId,
            physicalLayoutId,
            row.zone,
            row.widgetKey,
            row.sortOrder,
            json(row.config),
            row.isActive !== false,
            widgetSourceId(row),
            row.sourceBaseWidgetId ?? null,
            sourceContentHash,
            userId
        ]
    )
    requireExactlyOne(result, '[SchemaSync] Widget insert did not return its physical identity')
}

export async function syncApplicationLayouts(
    executor: DbExecutor,
    schemaName: string,
    input: {
        layouts: readonly SyncLayoutInput[]
        widgetsBySourceLayoutId: ReadonlyMap<string, readonly SyncWidgetInput[]>
        snapshotHash: string | null
        userId: string | null
        policy?: ApplicationLayoutSyncPolicy
    }
): Promise<void> {
    const run = async (tx: DbExecutor): Promise<void> => {
        const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
        const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
        await lockApplicationLayoutSyncHierarchy(
            tx,
            schemaName,
            input.layouts.map(({ row }) => row.scopeEntityId)
        )
        const existingRows = await listApplicationLayoutSyncRows(tx, schemaName)
        const existingWidgetRows = await listApplicationLayoutSyncWidgets(tx, schemaName)
        const sourceToPhysical = buildSourceLayoutMap(existingRows, input.layouts)
        const existingByPhysicalId = new Map(existingRows.filter((row) => !row._app_deleted).map((row) => [row.id, row]))
        const widgetsByLayoutId = new Map<string, readonly SyncWidgetInput[]>()
        for (const layout of input.layouts) {
            const physicalId = sourceToPhysical.get(layout.row.id)
            if (physicalId) widgetsByLayoutId.set(physicalId, input.widgetsBySourceLayoutId.get(layout.row.id) ?? [])
        }

        for (const layoutInput of input.layouts) {
            const sourceLayoutId = layoutInput.row.id
            const physicalLayoutId = sourceToPhysical.get(sourceLayoutId)
            if (!physicalLayoutId) throw new Error('[SchemaSync] Layout source map is incomplete')
            const existing = existingByPhysicalId.get(physicalLayoutId)
            const mappedConfig = remapLayoutConfig(isRecord(layoutInput.row.config) ? layoutInput.row.config : {}, sourceToPhysical)
            let isDefault = layoutInput.row.isDefault

            if (isDefault) {
                const defaults = existingRows.filter(
                    (candidate) =>
                        candidate.id !== physicalLayoutId &&
                        candidate._upl_deleted === false &&
                        candidate._app_deleted === false &&
                        candidate.is_active === true &&
                        candidate.is_default === true &&
                        (candidate.scope_entity_id ?? null) === (layoutInput.row.scopeEntityId ?? null)
                )
                const hasApplicationDefault = defaults.some((candidate) => candidate.source_kind === 'application')
                const hasLocalModifiedDefault = defaults.some(
                    (candidate) =>
                        candidate.source_kind === 'metahub' &&
                        candidate.source_content_hash !== null &&
                        candidate.local_content_hash !== null &&
                        candidate.source_content_hash !== candidate.local_content_hash
                )
                if (hasApplicationDefault || hasLocalModifiedDefault) {
                    isDefault = false
                } else {
                    for (const candidate of defaults) {
                        const displaced = await tx.query<{ id: string }>(
                            `
                            UPDATE ${layoutsTable}
                            SET is_default = false,
                                _upl_updated_at = NOW(),
                                _upl_updated_by = $3,
                                _upl_version = COALESCE(_upl_version, 1) + 1
                            WHERE id = $1
                              AND _upl_deleted = false
                              AND _app_deleted = false
                              AND is_active = true
                              AND is_default = true
                              AND scope_entity_id IS NOT DISTINCT FROM $2
                            RETURNING id
                            `,
                            [candidate.id, layoutInput.row.scopeEntityId, input.userId]
                        )
                        requireExactlyOne(displaced, '[SchemaSync] Default displacement lost its target row')
                    }
                }
            }

            const payload = layoutMutationPayload(layoutInput, physicalLayoutId, mappedConfig, isDefault)
            const locallyModified =
                existing?.source_kind === 'metahub' &&
                existing.source_content_hash !== null &&
                existing.local_content_hash !== null &&
                existing.source_content_hash !== existing.local_content_hash
            const resolution = input.policy?.bySourceLayoutId?.[sourceLayoutId] ?? input.policy?.default

            if (!existing) {
                await insertLayout(tx, layoutsTable, payload, input.userId)
                continue
            }

            if (existing.is_source_excluded) {
                if (resolution === 'overwrite_local') {
                    await updateLayout(tx, layoutsTable, payload, input.userId, {
                        sourceKind: 'metahub',
                        syncState: 'clean',
                        isSourceExcluded: false,
                        sourceDeletedAt: null
                    })
                }
                continue
            }

            if (locallyModified && existing.source_content_hash !== layoutInput.sourceContentHash && resolution !== 'overwrite_local') {
                if (resolution === 'copy_source_as_application') {
                    const copyRows = await tx.query<{ id: string }>(
                        `
                        SELECT id
                        FROM ${layoutsTable}
                        WHERE _upl_deleted = false
                          AND _app_deleted = false
                          AND source_kind = 'application'
                          AND source_layout_id = $1
                          AND source_content_hash = $2
                        LIMIT 1
                        `,
                        [sourceLayoutId, layoutInput.sourceContentHash]
                    )
                    if (copyRows.length === 0) {
                        const copyUsedIds = new Set([
                            ...existingRows.map((row) => row.id),
                            ...existingWidgetRows.map((row) => row.id),
                            ...(widgetsByLayoutId.get(physicalLayoutId) ?? []).map((widget) => widget.id)
                        ])
                        const copyId = allocatePhysicalUuid(copyUsedIds)
                        const copyPayload = { ...payload, physicalLayoutId: copyId, isDefault: false }
                        await insertLayout(tx, layoutsTable, copyPayload, input.userId, 'application', 'clean')
                        for (const widget of widgetsByLayoutId.get(physicalLayoutId) ?? []) {
                            const copiedWidgetId = allocatePhysicalUuid(copyUsedIds)
                            await insertApplicationLayoutSyncWidget(
                                tx,
                                widgetsTable,
                                copiedWidgetId,
                                copyId,
                                widget,
                                widget.sourceContentHash,
                                input.userId,
                                { ownership: 'application' }
                            )
                        }
                    }
                    await updateLayoutMetadata(
                        tx,
                        layoutsTable,
                        physicalLayoutId,
                        {
                            sourceSnapshotHash: input.snapshotHash,
                            sourceContentHash: layoutInput.sourceContentHash,
                            syncState: 'local_modified'
                        },
                        input.userId
                    )
                    continue
                }
                if (resolution === 'keep_local') {
                    await updateLayoutMetadata(
                        tx,
                        layoutsTable,
                        physicalLayoutId,
                        {
                            sourceSnapshotHash: input.snapshotHash,
                            sourceContentHash: layoutInput.sourceContentHash,
                            syncState: 'local_modified'
                        },
                        input.userId
                    )
                    continue
                }
                if (resolution === 'skip_source') {
                    await updateLayoutMetadata(tx, layoutsTable, physicalLayoutId, { syncState: 'source_updated' }, input.userId)
                    continue
                }
                await updateLayoutMetadata(
                    tx,
                    layoutsTable,
                    physicalLayoutId,
                    { sourceSnapshotHash: input.snapshotHash, sourceContentHash: layoutInput.sourceContentHash, syncState: 'conflict' },
                    input.userId
                )
                continue
            }

            await updateLayout(tx, layoutsTable, payload, input.userId, {
                sourceKind: 'metahub',
                syncState: 'clean',
                isSourceExcluded: false
            })
        }

        const nextSourceIds = input.layouts.map(({ row }) => row.id)
        const missingRows = existingRows.filter(
            (row) =>
                row.source_kind === 'metahub' &&
                typeof row.source_layout_id === 'string' &&
                !row.is_source_excluded &&
                !nextSourceIds.includes(row.source_layout_id) &&
                row._upl_deleted === false &&
                row._app_deleted === false
        )
        for (const missing of missingRows) {
            const sourceId = missing.source_layout_id as string
            const locallyModified =
                missing.source_content_hash !== null &&
                missing.local_content_hash !== null &&
                missing.source_content_hash !== missing.local_content_hash
            const resolution = input.policy?.bySourceLayoutId?.[sourceId] ?? input.policy?.default
            if (missing.sync_state === 'source_removed' && resolution === 'skip_source') {
                continue
            }
            if (missing.sync_state === 'source_removed' && resolution === undefined) {
                await tombstoneApplicationLayoutWidgetsForSourceRemoval(tx, schemaName, missing.id, input.userId)
                continue
            }
            if (locallyModified && resolution !== 'overwrite_local' && resolution !== 'skip_source') {
                const rows = await tx.query<{ id: string }>(
                    `
                    UPDATE ${layoutsTable}
                    SET source_kind = 'application', source_layout_id = NULL, source_snapshot_hash = NULL,
                        source_content_hash = NULL, sync_state = 'clean',
                        _upl_updated_at = NOW(), _upl_updated_by = $2,
                        _upl_version = COALESCE(_upl_version, 1) + 1
                    WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
                    RETURNING id
                    `,
                    [missing.id, input.userId]
                )
                requireExactlyOne(rows, '[SchemaSync] Local layout detachment lost its target row')
                continue
            }
            const rows = await tx.query<{ id: string }>(
                `
                UPDATE ${layoutsTable}
                SET is_active = CASE WHEN $2 = 'skip_source' THEN is_active ELSE false END,
                    is_default = CASE WHEN $2 = 'skip_source' THEN is_default ELSE false END,
                    sync_state = 'source_removed',
                    _upl_updated_at = NOW(), _upl_updated_by = $3,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
                RETURNING id
                `,
                [missing.id, resolution ?? 'remove_source', input.userId]
            )
            requireExactlyOne(rows, '[SchemaSync] Removed layout update lost its target row')
            if (resolution !== 'skip_source') {
                await tombstoneApplicationLayoutWidgetsForSourceRemoval(tx, schemaName, missing.id, input.userId)
            }
        }
    }

    await runApplicationLayoutTransaction(executor, run)
}

export async function getPersistedDashboardLayoutConfig(executor: DbExecutor, schemaName: string): Promise<Record<string, unknown>> {
    const table = qSchemaTable(schemaName, '_app_layouts')
    const preferred = await executor.query<{ config: unknown }>(
        `SELECT config FROM ${table} WHERE scope_entity_id IS NULL AND template_key = $1 AND is_default = true AND ${activeRowPredicate} LIMIT 1`,
        ['dashboard']
    )
    const fallback =
        preferred.length > 0
            ? []
            : await executor.query<{ config: unknown }>(
                  `SELECT config FROM ${table} WHERE scope_entity_id IS NULL AND template_key = $1 AND is_active = true AND ${activeRowPredicate} ORDER BY sort_order ASC, _upl_created_at ASC LIMIT 1`,
                  ['dashboard']
              )
    const value = preferred[0]?.config ?? fallback[0]?.config
    return isRecord(value) ? value : {}
}

const parseTemplateKey = (value: unknown, context: string): ApplicationTemplateKey => {
    const parsed = applicationTemplateKeySchema.safeParse(value)
    if (!parsed.success) throw new Error(`[SchemaSync] Invalid template key for ${context}`)
    return parsed.data
}

export async function getPersistedPublishedLayouts(
    executor: DbExecutor,
    schemaName: string
): Promise<{ layouts: PersistedAppLayout[]; defaultLayoutId: string | null }> {
    const table = qSchemaTable(schemaName, '_app_layouts')
    const rows = await executor.query<ApplicationLayoutSyncLayoutRow>(
        `${layoutRowsSelect(table)}
         WHERE l.source_kind = 'metahub' AND l.is_active = true AND l.is_source_excluded = false AND l.sync_state <> $1 AND ${activeRowPredicate}
         ORDER BY l.scope_entity_id NULLS FIRST, l.sort_order ASC, l._upl_created_at ASC, l.id ASC`,
        ['conflict']
    )
    const layouts = rows.map((row) => ({
        id: row.id,
        scopeEntityId: row.scope_entity_id ?? null,
        templateKey: parseTemplateKey(row.template_key, `persisted layout ${row.id}`),
        name: isRecord(row.name) ? row.name : {},
        description: isRecord(row.description) ? row.description : null,
        config: isRecord(row.config) ? row.config : {},
        isActive: row.is_active === true,
        isDefault: row.is_default === true,
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
    }))
    return { layouts, defaultLayoutId: layouts.find((row) => row.scopeEntityId === null && row.isDefault)?.id ?? null }
}

export async function getPersistedPublishedWidgets(executor: DbExecutor, schemaName: string): Promise<PersistedAppLayoutZoneWidget[]> {
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const rows = await executor.query<ApplicationLayoutSyncWidgetRow & { template_key: unknown }>(
        `
        SELECT w.id, w.layout_id, w.zone, w.widget_key, w.sort_order, w.config, w.is_active,
               w.source_base_widget_id, w.source_widget_id, l.template_key
        FROM ${widgetsTable} w
        INNER JOIN ${layoutsTable} l ON l.id = w.layout_id
        WHERE l.is_active = true
          AND w.is_active = true
          AND w._upl_deleted = false AND w._app_deleted = false
          AND l._upl_deleted = false AND l._app_deleted = false
          AND l.source_kind = 'metahub' AND l.is_source_excluded = false AND l.sync_state <> $1
        ORDER BY w.layout_id ASC, w.zone ASC, w.sort_order ASC, w._upl_created_at ASC, w.id ASC
        `,
        ['conflict']
    )
    return rows.map((row) => ({
        id: row.id,
        layoutId: row.layout_id,
        sourceBaseWidgetId: row.source_base_widget_id,
        zone: row.zone as PersistedAppLayoutZoneWidget['zone'],
        widgetKey: row.widget_key,
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
        config: isRecord(row.config) ? row.config : {},
        isActive: row.is_active !== false
    }))
}

export async function readMigrationRow(
    executor: DbExecutor,
    schemaName: string,
    options: { migrationId?: string }
): Promise<{ id: string; meta: JsonRecord } | null> {
    const table = qSchemaTable(schemaName, '_app_migrations')
    const rows = options.migrationId
        ? await executor.query<{ id: string; meta: unknown }>(`SELECT id, meta FROM ${table} WHERE id = $1 LIMIT 1`, [options.migrationId])
        : await executor.query<{ id: string; meta: unknown }>(`SELECT id, meta FROM ${table} ORDER BY applied_at DESC LIMIT 1`, [])
    const row = rows[0]
    if (!row) return null
    const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta
    return { id: row.id, meta: isRecord(meta) ? meta : {} }
}

export async function updateMigrationMeta(executor: DbExecutor, schemaName: string, migrationId: string, meta: JsonRecord): Promise<void> {
    const table = qSchemaTable(schemaName, '_app_migrations')
    const rows = await executor.query<{ id: string }>(`UPDATE ${table} SET meta = $2::jsonb WHERE id = $1 RETURNING id`, [
        migrationId,
        json(meta)
    ])
    requireExactlyOne(rows, '[SchemaSync] Migration metadata update lost its target row')
}

export async function runApplicationLayoutSyncTransaction<T>(executor: DbExecutor, callback: (tx: DbExecutor) => Promise<T>): Promise<T> {
    return runApplicationLayoutTransaction(executor, callback)
}

export const applicationLayoutSyncLockName = (schemaName: string): string => applicationLayoutMutationLockKey(schemaName)
