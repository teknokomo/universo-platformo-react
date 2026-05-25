import { qSchemaTable } from '@universo/database'
import {
    DASHBOARD_LAYOUT_WIDGETS,
    applicationLayoutCreateSchema,
    applicationLayoutMutationSchema,
    applicationLayoutWidgetConfigMutationSchema,
    applicationLayoutWidgetMoveMutationSchema,
    applicationLayoutWidgetMutationSchema,
    applicationLayoutWidgetToggleMutationSchema,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayout,
    type ApplicationLayoutCreate,
    type ApplicationLayoutDetailResponse,
    type ApplicationLayoutMutation,
    type ApplicationLayoutScope,
    type ApplicationLayoutWidget,
    type ApplicationLayoutWidgetConfigMutation,
    type ApplicationLayoutWidgetMoveMutation,
    type ApplicationLayoutWidgetMutation,
    type ApplicationLayoutWidgetToggleMutation
} from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { activeAppRowCondition, softDeleteSetClause } from '@universo/utils/database'
import { hashApplicationLayoutContent } from '../utils/applicationLayoutHash'

const GLOBAL_SCOPE_ID = 'global'
const ORDERED_LAYOUT_ZONES: Array<ApplicationLayoutWidget['zone']> = ['left', 'top', 'right', 'bottom', 'center']

interface LayoutRow {
    id: string
    scope_entity_id: string | null
    template_key: string
    name: Record<string, unknown>
    description: Record<string, unknown> | null
    config: Record<string, unknown>
    is_active: boolean
    is_default: boolean
    sort_order: number
    source_kind: 'metahub' | 'application'
    source_layout_id: string | null
    source_snapshot_hash: string | null
    source_content_hash: string | null
    local_content_hash: string | null
    sync_state: ApplicationLayout['syncState']
    is_source_excluded: boolean
    source_deleted_at: string | null
    source_deleted_by: string | null
    version: number
}

interface WidgetRow {
    id: string
    layout_id: string
    zone: string
    widget_key: string
    sort_order: number
    config: Record<string, unknown>
    is_active: boolean
    version: number
}

interface ApplicationSchemaRow {
    schemaName: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

function assertApplicationLayoutWidgetConfig(widgetKey: string, config: unknown): Record<string, unknown> {
    try {
        return parseApplicationLayoutWidgetConfig(widgetKey, config)
    } catch {
        throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    }
}

const mapLayout = (row: LayoutRow): ApplicationLayout => ({
    id: row.id,
    scopeId: row.scope_entity_id ?? GLOBAL_SCOPE_ID,
    scopeKind: row.scope_entity_id ? 'entity' : 'global',
    scopeEntityId: row.scope_entity_id,
    templateKey: row.template_key,
    name: isRecord(row.name) ? row.name : {},
    description: isRecord(row.description) ? row.description : null,
    config: isRecord(row.config) ? row.config : {},
    isActive: row.is_active,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
    sourceKind: row.source_kind,
    sourceLayoutId: row.source_layout_id,
    sourceSnapshotHash: row.source_snapshot_hash,
    sourceContentHash: row.source_content_hash,
    localContentHash: row.local_content_hash,
    syncState: row.sync_state,
    isSourceExcluded: row.is_source_excluded,
    sourceDeletedAt: row.source_deleted_at,
    sourceDeletedBy: row.source_deleted_by,
    version: row.version
})

const mapWidget = (row: WidgetRow): ApplicationLayoutWidget => ({
    id: row.id,
    layoutId: row.layout_id,
    zone: row.zone as ApplicationLayoutWidget['zone'],
    widgetKey: row.widget_key as ApplicationLayoutWidget['widgetKey'],
    sortOrder: row.sort_order,
    config: isRecord(row.config) ? row.config : {},
    isActive: row.is_active,
    version: row.version
})

const layoutSelect = (layoutsTable: string): string => `
    SELECT
      ${layoutsTable}.id,
      ${layoutsTable}.scope_entity_id,
      ${layoutsTable}.template_key,
      ${layoutsTable}.name,
      ${layoutsTable}.description,
      ${layoutsTable}.config,
      ${layoutsTable}.is_active,
      ${layoutsTable}.is_default,
      ${layoutsTable}.sort_order,
      ${layoutsTable}.source_kind,
      ${layoutsTable}.source_layout_id,
      ${layoutsTable}.source_snapshot_hash,
      ${layoutsTable}.source_content_hash,
      ${layoutsTable}.local_content_hash,
      ${layoutsTable}.sync_state,
      ${layoutsTable}.is_source_excluded,
      ${layoutsTable}.source_deleted_at::text,
      ${layoutsTable}.source_deleted_by,
      COALESCE(${layoutsTable}._upl_version, 1)::int AS version
    FROM ${layoutsTable}
`

const widgetSelect = (widgetsTable: string): string => `
    SELECT
      id,
      layout_id,
      zone,
      widget_key,
      sort_order,
      config,
      is_active,
      COALESCE(_upl_version, 1)::int AS version
    FROM ${widgetsTable}
`

async function assignNextDefaultLayout(
    executor: DbExecutor,
    schemaName: string,
    scopeEntityId: string | null,
    excludeLayoutId: string | null,
    userId: string | null
): Promise<void> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const params: unknown[] = [scopeEntityId]
    const exclusionSql =
        excludeLayoutId === null
            ? ''
            : (() => {
                  params.push(excludeLayoutId)
                  return `AND id <> $${params.length}`
              })()

