import { decodeLayoutConfigEnvelope, getLayoutWidgetDefinition, type ApplicationTemplateKey } from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import {
    decodePlacementWidgetConfigEnvelope,
    resolvePlacementRegistryDefinition,
    validatePlacementGraph
} from '../../persistence/applicationLayoutWidgetPlacement'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { stableLineageUuidV7 } from '../../shared/applicationLayoutWidgetLineage'
import type { PersistedAppLayout, PersistedAppLayoutZoneWidget, SnapshotLayoutRow } from './syncTypes'
import { parseApplicationTemplateKey } from './syncValueHelpers'
import {
    encodeMaterializedLayoutConfig,
    ensureScopedDefaultLayouts,
    getSnapshotTemplateByLayoutId,
    isWidgetAllowedForTemplate,
    materializedWidgetInstanceKey,
    normalizeLayoutZone,
    normalizeOverlayWidgetConfig,
    normalizeSnapshotLayoutEntries,
    normalizeSnapshotLayoutWidgetOverrides,
    normalizeSnapshotScopedLayouts,
    normalizeSnapshotWidgetEntries,
    readOptionalSnapshotString,
    readSnapshotRows,
    type MaterializedSnapshotWidget,
    type NormalizedLayoutWidgetOverride
} from './syncLayoutSnapshot'

const assertMaterializedWidgetIdentitySafety = (
    layoutId: string,
    templateKey: ApplicationTemplateKey,
    widgets: readonly Pick<PersistedAppLayoutZoneWidget, 'widgetKey' | 'instanceKey'>[]
): void => {
    const seenInstances = new Set<string>()
    const seenSingletons = new Set<string>()

    for (const widget of widgets) {
        const definition = getLayoutWidgetDefinition(widget.widgetKey)
        if (!definition || !definition.supportedTemplates.includes(templateKey)) {
            throw new Error(`[SchemaSync] Layout ${layoutId} contains an unsupported widget definition`)
        }

        const instanceKey = materializedWidgetInstanceKey(widget)
        if (seenInstances.has(instanceKey)) {
            throw new Error(`[SchemaSync] Layout ${layoutId} contains duplicate widget instance identity`)
        }
        seenInstances.add(instanceKey)

        if (!definition.multiInstance) {
            if (seenSingletons.has(widget.widgetKey)) {
                throw new Error(`Layout ${layoutId} contains duplicate singleton widget ${widget.widgetKey}`)
            }
            seenSingletons.add(widget.widgetKey)
        }
    }
}

const validateSnapshotPlacementGraph = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly MaterializedSnapshotWidget[],
    effectiveGraph = false
): void => {
    validatePlacementGraph(
        widgets.map((widget) => {
            const decoded = decodePlacementWidgetConfigEnvelope(widget.config, {
                templateKey,
                widgetKey: widget.widgetKey,
                zone: widget.zone,
                instanceKey: widget.instanceKey
            })
            return {
                id: widget.id,
                layoutId: widget.layoutId,
                instanceKey: widget.instanceKey,
                parentWidgetId: widget.parentWidgetId,
                slotKey: widget.slotKey,
                templateKey,
                widgetKey: widget.widgetKey,
                zone: widget.zone,
                rendererConfig: decoded.rendererConfig
            }
        }),
        { resolveRegistryDefinition: resolvePlacementRegistryDefinition, effectiveGraph }
    )
}

