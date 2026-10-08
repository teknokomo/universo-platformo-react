import type {
    ApplicationLayout,
    ApplicationLayoutWidget,
    ApplicationLayoutWidgetKey,
    ApplicationTemplateKey,
    ApplicationLayoutZone,
    DashboardSideMenuConfig,
    LayoutLogicalPlacement,
    LayoutPosition,
    LayoutWidgetDefinition
} from '@universo-react/types'
import { serialization } from '@universo-react/utils'
import {
    DASHBOARD_LAYOUT_ZONES,
    getLayoutWidgetDefinition,
    getLayoutZoneSettingDefinition,
    MARKETING_LAYOUT_ZONES,
    MARKETING_WIDGET_REGISTRY
} from '@universo-react/types'
import { normalizeSideMenuConfig } from '@universo-react/template-mui'

const resolveLocalizedText = (value: unknown, locale: string, fallback: string): string => {
    if (!value || typeof value !== 'object') return fallback
    const record = value as { _primary?: string; locales?: Record<string, { content?: string }>; en?: string; ru?: string }
    const direct = record[locale as 'en' | 'ru']
    if (typeof direct === 'string' && direct.trim()) return direct
    const primary = record._primary ?? 'en'
    return record.locales?.[locale]?.content ?? record.locales?.[primary]?.content ?? record.locales?.en?.content ?? fallback
}

const buildInitialWidgetConfig = (widgetKey: ApplicationLayoutWidgetKey): Record<string, unknown> => {
    const variants = Object.keys(getLayoutWidgetDefinition(widgetKey)?.bindingVariants ?? {})
    const variant = variants.includes('generated') ? 'generated' : variants[0]
    return variant ? { variant } : {}
}

const isApplicationCustomizedLayoutWidget = (layout: ApplicationLayout): boolean =>
    layout.sourceKind === 'application' || layout.syncState === 'local_modified'

/**
 * The API materializes lineage columns as `null` for both inherited and
 * application-authored widgets, so only a non-null lineage value proves a sync
 * source; the absence of one falls back to the layout provenance.
 */
const widgetHasSourceLineage = (widget: ApplicationLayoutWidget): boolean =>
    widget.sourceConfig != null || widget.sourceWidgetId != null || widget.sourceBaseWidgetId != null

type ApplicationWidgetSourcePolicy = { authority?: 'local' | 'metahub-source' }
type ApplicationWidgetAuthoringPolicy = { presentationOnly?: boolean }

const getApplicationWidgetSourcePolicy = (
    widget: ApplicationLayoutWidget,
    definitions?: readonly LayoutWidgetDefinition[]
): ApplicationWidgetSourcePolicy | undefined => {
    const staticDefinition = getLayoutWidgetDefinition(widget.widgetKey, widget.config) as
        | { sourcePolicy?: ApplicationWidgetSourcePolicy }
        | undefined
    const apiDefinition = definitions?.find(({ key }) => key === widget.widgetKey) as
        | { sourcePolicy?: ApplicationWidgetSourcePolicy }
        | undefined
    return staticDefinition?.sourcePolicy ?? apiDefinition?.sourcePolicy
}

const getApplicationWidgetAuthoringPolicy = (
    widget: ApplicationLayoutWidget,
    definitions?: readonly LayoutWidgetDefinition[]
): ApplicationWidgetAuthoringPolicy | undefined => {
    const staticDefinition = getLayoutWidgetDefinition(widget.widgetKey, widget.config) as
        | { authoring?: { application?: ApplicationWidgetAuthoringPolicy } }
        | undefined
    const apiDefinition = definitions?.find(({ key }) => key === widget.widgetKey) as
        | { authoring?: { application?: ApplicationWidgetAuthoringPolicy } }
        | undefined
    return staticDefinition?.authoring?.application ?? apiDefinition?.authoring?.application
}

