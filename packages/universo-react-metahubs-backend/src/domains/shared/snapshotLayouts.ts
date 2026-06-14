import { getPoolExecutor, qSchemaTable } from '@universo-react/database'
import type { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'
import type { MetahubSnapshot } from '../publications/services/SnapshotSerializer'
import { createLogger } from '../../utils/logger'

const log = createLogger('snapshotLayouts')

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const manifestKey = (projectId: string, sceneId: string | null | undefined): string => `${projectId}\u0000${sceneId ?? ''}`

type RuntimeManifestSummary = { checksum: string; sceneId: string | null }

const alignRuntimeManifestBinding = (
    binding: Record<string, unknown>,
    manifestsByProjectScene: Map<string, RuntimeManifestSummary>,
    manifestsByProject: Map<string, RuntimeManifestSummary | null>
): Record<string, unknown> => {
    const projectId = typeof binding.projectId === 'string' ? binding.projectId : null
    if (!projectId) return binding

    const sceneId = typeof binding.sceneId === 'string' ? binding.sceneId : null
    const manifest =
        manifestsByProjectScene.get(manifestKey(projectId, sceneId)) ??
        (sceneId === null ? manifestsByProject.get(projectId) ?? null : null)
    if (!manifest || (binding.checksum === manifest.checksum && (binding.sceneId ?? null) === manifest.sceneId)) return binding

    return {
        ...binding,
        sceneId: manifest.sceneId,
        checksum: manifest.checksum
    }
}

const alignRuntimeManifestReferences = (
    value: unknown,
    manifestsByProjectScene: Map<string, RuntimeManifestSummary>,
    manifestsByProject: Map<string, RuntimeManifestSummary | null>
): unknown => {
    if (Array.isArray(value)) {
        let changed = false
        const next = value.map((item) => {
            const aligned = alignRuntimeManifestReferences(item, manifestsByProjectScene, manifestsByProject)
            changed ||= aligned !== item
            return aligned
        })
        return changed ? next : value
    }
    if (!isRecord(value)) return value

    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
        if (key === 'runtimeManifest' && isRecord(item)) {
            const aligned = alignRuntimeManifestBinding(item, manifestsByProjectScene, manifestsByProject)
            next[key] = aligned
            changed ||= aligned !== item
            continue
        }
        const aligned = alignRuntimeManifestReferences(item, manifestsByProjectScene, manifestsByProject)
        next[key] = aligned
        changed ||= aligned !== item
    }

    return changed ? next : value
}

/**
 * Keep layout widget bindings consistent with the final runtime manifests
 * serialized into the publication snapshot. PlayCanvas project restore may
 * remap and later re-generate manifest checksums after files are restored.
 */
export function alignPlayCanvasRuntimeManifestBindings(snapshot: MetahubSnapshot): void {
    const manifests = snapshot.playcanvasRuntimeManifests ?? []
    if (manifests.length === 0) return

    const manifestsByProjectScene = new Map<string, RuntimeManifestSummary>()
    const manifestsByProject = new Map<string, RuntimeManifestSummary | null>()
    for (const manifest of manifests) {
        const summary = { checksum: manifest.checksum, sceneId: manifest.sceneId ?? null }
        manifestsByProjectScene.set(manifestKey(manifest.projectId, manifest.sceneId ?? null), summary)
        manifestsByProject.set(manifest.projectId, manifestsByProject.has(manifest.projectId) ? null : summary)
    }

    snapshot.layoutConfig = alignRuntimeManifestReferences(snapshot.layoutConfig, manifestsByProjectScene, manifestsByProject) as
        | Record<string, unknown>
        | undefined
    snapshot.layouts = snapshot.layouts?.map((layout) => ({
        ...layout,
        config: alignRuntimeManifestReferences(layout.config, manifestsByProjectScene, manifestsByProject) as Record<string, unknown>
    }))
    snapshot.scopedLayouts = snapshot.scopedLayouts?.map((layout) => ({
        ...layout,
        config: alignRuntimeManifestReferences(layout.config, manifestsByProjectScene, manifestsByProject) as Record<string, unknown>
    }))
    snapshot.layoutZoneWidgets = snapshot.layoutZoneWidgets?.map((widget) => ({
        ...widget,
        config: alignRuntimeManifestReferences(widget.config, manifestsByProjectScene, manifestsByProject) as Record<string, unknown>
    }))
    snapshot.layoutWidgetOverrides = snapshot.layoutWidgetOverrides?.map((override) => ({
        ...override,
        config:
            override.config == null
                ? override.config
                : (alignRuntimeManifestReferences(override.config, manifestsByProjectScene, manifestsByProject) as Record<string, unknown>)
    }))
}

