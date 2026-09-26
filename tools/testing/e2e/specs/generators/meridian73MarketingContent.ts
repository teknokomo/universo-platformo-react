import { MARKETING_DEFAULT_IMAGE_URL } from '@universo-react/types'

export type Meridian73LocalizedText = Readonly<{
    en: string
    ru: string
}>

export type Meridian73ContentCard = Readonly<{
    key: string
    title: Meridian73LocalizedText
    description: Meridian73LocalizedText
    iconKey?: string
}>

export type Meridian73PricingTier = Readonly<{
    key: string
    title: Meridian73LocalizedText
    description: Meridian73LocalizedText
    price: number
    period: Meridian73LocalizedText
    benefits: readonly Meridian73LocalizedText[]
}>

export const MERIDIAN_73_SOURCE = {
    path: '.backup/Лендинг-для-Консорциума.md',
    sha256: '9587951419350b4e0301e74e64ba8dc3ae099cd2b312ff3ddbced562d7ad2e7a'
} as const

export const MERIDIAN_73_IMAGE_URL = MARKETING_DEFAULT_IMAGE_URL

export const MERIDIAN_73_METAHUB = {
    name: {
        en: '73rd Meridian Consortium',
        ru: 'Консорциум «73-й Меридиан»'
    },
    codename: 'consortium-73rd-meridian',
    description: {
        en: "Digital platform for developing Eurasia's industrial and logistics potential",
        ru: 'Цифровая платформа развития индустриально-логистического потенциала Евразии'
    }
} as const

export const MERIDIAN_73_SITE_SETTINGS = {
    brandName: MERIDIAN_73_METAHUB.name,
    footerDescription: {
        en: 'We are open to dialogue with investors, technology companies, industrial partners, and experts.',
        ru: 'Мы открыты к диалогу с инвесторами, технологическими компаниями, промышленными партнёрами и экспертами.'
    },
    copyright: MERIDIAN_73_METAHUB.name
} as const

export const MERIDIAN_73_HERO = {
    title: {
        en: '73rd Meridian — a new North–South industrial and logistics corridor',
        ru: '73-й Меридиан — новый индустриально-логистический коридор Север–Юг'
    },
    accent: {
        en: 'Connecting Eurasia',
        ru: 'Объединяя Евразию'
    },
    description: {
        en: 'The Consortium brings together infrastructure projects, digital twins of territories, and intelligent management systems to develop international transport routes.',
        ru: 'Консорциум объединяет инфраструктурные проекты, цифровые двойники территорий и интеллектуальные системы управления для развития международных транспортных маршрутов.'
    }
} as const

export const MERIDIAN_73_SECTIONS = [
    {
        key: 'logos',
        title: { en: 'Partner ecosystem', ru: 'Партнёрская экосистема' },
        description: {
            en: 'The Consortium is open to cooperation with technology companies, development institutions, industrial enterprises, investors, and regional partners.',
            ru: 'Консорциум открыт к сотрудничеству с технологическими компаниями, институтами развития, промышленными предприятиями, инвесторами и региональными партнёрами.'
        }
    },
    {
        key: 'features',
        title: { en: 'Areas of activity', ru: 'Основные направления деятельности' },
        description: {
            en: 'The Consortium combines digital modeling, investment preparation, platform technologies, AI automation, and international cooperation.',
            ru: 'Консорциум объединяет цифровое моделирование, инвестиционную подготовку, платформенные технологии, ИИ-автоматизацию и международное сотрудничество.'
        }
    },
    {
        key: 'testimonials',
        title: { en: 'Expert vision', ru: 'Экспертное видение' },
        description: {
            en: 'Three dimensions of the Consortium concept: industrial potential, a technological foundation, and international scale.',
            ru: 'Три измерения концепции Консорциума: индустриальный потенциал, технологический фундамент и международный масштаб.'
        }
    },
    {
        key: 'highlights',
        title: { en: 'Why 73rd Meridian', ru: 'Почему «73-й Меридиан»' },
        description: {
            en: 'The project connects digital modeling, coordination, verified data, and engineering practices for large infrastructure initiatives.',
            ru: 'Проект объединяет цифровое моделирование, координацию, верифицированные данные и инженерные практики для крупных инфраструктурных инициатив.'
        }
    },
    {
        key: 'pricing',
        title: { en: 'Investment stages', ru: 'Инвестиционные стадии' },
        description: {
            en: 'Three project stages: from digital packaging to scaling across international markets.',
            ru: 'Три стадии развития проекта: от цифровой упаковки до масштабирования на международных рынках.'
        }
    },
    {
        key: 'faq',
        title: { en: 'Frequently asked questions', ru: 'Часто задаваемые вопросы' },
        description: {
            en: 'Core facts about the Consortium, its role, technologies, and potential partners.',
            ru: 'Основная информация о Консорциуме, его роли, технологиях и потенциальных партнёрах.'
        }
    },
    {
        key: 'footer',
        title: { en: 'Contacts', ru: 'Контакты' },
        description: {
            en: 'Building partnerships for the projects of the future.',
            ru: 'Создаём партнёрства для проектов будущего.'
        }
    }
] as const