const getApplicationWidgetPresentationFields = (
    widget: ApplicationLayoutWidget,
    definitions?: readonly LayoutWidgetDefinition[]
): readonly { key: string }[] => {
    const staticDefinition = getLayoutWidgetDefinition(widget.widgetKey, widget.config) as
        | { presentationFields?: readonly { key: string }[] }
        | undefined
    const apiDefinition = definitions?.find(({ key }) => key === widget.widgetKey) as
        | { presentationFields?: readonly { key: string }[] }
        | undefined
    return staticDefinition?.presentationFields ?? apiDefinition?.presentationFields ?? []
}

const getApplicationWidgetPresentationConfigFields = (
    widget: ApplicationLayoutWidget,
    definitions?: readonly LayoutWidgetDefinition[]
): readonly { path: string }[] => {
    const staticDefinition = getLayoutWidgetDefinition(widget.widgetKey, widget.config)
    const apiDefinition = definitions?.find(({ key }) => key === widget.widgetKey)
    return (staticDefinition ?? apiDefinition)?.configFields.filter(({ owner }) => owner === 'presentation') ?? []
}

/** Registry authority and row lineage define ownership; unknown registry entries fail closed on inherited layouts. */
const hasSourceOwnedPlacement = (
    layout: ApplicationLayout,
    widget: ApplicationLayoutWidget,
    definitions?: readonly LayoutWidgetDefinition[]
): boolean => {
    if (widget.sourceWidgetId != null || widget.sourceBaseWidgetId != null) return true
    if (layout.sourceKind !== 'metahub' || (widget.isCustomized === true && widget.sourceConfig == null)) return false

    const sourceAuthority = getApplicationWidgetSourcePolicy(widget, definitions)?.authority
    const presentationOnly = getApplicationWidgetAuthoringPolicy(widget, definitions)?.presentationOnly
    return sourceAuthority === 'metahub-source' || presentationOnly === true || (sourceAuthority == null && presentationOnly == null)
}

const hasUnavailableLayoutSource = (layout: ApplicationLayout): boolean =>
    layout.isSourceExcluded || layout.syncState === 'source_removed' || layout.syncState === 'source_excluded'

const hasUnresolvedLayoutSourceConflict = (layout: ApplicationLayout): boolean => layout.syncState === 'conflict'

/** Only semantic parentage is used to decide root-level authoring actions. */
const isRootPlacement = (widget: ApplicationLayoutWidget, allowUnknownForLegacyRows = false): boolean => {
    const semanticPlacement = widget as ApplicationLayoutWidget & {
        parentInstanceKey?: string | null
        slotKey?: string | null
    }
    if (semanticPlacement.parentInstanceKey !== undefined) return semanticPlacement.parentInstanceKey === null
    if (semanticPlacement.slotKey !== undefined) return semanticPlacement.slotKey === null
    return allowUnknownForLegacyRows
}

type ApplicationPlacementOverridePolicy = {
    active: boolean
    order: 'none' | 'root-only' | 'any'
    zone: boolean
    parentSlot: boolean
}

const getApplicationPlacementOverridePolicy = (
    widget: ApplicationLayoutWidget,
    definitions?: readonly LayoutWidgetDefinition[]
): ApplicationPlacementOverridePolicy | undefined => {
    const staticDefinition = getLayoutWidgetDefinition(widget.widgetKey, widget.config) as
        | { applicationPlacementOverrides?: ApplicationPlacementOverridePolicy }
        | undefined
    const apiDefinition = definitions?.find(({ key }) => key === widget.widgetKey) as
        | { applicationPlacementOverrides?: ApplicationPlacementOverridePolicy }
        | undefined
    return staticDefinition?.applicationPlacementOverrides ?? apiDefinition?.applicationPlacementOverrides
}

