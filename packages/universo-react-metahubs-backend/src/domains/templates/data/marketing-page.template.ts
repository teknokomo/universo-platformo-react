import type {
    MetahubTemplateManifest,
    TemplateSeedComponent,
    TemplateSeedElement,
    TemplateSeedEntity,
    TemplateSeedZoneWidget,
    VersionedLocalizedContent
} from '@universo-react/types'
import { enrichConfigWithVlcTimestamps, vlc } from './basic.template'

/**
 * Store media as the canonical ResourceSource payload.  The runtime resolves
 * the source into a safe MarketingMedia record and the generic authoring form
 * can therefore render the resource-source picker instead of a raw URL field.
 */
const resourceSource = (url: string) => ({ type: 'url' as const, url, launchMode: 'inline' as const })

const marketingComponent = (
    codename: string,
    nameEn: string,
    nameRu: string,
    options: Partial<Omit<TemplateSeedComponent, 'codename' | 'name'>> = {}
): TemplateSeedComponent => ({
    codename,
    name: vlc(nameEn, nameRu),
    dataType: 'STRING',
    ...options
})

const mediaComponent = (codename: string, nameEn: string, nameRu: string): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'JSON',
        uiConfig: { widget: 'resourceSource', gridHidden: true }
    })

const localizedComponent = (codename: string, nameEn: string, nameRu: string, maxLength = 500): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        validationRules: { maxLength, localized: true, versioned: true }
    })

const plainComponent = (codename: string, nameEn: string, nameRu: string, maxLength = 500): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        validationRules: { maxLength }
    })

const sectionComponents: TemplateSeedComponent[] = [
    plainComponent('SectionKey', 'Section key', 'Ключ секции', 64),
    localizedComponent('Title', 'Title', 'Заголовок', 255),
    localizedComponent('Description', 'Description', 'Описание', 2000)
]

const sectionElements: TemplateSeedElement[] = [
    {
        codename: 'hero',
        sortOrder: 1,
        data: {
            SectionKey: 'hero',
            Title: vlc('Our latest products', 'Наши новые продукты'),
            Description: vlc(
                'Primary hero content is managed by the marketing hero object.',
                'Основное содержимое первого экрана управляется объектом первого экрана.'
            )
        }
    },
    {
        codename: 'logos',
        sortOrder: 2,
        data: {
            SectionKey: 'logos',
            Title: vlc('Trusted by the best companies', 'Нам доверяют лучшие компании'),
            Description: vlc('Customer logos from the marketing page content.', 'Логотипы клиентов из содержимого маркетинговой страницы.')
        }
    },
    {
        codename: 'features',
        sortOrder: 3,
        data: {
            SectionKey: 'features',
            Title: vlc('Product features', 'Возможности продукта'),
            Description: vlc(
                'Provide a brief overview of the key features of the product. For example, you could list the number of features, their types or benefits, and add-ons.',
                'Кратко расскажите о ключевых возможностях продукта: их количестве, типах, преимуществах и дополнительных опциях.'
            )
        }
    },
    {
        codename: 'testimonials',
        sortOrder: 4,
        data: {
            SectionKey: 'testimonials',
            Title: vlc('Testimonials', 'Отзывы'),
            Description: vlc(
                'See what our customers love about our products. Discover how we excel in efficiency, durability, and satisfaction. Join us for quality, innovation, and reliable support.',
                'Узнайте, что клиентам нравится в наших продуктах. Мы уделяем внимание эффективности, надёжности и качеству поддержки.'
            )
        }
    },
    {
        codename: 'highlights',
        sortOrder: 5,
        data: {
            SectionKey: 'highlights',
            Title: vlc('Highlights', 'Преимущества'),
            Description: vlc(
                'Explore why our product stands out: adaptability, durability, user-friendly design, and innovation. Enjoy reliable customer support and precision in every detail.',
                'Узнайте, чем продукт выделяется: адаптивностью, надёжностью, удобством, инновациями и вниманием к деталям.'
            )
        }
    },
    {
        codename: 'pricing',
        sortOrder: 6,
        data: {
            SectionKey: 'pricing',
            Title: vlc('Pricing', 'Тарифы'),
            Description: vlc(
                "Quickly build an effective pricing table for your potential customers with this layout. It's built with default Material UI components with little customization.",
                'Создайте понятную таблицу тарифов для потенциальных клиентов на базе стандартных компонентов Material UI.'
            )
        }
    },
    {
        codename: 'faq',
        sortOrder: 7,
        data: {
            SectionKey: 'faq',
            Title: vlc('Frequently asked questions', 'Часто задаваемые вопросы'),
            Description: vlc('Answers to the most common questions about the product.', 'Ответы на самые частые вопросы о продукте.')
        }
    },
    {
        codename: 'footer',
        sortOrder: 8,
        data: {
            SectionKey: 'footer',
            Title: vlc('Footer', 'Подвал'),
            Description: vlc('Footer branding and newsletter content.', 'Брендинг подвала и содержимое рассылки.')
        }
    }
]

