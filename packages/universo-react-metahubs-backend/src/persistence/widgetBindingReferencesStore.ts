import { qColumn, qSchemaTable } from '@universo-react/database'
import type { SqlQueryable } from '@universo-react/utils/database'
import { queryMany } from '@universo-react/utils/database'

export interface PersistedWidgetBindingReference {
    widget_id: string
    widget_key: string
    config: unknown
    slot_key: string
    entity_kind: string | null
    entity_codename: string | null
    selector_kind: string | null
    selector_value: string | null
}

export interface PersistedWidgetBindingReferenceFilter {
    entityKind?: string
    entityCodename?: string
    semanticKey?: string
    excludeWidgetId?: string
    limit: number
}

const column = (alias: string, name: string): string => `${alias}.${qColumn(name)}`
const active = (alias: string): string => `${column(alias, '_upl_deleted')} = false AND ${column(alias, '_mhb_deleted')} = false`

/** Read direct bindings from every live placement plus inherited base bindings used by live overlays. */
export const listPersistedWidgetBindingReferences = async (
    db: SqlQueryable,
    schemaName: string,
    filter: PersistedWidgetBindingReferenceFilter
): Promise<PersistedWidgetBindingReference[]> => {
    const widgetsTable = qSchemaTable(schemaName, '_mhb_widgets')
    const overridesTable = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
    const layoutsTable = qSchemaTable(schemaName, '_mhb_layouts')
    const parameters: unknown[] = []
    const bind = (value: unknown): string => {
        parameters.push(value)
        return `$${parameters.length}`
    }

    const predicates: string[] = []
    if (filter.entityKind !== undefined) predicates.push(`${column('reference', 'target')} ->> 'entityKind' = ${bind(filter.entityKind)}`)
    if (filter.entityCodename !== undefined)
        predicates.push(`${column('reference', 'target')} ->> 'entityCodename' = ${bind(filter.entityCodename)}`)
    if (filter.semanticKey !== undefined) {
        predicates.push(`${column('reference', 'target')} -> 'selector' ->> 'kind' = 'semantic-key'`)
        predicates.push(`${column('reference', 'target')} -> 'selector' ->> 'value' = ${bind(filter.semanticKey)}`)
    }
    if (filter.excludeWidgetId !== undefined)
        predicates.push(`${column('reference', 'widget_id')} <> ${bind(filter.excludeWidgetId)}::uuid`)
    const limit = bind(filter.limit)

    return queryMany<PersistedWidgetBindingReference>(
        db,
        `WITH persisted_configs AS (
             SELECT ${column('widget', 'id')} AS widget_id,
                    ${column('widget', 'widget_key')} AS widget_key,
                    ${column('widget', 'config')} AS config
              FROM ${widgetsTable} AS widget
              JOIN ${layoutsTable} AS layout ON ${column('layout', 'id')} = ${column('widget', 'layout_id')}
              WHERE ${active('widget')} AND ${active('layout')}
             UNION ALL
             SELECT ${column('override', 'id')} AS widget_id,
                    ${column('base_widget', 'widget_key')} AS widget_key,
                    ${column('base_widget', 'config')} AS config
               FROM ${overridesTable} AS override
               JOIN ${widgetsTable} AS base_widget ON ${column('base_widget', 'id')} = ${column('override', 'base_widget_id')}
               JOIN ${layoutsTable} AS layout ON ${column('layout', 'id')} = ${column('override', 'layout_id')}
               JOIN ${layoutsTable} AS base_layout ON ${column('base_layout', 'id')} = ${column('layout', 'base_layout_id')}
              WHERE ${column('base_widget', 'layout_id')} = ${column('layout', 'base_layout_id')}
                AND ${column('layout', 'template_key')} = 'marketing-page'
                AND ${column('layout', 'scope_entity_id')} IS NOT NULL
                AND ${column('layout', 'base_layout_id')} IS NOT NULL
                AND ${column('base_layout', 'scope_entity_id')} IS NULL
                AND ${column('base_layout', 'template_key')} = ${column('layout', 'template_key')}
                AND ${column('override', 'is_deleted_override')} = false
                AND ${active('override')} AND ${active('base_widget')} AND ${active('layout')} AND ${active('base_layout')}
         ), binding_references AS (
             SELECT ${column('persisted', 'widget_id')} AS widget_id,
                    ${column('persisted', 'widget_key')} AS widget_key,
                    ${column('persisted', 'config')} AS config,
                    ${column('slot', 'value')} AS slot,
                    ${column('target', 'value')} AS target
               FROM persisted_configs AS persisted
               CROSS JOIN LATERAL jsonb_array_elements(
                   CASE WHEN jsonb_typeof(${column('persisted', 'config')} #> '{__layout,bindings,slots}') = 'array'
                        THEN ${column('persisted', 'config')} #> '{__layout,bindings,slots}' ELSE '[]'::jsonb END
               ) AS slot(value)
               CROSS JOIN LATERAL jsonb_array_elements(
                   CASE WHEN jsonb_typeof(${column('slot', 'value')} -> 'targets') = 'array'
                        THEN ${column('slot', 'value')} -> 'targets' ELSE '[]'::jsonb END
               ) AS target(value)
         )
         SELECT ${column('reference', 'widget_id')} AS widget_id,
                ${column('reference', 'widget_key')} AS widget_key,
                ${column('reference', 'config')} AS config,
                ${column('reference', 'slot')} ->> 'slot' AS slot_key,
                ${column('reference', 'target')} ->> 'entityKind' AS entity_kind,
                ${column('reference', 'target')} ->> 'entityCodename' AS entity_codename,
                ${column('reference', 'target')} -> 'selector' ->> 'kind' AS selector_kind,
                ${column('reference', 'target')} -> 'selector' ->> 'value' AS selector_value
           FROM binding_references AS reference
          WHERE ${predicates.length > 0 ? predicates.join('\n            AND ') : 'TRUE'}
          LIMIT ${limit}`,
        parameters
    )
}