    const candidates = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${layoutsTable}
        WHERE scope_entity_id IS NOT DISTINCT FROM $1
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
          ${exclusionSql}
        ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC, id ASC
        LIMIT 1
        `,
        params
    )

    const nextDefaultId = candidates[0]?.id
    if (!nextDefaultId) {
        return
    }

    await executor.query(
        `
        UPDATE ${layoutsTable}
        SET is_default = CASE WHEN id = $2 THEN true ELSE false END,
            _upl_updated_at = NOW(),
            _upl_updated_by = $3
        WHERE scope_entity_id IS NOT DISTINCT FROM $1
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        `,
        [scopeEntityId, nextDefaultId, userId]
    )
}

export async function getApplicationRuntimeSchemaName(executor: DbExecutor, applicationId: string): Promise<string | null> {
    const rows = await executor.query<ApplicationSchemaRow>(
        `
        SELECT schema_name AS "schemaName"
        FROM applications.obj_applications
        WHERE id = $1 AND ${activeAppRowCondition()}
        LIMIT 1
        `,
        [applicationId]
    )
    return rows[0]?.schemaName ?? null
}

export async function applicationLayoutTablesExist(executor: DbExecutor, schemaName: string): Promise<boolean> {
    const rows = await executor.query<{ layouts: boolean; widgets: boolean }>(
        `
        SELECT
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = '_app_layouts') AS layouts,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = '_app_widgets') AS widgets
        `,
        [schemaName]
    )
    return rows[0]?.layouts === true && rows[0]?.widgets === true
}

export async function listApplicationLayoutScopes(
    executor: DbExecutor,
    schemaName: string,
    locale: string
): Promise<ApplicationLayoutScope[]> {
    const objectsTable = qSchemaTable(schemaName, '_app_objects')
    const rows = await executor.query<{
        id: string
        kind: string
        table_name: string
        codename: Record<string, unknown>
        presentation: Record<string, unknown>
    }>(
        `
        SELECT id, kind, table_name, codename, presentation
        FROM ${objectsTable}
        WHERE _upl_deleted = false
          AND _app_deleted = false
          AND (
            config->'capabilities'->'layoutConfig'->>'enabled' = 'true'
            OR config->'layoutConfig'->>'enabled' = 'true'
          )
        ORDER BY table_name ASC, id ASC
        `
    )

    const resolveText = (value: unknown, fallback: string): string => {
        if (!isRecord(value)) return fallback
        const primary = typeof value._primary === 'string' ? value._primary : 'en'
        const locales = isRecord(value.locales) ? value.locales : {}
        const direct = locales[locale]
        if (isRecord(direct) && typeof direct.content === 'string' && direct.content.trim()) return direct.content
        const primaryEntry = locales[primary]
        if (isRecord(primaryEntry) && typeof primaryEntry.content === 'string' && primaryEntry.content.trim()) return primaryEntry.content
        const en = locales.en
        if (isRecord(en) && typeof en.content === 'string' && en.content.trim()) return en.content
        return fallback
    }

    return [
        { id: GLOBAL_SCOPE_ID, scopeKind: 'global', scopeEntityId: null, kind: null, tableName: null, name: 'Global' },
        ...rows.map((row) => ({
            id: row.id,
            scopeKind: 'entity' as const,
            scopeEntityId: row.id,
            kind: row.kind,
            tableName: row.table_name,
            codename: row.codename,
            name: resolveText(isRecord(row.presentation) ? row.presentation.name : undefined, row.table_name)
        }))
    ]
}

export async function listApplicationLayouts(
    executor: DbExecutor,
    schemaName: string,
    options: { limit: number; offset: number; scopeEntityId?: string | null }
): Promise<{ items: ApplicationLayout[]; total: number }> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const params: unknown[] = []
    const conditions = [`_upl_deleted = false`, `_app_deleted = false`]
    if (options.scopeEntityId !== undefined) {
        params.push(options.scopeEntityId)
        conditions.push(options.scopeEntityId === null ? `scope_entity_id IS NULL` : `scope_entity_id = $${params.length}`)
    }
    params.push(options.limit, options.offset)
    const rows = await executor.query<LayoutRow & { total: string }>(
        `
        ${layoutSelect(layoutsTable)}
        WHERE ${conditions.join(' AND ')}
        ORDER BY scope_entity_id NULLS FIRST, sort_order ASC, _upl_created_at ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
    )
    const countRows = await executor.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${layoutsTable} WHERE ${conditions.join(' AND ')}`,
        params.slice(0, -2)
    )
    return { items: rows.map(mapLayout), total: Number(countRows[0]?.count ?? 0) }
}

export async function getApplicationLayoutDetail(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string
): Promise<ApplicationLayoutDetailResponse | null> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const rows = await executor.query<LayoutRow>(
        `${layoutSelect(layoutsTable)} WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1`,
        [layoutId]
    )
    if (!rows[0]) return null
    const widgets = await executor.query<WidgetRow>(
        `${widgetSelect(widgetsTable)}
         WHERE layout_id = $1 AND _upl_deleted = false AND _app_deleted = false
         ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
        [layoutId]
    )
    return { item: mapLayout(rows[0]), widgets: widgets.map(mapWidget) }
}

