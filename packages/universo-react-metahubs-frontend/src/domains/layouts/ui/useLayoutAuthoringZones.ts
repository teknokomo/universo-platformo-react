import { useMemo } from 'react'
import type { ComponentProps } from 'react'
import type { ApplicationLayoutZone } from '@universo-react/types'
import { getLayoutWidgetAllowedZones, LAYOUT_ZONE_DEFINITIONS } from '@universo-react/types'
import { LayoutAuthoringDetails } from '@universo-react/template-mui'
import type { TFunction } from 'i18next'

import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../types'
import * as layoutsApi from '../api'
import { getSharedBehaviorFromWidgetConfig } from './LayoutWidgetSharedBehaviorFields'
import {
    getWidgetDropIndex,
    hasMarketingWidgetBindings,
    isMarketingWidgetKey,
    readWidgetPlacement
} from './layoutDetailsWidgetAuthoringModel'
import type { LayoutWidgetAuthoringResult } from './useLayoutWidgetAuthoring'

type LayoutAuthoringZone = ComponentProps<typeof LayoutAuthoringDetails>['zones'][number]

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
}: UseLayoutAuthoringZonesOptions): { zoneLabels: Record<ApplicationLayoutZone, string>; zones: LayoutAuthoringZone[] } {
    const { getAvailableWidgetsForZone, getWidgetChipLabel, handleDuplicateWidget, openWidgetEditor, widgetLabelByKey } = authoring
    const zoneLabels = useMemo(
        () =>
            Object.fromEntries(LAYOUT_ZONE_DEFINITIONS.map((zone) => [zone.key, tc(zone.labelKey, zone.defaultLabel)])) as Record<
                ApplicationLayoutZone,
                string
            >,
        [tc]
    )

    const zones = useMemo<LayoutAuthoringZone[]>(
        () =>
            layout
                ? layoutZones.map((zone) => ({
                      zone,
                      title: zoneLabels[zone],
                      addDisabled: !canManageLayouts,
                      availableWidgets: getAvailableWidgetsForZone(zone).map((widgetItem) => ({
                          key: widgetItem.key,
                          label: widgetLabelByKey[widgetItem.key] || tc('layouts.widgets.unknown', 'Widget')
                      })),
                      items: zoneToItems[zone].map((item) => {
                          const isInheritedWidget = item.isInherited === true
                          const sharedBehavior = getSharedBehaviorFromWidgetConfig(item.config)
                          const canDragWidget = canManageLayouts && (!isInheritedWidget || !sharedBehavior.positionLocked)
                          const canToggleWidget = canManageLayouts && (!isInheritedWidget || sharedBehavior.canDeactivate)
                          const canRemoveWidget = canManageLayouts && (!isInheritedWidget || sharedBehavior.canExclude)
                          const isBoundMarketingWidget =
                              isMarketingWidgetKey(item.widgetKey) && hasMarketingWidgetBindings(item.widgetKey, item.config)
                          const canDuplicateWidget =
                              canManageLayouts &&
                              (!isBoundMarketingWidget || (canEditContent && !isInheritedWidget && item.layoutId === layoutId))
                          const canResetWidget = canManageLayouts && !isGlobalLayout && isInheritedWidget && item.isOverridden === true
                          const canEditWidget = isMarketingWidgetKey(item.widgetKey)
                              ? isBoundMarketingWidget
                                  ? canEditContent && !isInheritedWidget && item.layoutId === layoutId
                                  : canManageLayouts
                              : canManageLayouts &&
                                !isInheritedWidget &&
                                (item.widgetKey === 'menuWidget' ||
                                    item.widgetKey === 'columnsContainer' ||
                                    item.widgetKey === 'quizWidget' ||
                                    item.widgetKey === 'playcanvasCanvas' ||
                                    item.widgetKey === 'interpretationNetworkWorkspace' ||
                                    isGlobalLayout)
                          const label = getWidgetChipLabel(item)

                          return {
                              id: item.id,
                              label,
                              isActive: item.isActive,
                              draggable: canDragWidget,
                              moveActions: canManageLayouts
                                  ? [
                                        ...(item.zone === 'marketing-header'
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
                                                                      zoneToItems[item.zone],
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
                                                    targetZone !== item.zone &&
                                                    getLayoutWidgetAllowedZones(item.widgetKey, layout.templateKey)?.includes(targetZone)
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
                                                            targetIndex: getWidgetDropIndex(zoneToItems[targetZone], item.id),
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
                                  canEditWidget && item.widgetKey === 'marketing.hero' && isBoundMarketingWidget
                                      ? () => openWidgetEditor(zone, item, { openSelectedRecord: true })
                                      : undefined,
                              onToggleActive: canToggleWidget
                                  ? (active: boolean) => void handleToggleWidgetActive(item.id, active)
                                  : undefined,
                              inheritedLabel: isInheritedWidget ? t('layouts.details.inheritedBadge', 'Inherited') : undefined,
                              editTooltip: canEditWidget ? t('common:actions.edit') : undefined,
                              editContentTooltip:
                                  canEditWidget && item.widgetKey === 'marketing.hero' && isBoundMarketingWidget
                                      ? tc('layouts.widgetBindings.editRecord', 'Edit content')
                                      : undefined,
                              editContentAriaLabel:
                                  canEditWidget && item.widgetKey === 'marketing.hero' && isBoundMarketingWidget
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
                      })
                  }))
                : [],
        [
            canEditContent,
            canManageLayouts,
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
            zoneToItems
        ]
    )

    const zonesWithSettings = useMemo<LayoutAuthoringZone[]>(
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

    return { zoneLabels, zones: zonesWithSettings }
}