const canEditSourcePresentation = (
    layout: ApplicationLayout,
    widget: ApplicationLayoutWidget,
    definitions?: readonly LayoutWidgetDefinition[]
): boolean => {
    if (
        !hasSourceOwnedPlacement(layout, widget, definitions) ||
        hasUnavailableLayoutSource(layout) ||
        hasUnresolvedLayoutSourceConflict(layout)
    ) {
        return false
    }

    const presentationFields = getApplicationWidgetPresentationFields(widget, definitions)
    const dedicatedPresentationFields =
        widget.widgetKey === 'interpretationNetworkWorkspace' &&
        getApplicationWidgetPresentationConfigFields(widget, definitions).length > 0
    const staticDefinition = getLayoutWidgetDefinition(widget.widgetKey, widget.config) as
        | { authoring?: { application?: ApplicationWidgetAuthoringPolicy } }
        | undefined
    const apiDefinition = definitions?.find(({ key }) => key === widget.widgetKey) as
        | { authoring?: { application?: ApplicationWidgetAuthoringPolicy } }
        | undefined
    const applicationAuthoring = staticDefinition?.authoring?.application ?? apiDefinition?.authoring?.application
    return applicationAuthoring?.presentationOnly === true && (presentationFields.length > 0 || dedicatedPresentationFields)
}

const canUpdateSourcePresentation = (
    layout: ApplicationLayout,
    widget: ApplicationLayoutWidget,
    config: Record<string, unknown>,
    definitions?: readonly LayoutWidgetDefinition[]
): boolean => {
    if (Object.prototype.hasOwnProperty.call(config, 'instanceKey')) return false
    if (!hasSourceOwnedPlacement(layout, widget, definitions)) return true
    if (!canEditSourcePresentation(layout, widget, definitions)) return false

    const presentationKeys = new Set([
        ...getApplicationWidgetPresentationFields(widget, definitions).map(({ key }) => key),
        ...getApplicationWidgetPresentationConfigFields(widget, definitions)
            .map(({ path }) => path.match(/^[^.[\]]+/u)?.[0])
            .filter((key): key is string => Boolean(key))
    ])
    presentationKeys.delete('instanceKey')

    const currentConfig = widget.config
    const configKeys = new Set([...Object.keys(currentConfig), ...Object.keys(config)])
    const changedKeys = [...configKeys].filter((key) => {
        const currentHasKey = Object.prototype.hasOwnProperty.call(currentConfig, key)
        const nextHasKey = Object.prototype.hasOwnProperty.call(config, key)
        if (currentHasKey !== nextHasKey) return true
        if (!currentHasKey) return false
        const currentValue = currentConfig[key]
        const nextValue = config[key]
        if (currentValue === undefined || nextValue === undefined) return currentValue !== nextValue
        return serialization.stableStringify(currentValue) !== serialization.stableStringify(nextValue)
    })

    return changedKeys.every((key) => presentationKeys.has(key))
}

const canOverrideActive = (
    layout: ApplicationLayout,
    widget: ApplicationLayoutWidget,
    policy?: ApplicationPlacementOverridePolicy,
    definitions?: readonly LayoutWidgetDefinition[]
): boolean => {
    if (!hasSourceOwnedPlacement(layout, widget, definitions)) return true
    if (hasUnavailableLayoutSource(layout) || hasUnresolvedLayoutSourceConflict(layout)) return false
    return policy?.active === true
}

const canOverrideRootOrder = (
    layout: ApplicationLayout,
    widget: ApplicationLayoutWidget,
    targetZone: ApplicationLayoutWidget['zone'],
    policy?: ApplicationPlacementOverridePolicy,
    definitions?: readonly LayoutWidgetDefinition[]
): boolean => {
    if (!hasSourceOwnedPlacement(layout, widget, definitions)) return isRootPlacement(widget, true)
    if (
        hasUnavailableLayoutSource(layout) ||
        hasUnresolvedLayoutSourceConflict(layout) ||
        targetZone !== widget.zone ||
        !isRootPlacement(widget)
    ) {
        return false
    }

    return policy?.order === 'root-only' || policy?.order === 'any'
}

