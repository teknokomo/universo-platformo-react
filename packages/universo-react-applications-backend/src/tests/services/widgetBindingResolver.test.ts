import { buildSingleTargetWidgetBinding, getLayoutWidgetDefinition } from '@universo-react/types'
import { resolveWidgetBindingTargets } from '../../services/widgetBindingResolver'

describe('resolveWidgetBindingTargets', () => {
    it('resolves a registered projection by semantic key without exposing unprojected row data', () => {
        const definition = getLayoutWidgetDefinition('marketing.hero')
        if (!definition) throw new Error('Marketing Hero widget definition is missing')

        const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
            entityKind: 'object',
            entityCodename: 'ArticleContent',
            semanticKey: 'article-welcome'
        })
        const row = {
            HeroKey: 'article-welcome',
            Title: { en: 'Welcome' },
            Description: { en: 'Article introduction' },
            EmailLabel: { en: 'Email' },
            EmailPlaceholder: { en: 'you@example.com' },
            PrimaryActionLabel: { en: 'Read more' },
            PrimaryAction: { kind: 'internal', path: '/articles' },
            InternalPublicationId: 'must-not-leave-the-adapter'
        }
        const loadRecords = jest.fn(() => [row])

        const resolved = resolveWidgetBindingTargets(definition, bindings, loadRecords)

        expect(resolved).toEqual([
            {
                slot: 'content',
                entityKind: 'object',
                entityCodename: 'ArticleContent',
                semanticKey: 'article-welcome',
                data: {
                    key: 'article-welcome',
                    title: { en: 'Welcome' },
                    description: { en: 'Article introduction' },
                    emailLabel: { en: 'Email' },
                    emailPlaceholder: { en: 'you@example.com' },
                    primaryActionLabel: { en: 'Read more' },
                    primaryAction: { kind: 'internal', path: '/articles' }
                }
            }
        ])
        expect(loadRecords).toHaveBeenCalledWith(expect.objectContaining({ entityCodename: 'ArticleContent' }))
    })
})