export async function createApplicationLayout(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutCreate,
    userId: string | null
): Promise<ApplicationLayout> {
    const data = applicationLayoutCreateSchema.parse(input)
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const scopeId = data.scopeEntityId ?? null
    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:layout:${scopeId ?? GLOBAL_SCOPE_ID}`])
        const activeRows = await tx.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM ${layoutsTable} WHERE scope_entity_id IS NOT DISTINCT FROM $1 AND is_active = true AND _upl_deleted = false AND _app_deleted = false`,
            [scopeId]
        )
        const isDefault = data.isDefault ?? Number(activeRows[0]?.count ?? 0) === 0
        const isActive = isDefault ? true : data.isActive ?? true
        if (isDefault) {
            await tx.query(
                `UPDATE ${layoutsTable} SET is_default = false, _upl_updated_at = NOW(), _upl_updated_by = $2 WHERE scope_entity_id IS NOT DISTINCT FROM $1 AND is_active = true AND _upl_deleted = false AND _app_deleted = false`,
                [scopeId, userId]
            )
        }
        const localHash = hashApplicationLayoutContent({
            layout: { ...data, scopeEntityId: scopeId, isDefault, isActive },
            widgets: []
        })
        const rows = await tx.query<LayoutRow>(
            `
            INSERT INTO ${layoutsTable} (
              scope_entity_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
              source_kind, local_content_hash, sync_state, _upl_created_by, _upl_updated_by
            )
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, 'application', $10, 'clean', $9, $9)
            RETURNING *, COALESCE(_upl_version, 1)::int AS version, source_deleted_at::text
            `,
            [
                scopeId,
                data.templateKey,
                JSON.stringify(data.name),
                JSON.stringify(data.description ?? null),
                JSON.stringify(data.config ?? {}),
                isActive,
                isDefault,
                data.sortOrder ?? 0,
                userId,
                localHash
            ]
        )
        return mapLayout(rows[0])
    })
}

