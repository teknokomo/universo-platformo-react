import { qSchemaTable } from '@universo-react/database'
import {
    applicationTemplateKeySchema,
    type ApplicationLayout,
    type ApplicationLayoutConfigResetMutation,
    type ApplicationLayoutCopyMutation,
    type ApplicationLayoutCreate,
    type ApplicationLayoutScope,
    type ApplicationLayoutUpdate
} from '@universo-react/types'
import { type DbExecutor } from '@universo-react/utils'
import { activeAppRowCondition, softDeleteSetClause } from '@universo-react/utils/database'
import { hashApplicationLayoutContent } from '../utils/applicationLayoutHash'
import { runtimeObjectFilterSql } from '../shared/runtimeHelpers'
import {
    strictApplicationLayoutConfigResetMutationSchema,
    strictApplicationLayoutCopyMutationSchema,
    strictApplicationLayoutCreateSchema,
    strictApplicationLayoutUpdateSchema
} from '../validation/applicationLayoutMutationSchemas'

import {
    GLOBAL_SCOPE_ID,
    applicationLayoutMutationLockKey,
    applicationLayoutScopeLockKey,
    getApplicationLayoutDetail,
    isRecord,
    layoutSelect,
    lockApplicationLayoutMutation,
    mapLayout,
    parseLayoutConfigForStorage,
    prepareCopiedWidgetConfigs,
    resolveExistingLayoutComposition,
    runApplicationLayoutTransaction,
    type LayoutRow
} from './applicationLayoutStoreSupport'

export { getApplicationLayoutDetail } from './applicationLayoutStoreSupport'
export {
    deleteApplicationLayoutWidget,
    listApplicationLayoutWidgetObject,
    listApplicationLayoutWidgets,
    moveApplicationLayoutWidget,
    resetApplicationLayoutWidgetConfigsBatch,
    toggleApplicationLayoutWidget,
    updateApplicationLayoutWidgetConfig,
    updateApplicationLayoutWidgetConfigsBatch,
    upsertApplicationLayoutWidget
} from './applicationLayoutWidgetsStore'

interface ApplicationSchemaRow {
    schemaName: string | null
}

interface ApplicationLayoutWidgetTombstoneRow {
    id: string
    layout_id: string
    is_active: boolean
    _upl_deleted: boolean
    _app_deleted: boolean
}

const tombstoneApplicationLayoutWidgets = async (
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null,
    applicationDeleted: boolean
): Promise<void> => {
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const rows = await executor.query<ApplicationLayoutWidgetTombstoneRow>(
        `
        UPDATE ${widgetsTable}
        SET is_active = false,
            _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _app_deleted = $3,
            _app_deleted_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
            _app_deleted_by = CASE WHEN $3 THEN $2::uuid ELSE NULL::uuid END
        WHERE layout_id = $1
          AND _app_deleted = false
          AND (_upl_deleted = false OR $3 = true)
        RETURNING id, layout_id, is_active, _upl_deleted, _app_deleted
        `,
        [layoutId, userId, applicationDeleted]
    )

    for (const row of rows) {
        if (row.layout_id !== layoutId || row.is_active !== false || row._upl_deleted !== true || row._app_deleted !== applicationDeleted) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_TOMBSTONE_INVARIANT_VIOLATION')
        }
    }
}

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

    await executor.query<{ id: string }>(
        `
        UPDATE ${layoutsTable}
        SET is_default = CASE WHEN id = $2 THEN true ELSE false END,
            _upl_updated_at = NOW(),
            _upl_updated_by = $3,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE scope_entity_id IS NOT DISTINCT FROM $1
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
          AND is_default IS DISTINCT FROM (id = $2)
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
          AND COALESCE(lower(config->'capabilities'->'layoutConfig'->>'enabled') = 'true', false)
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

async function assertApplicationLayoutScope(executor: DbExecutor, schemaName: string, scopeEntityId: string): Promise<void> {
    const objectsTable = qSchemaTable(schemaName, '_app_objects')
    const rows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${objectsTable}
        WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
          AND COALESCE(lower(config->'capabilities'->'layoutConfig'->>'enabled') = 'true', false)
          AND (COALESCE(kind, '') = 'page' OR ${runtimeObjectFilterSql('kind', 'config')})
        LIMIT 1
        `,
        [scopeEntityId]
    )
    if (!rows[0]) throw new Error('APPLICATION_LAYOUT_SCOPE_INVALID')
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
        if (options.scopeEntityId === null) {
            conditions.push(`scope_entity_id IS NULL`)
        } else {
            params.push(options.scopeEntityId)
            conditions.push(`scope_entity_id = $${params.length}`)
        }
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

