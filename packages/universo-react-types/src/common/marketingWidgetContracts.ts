import {
    MARKETING_PAGE_REQUIRED_LOCALES,
    MARKETING_PRICING_MAX_BENEFITS,
    MARKETING_SEMANTIC_KEY_PATTERN,
    type MarketingCollectionVariant,
    type MarketingWidgetKey
} from './marketingWidgetPrimitives'
import type { LayoutWidgetAuthoringCapabilities, LayoutWidgetPresentationField, WidgetBindingSlotDefinition } from './widgetBindings'

export const MARKETING_SAFE_HREF_PATTERN_SOURCE = String.raw`^(?:\/(?!\/)[^\s]*|#[^\s]+|[hH][tT][tT][pP][sS]?:\/\/[^\s]+|[mM][aA][iI][lL][tT][oO]:[^\s]+|[tT][eE][lL]:\+?[0-9(). -]+)$`

export interface MarketingWidgetContract {
    readonly authoring: LayoutWidgetAuthoringCapabilities
    readonly bindingSlots?: readonly WidgetBindingSlotDefinition[]
    readonly initialBindingSlotKey?: string
    readonly bindingVariants?: Readonly<Record<MarketingCollectionVariant, readonly WidgetBindingSlotDefinition[]>>
    readonly presentationFields?: readonly LayoutWidgetPresentationField[]
}

const applicationPresentationOnly = {
    presentationOnly: true,
    canAdd: false,
    canDuplicate: false,
    canEditContent: false,
    canRebind: false,
    resetToSource: true
} as const

const authoring = (
    add: LayoutWidgetAuthoringCapabilities['metahub']['add'],
    duplicate: LayoutWidgetAuthoringCapabilities['metahub']['duplicate'],
    contentEditing: LayoutWidgetAuthoringCapabilities['metahub']['contentEditing'],
    canRebind: boolean
): LayoutWidgetAuthoringCapabilities => ({
    metahub: { add, duplicate, contentEditing, canRebind },
    application: applicationPresentationOnly
})

type Component = WidgetBindingSlotDefinition['requirements']['components'][number]

const component = (
    field: string,
    componentCodename: string,
    valueType: Component['valueType'],
    localized = false,
    required = true,
    options: Partial<Pick<Component, 'semanticKey' | 'maxLength' | 'pattern' | 'format'>> = {}
): Component => ({ field, componentCodename, valueType, localized, required, ...options })

const key = (field: string, componentCodename: string, maxLength = 64): Component =>
    component(field, componentCodename, 'string', false, true, {
        semanticKey: true,
        maxLength,
        pattern: MARKETING_SEMANTIC_KEY_PATTERN.source
    })

const text = (field: string, componentCodename: string, maxLength: number, required = true): Component =>
    component(field, componentCodename, 'string', true, required, { maxLength })

const plainText = (field: string, componentCodename: string, maxLength: number, required = true): Component =>
    component(field, componentCodename, 'string', false, required, { maxLength })

const safeHref = (field: string, componentCodename: string, required = true): Component =>
    component(field, componentCodename, 'string', false, required, {
        maxLength: 500,
        pattern: MARKETING_SAFE_HREF_PATTERN_SOURCE,
        format: 'marketingHref'
    })

const numeric = (field: string, componentCodename: string): Component => component(field, componentCodename, 'number')
const boolean = (field: string, componentCodename: string): Component => component(field, componentCodename, 'boolean')
const json = (field: string, componentCodename: string, required = true, format?: string): Component =>
    component(field, componentCodename, 'json', false, required, format ? { format } : {})

const semanticRecordPolicy = (
    componentCodename: string,
    creationPrefix: string,
    protectedValues: string | readonly string[] = 'default',
    options: Pick<NonNullable<WidgetBindingSlotDefinition['requirements']['recordPolicy']>, 'requiredLocales' | 'conditionalRequired'> = {}
) => ({
    runtimeMutation: 'deny' as const,
    denyDeleteWhenBound: true,
    immutableSemanticKeyWhenBound: true,
    semanticKey: {
        componentCodename,
        creationPrefix,
        protectedValues: typeof protectedValues === 'string' ? [protectedValues] : [...protectedValues]
    },
    ...options
})