export async function updateApplicationLayout(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    input: ApplicationLayoutMutation,
    userId: string | null
): Promise<ApplicationLayout | null> {
    const data = applicationLayoutMutationSchema.parse(input)
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:layout:${layoutId}`])
        const current = await getApplicationLayoutDetail(tx, schemaName, layoutId)
        if (!current) return null
        if (data.expectedVersion && current.item.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const next = {
            ...current.item,
            ...data,
            isActive: data.isDefault === true ? true : data.isActive ?? current.item.isActive
        }
        if (data.isDefault === true) {
            await tx.query(
                `UPDATE ${layoutsTable} SET is_default = false, _upl_updated_at = NOW(), _upl_updated_by = $2 WHERE scope_entity_id IS NOT DISTINCT FROM $1 AND is_active = true AND id <> $3 AND _upl_deleted = false AND _app_deleted = false`,
                [current.item.scopeEntityId, userId, layoutId]
            )
        }
        if (data.isActive === false || data.isDefault === false) {
            const activeDefaults = await tx.query<{ count: string }>(
                `SELECT COUNT(*)::text AS count FROM ${layoutsTable} WHERE scope_entity_id IS NOT DISTINCT FROM $1 AND id <> $2 AND is_active = true AND is_default = true AND _upl_deleted = false AND _app_deleted = false`,
                [current.item.scopeEntityId, layoutId]
            )
            if (current.item.isDefault && Number(activeDefaults[0]?.count ?? 0) === 0) {
                throw new Error('APPLICATION_LAYOUT_LAST_DEFAULT')
            }
        }
        const localHash = hashApplicationLayoutContent({ layout: next, widgets: current.widgets })
        const syncState = current.item.sourceKind === 'metahub' && localHash !== current.item.sourceContentHash ? 'local_modified' : 'clean'
        const rows = await tx.query<LayoutRow>(
            `
            UPDATE ${layoutsTable}
            SET name = COALESCE($2::jsonb, name),
                description = COALESCE($3::jsonb, description),
                config = COALESCE($4::jsonb, config),
                is_active = COALESCE($5, is_active),
                is_default = COALESCE($6, is_default),
                sort_order = COALESCE($7, sort_order),
                local_content_hash = $8,
                sync_state = $9,
                _upl_updated_at = NOW(),
                _upl_updated_by = $10,
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
            RETURNING *, COALESCE(_upl_version, 1)::int AS version, source_deleted_at::text
            `,
            [
                layoutId,
                data.name === undefined ? null : JSON.stringify(data.name),
                data.description === undefined ? null : JSON.stringify(data.description),
                data.config === undefined ? null : JSON.stringify(data.config),
                next.isActive ?? null,
                data.isDefault ?? null,
                data.sortOrder ?? null,
                localHash,
                syncState,
                userId
            ]
        )
        if (rows[0] && current.item.isDefault && rows[0].is_default !== true) {
            await assignNextDefaultLayout(tx, schemaName, current.item.scopeEntityId, null, userId)
            return getApplicationLayoutDetail(tx, schemaName, layoutId).then((detail) => detail?.item ?? mapLayout(rows[0]))
        }
        return rows[0] ? mapLayout(rows[0]) : null
    })
}

export async function deleteApplicationLayout(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null,
    expectedVersion?: number
): Promise<boolean> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:layout:${layoutId}`])
        const current = await getApplicationLayoutDetail(tx, schemaName, layoutId)
        if (!current) return false
        if (expectedVersion && current.item.version !== expectedVersion) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        const activeRows = await tx.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM ${layoutsTable} WHERE scope_entity_id IS NOT DISTINCT FROM $1 AND id <> $2 AND is_active = true AND _upl_deleted = false AND _app_deleted = false`,
            [current.item.scopeEntityId, layoutId]
        )
        if (current.item.isActive && Number(activeRows[0]?.count ?? 0) === 0) throw new Error('APPLICATION_LAYOUT_LAST_ACTIVE')
        if (current.item.sourceKind === 'metahub') {
            await tx.query(
                `
                UPDATE ${layoutsTable}
                SET is_active = false,
                    is_default = false,
                    is_source_excluded = true,
                    sync_state = 'source_excluded',
                    source_deleted_at = NOW(),
                    source_deleted_by = $2,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $2,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
                `,
                [layoutId, userId]
            )
            if (current.item.isDefault) {
                await assignNextDefaultLayout(tx, schemaName, current.item.scopeEntityId, layoutId, userId)
            }
            return true
        }
        await tx.query(
            `UPDATE ${layoutsTable} SET ${softDeleteSetClause(
                '$2'
            )}, _upl_version = COALESCE(_upl_version, 1) + 1 WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [layoutId, userId]
        )
        if (current.item.isDefault) {
            await assignNextDefaultLayout(tx, schemaName, current.item.scopeEntityId, layoutId, userId)
        }
        return true
    })
}

