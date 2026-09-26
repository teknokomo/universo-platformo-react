/** Canonical public host paths shared by route registration and action validation. */
export const APPLICATION_HOST_ROUTE_PATHS = {
    home: '/',
    start: '/start',
    auth: '/auth',
    terms: '/terms',
    privacy: '/privacy'
} as const

/** Public routes that the marketing page may safely use as internal actions. */
export const MARKETING_ACTION_INTERNAL_ROUTES = [
    { path: APPLICATION_HOST_ROUTE_PATHS.home, labelKey: 'layouts.marketing.heroAuthoring.routes.home', defaultLabel: 'Home' },
    {
        path: APPLICATION_HOST_ROUTE_PATHS.auth,
        labelKey: 'layouts.marketing.heroAuthoring.routes.auth',
        defaultLabel: 'Sign in or create an account'
    },
    {
        path: APPLICATION_HOST_ROUTE_PATHS.terms,
        labelKey: 'layouts.marketing.heroAuthoring.routes.terms',
        defaultLabel: 'Terms and conditions'
    },
    {
        path: APPLICATION_HOST_ROUTE_PATHS.privacy,
        labelKey: 'layouts.marketing.heroAuthoring.routes.privacy',
        defaultLabel: 'Privacy policy'
    }
] as const

export const isKnownMarketingInternalRoute = (path: string): boolean =>
    MARKETING_ACTION_INTERNAL_ROUTES.some((route) => route.path === path)

export type MarketingActionSectionTarget = {
    href: string
    labelKey: string
    defaultLabel: string
    instanceNumber: number
    sectionId: string
}

export type MarketingSectionWidgetDescriptor = {
    widgetKey: string
    instanceKey?: string
    isActive?: boolean
    config?: unknown
    content?: unknown
}

type SectionDefinition = {
    sectionId: keyof typeof marketingSectionIds
    labelKey: string
    defaultLabel: string
    aliases: readonly string[]
}

const marketingSectionIds = {
    hero: 'hero',
    logoCollection: 'logoCollection',
    features: 'features',
    testimonials: 'testimonials',
    highlights: 'highlights',
    pricing: 'pricing',
    faq: 'faq',
    footer: 'footer'
} as const

const canonicalInstanceKeys: Readonly<Record<keyof typeof marketingSectionIds, string>> = {
    hero: 'hero',
    logoCollection: 'logos',
    features: 'features',
    testimonials: 'testimonials',
    highlights: 'highlights',
    pricing: 'pricing',
    faq: 'faq',
    footer: 'footer'
}

const readRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const sectionDefinition = (widget: MarketingSectionWidgetDescriptor): SectionDefinition | null => {
    switch (widget.widgetKey) {
        case 'marketing.hero':
            return {
                sectionId: 'hero',
                labelKey: 'layouts.marketing.heroAuthoring.sections.hero',
                defaultLabel: 'Hero',
                aliases: ['hero']
            }
        case 'marketing.collection': {
            const content = readRecord(widget.content)
            const config = readRecord(widget.config)
            const variant = content.variant ?? config.variant
            switch (variant) {
                case 'logos':
                    return {
                        sectionId: 'logoCollection',
                        labelKey: 'layouts.marketing.heroAuthoring.sections.logos',
                        defaultLabel: 'Logos',
                        aliases: ['logos', 'logoCollection']
                    }
                case 'features':
                    return {
                        sectionId: 'features',
                        labelKey: 'layouts.marketing.heroAuthoring.sections.features',
                        defaultLabel: 'Features',
                        aliases: ['features']
                    }
                case 'testimonials':
                    return {
                        sectionId: 'testimonials',
                        labelKey: 'layouts.marketing.heroAuthoring.sections.testimonials',
                        defaultLabel: 'Testimonials',
                        aliases: ['testimonials']
                    }
                case 'highlights':
                    return {
                        sectionId: 'highlights',
                        labelKey: 'layouts.marketing.heroAuthoring.sections.highlights',
                        defaultLabel: 'Highlights',
                        aliases: ['highlights']
                    }
                case 'faq':
                    return {
                        sectionId: 'faq',
                        labelKey: 'layouts.marketing.heroAuthoring.sections.faq',
                        defaultLabel: 'FAQ',
                        aliases: ['faq']
                    }
                default:
                    return null
            }
        }
        case 'marketing.pricing':
            return {
                sectionId: 'pricing',
                labelKey: 'layouts.marketing.heroAuthoring.sections.pricing',
                defaultLabel: 'Pricing',
                aliases: ['pricing']
            }
        case 'marketing.footer':
            return {
                sectionId: 'footer',
                labelKey: 'layouts.marketing.heroAuthoring.sections.footer',
                defaultLabel: 'Footer',
                aliases: ['footer']
            }
        default:
            return null
    }
}

