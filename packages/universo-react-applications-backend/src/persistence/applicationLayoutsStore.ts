import { qSchemaTable } from '@universo-react/database'
import {
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_LAYOUT_ZONES,
    MARKETING_WIDGET_REGISTRY,
    applicationTemplateKeySchema,
    applicationLayoutCopyMutationSchema,
    applicationLayoutConfigResetMutationSchema,
    applicationLayoutCreateSchema,
    applicationLayoutUpdateSchema,
    parseApplicationLayoutConfig,
    applicationLayoutWidgetConfigBatchMutationSchema,
    applicationLayoutWidgetConfigMutationSchema,
    applicationLayoutWidgetMoveMutationSchema,
    applicationLayoutWidgetMutationSchema,
    applicationLayoutWidgetResetBatchMutationSchema,
    applicationLayoutWidgetToggleMutationSchema,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayout,
    type ApplicationLayoutCopyMutation,
    type ApplicationLayoutConfigResetMutation,
    type ApplicationLayoutCreate,
    type ApplicationLayoutDetailResponse,
    type ApplicationLayoutScope,
    type ApplicationLayoutUpdate,
    type ApplicationLayoutWidget,
    type ApplicationLayoutWidgetConfigBatchMutation,
    type ApplicationLayoutWidgetConfigMutation,
    type ApplicationLayoutWidgetMoveMutation,
    type ApplicationLayoutWidgetMutation,
    type ApplicationLayoutWidgetResetBatchMutation,
    type ApplicationLayoutWidgetToggleMutation,
    type LayoutWidgetDefinition
} from '@universo-react/types'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import { activeAppRowCondition, softDeleteSetClause } from '@universo-react/utils/database'
import { hashApplicationLayoutContent } from '../utils/applicationLayoutHash'
import {
    assertInterpretationNetworkSingleSystemTransitionAllowed,
    lockInterpretationNetworkStructureMode
} from '../shared/interpretationNetworkStructureModeGuard'

const GLOBAL_SCOPE_ID = 'global'
const ORDERED_LAYOUT_ZONES: Array<ApplicationLayoutWidget['zone']> = ['left', 'top', 'right', 'bottom', 'center', ...MARKETING_LAYOUT_ZONES]

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
    source_config: Record<string, unknown> | null
    source_widget_id?: string | null
    source_base_widget_id?: string | null
    is_customized: boolean
    is_active: boolean
    version: number
}

interface ApplicationSchemaRow {
    schemaName: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const parseLayoutConfigForRead = (templateKey: ApplicationLayout['templateKey'], value: unknown): ApplicationLayout['config'] => {
    const rawConfig = isRecord(value) ? value : {}
    try {
        return parseApplicationLayoutConfig(templateKey, rawConfig)
    } catch {
        // Keep a malformed persisted config inspectable by the admin UI. The
        // appearance panel can then show its localized invalid-config state;
        // mutation and runtime paths still validate strictly and fail closed.
        return rawConfig as ApplicationLayout['config']
    }
}

function assertApplicationLayoutWidgetConfig(
    widgetKey: string,
    config: unknown,
    options: { generateInstanceKey?: boolean } = {}
): Record<string, unknown> {
    try {
        const candidate =
            options.generateInstanceKey &&
            Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, widgetKey) &&
            isRecord(config) &&
            config.instanceKey === undefined
                ? { ...config, instanceKey: generateUuidV7() }
                : config
        return parseApplicationLayoutWidgetConfig(widgetKey, candidate)
    } catch {
        throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    }
}

const mapLayout = (row: LayoutRow): ApplicationLayout => {
    const templateKey = applicationTemplateKeySchema.parse(row.template_key)
    return {
        id: row.id,
        scopeId: row.scope_entity_id ?? GLOBAL_SCOPE_ID,
        scopeKind: row.scope_entity_id ? 'entity' : 'global',
        scopeEntityId: row.scope_entity_id,
        templateKey,
        name: isRecord(row.name) ? row.name : {},
        description: isRecord(row.description) ? row.description : null,
        config: parseLayoutConfigForRead(templateKey, row.config),
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
    }
}

