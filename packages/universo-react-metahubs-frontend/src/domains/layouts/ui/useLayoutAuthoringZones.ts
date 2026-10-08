import { useMemo } from 'react'
import type { ComponentProps } from 'react'
import type { ApplicationLayoutZone } from '@universo-react/types'
import {
    decodeWidgetConfigEnvelope,
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefinition,
    LAYOUT_ZONE_DEFINITIONS
} from '@universo-react/types'
import { LayoutAuthoringDetails } from '@universo-react/template-mui'
import type { TFunction } from 'i18next'

import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../types'
import * as layoutsApi from '../api'
import {
    getWidgetDropIndex,
    hasMarketingWidgetBindings,
    isMarketingWidgetKey,
    readWidgetPlacement
} from './layoutDetailsWidgetAuthoringModel'
import type { LayoutWidgetAuthoringResult } from './useLayoutWidgetAuthoring'

type LayoutAuthoringZone = ComponentProps<typeof LayoutAuthoringDetails>['zones'][number]

export type DashboardNestedPlacementRow = {
    placement: MetahubLayoutZoneWidget
    row: LayoutAuthoringZone['items'][number]
}

type LayoutAuthoringZoneWithNestedRows = LayoutAuthoringZone & {
    nestedPlacementRows: DashboardNestedPlacementRow[]
}

const collectPlacementSubtree = (
    root: MetahubLayoutZoneWidget,
    placements: readonly MetahubLayoutZoneWidget[]
): MetahubLayoutZoneWidget[] => {
    const result = [root]
    const visited = new Set([root.instanceKey])
    for (let index = 0; index < result.length; index += 1) {
        const parent = result[index]
        for (const placement of placements) {
            if (placement.parentInstanceKey !== parent.instanceKey || visited.has(placement.instanceKey)) continue
            visited.add(placement.instanceKey)
            result.push(placement)
        }
    }
    return result
}

const getPlacementDefinition = (placement: MetahubLayoutZoneWidget, layout: MetahubLayout) => {
    const rendererConfig = isMarketingWidgetKey(placement.widgetKey)
        ? placement.config
        : decodeWidgetConfigEnvelope(placement.config ?? {}, {
              templateKey: layout.templateKey,
              widgetKey: placement.widgetKey,
              zone: placement.zone,
              rendererConfig: placement.config ?? {}
          }).rendererConfig
    return getLayoutWidgetDefinition(placement.widgetKey, rendererConfig)
}

export interface LayoutWidgetPlacementCapabilities {
    canDeactivate: boolean
    canExclude: boolean
    canReorder: boolean
    canChangeZone: boolean
    canChangeParentSlot: boolean
}

const NO_LAYOUT_WIDGET_PLACEMENT_CAPABILITIES: LayoutWidgetPlacementCapabilities = {
    canDeactivate: false,
    canExclude: false,
    canReorder: false,
    canChangeZone: false,
    canChangeParentSlot: false
}

/** Resolve scoped-layout actions from the widget registry, never renderer config. */
export const resolveLayoutWidgetPlacementCapabilities = (
    definition: ReturnType<typeof getLayoutWidgetDefinition>
): LayoutWidgetPlacementCapabilities => {
    const overrides = definition?.applicationPlacementOverrides
    if (!definition || !overrides) return NO_LAYOUT_WIDGET_PLACEMENT_CAPABILITIES

    return {
        canDeactivate: overrides.active,
        canExclude:
            definition.composition?.sourceOwned !== true &&
            (overrides.active || overrides.order !== 'none' || overrides.zone || overrides.parentSlot),
        canReorder: overrides.order !== 'none',
        canChangeZone: overrides.zone,
        canChangeParentSlot: overrides.parentSlot
    }
}

