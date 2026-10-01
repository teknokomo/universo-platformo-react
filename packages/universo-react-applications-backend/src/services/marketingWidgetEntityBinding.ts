import {
    getLayoutWidgetDefinition,
    isCompatibleWidgetBindingEntity,
    marketingActionSchema,
    marketingHeroEntityContentSchema,
    marketingHeroWidgetDataSchema,
    marketingSemanticKeySchema,
    marketingWidgetDataSchema,
    publicMarketingMediaSchema,
    type MarketingAction,
    type MarketingPageConfig,
    type PublicMarketingMedia,
    type PublicMarketingPageRecord
} from '@universo-react/types'
import { parseMarketingActionHref, toLocalizedStringMap } from '@universo-react/utils'
import { getVLCString } from '@universo-react/utils/vlc'
import { asMarketingNumber, asMarketingRecord, asMarketingString, toMarketingLocalizedNumericMap } from './marketingRuntimeSerialization'
import {
    resolveWidgetBindingTargets,
    WidgetBindingResolutionError,
    type ResolvedWidgetBindingTarget,
    type WidgetBindingRecordLoader
} from './widgetBindingResolver'

type RuntimeRecord = Record<string, unknown>
type BindingWidgetData = { records: PublicMarketingPageRecord[] } | ReturnType<typeof marketingHeroWidgetDataSchema.parse>

const asRecord = (value: unknown): RuntimeRecord => asMarketingRecord(value)
const optionalLocalized = (value: unknown): Record<string, string> | undefined => toLocalizedStringMap(value)
const requiredLocalized = (value: unknown): Record<string, string> => {
    const result = optionalLocalized(value)
    if (!result) throw new Error('MARKETING_WIDGET_CONTENT_INVALID')
    return result
}

const boundedNumber = (value: unknown, fallback: number, maximum = 10000): number =>
    Math.max(0, Math.min(maximum, Math.trunc(asMarketingNumber(value, fallback))))

const applyActionPolicy = (action: MarketingAction, config: MarketingPageConfig): MarketingAction => {
    if (action.kind === 'email' && !config.allowEmailActions) throw new Error('MARKETING_ACTION_DISABLED')
    if (action.kind === 'tel' && !config.allowTelephoneActions) throw new Error('MARKETING_ACTION_DISABLED')
    return action.kind === 'external' ? { ...action, target: config.externalLinkTarget } : action
}

const safeCanonicalAction = (value: unknown, config: MarketingPageConfig): MarketingAction | undefined => {
    const parsed = marketingActionSchema.safeParse(value)
    if (!parsed.success) return undefined
    try {
        return applyActionPolicy(parsed.data, config)
    } catch {
        return undefined
    }
}

const safeHrefAction = (value: unknown, config: MarketingPageConfig): MarketingAction | undefined => {
    if (typeof value !== 'string') return undefined
    const action = parseMarketingActionHref(value, { externalTarget: config.externalLinkTarget })
    if (!action) return undefined
    try {
        return applyActionPolicy(action, config)
    } catch {
        return undefined
    }
}

const requiredHrefAction = (value: unknown, config: MarketingPageConfig): MarketingAction => {
    const action = safeHrefAction(value, config)
    if (!action) throw new Error('MARKETING_WIDGET_ACTION_INVALID')
    return action
}

const optionalMarketingIconKey = (value: unknown): string | undefined => {
    const normalized = asMarketingString(value).trim().toLowerCase()
    return normalized && marketingSemanticKeySchema.safeParse(normalized).success ? normalized : undefined
}