const makeSlot = (
    slotKey: string,
    selectorKind: 'semantic-key' | 'record-set' | 'relation-set',
    components: Component[],
    options: {
        parentSlot?: string
        orderByField?: string
        visibilityField?: string
        maxResolvedRecords?: number
        policy?: WidgetBindingSlotDefinition['requirements']['recordPolicy']
        label?: string
    } = {}
): WidgetBindingSlotDefinition => ({
    key: slotKey,
    selectorKinds: [selectorKind],
    authoring: {
        labelKey: `layouts.widgetBindings.${slotKey}.label`,
        defaultLabel: options.label ?? (selectorKind === 'semantic-key' ? 'Content record' : 'Content records'),
        placeholderKey: `layouts.widgetBindings.${slotKey}.placeholder`,
        defaultPlaceholder: selectorKind === 'semantic-key' ? 'Search by content name' : 'Choose a content source',
        helperTextKey: `layouts.widgetBindings.${slotKey}.helperText`,
        defaultHelperText:
            selectorKind === 'semantic-key'
                ? 'Choose the Entity record displayed by this widget.'
                : 'Choose the Entity model that supplies this widget content.',
        emptyOptionsKey: `layouts.widgetBindings.${slotKey}.noOptions`,
        defaultEmptyOptions: 'No compatible content sources found.',
        loadingOptionsKey: `layouts.widgetBindings.${slotKey}.loading`,
        defaultLoadingOptions: 'Loading compatible content sources…'
    },
    cardinality: { min: 1, max: 1 },
    ...(options.orderByField ? { orderByField: options.orderByField } : {}),
    ...(options.visibilityField ? { visibilityField: options.visibilityField } : {}),
    ...(selectorKind !== 'semantic-key' ? { maxResolvedRecords: options.maxResolvedRecords ?? 100 } : {}),
    ...(selectorKind === 'relation-set' && options.parentSlot && components.some(({ valueType }) => valueType === 'ref')
        ? {
              relation: {
                  field: components.find(({ valueType }) => valueType === 'ref')?.field ?? 'tier',
                  parentSlot: options.parentSlot
              }
          }
        : {}),
    requirements: {
        entityCapabilities: ['dataSchema', 'records'],
        entityKinds: ['object'],
        ...(options.policy ? { recordPolicy: options.policy } : {}),
        components
    }
})

const semantic = (slotKey: string, fields: Component[], policy: WidgetBindingSlotDefinition['requirements']['recordPolicy']) =>
    makeSlot(slotKey, 'semantic-key', fields, { policy, label: 'Content record' })

const recordSet = (slotKey: string, fields: Component[], maxResolvedRecords = 100) =>
    makeSlot(slotKey, 'record-set', fields, {
        orderByField: 'order',
        visibilityField: 'visible',
        maxResolvedRecords,
        label: 'Content source'
    })

const sectionSlot = () =>
    semantic(
        'section',
        [key('key', 'SectionKey'), text('title', 'Title', 255), text('description', 'Description', 2000, false)],
        semanticRecordPolicy('SectionKey', 'section', ['logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq'])
    )

const sectionPresentation = [
    {
        key: 'showTitle',
        kind: 'switch',
        labelKey: 'layouts.marketing.widget.showTitle',
        defaultLabel: 'Show title',
        helperTextKey: 'layouts.marketing.widget.showTitleHelper',
        defaultHelperText: 'Show this section heading.',
        defaultValue: true
    },
    {
        key: 'showDescription',
        kind: 'switch',
        labelKey: 'layouts.marketing.widget.showDescription',
        defaultLabel: 'Show description',
        helperTextKey: 'layouts.marketing.widget.showDescriptionHelper',
        defaultHelperText: 'Show this section description.',
        defaultValue: true
    }
] as const satisfies readonly LayoutWidgetPresentationField[]

