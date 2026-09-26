import type { ReactNode } from 'react'
import type {
    MarketingLayoutZone,
    MarketingLocaleCode,
    MarketingPageConfig,
    MarketingPageRuntimeViewModel,
    MarketingProvenance,
    MarketingRuntimeIdentity,
    MarketingWidgetInstanceKey,
    ResourceSource,
    EffectiveLayoutMetadata,
    EffectiveWidget
} from '@universo-react/types'

export type MarketingActionKind = 'internal' | 'external' | 'mailto' | 'tel'

export interface MarketingAction {
    semanticKey: string
    label: string
    actionKind: MarketingActionKind
    href: string
    target?: '_self' | '_blank'
}

export interface MarketingMedia {
    /** Canonical source descriptor retained even when a runtime URL is unavailable. */
    resource?: ResourceSource
    src: string
    alt: string
    /** Canonical dark-theme source descriptor, when supplied by the content model. */
    darkResource?: ResourceSource
    darkSrc?: string
    darkAlt?: string
    decorative?: boolean
}

export type MarketingIconKey =
    | 'autoFixHigh'
    | 'autoAwesome'
    | 'construction'
    | 'devices'
    | 'edgesensor'
    | 'queryStats'
    | 'settingsSuggest'
    | 'supportAgent'
    | 'thumbUp'
    | 'viewQuilt'
    | 'github'
    | 'x'
    | 'linkedin'

export interface MarketingSectionCopy {
    title: string
    description?: string
    showTitle?: boolean
    showDescription?: boolean
}

export interface MarketingNavigationItem extends MarketingAction {
    order?: number
    visible?: boolean
}

export interface MarketingHeroData {
    title: string
    accent?: string
    description: string
    lead?: {
        label: string
        placeholder: string
        submitLabel: string
        action?: MarketingAction
        termsText?: string
        termsAction?: MarketingAction
    }
}

export interface MarketingImageWidget extends MarketingWidgetFrame {
    widgetKey: 'marketing.image'
    content: {
        media: MarketingMedia
    }
}

export interface MarketingLogo {
    semanticKey: string
    name: string
    /** Partner/ecosystem entries may be text-only; media is optional. */
    media?: MarketingMedia
    action?: MarketingAction
    order?: number
    visible?: boolean
}

export interface MarketingFeature {
    semanticKey: string
    title: string
    description: string
    icon?: MarketingIconKey
    media?: MarketingMedia
    order?: number
    visible?: boolean
}

export interface MarketingTestimonial {
    semanticKey: string
    quote: string
    name: string
    role?: string
    avatar?: MarketingMedia
    logo?: MarketingMedia
    order?: number
    visible?: boolean
}

export interface MarketingHighlight {
    semanticKey: string
    title: string
    description: string
    icon?: MarketingIconKey
    order?: number
    visible?: boolean
}

export interface MarketingPricingTier {
    semanticKey: string
    title: string
    price: string
    period: string
    benefits: string[]
    description?: string
    featured?: boolean
    action?: MarketingAction
    order?: number
    visible?: boolean
}

export interface MarketingFaqItem {
    semanticKey: string
    question: string
    answer: string
    order?: number
    visible?: boolean
}

export interface MarketingLinkGroup {
    semanticKey: string
    title: string
    links: MarketingAction[]
    order?: number
    visible?: boolean
}

export interface MarketingFooterData {
    brandName: string
    logo?: MarketingMedia
    description?: string
    newsletter?: {
        title: string
        description: string
        label: string
        placeholder: string
        submitLabel: string
        successMessage?: string
        errorMessage?: string
        action?: MarketingAction
    }
    groups?: MarketingLinkGroup[]
    legalLinks?: MarketingAction[]
    socialLinks?: Array<MarketingAction & { icon?: MarketingIconKey }>
    copyrightText: string
    copyrightAction?: MarketingAction
}

export interface MarketingWidgetFrame {
    instanceKey: MarketingWidgetInstanceKey
    zone: MarketingLayoutZone
    sortOrder: number
    isActive: boolean
}

export interface MarketingBrandData {
    name: string
    logo?: MarketingMedia
    homeAction?: MarketingAction
}

export interface MarketingAuthData {
    signIn?: MarketingAction
    signUp?: MarketingAction
}