export async function createApplicationLayout(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutCreate,
    userId: string | null
): Promise<ApplicationLayout> {
    const data = strictApplicationLayoutCreateSchema.parse(input)
    const templateKey = applicationTemplateKeySchema.parse(data.templateKey)
    const config = parseLayoutConfigForStorage(templateKey, data.config ?? {}, { compositionMode: 'independent', baseLayoutId: null })
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const scopeId = data.scopeEntityId ?? null
    return runApplicationLayoutTransaction(executor, async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutMutationLockKey(schemaName)])
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutScopeLockKey(schemaName, scopeId)])
        if (scopeId) await assertApplicationLayoutScope(tx, schemaName, scopeId)
        const activeRows = await tx.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM ${layoutsTable} WHERE scope_entity_id IS NOT DISTINCT FROM $1 AND is_active = true AND _upl_deleted = false AND _app_deleted = false`,
            [scopeId]
        )
        const isDefault = data.isDefault ?? Number(activeRows[0]?.count ?? 0) === 0
        const isActive = isDefault ? true : data.isActive ?? true
        if (isDefault) {
            await tx.query(
                `UPDATE ${layoutsTable}
                 SET is_default = false,
                     _upl_updated_at = NOW(),
                     _upl_updated_by = $2,
                     _upl_version = COALESCE(_upl_version, 1) + 1
                 WHERE scope_entity_id IS NOT DISTINCT FROM $1
                   AND is_active = true
                   AND _upl_deleted = false
                   AND _app_deleted = false
                   AND is_default = true`,
                [scopeId, userId]
            )
        }
        const localHash = hashApplicationLayoutContent({
            layout: { ...data, templateKey, config, scopeEntityId: scopeId, isDefault, isActive },
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
                templateKey,
                JSON.stringify(data.name),
                JSON.stringify(data.description ?? null),
                JSON.stringify(config),
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
    input: ApplicationLayoutUpdate,
    userId: string | null
): Promise<ApplicationLayout | null> {
    const data = strictApplicationLayoutUpdateSchema.parse(input)
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return runApplicationLayoutTransaction(executor, async (tx) => {
        const current = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!current) return null
        const composition = resolveExistingLayoutComposition(current.item, current.widgets)
        const config = parseLayoutConfigForStorage(
            current.item.templateKey,
            data.config === undefined ? current.item.config : data.config,
            composition
        )
        if (data.expectedVersion !== undefined && current.item.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const next = {
            ...current.item,
            ...data,
            config,
            isActive: data.isDefault === true ? true : data.isActive ?? current.item.isActive
        }
        if (data.isDefault === true) {
            await tx.query(
                `UPDATE ${layoutsTable}
                 SET is_default = false,
                     _upl_updated_at = NOW(),
                     _upl_updated_by = $2,
                     _upl_version = COALESCE(_upl_version, 1) + 1
                 WHERE scope_entity_id IS NOT DISTINCT FROM $1
                   AND is_active = true
                   AND id <> $3
                   AND _upl_deleted = false
                   AND _app_deleted = false
                   AND is_default = true`,
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
            WHERE id = $1
              AND COALESCE(_upl_version, 1) = $11
              AND _upl_deleted = false
              AND _app_deleted = false
            RETURNING *, COALESCE(_upl_version, 1)::int AS version, source_deleted_at::text
            `,
            [
                layoutId,
                data.name === undefined ? null : JSON.stringify(data.name),
                data.description === undefined ? null : JSON.stringify(data.description),
                config === undefined ? null : JSON.stringify(config),
                next.isActive ?? null,
                data.isDefault ?? null,
                data.sortOrder ?? null,
                localHash,
                syncState,
                userId,
                data.expectedVersion
            ]
        )
        if (!rows[0]) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        if (current.item.isDefault && rows[0].is_default !== true) {
            await assignNextDefaultLayout(tx, schemaName, current.item.scopeEntityId, null, userId)
            return getApplicationLayoutDetail(tx, schemaName, layoutId).then((detail) => detail?.item ?? mapLayout(rows[0]))
        }
        return rows[0] ? mapLayout(rows[0]) : null
    })
}

