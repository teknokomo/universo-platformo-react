import type { TemplateSeedComponent, TemplateSeedElement, TemplateSeedEntity } from '@universo-react/types'
import { vlc } from './basic.template'
import { keyComponent, localizedComponent, marketingComponent, mediaComponent } from './marketing-page.seed-helpers'

const imageComponents: TemplateSeedComponent[] = [
    {
        ...keyComponent('ImageKey', 'Image key', 'Ключ изображения', 64),
        isRequired: true
    },
    mediaComponent('Resource', 'Image resource', 'Источник изображения'),
    localizedComponent('AltText', 'Alternative text', 'Альтернативный текст', 255),
    marketingComponent('Decorative', 'Decorative image', 'Декоративное изображение', {
        dataType: 'BOOLEAN',
        isRequired: true
    }),
    marketingComponent('Width', 'Display width', 'Ширина отображения', {
        dataType: 'NUMBER',
        isRequired: true,
        validationRules: { min: 1, max: 10000 }
    }),
    marketingComponent('Height', 'Display height', 'Высота отображения', {
        dataType: 'NUMBER',
        isRequired: true,
        validationRules: { min: 1, max: 10000 }
    })
]

export const marketingPageImageEntity: TemplateSeedEntity = {
    codename: 'MarketingPageImage',
    kind: 'object',
    localizeCodenameFromName: false,
    name: vlc('Marketing images', 'Изображения маркетинговой страницы'),
    description: vlc(
        'Reusable images, accessibility text, and display dimensions for the marketing page.',
        'Повторно используемые изображения, альтернативный текст и размеры отображения для маркетинговой страницы.'
    ),
    hubs: ['MarketingPage'],
    config: {
        recordBehavior: 'reference',
        marketingRole: 'image',
        recordPolicy: {
            version: 1,
            semanticKey: { componentCodename: 'ImageKey', creationPrefix: 'image', protectedValues: ['default'] },
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            runtimeMutation: 'deny',
            requiredLocales: ['en', 'ru'],
            conditionalRequired: [{ componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: false } }]
        }
    },
    components: imageComponents
}

export const marketingPageImageElements: TemplateSeedElement[] = [
    {
        codename: 'default',
        sortOrder: 1,
        data: {
            ImageKey: 'default',
            Resource: {
                type: 'url',
                url: 'https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg',
                launchMode: 'inline'
            },
            AltText: vlc('Material UI dashboard preview', 'Предпросмотр панели управления Material UI'),
            Decorative: false,
            Width: 1600,
            Height: 900
        }
    }
]
