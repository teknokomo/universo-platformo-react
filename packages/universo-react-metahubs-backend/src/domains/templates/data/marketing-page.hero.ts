import {
    buildSingleTargetWidgetBinding,
    getLayoutWidgetDefinition,
    MARKETING_HERO_ENTITY_CODENAME,
    marketingActionSchema
} from '@universo-react/types'
import type { TemplateSeedComponent, TemplateSeedElement, TemplateSeedEntity } from '@universo-react/types'
import { vlc } from './basic.template'
import { keyComponent, localizedComponent, marketingComponent } from './marketing-page.seed-helpers'

const marketingHeroDefinition = getLayoutWidgetDefinition('marketing.hero')
if (!marketingHeroDefinition) throw new Error('Marketing Hero widget definition is not registered')

export const defaultMarketingHeroBinding = buildSingleTargetWidgetBinding(marketingHeroDefinition, 'content', {
    entityKind: 'object',
    entityCodename: MARKETING_HERO_ENTITY_CODENAME,
    semanticKey: 'default'
})

const heroComponents: TemplateSeedComponent[] = [
    {
        ...keyComponent('HeroKey', 'Hero key', 'Ключ первого экрана', 64),
        isRequired: true,
        uiConfig: { hidden: true, gridHidden: true }
    },
    {
        ...localizedComponent('Title', 'Title', 'Заголовок', 255),
        isRequired: true,
        isDisplayComponent: true,
        uiConfig: { isDisplay: true }
    },
    localizedComponent('Accent', 'Accent', 'Акцент', 120),
    {
        ...localizedComponent('Description', 'Description', 'Описание', 2000),
        isRequired: true,
        uiConfig: { widget: 'textarea', rows: 4 }
    },
    { ...localizedComponent('EmailLabel', 'Email label', 'Подпись email', 120), isRequired: true },
    { ...localizedComponent('EmailPlaceholder', 'Email placeholder', 'Подсказка email', 120), isRequired: true },
    { ...localizedComponent('PrimaryActionLabel', 'Primary action label', 'Подпись основной кнопки', 120), isRequired: true },
    marketingComponent('PrimaryAction', 'Primary action', 'Основное действие', {
        dataType: 'JSON',
        isRequired: true,
        validationRules: { format: 'marketingAction' },
        uiConfig: { gridHidden: true }
    }),
    localizedComponent('TermsText', 'Terms text', 'Текст условий', 500),
    localizedComponent('TermsLinkLabel', 'Terms link label', 'Подпись ссылки условий', 120),
    marketingComponent('TermsAction', 'Terms action', 'Действие ссылки условий', {
        dataType: 'JSON',
        validationRules: { format: 'marketingAction' },
        uiConfig: { gridHidden: true }
    })
]

export const marketingPageHeroEntity: TemplateSeedEntity = {
    codename: MARKETING_HERO_ENTITY_CODENAME,
    kind: 'object',
    localizeCodenameFromName: false,
    name: vlc('Marketing hero', 'Первый экран маркетинговой страницы'),
    description: vlc(
        'Reusable localized hero content and lead form actions.',
        'Повторно используемое локализованное содержимое первого экрана и действия формы.'
    ),
    hubs: ['MarketingPage'],
    config: {
        recordBehavior: 'reference',
        marketingRole: 'hero',
        recordPolicy: {
            version: 1,
            semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            runtimeMutation: 'deny',
            requiredLocales: ['en', 'ru'],
            validatorKey: 'marketing.hero.v1'
        }
    },
    components: heroComponents
}

export const marketingPageHeroElements: TemplateSeedElement[] = [
    {
        codename: 'default',
        sortOrder: 1,
        data: {
            HeroKey: 'default',
            Title: vlc('Our latest', 'Наши новые'),
            Accent: vlc('products', 'продукты'),
            Description: vlc(
                'Explore our cutting-edge dashboard, delivering high-quality solutions tailored to your needs. Elevate your experience with top-tier features and services.',
                'Изучите современную панель управления с качественными решениями, адаптированными под ваши задачи.'
            ),
            EmailLabel: vlc('Email', 'Электронная почта'),
            EmailPlaceholder: vlc('Your email address', 'Ваш адрес электронной почты'),
            PrimaryActionLabel: vlc('Start now', 'Начать'),
            PrimaryAction: marketingActionSchema.parse({ kind: 'internal', path: '/auth', target: 'same-tab' }),
            TermsText: vlc('By clicking "Start now" you agree to our', 'Нажимая «Начать», вы соглашаетесь с нашими'),
            TermsLinkLabel: vlc('Terms & Conditions', 'Условиями использования'),
            TermsAction: marketingActionSchema.parse({ kind: 'internal', path: '/terms', target: 'same-tab' })
        }
    }
]