const toEntityMedia = (
    value: unknown,
    kind: PublicMarketingMedia['kind'],
    alt?: unknown,
    options: { decorative?: boolean; width?: unknown; height?: unknown } = {}
): PublicMarketingMedia | undefined => {
    const media = asRecord(value)
    const resourceValue = media.resource ?? value
    const resource = asRecord(resourceValue)
    if (resource.type !== 'url' || typeof resource.url !== 'string') return undefined
    const altText = optionalLocalized(alt ?? media.alt)
    const decorative = options.decorative ?? media.decorative === true
    const parsed = publicMarketingMediaSchema.safeParse({
        kind,
        resource: {
            type: 'url',
            url: resource.url,
            launchMode: resource.launchMode === 'newTab' || resource.launchMode === 'download' ? resource.launchMode : 'inline'
        },
        ...(decorative ? { decorative: true } : altText ? { alt: altText, decorative: false } : {}),
        ...(Number.isInteger(options.width ?? media.width) && Number(options.width ?? media.width) > 0
            ? { width: Number(options.width ?? media.width) }
            : {}),
        ...(Number.isInteger(options.height ?? media.height) && Number(options.height ?? media.height) > 0
            ? { height: Number(options.height ?? media.height) }
            : {})
    })
    return parsed.success ? parsed.data : undefined
}

const commonRecord = (target: ResolvedWidgetBindingTarget, order = 0) => ({
    semanticKey: target.semanticKey,
    order: boundedNumber(target.data.order, order),
    isVisible: target.data.visible !== false
})

const sectionRecord = (target: ResolvedWidgetBindingTarget): PublicMarketingPageRecord => ({
    ...commonRecord(target),
    kind: 'sectionCopy',
    sectionKey: asMarketingString(target.data.key) || target.semanticKey,
    title: requiredLocalized(target.data.title),
    ...(optionalLocalized(target.data.description) ? { description: optionalLocalized(target.data.description) } : {})
})

const siteSettingsRecord = (
    target: ResolvedWidgetBindingTarget,
    config: MarketingPageConfig,
    includeFooter: boolean,
    includeNewsletter = true
): PublicMarketingPageRecord => {
    const data = target.data
    const brandName = requiredLocalized(data.brandName)
    const brandLogo = toEntityMedia(data.brandLogo, 'logo', brandName)
    const footerDescription = optionalLocalized(data.footerDescription)
    const copyright = optionalLocalized(data.copyrightText)
    const copyrightLabel = optionalLocalized(data.copyrightLabel)
    const copyrightAction = safeHrefAction(data.copyrightHref, config)
    const newsletterEnabled = data.newsletterEnabled === true
    const newsletterTitle = optionalLocalized(data.newsletterTitle)
    const newsletterDescription = optionalLocalized(data.newsletterDescription)
    const newsletterLabel = optionalLocalized(data.newsletterLabel)
    const newsletterPlaceholder = optionalLocalized(data.newsletterPlaceholder)
    const newsletterActionLabel = optionalLocalized(data.newsletterActionLabel)
    const newsletterSuccessMessage = optionalLocalized(data.newsletterSuccessMessage)
    const newsletterErrorMessage = optionalLocalized(data.newsletterErrorMessage)
    const newsletterAction = safeHrefAction(data.newsletterActionHref, config)
    const newsletter =
        includeFooter &&
        includeNewsletter &&
        newsletterEnabled &&
        newsletterTitle &&
        hasLocalizedValue(newsletterLabel) &&
        hasLocalizedValue(newsletterPlaceholder) &&
        hasLocalizedValue(newsletterActionLabel) &&
        newsletterSuccessMessage &&
        newsletterErrorMessage
            ? {
                  title: newsletterTitle,
                  ...(newsletterDescription ? { description: newsletterDescription } : {}),
                  emailLabel: newsletterLabel,
                  emailPlaceholder: newsletterPlaceholder,
                  submitLabel: newsletterActionLabel,
                  successMessage: newsletterSuccessMessage,
                  errorMessage: newsletterErrorMessage,
                  ...(newsletterAction ? { action: newsletterAction } : {})
              }
            : undefined

    return {
        ...commonRecord(target),
        kind: 'siteSettings',
        brandName,
        ...(brandLogo ? { brandLogo } : {}),
        ...(includeFooter && footerDescription ? { footerDescription } : {}),
        ...(includeFooter && copyright ? { copyright } : {}),
        ...(includeFooter && copyrightLabel ? { copyrightLabel } : {}),
        ...(includeFooter && copyrightLabel && copyrightAction
            ? { copyrightAction: { label: copyrightLabel, action: copyrightAction } }
            : {}),
        ...(newsletter ? { newsletter } : {})
    }
}

const hasLocalizedValue = (value: Record<string, string> | undefined): value is Record<string, string> =>
    Boolean(value && Object.values(value).some((localized) => localized.trim().length > 0))