export async function copyApplicationLayout(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null
): Promise<ApplicationLayout | null> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:layout:${layoutId}`])
        const current = await getApplicationLayoutDetail(tx, schemaName, layoutId)
        if (!current) return null
        const localHash = hashApplicationLayoutContent({ layout: { ...current.item, isDefault: false }, widgets: current.widgets })
        const rows = await tx.query<LayoutRow>(
            `
            INSERT INTO ${layoutsTable} (
              scope_entity_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
              source_kind, local_content_hash, sync_state, _upl_created_by, _upl_updated_by
            )
            SELECT scope_entity_id, template_key, name, description, config, true, false, sort_order + 1, $2,
                   'application', $3, 'clean', $2, $2
            FROM ${layoutsTable}
            WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
            RETURNING *, COALESCE(_upl_version, 1)::int AS version, source_deleted_at::text
            `,
            [layoutId, userId, localHash]
        )
        const copied = rows[0]
        if (!copied) return null
        for (const widget of current.widgets) {
            await tx.query(
                `
                INSERT INTO ${widgetsTable} (layout_id, zone, widget_key, sort_order, config, is_active, _upl_created_by, _upl_updated_by)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $7)
                `,
                [copied.id, widget.zone, widget.widgetKey, widget.sortOrder, JSON.stringify(widget.config), widget.isActive, userId]
            )
        }
        return mapLayout(copied)
    })
}

export async function listApplicationLayoutWidgets(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string
): Promise<ApplicationLayoutWidget[]> {
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const rows = await executor.query<WidgetRow>(
        `${widgetSelect(widgetsTable)}
         WHERE layout_id = $1 AND _upl_deleted = false AND _app_deleted = false
         ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
        [layoutId]
    )
    return rows.map(mapWidget)
}

async function refreshLayoutLocalContentHash(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null
): Promise<void> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const current = await getApplicationLayoutDetail(executor, schemaName, layoutId)
    if (!current) return
    const localHash = hashApplicationLayoutContent({ layout: current.item, widgets: current.widgets })
    const syncState = current.item.sourceKind === 'metahub' && localHash !== current.item.sourceContentHash ? 'local_modified' : 'clean'
    await executor.query(
        `
        UPDATE ${layoutsTable}
        SET local_content_hash = $2,
            sync_state = $3,
            _upl_updated_at = NOW(),
            _upl_updated_by = $4,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
        `,
        [layoutId, localHash, syncState, userId]
    )
}