const mapWidget = (row: WidgetRow): ApplicationLayoutWidget => ({
    id: row.id,
    layoutId: row.layout_id,
    zone: row.zone as ApplicationLayoutWidget['zone'],
    widgetKey: row.widget_key as ApplicationLayoutWidget['widgetKey'],
    instanceKey: isRecord(row.config) && typeof row.config.instanceKey === 'string' ? row.config.instanceKey : undefined,
    sortOrder: row.sort_order,
    config: isRecord(row.config) ? row.config : {},
    sourceConfig: isRecord(row.source_config) ? row.source_config : null,
    sourceWidgetId: row.source_widget_id ?? null,
    sourceBaseWidgetId: row.source_base_widget_id ?? null,
    isCustomized: row.is_customized === true,
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
      source_config,
      source_widget_id,
      source_base_widget_id,
      (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
      is_active,
      COALESCE(_upl_version, 1)::int AS version
    FROM ${widgetsTable}
`

/**
 * Layout widgets are valid only on active application layouts. The selected
 * template adapter performs the key/zone compatibility check before writes;
 * keeping this predicate broad lets both dashboard and marketing adapters use
 * the same SQL-first mutation paths.
 */
type DashboardLayoutIdExpression = 'layout_id' | 'w.layout_id' | '$1'

const applicationLayoutWidgetPredicate = (layoutsTable: string, layoutIdExpression: DashboardLayoutIdExpression): string =>
    `EXISTS (
        SELECT 1
        FROM ${layoutsTable} AS layout_guard
        WHERE layout_guard.id = ${layoutIdExpression}
          AND layout_guard.template_key IN ('dashboard', 'marketing-page')
          AND layout_guard.is_active = true
          AND layout_guard._upl_deleted = false
          AND layout_guard._app_deleted = false
    )`

const getApplicationWidgetDefinition = (widgetKey: string): LayoutWidgetDefinition | undefined =>
    LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === widgetKey)

const isMarketingWidgetKey = (widgetKey: string): boolean => Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, widgetKey)

const assertWidgetPlacementForTemplate = (
    templateKey: ApplicationLayout['templateKey'],
    widgetKey: string,
    zone: string
): LayoutWidgetDefinition => {
    const definition = getApplicationWidgetDefinition(widgetKey)
    if (
        !definition ||
        definition.templateKey !== templateKey ||
        !definition.allowedZones.includes(zone as ApplicationLayoutWidget['zone'])
    ) {
        throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    }
    return definition
}

const prepareCopiedWidgetConfigs = (
    templateKey: ApplicationLayout['templateKey'],
    widgets: ApplicationLayoutWidget[]
): Map<string, Record<string, unknown>> => {
    const instanceKeys = new Set<string>()
    const copiedConfigs = new Map<string, Record<string, unknown>>()

    for (const widget of widgets) {
        assertWidgetPlacementForTemplate(templateKey, widget.widgetKey, widget.zone)

        const sourceConfig = isMarketingWidgetKey(widget.widgetKey) ? { ...widget.config, instanceKey: generateUuidV7() } : widget.config
        const config = assertApplicationLayoutWidgetConfig(widget.widgetKey, sourceConfig)
        if (isMarketingWidgetKey(widget.widgetKey)) {
            const instanceKey = String(config.instanceKey)
            if (instanceKeys.has(instanceKey)) throw new Error('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
            instanceKeys.add(instanceKey)
        }
        copiedConfigs.set(widget.id, config)
    }

    return copiedConfigs
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

async function assertApplicationLayoutScope(executor: DbExecutor, schemaName: string, scopeEntityId: string): Promise<void> {
    const objectsTable = qSchemaTable(schemaName, '_app_objects')
    const rows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${objectsTable}
        WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
          AND (
            config->'capabilities'->'layoutConfig'->>'enabled' = 'true'
            OR config->'layoutConfig'->>'enabled' = 'true'
          )
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

export async function getApplicationLayoutDetail(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    options: { forUpdate?: boolean } = {}
): Promise<ApplicationLayoutDetailResponse | null> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const rowLock = options.forUpdate === true ? ' FOR UPDATE' : ''
    const rows = await executor.query<LayoutRow>(
        `${layoutSelect(layoutsTable)} WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1${rowLock}`,
        [layoutId]
    )
    if (!rows[0]) return null
    const widgets = await executor.query<WidgetRow>(
        `${widgetSelect(widgetsTable)}
         WHERE layout_id = $1 AND _upl_deleted = false AND _app_deleted = false
         ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC${rowLock}`,
        [layoutId]
    )
    return { item: mapLayout(rows[0]), widgets: widgets.map(mapWidget) }
}

const applicationLayoutScopeLockKey = (schemaName: string, scopeEntityId: string | null): string =>
    `${schemaName}:layout-scope:${scopeEntityId ?? GLOBAL_SCOPE_ID}`

const applicationLayoutLockKey = (schemaName: string, layoutId: string): string => `${schemaName}:layout:${layoutId}`

const applicationLayoutWidgetsLockKey = (schemaName: string, layoutId: string): string => `${schemaName}:layout:${layoutId}:widgets`

const applicationLayoutMutationError = (constraint: unknown): string | null => {
    if (typeof constraint !== 'string') return null
    if (constraint === 'idx_app_layouts_default_active') return 'APPLICATION_LAYOUT_DEFAULT_CONFLICT'
    if (constraint === 'idx_app_widgets_layout_source_base_active') return 'APPLICATION_LAYOUT_WIDGET_SOURCE_CONFLICT'
    return null
}

const normalizeApplicationLayoutMutationError = (error: unknown): unknown => {
    if (!isRecord(error) || error.code !== '23505') return error
    const code = applicationLayoutMutationError(error.constraint)
    return code ? new Error(code) : error
}

const runApplicationLayoutTransaction = async <T>(executor: DbExecutor, callback: (transaction: DbExecutor) => Promise<T>): Promise<T> => {
    try {
        return await executor.transaction(callback)
    } catch (error) {
        throw normalizeApplicationLayoutMutationError(error)
    }
}

/**
 * Locks an application layout mutation in the single scope -> layout -> widgets order.
 * The first scope lookup is deliberately not trusted as the mutation snapshot: the
 * layout row is read again with FOR UPDATE after the advisory locks are acquired.
 */
const lockApplicationLayoutMutation = async (
    executor: DbExecutor,
    schemaName: string,
    layoutId: string
): Promise<ApplicationLayoutDetailResponse | null> => {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const scopeRows = await executor.query<{ scope_entity_id: string | null }>(
        `
        SELECT scope_entity_id
        FROM ${layoutsTable}
        WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
        LIMIT 1
        `,
        [layoutId]
    )
    if (!scopeRows[0]) return null

    const initialScopeEntityId = scopeRows[0].scope_entity_id ?? null
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutScopeLockKey(schemaName, initialScopeEntityId)])
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutLockKey(schemaName, layoutId)])

    const layoutRows = await executor.query<LayoutRow>(
        `${layoutSelect(layoutsTable)} WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1 FOR UPDATE`,
        [layoutId]
    )
    if (!layoutRows[0]) return null

    const lockedScopeEntityId = layoutRows[0].scope_entity_id ?? null
    if (lockedScopeEntityId !== initialScopeEntityId) {
        throw new Error('APPLICATION_LAYOUT_SCOPE_CONFLICT')
    }

    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutWidgetsLockKey(schemaName, layoutId)])
    const widgets = await executor.query<WidgetRow>(
        `${widgetSelect(widgetsTable)}
         WHERE layout_id = $1 AND _upl_deleted = false AND _app_deleted = false
         ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC FOR UPDATE`,
        [layoutId]
    )
    return { item: mapLayout(layoutRows[0]), widgets: widgets.map(mapWidget) }
}

export async function createApplicationLayout(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutCreate,
    userId: string | null
): Promise<ApplicationLayout> {
    const data = applicationLayoutCreateSchema.parse(input)
    const templateKey = applicationTemplateKeySchema.parse(data.templateKey)
    const config = parseApplicationLayoutConfig(templateKey, data.config ?? {})
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const scopeId = data.scopeEntityId ?? null
    return runApplicationLayoutTransaction(executor, async (tx) => {
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
    const data = applicationLayoutUpdateSchema.parse(input)
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return runApplicationLayoutTransaction(executor, async (tx) => {
        const current = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!current) return null
        const config = data.config === undefined ? undefined : parseApplicationLayoutConfig(current.item.templateKey, data.config)
        if (data.expectedVersion !== undefined && current.item.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const next = {
            ...current.item,
            ...data,
            ...(config === undefined ? {} : { config }),
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
    const data = applicationLayoutConfigResetMutationSchema.parse(input)
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

        const config = parseApplicationLayoutConfig('marketing-page', {})
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
            if (current.item.isDefault) {
                await assignNextDefaultLayout(tx, schemaName, current.item.scopeEntityId, layoutId, userId)
            }
            return true
        }
        const rows = await tx.query<{ id: string }>(
            `UPDATE ${layoutsTable} SET ${softDeleteSetClause('$2')}, _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE id = $1
                AND _upl_deleted = false
                AND _app_deleted = false
                AND COALESCE(_upl_version, 1) = $3
              RETURNING id`,
            [layoutId, userId, expectedVersion]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
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
    const data = applicationLayoutCopyMutationSchema.parse(input)
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return runApplicationLayoutTransaction(executor, async (tx) => {
        const current = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!current) return null
        if (current.item.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const copiedConfigByWidgetId = prepareCopiedWidgetConfigs(current.item.templateKey, current.widgets)
        const localHash = hashApplicationLayoutContent({
            layout: { ...current.item, isDefault: false },
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
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${layoutsTable}
        SET local_content_hash = $2,
            sync_state = $3,
            _upl_updated_at = NOW(),
            _upl_updated_by = $4,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
          AND COALESCE(_upl_version, 1) = $5
        RETURNING id
        `,
        [layoutId, localHash, syncState, userId, current.item.version]
    )
    if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
}

export const listApplicationLayoutWidgetObject = (): LayoutWidgetDefinition[] =>
    LAYOUT_WIDGET_DEFINITIONS.map((widget) => ({
        key: widget.key,
        allowedZones: widget.allowedZones,
        multiInstance: widget.multiInstance,
        templateKey: widget.templateKey,
        labelKey: widget.labelKey,
        defaultLabel: widget.defaultLabel
    }))

export async function upsertApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    input: ApplicationLayoutWidgetMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget> {
    const data = applicationLayoutWidgetMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const config = assertApplicationLayoutWidgetConfig(data.widgetKey, data.config ?? {}, { generateInstanceKey: true })
    return runApplicationLayoutTransaction(executor, async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const current = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!current || !current.item.isActive) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        const templateKey = applicationTemplateKeySchema.safeParse(current.item.templateKey)
        if (!templateKey.success) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        if (current.item.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        assertWidgetPlacementForTemplate(templateKey.data, data.widgetKey, data.zone)
        if (isMarketingWidgetKey(data.widgetKey)) {
            const duplicate = current.widgets.find((widget) => String(widget.instanceKey) === String(config.instanceKey))
            if (duplicate) throw new Error('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
        }
        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            [
                {
                    current: null,
                    next: { widgetKey: data.widgetKey, config, isActive: true }
                }
            ],
            { lockAlreadyHeld: true }
        )
        const rows = await tx.query<WidgetRow>(
            `
            INSERT INTO ${widgetsTable} (layout_id, zone, widget_key, sort_order, config, is_active, _upl_created_by, _upl_updated_by)
            SELECT $1, $2, $3, COALESCE($4, 1), $5::jsonb, true, $6, $6
            WHERE ${applicationLayoutWidgetPredicate(layoutsTable, '$1')}
            RETURNING *, COALESCE(_upl_version, 1)::int AS version
            `,
            [layoutId, data.zone, data.widgetKey, data.sortOrder ?? null, JSON.stringify(config), userId]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        return mapWidget(rows[0])
    })
}

export async function updateApplicationLayoutWidgetConfig(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    widgetId: string,
    input: ApplicationLayoutWidgetConfigMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    const data = applicationLayoutWidgetConfigMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        const current = currentLayout?.widgets.find((widget) => widget.id === widgetId)
        if (!currentLayout || !currentLayout.item.isActive || !current) return null
        const config = assertApplicationLayoutWidgetConfig(current.widgetKey, data.config)
        if (isMarketingWidgetKey(current.widgetKey)) {
            const currentInstanceKey = current.instanceKey
            if (String(config.instanceKey) !== String(currentInstanceKey)) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_INSTANCE_IMMUTABLE')
            }
        }
        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            [
                {
                    current: {
                        widgetKey: current.widgetKey,
                        config: current.config,
                        isActive: current.isActive
                    },
                    next: { widgetKey: current.widgetKey, config, isActive: current.isActive }
                }
            ],
            { lockAlreadyHeld: true }
        )
        const rows = await tx.query<WidgetRow>(
            `
            UPDATE ${widgetsTable}
            SET config = $2::jsonb, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND layout_id = $4
              AND COALESCE(_upl_version, 1) = $5
              AND _upl_deleted = false
              AND _app_deleted = false
              AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
            RETURNING *, COALESCE(_upl_version, 1)::int AS version
            `,
            [widgetId, JSON.stringify(config), userId, layoutId, data.expectedVersion]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return mapWidget(rows[0])
    })
}