const encodeMarketingWidgetInstanceKey = (value: string): string =>
    Array.from(value)
        .map((character) => {
            if (/^[A-Za-z0-9-]$/u.test(character)) return character
            return `_${(character.codePointAt(0) ?? 0).toString(16)}_`
        })
        .join('')

/** Match the injective outer widget-anchor algorithm used by the runtime renderer. */
export const getMarketingWidgetAnchorId = (instanceKey: string): string =>
    `marketing-widget-${encodeMarketingWidgetInstanceKey(instanceKey)}`

/** Match the section-id algorithm used by the published marketing renderer. */
export const getMarketingSectionId = (section: keyof typeof marketingSectionIds, instanceKey?: string): string => {
    const normalizedInstanceKey = instanceKey?.trim()
    if (!normalizedInstanceKey || canonicalInstanceKeys[section] === normalizedInstanceKey) return marketingSectionIds[section]
    return `${marketingSectionIds[section]}-${encodeMarketingWidgetInstanceKey(normalizedInstanceKey)}`
}

/** Build labelled, unique section choices from the active widget composition. */
export const getMarketingActionSectionTargets = (widgets: readonly MarketingSectionWidgetDescriptor[]): MarketingActionSectionTarget[] => {
    const instanceNumbers = new Map<keyof typeof marketingSectionIds, number>()
    return widgets.flatMap((widget) => {
        if (widget.isActive === false) return []
        const definition = sectionDefinition(widget)
        if (!definition) return []

        const instanceNumber = (instanceNumbers.get(definition.sectionId) ?? 0) + 1
        instanceNumbers.set(definition.sectionId, instanceNumber)
        const config = readRecord(widget.config)
        const instanceKey = widget.instanceKey ?? (typeof config.instanceKey === 'string' ? config.instanceKey : undefined)
        const sectionId = getMarketingSectionId(definition.sectionId, instanceKey)
        return [
            {
                href: `#${sectionId}`,
                sectionId,
                labelKey: definition.labelKey,
                defaultLabel: definition.defaultLabel,
                instanceNumber
            }
        ]
    })
}

/** Runtime resolver aliases mapped to the same active section IDs as the picker. */
export const getMarketingSectionAnchorEntries = (
    widgets: readonly MarketingSectionWidgetDescriptor[]
): Array<readonly [string, string]> => {
    const firstSectionByAlias = new Map<string, string>()
    const sectionEntries: Array<readonly [string, string]> = []
    const widgetAliasEntries: Array<readonly [string, string]> = []

    for (const widget of widgets) {
        if (widget.isActive === false) continue
        const definition = sectionDefinition(widget)
        if (!definition) continue

        const config = readRecord(widget.config)
        const instanceKey = widget.instanceKey ?? (typeof config.instanceKey === 'string' ? config.instanceKey : undefined)
        const sectionId = getMarketingSectionId(definition.sectionId, instanceKey)
        sectionEntries.push([sectionId, sectionId])
        for (const alias of definition.aliases) {
            if (!firstSectionByAlias.has(alias)) firstSectionByAlias.set(alias, sectionId)
        }
        if (instanceKey) widgetAliasEntries.push([instanceKey, getMarketingWidgetAnchorId(instanceKey)])
    }

    // Concrete section IDs and canonical section aliases must win over
    // arbitrary widget instance keys that happen to use the same string.
    return [...sectionEntries, ...firstSectionByAlias, ...widgetAliasEntries]
}