/**
 * Reset marketing-page appearance controls to the template-owned defaults.
 *
 * This deliberately operates on the application layout row only. It does not
 * republish the metahub and it never touches workspace content rows. The
 * platform audit columns record the actor and timestamp, while the optimistic
 * version prevents a stale control-panel tab from overwriting a newer change.
 */
export async function resetApplicationLayoutConfig(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    input: ApplicationLayoutConfigResetMutation,
    userId: string | null
): Promise<ApplicationLayout | null> {
    const data = strictApplicationLayoutConfigResetMutationSchema.parse(input)
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')

    return runApplicationLayoutTransaction(executor, async (tx) => {
        const current = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!current) return null
        if (current.item.templateKey !== 'marketing-page') {
            throw new Error('APPLICATION_LAYOUT_MARKETING_RESET_NOT_SUPPORTED')
        }
        if (current.item.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }

        const config = parseLayoutConfigForStorage('marketing-page', {}, resolveExistingLayoutComposition(current.item, current.widgets))
        const localHash = hashApplicationLayoutContent({ layout: { ...current.item, config }, widgets: current.widgets })
        const syncState = current.item.sourceKind === 'metahub' && localHash !== current.item.sourceContentHash ? 'local_modified' : 'clean'
        const rows = await tx.query<LayoutRow>(
            `
            UPDATE ${layoutsTable}
            SET config = $2::jsonb,
                local_content_hash = $3,
                sync_state = $4,
                _upl_updated_at = NOW(),
                _upl_updated_by = $5,
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND COALESCE(_upl_version, 1) = $6
              AND _upl_deleted = false
              AND _app_deleted = false
            RETURNING *, COALESCE(_upl_version, 1)::int AS version, source_deleted_at::text
            `,
            [layoutId, JSON.stringify(config), localHash, syncState, userId, data.expectedVersion]
        )
        if (!rows[0]) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        return mapLayout(rows[0])
    })
}