interface UseLayoutAuthoringZonesOptions {
    metahubId?: string
    layoutId?: string
    layout?: MetahubLayout
    layoutZones: readonly ApplicationLayoutZone[]
    zoneToItems: Record<ApplicationLayoutZone, MetahubLayoutZoneWidget[]>
    zoneWidgets: MetahubLayoutZoneWidget[]
    authoring: LayoutWidgetAuthoringResult
    canManageLayouts: boolean
    canEditContent: boolean
    dashboardContentBindingIds: ReadonlySet<string>
    isGlobalLayout: boolean
    t: TFunction
    tc: TFunction
    persistAndRefresh: () => Promise<void>
    notifyError: (error: unknown) => void
    requestRemoveWidget: (widgetId: string) => void
    handleResetWidgetOverride: (item: MetahubLayoutZoneWidget) => Promise<void>
    handleToggleWidgetActive: (widgetId: string, isActive: boolean) => Promise<void>
    marketingHeaderSetting: { available: boolean; inherited: boolean }
    onOpenMarketingHeaderSettings: () => void
}

export function useLayoutAuthoringZones({
    metahubId,
    layoutId,
    layout,
    layoutZones,
    zoneToItems,
    zoneWidgets,
    authoring,
    canManageLayouts,
    canEditContent,
    dashboardContentBindingIds,
    isGlobalLayout,
    t,
    tc,
    persistAndRefresh,
    notifyError,
    requestRemoveWidget,
    handleResetWidgetOverride,
    handleToggleWidgetActive,
    marketingHeaderSetting,
    onOpenMarketingHeaderSettings
}: UseLayoutAuthoringZonesOptions): {
    zoneLabels: Record<ApplicationLayoutZone, string>
    zones: LayoutAuthoringZone[]
    nestedPlacements: DashboardNestedPlacementRow[]
} {
    const { getAvailableWidgetsForZone, getWidgetChipLabel, handleDuplicateWidget, openWidgetEditor, widgetLabelByKey } = authoring
    const zoneLabels = useMemo(
        () =>
            Object.fromEntries(LAYOUT_ZONE_DEFINITIONS.map((zone) => [zone.key, tc(zone.labelKey, zone.defaultLabel)])) as Record<
                ApplicationLayoutZone,
                string
            >,
        [tc]
    )

    const zones = useMemo<LayoutAuthoringZoneWithNestedRows[]>(
        () =>
            layout
                ? layoutZones.map((zone) => {
                      const placementRows = zoneToItems[zone].map((item) => {
                          const isInheritedWidget = item.isInherited === true
                          const isBoundMarketingWidget =
                              isMarketingWidgetKey(item.widgetKey) && hasMarketingWidgetBindings(item.widgetKey, item.config)
                          const isMarketingWidget = isMarketingWidgetKey(item.widgetKey)
                          const decodedWidgetConfig = isMarketingWidget
                              ? undefined
                              : decodeWidgetConfigEnvelope(item.config ?? {}, {
                                    templateKey: layout.templateKey,
                                    widgetKey: item.widgetKey,
                                    zone: item.zone,
                                    rendererConfig: item.config ?? {}
                                })
                          const rendererConfig = decodedWidgetConfig?.rendererConfig ?? item.config
                          const definition = getLayoutWidgetDefinition(item.widgetKey, rendererConfig)
                          const placementCapabilities = resolveLayoutWidgetPlacementCapabilities(definition)
                          const canReorderWidget = canManageLayouts && (!isInheritedWidget || placementCapabilities.canReorder)
                          const canChangeWidgetZone = canManageLayouts && (!isInheritedWidget || placementCapabilities.canChangeZone)
                          const canDragWidget = canReorderWidget || canChangeWidgetZone
                          const canToggleWidget = canManageLayouts && (!isInheritedWidget || placementCapabilities.canDeactivate)
                          const subtree = collectPlacementSubtree(item, zoneWidgets)
                          const canRemoveWidget =
                              canManageLayouts &&
                              (isInheritedWidget
                                  ? subtree.every(
                                        (placement) =>
                                            placement.isInherited === true &&
                                            resolveLayoutWidgetPlacementCapabilities(getPlacementDefinition(placement, layout)).canExclude
                                    )
                                  : subtree.every((placement) => placement.isInherited !== true))
                          const metahubPolicy = definition?.authoring.metahub
                          const hasDashboardBindings = !isMarketingWidget && Boolean(definition?.bindingSlots?.length)
                          const canDuplicateSubtree = subtree.every((placement) => {
                              const childDefinition = getPlacementDefinition(placement, layout)
                              return (
                                  childDefinition?.authoring.metahub.duplicate !== 'none' &&
                                  childDefinition?.copyPolicy.placement === 'copy' &&
                                  (childDefinition.copyPolicy.binding !== 'clone-record' || canEditContent) &&
                                  !(
                                      placement.isInherited &&
                                      childDefinition.sourcePolicy.inheritBindings &&
                                      childDefinition.sourcePolicy.sourceMode !== 'none' &&
                                      childDefinition.sourcePolicy.sourceMode !== 'specialized'
                                  )
                              )
                          })
                          const canDuplicateWidget = isMarketingWidget
                              ? canManageLayouts &&
                                (!isBoundMarketingWidget || (canEditContent && !isInheritedWidget && item.layoutId === layoutId))
                              : canManageLayouts && canDuplicateSubtree
                          const canResetWidget = canManageLayouts && !isGlobalLayout && isInheritedWidget && item.isOverridden === true
                          const canEditWidget = isMarketingWidget
                              ? isBoundMarketingWidget
                                  ? canEditContent && !isInheritedWidget && item.layoutId === layoutId
                                  : canManageLayouts
                              : canManageLayouts &&
                                !isInheritedWidget &&
                                item.layoutId === layoutId &&
                                (item.widgetKey === 'menuWidget' ||
                                    (hasDashboardBindings && metahubPolicy?.canRebind === true) ||
                                    item.widgetKey === 'columnsContainer' ||
                                    item.widgetKey === 'quizWidget' ||
                                    item.widgetKey === 'playcanvasCanvas' ||
                                    item.widgetKey === 'interpretationNetworkWorkspace' ||
                                    Boolean(definition?.presentationFields?.length))
                          const canEditDashboardContent =
                              !isMarketingWidget &&
                              hasDashboardBindings &&
                              metahubPolicy?.contentEditing === 'single-record' &&
                              dashboardContentBindingIds.has(item.id) &&
                              canEditContent &&
                              !isInheritedWidget &&
                              item.layoutId === layoutId
                          const label = getWidgetChipLabel(item)

                          return {
                              placement: item,
                              row: {
                                  id: item.id,
                                  label,
                                  isActive: item.isActive,
                                  draggable: canDragWidget,
                                  moveActions: canManageLayouts
                                      ? [
                                            ...(item.zone === 'marketing-header' && canReorderWidget
                                                ? (['start', 'end'] as const)
                                                      .filter((targetPlacement) => targetPlacement !== readWidgetPlacement(item))
                                                      .map((targetPlacement) => ({
                                                          key: `${item.id}-placement-${targetPlacement}`,
                                                          testId: `layout-widget-placement-${item.id}-${targetPlacement}`,
                                                          label: t(
                                                              targetPlacement === 'start' ? 'layouts.moveToStart' : 'layouts.moveToEnd',
                                                              targetPlacement === 'start' ? 'Move to Start' : 'Move to End'
                                                          ),
                                                          onClick: () => {
                                                              if (!metahubId || !layoutId) return
                                                              void layoutsApi
                                                                  .moveLayoutZoneWidget(metahubId, layoutId, {
                                                                      widgetId: item.id,
                                                                      targetZone: item.zone,
                                                                      targetIndex: getWidgetDropIndex(
                                                                          zoneToItems[item.zone].filter(
                                                                              (placement) =>
                                                                                  placement.parentInstanceKey === null &&
                                                                                  placement.slotKey === null
                                                                          ),
                                                                          item.id,
                                                                          targetPlacement
                                                                      ),
                                                                      targetPlacement,
                                                                      expectedVersion: item.version
                                                                  })
                                                                  .then(persistAndRefresh)
                                                                  .catch(notifyError)
                                                          }
                                                      }))
                                                : []),
                                            ...layoutZones
                                                .filter(
                                                    (targetZone) =>
                                                        canChangeWidgetZone &&
                                                        targetZone !== item.zone &&
                                                        getLayoutWidgetAllowedZones(item.widgetKey, layout.templateKey)?.includes(
                                                            targetZone
                                                        )
                                                )
                                                .map((targetZone) => ({
                                                    key: `${item.id}-${targetZone}`,
                                                    testId: `layout-widget-move-${item.id}-${targetZone}`,
                                                    label: t('layouts.moveToZone', 'Move to {{zone}}', { zone: zoneLabels[targetZone] }),
                                                    onClick: () => {
                                                        if (!metahubId || !layoutId) return
                                                        void layoutsApi
                                                            .moveLayoutZoneWidget(metahubId, layoutId, {
                                                                widgetId: item.id,
                                                                targetZone,
                                                                targetIndex: getWidgetDropIndex(
                                                                    zoneToItems[targetZone].filter(
                                                                        (placement) =>
                                                                            placement.parentInstanceKey === null &&
                                                                            placement.slotKey === null
                                                                    ),
                                                                    item.id
                                                                ),
                                                                expectedVersion: item.version
                                                            })
                                                            .then(persistAndRefresh)
                                                            .catch(notifyError)
                                                    }
                                                }))
                                        ]
                                      : undefined,
                                  onRemove: canRemoveWidget ? () => requestRemoveWidget(item.id) : undefined,
                                  onDuplicate: canDuplicateWidget ? () => void handleDuplicateWidget(item) : undefined,
                                  onReset: canResetWidget ? () => void handleResetWidgetOverride(item) : undefined,
                                  onClick: canEditWidget ? () => openWidgetEditor(zone, item) : undefined,
                                  onEdit: canEditWidget ? () => openWidgetEditor(zone, item) : undefined,
                                  onEditContent:
                                      canEditDashboardContent ||
                                      (canEditWidget && item.widgetKey === 'marketing.hero' && isBoundMarketingWidget)
                                          ? () => openWidgetEditor(zone, item, { openSelectedRecord: true })
                                          : undefined,
                                  onToggleActive: canToggleWidget
                                      ? (active: boolean) => void handleToggleWidgetActive(item.id, active)
                                      : undefined,
                                  inheritedLabel: isInheritedWidget ? t('layouts.details.inheritedBadge', 'Inherited') : undefined,
                                  editTooltip: canEditWidget ? t('common:actions.edit') : undefined,
                                  editContentTooltip:
                                      canEditDashboardContent ||
                                      (canEditWidget && item.widgetKey === 'marketing.hero' && isBoundMarketingWidget)
                                          ? tc('layouts.widgetBindings.editRecord', 'Edit content')
                                          : undefined,
                                  editContentAriaLabel:
                                      canEditDashboardContent ||
                                      (canEditWidget && item.widgetKey === 'marketing.hero' && isBoundMarketingWidget)
                                          ? tc('layouts.widgetBindings.editRecord', 'Edit content')
                                          : undefined,
                                  duplicateTooltip: canDuplicateWidget ? t('layouts.actions.duplicate', 'Duplicate') : undefined,
                                  duplicateAriaLabel: canDuplicateWidget
                                      ? t('layouts.actions.duplicateWidgetNamed', 'Duplicate widget: {{label}}', { label })
                                      : undefined,
                                  resetTooltip: canResetWidget ? t('layouts.actions.resetOverride', 'Reset override') : undefined,
                                  resetAriaLabel: canResetWidget
                                      ? t('layouts.actions.resetOverrideWidgetNamed', 'Reset override: {{label}}', { label })
                                      : undefined,
                                  removeTooltip: canRemoveWidget
                                      ? isInheritedWidget
                                          ? t('layouts.actions.exclude', 'Exclude')
                                          : t('common:actions.delete')
                                      : undefined,
                                  toggleActiveTooltip:
                                      canToggleWidget && item.isActive
                                          ? t('layouts.actions.deactivate', 'Deactivate')
                                          : canToggleWidget
                                          ? t('layouts.actions.activate', 'Activate')
                                          : undefined
                              }
                          }
                      })
                      const nestedPlacementRows =
                          layout.templateKey === 'dashboard'
                              ? placementRows
                                    .filter(({ placement }) => placement.parentInstanceKey !== null && placement.slotKey !== null)
                                    .map(({ placement, row }) => ({ placement, row }))
                              : []
                      return {
                          zone,
                          title: zoneLabels[zone],
                          addDisabled: !canManageLayouts,
                          availableWidgets: getAvailableWidgetsForZone(zone).map((widgetItem) => ({
                              key: widgetItem.key,
                              label: widgetLabelByKey[widgetItem.key] || tc('layouts.widgets.unknown', 'Widget')
                          })),
                          items: placementRows
                              .filter(
                                  ({ placement }) =>
                                      layout.templateKey !== 'dashboard' ||
                                      (placement.parentInstanceKey === null && placement.slotKey === null)
                              )
                              .map(({ row }) => row),
                          nestedPlacementRows
                      }
                  })
                : [],
        [
            canEditContent,
            canManageLayouts,
            dashboardContentBindingIds,
            getAvailableWidgetsForZone,
            getWidgetChipLabel,
            handleDuplicateWidget,
            handleResetWidgetOverride,
            handleToggleWidgetActive,
            isGlobalLayout,
            layout,
            layoutId,
            layoutZones,
            metahubId,
            notifyError,
            openWidgetEditor,
            persistAndRefresh,
            requestRemoveWidget,
            t,
            tc,
            widgetLabelByKey,
            zoneLabels,
            zoneToItems,
            zoneWidgets
        ]
    )

    const zonesWithSettings = useMemo<LayoutAuthoringZoneWithNestedRows[]>(
        () =>
            zones.map((zone) => {
                if (zone.zone !== 'marketing-header') return zone
                const placementById = new Map(zoneWidgets.map((item) => [item.id, readWidgetPlacement(item)]))
                return {
                    ...zone,
                    groups: [
                        {
                            key: 'start',
                            title: tc('layouts.startGroup', { defaultValue: 'Start' }),
                            items: zone.items.filter((item) => placementById.get(item.id) !== 'end')
                        },
                        {
                            key: 'end',
                            title: tc('layouts.endGroup', { defaultValue: 'End' }),
                            items: zone.items.filter((item) => placementById.get(item.id) === 'end')
                        }
                    ],
                    settingsAction: marketingHeaderSetting.available
                        ? {
                              label: `${tc('layouts.zoneSettings.settings', { defaultValue: 'Settings' })}: ${zone.title}`,
                              summary: marketingHeaderSetting.inherited
                                  ? tc('layouts.zoneSettings.inherited', { defaultValue: 'Inherited from the current layout source' })
                                  : tc('layouts.zoneSettings.customized', { defaultValue: 'Customized for this layout' }),
                              onClick: onOpenMarketingHeaderSettings
                          }
                        : undefined
                }
            }),
        [marketingHeaderSetting.available, marketingHeaderSetting.inherited, onOpenMarketingHeaderSettings, tc, zoneWidgets, zones]
    )

    return {
        zoneLabels,
        zones: zonesWithSettings,
        nestedPlacements: zonesWithSettings.flatMap((zone) => zone.nestedPlacementRows)
    }
}