const requireSingleSlotTarget = (targets: readonly ResolvedWidgetBindingTarget[], slot: string): ResolvedWidgetBindingTarget => {
    const matching = targets.filter((target) => target.slot === slot)
    if (matching.length !== 1) throw new Error('MARKETING_WIDGET_BINDING_INVALID')
    return matching[0]!
}

const targetsForSlot = (targets: readonly ResolvedWidgetBindingTarget[], slot: string): ResolvedWidgetBindingTarget[] =>
    targets.filter((target) => target.slot === slot)

const adaptRecords = (
    widgetKey: string,
    targets: readonly ResolvedWidgetBindingTarget[],
    rendererConfig: RuntimeRecord,
    config: MarketingPageConfig
): PublicMarketingPageRecord[] => {
    if (widgetKey === 'marketing.brand') return [siteSettingsRecord(requireSingleSlotTarget(targets, 'site'), config, false)]
    if (widgetKey === 'marketing.navigation') {
        return targetsForSlot(targets, 'items')
            .slice(0, Math.max(1, Math.min(100, boundedNumber(rendererConfig.maxItems, 24, 100))))
            .map((target) => ({
                ...commonRecord(target),
                kind: 'navigationLink',
                label: requiredLocalized(target.data.label),
                action: requiredHrefAction(target.data.href, config)
            }))
    }
    if (widgetKey === 'marketing.image') {
        const target = requireSingleSlotTarget(targets, 'content')
        // An empty optional ResourceSource is a valid draft record, but cannot produce public image content.
        if (target.data.resource === undefined || target.data.resource === null) return []
        const media = toEntityMedia(target.data.resource, 'hero', target.data.altText, {
            decorative: target.data.decorative === true,
            width: target.data.width,
            height: target.data.height
        })
        if (!media) throw new Error('MARKETING_WIDGET_MEDIA_INVALID')
        return [{ ...commonRecord(target), kind: 'image', media }]
    }
    if (widgetKey === 'marketing.collection') {
        const variant = rendererConfig.variant
        const section = sectionRecord(requireSingleSlotTarget(targets, 'section'))
        const itemTargets = targetsForSlot(targets, 'items').slice(
            0,
            Math.max(1, Math.min(100, boundedNumber(rendererConfig.maxItems, 100, 100)))
        )
        const records: PublicMarketingPageRecord[] = [section]
        if (variant === 'logos') {
            records.push(
                ...itemTargets.map((target) => {
                    const media = toEntityMedia(target.data.imageLight, 'logo', target.data.altText)
                    const darkMedia = toEntityMedia(target.data.imageDark, 'logo', target.data.altText)
                    return {
                        ...commonRecord(target),
                        kind: 'logo' as const,
                        name: requiredLocalized(target.data.altText),
                        ...(media ? { media } : {}),
                        ...(darkMedia ? { darkMedia } : {})
                    }
                })
            )
        } else if (variant === 'features') {
            records.push(
                ...itemTargets.map((target) => {
                    const iconKey = optionalMarketingIconKey(target.data.iconKey)
                    const lightMedia = toEntityMedia(target.data.imageLight, 'feature', target.data.title)
                    const darkMedia = toEntityMedia(target.data.imageDark, 'feature', target.data.title)
                    return {
                        ...commonRecord(target),
                        kind: 'feature' as const,
                        title: requiredLocalized(target.data.title),
                        description: requiredLocalized(target.data.description),
                        ...(iconKey ? { iconKey } : {}),
                        ...(lightMedia ? { lightMedia } : {}),
                        ...(darkMedia ? { darkMedia } : {})
                    }
                })
            )
        } else if (variant === 'testimonials') {
            records.push(
                ...itemTargets.map((target) => {
                    const name = requiredLocalized(target.data.name)
                    const avatar = toEntityMedia(target.data.avatar, 'avatar', name)
                    const logo = toEntityMedia(target.data.logoLight, 'logo', name)
                    const darkLogo = toEntityMedia(target.data.logoDark, 'logo', name)
                    return {
                        ...commonRecord(target),
                        kind: 'testimonial' as const,
                        quote: requiredLocalized(target.data.quote),
                        author: name,
                        ...(optionalLocalized(target.data.occupation) ? { company: optionalLocalized(target.data.occupation) } : {}),
                        ...(avatar ? { avatar } : {}),
                        ...(logo ? { logo } : {}),
                        ...(darkLogo ? { darkLogo } : {})
                    }
                })
            )
        } else if (variant === 'highlights') {
            records.push(
                ...itemTargets.map((target) => {
                    const iconKey = optionalMarketingIconKey(target.data.iconKey)
                    return {
                        ...commonRecord(target),
                        kind: 'highlight' as const,
                        title: requiredLocalized(target.data.title),
                        description: requiredLocalized(target.data.description),
                        ...(iconKey ? { iconKey } : {})
                    }
                })
            )
        } else if (variant === 'faq') {
            records.push(
                ...itemTargets.map((target) => ({
                    ...commonRecord(target),
                    kind: 'faq' as const,
                    question: requiredLocalized(target.data.question),
                    answer: requiredLocalized(target.data.answer)
                }))
            )
        } else {
            throw new Error('MARKETING_WIDGET_VARIANT_INVALID')
        }
        return records
    }
    if (widgetKey === 'marketing.pricing') {
        const section = sectionRecord(requireSingleSlotTarget(targets, 'section'))
        const maxItems = Math.max(1, Math.min(100, boundedNumber(rendererConfig.maxItems, 24, 100)))
        const tiers = targetsForSlot(targets, 'tiers').slice(0, maxItems)
        const includedTierKeys = new Set(tiers.map((tier) => tier.semanticKey))
        const benefitsByTier = new Map<string, ResolvedWidgetBindingTarget[]>()
        if (rendererConfig.showBenefits !== false) {
            for (const benefit of targetsForSlot(targets, 'benefits')) {
                const parentKey = benefit.parentSemanticKey
                if (!parentKey || !includedTierKeys.has(parentKey)) continue
                const parentBenefits = benefitsByTier.get(parentKey) ?? []
                parentBenefits.push(benefit)
                benefitsByTier.set(parentKey, parentBenefits)
            }
        }
        const benefits: PublicMarketingPageRecord[] = [...benefitsByTier.values()].flatMap((group) =>
            group.map((target) => ({
                ...commonRecord(target),
                kind: 'pricingBenefit' as const,
                label: requiredLocalized(target.data.label)
            }))
        )
        const tierRecords: PublicMarketingPageRecord[] = tiers.map((target) => {
            const action = safeHrefAction(target.data.actionHref, config)
            const actionLabel = optionalLocalized(target.data.actionLabel)
            return {
                ...commonRecord(target),
                kind: 'pricingTier' as const,
                title: requiredLocalized(target.data.title),
                ...(optionalLocalized(target.data.subheader) ? { description: optionalLocalized(target.data.subheader) } : {}),
                price: toMarketingLocalizedNumericMap(target.data.price, 'en', ''),
                ...(optionalLocalized(target.data.period) ? { period: optionalLocalized(target.data.period) } : {}),
                ...(action && actionLabel ? { action: { label: actionLabel, action } } : {}),
                benefitKeys: (benefitsByTier.get(target.semanticKey) ?? []).map(({ semanticKey }) => semanticKey),
                benefits: [],
                featured: target.data.featured === true
            }
        })
        return [section, ...tierRecords, ...benefits]
    }
    if (widgetKey === 'marketing.footer') {
        const site = siteSettingsRecord(requireSingleSlotTarget(targets, 'site'), config, true, rendererConfig.showNewsletter !== false)
        const links = targetsForSlot(targets, 'links')
            .slice(0, Math.max(1, Math.min(100, boundedNumber(rendererConfig.maxItems, 100, 100))))
            .map((target) => {
                const groupTitle = optionalLocalized(target.data.groupTitle)
                const secondaryLabel = optionalLocalized(target.data.bottomLabel)
                const iconKey = optionalMarketingIconKey(target.data.iconKey)
                return {
                    ...commonRecord(target),
                    kind: 'footerLink' as const,
                    groupKey: asMarketingString(target.data.groupKey),
                    ...(groupTitle ? { groupTitle } : {}),
                    label: requiredLocalized(target.data.label),
                    ...(secondaryLabel ? { secondaryLabel } : {}),
                    action: requiredHrefAction(target.data.href, config),
                    ...(iconKey ? { iconKey } : {})
                }
            })
        return [site, ...links]
    }
    throw new Error('MARKETING_WIDGET_BINDING_ADAPTER_UNAVAILABLE')
}

