import {
    getLayoutWidgetDefinition,
    getMarketingSectionAnchorEntries,
    MARKETING_HEADER_WIDGET_KEYS,
    MARKETING_WIDGET_REGISTRY,
    marketingPageConfigSchema,
    marketingHeaderPositionSchema,
    marketingSemanticKeySchema,
    publicMarketingApplicationRuntimeSchema,
    publicMarketingPageRuntimeViewModelSchema,
    resolveLayoutZoneSettingValue,
    type MarketingHeaderWidgetKey,
    type MarketingPageConfig,
    type PublicMarketingApplicationRuntime
} from '@universo-react/types'
import { asMarketingRecord } from './marketingRuntimeSerialization'
import type { EffectiveLayoutSuccess } from './effectiveLayoutContract'
import { getApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'
import { projectMarketingWidgetBindingData } from './marketingWidgetEntityBinding'
import { PublicMarketingMaterializationError, type PublicMarketingBindingRecordLoader } from '../persistence/publicApplicationRuntimeStore'
import type { ApplicationPublicRouteResolution } from '@universo-react/types'

type PublicRecord = Record<string, unknown>

const asRecord = asMarketingRecord
const isRecord = (value: unknown): value is PublicRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const toPublicConfig = (value: unknown): MarketingPageConfig => {
    const raw = asRecord(value)
    const candidate = {
        themeMode: raw.themeMode,
        ...(typeof raw.primaryColor === 'string' ? { primaryColor: raw.primaryColor } : {}),
        ...(typeof raw.accentColor === 'string' ? { accentColor: raw.accentColor } : {}),
        allowEmailActions: raw.allowEmailActions,
        allowTelephoneActions: raw.allowTelephoneActions,
        externalLinkTarget: raw.externalLinkTarget
    }
    const parsed = marketingPageConfigSchema.safeParse(candidate)
    if (!parsed.success) throw new PublicMarketingMaterializationError('Public marketing layout config is invalid')
    return parsed.data
}

const publicWidgetInstanceKey = (widgetKey: string, index: number): string =>
    `marketing-${widgetKey.replace(/^marketing\./u, '').toLowerCase()}-${index}`

const PERSISTED_WIDGET_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const UUID_SUBSTRING_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu

const resolvePublicWidgetInstanceKey = (widgetKey: string, config: PublicRecord, index: number, usedInstanceKeys: Set<string>): string => {
    const persisted = typeof config.instanceKey === 'string' ? config.instanceKey.trim() : ''
    const persistedIsSemantic =
        Boolean(persisted) &&
        !PERSISTED_WIDGET_UUID_PATTERN.test(persisted) &&
        !UUID_SUBSTRING_PATTERN.test(persisted) &&
        marketingSemanticKeySchema.safeParse(persisted).success

    let candidate = persistedIsSemantic ? persisted : publicWidgetInstanceKey(widgetKey, index)
    if (usedInstanceKeys.has(candidate)) {
        let disambiguator = 0
        do {
            disambiguator += 1
            candidate = publicWidgetInstanceKey(widgetKey, index + disambiguator)
        } while (usedInstanceKeys.has(candidate))
    }
    usedInstanceKeys.add(candidate)
    return candidate
}

const remapPublicActionAnchors = (
    value: unknown,
    publicHrefBySourceAnchor: ReadonlyMap<string, string>,
    unavailablePublicAnchorHref: string
): unknown => {
    if (Array.isArray(value))
        return value.map((item) => remapPublicActionAnchors(item, publicHrefBySourceAnchor, unavailablePublicAnchorHref))
    if (!isRecord(value)) return value

    if (value.kind === 'anchor' && typeof value.href === 'string' && value.href.startsWith('#')) {
        const publicHref = publicHrefBySourceAnchor.get(value.href.slice(1))
        if (publicHref) return { ...value, href: publicHref }
        if (UUID_SUBSTRING_PATTERN.test(value.href.slice(1))) return { ...value, href: unavailablePublicAnchorHref }
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [
            key,
            remapPublicActionAnchors(nested, publicHrefBySourceAnchor, unavailablePublicAnchorHref)
        ])
    )
}

const readMaxItems = (value: unknown, fallback: number, maximum: number): number => {
    const parsed = Math.trunc(Number.isFinite(Number(value)) ? Number(value) : fallback)
    return Math.max(1, Math.min(maximum, parsed))
}