export interface MarketingBrandWidget extends MarketingWidgetFrame {
    widgetKey: 'marketing.brand'
    content: MarketingBrandData
}

export interface MarketingNavigationWidget extends MarketingWidgetFrame {
    widgetKey: 'marketing.navigation'
    content: {
        navigation: MarketingNavigationItem[]
    }
}

export interface MarketingAuthWidget extends MarketingWidgetFrame {
    widgetKey: 'marketing.auth'
    content: MarketingAuthData
}

export interface MarketingHeroWidget extends MarketingWidgetFrame {
    widgetKey: 'marketing.hero'
    content: MarketingHeroData
}

export type MarketingPricingCardStyle = 'featured' | 'uniform'
export type MarketingPricingCardWidth = 'auto' | 'full'

/** Render settings shared by the features collection layout. */
export interface MarketingCollectionWidgetSettings {
    showItemDescriptions: boolean
    fixedItemsHeight: boolean
}

export type MarketingCollectionWidgetContent =
    | { variant: 'logos'; section: MarketingSectionCopy; items: MarketingLogo[] }
    | { variant: 'features'; section: MarketingSectionCopy; items: MarketingFeature[]; config: MarketingCollectionWidgetSettings }
    | { variant: 'testimonials'; section: MarketingSectionCopy; items: MarketingTestimonial[] }
    | { variant: 'highlights'; section: MarketingSectionCopy; items: MarketingHighlight[] }
    | { variant: 'faq'; section: MarketingSectionCopy; items: MarketingFaqItem[] }

export interface MarketingCollectionWidget extends MarketingWidgetFrame {
    widgetKey: 'marketing.collection'
    content: MarketingCollectionWidgetContent
}

export interface MarketingPricingWidget extends MarketingWidgetFrame {
    widgetKey: 'marketing.pricing'
    content: {
        section: MarketingSectionCopy
        tiers: MarketingPricingTier[]
        config: {
            cardStyle: MarketingPricingCardStyle
            cardWidth: MarketingPricingCardWidth
            showBenefits: boolean
        }
    }
}

export interface MarketingFooterWidget extends MarketingWidgetFrame {
    widgetKey: 'marketing.footer'
    content: MarketingFooterData
}

export type MarketingPageWidget =
    | MarketingBrandWidget
    | MarketingNavigationWidget
    | MarketingAuthWidget
    | MarketingHeroWidget
    | MarketingImageWidget
    | MarketingCollectionWidget
    | MarketingPricingWidget
    | MarketingFooterWidget

/**
 * Normalized view model consumed by the isolated marketing renderer. The
 * server envelope is intentionally reduced to widget content here: layout
 * composition remains in `widgets`, while records stay inside the validated
 * transport payload and never become page-level state.
 */
export interface MarketingPageData {
    templateKey: 'marketing-page'
    locale: MarketingLocaleCode
    config: MarketingPageConfig
    widgets: MarketingPageWidget[]
    runtime?: MarketingRuntimeIdentity
    provenance?: MarketingProvenance
    richContent?: MarketingPageRuntimeViewModel['marketingPage']['richContent']
}

/** Runtime effective-layout input supplied by the host application. */
export type MarketingEffectiveLayoutWidgets = readonly EffectiveWidget[]
export type MarketingEffectiveLayoutConfig = Pick<EffectiveLayoutMetadata, 'templateKey' | 'zoneSettings'>

export interface MarketingRenderOptions {
    heroBackgroundOwner?: 'widget' | 'page'
    sectionAnchors?: MarketingSectionAnchorResolver
}

/** Maps semantic marketing section references to the active rendered section ids. */
export interface MarketingSectionAnchorResolver {
    has(anchor: string): boolean
    resolve(anchor: string): string
}

export type MarketingFormSource = 'hero' | 'footer'

export type MarketingActionHandler = (action: MarketingAction) => void
export type MarketingLeadHandler = (email: string, source: MarketingFormSource) => Promise<void> | void

export interface MarketingPageProps {
    data: MarketingPageData
    effectiveLayoutWidgets: MarketingEffectiveLayoutWidgets
    effectiveLayoutConfig?: MarketingEffectiveLayoutConfig
    onAction?: MarketingActionHandler
    onLeadSubmit?: MarketingLeadHandler
}

export interface MarketingIconProps {
    name?: MarketingIconKey
    className?: string
}

export type MarketingContentNode = ReactNode
