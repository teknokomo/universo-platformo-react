import { getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { orderDashboardSeedPlacements } from '../../domains/templates/services/dashboardSeedPlacement'

describe('LMS Knowledge Articles Dashboard seed', () => {
    it('provides localized Entity-backed records and creation for the published object route', () => {
        const layout = lmsTemplate.seed.scopedLayouts?.find(({ codename }) => codename === 'knowledgeArticles')
        const articleEntity = lmsTemplate.seed.entities.find(({ codename }) => codename === 'KnowledgeArticles')
        expect(articleEntity?.config).toMatchObject({
            runtime: {
                menuVisibility: 'primary',
                icon: 'article',
                requiresPermission: 'editContent'
            }
        })
        expect(layout).toMatchObject({
            templateKey: 'dashboard',
            baseLayoutCodename: 'main',
            scopeEntityCodename: 'KnowledgeArticles',
            scopeEntityKind: 'object',
            name: {
                locales: {
                    en: { content: 'Knowledge Articles' },
                    ru: { content: 'Статьи базы знаний' }
                }
            }
        })
        expect(articleEntity?.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'SortOrder',
                    dataType: 'NUMBER',
                    isRequired: true,
                    uiConfig: { defaultValue: 0, formHidden: true, gridHidden: true }
                })
            ])
        )

        const placements = lmsTemplate.seed.layoutZoneWidgets?.knowledgeArticles ?? []
        const records = placements.find(({ instanceKey }) => instanceKey === 'knowledge-articles-records')
        expect(records).toMatchObject({
            zone: 'center',
            widgetKey: 'detailsTable',
            rendererConfig: {
                variant: 'records',
                showSearch: true,
                maxRows: 50,
                createTargets: [
                    {
                        id: 'knowledge-articles-create-article',
                        label: { en: 'Article', ru: 'Статья' },
                        objectCollectionCodename: 'KnowledgeArticles'
                    }
                ]
            },
            bindings: {
                version: 1,
                slots: [
                    {
                        slot: 'rows',
                        targets: [
                            expect.objectContaining({
                                entityKind: 'object',
                                entityCodename: 'KnowledgeArticles',
                                selector: { kind: 'record-set' }
                            })
                        ]
                    }
                ]
            }
        })

        if (!records) throw new Error('Knowledge Articles records placement is missing')
        const definition = getLayoutWidgetDefinition(records.widgetKey, records.rendererConfig)
        if (!definition) throw new Error('Knowledge Articles records widget definition is missing')
        expect(() => validateWidgetBindings(definition, records.bindings)).not.toThrow()
        expect(() => orderDashboardSeedPlacements(placements)).not.toThrow()
    })
})
