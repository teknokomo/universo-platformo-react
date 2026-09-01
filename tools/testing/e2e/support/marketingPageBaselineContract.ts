import assert from 'node:assert/strict'

type TemplateManifest = {
    codename?: unknown
    version?: unknown
    minStructureVersion?: unknown
    seed?: {
        layouts?: Array<Record<string, unknown>>
        entities?: Array<Record<string, unknown>>
        elements?: Record<string, Array<Record<string, unknown>>>
    }
}

const EXPECTED_ENTITY_CODENAMES = [
    'MarketingPage',
    'MarketingPageSiteSettings',
    'MarketingPageSection',
    'MarketingPageLogo',
    'MarketingPageFeature',
    'MarketingPageTestimonial',
    'MarketingPageHighlight',
    'MarketingPagePricing',
    'MarketingPagePricingBenefit',
    'MarketingPageFaq',
    'MarketingPageNavigation',
    'MarketingPageFooterLink'
] as const

const EXPECTED_ELEMENT_COUNTS: Record<string, number> = {
    MarketingPageSiteSettings: 1,
    MarketingPageSection: 8,
    MarketingPageLogo: 6,
    MarketingPageFeature: 3,
    MarketingPageTestimonial: 6,
    MarketingPageHighlight: 6,
    MarketingPagePricing: 3,
    MarketingPagePricingBenefit: 14,
    MarketingPageFaq: 4,
    MarketingPageNavigation: 6,
    MarketingPageFooterLink: 14
}

const readString = (value: unknown, field: string): string => {
    assert.equal(typeof value, 'string', `${field} must be a string`)
    return value
}

const readData = (element: Record<string, unknown>): Record<string, unknown> => {
    assert.ok(element.data && typeof element.data === 'object' && !Array.isArray(element.data), 'seed element data must be an object')
    return element.data as Record<string, unknown>
}

const readResourceSourceUrl = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const url = (value as { url?: unknown }).url
        return typeof url === 'string' ? url : ''
    }
    return ''
}

const readLocalized = (value: unknown): Record<string, string> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as { locales?: Record<string, { content?: unknown }>; [key: string]: unknown }
        if (record.locales && typeof record.locales === 'object') {
            return Object.fromEntries(
                Object.entries(record.locales).flatMap(([locale, entry]) =>
                    typeof entry?.content === 'string' ? [[locale, entry.content]] : []
                )
            )
        }
        return Object.fromEntries(Object.entries(record).filter(([, entry]) => typeof entry === 'string')) as Record<string, string>
    }
    return typeof value === 'string' ? { en: value } : {}
}

/**
 * Assert the immutable semantic baseline of the built-in marketing template.
 * The contract intentionally checks content keys and relations, not only counts,
 * so a visually similar but incomplete seed cannot pass unnoticed.
 */