export async function updateApplicationLayoutWidgetConfigsBatch(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutWidgetConfigBatchMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget[]> {
    const data = applicationLayoutWidgetConfigBatchMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const updates = [...data.updates].sort((left, right) => left.widgetId.localeCompare(right.widgetId))

    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const layoutIds = [...new Set(updates.map((update) => update.layoutId))].sort((left, right) => left.localeCompare(right))
        for (const layoutId of layoutIds) {
            const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
            if (!currentLayout || !currentLayout.item.isActive) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
        }

        const currentRows = await tx.query<WidgetRow>(
            `${widgetSelect(widgetsTable)}
             WHERE (layout_id, id) IN (
                   SELECT requested.layout_id, requested.widget_id
                   FROM UNNEST($1::uuid[], $2::uuid[]) AS requested(layout_id, widget_id)
             )
               AND _upl_deleted = false
               AND _app_deleted = false
               AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
             ORDER BY id
             FOR UPDATE`,
            [updates.map((update) => update.layoutId), updates.map((update) => update.widgetId)]
        )
        const currentByScopedId = new Map(currentRows.map((row) => [`${row.layout_id}:${row.id}`, row]))
        const validatedConfigs = new Map<string, Record<string, unknown>>()

        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)
            if (!current || current.version !== update.expectedVersion) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            const validatedConfig = assertApplicationLayoutWidgetConfig(current.widget_key, update.config)
            if (isMarketingWidgetKey(current.widget_key)) {
                const currentInstanceKey = isRecord(current.config) ? current.config.instanceKey : undefined
                if (String(validatedConfig.instanceKey) !== String(currentInstanceKey)) {
                    throw new Error('APPLICATION_LAYOUT_WIDGET_INSTANCE_IMMUTABLE')
                }
            }
            validatedConfigs.set(update.widgetId, validatedConfig)
        }

        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            updates.map((update) => ({
                current: {
                    widgetKey: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.widget_key,
                    config: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.config,
                    isActive: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.is_active
                },
                next: {
                    widgetKey: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.widget_key,
                    config: validatedConfigs.get(update.widgetId)!,
                    isActive: currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!.is_active
                }
            })),
            { lockAlreadyHeld: true }
        )

        const saved: ApplicationLayoutWidget[] = []
        const touchedLayoutIds = new Set<string>()
        for (const update of updates) {
            const rows = await tx.query<WidgetRow>(
                `
                UPDATE ${widgetsTable}
                SET config = $2::jsonb, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1
                  AND layout_id = $4
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND COALESCE(_upl_version, 1) = $5
                  AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
                RETURNING *, COALESCE(_upl_version, 1)::int AS version
                `,
                [update.widgetId, JSON.stringify(validatedConfigs.get(update.widgetId)), userId, update.layoutId, update.expectedVersion]
            )
            if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            saved.push(mapWidget(rows[0]))
            touchedLayoutIds.add(String(rows[0].layout_id))
        }

        for (const layoutId of touchedLayoutIds) {
            await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        }
        return saved
    })
}

