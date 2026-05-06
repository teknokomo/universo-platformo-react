import { describe, expect, it } from 'vitest'

import {
    normalizeEditorJsOutputData,
    normalizePageBlockContentForStorage,
    normalizeRuntimePageBlocks,
    pageBlockContentSchema
} from '../common/pageBlocks'

describe('page block content schema', () => {
    it('accepts Editor.js blocks stored at the root content level', () => {
        const result = pageBlockContentSchema.safeParse({
            format: 'editorjs',
            version: '2.29.0',
            blocks: [
                {
                    id: 'welcome-title',
                    type: 'header',
                    data: {
                        level: 2,
                        text: 'Welcome'
                    }
                }
            ]
        })

        expect(result.success).toBe(true)
        expect(normalizeRuntimePageBlocks(result.success ? result.data : null)).toHaveLength(1)
    })

    it('accepts Editor.js blocks stored inside data payloads', () => {
        expect(
            normalizeRuntimePageBlocks({
                format: 'editorjs',
                data: {
                    time: 0,
                    version: '2.29.1',
                    blocks: [
                        {
                            id: 'welcome-body',
                            type: 'paragraph',
                            data: {
                                text: 'Use this page to publish structured content.'
                            }
                        }
                    ]
                }
            })
        ).toEqual([
            {
                id: 'welcome-body',
                type: 'paragraph',
                data: {
                    text: 'Use this page to publish structured content.'
                }
            }
        ])
    })

    it('rejects unknown block types and unsafe URLs', () => {
        expect(
            pageBlockContentSchema.safeParse({
                format: 'editorjs',
                blocks: [{ id: 'custom-1', type: 'html', data: { html: '<script />' } }]
            }).success
        ).toBe(false)

        expect(
            pageBlockContentSchema.safeParse({
                format: 'editorjs',
                blocks: [{ id: 'image-1', type: 'image', data: { url: 'javascript:alert(1)' } }]
            }).success
        ).toBe(false)
    })

    it('normalizes real Editor.js list 2.x output into the canonical flat runtime schema', () => {
        expect(
            normalizeEditorJsOutputData({
                time: 1,
                version: '2.31.6',
                blocks: [
                    {
                        id: 'list-1',
                        type: 'list',
                        data: {
                            style: 'unordered',
                            meta: {},
                            items: [
                                { content: 'First item', meta: {}, items: [] },
                                { content: 'Second item', meta: {}, items: [] }
                            ]
                        }
                    }
                ]
            })
        ).toEqual({
            format: 'editorjs',
            data: {
                time: 1,
                version: '2.31.6',
                blocks: [
                    {
                        id: 'list-1',
                        type: 'list',
                        data: {
                            style: 'unordered',
                            items: ['First item', 'Second item']
                        }
                    }
                ]
            }
        })
    })

    it('rejects nested list output until the runtime schema supports it', () => {
        expect(() =>
            normalizeEditorJsOutputData({
                blocks: [
                    {
                        id: 'list-1',
                        type: 'list',
                        data: {
                            style: 'unordered',
                            items: [{ content: 'Parent', meta: {}, items: [{ content: 'Child', meta: {}, items: [] }] }]
                        }
                    }
                ]
            })
        ).toThrow('Nested list items are not supported')
    })

    it('rejects inline HTML before persistence', () => {
        expect(
            pageBlockContentSchema.safeParse({
                format: 'editorjs',
                blocks: [{ id: 'paragraph-1', type: 'paragraph', data: { text: '<b>Unsafe</b>' } }]
            }).success
        ).toBe(false)

        expect(() =>
            normalizePageBlockContentForStorage({
                format: 'editorjs',
                data: {
                    blocks: [{ id: 'header-1', type: 'header', data: { text: '<i>Unsafe</i>', level: 2 } }]
                }
            })
        ).toThrow('HTML markup')
    })

    it('enforces Entity-specific block type and block count constraints', () => {
        expect(() =>
            normalizePageBlockContentForStorage(
                {
                    format: 'editorjs',
                    blocks: [
                        { id: 'title', type: 'header', data: { text: 'Title', level: 2 } },
                        { id: 'body', type: 'paragraph', data: { text: 'Body' } }
                    ]
                },
                { allowedBlockTypes: ['paragraph'], maxBlocks: 10 }
            )
        ).toThrow('header')

        expect(() =>
            normalizePageBlockContentForStorage(
                {
                    format: 'editorjs',
                    blocks: [
                        { id: 'one', type: 'paragraph', data: { text: 'One' } },
                        { id: 'two', type: 'paragraph', data: { text: 'Two' } }
                    ]
                },
                { allowedBlockTypes: ['paragraph'], maxBlocks: 1 }
            )
        ).toThrow('block limit')
    })

    it('normalizes image and embed URLs through the canonical safe URL contract', () => {
        expect(
            normalizeEditorJsOutputData({
                blocks: [
                    {
                        id: 'image-1',
                        type: 'image',
                        data: {
                            file: { url: 'https://example.test/image.png' },
                            caption: 'Image caption'
                        }
                    },
                    {
                        id: 'embed-1',
                        type: 'embed',
                        data: {
                            source: 'https://example.test/video',
                            caption: 'Video'
                        }
                    }
                ]
            }).data?.blocks
        ).toEqual([
            {
                id: 'image-1',
                type: 'image',
                data: {
                    url: 'https://example.test/image.png',
                    caption: 'Image caption'
                }
            },
            {
                id: 'embed-1',
                type: 'embed',
                data: {
                    url: 'https://example.test/video',
                    caption: 'Video'
                }
            }
        ])
    })
})
