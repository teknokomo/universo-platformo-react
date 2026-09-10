import { getPoolExecutor, qSchemaTable } from '@universo-react/database'
import { applicationTemplateKeySchema } from '@universo-react/types'
import type { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'
import type { MetahubSnapshot } from '../publications/services/SnapshotSerializer'
import { createLogger } from '../../utils/logger'
import { findDuplicateActiveSingleInstanceWidgetKey } from '../layouts/widgetInvariants'

const log = createLogger('snapshotLayouts')

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const readStoredString = (value: unknown, field: string): string => {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Stored layout snapshot field ${field} must be a non-empty string`)
    }
    return value
}

const readStoredNullableString = (value: unknown, field: string): string | null => {
    if (value === null) return null
    return readStoredString(value, field)
}

const readStoredRecord = (value: unknown, field: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`Stored layout snapshot field ${field} must be an object`)
    }
    return value
}

const readStoredNullableRecord = (value: unknown, field: string): Record<string, unknown> | null => {
    if (value === null) return null
    return readStoredRecord(value, field)
}

const readStoredBoolean = (value: unknown, field: string): boolean => {
    if (typeof value !== 'boolean') {
        throw new Error(`Stored layout snapshot field ${field} must be a boolean`)
    }
    return value
}

const readStoredInteger = (value: unknown, field: string): number => {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new Error(`Stored layout snapshot field ${field} must be an integer`)
    }
    return value
}

const getSafeErrorCode = (error: unknown): string => (error instanceof Error && error.name ? error.name : 'UNKNOWN_ERROR')

const validateSnapshotWidgetMultiplicity = (snapshot: MetahubSnapshot): void => {
    const layouts = [...(snapshot.layouts ?? []), ...(snapshot.scopedLayouts ?? [])]
    const widgetsByLayout = new Map<string, NonNullable<MetahubSnapshot['layoutZoneWidgets']>>()
    for (const widget of snapshot.layoutZoneWidgets ?? []) {
        const rows = widgetsByLayout.get(widget.layoutId) ?? []
        rows.push(widget)
        widgetsByLayout.set(widget.layoutId, rows)
    }
    const overridesByLayoutAndWidget = new Map<string, NonNullable<MetahubSnapshot['layoutWidgetOverrides']>[number]>()
    for (const override of snapshot.layoutWidgetOverrides ?? []) {
        overridesByLayoutAndWidget.set(`${override.layoutId}:${override.baseWidgetId}`, override)
    }

    for (const layout of layouts) {
        const ownRows = widgetsByLayout.get(layout.id) ?? []
        const baseRows = layout.baseLayoutId ? widgetsByLayout.get(layout.baseLayoutId) ?? [] : []
        const effectiveRows = layout.baseLayoutId
            ? [
                  ...baseRows.map((widget) => {
                      const override = overridesByLayoutAndWidget.get(`${layout.id}:${widget.id}`)
                      return {
                          widgetKey: widget.widgetKey,
                          isActive:
                              override?.isDeletedOverride === true
                                  ? false
                                  : typeof override?.isActive === 'boolean'
                                  ? override.isActive
                                  : widget.isActive
                      }
                  }),
                  ...ownRows
              ]
            : ownRows

        if (findDuplicateActiveSingleInstanceWidgetKey(effectiveRows) !== null) {
            throw new Error('Stored layout snapshot contains duplicate active single-instance widgets')
        }
    }
}

const manifestKey = (projectId: string, sceneId: string | null | undefined): string => `${projectId}\u0000${sceneId ?? ''}`

type RuntimeManifestSummary = { checksum: string; sceneId: string | null }
type RuntimeManifestReference = { projectId: string; sceneId: string | null }

const addRuntimeManifestReference = (refs: Map<string, RuntimeManifestReference>, value: unknown): void => {
    if (!isRecord(value)) return
    const projectId = typeof value.projectId === 'string' && value.projectId.trim() ? value.projectId : null
    if (!projectId) return
    const sceneId = typeof value.sceneId === 'string' && value.sceneId.trim() ? value.sceneId : null
    refs.set(manifestKey(projectId, sceneId), { projectId, sceneId })
}

const collectRuntimeManifestReferences = (refs: Map<string, RuntimeManifestReference>, value: unknown): void => {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectRuntimeManifestReferences(refs, item)
        }
        return
    }
    if (!isRecord(value)) return

    for (const [key, item] of Object.entries(value)) {
        if (key === 'runtimeManifest') {
            addRuntimeManifestReference(refs, item)
            continue
        }
        collectRuntimeManifestReferences(refs, item)
    }
}

const collectPlayCanvasRuntimeManifestReferences = (snapshot: MetahubSnapshot): RuntimeManifestReference[] => {
    const refs = new Map<string, RuntimeManifestReference>()

    for (const item of snapshot.packages ?? []) {
        const config = item.config
        if (config?.kind !== 'display') continue
        const projectId = config.playcanvasProject?.defaultProjectId
        if (typeof projectId === 'string' && projectId.trim()) {
            refs.set(manifestKey(projectId, null), { projectId, sceneId: null })
        }
    }

    collectRuntimeManifestReferences(refs, snapshot.layoutConfig)
    for (const layout of snapshot.layouts ?? []) {
        collectRuntimeManifestReferences(refs, layout.config)
    }
    for (const layout of snapshot.scopedLayouts ?? []) {
        collectRuntimeManifestReferences(refs, layout.config)
    }
    for (const widget of snapshot.layoutZoneWidgets ?? []) {
        if (widget.isActive === false) continue
        if (widget.widgetKey !== 'playcanvasCanvas') continue
        collectRuntimeManifestReferences(refs, widget.config)
    }
    for (const override of snapshot.layoutWidgetOverrides ?? []) {
        if (override.isDeletedOverride === true || override.isActive === false || override.config == null) continue
        collectRuntimeManifestReferences(refs, override.config)
    }

    return [...refs.values()]
}

export const collectPlayCanvasRuntimeManifestProjectIds = (snapshot: MetahubSnapshot): string[] => [
    ...new Set(collectPlayCanvasRuntimeManifestReferences(snapshot).map((ref) => ref.projectId))
]

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

    const runtimeReferences = collectPlayCanvasRuntimeManifestReferences(snapshot)
    if (runtimeReferences.length > 0) {
        snapshot.playcanvasRuntimeManifests = manifests.filter((manifest) =>
            runtimeReferences.some(
                (ref) => manifest.projectId === ref.projectId && (ref.sceneId === null || (manifest.sceneId ?? null) === ref.sceneId)
            )
        )
    }

    const scopedManifests = snapshot.playcanvasRuntimeManifests ?? []
    if (scopedManifests.length === 0) return

    const manifestsByProjectScene = new Map<string, RuntimeManifestSummary>()
    const manifestsByProject = new Map<string, RuntimeManifestSummary | null>()
    for (const manifest of scopedManifests) {
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
            id: readStoredString(r.id, 'layout id'),
            scopeEntityId: readStoredNullableString(r.scope_entity_id, 'layout scope entity id'),
            baseLayoutId: readStoredNullableString(r.base_layout_id, 'layout base id'),
            templateKey: applicationTemplateKeySchema.parse(r.template_key),
            name: readStoredRecord(r.name, 'layout name'),
            description: readStoredNullableRecord(r.description, 'layout description'),
            config: readStoredRecord(r.config, 'layout config'),
            isActive: readStoredBoolean(r.is_active, 'layout active state'),
            isDefault: readStoredBoolean(r.is_default, 'layout default state'),
            sortOrder: readStoredInteger(r.sort_order, 'layout sort order')
        }))

        const globalLayouts = layouts.filter((layout) => layout.scopeEntityId === null)
        const scopedLayouts = layouts.filter((layout) => layout.scopeEntityId !== null)
        const activeGlobalDefaults = globalLayouts.filter((layout) => layout.isActive && layout.isDefault)
        if (globalLayouts.some((layout) => layout.isActive) && activeGlobalDefaults.length !== 1) {
            throw new Error('Metahub layouts must contain exactly one active global default layout')
        }
        const defaultLayout = activeGlobalDefaults[0] ?? null

        snapshot.layouts = globalLayouts.map(({ scopeEntityId: _scopeEntityId, baseLayoutId: _baseLayoutId, ...layout }) => ({
            ...layout,
            compositionMode: 'independent' as const,
            baseLayoutId: null
        }))
        snapshot.scopedLayouts = scopedLayouts.map(({ scopeEntityId, baseLayoutId, ...layout }) => ({
            ...layout,
            scopeEntityId: scopeEntityId as string,
            baseLayoutId,
            compositionMode: baseLayoutId ? 'overlay' : 'independent'
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
                id: readStoredString(row.id, 'widget id'),
                layoutId: readStoredString(row.layout_id, 'widget layout id'),
                zone: readStoredString(row.zone, 'widget zone'),
                widgetKey: readStoredString(row.widget_key, 'widget key'),
                sortOrder: readStoredInteger(row.sort_order, 'widget sort order'),
                config: readStoredRecord(row.config, 'widget config'),
                isActive: readStoredBoolean(row.is_active, 'widget active state')
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
                .filter((row) => exportedScopedLayoutIds.has(readStoredString(row.layout_id, 'widget override layout id')))
                .map((row) => ({
                    id: readStoredString(row.id, 'widget override id'),
                    layoutId: readStoredString(row.layout_id, 'widget override layout id'),
                    baseWidgetId: readStoredString(row.base_widget_id, 'widget override base widget id'),
                    zone: readStoredNullableString(row.zone, 'widget override zone'),
                    sortOrder: row.sort_order === null ? null : readStoredInteger(row.sort_order, 'widget override sort order'),
                    config: readStoredNullableRecord(row.config, 'widget override config'),
                    isActive: row.is_active === null ? null : readStoredBoolean(row.is_active, 'widget override active state'),
                    isDeletedOverride: readStoredBoolean(row.is_deleted_override, 'widget override deletion state')
                }))
        } else {
            snapshot.layoutWidgetOverrides = []
        }

        validateSnapshotWidgetMultiplicity(snapshot)
    } catch (e) {
        // A publication must never silently turn a malformed or unavailable
        // layout into an empty dashboard. Keep the diagnostic structured and
        // free of raw configuration, SQL, and error payloads.
        log.error('Failed to load metahub layout config', {
            code: 'LAYOUT_SNAPSHOT_LOAD_FAILED',
            errorCode: getSafeErrorCode(e),
            operation: 'attach-layouts'
        })
        throw e
    }
}