export const withWorkspaceRuntimeLayoutWidgets = (
    snapshot: PublishedApplicationSnapshot,
    workspacesEnabled: boolean
): PublishedApplicationSnapshot => {
    if (!workspacesEnabled) {
        return snapshot
    }

    const layouts = readSnapshotRows(snapshot.layouts, 'layouts')
    const widgets = normalizeSnapshotWidgetEntries(snapshot)
    const nextWidgets: PersistedAppLayoutZoneWidget[] = [...widgets]

    for (const rawLayout of layouts) {
        const layout = (rawLayout ?? {}) as SnapshotLayoutRow
        const layoutId = readOptionalSnapshotString(layout.id, 'id', 'workspace layout', { defaultValue: '' })
        const scopeEntityId = readOptionalSnapshotString(layout.scopeEntityId, 'scopeEntityId', `workspace layout ${layoutId}`, {
            nullable: true,
            defaultValue: null
        }) as string | null
        const templateKey = parseApplicationTemplateKey(layout.templateKey, `workspace layout ${layoutId}`)

        if (!layoutId || scopeEntityId || templateKey !== 'dashboard') {
            continue
        }

        const layoutLeftWidgets = nextWidgets.filter((widget) => widget.layoutId === layoutId && widget.zone === 'left')
        const hasWorkspaceSwitcher = layoutLeftWidgets.some((widget) => widget.widgetKey === 'workspaceSwitcher')
        if (hasWorkspaceSwitcher) {
            continue
        }

        const firstSortOrder = layoutLeftWidgets.reduce((minimum, widget) => Math.min(minimum, widget.sortOrder), 0)
        nextWidgets.push(
            {
                id: generateUuidV7(),
                layoutId,
                instanceKey: 'system-workspace-switcher',
                parentWidgetId: null,
                slotKey: null,
                sourceLineageKey: `workspace:${layoutId}:workspaceSwitcher`,
                zone: 'left',
                widgetKey: 'workspaceSwitcher',
                sortOrder: firstSortOrder - 200,
                config: {},
                isActive: true
            },
            {
                id: generateUuidV7(),
                layoutId,
                instanceKey: 'system-workspace-divider',
                parentWidgetId: null,
                slotKey: null,
                sourceLineageKey: `workspace:${layoutId}:divider`,
                zone: 'left',
                widgetKey: 'divider',
                sortOrder: firstSortOrder - 199,
                config: {},
                isActive: true
            }
        )
    }

    const templateByLayoutId = getSnapshotTemplateByLayoutId(snapshot)
    const widgetsByLayoutId = new Map<string, PersistedAppLayoutZoneWidget[]>()
    for (const widget of nextWidgets) {
        const group = widgetsByLayoutId.get(widget.layoutId) ?? []
        group.push(widget)
        widgetsByLayoutId.set(widget.layoutId, group)
    }
    for (const [layoutId, layoutWidgets] of widgetsByLayoutId) {
        const templateKey = templateByLayoutId.get(layoutId)
        if (templateKey) assertMaterializedWidgetIdentitySafety(layoutId, templateKey, layoutWidgets)
    }

    return {
        ...snapshot,
        layoutZoneWidgets: nextWidgets
    }
}