export async function deleteApplicationLayout(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    userId: string | null,
    expectedVersion: number
): Promise<boolean> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return runApplicationLayoutTransaction(executor, async (tx) => {
        const current = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!current) return false
        if (current.item.version !== expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const activeRows = await tx.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM ${layoutsTable} WHERE scope_entity_id IS NOT DISTINCT FROM $1 AND id <> $2 AND is_active = true AND _upl_deleted = false AND _app_deleted = false`,
            [current.item.scopeEntityId, layoutId]
        )
        if (current.item.isActive && Number(activeRows[0]?.count ?? 0) === 0) throw new Error('APPLICATION_LAYOUT_LAST_ACTIVE')
        if (current.item.sourceKind === 'metahub') {
            const rows = await tx.query<{ id: string }>(
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
                WHERE id = $1
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND COALESCE(_upl_version, 1) = $3
                RETURNING id
                `,
                [layoutId, userId, expectedVersion]
            )
            if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
            await tombstoneApplicationLayoutWidgets(tx, schemaName, layoutId, userId, false)
            if (current.item.isDefault) {
                await assignNextDefaultLayout(tx, schemaName, current.item.scopeEntityId, layoutId, userId)
            }
            return true
        }
        const rows = await tx.query<{
            id: string
            is_active: boolean
            is_default: boolean
            _upl_deleted: boolean
            _app_deleted: boolean
        }>(
            `UPDATE ${layoutsTable}
              SET is_active = false,
                  is_default = false,
                  ${softDeleteSetClause('$2')},
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE id = $1
                AND _upl_deleted = false
                AND _app_deleted = false
                AND COALESCE(_upl_version, 1) = $3
              RETURNING id, is_active, is_default, _upl_deleted, _app_deleted`,
            [layoutId, userId, expectedVersion]
        )
        const deletedRow = rows[0]
        if (!deletedRow) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        if (
            deletedRow.id !== layoutId ||
            deletedRow.is_active !== false ||
            deletedRow.is_default !== false ||
            deletedRow._upl_deleted !== true ||
            deletedRow._app_deleted !== true
        ) {
            throw new Error('APPLICATION_LAYOUT_DELETE_INVARIANT_VIOLATION')
        }
        await tombstoneApplicationLayoutWidgets(tx, schemaName, layoutId, userId, true)
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
    input: ApplicationLayoutCopyMutation,
    userId: string | null
): Promise<ApplicationLayout | null> {
    const data = strictApplicationLayoutCopyMutationSchema.parse(input)
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return runApplicationLayoutTransaction(executor, async (tx) => {
        const current = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!current) return null
        if (current.item.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const copiedLayoutConfig = parseLayoutConfigForStorage(
            current.item.templateKey,
            current.item.config,
            // A copy is application-owned and deliberately severs metahub
            // lineage. It must never retain an overlay envelope that points
            // at the source layout after source widget ids are cleared.
            { compositionMode: 'independent', baseLayoutId: null }
        )
        const copiedConfigByWidgetId = prepareCopiedWidgetConfigs(current.item.templateKey, current.widgets)
        const localHash = hashApplicationLayoutContent({
            layout: { ...current.item, isDefault: false, config: copiedLayoutConfig },
            widgets: current.widgets.map((widget) => ({
                ...widget,
                config: copiedConfigByWidgetId.get(widget.id) ?? widget.config,
                sourceConfig: null,
                sourceWidgetId: null,
                sourceBaseWidgetId: null
            }))
        })
        const rows = await tx.query<LayoutRow>(
            `
            INSERT INTO ${layoutsTable} (
              scope_entity_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
              source_kind, local_content_hash, sync_state, _upl_created_by, _upl_updated_by
            )
            SELECT scope_entity_id, template_key, name, description, config, true, false, sort_order + 1, $2,
                   'application', $3, 'clean', $2, $2
            FROM ${layoutsTable}
            WHERE id = $1
              AND COALESCE(_upl_version, 1) = $4
              AND _upl_deleted = false
              AND _app_deleted = false
            RETURNING *, COALESCE(_upl_version, 1)::int AS version, source_deleted_at::text
            `,
            [layoutId, userId, localHash, data.expectedVersion]
        )
        const copied = rows[0]
        if (!copied) return null
        await tx.query(
            `UPDATE ${layoutsTable}
             SET config = $2::jsonb
             WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [copied.id, JSON.stringify(copiedLayoutConfig)]
        )
        for (const widget of current.widgets) {
            const config = copiedConfigByWidgetId.get(widget.id) ?? widget.config
            await tx.query(
                `
                INSERT INTO ${widgetsTable} (layout_id, zone, widget_key, sort_order, config, is_active, _upl_created_by, _upl_updated_by)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $7)
                `,
                [copied.id, widget.zone, widget.widgetKey, widget.sortOrder, JSON.stringify(config), widget.isActive, userId]
            )
        }
        return mapLayout({ ...copied, config: copiedLayoutConfig })
    })
}