const canResetSourcePresentation = (
    layout: ApplicationLayout,
    widget: ApplicationLayoutWidget,
    definitions?: readonly LayoutWidgetDefinition[]
): boolean => {
    if (
        !hasSourceOwnedPlacement(layout, widget, definitions) ||
        hasUnavailableLayoutSource(layout) ||
        hasUnresolvedLayoutSourceConflict(layout)
    ) {
        return false
    }

    return (
        getLayoutWidgetDefinition(widget.widgetKey, widget.config)?.authoring?.application?.resetToSource === true &&
        widget.sourceConfig != null &&
        widget.isCustomized === true
    )
}

const isApplicationOwnedWidget = (layout: ApplicationLayout, widget: ApplicationLayoutWidget): boolean => {
    if (widget.isCustomized === true) return true
    if (widgetHasSourceLineage(widget)) return false
    return isApplicationCustomizedLayoutWidget(layout)
}

/**
 * Widgets only carry a lineage badge when there is an actual provenance signal:
 * a metahub-derived layout, a real sync lineage value on the widget, or an
 * explicit customization marker. The API materializes lineage columns as
 * `null` for application-authored widgets, so nullish checks are required;
 * `undefined` checks would badge every widget.
 */
const hasWidgetProvenance = (layout: ApplicationLayout, widget: ApplicationLayoutWidget): boolean =>
    layout.sourceKind === 'metahub' || widget.isCustomized === true || widgetHasSourceLineage(widget)

const LAYOUT_ZONES_BY_TEMPLATE: Readonly<Record<ApplicationTemplateKey, readonly ApplicationLayoutZone[]>> = {
    dashboard: DASHBOARD_LAYOUT_ZONES,
    'marketing-page': MARKETING_LAYOUT_ZONES
}

const isMarketingWidgetKey = (value: ApplicationLayoutWidgetKey): value is keyof typeof MARKETING_WIDGET_REGISTRY =>
    Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, value)

const readWidgetPlacement = (widget: ApplicationLayoutWidget): 'start' | 'end' | undefined => {
    const placement = widget.placement
    if (placement === 'start' || placement === 'end') return placement
    return getLayoutWidgetDefinition(widget.widgetKey)?.defaultPlacement
}

const getWidgetDropIndex = (
    items: readonly ApplicationLayoutWidget[],
    movingWidgetId: string,
    placement?: LayoutLogicalPlacement,
    overWidgetId?: string
): number => {
    const movingIndex = items.findIndex((item) => item.id === movingWidgetId)
    const movingItem = movingIndex >= 0 ? items[movingIndex] : undefined
    if (placement && movingItem && readWidgetPlacement(movingItem) !== placement) {
        // Start/end is semantic header placement. Preserve the physical order
        // when crossing that boundary so immutable source siblings do not need
        // incidental sort-order rewrites.
        return movingIndex
    }
    const remainingItems = items.filter((item) => item.id !== movingWidgetId)
    if (overWidgetId) {
        const overIndex = remainingItems.findIndex((item) => item.id === overWidgetId)
        return overIndex >= 0 ? overIndex : remainingItems.length
    }
    if (placement === 'start') return remainingItems.filter((item) => readWidgetPlacement(item) === 'start').length
    return remainingItems.length
}

type LayoutZoneSettingState = {
    value: LayoutPosition
    inherited: boolean
    customized: boolean
    available: boolean
}

const marketingHeaderSettingDefinition = getLayoutZoneSettingDefinition('marketing-page', 'marketing-header', 'position')

const buildMarketingHeaderDialogSettings = (t: (key: string, fallback: string) => string) =>
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

