import type {
    ApplicationLayoutWidgetKey,
    ApplicationLayoutZone,
    ApplicationTemplateKey,
    ColumnsContainerConfig,
    DashboardLayoutZone,
    DashboardSideMenuConfig,
    LayoutLogicalPlacement,
    LayoutPosition,
    MenuWidgetConfig,
    QuizWidgetConfig
} from '@universo-react/types'
import {
    DASHBOARD_LAYOUT_ZONES,
    decodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    getLayoutZoneSettingDefinition,
    LAYOUT_ZONE_DEFINITIONS,
    MARKETING_LAYOUT_ZONES,
    MARKETING_WIDGET_REGISTRY,
    type InterpretationNetworkWorkspaceWidgetConfig,
    type MarketingWidgetKey
} from '@universo-react/types'
import { normalizeSideMenuConfig } from '@universo-react/template-mui'
import type { MetahubLayout, MetahubLayoutZoneWidget, DashboardLayoutWidgetItem } from '../../../types'

export interface MenuEditorState {
    open: boolean
    zone: DashboardLayoutZone | null
    widgetId: string | null
    config: MenuWidgetConfig | null
}

export interface ColumnsEditorState {
    open: boolean
    zone: DashboardLayoutZone | null
    widgetId: string | null
    config: ColumnsContainerConfig | null
}

export interface QuizEditorState {
    open: boolean
    zone: DashboardLayoutZone | null
    widgetId: string | null
    config: QuizWidgetConfig | null
}

export interface PlayCanvasCanvasEditorState {
    open: boolean
    zone: DashboardLayoutZone | null
    widgetId: string | null
    config: Record<string, unknown> | null
}

export interface InterpretationNetworkEditorState {
    open: boolean
    widgetId: string | null
    config: InterpretationNetworkWorkspaceWidgetConfig | null
}

export interface WidgetBehaviorEditorState {
    open: boolean
    widgetId: string | null
    widgetLabel: string | null
    config: Record<string, unknown> | null
}

export interface MarketingWidgetEditorState {
    open: boolean
    zone: ApplicationLayoutZone | null
    widgetId: string | null
    widgetKey: MarketingWidgetKey | null
    config: Record<string, unknown> | null
}

export interface MarketingWidgetBindingEditorState {
    open: boolean
    zone: ApplicationLayoutZone | null
    widgetId: string | null
    sourceWidgetId: string | null
    duplicateMode: boolean
    rendererConfigPending?: boolean
    openSelectedRecordOnOpen?: boolean
    widgetKey: MarketingWidgetKey | null
    config: Record<string, unknown> | null
}

export const LAYOUT_ZONES_BY_TEMPLATE: Readonly<Record<ApplicationTemplateKey, readonly ApplicationLayoutZone[]>> = {
    dashboard: DASHBOARD_LAYOUT_ZONES,
    'marketing-page': MARKETING_LAYOUT_ZONES
}

export const marketingHeaderSettingDefinition = getLayoutZoneSettingDefinition('marketing-page', 'marketing-header', 'position')

export const buildMarketingHeaderDialogSettings = (t: (key: string, fallback: string) => string) =>
    marketingHeaderSettingDefinition
        ? [
              {
                  key: marketingHeaderSettingDefinition.key,
                  kind: marketingHeaderSettingDefinition.kind,
                  label: t(marketingHeaderSettingDefinition.labelKey, marketingHeaderSettingDefinition.defaultLabel),
                  options: marketingHeaderSettingDefinition.options.map((value) => ({
                      value,
                      label: t(
                          marketingHeaderSettingDefinition.optionLabelKeys[value],
                          marketingHeaderSettingDefinition.defaultOptionLabels[value]
                      )
                  }))
              }
          ]
        : []

export const isMarketingWidgetKey = (value: ApplicationLayoutWidgetKey): value is MarketingWidgetKey =>
    Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, value)

export const hasMarketingWidgetBindings = (widgetKey: MarketingWidgetKey, rendererConfig?: unknown): boolean =>
    Boolean(getLayoutWidgetDefinition(widgetKey, rendererConfig)?.bindingSlots?.length)