export async function resetApplicationLayoutWidgetConfigsBatch(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutWidgetResetBatchMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget[]> {
    const data = applicationLayoutWidgetResetBatchMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const updates = [...data.updates].sort((left, right) => left.widgetId.localeCompare(right.widgetId))

    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const layoutIds = [...new Set(updates.map((update) => update.layoutId))].sort((left, right) => left.localeCompare(right))
        for (const layoutId of layoutIds) {
            const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
            if (!currentLayout || !currentLayout.item.isActive) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
        }

        const currentRows = await tx.query<WidgetRow>(
            `${widgetSelect(widgetsTable)}
             WHERE (layout_id, id) IN (
                   SELECT requested.layout_id, requested.widget_id
                   FROM UNNEST($1::uuid[], $2::uuid[]) AS requested(layout_id, widget_id)
             )
               AND source_config IS NOT NULL
               AND _upl_deleted = false
               AND _app_deleted = false
               AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
             ORDER BY id
             FOR UPDATE`,
            [updates.map((update) => update.layoutId), updates.map((update) => update.widgetId)]
        )
        const currentByScopedId = new Map(currentRows.map((row) => [`${row.layout_id}:${row.id}`, row]))

        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)
            if (!current || current.version !== update.expectedVersion) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            assertApplicationLayoutWidgetConfig(current.widget_key, current.source_config)
        }

        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            updates.map((update) => {
                const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!
                return {
                    current: { widgetKey: current.widget_key, config: current.config, isActive: current.is_active },
                    next: { widgetKey: current.widget_key, config: current.source_config ?? {}, isActive: current.is_active }
                }
            }),
            { lockAlreadyHeld: true }
        )

        const saved: ApplicationLayoutWidget[] = []
        const touchedLayoutIds = new Set<string>()
        for (const update of updates) {
            const rows = await tx.query<WidgetRow>(
                `
                UPDATE ${widgetsTable}
                SET config = source_config,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $3,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1
                  AND layout_id = $2
                  AND source_config IS NOT NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND COALESCE(_upl_version, 1) = $4
                  AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
                RETURNING *,
                          false AS is_customized,
                          COALESCE(_upl_version, 1)::int AS version
                `,
                [update.widgetId, update.layoutId, userId, update.expectedVersion]
            )
            if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            saved.push(mapWidget(rows[0]))
            touchedLayoutIds.add(update.layoutId)
        }

        for (const layoutId of touchedLayoutIds) {
            await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        }
        return saved
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
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')

    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!currentLayout || !currentLayout.item.isActive) return null
        const templateKey = applicationTemplateKeySchema.safeParse(currentLayout.item.templateKey)
        if (!templateKey.success) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')

        const widgets = currentLayout.widgets
        const moved = widgets.find((widget) => widget.id === data.widgetId)
        if (!moved) return null
        if (moved.version !== data.expectedVersion) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        assertWidgetPlacementForTemplate(templateKey.data, moved.widgetKey, data.targetZone)

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
                  AND ${applicationLayoutWidgetPredicate(layoutsTable, 'w.layout_id')}
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

            if (updatedRows.length !== pendingUpdates.length) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }

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
    layoutId: string,
    widgetId: string,
    input: ApplicationLayoutWidgetToggleMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    const data = applicationLayoutWidgetToggleMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        const current = currentLayout?.widgets.find((widget) => widget.id === widgetId)
        if (!currentLayout || !currentLayout.item.isActive || !current) return null
        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            [
                {
                    current: {
                        widgetKey: current.widgetKey,
                        config: current.config,
                        isActive: current.isActive
                    },
                    next: { widgetKey: current.widgetKey, config: current.config, isActive: data.isActive }
                }
            ],
            { lockAlreadyHeld: true }
        )
        const rows = await tx.query<WidgetRow>(
            `
            UPDATE ${widgetsTable}
            SET is_active = $2, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND layout_id = $4
              AND COALESCE(_upl_version, 1) = $5
              AND _upl_deleted = false
              AND _app_deleted = false
              AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
            RETURNING *, COALESCE(_upl_version, 1)::int AS version
            `,
            [widgetId, data.isActive, userId, layoutId, data.expectedVersion]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return mapWidget(rows[0])
    })
}

export async function deleteApplicationLayoutWidget(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    widgetId: string,
    userId: string | null,
    expectedVersion: number
): Promise<boolean> {
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        if (!currentLayout || !currentLayout.item.isActive || !currentLayout.widgets.some((widget) => widget.id === widgetId)) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        const rows = await tx.query<{ id: string; layout_id: string }>(
            `UPDATE ${widgetsTable} SET ${softDeleteSetClause(
                '$2'
            )}, _upl_version = COALESCE(_upl_version, 1) + 1 WHERE id = $1 AND layout_id = $3
              AND _upl_deleted = false AND _app_deleted = false
              AND COALESCE(_upl_version, 1) = $4
              AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')} RETURNING id, layout_id`,
            [widgetId, userId, layoutId, expectedVersion]
        )
        if (!rows[0]) {
            throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return true
    })
}
