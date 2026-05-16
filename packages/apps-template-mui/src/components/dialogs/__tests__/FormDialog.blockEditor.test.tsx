import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageBlockContent } from '@universo/types'
import { FormDialog, type FieldConfig } from '../FormDialog'

const editorMocks = vi.hoisted(() => ({
    capturedAllowedBlockTypes: undefined as readonly string[] | undefined,
    capturedMaxBlocks: undefined as number | null | undefined,
    capturedValue: undefined as PageBlockContent | undefined
}))

vi.mock('@universo/block-editor', () => ({
    EditorJsBlockEditor: ({
        value,
        allowedBlockTypes,
        maxBlocks,
        onChange,
        onValidationError
    }: {
        value: PageBlockContent
        allowedBlockTypes?: readonly string[]
        maxBlocks?: number | null
        onChange: (nextValue: PageBlockContent) => void
        onValidationError?: (message: string | null) => void
    }) => {
        editorMocks.capturedAllowedBlockTypes = allowedBlockTypes
        editorMocks.capturedMaxBlocks = maxBlocks
        editorMocks.capturedValue = value

        return (
            <button
                data-testid='editorjs-block-editor'
                type='button'
                onClick={() => {
                    onValidationError?.(null)
                    onChange({
                        format: 'editorjs',
                        version: '1',
                        data: {
                            blocks: [
                                {
                                    id: 'intro',
                                    type: 'paragraph',
                                    data: {
                                        text: 'Runtime lesson content'
                                    }
                                }
                            ]
                        }
                    })
                }}
            >
                block editor
            </button>
        )
    }
}))

describe('FormDialog block editor fields', () => {
    beforeEach(() => {
        editorMocks.capturedAllowedBlockTypes = undefined
        editorMocks.capturedMaxBlocks = undefined
        editorMocks.capturedValue = undefined
    })

    it('renders metadata-driven Editor.js JSON fields and submits normalized block content', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'content',
                label: 'Content',
                type: 'JSON',
                required: true,
                uiConfig: {
                    widget: 'editorjsBlockContent',
                    blockEditor: {
                        allowedBlockTypes: ['paragraph', 'header'],
                        maxBlocks: 3
                    }
                }
            }
        ]

        render(<FormDialog open title='Create content' fields={fields} locale='en' onClose={vi.fn()} onSubmit={onSubmit} />)

        const user = userEvent.setup()
        await user.click(screen.getByTestId('editorjs-block-editor'))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(editorMocks.capturedAllowedBlockTypes).toEqual(['paragraph', 'header'])
        expect(editorMocks.capturedMaxBlocks).toBe(3)
        expect(onSubmit).toHaveBeenCalledWith({
            content: expect.objectContaining({
                format: 'editorjs',
                data: expect.objectContaining({
                    blocks: [expect.objectContaining({ id: 'intro', type: 'paragraph' })]
                })
            })
        })
    })

    it('parses persisted JSON strings before opening Editor.js edit fields', () => {
        const fields: FieldConfig[] = [
            {
                id: 'content',
                label: 'Content',
                type: 'JSON',
                uiConfig: {
                    widget: 'editorjsBlockContent',
                    blockEditor: {
                        allowedBlockTypes: ['paragraph']
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Edit content'
                fields={fields}
                initialData={{
                    content: JSON.stringify({
                        format: 'editorjs',
                        data: {
                            blocks: [
                                {
                                    id: 'stored',
                                    type: 'paragraph',
                                    data: {
                                        text: 'Persisted lesson content'
                                    }
                                }
                            ]
                        }
                    })
                }}
                locale='en'
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />
        )

        expect(editorMocks.capturedValue).toEqual(
            expect.objectContaining({
                format: 'editorjs',
                data: expect.objectContaining({
                    blocks: [expect.objectContaining({ id: 'stored', type: 'paragraph' })]
                })
            })
        )
    })
})