const readMarketingHeaderPosition = (layout: ApplicationLayout): LayoutZoneSettingState => {
    if (!marketingHeaderSettingDefinition) return { value: 'fixed', inherited: true, customized: false, available: false }
    const localHeader = layout.neutral?.zoneSettings?.['marketing-header']
    const sourceHeader = layout.neutral?.sourceZoneSettings?.['marketing-header']
    const settingKey = marketingHeaderSettingDefinition.key
    const localPosition = localHeader?.[settingKey]
    const sourcePosition = sourceHeader?.[settingKey]
    const isSupportedPosition = (value: unknown): value is LayoutPosition =>
        typeof value === 'string' && marketingHeaderSettingDefinition.options.includes(value)
    const hasInvalidValue =
        (localPosition !== undefined && !isSupportedPosition(localPosition)) ||
        (sourcePosition !== undefined && !isSupportedPosition(sourcePosition))
    const value = isSupportedPosition(localPosition)
        ? localPosition
        : isSupportedPosition(sourcePosition)
        ? sourcePosition
        : (marketingHeaderSettingDefinition.defaultValue as LayoutPosition)
    return {
        value,
        inherited: localPosition === undefined,
        customized: localPosition !== undefined,
        available: !hasInvalidValue
    }
}

const patchMarketingHeaderPosition = (layout: ApplicationLayout, value: string): ApplicationLayout => {
    const settingKey = marketingHeaderSettingDefinition?.key
    if (!settingKey) return layout
    const existingZoneSettings = { ...(layout.neutral?.zoneSettings ?? {}) }
    return {
        ...layout,
        neutral: {
            ...(layout.neutral ?? {}),
            zoneSettings: {
                ...existingZoneSettings,
                'marketing-header': { ...(existingZoneSettings['marketing-header'] ?? {}), [settingKey]: value }
            }
        }
    }
}

const resetMarketingHeaderPosition = (layout: ApplicationLayout): ApplicationLayout => {
    const settingKey = marketingHeaderSettingDefinition?.key
    if (!settingKey) return layout
    const zoneSettings = { ...(layout.neutral?.zoneSettings ?? {}) }
    const headerSettings = zoneSettings['marketing-header']
    if (headerSettings && typeof headerSettings === 'object') {
        const { [settingKey]: _settingValue, ...remaining } = headerSettings
        if (Object.keys(remaining).length > 0) zoneSettings['marketing-header'] = remaining
        else delete zoneSettings['marketing-header']
    }
    const nextNeutral = { ...(layout.neutral ?? {}) }
    if (Object.keys(zoneSettings).length > 0) nextNeutral.zoneSettings = zoneSettings
    else delete nextNeutral.zoneSettings
    return { ...layout, neutral: nextNeutral }
}

type WidgetPresentationEditorState = {
    open: boolean
    zone: ApplicationLayoutZone | null
    widgetId: string | null
    widgetKey: ApplicationLayoutWidgetKey | null
    config: Record<string, unknown> | null
}

const normalizeEditableSideMenuConfig = (value: unknown): DashboardSideMenuConfig => {
    return normalizeSideMenuConfig(value)
}

type LayoutMenuState = {
    anchorEl: HTMLElement | null
    layout: ApplicationLayout | null
}

export {
    resolveLocalizedText,
    buildInitialWidgetConfig,
    isApplicationCustomizedLayoutWidget,
    widgetHasSourceLineage,
    getApplicationWidgetSourcePolicy,
    getApplicationWidgetAuthoringPolicy,
    getApplicationWidgetPresentationFields,
    getApplicationWidgetPresentationConfigFields,
    hasSourceOwnedPlacement,
    hasUnavailableLayoutSource,
    hasUnresolvedLayoutSourceConflict,
    isRootPlacement,
    getApplicationPlacementOverridePolicy,
    canEditSourcePresentation,
    canUpdateSourcePresentation,
    canOverrideActive,
    canOverrideRootOrder,
    canResetSourcePresentation,
    isApplicationOwnedWidget,
    hasWidgetProvenance,
    LAYOUT_ZONES_BY_TEMPLATE,
    isMarketingWidgetKey,
    readWidgetPlacement,
    getWidgetDropIndex,
    marketingHeaderSettingDefinition,
    buildMarketingHeaderDialogSettings,
    readMarketingHeaderPosition,
    patchMarketingHeaderPosition,
    resetMarketingHeaderPosition,
    normalizeEditableSideMenuConfig
}

export type { WidgetPresentationEditorState, LayoutMenuState }