/**
 * Attach layout + zone-widget data from the metahub's branch schema to a snapshot.
 * Reads _mhb_layouts and _mhb_widgets tables, injecting the full design-time
 * layout set, default layout config, and zone-widget assignments into the snapshot in-place.
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
            scope_entity_id: string | null
            base_layout_id: string | null
            template_key: string | null
            name: Record<string, unknown> | null
            description: Record<string, unknown> | null
            config: Record<string, unknown> | null
            is_active: boolean
            is_default: boolean
            sort_order: number | null
        }>(
            `SELECT id, scope_entity_id, base_layout_id, template_key, name, description, config, is_active, is_default, sort_order
       FROM ${layoutsTable}
       WHERE _upl_deleted = false AND _mhb_deleted = false
       ORDER BY sort_order ASC, _upl_created_at ASC`,
            []
        )

        const layouts = (layoutRows ?? []).map((r) => ({
            id: String(r.id),
            scopeEntityId: typeof r.scope_entity_id === 'string' ? r.scope_entity_id : null,
            baseLayoutId: typeof r.base_layout_id === 'string' ? r.base_layout_id : null,
            templateKey: String(r.template_key ?? 'dashboard'),
            name: (r.name as Record<string, unknown>) ?? {},
            description: (r.description as Record<string, unknown> | null) ?? null,
            config: (r.config as Record<string, unknown>) ?? {},
            isActive: Boolean(r.is_active),
            isDefault: Boolean(r.is_default),
            sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0
        }))

        const globalLayouts = layouts.filter((layout) => layout.scopeEntityId === null)
        const scopedLayouts = layouts.filter((layout) => layout.scopeEntityId !== null && layout.baseLayoutId)
        const defaultLayout =
            globalLayouts.find((layout) => layout.isDefault && layout.isActive) ??
            globalLayouts.find((layout) => layout.isActive) ??
            globalLayouts.find((layout) => layout.isDefault) ??
            globalLayouts[0] ??
            null

        snapshot.layouts = globalLayouts.map(({ scopeEntityId: _scopeEntityId, baseLayoutId: _baseLayoutId, ...layout }) => layout)
        snapshot.scopedLayouts = scopedLayouts.map(({ scopeEntityId, baseLayoutId, ...layout }) => ({
            ...layout,
            scopeEntityId: scopeEntityId as string,
            baseLayoutId: baseLayoutId as string
        }))
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
            const snapshotLayoutIds = [...(snapshot.layouts ?? []).map((l) => l.id), ...(snapshot.scopedLayouts ?? []).map((l) => l.id)]
            const widgetsTable = qSchemaTable(branchSchemaName, '_mhb_widgets')

            let widgetSql = `SELECT id, layout_id, zone, widget_key, sort_order, config, is_active
                       FROM ${widgetsTable}
                       WHERE _upl_deleted = false AND _mhb_deleted = false`
            const widgetParams: unknown[] = []

            if (snapshotLayoutIds.length > 0) {
                const placeholders = snapshotLayoutIds.map((_, i) => `$${i + 1}`).join(', ')
                widgetSql += ` AND layout_id IN (${placeholders})`
                widgetParams.push(...snapshotLayoutIds)
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

        const hasOverrideRows = await poolExec.query<{ exists: boolean }>(
            `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
            [branchSchemaName, '_mhb_layout_widget_overrides']
        )

        if (hasOverrideRows[0]?.exists === true) {
            const exportedScopedLayoutIds = new Set((snapshot.scopedLayouts ?? []).map((layout) => layout.id))
            const overridesTable = qSchemaTable(branchSchemaName, '_mhb_layout_widget_overrides')
            const overrideRows = await poolExec.query<{
                id: string
                layout_id: string
                base_widget_id: string
                zone: string | null
                sort_order: number | null
                config: Record<string, unknown> | null
                is_active: boolean | null
                is_deleted_override: boolean
            }>(
                `SELECT id, layout_id, base_widget_id, zone, sort_order, config, is_active, is_deleted_override
                 FROM ${overridesTable}
                 WHERE _upl_deleted = false AND _mhb_deleted = false
                 ORDER BY layout_id ASC, base_widget_id ASC, _upl_created_at ASC`,
                []
            )

            snapshot.layoutWidgetOverrides = (overrideRows ?? [])
                .filter((row) => exportedScopedLayoutIds.has(String(row.layout_id)))
                .map((row) => ({
                    id: String(row.id),
                    layoutId: String(row.layout_id),
                    baseWidgetId: String(row.base_widget_id),
                    zone: row.zone,
                    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : null,
                    config: null,
                    isActive: typeof row.is_active === 'boolean' ? row.is_active : null,
                    isDeletedOverride: row.is_deleted_override === true
                }))
        } else {
            snapshot.layoutWidgetOverrides = []
        }
    } catch (e) {
        log.warn('Failed to load metahub layout config (ignored)', e)
        snapshot.layouts = []
        snapshot.scopedLayouts = []
        snapshot.layoutZoneWidgets = []
        snapshot.layoutWidgetOverrides = []
        snapshot.defaultLayoutId = null
        snapshot.layoutConfig = {}
    }
}
