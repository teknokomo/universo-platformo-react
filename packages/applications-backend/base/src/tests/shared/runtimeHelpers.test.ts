import { normalizeConfiguredRuntimeJsonValue } from '../../shared/runtimeHelpers'

describe('runtime JSON component validation', () => {
    it('normalizes configured Editor.js block content before persistence', () => {
        expect(
            normalizeConfiguredRuntimeJsonValue(
                {
                    format: 'editorjs',
                    blocks: [{ id: 'body', type: 'paragraph', data: { text: 'Welcome' } }]
                },
                {
                    data_type: 'JSON',
                    ui_config: {
                        widget: 'editorjsBlockContent',
                        blockEditor: {
                            allowedBlockTypes: ['paragraph'],
                            maxBlocks: 1
                        }
                    }
                }
            )
        ).toEqual({
            format: 'editorjs',
            blocks: [{ id: 'body', type: 'paragraph', data: { text: 'Welcome' } }]
        })
    })

    it('rejects block content that violates component-level constraints', () => {
        expect(() =>
            normalizeConfiguredRuntimeJsonValue(
                {
                    format: 'editorjs',
                    blocks: [{ id: 'title', type: 'header', data: { text: 'Title', level: 2 } }]
                },
                {
                    data_type: 'JSON',
                    ui_config: {
                        widget: 'editorjsBlockContent',
                        blockEditor: {
                            allowedBlockTypes: ['paragraph']
                        }
                    }
                }
            )
        ).toThrow('header')
    })

    it('normalizes configured resource sources and rejects unsafe URLs', () => {
        expect(
            normalizeConfiguredRuntimeJsonValue(
                JSON.stringify({
                    type: 'url',
                    url: ' https://example.test/resource '
                }),
                {
                    data_type: 'JSON',
                    ui_config: {
                        widget: 'resourceSource'
                    }
                }
            )
        ).toEqual({
            type: 'url',
            url: 'https://example.test/resource',
            launchMode: 'inline'
        })

        expect(() =>
            normalizeConfiguredRuntimeJsonValue(
                {
                    type: 'url',
                    url: 'https://user:pass@example.test/resource'
                },
                {
                    data_type: 'JSON',
                    ui_config: {
                        widget: 'resourceSource'
                    }
                }
            )
        ).toThrow('URL')
    })

    it('leaves unconfigured JSON fields unchanged', () => {
        const value = { arbitrary: '<kept for caller-owned schema>' }

        expect(normalizeConfiguredRuntimeJsonValue(value, { data_type: 'JSON', ui_config: {} })).toBe(value)
    })
})