export const getMarketingRendererConfig = (widget: MetahubLayoutZoneWidget): Record<string, unknown> => {
    const config = widget.config && typeof widget.config === 'object' && !Array.isArray(widget.config) ? widget.config : {}
    return decodeWidgetConfigEnvelope(config, {
        templateKey: 'marketing-page',
        widgetKey: widget.widgetKey,
        zone: widget.zone,
        rendererConfig: config
    }).rendererConfig
}

export const getDefaultMarketingPresentationConfig = (widgetKey: MarketingWidgetKey): Record<string, unknown> =>
    Object.fromEntries((getLayoutWidgetDefinition(widgetKey)?.presentationFields ?? []).map(({ key, defaultValue }) => [key, defaultValue]))

export const withoutInstanceKey = (config: Record<string, unknown>): Record<string, unknown> => {
    const nextConfig = { ...config }
    delete nextConfig.instanceKey
    return nextConfig
}

export const readWidgetPlacement = (widget: MetahubLayoutZoneWidget): LayoutLogicalPlacement | undefined => {
    const placement = widget.placement
    if (placement === 'start' || placement === 'end') return placement
    return getLayoutWidgetDefinition(widget.widgetKey)?.defaultPlacement
}

export const getWidgetDropIndex = (
    items: readonly MetahubLayoutZoneWidget[],
    movingWidgetId: string,
    placement?: LayoutLogicalPlacement,
    overWidgetId?: string
): number => {
    const remainingItems = items.filter((item) => item.id !== movingWidgetId)
    if (overWidgetId) {
        const overIndex = remainingItems.findIndex((item) => item.id === overWidgetId)
        return overIndex >= 0 ? overIndex : remainingItems.length
    }
    if (placement === 'start') return remainingItems.filter((item) => readWidgetPlacement(item) === 'start').length
    return remainingItems.length
}

export const readMarketingHeaderPosition = (
    layout: MetahubLayout,
    baseLayout?: MetahubLayout
): { value: LayoutPosition; inherited: boolean; available: boolean } => {
    if (!marketingHeaderSettingDefinition) return { value: 'fixed', inherited: true, available: false }
    const settingKey = marketingHeaderSettingDefinition.key
    const localPosition = layout.neutral?.zoneSettings?.['marketing-header']?.[settingKey]
    const sourcePosition = layout.neutral?.sourceZoneSettings?.['marketing-header']?.[settingKey]
    const basePosition = baseLayout?.neutral?.zoneSettings?.['marketing-header']?.[settingKey]
    const isSupportedPosition = (value: unknown): value is LayoutPosition =>
        typeof value === 'string' && marketingHeaderSettingDefinition.options.includes(value)
    const hasInvalidValue =
        (localPosition !== undefined && !isSupportedPosition(localPosition)) ||
        (sourcePosition !== undefined && !isSupportedPosition(sourcePosition)) ||
        (basePosition !== undefined && !isSupportedPosition(basePosition))
    const value = isSupportedPosition(localPosition)
        ? localPosition
        : isSupportedPosition(sourcePosition)
        ? sourcePosition
        : isSupportedPosition(basePosition)
        ? basePosition
        : (marketingHeaderSettingDefinition.defaultValue as LayoutPosition)
    return { value, inherited: localPosition === undefined, available: !hasInvalidValue }
}

export const normalizeEditableSideMenuConfig = (value: unknown): DashboardSideMenuConfig => {
    return normalizeSideMenuConfig(
        (value && typeof value === 'object' && !Array.isArray(value) ? value : undefined) as MenuWidgetConfig['sideMenu']
    )
}

export const EMPTY_ZONE_WIDGETS: MetahubLayoutZoneWidget[] = []
export const EMPTY_WIDGET_OBJECTS: DashboardLayoutWidgetItem[] = []
export const LAYOUT_ZONE_ORDER = Object.fromEntries(LAYOUT_ZONE_DEFINITIONS.map(({ key }, index) => [key, index])) as Record<
    ApplicationLayoutZone,
    number
>
