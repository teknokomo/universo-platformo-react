import { getPoolExecutor, qSchemaTable } from '@universo/database'
import type { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'
import type { MetahubSnapshot } from '../publications/services/SnapshotSerializer'
import { createLogger } from '../../utils/logger'

const log = createLogger('snapshotLayouts')

/**
 * Attach layout + zone-widget data from the metahub's branch schema to a snapshot.
 * Reads _mhb_layouts and _mhb_widgets tables, injecting active layouts,
 * default layout config, and zone-widget assignments into the snapshot in-place.
 */
export async function attachLayoutsToSnapshot(options: {
  schemaService: MetahubSchemaService
  snapshot: MetahubSnapshot
  metahubId: string
  userId: string
}): Promise<void> {
  const { schemaService, snapshot, metahubId, userId } = options

  try {
    const poolExec = getPoolExecutor()
    const branchSchemaName = await schemaService.ensureSchema(metahubId, userId)
    const layoutsTable = qSchemaTable(branchSchemaName, '_mhb_layouts')

    const layoutRows = await poolExec.query<{
      id: string
      template_key: string | null
      name: Record<string, unknown> | null
      description: Record<string, unknown> | null
      config: Record<string, unknown> | null
      is_active: boolean
      is_default: boolean
      sort_order: number | null
    }>(
      `SELECT id, template_key, name, description, config, is_active, is_default, sort_order
       FROM ${layoutsTable}
       WHERE _upl_deleted = false AND _mhb_deleted = false
       ORDER BY sort_order ASC, _upl_created_at ASC`,
      []
    )

    const layouts = (layoutRows ?? []).map((r) => ({
      id: String(r.id),
      templateKey: String(r.template_key ?? 'dashboard'),
      name: (r.name as Record<string, unknown>) ?? {},
      description: (r.description as Record<string, unknown> | null) ?? null,
      config: (r.config as Record<string, unknown>) ?? {},
      isActive: Boolean(r.is_active),
      isDefault: Boolean(r.is_default),
      sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0
    }))

    const activeLayouts = layouts.filter((layout) => layout.isActive)
    const defaultLayout = activeLayouts.find((layout) => layout.isDefault) ?? activeLayouts[0] ?? null

    snapshot.layouts = activeLayouts
    snapshot.defaultLayoutId = defaultLayout?.id ?? null
    snapshot.layoutConfig = defaultLayout?.config ?? {}

    const hasTableRows = await poolExec.query<{ exists: boolean }>(
      `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      [branchSchemaName, '_mhb_widgets']
    )
    const hasLayoutZoneWidgets = hasTableRows[0]?.exists === true

    if (hasLayoutZoneWidgets) {
      const activeLayoutIds = (snapshot.layouts ?? []).map((l) => l.id)
      const widgetsTable = qSchemaTable(branchSchemaName, '_mhb_widgets')

      let widgetSql = `SELECT id, layout_id, zone, widget_key, sort_order, config, is_active
                       FROM ${widgetsTable}
                       WHERE _upl_deleted = false AND _mhb_deleted = false`
      const widgetParams: unknown[] = []

      if (activeLayoutIds.length > 0) {
        const placeholders = activeLayoutIds.map((_, i) => `$${i + 1}`).join(', ')
        widgetSql += ` AND layout_id IN (${placeholders})`
        widgetParams.push(...activeLayoutIds)
      }

      widgetSql += ` ORDER BY layout_id ASC, zone ASC, sort_order ASC, _upl_created_at ASC`

      const zoneRows = await poolExec.query<{
        id: string
        layout_id: string
        zone: string
        widget_key: string
        sort_order: number | null
        config: Record<string, unknown> | null
        is_active: boolean
      }>(widgetSql, widgetParams)

      snapshot.layoutZoneWidgets = (zoneRows ?? []).map((row) => ({
        id: String(row.id),
        layoutId: String(row.layout_id),
        zone: String(row.zone),
        widgetKey: String(row.widget_key),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
        config: row.config && typeof row.config === 'object' ? row.config : {},
        isActive: row.is_active !== false
      }))
    } else {
      snapshot.layoutZoneWidgets = []
    }
  } catch (e) {
    log.warn('Failed to load metahub layout config (ignored)', e)
    snapshot.layouts = []
    snapshot.layoutZoneWidgets = []
    snapshot.defaultLayoutId = null
    snapshot.layoutConfig = {}
  }
}
