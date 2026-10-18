import { describe, expect, it } from 'vitest'
import { isUuidV7 } from '@universo-react/utils'

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

    it('regenerates copied table keys, remaps sibling selectors, resets copy fields, and preserves row order', () => {
        const sourceBlockKey = '018f5f8a-7b2c-7abc-8d1a-123456789abc'
        const sourceBlockKeyUpper = sourceBlockKey.toUpperCase()
        const data = prepareRecordCopyInitialData({
            sourceData: {
                Title: 'Muse',
                Blocks: [{ BlockKey: sourceBlockKeyUpper, Title: 'Opening', SortOrder: 9 }],
                Questions: [{ Prompt: 'Question', BlockKey: sourceBlockKey, SortOrder: 9 }]
            },
            components: [
                { dataType: 'STRING', codename: 'Title' },
                {
                    dataType: 'TABLE',
                    codename: 'Blocks',
                    uiConfig: { rowOrdering: { orderFieldCodename: 'SortOrder' } },
                    childComponents: [
                        { dataType: 'STRING', codename: 'BlockKey', uiConfig: { generateUuidV7: true, resetOnCopy: true } },
                        { dataType: 'STRING', codename: 'Title' },
                        { dataType: 'NUMBER', codename: 'SortOrder', uiConfig: { resetOnCopy: true, defaultValue: 0 } }
                    ]
                },
                {
                    dataType: 'TABLE',
                    codename: 'Questions',
                    uiConfig: { rowOrdering: { orderFieldCodename: 'SortOrder' } },
                    childComponents: [
                        {
                            dataType: 'STRING',
                            codename: 'BlockKey',
                            uiConfig: {
                                siblingRowSelect: { tableCodename: 'Blocks', valueFieldCodename: 'BlockKey', labelFieldCodename: 'Title' }
                            }
                        },
                        { dataType: 'NUMBER', codename: 'SortOrder', uiConfig: { resetOnCopy: true, defaultValue: 0 } }
                    ]
                }
            ],
            locale: 'en'
        })

        const blocks = data.Blocks as Array<Record<string, unknown>>
        const questions = data.Questions as Array<Record<string, unknown>>
        const copiedBlockKey = blocks[0]?.BlockKey

        expect(typeof copiedBlockKey === 'string' && isUuidV7(copiedBlockKey)).toBe(true)
        expect(copiedBlockKey).not.toBe(sourceBlockKey)
        expect(blocks[0]).toMatchObject({ Title: 'Opening', SortOrder: 1 })
        expect(questions[0]).toMatchObject({ BlockKey: copiedBlockKey, SortOrder: 1 })
    })
})