const resolveMarketingHeroEntityContent = (resolvedTargets: readonly ResolvedWidgetBindingTarget[], config: MarketingPageConfig) => {
    const resolved = requireSingleSlotTarget(resolvedTargets, 'content')
    const data = resolved.data
    const termsAction = safeCanonicalAction(data.termsAction, config)
    const candidate = {
        title: requiredLocalized(data.title),
        ...(optionalLocalized(data.accent) ? { accent: optionalLocalized(data.accent) } : {}),
        description: requiredLocalized(data.description),
        emailLabel: requiredLocalized(data.emailLabel),
        emailPlaceholder: requiredLocalized(data.emailPlaceholder),
        primaryActionLabel: requiredLocalized(data.primaryActionLabel),
        primaryAction: applyActionPolicy(marketingActionSchema.parse(data.primaryAction), config),
        ...(termsAction && optionalLocalized(data.termsText) && optionalLocalized(data.termsLinkLabel)
            ? {
                  termsText: optionalLocalized(data.termsText),
                  termsLinkLabel: optionalLocalized(data.termsLinkLabel),
                  termsAction
              }
            : {})
    }
    return marketingHeroEntityContentSchema.parse(candidate)
}

interface ProjectMarketingWidgetBindingDataInput {
    widgetKey: string
    bindings: unknown
    loadRecords: WidgetBindingRecordLoader
    config: MarketingPageConfig
    rendererConfig?: unknown
}