export const listApplicationLayoutWidgetObject = (): Array<{
    key: string
    allowedZones: readonly string[]
    multiInstance: boolean
}> =>
    DASHBOARD_LAYOUT_WIDGETS.map((widget) => ({ key: widget.key, allowedZones: widget.allowedZones, multiInstance: widget.multiInstance }))

export async function upsertApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    input: ApplicationLayoutWidgetMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget> {
    const data = applicationLayoutWidgetMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const definition = DASHBOARD_LAYOUT_WIDGETS.find((widget) => widget.key === data.widgetKey)
    if (!definition || !(definition.allowedZones as readonly string[]).includes(data.zone))
        throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    const config = assertApplicationLayoutWidgetConfig(data.widgetKey, data.config ?? {})
    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:layout:${layoutId}:widgets`])
        if (!definition.multiInstance) {
            const existing = await tx.query<WidgetRow>(
                `${widgetSelect(widgetsTable)}
                 WHERE layout_id = $1 AND zone = $2 AND widget_key = $3 AND _upl_deleted = false AND _app_deleted = false
                 LIMIT 1`,
                [layoutId, data.zone, data.widgetKey]
            )
            if (existing[0]) return mapWidget(existing[0])
        }
        const rows = await tx.query<WidgetRow>(
            `
            INSERT INTO ${widgetsTable} (layout_id, zone, widget_key, sort_order, config, is_active, _upl_created_by, _upl_updated_by)
            VALUES ($1, $2, $3, COALESCE($4, 1), $5::jsonb, true, $6, $6)
            RETURNING *, COALESCE(_upl_version, 1)::int AS version
            `,
            [layoutId, data.zone, data.widgetKey, data.sortOrder, JSON.stringify(config), userId]
        )
        await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        return mapWidget(rows[0])
    })
}

export async function updateApplicationLayoutWidgetConfig(
    executor: DbExecutor,
    schemaName: string,
    widgetId: string,
    input: ApplicationLayoutWidgetConfigMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    const data = applicationLayoutWidgetConfigMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:widget:${widgetId}`])
        const current = await tx.query<WidgetRow>(
            `${widgetSelect(widgetsTable)} WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1`,
            [widgetId]
        )
        if (!current[0]) return null
        const config = assertApplicationLayoutWidgetConfig(String(current[0].widget_key), data.config)
        const rows = await tx.query<WidgetRow>(
            `
            UPDATE ${widgetsTable}
            SET config = $2::jsonb, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND ($4::int IS NULL OR COALESCE(_upl_version, 1) = $4)
              AND _upl_deleted = false
              AND _app_deleted = false
            RETURNING *, COALESCE(_upl_version, 1)::int AS version
            `,
            [widgetId, JSON.stringify(config), userId, data.expectedVersion ?? null]
        )
        if (!rows[0]) return null
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return mapWidget(rows[0])
    })
}

