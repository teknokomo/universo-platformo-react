import type { PageBlockContent } from '@universo/types'

import {
    addEditorJsContentLocale,
    buildEditorJsTools,
    collectEditorJsContentLocales,
    mergeEditorJsOutputDataWithLocale,
    normalizeAllowedBlockTypes,
    removeEditorJsContentLocale,
    renameEditorJsContentLocale,
    resolveEditorJsContentPrimaryLocale,
    setEditorJsContentPrimaryLocale,
    toEditorJsOutputData,
    type EditorJsToolBundle
} from '../editorJsTools'

const mockBundle: EditorJsToolBundle = {
    Header: class HeaderTool {},
    List: class ListTool {},
    Quote: class QuoteTool {},
    Table: class TableTool {},
    Embed: class EmbedTool {},
    Delimiter: class DelimiterTool {},
    ImageTool: class ImageTool {}
}

describe('editorJsTools', () => {
    it('normalizes allowed block types and falls back to paragraph for invalid configs', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

        expect(normalizeAllowedBlockTypes(['header', 'unknown', 'list'])).toEqual(['header', 'list'])
        expect(normalizeAllowedBlockTypes(['unknown'])).toEqual(['paragraph'])
        expect(normalizeAllowedBlockTypes()).toContain('paragraph')
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Ignoring unsupported page block type(s): unknown'))
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Falling back to paragraph blocks only'))

        warnSpy.mockRestore()
    })

    it('builds Editor.js tools only for block types enabled by the entity component config', () => {
        const tools = buildEditorJsTools(mockBundle, ['header', 'list', 'image'])

        expect(Object.keys(tools).sort()).toEqual(['header', 'image', 'list'])
        expect(tools).not.toHaveProperty('table')
        expect(tools).not.toHaveProperty('quote')
        expect(tools).not.toHaveProperty('delimiter')
    })

    it('converts canonical Page blocks into Editor.js output data without preserving unsafe nested lists', () => {
        const content: PageBlockContent = {
            format: 'editorjs',
            blocks: [
                {
                    id: 'title',
                    type: 'header',
                    data: {
                        text: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Welcome' },
                                ru: { content: 'Добро пожаловать' }
                            }
                        },
                        level: 2
                    }
                },
                {
                    id: 'steps',
                    type: 'list',
                    data: {
                        style: 'ordered',
                        items: ['Start', 'Continue']
                    }
                }
            ],
            version: '2.31.0'
        }

        expect(toEditorJsOutputData(content)).toEqual({
            time: expect.any(Number),
            version: '2.31.0',
            blocks: [
                {
                    id: 'title',
                    type: 'header',
                    data: {
                        text: 'Welcome',
                        level: 2
                    }
                },
                {
                    id: 'steps',
                    type: 'list',
                    data: {
                        style: 'ordered',
                        meta: {},
                        items: [
                            { content: 'Start', meta: {}, items: [] },
                            { content: 'Continue', meta: {}, items: [] }
                        ]
                    }
                }
            ]
        })

        expect((toEditorJsOutputData(content, 'ru').blocks as Array<{ data: { text: string } }>)[0].data.text).toBe('Добро пожаловать')
    })

    it('merges Editor.js output into the selected locale without dropping other localized values', () => {
        const content: PageBlockContent = {
            format: 'editorjs',
            blocks: [
                {
                    id: 'title',
                    type: 'header',
                    data: {
                        text: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Welcome', version: 1, isActive: true },
                                ru: { content: 'Добро пожаловать', version: 1, isActive: true }
                            }
                        },
                        level: 2
                    }
                }
            ]
        }

        const result = mergeEditorJsOutputDataWithLocale(
            {
                time: 1,
                version: '2.31.0',
                blocks: [{ id: 'title', type: 'header', data: { text: 'Обновлённый заголовок', level: 2 } }]
            },
            content,
            'ru'
        )

        const text = result.data?.blocks[0]?.data.text as {
            _primary: string
            locales: Record<string, { content: string; isActive: boolean }>
        }

        expect(text._primary).toBe('en')
        expect(text.locales.en.content).toBe('Welcome')
        expect(text.locales.ru.content).toBe('Обновлённый заголовок')
        expect(text.locales.ru.isActive).toBe(true)
    })

    it('manages localized page content variants without hardcoding available languages', () => {
        const content: PageBlockContent = {
            format: 'editorjs',
            blocks: [
                {
                    id: 'title',
                    type: 'header',
                    data: {
                        text: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Welcome', version: 1, isActive: true },
                                ru: { content: 'Добро пожаловать', version: 1, isActive: true }
                            }
                        },
                        level: 2
                    }
                }
            ]
        }

        expect(collectEditorJsContentLocales(content, 'de').sort()).toEqual(['en', 'ru'])
        expect(resolveEditorJsContentPrimaryLocale(content, 'de')).toBe('en')

        const withDe = addEditorJsContentLocale(content, 'de', 'ru')
        const deText = withDe.data?.blocks[0]?.data.text as { locales: Record<string, { content: string }> }
        expect(deText.locales.de.content).toBe('')

        const renamed = renameEditorJsContentLocale(withDe, 'de', 'fr')
        const renamedText = renamed.data?.blocks[0]?.data.text as { locales: Record<string, { content?: string }> }
        expect(renamedText.locales.fr).toBeDefined()
        expect(renamedText.locales.de).toBeUndefined()

        const primaryRu = setEditorJsContentPrimaryLocale(renamed, 'ru')
        expect(resolveEditorJsContentPrimaryLocale(primaryRu, 'en')).toBe('ru')

        const withoutEn = removeEditorJsContentLocale(primaryRu, 'en')
        const remainingText = withoutEn.data?.blocks[0]?.data.text as { locales: Record<string, { content?: string }> }
        expect(remainingText.locales.en).toBeUndefined()
        expect(remainingText.locales.ru?.content).toBe('Добро пожаловать')
    })
})
