import { qColumn, qSchemaTable } from '@universo-react/database'
import { workspaceSettingTargetSchema } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import type { WorkspaceSettingOverrideRecord } from '../shared/workspaceSettingsContracts'

const WORKSPACE_SETTINGS_TABLE = '_app_workspace_settings'
const APPLICATION_LAYOUTS_TABLE = '_app_layouts'
const APPLICATION_WIDGETS_TABLE = '_app_widgets'

export type WorkspaceSettingLayoutRow = {
    id: string
    version: string | number
}

export type WorkspaceSettingWidgetRow = {
    id?: string
    instanceKey: string
}

type WorkspaceSettingOverrideDbRow = {
    key: string
    targetKind: 'global' | 'widget'
    targetOwnerId: string
    targetKey: string
    value: unknown
    version: string | number
}

export type WorkspaceSettingAddressInput = {
    key: string
    target: { kind: 'global' } | { kind: 'widget'; instanceKey: string }
}

export type ResolvedWorkspaceSettingAddressRow = {
    workspaceId: string
    key: string
    target: WorkspaceSettingAddressInput['target']
    targetKind: 'global' | 'widget'
    targetOwnerId: string
    targetKey: string
}

export type EffectiveWorkspaceSettingLayoutInput = {
    layout: { id: string; version: number | null }
    widgets: Array<{ id: string; instanceKey: string; isActive: boolean }>
}

export type WorkspaceSettingAddressResolutionFailure =
    | 'layout-ambiguous'
    | 'layout-changed'
    | 'layout-unavailable'
    | 'widget-missing'
    | 'widget-inactive'

/** Read the current default Application layout candidates for widget setting resolution. */
export async function findDefaultWorkspaceSettingLayouts(
    executor: DbExecutor,
    schemaName: string,
    lock: boolean
): Promise<WorkspaceSettingLayoutRow[]> {
    const rows = await executor.query<WorkspaceSettingLayoutRow>(
        `
        SELECT id, ${qColumn('_upl_version')} AS version
        FROM ${qSchemaTable(schemaName, APPLICATION_LAYOUTS_TABLE)}
        WHERE scope_entity_id IS NULL
          AND is_active = true
          AND is_default = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY id ASC
        LIMIT 2
        ${lock ? 'FOR SHARE' : ''}
        `,
        []
    )
    return rows
}

/** Read and optionally lock an effective layout before validating its widget targets. */
export async function findActiveWorkspaceSettingLayout(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    lock: boolean
): Promise<WorkspaceSettingLayoutRow | null> {
    const rows = await executor.query<WorkspaceSettingLayoutRow>(
        `
        SELECT id, ${qColumn('_upl_version')} AS version
        FROM ${qSchemaTable(schemaName, APPLICATION_LAYOUTS_TABLE)}
        WHERE id = $1
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        LIMIT 1
        ${lock ? 'FOR SHARE' : ''}
        `,
        [layoutId]
    )
    return rows[0] ?? null
}

/** Confirm that the effective layout's widget rows are still active and attached. */
export async function findActiveWorkspaceSettingWidgetsById(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    widgetIds: readonly string[],
    lock: boolean
): Promise<WorkspaceSettingWidgetRow[]> {
    return executor.query<WorkspaceSettingWidgetRow>(
        `
        SELECT id, instance_key AS "instanceKey"
        FROM ${qSchemaTable(schemaName, APPLICATION_WIDGETS_TABLE)}
        WHERE id = ANY($1::uuid[])
          AND layout_id = $2
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY instance_key ASC
        ${lock ? 'FOR SHARE' : ''}
        `,
        [widgetIds, layoutId]
    )
}

/** Resolve active widget instance keys against the selected layout. */
export async function findActiveWorkspaceSettingWidgetsByInstanceKey(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    instanceKeys: readonly string[],
    lock: boolean
): Promise<WorkspaceSettingWidgetRow[]> {
    return executor.query<WorkspaceSettingWidgetRow>(
        `
        SELECT instance_key AS "instanceKey"
        FROM ${qSchemaTable(schemaName, APPLICATION_WIDGETS_TABLE)}
        WHERE layout_id = $1
          AND instance_key = ANY($2::text[])
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY instance_key ASC
        ${lock ? 'FOR SHARE' : ''}
        `,
        [layoutId, instanceKeys]
    )
}

