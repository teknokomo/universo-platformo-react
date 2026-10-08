import { Alert, Box, Button, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Stack, Typography } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import type { DragEndEvent } from '@dnd-kit/core'
import {
    LayoutAuthoringList,
    LayoutAuthoringDetails,
    LayoutZoneSettingsDialog,
    LayoutStateChips,
    LayoutWidgetPresentationDialog,
    ViewHeaderMUI as ViewHeader
} from '@universo-react/template-mui'
import type {
    ApplicationLayoutZone,
    ApplicationLayoutWidget,
    ApplicationLayoutWidgetMutation,
    LayoutLogicalPlacement,
    ApplicationTemplateKey,
    DashboardLayoutZone,
    ObjectCollectionRuntimeViewConfig,
    DashboardSideMenuConfig
} from '@universo-react/types'
import {
    DASHBOARD_LAYOUT_ZONES,
    canAddApplicationLayoutWidget,
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefinition,
    LAYOUT_ZONE_DEFINITIONS
} from '@universo-react/types'
import {
    extractObjectCollectionLayoutBehaviorConfig,
    normalizeObjectCollectionRuntimeViewConfig,
    setObjectCollectionLayoutBehaviorConfig
} from '@universo-react/utils'

import { LayoutRuntimeSettingsPanels } from './application-layouts/LayoutRuntimeSettingsPanels'
import { ApplicationLayoutListDialogs } from './application-layouts/ApplicationLayoutListDialogs'
import { ApplicationLayoutWidgetEditors } from './application-layouts/ApplicationLayoutWidgetEditors'
import { ApplicationLayoutListMenu } from './application-layouts/ApplicationLayoutListMenu'
import { ApplicationMarketingAppearancePanel } from './application-layouts/ApplicationMarketingAppearancePanel'
import {
    mergeInterpretationNetworkMatrixSettings,
    parseInterpretationNetworkMatrixSettings
} from './application-layouts/interpretationNetworkWidgetSettings'
import type { ApplicationLayoutWidgetDefinition } from '../api/applications'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'
import { useApplicationLayoutsController } from './application-layouts/useApplicationLayoutsController'
import {
    buildInitialWidgetConfig,
    canOverrideActive,
    canOverrideRootOrder,
    canResetSourcePresentation,
    canEditSourcePresentation,
    getApplicationWidgetPresentationFields,
    hasSourceOwnedPlacement,
    isApplicationOwnedWidget,
    isMarketingWidgetKey,
    isRootPlacement,
    LAYOUT_ZONES_BY_TEMPLATE,
    marketingHeaderSettingDefinition,
    normalizeEditableSideMenuConfig,
    readMarketingHeaderPosition,
    readWidgetPlacement,
    resolveLocalizedText,
    getWidgetDropIndex,
    hasWidgetProvenance,
    buildMarketingHeaderDialogSettings
} from './application-layouts/applicationLayoutSupport'