const publicWidgetConfig = (widgetKey: string, config: PublicRecord, instanceKey: string): PublicRecord => {
    switch (widgetKey) {
        case 'marketing.brand':
            return { instanceKey }
        case 'marketing.auth':
            return { instanceKey, showAuthActions: config.showAuthActions !== false }
        case 'marketing.navigation':
            return {
                instanceKey,
                maxItems: readMaxItems(config.maxItems, 24, 100)
            }
        case 'marketing.hero':
            return { instanceKey, showLeadForm: config.showLeadForm !== false }
        case 'marketing.image':
            return { instanceKey }
        case 'marketing.collection': {
            if (typeof config.variant !== 'string') {
                throw new PublicMarketingMaterializationError('Public marketing collection variant is invalid')
            }
            const maxItems = readMaxItems(config.maxItems, 100, 100)
            return {
                instanceKey,
                variant: config.variant,
                maxItems,
                showTitle: config.showTitle !== false,
                showDescription: config.showDescription !== false,
                showItemDescriptions: config.showItemDescriptions !== false,
                fixedItemsHeight: config.fixedItemsHeight === true
            }
        }
        case 'marketing.pricing':
            return {
                instanceKey,
                maxItems: readMaxItems(config.maxItems, 24, 100),
                showBenefits: config.showBenefits !== false,
                cardStyle: config.cardStyle === 'uniform' ? 'uniform' : 'featured',
                cardWidth: config.cardWidth === 'full' ? 'full' : 'auto'
            }
        case 'marketing.footer':
            return {
                instanceKey,
                maxItems: readMaxItems(config.maxItems, 100, 100),
                showNewsletter: config.showNewsletter !== false
            }
        default:
            throw new PublicMarketingMaterializationError('Public marketing widget is unsupported')
    }
}

export interface SerializePublicMarketingRuntimeInput {
    route: ApplicationPublicRouteResolution
    locale: 'en' | 'ru'
    effectiveLayout: EffectiveLayoutSuccess
    loadRecords: PublicMarketingBindingRecordLoader
}

