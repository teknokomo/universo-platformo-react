import { qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import { collectMarketingWidgetBindingSourcesFromConfigs } from '../services/marketingSeedGuard'
import { applicationLayoutTablesExist } from './applicationLayoutCapabilitiesStore'

interface MarketingWidgetConfigRow {
    widget_key: unknown
    zone: unknown
    config: unknown
    source_config: unknown
    source_base_widget_id: unknown
}

/** Read validated Entity sources referenced by retained Marketing placements and their trusted baselines. */
export const listMarketingWidgetBindingSources = async (executor: DbExecutor, schemaName: string): Promise<Set<string>> => {
    if (!(await applicationLayoutTablesExist(executor, schemaName))) return new Set()

    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const rows = await executor.query<MarketingWidgetConfigRow>(
        `
        SELECT w.widget_key, w.zone, w.config, w.source_config, w.source_base_widget_id
        FROM ${widgetsTable} AS w
        JOIN ${layoutsTable} AS l ON l.id = w.layout_id
        WHERE l.template_key = $1
          AND l._upl_deleted = false
          AND l._app_deleted = false
          AND w._upl_deleted = false
          AND w._app_deleted = false
        ORDER BY w.layout_id ASC, w.zone ASC, w.sort_order ASC, w.id ASC
        `,
        ['marketing-page']
    )
    return collectMarketingWidgetBindingSourcesFromConfigs(
        rows.map((row) => ({
            widgetKey: row.widget_key,
            zone: row.zone,
            config: row.config,
            sourceConfig: row.source_config,
            sourceBaseWidgetId: row.source_base_widget_id
        }))
    )
}
