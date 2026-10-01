import { describe, expect, it } from 'vitest'

import { prepareRecordCopyInitialData } from '../recordListUtils'

describe('prepareRecordCopyInitialData', () => {
    it('omits auto-generated semantic keys and applies the localized copy suffix to visible content', () => {
        const data = prepareRecordCopyInitialData({
            sourceData: {
                HeroKey: 'default',
                Title: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Homepage', isActive: true },
                        ru: { content: 'Главная', isActive: true }
                    }
                }
            },
            components: [
                { dataType: 'STRING', codename: 'HeroKey', uiConfig: { hidden: true, autoGenerateSemanticKey: true } },
                { dataType: 'STRING', codename: 'Title' }
            ],
            locale: 'en'
        })

        expect(data).not.toHaveProperty('HeroKey')
        expect(data.Title).toMatchObject({
            locales: {
                en: { content: 'Homepage (copy)' },
                ru: { content: 'Главная (копия)' }
            }
        })
    })
})