/** Resolve only registered Entity projections and adapt each widget into its strict renderer DTO. */
export const projectMarketingWidgetBindingData = async ({
    widgetKey,
    bindings,
    loadRecords,
    config,
    rendererConfig
}: ProjectMarketingWidgetBindingDataInput): Promise<BindingWidgetData | undefined> => {
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition?.bindingSlots?.length) return undefined

    let resolvedTargets: ResolvedWidgetBindingTarget[]
    try {
        resolvedTargets = await resolveWidgetBindingTargets(definition, bindings, (query) => {
            if (query.target.entityKind !== 'object') throw new WidgetBindingResolutionError('invalid-contract')
            return loadRecords(query)
        })
    } catch (error) {
        if (error instanceof WidgetBindingResolutionError) {
            throw new Error(`MARKETING_WIDGET_${error.reason === 'target-unavailable' ? 'BINDING_TARGET_UNAVAILABLE' : 'BINDING_INVALID'}`)
        }
        throw error
    }

    if (widgetKey === 'marketing.hero') {
        const heroContent = resolveMarketingHeroEntityContent(resolvedTargets, config)
        return marketingHeroWidgetDataSchema.parse({
            records: [{ kind: 'heroContent', semanticKey: 'content', order: 0, isVisible: true, content: heroContent }]
        })
    }

    const records = adaptRecords(widgetKey, resolvedTargets, asRecord(rendererConfig), config)
    return marketingWidgetDataSchema.parse({ records })
}

/** Generic capability and Component contract check used by authenticated and public runtime loaders. */
export const isCompatibleMarketingWidgetObject = (
    object: RuntimeRecord,
    components: readonly RuntimeRecord[],
    widgetKey: string,
    slotKey: string,
    rendererConfig?: unknown
): boolean => {
    const slot = getLayoutWidgetDefinition(widgetKey, rendererConfig)?.bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot || object.kind !== 'object') return false
    return isCompatibleWidgetBindingEntity(slot, {
        kind: 'object',
        config: object.config,
        components: components.map((component) => ({
            codename: getVLCString(component.codename as Parameters<typeof getVLCString>[0], 'en').trim(),
            dataType: String(component.data_type ?? component.dataType ?? ''),
            isRequired: (component.is_required ?? component.isRequired) === true,
            validationRules: component.validation_rules ?? component.validationRules
        }))
    })
}