const logoComponents: TemplateSeedComponent[] = [
    plainComponent('LogoKey', 'Logo key', 'Ключ логотипа', 64),
    mediaComponent('ImageLight', 'Light logo', 'Логотип для светлой темы'),
    mediaComponent('ImageDark', 'Dark logo', 'Логотип для тёмной темы'),
    localizedComponent('AltText', 'Alternative text', 'Альтернативный текст', 255),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const logoSources = [
    [
        'sydney',
        'Sydney',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/6560628889c3bdf1129952dc_Sydney-black.svg',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/6560628e8573c43893fe0ace_Sydney-white.svg'
    ],
    [
        'bern',
        'Bern',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f4d4d8b829a89976a419c_Bern-black.svg',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f4d520d0517ae8e8ddf13_Bern-white.svg'
    ],
    [
        'montreal',
        'Montreal',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f467502f091ccb929529d_Montreal-black.svg',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f46794c159024c1af6d44_Montreal-white.svg'
    ],
    [
        'terra',
        'Terra',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/61f12e911fa22f2203d7514c_TerraDark.svg',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/61f12e891fa22f89efd7477a_TerraLight.svg'
    ],
    [
        'colorado',
        'Colorado',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/6560a0990f3717787fd49245_colorado-black.svg',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/6560a09d1f6337b1dfed14ab_colorado-white.svg'
    ],
    [
        'ankara',
        'Ankara',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f5ca4e548b0deb1041c33_Ankara-black.svg',
        'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f5caa77bf7d69fb78792e_Ankara-white.svg'
    ]
] as const

const logoElements: TemplateSeedElement[] = logoSources.map(([key, label, imageLight, imageDark], index) => ({
    codename: key,
    sortOrder: index + 1,
    data: {
        LogoKey: key,
        ImageLight: resourceSource(imageLight),
        ImageDark: resourceSource(imageDark),
        AltText: vlc(`${label} customer logo`, `Логотип клиента ${label}`),
        SortOrder: index + 1,
        IsVisible: true
    }
}))

const featureComponents: TemplateSeedComponent[] = [
    plainComponent('FeatureKey', 'Feature key', 'Ключ возможности', 64),
    plainComponent('IconKey', 'Icon key', 'Ключ иконки', 64),
    localizedComponent('Title', 'Title', 'Заголовок', 255),
    localizedComponent('Description', 'Description', 'Описание', 1000),
    mediaComponent('ImageLight', 'Light image', 'Изображение для светлой темы'),
    mediaComponent('ImageDark', 'Dark image', 'Изображение для тёмной темы'),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const featureElements: TemplateSeedElement[] = [
    {
        codename: 'dashboard',
        sortOrder: 1,
        data: {
            FeatureKey: 'dashboard',
            IconKey: 'ViewQuiltRounded',
            Title: vlc('Dashboard', 'Панель управления'),
            Description: vlc(
                'This item could provide a snapshot of the most important metrics or data points related to the product.',
                'Сводка ключевых показателей и данных продукта.'
            ),
            ImageLight: resourceSource('https://mui.com/static/images/templates/templates-images/dash-light.png'),
            ImageDark: resourceSource('https://mui.com/static/images/templates/templates-images/dash-dark.png'),
            SortOrder: 1,
            IsVisible: true
        }
    },
    {
        codename: 'mobile',
        sortOrder: 2,
        data: {
            FeatureKey: 'mobile',
            IconKey: 'EdgesensorHighRounded',
            Title: vlc('Mobile integration', 'Мобильная интеграция'),
            Description: vlc(
                'This item could provide information about the mobile app version of the product.',
                'Информация о мобильной версии продукта.'
            ),
            ImageLight: resourceSource('https://mui.com/static/images/templates/templates-images/mobile-light.png'),
            ImageDark: resourceSource('https://mui.com/static/images/templates/templates-images/mobile-dark.png'),
            SortOrder: 2,
            IsVisible: true
        }
    },
    {
        codename: 'platforms',
        sortOrder: 3,
        data: {
            FeatureKey: 'platforms',
            IconKey: 'DevicesRounded',
            Title: vlc('Available on all platforms', 'Доступно на всех платформах'),
            Description: vlc(
                'This item could let users know the product is available on all platforms, such as web, mobile, and desktop.',
                'Продукт доступен в веб-, мобильной и десктопной версиях.'
            ),
            ImageLight: resourceSource('https://mui.com/static/images/templates/templates-images/devices-light.png'),
            ImageDark: resourceSource('https://mui.com/static/images/templates/templates-images/devices-dark.png'),
            SortOrder: 3,
            IsVisible: true
        }
    }
]

const testimonialComponents: TemplateSeedComponent[] = [
    plainComponent('TestimonialKey', 'Testimonial key', 'Ключ отзыва', 64),
    localizedComponent('Name', 'Name', 'Имя', 255),
    localizedComponent('Occupation', 'Occupation', 'Должность', 255),
    localizedComponent('Quote', 'Quote', 'Отзыв', 2000),
    mediaComponent('AvatarUrl', 'Avatar', 'Аватар'),
    mediaComponent('LogoLightUrl', 'Light logo', 'Логотип для светлой темы'),
    mediaComponent('LogoDarkUrl', 'Dark logo', 'Логотип для тёмной темы'),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const testimonialSeed = [
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

const testimonialRussian: Record<string, readonly [string, string, string]> = {
    remy: [
        'Реми Шарп',
        'Старший инженер',
        'Мне очень нравится универсальность этого продукта! Он одинаково хорошо подходит для рабочих проектов и личных задач.'
    ],
    travis: [
        'Трэвис Ховард',
        'Ведущий продуктовый дизайнер',
        'Одна из лучших сторон продукта — исключительная поддержка: команда отвечает быстро и действительно помогает.'
    ],
    cindy: ['Синди Бейкер', 'Технический директор', 'Простота и удобство продукта заметно упростили мою повседневную работу.'],
    julia: ['Джулия Стюарт', 'Старший инженер', 'Внимание к деталям в дизайне создаёт большую разницу и ощущение премиального опыта.'],
    john: [
        'Джон Смит',
        'Продуктовый дизайнер',
        'Продукт выделяется инновационными возможностями и вниманием к потребностям пользователей.'
    ],
    daniel: [
        'Дэниел Вулф',
        'Директор по данным',
        'Качество продукта превзошло мои ожидания: он надёжный, продуманный и рассчитан на долгую работу.'
    ]
}

const testimonialElements: TemplateSeedElement[] = testimonialSeed.map(([key, name, occupation, quote], index) => {
    const [nameRu, occupationRu, quoteRu] = testimonialRussian[key]
    return {
        codename: key,
        sortOrder: index + 1,
        data: {
            TestimonialKey: key,
            Name: vlc(name, nameRu),
            Occupation: vlc(occupation, occupationRu),
            Quote: vlc(quote, quoteRu),
            AvatarUrl: resourceSource(`https://mui.com/static/images/avatar/${index + 1}.jpg`),
            LogoLightUrl: logoElements[index].data.ImageLight,
            LogoDarkUrl: logoElements[index].data.ImageDark,
            SortOrder: index + 1,
            IsVisible: true
        }
    }
})

const highlightComponents: TemplateSeedComponent[] = [
    plainComponent('HighlightKey', 'Highlight key', 'Ключ преимущества', 64),
    plainComponent('IconKey', 'Icon key', 'Ключ иконки', 64),
    localizedComponent('Title', 'Title', 'Заголовок', 255),
    localizedComponent('Description', 'Description', 'Описание', 1000),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const highlightSeed = [
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

const highlightRussian: Record<string, readonly [string, string]> = {
    adaptable: ['Адаптивная производительность', 'Продукт легко подстраивается под ваши задачи, повышая эффективность и упрощая работу.'],
    durable: ['Надёжность на годы', 'Исключительная прочность обеспечивает долгосрочную ценность продукта.'],
    experience: ['Удобство использования', 'Интуитивный интерфейс легко вписывается в повседневные задачи.'],
    innovative: ['Инновационные возможности', 'Современные функции отвечают меняющимся потребностям пользователей.'],
    support: ['Надёжная поддержка', 'Оперативная команда помогает и после покупки продукта.'],
    precision: ['Точность в каждой детали', 'Продуманные мелочи заметно улучшают общее впечатление от продукта.']
}

const highlightElements: TemplateSeedElement[] = highlightSeed.map(([key, icon, title, description], index) => ({
    codename: key,
    sortOrder: index + 1,
    data: (() => {
        const [titleRu, descriptionRu] = highlightRussian[key]
        return {
            HighlightKey: key,
            IconKey: icon,
            Title: vlc(title, titleRu),
            Description: vlc(description, descriptionRu),
            SortOrder: index + 1,
            IsVisible: true
        }
    })()
}))

const pricingComponents: TemplateSeedComponent[] = [
    plainComponent('TierKey', 'Tier key', 'Ключ тарифа', 64),
    localizedComponent('Title', 'Title', 'Заголовок', 255),
    localizedComponent('Subheader', 'Subheader', 'Подзаголовок', 255),
    marketingComponent('Price', 'Price', 'Цена', {
        dataType: 'NUMBER',
        validationRules: { min: 0, max: 1000000, precision: 10, scale: 2 }
    }),
    localizedComponent('Period', 'Billing period', 'Период оплаты', 120),
    localizedComponent('ActionLabel', 'Action label', 'Подпись кнопки', 120),
    plainComponent('ActionHref', 'Action target', 'Цель кнопки', 500),
    marketingComponent('Featured', 'Featured', 'Рекомендуемый', { dataType: 'BOOLEAN' }),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const pricingBenefitComponents: TemplateSeedComponent[] = [
    plainComponent('BenefitKey', 'Benefit key', 'Ключ преимущества', 128),
    marketingComponent('TierRef', 'Pricing tier', 'Тариф', {
        dataType: 'REF',
        isRequired: true,
        targetEntityCodename: 'MarketingPagePricing',
        targetEntityKind: 'object'
    }),
    localizedComponent('Label', 'Label', 'Подпись', 255),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const pricingSeed = [
    [
        'free',
        'Free',
        0,
        ['10 users included', '2 GB of storage', 'Help center access', 'Email support'],
        'Sign up for free',
        '/sign-up',
        false
    ],
    [
        'professional',
        'Professional',
        15,
        ['20 users included', '10 GB of storage', 'Help center access', 'Priority email support', 'Dedicated team', 'Best deals'],
        'Start now',
        '/sign-up',
        true
    ],
    [
        'enterprise',
        'Enterprise',
        30,
        ['50 users included', '30 GB of storage', 'Help center access', 'Phone & email support'],
        'Contact us',
        '/contact',
        false
    ]
] as const

const pricingRussian: Record<string, { title: string; benefits: readonly string[]; actionLabel: string }> = {
    free: {
        title: 'Бесплатный',
        benefits: ['10 пользователей', '2 ГБ хранилища', 'Доступ к центру помощи', 'Поддержка по email'],
        actionLabel: 'Зарегистрироваться бесплатно'
    },
    professional: {
        title: 'Профессиональный',
        benefits: [
            '20 пользователей',
            '10 ГБ хранилища',
            'Доступ к центру помощи',
            'Приоритетная поддержка по email',
            'Выделенная команда',
            'Лучшие предложения'
        ],
        actionLabel: 'Начать сейчас'
    },
    enterprise: {
        title: 'Корпоративный',
        benefits: ['50 пользователей', '30 ГБ хранилища', 'Доступ к центру помощи', 'Поддержка по телефону и email'],
        actionLabel: 'Связаться с нами'
    }
}

const pricingElements: TemplateSeedElement[] = pricingSeed.map(([key, title, price, , actionLabel, actionHref, featured], index) => {
    const localizedTier = pricingRussian[key]
    return {
        codename: key,
        sortOrder: index + 1,
        data: {
            TierKey: key,
            Title: vlc(title, localizedTier.title),
            ...(featured ? { Subheader: vlc('Recommended', 'Рекомендуемый') } : {}),
            Price: price,
            Period: vlc('per month', 'в месяц'),
            ActionLabel: vlc(actionLabel, localizedTier.actionLabel),
            ActionHref: actionHref,
            Featured: featured,
            SortOrder: index + 1,
            IsVisible: true
        }
    }
})

let pricingBenefitSortOrder = 0
const pricingBenefitElements: TemplateSeedElement[] = pricingSeed.flatMap(([tierKey, , , benefits]) =>
    benefits.map((benefit, index) => {
        pricingBenefitSortOrder += 1
        return {
            codename: `${tierKey}-benefit-${index + 1}`,
            // `_mhb_elements` enforces a unique sort order per object. Keep
            // the persisted row order globally unique while retaining the
            // per-tier order in the SortOrder component used by the runtime.
            sortOrder: pricingBenefitSortOrder,
            data: {
                BenefitKey: `${tierKey}-benefit-${index + 1}`,
                TierRef: tierKey,
                Label: vlc(benefit, pricingRussian[tierKey].benefits[index] ?? benefit),
                SortOrder: index + 1,
                IsVisible: true
            }
        }
    })
)

const faqComponents: TemplateSeedComponent[] = [
    plainComponent('FaqKey', 'FAQ key', 'Ключ вопроса', 64),
    localizedComponent('Question', 'Question', 'Вопрос', 500),
    localizedComponent('Answer', 'Answer', 'Ответ', 2000),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const faqSeed = [
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
] as const

const faqRussian: Record<string, readonly [string, string]> = {
    support: [
        'Как связаться с поддержкой, если у меня есть вопрос или проблема?',
        'Свяжитесь с нашей службой поддержки по адресу support@email.com или по бесплатному номеру телефона. Мы постараемся быстро помочь.'
    ],
    returns: [
        'Можно ли вернуть продукт, если он не оправдал ожиданий?',
        'Конечно! Мы предлагаем удобный возврат. Если вы не полностью довольны покупкой, верните продукт в течение [количество дней] дней для полного возврата средств или обмена.'
    ],
    difference: [
        'Чем ваш продукт отличается от других предложений на рынке?',
        'Наш продукт сочетает адаптивность, надёжность и инновационные возможности. Мы ставим удовлетворённость пользователей на первое место и постоянно улучшаем каждую деталь.'
    ],
    warranty: [
        'Есть ли у продукта гарантия и что она покрывает?',
        'Да, на продукт распространяется гарантия сроком [срок гарантии]. Она покрывает дефекты материалов и изготовления. По вопросам гарантии обратитесь в службу поддержки.'
    ]
}

const faqElements: TemplateSeedElement[] = faqSeed.map(([key, question, answer], index) => {
    const [questionRu, answerRu] = faqRussian[key]
    return {
        codename: key,
        sortOrder: index + 1,
        data: {
            FaqKey: key,
            Question: vlc(question, questionRu),
            Answer: vlc(answer, answerRu),
            SortOrder: index + 1,
            IsVisible: true
        }
    }
})

const navigationComponents: TemplateSeedComponent[] = [
    plainComponent('NavKey', 'Navigation key', 'Ключ навигации', 64),
    localizedComponent('Label', 'Label', 'Подпись', 120),
    plainComponent('Href', 'Target', 'Цель', 500),
    plainComponent('SectionKey', 'Section key', 'Ключ секции', 64),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const navigationSeed: TemplateSeedElement[] = [
    ['features', 'Features', 'Возможности', '#features', 'features'],
    ['testimonials', 'Testimonials', 'Отзывы', '#testimonials', 'testimonials'],
    ['highlights', 'Highlights', 'Преимущества', '#highlights', 'highlights'],
    ['pricing', 'Pricing', 'Тарифы', '#pricing', 'pricing'],
    ['faq', 'FAQ', 'FAQ', '#faq', 'faq'],
    ['blog', 'Blog', 'Блог', '/blog', '']
].map(([key, labelEn, labelRu, href, sectionKey], index) => ({
    codename: key,
    sortOrder: index + 1,
    data: {
        NavKey: key,
        Label: vlc(labelEn, labelRu),
        Href: href,
        ...(sectionKey ? { SectionKey: sectionKey } : {}),
        SortOrder: index + 1,
        IsVisible: true
    }
}))

const footerLinkComponents: TemplateSeedComponent[] = [
    plainComponent('LinkKey', 'Link key', 'Ключ ссылки', 128),
    plainComponent('GroupKey', 'Group key', 'Ключ группы', 64),
    localizedComponent('GroupTitle', 'Group title', 'Название группы', 120),
    localizedComponent('Label', 'Label', 'Подпись', 120),
    localizedComponent('BottomLabel', 'Bottom label', 'Подпись в нижней строке', 120),
    plainComponent('Href', 'Target', 'Цель', 500),
    plainComponent('IconKey', 'Icon key', 'Ключ иконки', 64),
    marketingComponent('SortOrder', 'Order', 'Порядок', { dataType: 'NUMBER', validationRules: { min: 0, max: 100 } }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const siteSettingsComponents: TemplateSeedComponent[] = [
    localizedComponent('BrandName', 'Brand name', 'Название бренда', 255),
    mediaComponent('BrandLogo', 'Brand logo', 'Логотип бренда'),
    localizedComponent('HeroTitle', 'Hero title', 'Заголовок первого экрана', 255),
    localizedComponent('HeroAccent', 'Hero accent', 'Акцент первого экрана', 120),
    localizedComponent('HeroSubtitle', 'Hero subtitle', 'Подзаголовок первого экрана', 2000),
    localizedComponent('HeroEmailLabel', 'Hero email label', 'Подпись email первого экрана', 120),
    localizedComponent('HeroEmailPlaceholder', 'Hero email placeholder', 'Подсказка email первого экрана', 120),
    localizedComponent('HeroPrimaryActionLabel', 'Hero primary action label', 'Подпись основной кнопки первого экрана', 120),
    plainComponent('HeroPrimaryActionHref', 'Hero primary action target', 'Цель основной кнопки первого экрана', 500),
    localizedComponent('HeroTermsText', 'Hero terms text', 'Текст условий первого экрана', 500),
    localizedComponent('HeroTermsLinkLabel', 'Hero terms link label', 'Подпись ссылки условий первого экрана', 120),
    plainComponent('HeroTermsHref', 'Hero terms target', 'Цель условий первого экрана', 500),
    mediaComponent('HeroLightPreview', 'Light hero preview', 'Предпросмотр первого экрана для светлой темы'),
    mediaComponent('HeroDarkPreview', 'Dark hero preview', 'Предпросмотр первого экрана для тёмной темы'),
    localizedComponent('FooterDescription', 'Footer description', 'Описание подвала', 1000),
    localizedComponent('CopyrightText', 'Copyright text', 'Текст авторских прав', 500),
    localizedComponent('CopyrightLabel', 'Copyright brand label', 'Подпись бренда авторских прав', 255),
    plainComponent('CopyrightHref', 'Copyright brand target', 'Цель ссылки бренда авторских прав', 500),
    localizedComponent('NewsletterTitle', 'Newsletter title', 'Заголовок рассылки', 255),
    localizedComponent('NewsletterDescription', 'Newsletter description', 'Описание рассылки', 1000),
    localizedComponent('NewsletterLabel', 'Newsletter label', 'Подпись рассылки', 255),
    localizedComponent('NewsletterPlaceholder', 'Newsletter placeholder', 'Подсказка рассылки', 255),
    localizedComponent('NewsletterActionLabel', 'Newsletter action label', 'Подпись кнопки рассылки', 120),
    plainComponent('NewsletterActionHref', 'Newsletter action target', 'Цель кнопки рассылки', 500),
    localizedComponent('NewsletterSuccessMessage', 'Newsletter success message', 'Сообщение об успешной подписке', 500),
    localizedComponent('NewsletterErrorMessage', 'Newsletter error message', 'Сообщение об ошибке подписки', 500),
    marketingComponent('NewsletterEnabled', 'Newsletter enabled', 'Рассылка включена', { dataType: 'BOOLEAN' }),
    marketingComponent('IsVisible', 'Visible', 'Видимость', { dataType: 'BOOLEAN', isRequired: true })
]

const siteSettingsElements: TemplateSeedElement[] = [
    {
        codename: 'site-settings',
        sortOrder: 1,
        data: {
            BrandName: vlc('Material UI', 'Material UI'),
            HeroTitle: vlc('Our latest', 'Наши новые'),
            HeroAccent: vlc('products', 'продукты'),
            HeroSubtitle: vlc(
                'Explore our cutting-edge dashboard, delivering high-quality solutions tailored to your needs. Elevate your experience with top-tier features and services.',
                'Изучите современную панель управления с качественными решениями, адаптированными под ваши задачи.'
            ),
            HeroEmailLabel: vlc('Email', 'Электронная почта'),
            HeroEmailPlaceholder: vlc('Your email address', 'Ваш адрес электронной почты'),
            HeroPrimaryActionLabel: vlc('Start now', 'Начать'),
            HeroPrimaryActionHref: '/sign-up',
            HeroTermsText: vlc('By clicking "Start now" you agree to our', 'Нажимая «Начать», вы соглашаетесь с нашими'),
            HeroTermsLinkLabel: vlc('Terms & Conditions', 'Условиями использования'),
            HeroTermsHref: '/terms',
            HeroLightPreview: resourceSource('https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg'),
            HeroDarkPreview: resourceSource('https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard-dark.jpg'),
            CopyrightText: vlc('Copyright ©', 'Copyright ©'),
            CopyrightLabel: vlc('Sitemark', 'Sitemark'),
            CopyrightHref: 'https://mui.com/',
            NewsletterTitle: vlc('Join the newsletter', 'Подпишитесь на рассылку'),
            NewsletterDescription: vlc('Subscribe for weekly updates. No spams ever!', 'Получайте еженедельные обновления без спама.'),
            NewsletterLabel: vlc('Email', 'Электронная почта'),
            NewsletterPlaceholder: vlc('Your email address', 'Ваш адрес электронной почты'),
            NewsletterActionLabel: vlc('Subscribe', 'Подписаться'),
            NewsletterActionHref: '/sign-up',
            NewsletterSuccessMessage: vlc('Thanks for subscribing!', 'Спасибо за подписку!'),
            NewsletterErrorMessage: vlc('Subscription could not be completed.', 'Не удалось оформить подписку.'),
            NewsletterEnabled: true,
            IsVisible: true
        }
    }
]

const footerLinkSeed = [
    ['product-features', 'product', 'Product', 'Продукт', 'Features', 'Возможности', '#features'],
    ['product-testimonials', 'product', 'Product', 'Продукт', 'Testimonials', 'Отзывы', '#testimonials'],
    ['product-highlights', 'product', 'Product', 'Продукт', 'Highlights', 'Преимущества', '#highlights'],
    ['product-pricing', 'product', 'Product', 'Продукт', 'Pricing', 'Тарифы', '#pricing'],
    ['product-faq', 'product', 'Product', 'Продукт', 'FAQs', 'Частые вопросы', '#faq'],
    ['company-about', 'company', 'Company', 'Компания', 'About us', 'О нас', '/about'],
    ['company-careers', 'company', 'Company', 'Компания', 'Careers', 'Карьера', '/careers'],
    ['company-press', 'company', 'Company', 'Компания', 'Press', 'Пресса', '/press'],
    ['legal-terms', 'legal', 'Legal', 'Правовая информация', 'Terms', 'Условия', '/terms'],
    ['legal-privacy', 'legal', 'Legal', 'Правовая информация', 'Privacy', 'Конфиденциальность', '/privacy'],
    ['legal-contact', 'legal', 'Legal', 'Правовая информация', 'Contact', 'Контакты', '/contact'],
    ['social-github', 'social', 'Social', 'Социальные сети', 'GitHub', 'GitHub', 'https://github.com/mui', 'github'],
    ['social-x', 'social', 'Social', 'Социальные сети', 'X', 'X', 'https://x.com/MaterialUI', 'x'],
    ['social-linkedin', 'social', 'Social', 'Социальные сети', 'LinkedIn', 'LinkedIn', 'https://www.linkedin.com/company/mui/', 'linkedin']
] as const

const footerLinkElements: TemplateSeedElement[] = footerLinkSeed.map(
    ([key, groupKey, groupTitleEn, groupTitleRu, labelEn, labelRu, href, iconKey], index) => ({
        codename: key,
        sortOrder: index + 1,
        data: {
            LinkKey: key,
            GroupKey: groupKey,
            GroupTitle: vlc(groupTitleEn, groupTitleRu),
            Label: vlc(labelEn, labelRu),
            ...(key === 'legal-privacy'
                ? { BottomLabel: vlc('Privacy Policy', 'Политика конфиденциальности') }
                : key === 'legal-terms'
                ? { BottomLabel: vlc('Terms of Service', 'Условия использования') }
                : {}),
            Href: href,
            ...(iconKey ? { IconKey: iconKey } : {}),
            SortOrder: index + 1,
            IsVisible: true
        }
    })
)

const entities: TemplateSeedEntity[] = [
    {
        codename: 'MarketingPage',
        kind: 'hub',
        localizeCodenameFromName: false,
        name: vlc('Marketing page', 'Маркетинговая страница'),
        description: vlc('Root hub for the marketing page content.', 'Корневой раздел содержимого маркетинговой страницы.'),
        config: enrichConfigWithVlcTimestamps({ sortOrder: 0 })
    },
    {
        codename: 'MarketingPageSiteSettings',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Marketing site settings', 'Настройки маркетинговой страницы'),
        description: vlc(
            'Singleton branding, hero, newsletter, and legal settings for the published marketing page.',
            'Единичная запись с брендингом, первым экраном, рассылкой и правовыми настройками опубликованной маркетинговой страницы.'
        ),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'siteSettings' },
        components: siteSettingsComponents
    },
    {
        codename: 'MarketingPageSection',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Marketing sections', 'Секции маркетинговой страницы'),
        description: vlc(
            'Localized copy for the headings and descriptions consumed by marketing widgets.',
            'Локализованный текст заголовков и описаний, который используют маркетинговые виджеты.'
        ),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'section' },
        components: sectionComponents
    },
    {
        codename: 'MarketingPageLogo',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Customer logos', 'Логотипы клиентов'),
        description: vlc('Theme-aware customer logo metadata.', 'Метаданные логотипов клиентов для обеих тем.'),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'logo' },
        components: logoComponents
    },
    {
        codename: 'MarketingPageFeature',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Product features', 'Возможности продукта'),
        description: vlc(
            'Feature cards with an allow-listed icon and preview image.',
            'Карточки возможностей с разрешёнными иконками и изображениями.'
        ),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'feature' },
        components: featureComponents
    },
    {
        codename: 'MarketingPageTestimonial',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Testimonials', 'Отзывы'),
        description: vlc(
            'Localized customer testimonials and safe logo metadata.',
            'Локализованные отзывы клиентов и безопасные метаданные логотипов.'
        ),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'testimonial' },
        components: testimonialComponents
    },
    {
        codename: 'MarketingPageHighlight',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Highlights', 'Преимущества'),
        description: vlc('Dark-section highlight cards.', 'Карточки преимуществ в тёмной секции.'),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'highlight' },
        components: highlightComponents
    },
    {
        codename: 'MarketingPagePricing',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Pricing tiers', 'Тарифы'),
        description: vlc('Pricing tiers and action targets.', 'Тарифы и цели действий.'),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'pricing' },
        components: pricingComponents
    },
    {
        codename: 'MarketingPagePricingBenefit',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Pricing benefits', 'Преимущества тарифов'),
        description: vlc('Ordered benefits linked to a pricing tier.', 'Упорядоченные преимущества, связанные с тарифом.'),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'pricingBenefit' },
        components: pricingBenefitComponents
    },
    {
        codename: 'MarketingPageFaq',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Frequently asked questions', 'Часто задаваемые вопросы'),
        description: vlc('Localized FAQ items.', 'Локализованные вопросы и ответы.'),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'faq' },
        components: faqComponents
    },
    {
        codename: 'MarketingPageNavigation',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Marketing navigation', 'Навигация маркетинговой страницы'),
        description: vlc('Ordered safe navigation targets.', 'Упорядоченные безопасные цели навигации.'),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'navigation' },
        components: navigationComponents
    },
    {
        codename: 'MarketingPageFooterLink',
        kind: 'object',
        localizeCodenameFromName: false,
        name: vlc('Footer links', 'Ссылки в подвале'),
        description: vlc('Grouped footer navigation links.', 'Сгруппированные ссылки подвала.'),
        hubs: ['MarketingPage'],
        config: { recordBehavior: 'reference', marketingRole: 'footerLink' },
        components: footerLinkComponents
    }
]

const settings = [
    { key: 'general.language', value: { _value: 'system' } },
    { key: 'general.timezone', value: { _value: 'UTC' } },
    { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
    { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
    { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
    { key: 'general.codenameAutoConvertMixedAlphabets', value: { _value: true } },
    { key: 'general.codenameAutoReformat', value: { _value: true } },
    { key: 'general.codenameRequireReformat', value: { _value: true } },
    { key: 'entity.object.allowComponentCopy', value: { _value: true } },
    { key: 'entity.object.allowComponentDelete', value: { _value: true } },
    { key: 'entity.object.allowDeleteLastDisplayComponent', value: { _value: true } },
    { key: 'application.templateKey', value: { _value: 'marketing-page' } }
]

/**
 * The marketing page is composed exclusively from persisted widget instances.
 * Section rows are bound to the widget that consumes their localized copy;
 * they do not control top-level order or visibility.
 */
const marketingLayoutZoneWidgets: Record<string, TemplateSeedZoneWidget[]> = {
    'marketing-main': [
        {
            zone: 'marketing-header',
            widgetKey: 'marketing.navigation',
            sortOrder: 0,
            config: {
                instanceKey: 'navigation',
                source: { entityCodename: 'MarketingPageNavigation', entityKind: 'object' },
                maxItems: 24,
                showAuthActions: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            sortOrder: 0,
            config: {
                instanceKey: 'hero',
                source: {
                    entityCodename: 'MarketingPageSiteSettings',
                    entityKind: 'object',
                    recordKey: 'site-settings'
                },
                copySource: {
                    entityCodename: 'MarketingPageSection',
                    entityKind: 'object',
                    recordKey: 'hero'
                },
                showLeadForm: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 1,
            config: {
                instanceKey: 'logos',
                variant: 'logos',
                source: { entityCodename: 'MarketingPageLogo', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'logos' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 2,
            config: {
                instanceKey: 'features',
                variant: 'features',
                source: { entityCodename: 'MarketingPageFeature', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'features' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 3,
            config: {
                instanceKey: 'testimonials',
                variant: 'testimonials',
                source: { entityCodename: 'MarketingPageTestimonial', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'testimonials' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 4,
            config: {
                instanceKey: 'highlights',
                variant: 'highlights',
                source: { entityCodename: 'MarketingPageHighlight', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'highlights' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.pricing',
            sortOrder: 5,
            config: {
                instanceKey: 'pricing',
                source: { entityCodename: 'MarketingPagePricing', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'pricing' },
                maxItems: 24,
                showBenefits: true
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.collection',
            sortOrder: 6,
            config: {
                instanceKey: 'faq',
                variant: 'faq',
                source: { entityCodename: 'MarketingPageFaq', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'faq' },
                maxItems: 100,
                showTitle: true,
                showDescription: true
            },
            isActive: true
        },
        {
            zone: 'marketing-footer',
            widgetKey: 'marketing.footer',
            sortOrder: 0,
            config: {
                instanceKey: 'footer',
                source: { entityCodename: 'MarketingPageFooterLink', entityKind: 'object' },
                copySource: { entityCodename: 'MarketingPageSection', entityKind: 'object', recordKey: 'footer' },
                maxItems: 100,
                showNewsletter: true
            },
            isActive: true
        }
    ]
}

export const marketingPageTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'marketing-page',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('Marketing page', 'Маркетинговая страница'),
    description: vlc(
        'A ready-made marketing page for presenting a product, its benefits, plans, testimonials, and FAQs.',
        'Готовая маркетинговая страница для презентации продукта, преимуществ, тарифов, отзывов и ответов на частые вопросы.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['marketing', 'landing-page'],
        icon: 'Language'
    },
    presets: [
        { presetCodename: 'hub', includedByDefault: true },
        { presetCodename: 'page', includedByDefault: true },
        { presetCodename: 'object', includedByDefault: true },
        { presetCodename: 'set', includedByDefault: true },
        { presetCodename: 'enumeration', includedByDefault: true }
    ],
    seed: {
        layouts: [
            {
                codename: 'marketing-main',
                templateKey: 'marketing-page',
                name: vlc('Marketing page', 'Маркетинговая страница'),
                description: vlc('Main marketing page layout.', 'Основной макет маркетинговой страницы.'),
                isDefault: true,
                isActive: true,
                sortOrder: 0,
                config: enrichConfigWithVlcTimestamps({
                    themeMode: 'system'
                })
            }
        ],
        layoutZoneWidgets: marketingLayoutZoneWidgets,
        settings,
        entities,
        elements: {
            MarketingPageSection: sectionElements,
            MarketingPageSiteSettings: siteSettingsElements,
            MarketingPageLogo: logoElements,
            MarketingPageFeature: featureElements,
            MarketingPageTestimonial: testimonialElements,
            MarketingPageHighlight: highlightElements,
            MarketingPagePricing: pricingElements,
            MarketingPagePricingBenefit: pricingBenefitElements,
            MarketingPageFaq: faqElements,
            MarketingPageNavigation: navigationSeed,
            MarketingPageFooterLink: footerLinkElements
        }
    }
}

export type MarketingPageTemplateEntity = (typeof entities)[number]
export type MarketingPageTemplateLocalizedString = VersionedLocalizedContent<string>