export const MERIDIAN_73_PARTNER_CATEGORIES = [
    { key: 'development-institutions', label: { en: 'Development institutions', ru: 'Институты развития' } },
    { key: 'logistics-companies', label: { en: 'Logistics companies', ru: 'Логистические компании' } },
    { key: 'industrial-enterprises', label: { en: 'Industrial enterprises', ru: 'Промышленные предприятия' } },
    { key: 'it-teams', label: { en: 'IT teams', ru: 'ИТ-команды' } },
    { key: 'research-organizations', label: { en: 'Research organizations', ru: 'Научные организации' } },
    { key: 'regional-administrations', label: { en: 'Regional administrations', ru: 'Региональные администрации' } }
] as const

export const MERIDIAN_73_ACTIVITIES: readonly Meridian73ContentCard[] = [
    {
        key: 'territorial-digital-twins',
        iconKey: 'ViewQuiltRounded',
        title: { en: 'Digital twins of territories', ru: 'Цифровые двойники территорий' },
        description: {
            en: 'Interactive models of territories and infrastructure for development, logistics, and investment analysis.',
            ru: 'Интерактивные модели территорий и инфраструктуры для анализа развития, логистики и инвестиций.'
        }
    },
    {
        key: 'investment-packaging',
        iconKey: 'QueryStatsRounded',
        title: { en: 'Investment packaging of projects', ru: 'Инвестиционная упаковка проектов' },
        description: {
            en: 'Structured investment products: models, roadmaps, analytics, and digital data rooms.',
            ru: 'Структурированные инвестиционные продукты: модели, дорожные карты, аналитика и цифровые комнаты данных.'
        }
    },
    {
        key: 'universo-platformo',
        iconKey: 'DevicesRounded',
        title: { en: 'Universo Platformo', ru: 'Universo Platformo' },
        description: {
            en: "The Consortium's technology foundation: digital twins, project management, verified data, and AI agents.",
            ru: 'Технологическая основа Консорциума: цифровые двойники, управление проектами, верификация данных и ИИ-агенты.'
        }
    },
    {
        key: 'ai-agents-automation',
        iconKey: 'AutoAwesomeRounded',
        title: { en: 'AI agents and automation', ru: 'ИИ-агенты и автоматизация' },
        description: {
            en: 'Assistants for analytics, document preparation, project monitoring, and management decisions.',
            ru: 'Помощники для аналитики, подготовки документов, мониторинга проектов и управленческих решений.'
        }
    },
    {
        key: 'international-cooperation',
        iconKey: 'SettingsSuggestRounded',
        title: { en: 'International cooperation', ru: 'Международное сотрудничество' },
        description: {
            en: 'Mechanisms of interaction between investors, authorities, industry, and technology partners.',
            ru: 'Механизмы взаимодействия инвесторов, государственных структур, промышленности и технологических партнёров.'
        }
    }
]

export const MERIDIAN_73_EXPERT_VISION: readonly Meridian73ContentCard[] = [
    {
        key: 'industrial-potential',
        title: { en: 'Industrial potential', ru: 'Индустриальный потенциал' },
        description: {
            en: '“73rd Meridian” unites transport, industrial, and digital infrastructure into a single system for territorial development.',
            ru: '«73-й Меридиан» объединяет транспортную, промышленную и цифровую инфраструктуру в единую систему развития территорий.'
        }
    },
    {
        key: 'technological-foundation',
        title: { en: 'Technological foundation', ru: 'Технологический фундамент' },
        description: {
            en: 'Universo Platformo provides a foundation for moving from paper-based planning to modeling the future.',
            ru: 'Universo Platformo создаёт основу для перехода от бумажного планирования к моделированию будущего.'
        }
    },
    {
        key: 'international-scale',
        title: { en: 'International scale', ru: 'Международный масштаб' },
        description: {
            en: 'The project is oriented toward cooperation with participants in global transport and investment ecosystems.',
            ru: 'Проект ориентирован на сотрудничество с участниками глобальных транспортных и инвестиционных экосистем.'
        }
    }
]