export function assertMarketingPageTemplateBaseline(manifest: TemplateManifest): void {
    assert.equal(manifest.codename, 'marketing-page')
    assert.equal(manifest.version, '0.1.0')
    assert.equal(manifest.minStructureVersion, '0.1.0')

    const seed = manifest.seed
    assert.ok(seed, 'marketing-page seed is required')
    const entities = seed.entities ?? []
    assert.deepEqual(
        entities.map((entity) => entity.codename),
        EXPECTED_ENTITY_CODENAMES,
        'marketing-page entity order/codenames changed'
    )

    for (const [entityCodename, expectedCount] of Object.entries(EXPECTED_ELEMENT_COUNTS)) {
        assert.equal(seed.elements?.[entityCodename]?.length, expectedCount, `${entityCodename} baseline count changed`)
    }

    const layout = seed.layouts?.find((candidate) => candidate.codename === 'marketing-main')
    assert.ok(layout, 'marketing-main layout is required')
    assert.equal(layout.templateKey, 'marketing-page')

    const siteSettings = seed.elements?.MarketingPageSiteSettings?.[0]
    assert.ok(siteSettings, 'site settings seed is required')
    const siteSettingsData = readData(siteSettings)
    assert.deepEqual(readLocalized(siteSettingsData.HeroTitle), { en: 'Our latest', ru: 'Наши новые' })
    assert.deepEqual(readLocalized(siteSettingsData.HeroAccent), { en: 'products', ru: 'продукты' })
    assert.deepEqual(readLocalized(siteSettingsData.HeroTermsLinkLabel), { en: 'Terms & Conditions', ru: 'Условиями использования' })
    assert.equal(siteSettingsData.HeroPrimaryActionHref, '/sign-up')
    assert.deepEqual(readLocalized(siteSettingsData.CopyrightText), { en: 'Copyright ©', ru: 'Copyright ©' })
    assert.deepEqual(readLocalized(siteSettingsData.CopyrightLabel), { en: 'Sitemark', ru: 'Sitemark' })
    assert.equal(siteSettingsData.CopyrightHref, 'https://mui.com/')

    const navigation = seed.elements?.MarketingPageNavigation ?? []
    assert.deepEqual(
        navigation.map((element) => readData(element).NavKey),
        ['features', 'testimonials', 'highlights', 'pricing', 'faq', 'blog'],
        'navigation baseline changed'
    )

    const logos = seed.elements?.MarketingPageLogo ?? []
    assert.deepEqual(
        logos.map((element) => readData(element).LogoKey),
        ['sydney', 'bern', 'montreal', 'terra', 'colorado', 'ankara'],
        'logo baseline changed'
    )

    const sections = seed.elements?.MarketingPageSection ?? []
    assert.deepEqual(
        sections.map((element) => {
            const data = readData(element)
            return {
                key: data.SectionKey,
                sortOrder: data.SortOrder,
                title: readLocalized(data.Title),
                description: readLocalized(data.Description)
            }
        }),
        [
            {
                key: 'hero',
                sortOrder: 1,
                title: { en: 'Our latest products', ru: 'Наши новые продукты' },
                description: {
                    en: 'Primary hero content is managed by the marketing hero object.',
                    ru: 'Основное содержимое первого экрана управляется объектом первого экрана.'
                }
            },
            {
                key: 'logos',
                sortOrder: 2,
                title: { en: 'Trusted by the best companies', ru: 'Нам доверяют лучшие компании' },
                description: {
                    en: 'Customer logos from the marketing page content.',
                    ru: 'Логотипы клиентов из содержимого маркетинговой страницы.'
                }
            },
            {
                key: 'features',
                sortOrder: 3,
                title: { en: 'Product features', ru: 'Возможности продукта' },
                description: {
                    en: 'Provide a brief overview of the key features of the product. For example, you could list the number of features, their types or benefits, and add-ons.',
                    ru: 'Кратко расскажите о ключевых возможностях продукта: их количестве, типах, преимуществах и дополнительных опциях.'
                }
            },
            {
                key: 'testimonials',
                sortOrder: 4,
                title: { en: 'Testimonials', ru: 'Отзывы' },
                description: {
                    en: 'See what our customers love about our products. Discover how we excel in efficiency, durability, and satisfaction. Join us for quality, innovation, and reliable support.',
                    ru: 'Узнайте, что клиентам нравится в наших продуктах. Мы уделяем внимание эффективности, надёжности и качеству поддержки.'
                }
            },
            {
                key: 'highlights',
                sortOrder: 5,
                title: { en: 'Highlights', ru: 'Преимущества' },
                description: {
                    en: 'Explore why our product stands out: adaptability, durability, user-friendly design, and innovation. Enjoy reliable customer support and precision in every detail.',
                    ru: 'Узнайте, чем продукт выделяется: адаптивностью, надёжностью, удобством, инновациями и вниманием к деталям.'
                }
            },
            {
                key: 'pricing',
                sortOrder: 6,
                title: { en: 'Pricing', ru: 'Тарифы' },
                description: {
                    en: "Quickly build an effective pricing table for your potential customers with this layout. It's built with default Material UI components with little customization.",
                    ru: 'Создайте понятную таблицу тарифов для потенциальных клиентов на базе стандартных компонентов Material UI.'
                }
            },
            {
                key: 'faq',
                sortOrder: 7,
                title: { en: 'Frequently asked questions', ru: 'Часто задаваемые вопросы' },
                description: {
                    en: 'Answers to the most common questions about the product.',
                    ru: 'Ответы на самые частые вопросы о продукте.'
                }
            },
            {
                key: 'footer',
                sortOrder: 8,
                title: { en: 'Footer', ru: 'Подвал' },
                description: { en: 'Footer branding and newsletter content.', ru: 'Брендинг подвала и содержимое рассылки.' }
            }
        ],
        'section order and copy changed'
    )

    const featureExpectations = [
        [
            'dashboard',
            'ViewQuiltRounded',
            'Dashboard',
            'Панель управления',
            'This item could provide a snapshot of the most important metrics or data points related to the product.',
            'https://mui.com/static/images/templates/templates-images/dash-light.png'
        ],
        [
            'mobile',
            'EdgesensorHighRounded',
            'Mobile integration',
            'Мобильная интеграция',
            'This item could provide information about the mobile app version of the product.',
            'https://mui.com/static/images/templates/templates-images/mobile-light.png'
        ],
        [
            'platforms',
            'DevicesRounded',
            'Available on all platforms',
            'Доступно на всех платформах',
            'This item could let users know the product is available on all platforms, such as web, mobile, and desktop.',
            'https://mui.com/static/images/templates/templates-images/devices-light.png'
        ]
    ] as const
    assert.deepEqual(
        (seed.elements?.MarketingPageFeature ?? []).map((element) => {
            const data = readData(element)
            return [
                data.FeatureKey,
                data.IconKey,
                ...Object.values(readLocalized(data.Title)),
                ...Object.values(readLocalized(data.Description)).slice(0, 1),
                readResourceSourceUrl(data.ImageLight)
            ]
        }),
        featureExpectations.map(([key, icon, title, titleRu, description, image]) => [key, icon, title, titleRu, description, image]),
        'feature content/media baseline changed'
    )

    const highlightExpectations = [
        [
            'adaptable',
            'SettingsSuggestRounded',
            'Adaptable performance',
            'Our product effortlessly adjusts to your needs, boosting efficiency and simplifying your tasks.'
        ],
        [
            'durable',
            'ConstructionRounded',
            'Built to last',
            'Experience unmatched durability that goes above and beyond with lasting investment.'
        ],
        [
            'experience',
            'ThumbUpAltRounded',
            'Great user experience',
            'Integrate our product into your routine with an intuitive and easy-to-use interface.'
        ],
        [
            'innovative',
            'AutoFixHighRounded',
            'Innovative functionality',
            'Stay ahead with features that set new standards, addressing your evolving needs better than the rest.'
        ],
        [
            'support',
            'SupportAgentRounded',
            'Reliable support',
            'Count on our responsive customer support, offering assistance that goes beyond the purchase.'
        ],
        [
            'precision',
            'QueryStatsRounded',
            'Precision in every detail',
            'Enjoy a meticulously crafted product where small touches make a significant impact on your overall experience.'
        ]
    ] as const
    assert.deepEqual(
        (seed.elements?.MarketingPageHighlight ?? []).map((element) => {
            const data = readData(element)
            return [data.HighlightKey, data.IconKey, readLocalized(data.Title).en, readLocalized(data.Description).en]
        }),
        highlightExpectations,
        'highlight content/icon baseline changed'
    )

    const testimonials = seed.elements?.MarketingPageTestimonial ?? []
    assert.deepEqual(
        testimonials.map((element) => readData(element).TestimonialKey),
        ['remy', 'travis', 'cindy', 'julia', 'john', 'daniel'],
        'testimonial semantic keys changed'
    )
    const testimonialExpectations = [
        [
            'remy',
            'Remy Sharp',
            'Senior Engineer',
            "I absolutely love how versatile this product is! Whether I'm tackling work projects or indulging in my favorite hobbies, it seamlessly adapts to my changing needs. Its intuitive design has truly enhanced my daily routine, making tasks more efficient and enjoyable."
        ],
        [
            'travis',
            'Travis Howard',
            'Lead Product Designer',
            "One of the standout features of this product is the exceptional customer support. In my experience, the team behind this product has been quick to respond and incredibly helpful. It's reassuring to know that they stand firmly behind their product."
        ],
        [
            'cindy',
            'Cindy Baker',
            'CTO',
            'The level of simplicity and user-friendliness in this product has significantly simplified my life. I appreciate the creators for delivering a solution that not only meets but exceeds user expectations.'
        ],
        [
            'julia',
            'Julia Stewart',
            'Senior Engineer',
            "I appreciate the attention to detail in the design of this product. The small touches make a big difference, and it's evident that the creators focused on delivering a premium experience."
        ],
        [
            'john',
            'John Smith',
            'Product Designer',
            "I've tried other similar products, but this one stands out for its innovative features. It's clear that the makers put a lot of thought into creating a solution that truly addresses user needs."
        ],
        [
            'daniel',
            'Daniel Wolf',
            'CDO',
            "The quality of this product exceeded my expectations. It's durable, well-designed, and built to last. Definitely worth the investment!"
        ]
    ] as const
    assert.deepEqual(
        testimonials.map((element) => {
            const data = readData(element)
            return [
                data.TestimonialKey,
                readLocalized(data.Name).en,
                readLocalized(data.Occupation).en,
                readLocalized(data.Quote).en,
                readResourceSourceUrl(data.AvatarUrl)
            ]
        }),
        testimonialExpectations.map(([key, name, occupation, quote], index) => [
            key,
            name,
            occupation,
            quote,
            `https://mui.com/static/images/avatar/${index + 1}.jpg`
        ]),
        'testimonial content/media baseline changed'
    )

    const faqs = seed.elements?.MarketingPageFaq ?? []
    assert.deepEqual(
        faqs.map((element) => readData(element).FaqKey),
        ['support', 'returns', 'difference', 'warranty'],
        'FAQ semantic keys changed'
    )
    assert.deepEqual(
        faqs.map((element) => {
            const data = readData(element)
            return [data.FaqKey, readLocalized(data.Question).en, readLocalized(data.Answer).en]
        }),
        [
            [
                'support',
                'How do I contact customer support if I have a question or issue?',
                "You can reach our customer support team by emailing support@email.com or calling our toll-free number. We're here to assist you promptly."
            ],
            [
                'returns',
                "Can I return the product if it doesn't meet my expectations?",
                "Absolutely! We offer a hassle-free return policy. If you're not completely satisfied, you can return the product within [number of days] days for a full refund or exchange."
            ],
            [
                'difference',
                'What makes your product stand out from others in the market?',
                'Our product distinguishes itself through its adaptability, durability, and innovative features. We prioritize user satisfaction and continually strive to exceed expectations in every aspect.'
            ],
            [
                'warranty',
                'Is there a warranty on the product, and what does it cover?',
                'Yes, our product comes with a [length of warranty] warranty. It covers defects in materials and workmanship. If you encounter any issues covered by the warranty, please contact our customer support for assistance.'
            ]
        ],
        'FAQ copy baseline changed'
    )

    const pricing = seed.elements?.MarketingPagePricing ?? []
    const pricingBenefits = seed.elements?.MarketingPagePricingBenefit ?? []
    assert.deepEqual(
        pricing.map((element) => {
            const data = readData(element)
            return [
                data.TierKey,
                readLocalized(data.Title).en,
                data.Price,
                readLocalized(data.Period).en,
                readLocalized(data.ActionLabel).en,
                data.ActionHref,
                data.Featured
            ]
        }),
        [
            ['free', 'Free', 0, 'per month', 'Sign up for free', '/sign-up', false],
            ['professional', 'Professional', 15, 'per month', 'Start now', '/sign-up', true],
            ['enterprise', 'Enterprise', 30, 'per month', 'Contact us', '/contact', false]
        ],
        'pricing tier baseline changed'
    )
    assert.deepEqual(
        pricingBenefits.map((element) => {
            const data = readData(element)
            return [data.BenefitKey, data.TierRef, readLocalized(data.Label).en, data.SortOrder]
        }),
        [
            ['free-benefit-1', 'free', '10 users included', 1],
            ['free-benefit-2', 'free', '2 GB of storage', 2],
            ['free-benefit-3', 'free', 'Help center access', 3],
            ['free-benefit-4', 'free', 'Email support', 4],
            ['professional-benefit-1', 'professional', '20 users included', 1],
            ['professional-benefit-2', 'professional', '10 GB of storage', 2],
            ['professional-benefit-3', 'professional', 'Help center access', 3],
            ['professional-benefit-4', 'professional', 'Priority email support', 4],
            ['professional-benefit-5', 'professional', 'Dedicated team', 5],
            ['professional-benefit-6', 'professional', 'Best deals', 6],
            ['enterprise-benefit-1', 'enterprise', '50 users included', 1],
            ['enterprise-benefit-2', 'enterprise', '30 GB of storage', 2],
            ['enterprise-benefit-3', 'enterprise', 'Help center access', 3],
            ['enterprise-benefit-4', 'enterprise', 'Phone & email support', 4]
        ],
        'pricing benefit baseline changed'
    )

    const footerLinks = seed.elements?.MarketingPageFooterLink ?? []
    assert.deepEqual(
        footerLinks.map((element) => readData(element).LinkKey),
        [
            'product-features',
            'product-testimonials',
            'product-highlights',
            'product-pricing',
            'product-faq',
            'company-about',
            'company-careers',
            'company-press',
            'legal-terms',
            'legal-privacy',
            'legal-contact',
            'social-github',
            'social-x',
            'social-linkedin'
        ],
        'footer link semantic keys changed'
    )
    assert.deepEqual(
        footerLinks.map((element) => {
            const data = readData(element)
            return [
                data.LinkKey,
                data.GroupKey,
                readLocalized(data.Label).en,
                readLocalized(data.BottomLabel).en ?? null,
                data.Href,
                data.IconKey ?? null
            ]
        }),
        [
            ['product-features', 'product', 'Features', null, '#features', null],
            ['product-testimonials', 'product', 'Testimonials', null, '#testimonials', null],
            ['product-highlights', 'product', 'Highlights', null, '#highlights', null],
            ['product-pricing', 'product', 'Pricing', null, '#pricing', null],
            ['product-faq', 'product', 'FAQs', null, '#faq', null],
            ['company-about', 'company', 'About us', null, '/about', null],
            ['company-careers', 'company', 'Careers', null, '/careers', null],
            ['company-press', 'company', 'Press', null, '/press', null],
            ['legal-terms', 'legal', 'Terms', 'Terms of Service', '/terms', null],
            ['legal-privacy', 'legal', 'Privacy', 'Privacy Policy', '/privacy', null],
            ['legal-contact', 'legal', 'Contact', null, '/contact', null],
            ['social-github', 'social', 'GitHub', null, 'https://github.com/mui', 'github'],
            ['social-x', 'social', 'X', null, 'https://x.com/MaterialUI', 'x'],
            ['social-linkedin', 'social', 'LinkedIn', null, 'https://www.linkedin.com/company/mui/', 'linkedin']
        ],
        'footer links baseline changed'
    )

    const benefitCounts = new Map<string, number>()
    for (const element of pricingBenefits) {
        const data = readData(element)
        const tier = readString(data.TierRef, 'pricing benefit TierRef')
        benefitCounts.set(tier, (benefitCounts.get(tier) ?? 0) + 1)
        assert.ok(data.Label && typeof data.Label === 'object', 'pricing benefits must be localized records')
    }
    assert.deepEqual(
        Object.fromEntries(benefitCounts),
        { free: 4, professional: 6, enterprise: 4 },
        'pricing benefit relation counts changed'
    )

    const pricingEntity = entities.find((entity) => entity.codename === 'MarketingPagePricing')
    assert.ok(pricingEntity, 'pricing entity is required')
    const pricingComponents = (pricingEntity.components ?? []) as Array<Record<string, unknown>>
    assert.equal(
        pricingComponents.some((component) => component.codename === 'Benefits'),
        false,
        'pricing benefits must remain linked records, not a JSON/component array'
    )
}

export const MARKETING_PAGE_EXPECTED_ELEMENT_COUNTS = EXPECTED_ELEMENT_COUNTS