export const materializeSnapshotLayoutsAndWidgets = (
    snapshot: PublishedApplicationSnapshot
): {
    layouts: PersistedAppLayout[]
    widgets: PersistedAppLayoutZoneWidget[]
} => {
    const globalLayouts = normalizeSnapshotLayoutEntries(snapshot)
    const templateByLayoutId = getSnapshotTemplateByLayoutId(snapshot)
    const rawWidgets = normalizeSnapshotWidgetEntries(snapshot, templateByLayoutId)
    const scopedLayouts = normalizeSnapshotScopedLayouts(snapshot)
    const overrideRows = normalizeSnapshotLayoutWidgetOverrides(snapshot)
    const knownLayoutIds = new Set(templateByLayoutId.keys())
    for (const widget of rawWidgets) {
        if (!knownLayoutIds.has(widget.layoutId)) {
            throw new Error(`[SchemaSync] Widget ${widget.id} references an unknown layout ${widget.layoutId}`)
        }
    }
    const independentLayoutIds = new Set(
        scopedLayouts.filter((layout) => layout.compositionMode === 'independent').map((layout) => layout.id)
    )
    const scopedLayoutById = new Map(scopedLayouts.map((layout) => [layout.id, layout]))
    const baseWidgetById = new Map<string, MaterializedSnapshotWidget>()
    for (const widget of rawWidgets) {
        if (baseWidgetById.has(widget.id)) {
            throw new Error(`[SchemaSync] Snapshot contains duplicate layout widget id ${widget.id}`)
        }
        baseWidgetById.set(widget.id, widget)
    }
    const overrideTargets = new Set<string>()
    for (const override of overrideRows) {
        const scopedLayout = scopedLayoutById.get(override.layoutId)
        if (!scopedLayout) {
            throw new Error(`[SchemaSync] Widget override ${override.layoutId}:${override.baseWidgetId} must target a scoped layout`)
        }
        if (independentLayoutIds.has(override.layoutId)) {
            throw new Error(`[SchemaSync] Independent layout ${override.layoutId} cannot contain widget overrides`)
        }
        if (!scopedLayout.baseLayoutId) {
            throw new Error(`[SchemaSync] Overlay layout ${override.layoutId} must reference a base layout`)
        }
        const baseWidget = baseWidgetById.get(override.baseWidgetId)
        if (!baseWidget) {
            throw new Error(`[SchemaSync] Widget override references a missing base widget ${override.baseWidgetId}`)
        }
        if (baseWidget.layoutId !== scopedLayout.baseLayoutId) {
            throw new Error(
                `[SchemaSync] Widget override ${override.layoutId}:${override.baseWidgetId} references a widget outside base layout ${scopedLayout.baseLayoutId}`
            )
        }
        if (override.instanceKey !== baseWidget.instanceKey) {
            throw new Error(
                `[SchemaSync] Widget override ${override.layoutId}:${override.baseWidgetId} changes its source instance identity`
            )
        }
        if (override.parentWidgetId !== baseWidget.parentWidgetId || override.slotKey !== baseWidget.slotKey) {
            throw new Error(`[SchemaSync] Widget override ${override.layoutId}:${override.baseWidgetId} changes source-owned composition`)
        }
        const target = `${override.layoutId}:${override.baseWidgetId}`
        if (overrideTargets.has(target)) {
            throw new Error(`[SchemaSync] Snapshot contains duplicate widget override target ${target}`)
        }
        overrideTargets.add(target)
    }
    const widgetsByLayoutId = new Map<string, MaterializedSnapshotWidget[]>()
    for (const widget of rawWidgets) {
        const bucket = widgetsByLayoutId.get(widget.layoutId) ?? []
        bucket.push(widget)
        widgetsByLayoutId.set(widget.layoutId, bucket)
    }

    for (const [layoutId, widgets] of widgetsByLayoutId) {
        const templateKey = templateByLayoutId.get(layoutId)
        if (!templateKey) continue
        // Overlay-owned children may point at a base-layout parent until the overlay
        // projection remaps it to the scoped clone below. Validate the complete graph
        // after materialization instead of rejecting that portable snapshot reference.
        if (scopedLayoutById.get(layoutId)?.compositionMode === 'overlay') continue
        assertMaterializedWidgetIdentitySafety(layoutId, templateKey, widgets)
        validateSnapshotPlacementGraph(templateKey, widgets)
    }

    if (scopedLayouts.length === 0) {
        const layouts = ensureScopedDefaultLayouts(globalLayouts)
        const allowedLayoutIds = new Set(layouts.map((layout) => layout.id))
        const widgets = rawWidgets
            .filter((item) => allowedLayoutIds.has(item.layoutId))
            .sort((a, b) => {
                if (a.layoutId !== b.layoutId) return a.layoutId.localeCompare(b.layoutId)
                if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return a.id.localeCompare(b.id)
            })

        return { layouts, widgets }
    }

    const baseLayoutMap = new Map(globalLayouts.map((layout) => [layout.id, layout]))

    const overrideMap = new Map<string, NormalizedLayoutWidgetOverride>()
    for (const override of overrideRows) {
        overrideMap.set(`${override.layoutId}:${override.baseWidgetId}`, override)
    }

    const materializedLayouts: PersistedAppLayout[] = [...globalLayouts]
    const materializedWidgets: MaterializedSnapshotWidget[] = rawWidgets.filter((item) => baseLayoutMap.has(item.layoutId))

    for (const scopedLayout of scopedLayouts) {
        if (scopedLayout.compositionMode === 'independent') {
            const ownedWidgets = (widgetsByLayoutId.get(scopedLayout.id) ?? []).map((item) => ({
                ...item,
                layoutId: scopedLayout.id,
                sourceBaseWidgetId: null
            }))
            materializedLayouts.push({
                id: scopedLayout.id,
                scopeEntityId: scopedLayout.scopeEntityId,
                templateKey: scopedLayout.templateKey,
                name: scopedLayout.name,
                description: scopedLayout.description,
                config: encodeMaterializedLayoutConfig(scopedLayout.config, scopedLayout.templateKey, scopedLayout.neutral),
                sourceComposition: scopedLayout.sourceComposition,
                isActive: scopedLayout.isActive,
                isDefault: scopedLayout.isDefault,
                sortOrder: scopedLayout.sortOrder
            })
            materializedWidgets.push(...ownedWidgets)
            continue
        }

        const baseLayoutId = scopedLayout.baseLayoutId
        if (!baseLayoutId) {
            throw new Error(`Overlay layout ${scopedLayout.id} must reference a base layout`)
        }
        const baseLayout = baseLayoutMap.get(baseLayoutId)
        if (!baseLayout) {
            throw new Error(`Scoped layout ${scopedLayout.id} references a missing base layout`)
        }

        const scopedTemplateKey = parseApplicationTemplateKey(scopedLayout.templateKey, `scoped layout ${scopedLayout.id}`)
        if (scopedTemplateKey !== baseLayout.templateKey) {
            throw new Error(`Scoped layout ${scopedLayout.id} must use the same template as its base layout`)
        }

        const ownedWidgetsForLayout = widgetsByLayoutId.get(scopedLayout.id) ?? []
        const materializedScopedWidgets: MaterializedSnapshotWidget[] = []

        const baseWidgets = widgetsByLayoutId.get(baseLayoutId) ?? []
        const materializedIdByBaseWidgetId = new Map(baseWidgets.map((widget) => [widget.id, generateUuidV7()]))
        const ownedWidgets = ownedWidgetsForLayout.map((item) => ({
            ...item,
            layoutId: scopedLayout.id,
            parentWidgetId:
                item.parentWidgetId === null ? null : materializedIdByBaseWidgetId.get(item.parentWidgetId) ?? item.parentWidgetId
        }))
        let baseLayoutEnvelope: ReturnType<typeof decodeLayoutConfigEnvelope>
        try {
            baseLayoutEnvelope = decodeLayoutConfigEnvelope(baseLayout.config, { templateKey: scopedTemplateKey })
        } catch {
            throw new Error(`Scoped layout ${scopedLayout.id} references an invalid base layout configuration`)
        }
        for (const baseWidget of baseWidgets) {
            const override = overrideMap.get(`${scopedLayout.id}:${baseWidget.id}`)
            if (override?.isDeletedOverride) {
                continue
            }
            const inheritedZone = normalizeLayoutZone(override?.zone ?? baseWidget.zone, scopedTemplateKey)
            if (!isWidgetAllowedForTemplate(scopedTemplateKey, baseWidget.widgetKey, inheritedZone)) {
                throw new Error(`Widget ${baseWidget.widgetKey} is not allowed in scoped layout ${scopedLayout.id}`)
            }
            const inheritedIsActive = override?.isActive ?? baseWidget.isActive
            const inheritedConfig = normalizeOverlayWidgetConfig(
                scopedTemplateKey,
                baseWidget,
                inheritedZone,
                override?.config,
                `Scoped layout ${scopedLayout.id}`
            )
            const parentSourceId = baseWidget.parentWidgetId
            const materializedParentWidgetId =
                parentSourceId === null ? null : materializedIdByBaseWidgetId.get(parentSourceId) ?? parentSourceId
            if (parentSourceId !== null && !materializedParentWidgetId) {
                throw new Error(`[SchemaSync] Scoped layout ${scopedLayout.id} references a missing parent placement`)
            }
            materializedScopedWidgets.push({
                // The physical application row is allocated by sync persistence.
                // This projection only needs a fresh UUID-v7 placeholder; the
                // source lineage is the stable logical identity.
                id: materializedIdByBaseWidgetId.get(baseWidget.id) as string,
                layoutId: scopedLayout.id,
                instanceKey: baseWidget.instanceKey,
                parentWidgetId: materializedParentWidgetId,
                slotKey: baseWidget.slotKey,
                zone: inheritedZone,
                widgetKey: baseWidget.widgetKey,
                sortOrder: override?.sortOrder ?? baseWidget.sortOrder,
                config: inheritedConfig,
                sourceBaseWidgetId: baseWidget.sourceLineageKey
                    ? stableLineageUuidV7(baseWidget.layoutId, baseWidget.sourceLineageKey)
                    : baseWidget.id,
                isActive: inheritedIsActive
            })
        }

        materializedLayouts.push({
            id: scopedLayout.id,
            scopeEntityId: scopedLayout.scopeEntityId,
            templateKey: scopedTemplateKey,
            name: Object.keys(scopedLayout.name).length > 0 ? scopedLayout.name : baseLayout.name,
            description: scopedLayout.description ?? baseLayout.description,
            config: encodeMaterializedLayoutConfig({ ...baseLayoutEnvelope.rendererConfig, ...scopedLayout.config }, scopedTemplateKey, {
                ...baseLayoutEnvelope.neutral,
                ...scopedLayout.neutral,
                zoneSettings: {
                    ...baseLayoutEnvelope.neutral.zoneSettings,
                    ...scopedLayout.neutral.zoneSettings
                }
            }),
            sourceComposition: {
                mode: 'overlay',
                baseLayoutId
            },
            isActive: scopedLayout.isActive,
            isDefault: scopedLayout.isDefault,
            sortOrder: scopedLayout.sortOrder
        })

        materializedWidgets.push(...materializedScopedWidgets, ...ownedWidgets)
    }

    for (const scopedLayout of scopedLayouts) {
        const widgets = materializedWidgets.filter((widget) => widget.layoutId === scopedLayout.id)
        assertMaterializedWidgetIdentitySafety(scopedLayout.id, scopedLayout.templateKey, widgets)
        validateSnapshotPlacementGraph(scopedLayout.templateKey, widgets, true)
    }

    const layouts = ensureScopedDefaultLayouts(materializedLayouts)
    const allowedLayoutIds = new Set(layouts.map((layout) => layout.id))
    const widgets = materializedWidgets
        .filter((item) => allowedLayoutIds.has(item.layoutId))
        .sort((a, b) => {
            if (a.layoutId !== b.layoutId) return a.layoutId.localeCompare(b.layoutId)
            if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return a.id.localeCompare(b.id)
        })

    return { layouts, widgets }
}

export function normalizeSnapshotLayouts(snapshot: PublishedApplicationSnapshot): PersistedAppLayout[] {
    return materializeSnapshotLayoutsAndWidgets(snapshot).layouts
}

export function normalizeSnapshotLayoutZoneWidgets(snapshot: PublishedApplicationSnapshot): PersistedAppLayoutZoneWidget[] {
    return materializeSnapshotLayoutsAndWidgets(snapshot).widgets
}