export const MERIDIAN_73_REASONS: readonly Meridian73ContentCard[] = [
    {
        key: 'idea-to-investment-project',
        iconKey: 'QueryStatsRounded',
        title: { en: 'From idea to investment project', ru: 'От идеи к инвестиционному проекту' },
        description: {
            en: 'The Consortium reduces uncertainty in large projects through digital modeling and structuring.',
            ru: 'Консорциум снижает неопределённость крупных проектов благодаря цифровому моделированию и структурированию.'
        }
    },
    {
        key: 'asset-light-model',
        iconKey: 'SettingsSuggestRounded',
        title: { en: 'Asset-light model', ru: 'Asset-light модель' },
        description: {
            en: 'We do not build everything ourselves — we create a system for preparing, coordinating, and launching projects.',
            ru: 'Мы не строим всё самостоятельно — мы создаём систему подготовки, координации и запуска проектов.'
        }
    },
    {
        key: 'digital-infrastructure',
        iconKey: 'DevicesRounded',
        title: { en: 'Digital infrastructure', ru: 'Цифровая инфраструктура' },
        description: {
            en: 'The physical assets of the future begin with a digital model.',
            ru: 'Физические объекты будущего начинаются с цифровой модели.'
        }
    },
    {
        key: 'eurasian-scale',
        iconKey: 'AutoFixHighRounded',
        title: { en: 'Eurasian scale', ru: 'Евразийский масштаб' },
        description: {
            en: 'The Omsk hub is viewed as an intersection of the Northern Sea Route, the Trans-Siberian Railway, and the North–South meridional direction.',
            ru: 'Омский узел рассматривается как точка пересечения Северного морского пути, Транссиба и меридионального направления Север–Юг.'
        }
    },
    {
        key: 'verified-data',
        iconKey: 'ThumbUpAltRounded',
        title: { en: 'Verified data', ru: 'Верифицированные данные' },
        description: {
            en: 'SmallData and ontological models provide a unified information space for complex projects.',
            ru: 'SmallData и онтологические модели обеспечивают единое информационное пространство для сложных проектов.'
        }
    },
    {
        key: 'engineering-reliability',
        iconKey: 'ConstructionRounded',
        title: { en: 'Engineering reliability', ru: 'Инженерная надёжность' },
        description: {
            en: 'Universo Platformo is being developed as an environment for managing the lifecycle of complex software and hardware systems.',
            ru: 'Universo Platformo развивается как среда управления жизненным циклом сложных программно-аппаратных систем.'
        }
    }
]

export type Meridian73FooterLink = Readonly<{
    key: string
    groupKey: string
    groupTitle: Meridian73LocalizedText
    label: Meridian73LocalizedText
    href: string
}>

/**
 * Footer destinations are verified Consortium channels and contacts supplied
 * for publication; every other demo destination stays omitted.
 */
export const MERIDIAN_73_FOOTER_LINKS: readonly Meridian73FooterLink[] = [
    {
        key: 'community-telegram',
        groupKey: 'communities',
        groupTitle: { en: 'Our communities', ru: 'Наши сообщества' },
        label: { en: 'Telegram', ru: 'Telegram' },
        href: 'https://t.me/meridian73omsk'
    },
    {
        key: 'contact-email',
        groupKey: 'contacts',
        groupTitle: { en: 'Our contacts', ru: 'Наши контакты' },
        label: { en: 'igor_glushkov@mail.ru', ru: 'igor_glushkov@mail.ru' },
        href: 'mailto:igor_glushkov@mail.ru'
    },
    {
        key: 'contact-phone',
        groupKey: 'contacts',
        groupTitle: { en: 'Our contacts', ru: 'Наши контакты' },
        label: { en: '+7-913-602-21-53', ru: '+7-913-602-21-53' },
        href: 'tel:+79136022153'
    }
]