export async function moveApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    input: ApplicationLayoutWidgetMoveMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    const data = applicationLayoutWidgetMoveMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')

    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:layout:${layoutId}:widgets`])

        const rows = await tx.query<WidgetRow>(
            `${widgetSelect(widgetsTable)}
             WHERE layout_id = $1 AND _upl_deleted = false AND _app_deleted = false
             ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
            [layoutId]
        )
        const widgets = rows.map(mapWidget)
        const moved = widgets.find((widget) => widget.id === data.widgetId)
        if (!moved) return null
        if (data.expectedVersion !== undefined && moved.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }

        const buckets = new Map<ApplicationLayoutWidget['zone'], ApplicationLayoutWidget[]>()
        for (const zone of ORDERED_LAYOUT_ZONES) buckets.set(zone, [])
        for (const widget of widgets) {
            if (widget.id === moved.id) continue
            const bucket = buckets.get(widget.zone) ?? []
            bucket.push(widget)
            buckets.set(widget.zone, bucket)
        }

        const targetBucket = buckets.get(data.targetZone) ?? []
        const targetIndex = Math.max(0, Math.min(data.targetIndex, targetBucket.length))
        targetBucket.splice(targetIndex, 0, { ...moved, zone: data.targetZone })
        buckets.set(data.targetZone, targetBucket)

        let movedResult: ApplicationLayoutWidget | null = null
        const pendingUpdates: Array<Pick<ApplicationLayoutWidget, 'id' | 'zone' | 'sortOrder'>> = []
        for (const zone of ORDERED_LAYOUT_ZONES) {
            const zoneWidgets = buckets.get(zone) ?? []
            for (const [index, widget] of zoneWidgets.entries()) {
                const nextSortOrder = index + 1
                if (widget.zone === zone && widget.sortOrder === nextSortOrder) {
                    if (widget.id === moved.id) {
                        movedResult = { ...widget, zone, sortOrder: nextSortOrder }
                    }
                    continue
                }
                pendingUpdates.push({
                    id: widget.id,
                    zone,
                    sortOrder: nextSortOrder
                })
            }
        }

        if (pendingUpdates.length > 0) {
            const updatedRows = await tx.query<WidgetRow>(
                `
                WITH updates AS (
                    SELECT *
                    FROM unnest($3::uuid[], $4::text[], $5::int[]) AS incoming(id, zone, sort_order)
                )
                UPDATE ${widgetsTable} AS w
                SET zone = updates.zone,
                    sort_order = updates.sort_order,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $2,
                    _upl_version = COALESCE(w._upl_version, 1) + 1
                FROM updates
                WHERE w.id = updates.id
                  AND w.layout_id = $1
                  AND w._upl_deleted = false
                  AND w._app_deleted = false
                RETURNING w.*, COALESCE(w._upl_version, 1)::int AS version
                `,
                [
                    layoutId,
                    userId,
                    pendingUpdates.map((update) => update.id),
                    pendingUpdates.map((update) => update.zone),
                    pendingUpdates.map((update) => update.sortOrder)
                ]
            )
            const updatedById = new Map(updatedRows.map((row) => [row.id, mapWidget(row)]))

            for (const update of pendingUpdates) {
                if (update.id !== moved.id) {
                    continue
                }
                movedResult = updatedById.get(update.id) ?? { ...moved, zone: update.zone, sortOrder: update.sortOrder }
                break
            }
        }

        await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        return movedResult ?? { ...moved, zone: data.targetZone, sortOrder: targetIndex + 1 }
    })
}

export async function toggleApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    widgetId: string,
    input: ApplicationLayoutWidgetToggleMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    const data = applicationLayoutWidgetToggleMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:widget:${widgetId}`])
        const rows = await tx.query<WidgetRow>(
            `
            UPDATE ${widgetsTable}
            SET is_active = $2, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND ($4::int IS NULL OR COALESCE(_upl_version, 1) = $4)
              AND _upl_deleted = false
              AND _app_deleted = false
            RETURNING *, COALESCE(_upl_version, 1)::int AS version
            `,
            [widgetId, data.isActive, userId, data.expectedVersion ?? null]
        )
        if (!rows[0]) return null
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return mapWidget(rows[0])
    })
}

export async function deleteApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    widgetId: string,
    userId: string | null
): Promise<boolean> {
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return executor.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schemaName}:widget:${widgetId}`])
        const rows = await tx.query<{ id: string; layout_id: string }>(
            `UPDATE ${widgetsTable} SET ${softDeleteSetClause(
                '$2'
            )}, _upl_version = COALESCE(_upl_version, 1) + 1 WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false RETURNING id, layout_id`,
            [widgetId, userId]
        )
        if (!rows[0]) return false
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return true
    })
}
