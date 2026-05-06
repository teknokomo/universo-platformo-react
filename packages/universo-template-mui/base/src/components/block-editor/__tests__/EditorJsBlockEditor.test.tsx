import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PageBlockContent } from '@universo/types'

import { EditorJsBlockEditor } from '../EditorJsBlockEditor'
import { loadEditorJsToolBundle } from '../editorJsTools'

const mockEditorInstances: Array<{
    isReady: Promise<void>
    destroy: jest.Mock
    render: jest.Mock
    config: Record<string, unknown>
}> = []

let nextEditorReadyPromise: Promise<void> | null = null

const mockEditorConstructor = jest.fn().mockImplementation((config: Record<string, unknown>) => {
    const instance = {
        isReady: nextEditorReadyPromise ?? Promise.resolve(),
        destroy: jest.fn(),
        render: jest.fn(),
        config
    }
    nextEditorReadyPromise = null
    mockEditorInstances.push(instance)
    return instance
})

jest.mock('@editorjs/editorjs', () => ({
    __esModule: true,
    default: mockEditorConstructor
}))

jest.mock('../editorJsTools', () => {
    const actual = jest.requireActual('../editorJsTools')
    return {
        ...actual,
        buildEditorJsTools: jest.fn(() => ({ paragraph: { class: class ParagraphTool {} } })),
        loadEditorJsToolBundle: jest.fn(async () => ({
            Header: class HeaderTool {},
            List: class ListTool {},
            Quote: class QuoteTool {},
            Table: class TableTool {},
            Embed: class EmbedTool {},
            Delimiter: class DelimiterTool {},
            ImageTool: class ImageTool {}
        }))
    }
})

const makeContent = (text: string): PageBlockContent => ({
    format: 'editorjs',
    blocks: [
        {
            id: text.toLowerCase(),
            type: 'paragraph',
            data: { text }
        }
    ]
})

const makeLocalizedContent = (): PageBlockContent => ({
    format: 'editorjs',
    blocks: [
        {
            id: 'welcome',
            type: 'paragraph',
            data: {
                text: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Welcome', version: 1, isActive: true },
                        ru: { content: 'Добро пожаловать', version: 1, isActive: true }
                    }
                }
            }
        }
    ]
})

describe('EditorJsBlockEditor', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockEditorInstances.length = 0
        nextEditorReadyPromise = null
        jest.mocked(loadEditorJsToolBundle).mockImplementation(async () => ({
            Header: class HeaderTool {},
            List: class ListTool {},
            Quote: class QuoteTool {},
            Table: class TableTool {},
            Embed: class EmbedTool {},
            Delimiter: class DelimiterTool {},
            ImageTool: class ImageTool {}
        }))
    })

    it('renders external value changes into an already mounted Editor.js instance', async () => {
        const onChange = jest.fn()
        const { rerender } = render(<EditorJsBlockEditor value={makeContent('First')} onChange={onChange} />)

        await waitFor(() => expect(mockEditorConstructor).toHaveBeenCalledTimes(1))
        const instance = mockEditorInstances[0]

        expect((instance.config.data as { blocks: Array<{ data: { text: string } }> }).blocks[0].data.text).toBe('First')

        rerender(<EditorJsBlockEditor value={makeContent('Second')} onChange={onChange} />)

        await waitFor(() => expect(instance.render).toHaveBeenCalledTimes(1))
        expect((instance.render.mock.calls[0][0] as { blocks: Array<{ data: { text: string } }> }).blocks[0].data.text).toBe('Second')
    })

    it('renders entity content that arrives while Editor.js is still mounting', async () => {
        const onChange = jest.fn()
        let resolveEditorReady: (() => void) | undefined
        nextEditorReadyPromise = new Promise<void>((resolve) => {
            resolveEditorReady = resolve
        })

        const { rerender } = render(<EditorJsBlockEditor value={makeContent('')} onChange={onChange} />)

        await waitFor(() => expect(mockEditorConstructor).toHaveBeenCalledTimes(1))
        const instance = mockEditorInstances[0]

        rerender(<EditorJsBlockEditor value={makeContent('LoadedEntityContent')} onChange={onChange} />)

        await act(async () => {
            resolveEditorReady?.()
            await instance.isReady
        })

        await waitFor(() => expect(instance.render).toHaveBeenCalledTimes(1))
        expect(JSON.stringify(instance.render.mock.calls[0][0])).toContain('LoadedEntityContent')
    })

    it('normalizes raw Editor.js output in the fallback JSON editor', async () => {
        jest.mocked(loadEditorJsToolBundle).mockRejectedValueOnce(new Error('tools unavailable'))
        const onChange = jest.fn()

        render(
            <EditorJsBlockEditor
                value={makeContent('Initial')}
                onChange={onChange}
                labels={{ fallbackLabel: 'Fallback JSON', loadError: 'Cannot load editor' }}
            />
        )

        const fallback = await screen.findByLabelText('Fallback JSON')
        fireEvent.change(fallback, {
            target: {
                value: JSON.stringify({
                    time: 1,
                    version: '2.31.0',
                    blocks: [{ id: 'raw', type: 'paragraph', data: { text: 'Raw text' } }]
                })
            }
        })

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({
                format: 'editorjs',
                data: expect.objectContaining({
                    version: '2.31.0',
                    blocks: [expect.objectContaining({ id: 'raw', type: 'paragraph' })]
                })
            })
        )
    })

    it('initializes Editor.js with the selected content locale and a complete Russian menu dictionary', async () => {
        const onChange = jest.fn()

        render(<EditorJsBlockEditor value={makeLocalizedContent()} locale='ru' contentLocale='ru' onChange={onChange} />)

        await waitFor(() => expect(mockEditorConstructor).toHaveBeenCalledTimes(1))
        const config = mockEditorInstances[0].config
        const data = config.data as { blocks: Array<{ data: { text: string } }> }
        const i18n = config.i18n as {
            messages: {
                ui: { popover: Record<string, string> }
                toolNames: Record<string, string>
                blockTunes: Record<string, Record<string, string>>
            }
        }

        expect(data.blocks[0].data.text).toBe('Добро пожаловать')
        expect(i18n.messages.ui.popover.Filter).toBe('Поиск')
        expect(i18n.messages.toolNames['Unordered List']).toBe('Маркированный список')
        expect(i18n.messages.blockTunes.delete.Delete).toBe('Удалить')
        expect(i18n.messages.blockTunes.moveUp['Move up']).toBe('Переместить выше')
    })

    it('applies configured block constraints in the fallback JSON editor', async () => {
        jest.mocked(loadEditorJsToolBundle).mockRejectedValueOnce(new Error('tools unavailable'))
        const onChange = jest.fn()
        const onValidationError = jest.fn()

        render(
            <EditorJsBlockEditor
                value={makeContent('Initial')}
                allowedBlockTypes={['paragraph']}
                maxBlocks={1}
                onChange={onChange}
                onValidationError={onValidationError}
                labels={{ fallbackLabel: 'Fallback JSON', loadError: 'Cannot load editor' }}
            />
        )

        const fallback = await screen.findByLabelText('Fallback JSON')
        fireEvent.change(fallback, {
            target: {
                value: JSON.stringify({
                    format: 'editorjs',
                    blocks: [{ id: 'title', type: 'header', data: { text: 'Title', level: 2 } }]
                })
            }
        })

        expect(onChange).not.toHaveBeenCalled()
        expect(onValidationError).toHaveBeenCalledWith(expect.stringContaining('header'))
    })
})