export const MERIDIAN_73_PRICING_TIERS: readonly Meridian73PricingTier[] = [
    {
        key: 'pre-seed',
        title: { en: 'Pre-seed', ru: 'Предпосевная' },
        description: {
            en: 'Financing: RUB 30–90 million',
            ru: 'Финансирование: 30–90 млн ₽'
        },
        price: 1,
        period: { en: 'stage', ru: 'этап' },
        benefits: [
            { en: 'Horizon: 0–18 months', ru: 'Горизонт: 0–18 месяцев' },
            { en: 'MVP and digital packaging of the project', ru: 'Развитие MVP и цифровая упаковка проекта' },
            { en: 'Digital twin of the Omsk hub', ru: 'Цифровой двойник Омского узла' },
            { en: 'Investor Desk and investor outreach', ru: 'Investor Desk и работа с инвесторами' },
            { en: 'Legal structure of the deal', ru: 'Юридическая структура сделки' }
        ]
    },
    {
        key: 'seed',
        title: { en: 'Seed', ru: 'Посевная' },
        description: {
            en: 'Financing: RUB 150–500 million',
            ru: 'Финансирование: 150–500 млн ₽'
        },
        price: 2,
        period: { en: 'stage', ru: 'этап' },
        benefits: [
            { en: 'First commercial mandates', ru: 'Первые коммерческие мандаты' },
            { en: 'Pilot project launches', ru: 'Запуск пилотных проектов' },
            { en: 'Universo Platformo development', ru: 'Развитие Universo Platformo' },
            { en: 'Preparation for scaling', ru: 'Подготовка к масштабированию' },
            { en: 'Partner network formation', ru: 'Формирование партнёрской сети' }
        ]
    },
    {
        key: 'growth',
        title: { en: 'Growth', ru: 'Масштабирование' },
        description: {
            en: 'Financing to be confirmed',
            ru: 'Финансирование уточняется'
        },
        price: 3,
        period: { en: 'stage', ru: 'этап' },
        benefits: [
            { en: 'Infrastructure SPV development', ru: 'Развитие инфраструктурных SPV' },
            { en: 'MTOR projects', ru: 'Проекты МТОР' },
            { en: 'International projects', ru: 'Международные проекты' },
            { en: 'Platform scaling', ru: 'Масштабирование платформы' },
            { en: 'Entry into new markets', ru: 'Выход на новые рынки' }
        ]
    }
]

export const MERIDIAN_73_FAQ = [
    {
        key: 'what-is-73rd-meridian',
        question: { en: 'What is “73rd Meridian”?', ru: 'Что такое «73-й Меридиан»?' },
        answer: {
            en: 'An international project for developing the industrial and logistics potential of territories, with a central hub in the Omsk Region.',
            ru: 'Международный проект развития индустриально-логистического потенциала территорий с центральным узлом в Омской области.'
        }
    },
    {
        key: 'construction-company',
        question: { en: 'Is the Consortium a construction company?', ru: 'Является ли Консорциум строительной компанией?' },
        answer: {
            en: 'No. The Consortium acts as a technology operator, system integrator, and digital developer of projects.',
            ru: 'Нет. Консорциум выступает как технологический оператор, системный интегратор и цифровой девелопер проектов.'
        }
    },
    {
        key: 'technologies',
        question: { en: 'What technologies are used?', ru: 'Какие технологии используются?' },
        answer: {
            en: 'Universo Platformo, digital twins, SmallData, AI agents, and project lifecycle management systems.',
            ru: 'Universo Platformo, цифровые двойники, SmallData, ИИ-агенты и системы управления жизненным циклом проектов.'
        }
    },
    {
        key: 'partners',
        question: { en: 'Who can become a partner?', ru: 'Кто может стать партнёром?' },
        answer: {
            en: 'Investors, industrial companies, technology companies, research organizations, and regional bodies.',
            ru: 'Инвесторы, промышленники, технологические компании, научные организации и региональные структуры.'
        }
    }
] as const

export const MERIDIAN_73_NAVIGATION = [
    { key: 'about', label: { en: 'About the project', ru: 'О проекте' }, href: '#hero', sectionKey: 'hero' },
    { key: 'partners', label: { en: 'Partners', ru: 'Партнёры' }, href: '#logos', sectionKey: 'logos' },
    { key: 'areas', label: { en: 'Areas', ru: 'Направления' }, href: '#features', sectionKey: 'features' },
    { key: 'why', label: { en: 'Highlights', ru: 'Преимущества' }, href: '#highlights', sectionKey: 'highlights' },
    {
        key: 'investment',
        label: { en: 'Investment', ru: 'Инвестиции' },
        href: '#pricing',
        sectionKey: 'pricing'
    },
    { key: 'contacts', label: { en: 'Contacts', ru: 'Контакты' }, href: '#footer', sectionKey: 'footer' }
] as const