const ApplicationLayouts = () => {
    const {
        applicationId,
        layoutId,
        t,
        i18n,
        tc,
        navigate,
        canManageLayouts,
        view,
        setView,
        scopeFilter,
        setScopeFilter,
        setSearchValue,
        menuState,
        createOpen,
        setCreateOpen,
        name,
        setName,
        scopeId,
        setScopeId,
        createTemplateKey,
        setCreateTemplateKey,
        templateFilter,
        setTemplateFilter,
        editingLayout,
        setEditingLayout,
        layoutNameEn,
        setLayoutNameEn,
        layoutNameRu,
        setLayoutNameRu,
        layoutDescriptionEn,
        setLayoutDescriptionEn,
        layoutDescriptionRu,
        setLayoutDescriptionRu,
        interpretationNetworkEditingWidget,
        setInterpretationNetworkEditingWidget,
        interpretationNetworkInitialSettings,
        setInterpretationNetworkInitialSettings,
        interpretationNetworkDraft,
        setInterpretationNetworkDraft,
        interpretationNetworkDraftHasChanges,
        setInterpretationNetworkDraftHasChanges,
        workspaceSwitcherEditingWidget,
        setWorkspaceSwitcherEditingWidget,
        widgetPresentationEditor,
        setWidgetPresentationEditor,
        zoneSettingsOpen,
        setZoneSettingsOpen,
        zoneSettingsError,
        setZoneSettingsError,
        widgetMutationError,
        layoutScopeKey,
        scopesQuery,
        layoutsQuery,
        detailQuery,
        widgetObjectQuery,
        getWidgetPlacementOverridePolicy,
        createMutation,
        updateMutation,
        resetMarketingAppearanceMutation,
        updateZoneSettingMutation,
        resetZoneSettingMutation,
        requestMarketingAppearanceReset,
        requestDeleteLayout,
        copyMutation,
        toggleWidgetMutation,
        addWidgetMutation,
        duplicateWidgetMutation,
        moveWidgetMutation,
        deleteWidgetMutation,
        updateWidgetConfigMutation,
        resetWidgetConfigMutation,
        applicationTemplateKey,
        isLoading,
        isSchemaNotReady,
        filteredLayouts,
        formatScopeKind,
        formatLayoutTarget,
        formatTemplate,
        formatComposition,
        openCreateDialog,
        handleCreate,
        openLayoutEditor,
        handleLayoutSave,
        openMenu,
        closeMenu
    } = useApplicationLayoutsController()

    if (isLoading) {
        return (
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
                <CircularProgress />
            </Stack>
        )
    }

    if (isSchemaNotReady) {
        return (
            <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', px: 2 }}>
                <ViewHeader title={t('layouts.title', 'Layouts')} search={false} />
                <Alert severity='info'>
                    {t('layouts.schemaNotReady', 'Create or sync the application schema before managing layouts.')}
                </Alert>
            </Stack>
        )
    }

    if (layoutId && (detailQuery.isError || widgetObjectQuery.isError)) {
        return (
            <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', px: 2 }}>
                <ViewHeader title={t('layouts.title', 'Layouts')} search={false} />
                <Alert
                    severity='error'
                    action={
                        <Button
                            color='inherit'
                            size='small'
                            onClick={() => {
                                void detailQuery.refetch()
                                void widgetObjectQuery.refetch()
                            }}
                        >
                            {tc('actions.retry', 'Retry')}
                        </Button>
                    }
                >
                    {t('layouts.detailLoadError', 'Failed to load the layout. Try again.')}
                </Alert>
            </Stack>
        )
    }

    if (layoutId && detailQuery.data) {
        const layout = detailQuery.data.item
        const title = resolveLocalizedText(layout.name, i18n.language, t('layouts.unnamed', 'Untitled layout'))
        const widgets = detailQuery.data.widgets
        const widgetObject: ApplicationLayoutWidgetDefinition[] = widgetObjectQuery.data ?? []
        const widgetLabelByKey = Object.fromEntries(widgetObject.map((item) => [item.key, tc(item.labelKey, item.defaultLabel)])) as Record<
            string,
            string
        >
        const layoutZones = LAYOUT_ZONES_BY_TEMPLATE[layout.templateKey]
        const widgetsByZone = layoutZones.reduce<Record<ApplicationLayoutZone, ApplicationLayoutWidget[]>>((accumulator, zone) => {
            accumulator[zone] = widgets
                .filter((widget) => widget.zone === zone)
                .slice()
                .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
            return accumulator
        }, {} as Record<ApplicationLayoutZone, ApplicationLayoutWidget[]>)
        const orderableWidgetsByZone = layoutZones.reduce<Record<ApplicationLayoutZone, ApplicationLayoutWidget[]>>((accumulator, zone) => {
            accumulator[zone] = widgetsByZone[zone].filter((widget) => isRootPlacement(widget))
            return accumulator
        }, {} as Record<ApplicationLayoutZone, ApplicationLayoutWidget[]>)

        const objectBehaviorConfig = normalizeObjectCollectionRuntimeViewConfig(extractObjectCollectionLayoutBehaviorConfig(layout.config))
        const sideMenuConfig = normalizeEditableSideMenuConfig(layout.config?.sideMenu)
        const zoneLabels = Object.fromEntries(
            LAYOUT_ZONE_DEFINITIONS.map((zone) => [zone.key, tc(zone.labelKey, zone.defaultLabel)])
        ) as Record<ApplicationLayoutZone, string>
        const marketingHeaderSetting = readMarketingHeaderPosition(layout)

        const openMarketingHeaderSettings = () => {
            if (!marketingHeaderSetting.available) return
            setZoneSettingsError(null)
            setZoneSettingsOpen(true)
        }

        const handleLayoutConfigUpdate = async (nextConfig: Record<string, unknown>) => {
            await updateMutation.mutateAsync({
                layout,
                data: { config: nextConfig }
            })
        }

        const handleViewSettingChange = async (key: string, value: unknown) => {
            await handleLayoutConfigUpdate({ ...(layout.config ?? {}), [key]: value })
        }

        const handleSideMenuConfigChange = async (patch: Partial<DashboardSideMenuConfig>) => {
            const nextSideMenuConfig = normalizeEditableSideMenuConfig({ ...sideMenuConfig, ...patch })
            await handleViewSettingChange('sideMenu', nextSideMenuConfig)
        }

        const handleObjectBehaviorChange = async (patch: Partial<ObjectCollectionRuntimeViewConfig>) => {
            const currentBehaviorConfig = extractObjectCollectionLayoutBehaviorConfig(layout.config) ?? {}
            await handleLayoutConfigUpdate(
                setObjectCollectionLayoutBehaviorConfig(layout.config ?? {}, { ...currentBehaviorConfig, ...patch })
            )
        }

        const handleDragEnd = async (event: DragEndEvent) => {
            const { active, over } = event
            if (!active.id || !over?.id) return

            const activeWidgetId = String(active.id)
            const overId = String(over.id)
            if (activeWidgetId === overId) return

            const currentItem = widgets.find((item) => item.id === activeWidgetId)
            if (!currentItem) return

            let targetZone = currentItem.zone
            let targetIndex = 0
            let targetPlacement: LayoutLogicalPlacement | undefined

            if (overId.startsWith('zone:')) {
                const groupMatch = overId.match(/^zone:([^:]+):group:(start|end)$/)
                targetZone = (groupMatch?.[1] ?? overId.replace('zone:', '')) as ApplicationLayoutZone
                if (!layoutZones.includes(targetZone)) return
                targetPlacement = groupMatch?.[2] as LayoutLogicalPlacement | undefined
                targetIndex = getWidgetDropIndex(orderableWidgetsByZone[targetZone], activeWidgetId, targetPlacement)
            } else {
                const overItem = widgets.find((item) => item.id === overId)
                if (!overItem || !isRootPlacement(overItem)) return
                targetZone = overItem.zone
                targetIndex = getWidgetDropIndex(orderableWidgetsByZone[targetZone], activeWidgetId, undefined, overItem.id)
                if (targetZone === 'marketing-header') targetPlacement = readWidgetPlacement(overItem)
            }

            if (!getLayoutWidgetAllowedZones(currentItem.widgetKey, layout.templateKey)?.includes(targetZone)) return
            if (
                !canOverrideRootOrder(
                    layout,
                    currentItem,
                    targetZone,
                    getWidgetPlacementOverridePolicy(currentItem),
                    widgetObjectQuery.data
                )
            )
                return

            const sourceIndex = orderableWidgetsByZone[currentItem.zone].findIndex((item) => item.id === currentItem.id)
            if (currentItem.zone === targetZone && sourceIndex === targetIndex) {
                return
            }

            await moveWidgetMutation.mutateAsync({
                widget: currentItem,
                targetZone,
                targetIndex,
                targetPlacement
            })
        }

        const getAvailableWidgetsForZone = (zone: ApplicationLayoutZone) =>
            widgetObject.filter((item) => {
                const canAdd = canAddApplicationLayoutWidget(getLayoutWidgetDefinition(item.key), layout.sourceKind)
                return (
                    item.supportedTemplates.includes(layout.templateKey) &&
                    item.allowedZonesByTemplate[layout.templateKey]?.includes(zone) &&
                    canAdd
                )
            })

        const getWidgetChipLabel = (widget: ApplicationLayoutWidget): string => {
            const base = widgetLabelByKey[widget.widgetKey] ?? tc('layouts.widgets.unknown', 'Widget')

            if (isMarketingWidgetKey(widget.widgetKey)) {
                const variant = widget.config?.variant
                return widget.widgetKey === 'marketing.collection' && typeof variant === 'string'
                    ? `${base}: ${t(
                          `layouts.marketing.widget.variants.${variant}`,
                          t('layouts.marketing.widget.collection', 'Collection')
                      )}`
                    : base
            }

            return base
        }

        const openWidgetPresentationEditor = (widget: ApplicationLayoutWidget) => {
            if (widget.widgetKey === 'interpretationNetworkWorkspace') {
                if (
                    hasSourceOwnedPlacement(layout, widget, widgetObjectQuery.data) &&
                    !canEditSourcePresentation(layout, widget, widgetObjectQuery.data)
                ) {
                    return
                }
                const initialSettings = parseInterpretationNetworkMatrixSettings(widget.config)
                setInterpretationNetworkEditingWidget(widget)
                setInterpretationNetworkInitialSettings(initialSettings)
                setInterpretationNetworkDraft(initialSettings)
                setInterpretationNetworkDraftHasChanges(false)
                return
            }

            if (hasSourceOwnedPlacement(layout, widget, widgetObjectQuery.data)) {
                if (!canEditSourcePresentation(layout, widget, widgetObjectQuery.data)) return
                setWidgetPresentationEditor({
                    open: true,
                    zone: widget.zone,
                    widgetId: widget.id,
                    widgetKey: widget.widgetKey,
                    config: widget.config
                })
                return
            }

            if (widget.widgetKey === 'workspaceSwitcher') {
                setWorkspaceSwitcherEditingWidget(widget)
                return
            }

            if (getApplicationWidgetPresentationFields(widget, widgetObjectQuery.data).length > 0) {
                setWidgetPresentationEditor({
                    open: true,
                    zone: widget.zone,
                    widgetId: widget.id,
                    widgetKey: widget.widgetKey,
                    config: widget.config
                })
                return
            }
        }

        const closeInterpretationNetworkEditor = () => {
            setInterpretationNetworkEditingWidget(null)
            setInterpretationNetworkInitialSettings(null)
            setInterpretationNetworkDraft(null)
            setInterpretationNetworkDraftHasChanges(false)
        }

        const saveInterpretationNetworkEditor = () => {
            if (!interpretationNetworkEditingWidget || !interpretationNetworkDraft) return

            updateWidgetConfigMutation.mutate({
                widget: interpretationNetworkEditingWidget,
                config: mergeInterpretationNetworkMatrixSettings(interpretationNetworkEditingWidget.config, interpretationNetworkDraft)
            })
        }

        const handleAddWidgetRequest = (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetMutation['widgetKey']) => {
            const definition = getLayoutWidgetDefinition(widgetKey)
            if (!definition || !definition.supportedTemplates.includes(layout.templateKey)) return
            if (!canAddApplicationLayoutWidget(definition, layout.sourceKind)) return
            if (!getLayoutWidgetAllowedZones(widgetKey, layout.templateKey)?.includes(zone)) return
            if (isMarketingWidgetKey(widgetKey)) {
                setWidgetPresentationEditor({ open: true, zone, widgetId: null, widgetKey, config: null })
                return
            }
            if (definition.shared) {
                addWidgetMutation.mutate({
                    zone,
                    widgetKey,
                    config: buildInitialWidgetConfig(widgetKey)
                })
                return
            }
            if (!DASHBOARD_LAYOUT_ZONES.includes(zone as DashboardLayoutZone)) return
            const dashboardZone = zone as DashboardLayoutZone
            addWidgetMutation.mutate({
                zone: dashboardZone,
                widgetKey,
                config: buildInitialWidgetConfig(widgetKey)
            })
        }

        const buildWidgetRow = (widget: ApplicationLayoutWidget) => {
            const label = getWidgetChipLabel(widget)
            const widgetDefinition = getLayoutWidgetDefinition(widget.widgetKey, widget.config)
            const applicationAuthoring = widgetDefinition?.authoring?.application
            const isSourceOwned = hasSourceOwnedPlacement(layout, widget, widgetObjectQuery.data)
            const hasRegisteredPresentation = getApplicationWidgetPresentationFields(widget, widgetObjectQuery.data).length > 0
            const canEditLocalWidget =
                widget.widgetKey === 'interpretationNetworkWorkspace' ||
                widget.widgetKey === 'workspaceSwitcher' ||
                hasRegisteredPresentation
            const canEditWidgetConfig = isSourceOwned
                ? canEditSourcePresentation(layout, widget, widgetObjectQuery.data)
                : canEditLocalWidget
            const canEditPlacement = !isSourceOwned
            const canChangeZone = canEditPlacement && isRootPlacement(widget, true)
            const placementOverridePolicy = getWidgetPlacementOverridePolicy(widget)
            const canChangeActive = canOverrideActive(layout, widget, placementOverridePolicy, widgetObjectQuery.data)
            const canChangeOrder = canOverrideRootOrder(layout, widget, widget.zone, placementOverridePolicy, widgetObjectQuery.data)
            const canDuplicate = canEditPlacement && isRootPlacement(widget, true) && applicationAuthoring?.canDuplicate !== false
            const canResetToSource = canResetSourcePresentation(layout, widget, widgetObjectQuery.data)
            const isResettingToSource = resetWidgetConfigMutation.isPending && resetWidgetConfigMutation.variables?.id === widget.id
            const isHeaderWidget = layout.templateKey === 'marketing-page' && widget.zone === 'marketing-header'
            const placement = readWidgetPlacement(widget)
            const placementActions =
                isHeaderWidget && canChangeOrder
                    ? (['start', 'end'] as const)
                          .filter((targetPlacement) => targetPlacement !== placement)
                          .map((targetPlacement) => ({
                              key: `${widget.id}-placement-${targetPlacement}`,
                              testId: `layout-widget-placement-${widget.id}-${targetPlacement}`,
                              label: t(
                                  targetPlacement === 'start' ? 'layouts.moveToStart' : 'layouts.moveToEnd',
                                  targetPlacement === 'start' ? 'Move to Start' : 'Move to End'
                              ),
                              onClick: () =>
                                  moveWidgetMutation.mutate({
                                      widget,
                                      targetZone: widget.zone,
                                      targetIndex: getWidgetDropIndex(orderableWidgetsByZone[widget.zone], widget.id, targetPlacement),
                                      targetPlacement
                                  })
                          }))
                    : []
            const zoneMoveActions = canChangeZone
                ? layoutZones
                      .filter(
                          (targetZone) =>
                              targetZone !== widget.zone &&
                              getLayoutWidgetAllowedZones(widget.widgetKey, layout.templateKey)?.includes(targetZone)
                      )
                      .map((targetZone) => ({
                          key: `${widget.id}-${targetZone}`,
                          testId: `layout-widget-move-${widget.id}-${targetZone}`,
                          label: t('layouts.moveToZone', 'Move to {{zone}}', { zone: zoneLabels[targetZone] }),
                          onClick: () =>
                              moveWidgetMutation.mutate({
                                  widget,
                                  targetZone,
                                  targetIndex: getWidgetDropIndex(orderableWidgetsByZone[targetZone], widget.id)
                              })
                      }))
                : []
            return {
                id: widget.id,
                label,
                isActive: widget.isActive,
                draggable: canChangeOrder && !moveWidgetMutation.isPending,
                moveActions: [...placementActions, ...zoneMoveActions],
                onEdit: canEditWidgetConfig ? () => openWidgetPresentationEditor(widget) : undefined,
                onClick: canEditWidgetConfig ? () => openWidgetPresentationEditor(widget) : undefined,
                onDuplicate: canDuplicate
                    ? () => {
                          if (!duplicateWidgetMutation.isPending) duplicateWidgetMutation.mutate(widget)
                      }
                    : undefined,
                onReset:
                    canResetToSource && !resetWidgetConfigMutation.isPending ? () => resetWidgetConfigMutation.mutate(widget) : undefined,
                onRemove: canEditPlacement ? () => void requestDeleteWidget(widget) : undefined,
                onToggleActive: canChangeActive
                    ? (active: boolean) => {
                          if (!toggleWidgetMutation.isPending) toggleWidgetMutation.mutate({ widget, isActive: active })
                      }
                    : undefined,
                editTooltip: canEditWidgetConfig ? tc('actions.edit', 'Edit') : undefined,
                removeTooltip: canEditPlacement ? tc('actions.delete', 'Delete') : undefined,
                toggleActiveTooltip: canChangeActive
                    ? widget.isActive
                        ? t('layouts.deactivate', 'Deactivate')
                        : t('layouts.activate', 'Activate')
                    : undefined,
                editAriaLabel: canEditWidgetConfig ? t('layouts.editWidgetNamed', 'Edit widget: {{label}}', { label }) : undefined,
                duplicateTooltip: canDuplicate ? t('layouts.duplicateWidget', 'Duplicate widget') : undefined,
                duplicateAriaLabel: canDuplicate ? t('layouts.duplicateWidgetNamed', 'Duplicate widget: {{label}}', { label }) : undefined,
                resetTooltip: canResetToSource ? t('layouts.widgetResetToSource', 'Reset to source') : undefined,
                resetAriaLabel: canResetToSource
                    ? t('layouts.widgetResetToSourceNamed', 'Reset {{label}} to source', { label })
                    : undefined,
                removeAriaLabel: canEditPlacement ? t('layouts.removeWidgetNamed', 'Remove widget: {{label}}', { label }) : undefined,
                toggleActiveAriaLabel: canChangeActive
                    ? widget.isActive
                        ? t('layouts.deactivateWidgetNamed', 'Deactivate widget: {{label}}', { label })
                        : t('layouts.activateWidgetNamed', 'Activate widget: {{label}}', { label })
                    : undefined,
                inheritedLabel: isResettingToSource
                    ? t('layouts.widgetResetToSourcePending', 'Resetting to source…')
                    : hasWidgetProvenance(layout, widget)
                    ? isApplicationOwnedWidget(layout, widget)
                        ? t('layouts.widgetCustomization.application', 'Customized in application')
                        : t('layouts.widgetCustomization.metahub', 'Inherited from metahub')
                    : undefined
            }
        }

        const requestDeleteWidget = async (widget: ApplicationLayoutWidget) => {
            if (deleteWidgetMutation.isPending) return
            const confirmed = await confirm({
                title: t('layouts.deleteWidgetTitle', 'Remove widget?'),
                description: t(
                    'layouts.deleteWidgetDescription',
                    'This removes the widget placement from this layout. Its content records and entity data will not be deleted.'
                ),
                confirmButtonName: tc('actions.delete', 'Delete'),
                cancelButtonName: tc('actions.cancel', 'Cancel')
            })
            if (!confirmed) return
            try {
                await deleteWidgetMutation.mutateAsync(widget)
            } catch {
                // The mutation reports a localized error and keeps the layout open.
            }
        }

        const widgetRowsByZone = Object.fromEntries(layoutZones.map((zone) => [zone, widgetsByZone[zone].map(buildWidgetRow)])) as Record<
            ApplicationLayoutZone,
            ReturnType<typeof buildWidgetRow>[]
        >

        return (
            <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={title}
                    description={
                        layout.templateKey === 'marketing-page'
                            ? t('layouts.marketingDetailDescription', 'Configure the published marketing page appearance.')
                            : t('layouts.detailDescription', 'Configure layout widgets.')
                    }
                    search={false}
                />

                <LayoutStateChips
                    isActive={layout.isActive}
                    isDefault={layout.isDefault}
                    sourceKind={layout.sourceKind}
                    syncState={layout.syncState}
                    labels={{
                        active: t('layouts.active', 'Active'),
                        inactive: t('layouts.inactive', 'Inactive'),
                        default: t('layouts.default', 'Default'),
                        source: {
                            application: t('layouts.source.application', 'Application'),
                            metahub: t('layouts.source.metahub', 'Metahub')
                        },
                        syncState: {
                            clean: t('layouts.state.clean', 'Clean'),
                            local_modified: t('layouts.state.local_modified', 'Modified'),
                            source_updated: t('layouts.state.source_updated', 'Source updated'),
                            conflict: t('layouts.state.conflict', 'Conflict'),
                            source_removed: t('layouts.state.source_removed', 'Source removed'),
                            source_excluded: t('layouts.state.source_excluded', 'Excluded')
                        }
                    }}
                />

                <Alert severity={layout.syncState === 'conflict' ? 'warning' : 'info'}>
                    <Stack spacing={0.5}>
                        <Typography variant='body2'>
                            {t('layouts.detailSourceKind', 'Source: {{source}}', { source: t(`layouts.source.${layout.sourceKind}`) })}
                        </Typography>
                        <Typography variant='body2'>
                            {t('layouts.detailSyncState', 'Sync state: {{state}}', { state: t(`layouts.state.${layout.syncState}`) })}
                        </Typography>
                        <Typography variant='body2'>
                            {t('layouts.detailTarget', 'Target: {{target}}', { target: formatLayoutTarget(layout) })}
                        </Typography>
                        <Typography variant='body2'>
                            {t('layouts.detailTemplate', 'Template: {{template}}', { template: formatTemplate(layout.templateKey) })}
                        </Typography>
                        <Typography variant='body2'>
                            {t('layouts.detailComposition', 'Composition: {{composition}}', {
                                composition: formatComposition(layout)
                            })}
                        </Typography>
                        {layout.sourceLayoutId ? (
                            <Typography variant='body2'>{t('layouts.detailSourceLayout', 'Linked to source layout')}</Typography>
                        ) : null}
                    </Stack>
                </Alert>

                {widgetMutationError?.scope === layoutScopeKey ? <Alert severity='warning'>{widgetMutationError.message}</Alert> : null}

                <Box data-testid='application-layout-details-content' sx={{ pb: 2, width: '100%' }}>
                    <LayoutAuthoringDetails
                        dragHint={t('layouts.dragHint', 'Drag widgets between zones to change runtime composition.')}
                        emptyZoneLabel={t('layouts.emptyZone', 'No widgets in this zone yet.')}
                        addWidgetLabel={t('layouts.addWidgetAction', 'Add widget')}
                        availableWidgetsLabel={t('layouts.availableWidgets', 'Available widgets')}
                        dragHandleLabel={t('layouts.dragHandleLabel', 'Reorder widget')}
                        moveWidgetLabel={t('layouts.moveWidget', 'Move widget')}
                        onDragEnd={handleDragEnd}
                        onAddWidgetRequest={handleAddWidgetRequest}
                        beforeZonesContent={
                            layout.templateKey === 'marketing-page' ? (
                                <ApplicationMarketingAppearancePanel
                                    t={t}
                                    layout={layout}
                                    isSaving={updateMutation.isPending}
                                    isResetting={resetMarketingAppearanceMutation.isPending}
                                    canManage={canManageLayouts}
                                    onChange={(key, value) => void handleViewSettingChange(key, value)}
                                    onReset={() => void requestMarketingAppearanceReset(layout)}
                                />
                            ) : (
                                <LayoutRuntimeSettingsPanels
                                    t={t}
                                    layout={layout}
                                    objectBehaviorConfig={objectBehaviorConfig}
                                    sideMenuConfig={sideMenuConfig}
                                    onObjectBehaviorChange={(patch) => void handleObjectBehaviorChange(patch)}
                                    onSideMenuConfigChange={(patch) => void handleSideMenuConfigChange(patch)}
                                />
                            )
                        }
                        zones={layoutZones.map((zone) => ({
                            zone,
                            title: zoneLabels[zone],
                            availableWidgets: getAvailableWidgetsForZone(zone).map((item) => ({
                                key: item.key,
                                label: widgetLabelByKey[item.key] ?? item.defaultLabel ?? tc('layouts.widgets.unknown', 'Widget')
                            })),
                            items: widgetRowsByZone[zone],
                            groups:
                                zone === 'marketing-header'
                                    ? [
                                          {
                                              key: 'start',
                                              title: tc('layouts.startGroup', { defaultValue: 'Start' }),
                                              items: widgetRowsByZone[zone].filter((item) => {
                                                  const widget = widgetsByZone[zone].find((candidate) => candidate.id === item.id)
                                                  return widget ? readWidgetPlacement(widget) !== 'end' : true
                                              })
                                          },
                                          {
                                              key: 'end',
                                              title: tc('layouts.endGroup', { defaultValue: 'End' }),
                                              items: widgetRowsByZone[zone].filter((item) => {
                                                  const widget = widgetsByZone[zone].find((candidate) => candidate.id === item.id)
                                                  return widget ? readWidgetPlacement(widget) === 'end' : false
                                              })
                                          }
                                      ]
                                    : undefined,
                            settingsAction:
                                zone === 'marketing-header' && marketingHeaderSetting.available
                                    ? {
                                          label: `${tc('layouts.zoneSettings.settings', { defaultValue: 'Settings' })}: ${
                                              zoneLabels[zone]
                                          }`,
                                          summary: marketingHeaderSetting.customized
                                              ? tc('layouts.zoneSettings.customized', { defaultValue: 'Customized for this layout' })
                                              : tc('layouts.zoneSettings.inherited', {
                                                    defaultValue: 'Inherited from the current layout source'
                                                }),
                                          onClick: openMarketingHeaderSettings
                                      }
                                    : undefined
                        }))}
                    />
                </Box>

                {layout.templateKey === 'marketing-page' && marketingHeaderSetting.available ? (
                    <LayoutZoneSettingsDialog
                        open={zoneSettingsOpen}
                        title={`${tc('layouts.zoneSettings.settings', { defaultValue: 'Settings' })}: ${zoneLabels['marketing-header']}`}
                        settings={buildMarketingHeaderDialogSettings((key, fallback) => tc(key, { defaultValue: fallback }))}
                        values={
                            marketingHeaderSettingDefinition ? { [marketingHeaderSettingDefinition.key]: marketingHeaderSetting.value } : {}
                        }
                        inherited={marketingHeaderSetting.inherited}
                        readOnly={!canManageLayouts}
                        isBusy={updateZoneSettingMutation.isPending || resetZoneSettingMutation.isPending}
                        error={zoneSettingsError}
                        labels={{
                            inherited: tc('layouts.zoneSettings.inherited', { defaultValue: 'Inherited from the current layout source' }),
                            customized: tc('layouts.zoneSettings.customized', { defaultValue: 'Customized for this layout' }),
                            cancel: tc('layouts.zoneSettings.cancel', { defaultValue: 'Cancel' }),
                            save: tc('layouts.zoneSettings.save', { defaultValue: 'Save' }),
                            reset: tc('layouts.zoneSettings.reset', { defaultValue: 'Reset override' }),
                            saving: tc('layouts.zoneSettings.saving', { defaultValue: 'Saving…' })
                        }}
                        onClose={() => {
                            setZoneSettingsError(null)
                            setZoneSettingsOpen(false)
                        }}
                        onSave={async (values) => {
                            const settingKey = marketingHeaderSettingDefinition?.key
                            const value = settingKey ? values[settingKey] : undefined
                            if (settingKey && value !== undefined) {
                                try {
                                    await updateZoneSettingMutation.mutateAsync({ layout, settingKey, value })
                                } catch {
                                    // The mutation exposes the localized failure through zoneSettingsError.
                                }
                            }
                        }}
                        onReset={async () => {
                            try {
                                await resetZoneSettingMutation.mutateAsync(layout)
                            } catch {
                                // The mutation exposes the localized failure through zoneSettingsError.
                            }
                        }}
                    />
                ) : null}

                {widgetPresentationEditor.open && widgetPresentationEditor.widgetKey ? (
                    <LayoutWidgetPresentationDialog
                        open={widgetPresentationEditor.open}
                        widgetKey={widgetPresentationEditor.widgetKey}
                        initialConfig={widgetPresentationEditor.config}
                        title={widgetLabelByKey[widgetPresentationEditor.widgetKey] ?? tc('layouts.widgets.unknown', 'Widget')}
                        t={(key, defaultValue, options) => t(key, defaultValue ?? key, options)}
                        onSave={async (config) => {
                            const { widgetId, zone, widgetKey } = widgetPresentationEditor
                            if (!widgetKey || !zone) return
                            const rendererConfig = config
                            if (widgetId) {
                                const widget = widgets.find((item) => item.id === widgetId)
                                if (!widget) return
                                await updateWidgetConfigMutation.mutateAsync({ widget, config: rendererConfig })
                            } else {
                                await addWidgetMutation.mutateAsync({ zone, widgetKey, config: rendererConfig })
                            }
                            setWidgetPresentationEditor({ open: false, zone: null, widgetId: null, widgetKey: null, config: null })
                        }}
                        onCancel={() =>
                            setWidgetPresentationEditor({ open: false, zone: null, widgetId: null, widgetKey: null, config: null })
                        }
                    />
                ) : null}

                <ApplicationLayoutWidgetEditors
                    t={t}
                    tc={tc}
                    interpretationNetworkEditingWidget={interpretationNetworkEditingWidget}
                    interpretationNetworkInitialSettings={interpretationNetworkInitialSettings}
                    interpretationNetworkDraftHasChanges={interpretationNetworkDraftHasChanges}
                    workspaceSwitcherEditingWidget={workspaceSwitcherEditingWidget}
                    isSavingWidget={updateWidgetConfigMutation.isPending}
                    isResettingWidget={resetWidgetConfigMutation.isPending}
                    isInterpretationNetworkCustomized={
                        interpretationNetworkEditingWidget ? isApplicationOwnedWidget(layout, interpretationNetworkEditingWidget) : false
                    }
                    canResetInterpretationNetwork={
                        interpretationNetworkEditingWidget
                            ? canResetSourcePresentation(layout, interpretationNetworkEditingWidget, widgetObjectQuery.data) ||
                              (!hasSourceOwnedPlacement(layout, interpretationNetworkEditingWidget, widgetObjectQuery.data) &&
                                  interpretationNetworkEditingWidget.sourceConfig != null &&
                                  interpretationNetworkEditingWidget.isCustomized === true)
                            : false
                    }
                    onCloseInterpretationNetwork={closeInterpretationNetworkEditor}
                    onSaveInterpretationNetwork={saveInterpretationNetworkEditor}
                    onSaveInterpretationNetworkSettings={(settings) => {
                        if (!interpretationNetworkEditingWidget) return
                        updateWidgetConfigMutation.mutate({
                            widget: interpretationNetworkEditingWidget,
                            config: mergeInterpretationNetworkMatrixSettings(interpretationNetworkEditingWidget.config, settings)
                        })
                    }}
                    onResetInterpretationNetwork={() => {
                        if (interpretationNetworkEditingWidget) resetWidgetConfigMutation.mutate(interpretationNetworkEditingWidget)
                    }}
                    onInterpretationNetworkDraftChange={(settings, hasChanges) => {
                        setInterpretationNetworkDraft(settings)
                        setInterpretationNetworkDraftHasChanges(hasChanges)
                    }}
                    onCloseWorkspaceSwitcher={() => setWorkspaceSwitcherEditingWidget(null)}
                />
            </Stack>
        )
    }

    const menuLayout = menuState.layout
    const layoutListItems = filteredLayouts.map((layout) => ({
        id: layout.id,
        title: resolveLocalizedText(layout.name, i18n.language, t('layouts.unnamed', 'Untitled layout')),
        description: resolveLocalizedText(layout.description ?? {}, i18n.language, ''),
        meta: `${formatLayoutTarget(layout)} · ${formatTemplate(layout.templateKey)}`,
        statusContent: (
            <LayoutStateChips
                isActive={layout.isActive}
                isDefault={layout.isDefault}
                sourceKind={layout.sourceKind}
                syncState={layout.syncState}
                labels={{
                    active: t('layouts.active', 'Active'),
                    inactive: t('layouts.inactive', 'Inactive'),
                    default: t('layouts.default', 'Default'),
                    source: {
                        application: t('layouts.source.application', 'Application'),
                        metahub: t('layouts.source.metahub', 'Metahub')
                    },
                    syncState: {
                        clean: t('layouts.state.clean', 'Clean'),
                        local_modified: t('layouts.state.local_modified', 'Modified'),
                        source_updated: t('layouts.state.source_updated', 'Source updated'),
                        conflict: t('layouts.state.conflict', 'Conflict'),
                        source_removed: t('layouts.state.source_removed', 'Source removed'),
                        source_excluded: t('layouts.state.source_excluded', 'Excluded')
                    }
                }}
            />
        ),
        onClick: () => navigate(`/a/${applicationId}/admin/layouts/${layout.id}`),
        rowHref: `/a/${applicationId}/admin/layouts/${layout.id}`,
        headerAction: (
            <Box onClick={(event) => event.stopPropagation()}>
                <IconButton
                    size='small'
                    aria-label={t('layouts.actionsFor', 'Actions for {{name}}', {
                        name: resolveLocalizedText(layout.name, i18n.language, t('layouts.unnamed', 'Untitled layout'))
                    })}
                    sx={{ color: 'text.secondary', width: 28, height: 28, p: 0.25 }}
                    onClick={(event) => openMenu(event, layout)}
                >
                    <MoreVertRoundedIcon fontSize='small' />
                </IconButton>
            </Box>
        ),
        rowAction: (
            <IconButton
                size='small'
                aria-label={t('layouts.actionsFor', 'Actions for {{name}}', {
                    name: resolveLocalizedText(layout.name, i18n.language, t('layouts.unnamed', 'Untitled layout'))
                })}
                onClick={(event) => openMenu(event, layout)}
            >
                <MoreVertRoundedIcon fontSize='small' />
            </IconButton>
        )
    }))

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', px: { xs: 1.5, md: 2 } }}>
            <LayoutAuthoringList
                title={t('layouts.title', 'Layouts')}
                description={t('layouts.description', 'Manage application-specific layout configuration.')}
                searchPlaceholder={t('layouts.searchPlaceholder', 'Search layouts...')}
                onSearchChange={(event) => setSearchValue(event.target.value)}
                headerExtras={
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap' }}>
                        <FormControl size='small' sx={{ minWidth: 220 }}>
                            <InputLabel id='application-layout-list-target-label'>{t('layouts.target', 'Target')}</InputLabel>
                            <Select
                                labelId='application-layout-list-target-label'
                                value={scopeFilter}
                                label={t('layouts.target', 'Target')}
                                onChange={(event) => setScopeFilter(event.target.value)}
                            >
                                <MenuItem value='all'>{t('layouts.allScopes', 'All')}</MenuItem>
                                {(scopesQuery.data ?? []).map((scope) => (
                                    <MenuItem key={scope.id} value={scope.id}>
                                        {scope.scopeKind === 'global' || scope.scopeEntityId === null
                                            ? t('layouts.scopeKinds.global', 'Global')
                                            : `${formatScopeKind(scope.scopeEntityKind ?? scope.kind)}: ${scope.name}`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size='small' sx={{ minWidth: 180 }}>
                            <InputLabel id='application-layout-list-template-label'>{t('layouts.template', 'Template')}</InputLabel>
                            <Select
                                labelId='application-layout-list-template-label'
                                value={templateFilter}
                                label={t('layouts.template', 'Template')}
                                onChange={(event) => setTemplateFilter(event.target.value as 'all' | ApplicationTemplateKey)}
                            >
                                <MenuItem value='all'>{t('layouts.allTemplates', 'All')}</MenuItem>
                                <MenuItem value='dashboard'>{formatTemplate('dashboard')}</MenuItem>
                                <MenuItem value='marketing-page'>{formatTemplate('marketing-page')}</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                }
                primaryAction={{ label: t('layouts.create', 'Create layout'), onClick: openCreateDialog }}
                viewMode={view as 'card' | 'list'}
                onViewModeChange={(mode) => setView(mode)}
                cardViewTitle={tc('cardView', 'Card view')}
                listViewTitle={tc('listView', 'List view')}
                loading={layoutsQuery.isFetching}
                items={layoutListItems}
                error={layoutsQuery.isError}
                errorTitle={t('layouts.loadError', 'Failed to load layouts.')}
                retryLabel={tc('actions.retry', 'Retry')}
                onRetry={() => void layoutsQuery.refetch()}
                emptyTitle={t('layouts.empty', 'No layouts found')}
                metaColumnLabel={t('layouts.target', 'Target')}
                statusColumnLabel={t('layouts.status', 'Status')}
                nameColumnLabel={t('layouts.name', 'Name')}
                descriptionColumnLabel={t('layouts.descriptionColumn', 'Description')}
                emptyCellLabel={t('layouts.emptyCell', '—')}
                listContentTestId='application-layouts-list-content'
            />

            <ApplicationLayoutListMenu
                t={t}
                tc={tc}
                anchorEl={menuState.anchorEl}
                layout={menuLayout}
                onClose={closeMenu}
                onOpen={(layout) => navigate(`/a/${applicationId}/admin/layouts/${layout.id}`)}
                onEdit={openLayoutEditor}
                onCopy={(layout) => copyMutation.mutate(layout)}
                onMakeDefault={(layout) => updateMutation.mutate({ layout, data: { isDefault: true } })}
                onToggleActive={(layout) => updateMutation.mutate({ layout, data: { isActive: !layout.isActive } })}
                onDelete={(layout) => void requestDeleteLayout(layout)}
            />

            <ApplicationLayoutListDialogs
                t={t}
                tc={tc}
                scopes={scopesQuery.data ?? []}
                templateKey={createTemplateKey}
                defaultTemplateKey={applicationTemplateKey}
                setTemplateKey={setCreateTemplateKey}
                createOpen={createOpen}
                setCreateOpen={setCreateOpen}
                name={name}
                setName={setName}
                scopeId={scopeId}
                setScopeId={setScopeId}
                onCreate={handleCreate}
                isCreating={createMutation.isPending}
                editingLayout={editingLayout}
                setEditingLayout={setEditingLayout}
                nameEn={layoutNameEn}
                setNameEn={setLayoutNameEn}
                nameRu={layoutNameRu}
                setNameRu={setLayoutNameRu}
                descriptionEn={layoutDescriptionEn}
                setDescriptionEn={setLayoutDescriptionEn}
                descriptionRu={layoutDescriptionRu}
                setDescriptionRu={setLayoutDescriptionRu}
                onSave={handleLayoutSave}
                isSaving={updateMutation.isPending}
            />
        </Stack>
    )
}

export default ApplicationLayouts