const itemsForVariant: Readonly<Record<MarketingCollectionVariant, readonly WidgetBindingSlotDefinition[]>> = {
    logos: [
        sectionSlot(),
        recordSet('items', [
            key('key', 'LogoKey'),
            json('imageLight', 'ImageLight', true, 'marketingMediaReference'),
            json('imageDark', 'ImageDark', true, 'marketingMediaReference'),
            text('altText', 'AltText', 255),
            numeric('order', 'SortOrder'),
            boolean('visible', 'IsVisible')
        ])
    ],
    features: [
        sectionSlot(),
        recordSet('items', [
            key('key', 'FeatureKey'),
            plainText('iconKey', 'IconKey', 64),
            text('title', 'Title', 255),
            text('description', 'Description', 1000),
            json('imageLight', 'ImageLight', true, 'marketingMediaReference'),
            json('imageDark', 'ImageDark', true, 'marketingMediaReference'),
            numeric('order', 'SortOrder'),
            boolean('visible', 'IsVisible')
        ])
    ],
    testimonials: [
        sectionSlot(),
        recordSet('items', [
            key('key', 'TestimonialKey'),
            text('name', 'Name', 255),
            text('occupation', 'Occupation', 255),
            text('quote', 'Quote', 2000),
            json('avatar', 'AvatarUrl', true, 'marketingMediaReference'),
            json('logoLight', 'LogoLightUrl', true, 'marketingMediaReference'),
            json('logoDark', 'LogoDarkUrl', true, 'marketingMediaReference'),
            numeric('order', 'SortOrder'),
            boolean('visible', 'IsVisible')
        ])
    ],
    highlights: [
        sectionSlot(),
        recordSet('items', [
            key('key', 'HighlightKey'),
            plainText('iconKey', 'IconKey', 64),
            text('title', 'Title', 255),
            text('description', 'Description', 1000),
            numeric('order', 'SortOrder'),
            boolean('visible', 'IsVisible')
        ])
    ],
    faq: [
        sectionSlot(),
        recordSet('items', [
            key('key', 'FaqKey'),
            text('question', 'Question', 500),
            text('answer', 'Answer', 2000),
            numeric('order', 'SortOrder'),
            boolean('visible', 'IsVisible')
        ])
    ]
}

const siteKey = key('key', 'SiteKey')
const heroContent = makeSlot(
    'content',
    'semantic-key',
    [
        key('key', 'HeroKey'),
        text('title', 'Title', 255),
        text('accent', 'Accent', 120, false),
        text('description', 'Description', 2000),
        text('emailLabel', 'EmailLabel', 120),
        text('emailPlaceholder', 'EmailPlaceholder', 120),
        text('primaryActionLabel', 'PrimaryActionLabel', 120),
        json('primaryAction', 'PrimaryAction', true, 'marketingAction'),
        text('termsText', 'TermsText', 500, false),
        text('termsLinkLabel', 'TermsLinkLabel', 120, false),
        json('termsAction', 'TermsAction', false, 'marketingAction')
    ],
    {
        policy: {
            ...semanticRecordPolicy('HeroKey', 'hero'),
            requiredLocales: [...MARKETING_PAGE_REQUIRED_LOCALES],
            coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
        },
        label: 'Hero content'
    }
)

