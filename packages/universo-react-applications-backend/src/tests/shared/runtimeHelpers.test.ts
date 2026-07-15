import {
    coerceRuntimeValue,
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValue,
    RuntimeInputFormatError,
    toRuntimeInputFormatErrorBody
} from '../../shared/runtimeHelpers'
import { ComponentDefinitionDataType } from '@universo-react/types'
import { normalizeChildFieldValue } from '../../routes/sync/syncHelpers'

describe('closed runtime field formats', () => {
    const hexColorRules = { format: 'hexColor' } as const

    it.each([
        [null, null],
        ['#abc', '#AABBCC'],
        ['#AABBCC', '#AABBCC']
    ])('normalizes %p through every runtime table child boundary', (value, expected) => {
        expect(coerceRuntimeValue(value, 'STRING', hexColorRules)).toBe(expected)
        expect(normalizeRuntimeTableChildInsertValue(value, 'STRING', hexColorRules)).toBe(expected)
    })

    it.each(['#abcd', '#AABBCCDD', 'red', 'rgb(1,2,3)', 'var(--color)', 'url(https://example.test)', {}, ['#AABBCC']])(
        'rejects malformed opaque hex input %p with a stable safe error',
        (value) => {
            expect(() => coerceRuntimeValue(value, 'STRING', hexColorRules)).toThrow(RuntimeInputFormatError)
            expect(toRuntimeInputFormatErrorBody(captureThrownValue(() => coerceRuntimeValue(value, 'STRING', hexColorRules)))).toEqual({
                error: 'Invalid field format',
                code: 'INVALID_FIELD_FORMAT'
            })
        }
    )

    it('uses the same strict formatter while materializing seeded table rows', () => {
        const field = {
            dataType: ComponentDefinitionDataType.STRING,
            validationRules: hexColorRules
        }

        expect(normalizeChildFieldValue('#abc', field, 'CellFillColor', 'matrix', 'element-1')).toBe('#AABBCC')
        expect(() => normalizeChildFieldValue('rgb(1,2,3)', field, 'CellFillColor', 'matrix', 'element-1')).toThrow(
            'Invalid configured colour value'
        )
    })
})

const captureThrownValue = (callback: () => unknown): unknown => {
    try {
        callback()
    } catch (error) {
        return error
    }
    throw new Error('Expected callback to throw')
}

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
