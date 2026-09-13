import { getLayoutWidgetDefinition, getLayoutZoneSettingDefinition, resolveLayoutZoneSettingValue } from '@universo-react/types'
import type {
    MarketingAuthData,
    MarketingBrandData,
    MarketingEffectiveLayoutConfig,
    MarketingNavigationItem,
    MarketingPageWidget
} from './types'

export type MarketingHeaderPosition = 'fixed' | 'flow'
export type MarketingHeaderPlacement = 'start' | 'end'

export interface MarketingHeaderProjectionBase {
    instanceKey: string
    sortOrder: number
    placement: MarketingHeaderPlacement
}

export type MarketingHeaderProjection =
    | (MarketingHeaderProjectionBase & { widgetKey: 'marketing.brand'; content: MarketingBrandData })
    | (MarketingHeaderProjectionBase & { widgetKey: 'marketing.navigation'; content: { navigation: MarketingNavigationItem[] } })
    | (MarketingHeaderProjectionBase & { widgetKey: 'marketing.auth'; content: MarketingAuthData })
    | (MarketingHeaderProjectionBase & { widgetKey: 'languageSwitcher'; content: null })
    | (MarketingHeaderProjectionBase & { widgetKey: 'colorModeSwitcher'; content: null })

export interface MarketingHeaderGeometry {
    headerHeightPx: number
    frameOffsetPx: number
    visualOffsetPx: number
    topOffsetPx: number
    occlusionPx: number
}

/** The original MUI marketing template leaves a 28px visual gap above its fixed bar. */
export const MARKETING_HEADER_VISUAL_OFFSET_PX = 28

type RecordLike = Record<string, unknown>

const isRecord = (value: unknown): value is RecordLike => typeof value === 'object' && value !== null && !Array.isArray(value)

const finitePixels = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
    if (typeof value !== 'string') return 0
    const parsed = Number.parseFloat(value.trim())
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

export const calculateMarketingHeaderGeometry = (headerHeight: number, frameOffset: number): MarketingHeaderGeometry => {
    const headerHeightPx = finitePixels(headerHeight)
    const frameOffsetPx = finitePixels(frameOffset)
    return {
        headerHeightPx,
        frameOffsetPx,
        visualOffsetPx: MARKETING_HEADER_VISUAL_OFFSET_PX,
        topOffsetPx: frameOffsetPx + MARKETING_HEADER_VISUAL_OFFSET_PX,
        occlusionPx: headerHeightPx + frameOffsetPx + MARKETING_HEADER_VISUAL_OFFSET_PX
    }
}

