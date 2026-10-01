import { qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import {
    collectMarketingWidgetBindingSourcesForRuntimeWritesFromConfigs,
    collectMarketingWidgetBindingSourcesFromConfigs
} from '../services/marketingSeedGuard'
import { applicationLayoutTablesExist } from './applicationLayoutCapabilitiesStore'

interface MarketingWidgetConfigRow {
    widget_key: unknown
    zone: unknown
    config: unknown
    source_config: unknown
    source_base_widget_id: unknown
}

const mapBindingRow = (row: MarketingWidgetConfigRow) => ({
    widgetKey: row.widget_key,
    zone: row.zone,
    config: row.config,
    sourceConfig: row.source_config,
    sourceBaseWidgetId: row.source_base_widget_id
})

const entityCodenameBindingPredicate = (configColumn: 'w.config' | 'w.source_config'): string => `EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(${configColumn} #> '{__layout,bindings,slots}') = 'array'
                THEN ${configColumn} #> '{__layout,bindings,slots}'
            ELSE '[]'::jsonb
        END
    ) AS slot(value)
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(slot.value -> 'targets') = 'array'
                THEN slot.value -> 'targets'
            ELSE '[]'::jsonb
        END
    ) AS target(value)
    WHERE target.value ->> 'entityCodename' = $2
)`

const loadMarketingWidgetBindingRows = async (
    executor: DbExecutor,
    schemaName: string,
    targetEntityCodename?: string
): Promise<MarketingWidgetConfigRow[]> => {
    if (!(await applicationLayoutTablesExist(executor, schemaName))) return []

    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    return executor.query<MarketingWidgetConfigRow>(
        `
        SELECT w.widget_key, w.zone, w.config, w.source_config, w.source_base_widget_id
        FROM ${widgetsTable} AS w
        JOIN ${layoutsTable} AS l ON l.id = w.layout_id
        WHERE l.template_key = $1
          AND l._upl_deleted = false
          AND l._app_deleted = false
          AND w._upl_deleted = false
          AND w._app_deleted = false
          ${
              targetEntityCodename
                  ? `AND (${entityCodenameBindingPredicate('w.config')} OR ${entityCodenameBindingPredicate('w.source_config')})`
                  : ''
          }
        ORDER BY w.layout_id ASC, w.zone ASC, w.sort_order ASC, w.id ASC
        `,
        targetEntityCodename ? ['marketing-page', targetEntityCodename] : ['marketing-page']
    )
}

/** Read validated Entity sources referenced by retained Marketing placements and their trusted baselines. */
export const listMarketingWidgetBindingSources = async (executor: DbExecutor, schemaName: string): Promise<Set<string>> =>
    collectMarketingWidgetBindingSourcesFromConfigs((await loadMarketingWidgetBindingRows(executor, schemaName)).map(mapBindingRow))

/**
 * Best-effort classification for the runtime write row-cap guard. Invalid
 * placements are rejected by the strict authoring/publication/runtime paths and
 * do not block writes to otherwise unrelated Entities.
 */
export const listMarketingWidgetBindingSourcesForRuntimeWrites = async (
    executor: DbExecutor,
    schemaName: string,
    targetEntityCodename: string
): Promise<Set<string>> =>
    collectMarketingWidgetBindingSourcesForRuntimeWritesFromConfigs(
        (await loadMarketingWidgetBindingRows(executor, schemaName, targetEntityCodename)).map(mapBindingRow)
    )