/** Serialize registry-bound content into the anonymous renderer contract. */
export const serializePublicMarketingRuntime = async ({
    route,
    locale,
    effectiveLayout,
    loadRecords
}: SerializePublicMarketingRuntimeInput): Promise<PublicMarketingApplicationRuntime> => {
    if (effectiveLayout.layout.templateKey !== 'marketing-page') {
        throw new PublicMarketingMaterializationError('Public application template is not marketing-page')
    }

    const runtimeConfig = toPublicConfig(effectiveLayout.layout.config)
    const headerPosition = marketingHeaderPositionSchema.safeParse(
        resolveLayoutZoneSettingValue('marketing-page', 'marketing-header', 'position', effectiveLayout.layout.zoneSettings)
    )
    if (!headerPosition.success) {
        throw new PublicMarketingMaterializationError('Public marketing header position is invalid')
    }
    const publicWidgetIdentities: Array<{ widget: EffectiveLayoutSuccess['widgets'][number]; instanceKey: string }> = []
    const usedPublicInstanceKeys = new Set<string>()
    let publicWidgetIndex = 0
    for (const widget of effectiveLayout.widgets) {
        const config = asRecord(widget.config)
        const definition = getLayoutWidgetDefinition(widget.widgetKey, config)
        if (definition?.shared || !widget.isActive) continue
        const instanceKey = resolvePublicWidgetInstanceKey(widget.widgetKey, config, publicWidgetIndex, usedPublicInstanceKeys)
        publicWidgetIndex += 1
        publicWidgetIdentities.push({ widget, instanceKey })
    }

    const sourceAnchorEntries = getMarketingSectionAnchorEntries(
        publicWidgetIdentities.map(({ widget, instanceKey }) => {
            const config = asRecord(widget.config)
            const sourceInstanceKey = typeof config.instanceKey === 'string' && config.instanceKey.trim() ? config.instanceKey : instanceKey
            return { widgetKey: widget.widgetKey, isActive: true, config: { ...config, instanceKey: sourceInstanceKey } }
        })
    )
    const publicAnchorEntries = getMarketingSectionAnchorEntries(
        publicWidgetIdentities.map(({ widget, instanceKey }) => ({
            widgetKey: widget.widgetKey,
            isActive: true,
            config: { ...asRecord(widget.config), instanceKey }
        }))
    )
    if (sourceAnchorEntries.length !== publicAnchorEntries.length) {
        throw new PublicMarketingMaterializationError('Public marketing section anchors could not be resolved')
    }
    const publicHrefBySourceAnchor = new Map<string, string>()
    for (let index = 0; index < sourceAnchorEntries.length; index += 1) {
        const sourceEntry = sourceAnchorEntries[index]
        const publicEntry = publicAnchorEntries[index]
        if (sourceEntry && publicEntry && !publicHrefBySourceAnchor.has(sourceEntry[0])) {
            publicHrefBySourceAnchor.set(sourceEntry[0], `#${publicEntry[0]}`)
        }
    }
    const publicAnchorNames = new Set(publicAnchorEntries.map(([anchor]) => anchor))
    let unavailablePublicAnchorIndex = 0
    while (publicAnchorNames.has(`unavailable-public-section-${unavailablePublicAnchorIndex}`)) unavailablePublicAnchorIndex += 1
    const unavailablePublicAnchorHref = `#unavailable-public-section-${unavailablePublicAnchorIndex}`

    const publicWidgets: PublicRecord[] = []
    const resolvedKeysByWidgetKey = new Map<string, string[]>()
    for (const widget of effectiveLayout.widgets) {
        if (!widget.isActive) continue
        const config = asRecord(widget.config)
        const definition = getLayoutWidgetDefinition(widget.widgetKey, config)
        if (definition?.shared) continue

        const registryEntry = MARKETING_WIDGET_REGISTRY[widget.widgetKey as keyof typeof MARKETING_WIDGET_REGISTRY]
        if (!registryEntry || !registryEntry.allowedZones.includes(widget.zone as never)) {
            throw new PublicMarketingMaterializationError('Public marketing widget placement is invalid')
        }
        if (registryEntry.dataOwnership === 'entity' && !definition?.bindingSlots?.length) {
            throw new PublicMarketingMaterializationError('Published marketing widget has no registered Entity binding')
        }

        const instanceKey = publicWidgetIdentities.find((identity) => identity.widget === widget)?.instanceKey
        if (!instanceKey) throw new PublicMarketingMaterializationError('Public marketing widget identity is invalid')

        let widgetData: unknown = { records: [] }
        if (definition?.bindingSlots?.length) {
            try {
                widgetData = await projectMarketingWidgetBindingData({
                    widgetKey: widget.widgetKey,
                    rendererConfig: config,
                    bindings: getApplicationLayoutWidgetSourceBindingState(widget)?.bindings,
                    loadRecords: (query) => loadRecords({ widgetKey: widget.widgetKey, rendererConfig: config, query }),
                    config: runtimeConfig
                })
            } catch {
                throw new PublicMarketingMaterializationError('Published marketing widget Entity binding is unavailable')
            }
            if (!widgetData) {
                throw new PublicMarketingMaterializationError('Published marketing widget Entity binding is unavailable')
            }
            // Keep incomplete optional Image records out of the strict public Image DTO.
            if (
                widget.widgetKey === 'marketing.image' &&
                isRecord(widgetData) &&
                Array.isArray(widgetData.records) &&
                widgetData.records.length === 0
            ) {
                continue
            }
        }

        const publicConfig = publicWidgetConfig(widget.widgetKey, config, instanceKey)
        const data = remapPublicActionAnchors(widgetData, publicHrefBySourceAnchor, unavailablePublicAnchorHref)
        publicWidgets.push({
            instanceKey,
            zone: widget.zone,
            widgetKey: widget.widgetKey,
            sortOrder: widget.sortOrder,
            isActive: true,
            config: publicConfig,
            data: data as PublicRecord
        })
        resolvedKeysByWidgetKey.set(widget.widgetKey, [...(resolvedKeysByWidgetKey.get(widget.widgetKey) ?? []), instanceKey])
    }

    const publicHeaderWidgets: PublicRecord[] = []
    const usedHeaderInstanceKeys = new Set<string>()
    const pendingResolvedKeys = new Map(resolvedKeysByWidgetKey)
    for (const widget of effectiveLayout.widgets) {
        if (widget.zone !== 'marketing-header' || !(MARKETING_HEADER_WIDGET_KEYS as readonly string[]).includes(widget.widgetKey)) continue
        if (!widget.isActive) continue

        const config = asRecord(widget.config)
        const queuedKeys = pendingResolvedKeys.get(widget.widgetKey) ?? []
        const [nextResolvedKey, ...remainingKeys] = queuedKeys
        pendingResolvedKeys.set(widget.widgetKey, remainingKeys)
        const instanceKey =
            nextResolvedKey ?? resolvePublicWidgetInstanceKey(widget.widgetKey, config, publicHeaderWidgets.length, usedHeaderInstanceKeys)
        usedHeaderInstanceKeys.add(instanceKey)
        const placement = widget.placement === 'start' || widget.placement === 'end' ? widget.placement : undefined
        publicHeaderWidgets.push({
            widgetKey: widget.widgetKey as MarketingHeaderWidgetKey,
            instanceKey,
            zone: 'marketing-header',
            sortOrder: widget.sortOrder,
            isActive: true,
            ...(placement ? { placement } : {}),
            config: {
                instanceKey,
                ...(widget.widgetKey === 'marketing.auth' ? { showAuthActions: config.showAuthActions !== false } : {})
            }
        })
    }

    if (effectiveLayout.scope === 'global' && publicWidgets.length === 0) {
        throw new PublicMarketingMaterializationError('Published marketing page has no active widget composition')
    }

    const parsedViewModel = publicMarketingPageRuntimeViewModelSchema.safeParse({
        templateKey: 'marketing-page',
        marketingPage: {
            templateKey: 'marketing-page',
            locale,
            config: runtimeConfig,
            headerPosition: headerPosition.data,
            widgets: publicWidgets,
            headerWidgets: publicHeaderWidgets
        }
    })
    if (!parsedViewModel.success) throw new PublicMarketingMaterializationError('Public marketing runtime DTO is invalid')

    const { applicationId: _applicationId, ...publicRoute } = route
    const parsedRuntime = publicMarketingApplicationRuntimeSchema.safeParse({
        route: publicRoute,
        templateKey: parsedViewModel.data.templateKey,
        marketingPage: parsedViewModel.data.marketingPage
    })
    if (!parsedRuntime.success) throw new PublicMarketingMaterializationError('Public marketing runtime DTO is invalid')
    return parsedRuntime.data
}
