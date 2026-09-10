import { qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import { runtimeLayoutCapableFilterSql, runtimeObjectFilterSql } from '../shared/runtimeHelpers'
import { findApplicationCopySource, type ApplicationCopySourceRecord } from './applicationsStore'
import { applicationLayoutTablesExist } from './applicationLayoutsStore'

export interface EffectiveLayoutEntityRow {
    id: unknown
    kind: unknown
    codename: unknown
}

export interface EffectiveLayoutCandidateRow {
    id: unknown
    scope_entity_id: unknown
    template_key: unknown
    name: unknown
    description: unknown
    config: unknown
    is_active: unknown
    is_default: unknown
    sort_order: unknown
    source_kind: unknown
    source_layout_id: unknown
    source_snapshot_hash: unknown
    source_content_hash: unknown
    local_content_hash: unknown
    sync_state: unknown
    is_source_excluded: unknown
    source_deleted_at: unknown
    source_deleted_by: unknown
    version: unknown
}

export interface EffectiveLayoutWidgetRow {
    id: unknown
    layout_id: unknown
    zone: unknown
    widget_key: unknown
    sort_order: unknown
    config: unknown
    source_config: unknown
    source_widget_id: unknown
    source_base_widget_id: unknown
    is_customized: unknown
    is_active: unknown
    version: unknown
}

export interface EffectiveLayoutBaseWidgetRow {
    id: unknown
    layout_id: unknown
    source_widget_id: unknown
    source_base_widget_id: unknown
    template_key: unknown
    scope_entity_id: unknown
    widget_key: unknown
}

const runtimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', ${columnRef} #>> '{}', '')`

export async function findEffectiveLayoutApplication(
    executor: DbExecutor,
    applicationId: string
): Promise<ApplicationCopySourceRecord | null> {
    return findApplicationCopySource(executor, applicationId)
}

export async function findEffectiveLayoutEntity(
    executor: DbExecutor,
    schemaName: string,
    targetKind: 'page' | 'object',
    selector: { kind: 'id' | 'codename'; value: string }
): Promise<EffectiveLayoutEntityRow[]> {
    const objectsTable = qSchemaTable(schemaName, '_app_objects')
    const selectorSql = selector.kind === 'id' ? 'o.id = $2' : `${runtimeCodenameTextSql('o.codename')} = $2`
    const targetKindSql = targetKind === 'page' ? 'o.kind = $1' : `${runtimeObjectFilterSql('o.kind', 'o.config')} AND $1 = 'object'`
    return executor.query<EffectiveLayoutEntityRow>(
        `
        SELECT
            o.id,
            o.kind,
            ${runtimeCodenameTextSql('o.codename')} AS codename
        FROM ${objectsTable} o
        WHERE ${targetKindSql}
          AND o._upl_deleted = false
          AND o._app_deleted = false
          AND ${runtimeLayoutCapableFilterSql('o.config')}
          AND ${selectorSql}
        ORDER BY o.id ASC
        LIMIT 2
        `,
        [targetKind, selector.value]
    )
}

export async function effectiveLayoutTablesExist(executor: DbExecutor, schemaName: string): Promise<boolean> {
    return applicationLayoutTablesExist(executor, schemaName)
}

export async function listEffectiveLayoutCandidates(
    executor: DbExecutor,
    schemaName: string,
    entityId: string | null
): Promise<EffectiveLayoutCandidateRow[]> {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return executor.query<EffectiveLayoutCandidateRow>(
        `
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
            COALESCE(l._upl_version, 1)::int AS version
        FROM ${layoutsTable} l
        WHERE (l.scope_entity_id IS NULL OR l.scope_entity_id IS NOT DISTINCT FROM $1)
          AND l.is_active = true
          AND l._upl_deleted = false
          AND l._app_deleted = false
        ORDER BY l.scope_entity_id NULLS FIRST, l.is_default DESC, l.sort_order ASC, l._upl_created_at ASC, l.id ASC
        `,
        [entityId]
    )
}

export async function listEffectiveLayoutWidgets(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string
): Promise<EffectiveLayoutWidgetRow[]> {
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return executor.query<EffectiveLayoutWidgetRow>(
        `
        SELECT
            w.id,
            w.layout_id,
            w.zone,
            w.widget_key,
            w.sort_order,
            w.config,
            w.source_config,
            w.source_widget_id,
            w.source_base_widget_id,
            (w.source_config IS NOT NULL AND w.config IS DISTINCT FROM w.source_config) AS is_customized,
            w.is_active,
            COALESCE(w._upl_version, 1)::int AS version
        FROM ${widgetsTable} w
        WHERE w.layout_id = $1
          AND w.is_active = true
          AND w._upl_deleted = false
          AND w._app_deleted = false
        ORDER BY w.zone ASC, w.sort_order ASC, w._upl_created_at ASC, w.id ASC
        `,
        [layoutId]
    )
}

export async function findEffectiveLayoutBaseWidgets(
    executor: DbExecutor,
    schemaName: string,
    widgetIds: readonly string[]
): Promise<EffectiveLayoutBaseWidgetRow[]> {
    if (widgetIds.length === 0) return []

    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return executor.query<EffectiveLayoutBaseWidgetRow>(
        `
        SELECT
            w.id,
            w.layout_id,
            w.source_widget_id,
            w.source_base_widget_id,
            l.template_key,
            l.scope_entity_id,
            w.widget_key
        FROM ${widgetsTable} w
        INNER JOIN ${layoutsTable} l ON l.id = w.layout_id
        WHERE (w.id = ANY($1::uuid[]) OR w.source_widget_id = ANY($1::uuid[]) OR w.source_base_widget_id = ANY($1::uuid[]))
          AND w.is_active = true
          AND w._upl_deleted = false
          AND w._app_deleted = false
          AND l._upl_deleted = false
          AND l._app_deleted = false
          AND l.is_active = true
          AND l.scope_entity_id IS NULL
        ORDER BY w.id ASC
        `,
        [widgetIds]
    )
}
