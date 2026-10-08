import { useCallback, useMemo, useState } from 'react'
import type { ApplicationLayoutWidgetKey, ApplicationLayoutZone, MarketingWidgetKey } from '@universo-react/types'
import { decodeWidgetConfigEnvelope, getMarketingActionSectionTargets } from '@universo-react/types'
import type { TFunction } from 'i18next'

import type { MetahubLayoutZoneWidget } from '../../../types'
import * as layoutsApi from '../api'
import type { MarketingWidgetBindingDialogProps } from './marketingWidgetBindingDialogModel'
import {
    getDefaultMarketingPresentationConfig,
    getMarketingRendererConfig,
    hasMarketingWidgetBindings,
    isMarketingWidgetKey,
    type MarketingWidgetBindingEditorState,
    type MarketingWidgetEditorState
} from './layoutDetailsWidgetAuthoringModel'

type NotifyAuthoringError = (error: unknown) => void

interface UseMarketingLayoutWidgetAuthoringOptions {
    metahubId?: string
    layoutId?: string
    zoneWidgets: MetahubLayoutZoneWidget[]
    canEditContent: boolean
    isMarketingOverlay: boolean
    t: TFunction
    notifyError: NotifyAuthoringError
    getExpectedLayoutVersion: () => number
    getExpectedWidgetVersion: (widgetId: string | null) => number
    persistAndRefresh: () => Promise<void>
    upsertZoneWidgetInCache: (widget: MetahubLayoutZoneWidget) => void
}

interface MarketingLayoutWidgetAuthoring {
    editors: {
        marketing: MarketingWidgetEditorState
        binding: MarketingWidgetBindingEditorState
    }
    sectionTargets: ReturnType<typeof getMarketingActionSectionTargets>
    canShowWidget: (widgetKey: ApplicationLayoutWidgetKey) => boolean
    getWidgetChipLabel: (widget: MetahubLayoutZoneWidget, baseLabel: string) => string | undefined
    openWidgetEditor: (zone: ApplicationLayoutZone, widget: MetahubLayoutZoneWidget, options?: { openSelectedRecord?: boolean }) => boolean
    handleAddWidgetRequest: (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey) => boolean
    handleDuplicateWidget: (
        widget: MetahubLayoutZoneWidget,
        context: { metahubId: string; layoutId: string; getExpectedVersion: () => number }
    ) => Promise<void>
    closeBinding: () => void
    saveSelection: MarketingWidgetBindingDialogProps['onSelection']
    configurePresentation: NonNullable<MarketingWidgetBindingDialogProps['onConfigurePresentation']>
    saveConfig: (config: Record<string, unknown>) => Promise<void>
    closeConfig: () => void
}

const initialMarketingWidgetEditor: MarketingWidgetEditorState = {
    open: false,
    zone: null,
    widgetId: null,
    widgetKey: null,
    config: null
}

const initialMarketingWidgetBindingEditor: MarketingWidgetBindingEditorState = {
    open: false,
    zone: null,
    widgetId: null,
    sourceWidgetId: null,
    duplicateMode: false,
    rendererConfigPending: false,
    widgetKey: null,
    config: null
}