export const MARKETING_WIDGET_CONTRACTS: Readonly<Record<MarketingWidgetKey, MarketingWidgetContract>> = {
    'marketing.brand': {
        authoring: authoring('none', 'none', 'single-record', false),
        bindingSlots: [
            semantic(
                'site',
                [siteKey, text('brandName', 'BrandName', 255), json('brandLogo', 'BrandLogo', false, 'marketingMediaReference')],
                semanticRecordPolicy('SiteKey', 'site', 'site-settings')
            )
        ]
    },
    'marketing.navigation': {
        authoring: authoring('select-source', 'share-bindings', 'record-set', true),
        bindingSlots: [
            recordSet('items', [
                key('key', 'NavKey'),
                text('label', 'Label', 120),
                safeHref('href', 'Href'),
                plainText('sectionKey', 'SectionKey', 64, false),
                numeric('order', 'SortOrder'),
                boolean('visible', 'IsVisible')
            ])
        ],
        presentationFields: [
            {
                key: 'maxItems',
                kind: 'number',
                labelKey: 'layouts.marketing.widget.maxItems',
                defaultLabel: 'Maximum items',
                helperTextKey: 'layouts.marketing.widget.maxItemsHelper',
                defaultHelperText: 'Limit the number of navigation links shown.',
                defaultValue: 24,
                min: 1,
                max: 100
            }
        ]
    },
    'marketing.auth': {
        authoring: authoring('none', 'none', 'none', false),
        presentationFields: [
            {
                key: 'showAuthActions',
                kind: 'switch',
                labelKey: 'layouts.marketing.widget.showAuthActions',
                defaultLabel: 'Show authentication actions',
                helperTextKey: 'layouts.marketing.widget.showAuthActionsHelper',
                defaultHelperText: 'Show sign-in and sign-up actions in this placement.',
                defaultValue: true
            }
        ]
    },
    'marketing.hero': {
        authoring: authoring('create-or-select', 'clone-record', 'single-record', true),
        bindingSlots: [heroContent],
        presentationFields: [
            {
                key: 'showLeadForm',
                kind: 'switch',
                labelKey: 'layouts.marketing.widget.showLeadForm',
                defaultLabel: 'Show lead form',
                helperTextKey: 'layouts.marketing.widget.showLeadFormHelper',
                defaultHelperText: 'Show the email signup form in this Hero placement.',
                defaultValue: true
            }
        ]
    },
    'marketing.image': {
        authoring: authoring('create-or-select', 'clone-record', 'single-record', true),
        bindingSlots: [
            semantic(
                'content',
                [
                    key('key', 'ImageKey'),
                    json('resource', 'Resource', false, 'marketingMediaReference'),
                    text('altText', 'AltText', 255, false),
                    boolean('decorative', 'Decorative'),
                    numeric('width', 'Width'),
                    numeric('height', 'Height')
                ],
                semanticRecordPolicy('ImageKey', 'image', 'default', {
                    requiredLocales: MARKETING_PAGE_REQUIRED_LOCALES,
                    conditionalRequired: [{ componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: false } }]
                })
            )
        ]
    },
    'marketing.collection': {
        authoring: authoring('select-source', 'share-bindings', 'multi-slot', true),
        bindingVariants: itemsForVariant,
        initialBindingSlotKey: 'items',
        presentationFields: [
            {
                key: 'variant',
                kind: 'select',
                labelKey: 'layouts.marketing.widget.variant',
                defaultLabel: 'Content type',
                helperTextKey: 'layouts.marketing.widget.variantHelp',
                defaultHelperText: 'Choose the type of content displayed in this section.',
                defaultValue: 'logos',
                required: true,
                options: [
                    { value: 'logos', labelKey: 'layouts.marketing.widget.variants.logos', defaultLabel: 'Logos' },
                    { value: 'features', labelKey: 'layouts.marketing.widget.variants.features', defaultLabel: 'Features' },
                    { value: 'testimonials', labelKey: 'layouts.marketing.widget.variants.testimonials', defaultLabel: 'Testimonials' },
                    { value: 'highlights', labelKey: 'layouts.marketing.widget.variants.highlights', defaultLabel: 'Highlights' },
                    { value: 'faq', labelKey: 'layouts.marketing.widget.variants.faq', defaultLabel: 'FAQ' }
                ]
            },
            {
                key: 'maxItems',
                kind: 'number',
                labelKey: 'layouts.marketing.widget.maxItems',
                defaultLabel: 'Maximum items',
                helperTextKey: 'layouts.marketing.widget.maxItemsHelper',
                defaultHelperText: 'Limit the number of visible content records.',
                defaultValue: 100,
                min: 1,
                max: 100
            },
            {
                key: 'showItemDescriptions',
                kind: 'switch',
                labelKey: 'layouts.marketing.widget.showItemDescriptions',
                defaultLabel: 'Show item descriptions',
                helperTextKey: 'layouts.marketing.widget.showItemDescriptionsHelper',
                defaultHelperText: 'Show the description beneath each feature title.',
                defaultValue: true
            },
            {
                key: 'fixedItemsHeight',
                kind: 'switch',
                labelKey: 'layouts.marketing.widget.fixedItemsHeight',
                defaultLabel: 'Limit item list height',
                helperTextKey: 'layouts.marketing.widget.fixedItemsHeightHelper',
                defaultHelperText: 'Keep feature cards within the available section height.',
                defaultValue: false
            },
            ...sectionPresentation
        ]
    },
    'marketing.pricing': {
        authoring: authoring('select-source', 'share-bindings', 'multi-slot', true),
        bindingSlots: [
            sectionSlot(),
            recordSet(
                'tiers',
                [
                    key('key', 'TierKey'),
                    text('title', 'Title', 255),
                    text('subheader', 'Subheader', 255, false),
                    numeric('price', 'Price'),
                    text('period', 'Period', 120),
                    text('actionLabel', 'ActionLabel', 120),
                    safeHref('actionHref', 'ActionHref'),
                    boolean('featured', 'Featured'),
                    numeric('order', 'SortOrder'),
                    boolean('visible', 'IsVisible')
                ],
                24
            ),
            makeSlot(
                'benefits',
                'relation-set',
                [
                    key('key', 'BenefitKey', 128),
                    component('tier', 'TierRef', 'ref'),
                    text('label', 'Label', 255),
                    numeric('order', 'SortOrder'),
                    boolean('visible', 'IsVisible')
                ],
                {
                    parentSlot: 'tiers',
                    orderByField: 'order',
                    visibilityField: 'visible',
                    maxResolvedRecords: MARKETING_PRICING_MAX_BENEFITS
                }
            )
        ],
        presentationFields: [
            {
                key: 'maxItems',
                kind: 'number',
                labelKey: 'layouts.marketing.widget.maxItems',
                defaultLabel: 'Maximum plans',
                helperTextKey: 'layouts.marketing.widget.maxItemsHelper',
                defaultHelperText: 'Limit the number of pricing plans shown.',
                defaultValue: 24,
                min: 1,
                max: 100
            },
            {
                key: 'showBenefits',
                kind: 'switch',
                labelKey: 'layouts.marketing.widget.showBenefits',
                defaultLabel: 'Show plan benefits',
                helperTextKey: 'layouts.marketing.widget.showBenefitsHelper',
                defaultHelperText: 'Show benefits related to each plan.',
                defaultValue: true
            },
            {
                key: 'cardStyle',
                kind: 'select',
                labelKey: 'layouts.marketing.widget.cardStyle',
                defaultLabel: 'Card style',
                helperTextKey: 'layouts.marketing.widget.cardStyleHelper',
                defaultHelperText: 'Choose how pricing plans are emphasized.',
                defaultValue: 'featured',
                required: true,
                options: [
                    { value: 'featured', labelKey: 'layouts.marketing.widget.cardStyleFeatured', defaultLabel: 'Featured plan' },
                    { value: 'uniform', labelKey: 'layouts.marketing.widget.cardStyleUniform', defaultLabel: 'Equal cards' }
                ]
            },
            {
                key: 'cardWidth',
                kind: 'select',
                labelKey: 'layouts.marketing.widget.cardWidth',
                defaultLabel: 'Card width',
                helperTextKey: 'layouts.marketing.widget.cardWidthHelper',
                defaultHelperText: 'Choose the width of the pricing section.',
                defaultValue: 'auto',
                required: true,
                options: [
                    { value: 'auto', labelKey: 'layouts.marketing.widget.cardWidthAuto', defaultLabel: 'Standard' },
                    { value: 'full', labelKey: 'layouts.marketing.widget.cardWidthFull', defaultLabel: 'Full width' }
                ]
            }
        ]
    },
    'marketing.footer': {
        authoring: authoring('select-source', 'share-bindings', 'multi-slot', true),
        bindingSlots: [
            semantic(
                'site',
                [
                    siteKey,
                    text('brandName', 'BrandName', 255),
                    json('brandLogo', 'BrandLogo', false, 'marketingMediaReference'),
                    text('footerDescription', 'FooterDescription', 1000, false),
                    text('copyrightText', 'CopyrightText', 500, false),
                    text('copyrightLabel', 'CopyrightLabel', 255, false),
                    safeHref('copyrightHref', 'CopyrightHref', false),
                    text('newsletterTitle', 'NewsletterTitle', 255, false),
                    text('newsletterDescription', 'NewsletterDescription', 1000, false),
                    text('newsletterLabel', 'NewsletterLabel', 255, false),
                    text('newsletterPlaceholder', 'NewsletterPlaceholder', 255, false),
                    text('newsletterActionLabel', 'NewsletterActionLabel', 120, false),
                    safeHref('newsletterActionHref', 'NewsletterActionHref', false),
                    text('newsletterSuccessMessage', 'NewsletterSuccessMessage', 500, false),
                    text('newsletterErrorMessage', 'NewsletterErrorMessage', 500, false),
                    boolean('newsletterEnabled', 'NewsletterEnabled')
                ],
                semanticRecordPolicy('SiteKey', 'site', 'site-settings')
            ),
            recordSet('links', [
                key('key', 'LinkKey', 128),
                plainText('groupKey', 'GroupKey', 64),
                text('groupTitle', 'GroupTitle', 120),
                text('label', 'Label', 120),
                text('bottomLabel', 'BottomLabel', 120, false),
                safeHref('href', 'Href'),
                plainText('iconKey', 'IconKey', 64, false),
                numeric('order', 'SortOrder'),
                boolean('visible', 'IsVisible')
            ])
        ],
        presentationFields: [
            {
                key: 'maxItems',
                kind: 'number',
                labelKey: 'layouts.marketing.widget.maxItems',
                defaultLabel: 'Maximum links',
                helperTextKey: 'layouts.marketing.widget.maxItemsHelper',
                defaultHelperText: 'Limit the number of footer links shown.',
                defaultValue: 100,
                min: 1,
                max: 100
            },
            {
                key: 'showNewsletter',
                kind: 'switch',
                labelKey: 'layouts.marketing.widget.showNewsletter',
                defaultLabel: 'Show newsletter form',
                helperTextKey: 'layouts.marketing.widget.showNewsletterHelper',
                defaultHelperText: 'Show the newsletter form in the footer.',
                defaultValue: true
            }
        ]
    }
}