/** List active workspace overrides whose targets still belong to the selected layout. */
export async function listWorkspaceSettingOverrideRows(
    executor: DbExecutor,
    input: { schemaName: string; workspaceId: string; layoutId?: string | null }
): Promise<WorkspaceSettingOverrideRecord[]> {
    const workspaceSettingsTable = qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)
    const layoutsTable = qSchemaTable(input.schemaName, APPLICATION_LAYOUTS_TABLE)
    const widgetsTable = qSchemaTable(input.schemaName, APPLICATION_WIDGETS_TABLE)
    const rows = await executor.query<WorkspaceSettingOverrideDbRow>(
        `
        SELECT
            setting_row.key,
            setting_row.target_kind AS "targetKind",
            setting_row.target_owner_id AS "targetOwnerId",
            setting_row.target_key AS "targetKey",
            setting_row.value,
            setting_row.${qColumn('_upl_version')} AS version
        FROM ${workspaceSettingsTable} setting_row
        WHERE setting_row.workspace_id = $1
          AND setting_row.${qColumn('_upl_deleted')} = false
          AND setting_row.${qColumn('_app_deleted')} = false
          AND (
                (setting_row.target_kind = 'global'
                    AND setting_row.target_owner_id = $1
                    AND setting_row.target_key = '')
                OR
                (setting_row.target_kind = 'widget' AND EXISTS (
                    SELECT 1
                    FROM ${layoutsTable} layout_row
                    INNER JOIN ${widgetsTable} widget_row
                        ON widget_row.layout_id = layout_row.id
                       AND widget_row.instance_key = setting_row.target_key
                       AND widget_row.is_active = true
                       AND widget_row.${qColumn('_upl_deleted')} = false
                       AND widget_row.${qColumn('_app_deleted')} = false
                    WHERE layout_row.id = setting_row.target_owner_id
                      AND (
                            ($2::uuid IS NULL AND layout_row.scope_entity_id IS NULL AND layout_row.is_default = true)
                            OR ($2::uuid IS NOT NULL AND layout_row.id = $2)
                      )
                      AND layout_row.is_active = true
                      AND layout_row.${qColumn('_upl_deleted')} = false
                      AND layout_row.${qColumn('_app_deleted')} = false
                ))
          )
        ORDER BY setting_row.target_kind ASC, setting_row.target_owner_id ASC, setting_row.target_key ASC, setting_row.key ASC
        `,
        [input.workspaceId, input.layoutId ?? null]
    )
    const result: WorkspaceSettingOverrideRecord[] = []
    for (const row of rows) {
        const targetResult =
            row.targetKind === 'global'
                ? workspaceSettingTargetSchema.safeParse({ kind: 'global' })
                : row.targetKind === 'widget'
                ? workspaceSettingTargetSchema.safeParse({ kind: 'widget', instanceKey: row.targetKey })
                : null
        if (!targetResult?.success) continue
        const numericVersion = Number(row.version ?? 0)
        const version = Number.isFinite(numericVersion) && numericVersion > 0 ? numericVersion : 1
        result.push({ key: row.key, target: targetResult.data, value: row.value, version })
    }
    return result
}

/** Resolve parsed setting addresses to persisted owner identities using active layout rows. */
export async function resolveWorkspaceSettingAddressRows(
    executor: DbExecutor,
    input: { schemaName: string; workspaceId: string },
    addresses: readonly WorkspaceSettingAddressInput[],
    lockLayout: boolean,
    effectiveLayout?: EffectiveWorkspaceSettingLayoutInput | null
): Promise<
    { ok: true; addresses: ResolvedWorkspaceSettingAddressRow[] } | { ok: false; reason: WorkspaceSettingAddressResolutionFailure }
> {
    const instanceKeys = Array.from(
        new Set(addresses.flatMap((address) => (address.target.kind === 'widget' ? [address.target.instanceKey] : [])))
    ).sort()

    let currentLayout: WorkspaceSettingLayoutRow | null = null
    if (instanceKeys.length > 0) {
        if (effectiveLayout) {
            const resolvedWidgets = instanceKeys.map((instanceKey) => {
                const matches = effectiveLayout.widgets.filter((widget) => widget.isActive && widget.instanceKey === instanceKey)
                return matches.length === 1 ? matches[0] : null
            })
            if (resolvedWidgets.some((widget) => widget === null)) return { ok: false, reason: 'widget-missing' }

            currentLayout = await findActiveWorkspaceSettingLayout(executor, input.schemaName, effectiveLayout.layout.id, lockLayout)
            if (
                !currentLayout ||
                (effectiveLayout.layout.version !== null && Number(currentLayout.version) !== effectiveLayout.layout.version)
            ) {
                return { ok: false, reason: 'layout-changed' }
            }

            const activeWidgets = await findActiveWorkspaceSettingWidgetsById(
                executor,
                input.schemaName,
                currentLayout.id,
                resolvedWidgets.map((widget) => (widget as { id: string }).id),
                lockLayout
            )
            const activeWidgetInstanceKeysById = new Map(activeWidgets.map((widget) => [widget.id, widget.instanceKey]))
            if (
                activeWidgets.length !== resolvedWidgets.length ||
                resolvedWidgets.some((widget) => !widget || activeWidgetInstanceKeysById.get(widget.id) !== widget.instanceKey)
            ) {
                return { ok: false, reason: 'widget-inactive' }
            }
        } else {
            const layouts = await findDefaultWorkspaceSettingLayouts(executor, input.schemaName, lockLayout)
            if (layouts.length > 1) return { ok: false, reason: 'layout-ambiguous' }
            currentLayout = layouts[0] ?? null
        }

        if (!currentLayout) return { ok: false, reason: 'layout-unavailable' }
        if (!effectiveLayout) {
            const activeWidgets = await findActiveWorkspaceSettingWidgetsByInstanceKey(
                executor,
                input.schemaName,
                currentLayout.id,
                instanceKeys,
                lockLayout
            )
            const resolvedKeys = new Set(activeWidgets.map((widget) => widget.instanceKey))
            if (activeWidgets.length !== instanceKeys.length || instanceKeys.some((instanceKey) => !resolvedKeys.has(instanceKey))) {
                return { ok: false, reason: 'widget-missing' }
            }
        }
    }

    return {
        ok: true,
        addresses: addresses.map((address) => ({
            workspaceId: input.workspaceId,
            key: address.key,
            target: address.target,
            targetKind: address.target.kind,
            targetOwnerId: address.target.kind === 'global' ? input.workspaceId : (currentLayout as WorkspaceSettingLayoutRow).id,
            targetKey: address.target.kind === 'global' ? '' : address.target.instanceKey
        }))
    }
}