/** Owns the Marketing binding, presentation, and atomic record-copy authoring flow. */
export function useMarketingLayoutWidgetAuthoring({
    metahubId,
    layoutId,
    zoneWidgets,
    canEditContent,
    isMarketingOverlay,
    t,
    notifyError,
    getExpectedLayoutVersion,
    getExpectedWidgetVersion,
    persistAndRefresh,
    upsertZoneWidgetInCache
}: UseMarketingLayoutWidgetAuthoringOptions): MarketingLayoutWidgetAuthoring {
    const [marketingWidgetEditor, setMarketingWidgetEditor] = useState<MarketingWidgetEditorState>(initialMarketingWidgetEditor)
    const [marketingWidgetBindingEditor, setMarketingWidgetBindingEditor] =
        useState<MarketingWidgetBindingEditorState>(initialMarketingWidgetBindingEditor)

    const sectionTargets = useMemo(
        () =>
            getMarketingActionSectionTargets(
                zoneWidgets
                    .filter((item) => isMarketingWidgetKey(item.widgetKey))
                    .sort((left, right) => left.sortOrder - right.sortOrder)
                    .map((item) => ({
                        widgetKey: item.widgetKey,
                        instanceKey: item.instanceKey,
                        isActive: item.isActive,
                        config: getMarketingRendererConfig(item)
                    }))
            ),
        [zoneWidgets]
    )

    const findWidgetBindingSource = useCallback(
        (widgetKey: MarketingWidgetKey, rendererConfig: Record<string, unknown>) =>
            zoneWidgets.find((widget) => {
                if (!layoutId || widget.layoutId !== layoutId || widget.isInherited || widget.widgetKey !== widgetKey) return false
                if (widgetKey !== 'marketing.collection') return true
                return getMarketingRendererConfig(widget).variant === rendererConfig.variant
            }),
        [layoutId, zoneWidgets]
    )

    const closeBinding = useCallback(() => setMarketingWidgetBindingEditor(initialMarketingWidgetBindingEditor), [])
    const closeConfig = useCallback(() => setMarketingWidgetEditor(initialMarketingWidgetEditor), [])

    const canShowWidget = useCallback(
        (widgetKey: ApplicationLayoutWidgetKey) =>
            !isMarketingWidgetKey(widgetKey) || !hasMarketingWidgetBindings(widgetKey) || (!isMarketingOverlay && canEditContent),
        [canEditContent, isMarketingOverlay]
    )

    const getWidgetChipLabel = useCallback(
        (widget: MetahubLayoutZoneWidget, baseLabel: string): string | undefined => {
            if (!isMarketingWidgetKey(widget.widgetKey)) return undefined
            const variant = widget.config?.variant
            if (widget.widgetKey === 'marketing.collection' && typeof variant === 'string') {
                return `${baseLabel}: ${t(`layouts.marketing.widget.variants.${variant}`, 'Collection')}`
            }
            return baseLabel
        },
        [t]
    )

    const openWidgetEditor = useCallback(
        (zone: ApplicationLayoutZone, item: MetahubLayoutZoneWidget, options?: { openSelectedRecord?: boolean }): boolean => {
            if (!isMarketingWidgetKey(item.widgetKey)) return false
            const rendererConfig = getMarketingRendererConfig(item)
            if (hasMarketingWidgetBindings(item.widgetKey, rendererConfig)) {
                if (!canEditContent || item.isInherited || item.layoutId !== layoutId) return true
                setMarketingWidgetBindingEditor({
                    open: true,
                    zone,
                    widgetId: item.id,
                    sourceWidgetId: item.id,
                    duplicateMode: false,
                    rendererConfigPending: false,
                    openSelectedRecordOnOpen: options?.openSelectedRecord === true && item.widgetKey === 'marketing.hero',
                    widgetKey: item.widgetKey,
                    config: rendererConfig
                })
                return true
            }
            setMarketingWidgetEditor({ open: true, zone, widgetId: item.id, widgetKey: item.widgetKey, config: rendererConfig })
            return true
        },
        [canEditContent, layoutId]
    )

    const handleAddWidgetRequest = useCallback(
        (zone: ApplicationLayoutZone, widgetKey: ApplicationLayoutWidgetKey): boolean => {
            if (!isMarketingWidgetKey(widgetKey)) return false
            if (hasMarketingWidgetBindings(widgetKey)) {
                if (!canEditContent || isMarketingOverlay) return true
                const defaultConfig = getDefaultMarketingPresentationConfig(widgetKey)
                const source = findWidgetBindingSource(widgetKey, defaultConfig)
                setMarketingWidgetEditor({
                    open: true,
                    zone,
                    widgetId: null,
                    widgetKey,
                    config: source ? getMarketingRendererConfig(source) : defaultConfig
                })
            } else {
                setMarketingWidgetEditor({ open: true, zone, widgetId: null, widgetKey, config: null })
            }
            return true
        },
        [canEditContent, findWidgetBindingSource, isMarketingOverlay]
    )

    const handleDuplicateWidget = useCallback(
        async (item: MetahubLayoutZoneWidget, context: { metahubId: string; layoutId: string; getExpectedVersion: () => number }) => {
            if (!isMarketingWidgetKey(item.widgetKey)) return
            if (hasMarketingWidgetBindings(item.widgetKey, item.config)) {
                if (!canEditContent || item.layoutId !== layoutId || item.isInherited) return
                setMarketingWidgetBindingEditor({
                    open: true,
                    zone: item.zone,
                    widgetId: null,
                    sourceWidgetId: item.id,
                    duplicateMode: true,
                    rendererConfigPending: false,
                    widgetKey: item.widgetKey,
                    config: getMarketingRendererConfig(item)
                })
                return
            }
            try {
                await layoutsApi.assignLayoutZoneWidget(context.metahubId, context.layoutId, {
                    zone: item.zone,
                    widgetKey: item.widgetKey,
                    config: getMarketingRendererConfig(item),
                    expectedVersion: context.getExpectedVersion()
                })
                await persistAndRefresh()
            } catch (error: unknown) {
                notifyError(error)
            }
        },
        [canEditContent, layoutId, notifyError, persistAndRefresh]
    )

    const saveSelection: MarketingWidgetBindingDialogProps['onSelection'] = useCallback(
        async ({ config, recordCopy }) => {
            const { zone, widgetKey } = marketingWidgetBindingEditor
            if (!metahubId || !layoutId || !zone || !widgetKey) throw new Error('MARKETING_WIDGET_PLACEMENT_CONTEXT_MISSING')
            let placementPersisted = false
            try {
                const input = {
                    zone,
                    widgetKey,
                    config,
                    expectedVersion: getExpectedLayoutVersion()
                }
                const response = recordCopy
                    ? await layoutsApi.duplicateLayoutZoneWidgetWithRecordCopy(metahubId, layoutId, {
                          ...input,
                          recordCopy
                      })
                    : await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, input)
                placementPersisted = true
                upsertZoneWidgetInCache(response.data)
                closeBinding()
                await persistAndRefresh()
            } catch (error: unknown) {
                notifyError(error)
                if (!placementPersisted) throw error
            }
        },
        [
            closeBinding,
            getExpectedLayoutVersion,
            layoutId,
            marketingWidgetBindingEditor,
            metahubId,
            notifyError,
            persistAndRefresh,
            upsertZoneWidgetInCache
        ]
    )

    const configurePresentation: NonNullable<MarketingWidgetBindingDialogProps['onConfigurePresentation']> = useCallback(
        ({ config }) => {
            const { zone, widgetId, widgetKey } = marketingWidgetBindingEditor
            if (!zone || !widgetKey) return
            const selectedConfig = decodeWidgetConfigEnvelope(config, { templateKey: 'marketing-page', widgetKey, zone }).rendererConfig
            closeBinding()
            setMarketingWidgetEditor({ open: true, zone, widgetId, widgetKey, config: selectedConfig })
        },
        [closeBinding, marketingWidgetBindingEditor]
    )

    const saveConfig = useCallback(
        async (config: Record<string, unknown>) => {
            const { widgetId, zone, widgetKey } = marketingWidgetEditor
            if (!metahubId || !layoutId || !zone || !widgetKey) return
            try {
                if (widgetId) {
                    const currentWidget = zoneWidgets.find((item) => item.id === widgetId)
                    if (
                        currentWidget &&
                        hasMarketingWidgetBindings(widgetKey, config) &&
                        getMarketingRendererConfig(currentWidget).variant !== config.variant
                    ) {
                        setMarketingWidgetBindingEditor({
                            open: true,
                            zone,
                            widgetId,
                            sourceWidgetId: null,
                            duplicateMode: false,
                            rendererConfigPending: true,
                            widgetKey,
                            config
                        })
                        closeConfig()
                        return
                    }
                    const response = await layoutsApi.updateLayoutZoneWidgetConfig(
                        metahubId,
                        layoutId,
                        widgetId,
                        config,
                        getExpectedWidgetVersion(widgetId)
                    )
                    upsertZoneWidgetInCache(response.data.item)
                } else if (hasMarketingWidgetBindings(widgetKey, config)) {
                    const source = findWidgetBindingSource(widgetKey, config)
                    setMarketingWidgetBindingEditor({
                        open: true,
                        zone,
                        widgetId: null,
                        sourceWidgetId: source?.id ?? null,
                        duplicateMode: false,
                        rendererConfigPending: false,
                        widgetKey,
                        config
                    })
                    closeConfig()
                    return
                } else {
                    const response = await layoutsApi.assignLayoutZoneWidget(metahubId, layoutId, {
                        zone,
                        widgetKey,
                        config,
                        expectedVersion: getExpectedLayoutVersion()
                    })
                    upsertZoneWidgetInCache(response.data)
                }
                await persistAndRefresh()
                closeConfig()
            } catch (error: unknown) {
                notifyError(error)
                throw error
            }
        },
        [
            closeConfig,
            findWidgetBindingSource,
            getExpectedLayoutVersion,
            getExpectedWidgetVersion,
            layoutId,
            marketingWidgetEditor,
            metahubId,
            notifyError,
            persistAndRefresh,
            upsertZoneWidgetInCache,
            zoneWidgets
        ]
    )

    return {
        editors: { marketing: marketingWidgetEditor, binding: marketingWidgetBindingEditor },
        sectionTargets,
        canShowWidget,
        getWidgetChipLabel,
        openWidgetEditor,
        handleAddWidgetRequest,
        handleDuplicateWidget,
        closeBinding,
        saveSelection,
        configurePresentation,
        saveConfig,
        closeConfig
    }
}