export const readMarketingFrameOffsetPx = (): number => {
    if (typeof document === 'undefined' || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 0
    return finitePixels(window.getComputedStyle(document.documentElement).getPropertyValue('--template-frame-height'))
}

const marketingHeaderPositionDefinition = getLayoutZoneSettingDefinition('marketing-page', 'marketing-header', 'position')

export const readMarketingHeaderPosition = (value: MarketingEffectiveLayoutConfig | undefined): MarketingHeaderPosition => {
    if (!marketingHeaderPositionDefinition) {
        throw new Error('Marketing header position descriptor is not registered.')
    }
    if (value !== undefined && value.templateKey !== 'marketing-page') {
        throw new Error(`Unsupported marketing layout template: ${value.templateKey}`)
    }

    const resolved = resolveLayoutZoneSettingValue(
        'marketing-page',
        'marketing-header',
        marketingHeaderPositionDefinition.key,
        value?.zoneSettings
    )
    if (resolved !== 'fixed' && resolved !== 'flow') {
        throw new Error('Marketing header position is invalid for the registered descriptor.')
    }
    return resolved
}

const defaultPlacement = (widgetKey: string): MarketingHeaderPlacement => getLayoutWidgetDefinition(widgetKey)?.defaultPlacement ?? 'start'

const isHeaderProjectionKey = (value: string): value is MarketingHeaderProjection['widgetKey'] =>
    value === 'marketing.brand' ||
    value === 'marketing.navigation' ||
    value === 'marketing.auth' ||
    value === 'languageSwitcher' ||
    value === 'colorModeSwitcher'

const readPlacement = (value: RecordLike, widgetKey: string): MarketingHeaderPlacement => {
    return value.placement === 'start' || value.placement === 'end' ? value.placement : defaultPlacement(widgetKey)
}

const readString = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

const effectiveWidgetInstanceKey = (value: RecordLike, widgetKey: string, index: number): string =>
    readString(value.instanceKey) ?? readString(value.id) ?? `${widgetKey}-${index}`

const effectiveWidgetSortOrder = (value: RecordLike, index: number): number => {
    const sortOrder = typeof value.sortOrder === 'number' && Number.isFinite(value.sortOrder) ? value.sortOrder : index
    return Math.trunc(sortOrder)
}

const dataWidgetFor = (
    widgets: readonly MarketingPageWidget[],
    widgetKey: MarketingHeaderProjection['widgetKey'],
    instanceKey: string
): MarketingPageWidget | undefined =>
    widgets.find((widget) => widget.isActive !== false && String(widget.instanceKey) === instanceKey && widget.widgetKey === widgetKey)

const toProjection = (
    row: RecordLike,
    index: number,
    dataWidgets: readonly MarketingPageWidget[]
): MarketingHeaderProjection | undefined => {
    const widgetKey = readString(row.widgetKey)
    if (!widgetKey || !isHeaderProjectionKey(widgetKey)) {
        return undefined
    }

    const instanceKey = effectiveWidgetInstanceKey(row, widgetKey, index)
    const base = {
        instanceKey,
        sortOrder: effectiveWidgetSortOrder(row, index),
        placement: readPlacement(row, widgetKey)
    } as const

    if (widgetKey === 'languageSwitcher' || widgetKey === 'colorModeSwitcher') {
        return { ...base, widgetKey, content: null }
    }

    const dataWidget = dataWidgetFor(dataWidgets, widgetKey, instanceKey)
    if (widgetKey === 'marketing.brand') {
        if (!dataWidget || dataWidget.widgetKey !== 'marketing.brand') return undefined
        return { ...base, widgetKey, content: dataWidget.content }
    }
    if (widgetKey === 'marketing.navigation') {
        if (!dataWidget || dataWidget.widgetKey !== 'marketing.navigation') return undefined
        return { ...base, widgetKey, content: dataWidget.content }
    }
    if (!dataWidget || dataWidget.widgetKey !== 'marketing.auth') return undefined
    return { ...base, widgetKey, content: dataWidget.content }
}

const compareProjections = (left: MarketingHeaderProjection, right: MarketingHeaderProjection): number => {
    const placementOrder = left.placement === right.placement ? 0 : left.placement === 'start' ? -1 : 1
    return placementOrder || left.sortOrder - right.sortOrder || left.instanceKey.localeCompare(right.instanceKey)
}

/**
 * Project only active effective layout rows into the single marketing header
 * shell. Renderer content remains in the marketing runtime payload; layout
 * rows decide whether a capability is present, ordered, and placed.
 */
export const readMarketingHeaderProjections = (
    dataWidgets: readonly MarketingPageWidget[],
    effectiveLayoutWidgets: readonly unknown[]
): MarketingHeaderProjection[] => {
    const projections: MarketingHeaderProjection[] = []
    const seenSingletons = new Set<string>()

    effectiveLayoutWidgets.forEach((candidate, index) => {
        if (!isRecord(candidate) || candidate.zone !== 'marketing-header' || candidate.isActive === false) return
        const projection = toProjection(candidate, index, dataWidgets)
        if (!projection) return
        const singleton = projection.widgetKey !== 'marketing.navigation'
        if (singleton && seenSingletons.has(projection.widgetKey)) return
        if (singleton) seenSingletons.add(projection.widgetKey)
        projections.push(projection)
    })

    return projections.sort(compareProjections)
}
