import { describe, expect, it } from 'vitest'
import { toFieldConfigs, toGridColumns } from '../columns'

describe('toFieldConfigs', () => {
    it('preserves component uiConfig for metadata-driven runtime form widgets', () => {
        const [field] = toFieldConfigs({
            columns: [
                {
                    id: 'component-content',
                    codename: 'Content',
                    field: 'content',
                    dataType: 'JSON',
                    headerName: 'Content',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {
                        widget: 'editorjsBlockContent',
                        blockEditor: {
                            allowedBlockTypes: ['paragraph', 'header'],
                            maxBlocks: 5
                        }
                    }
                }
            ]
        } as never)

        expect(field).toMatchObject({
            id: 'content',
            type: 'JSON',
            uiConfig: {
                widget: 'editorjsBlockContent',
                blockEditor: {
                    allowedBlockTypes: ['paragraph', 'header'],
                    maxBlocks: 5
                }
            }
        })
    })
})

describe('toGridColumns', () => {
    it('omits metadata-hidden columns from the runtime grid', () => {
        const columns = toGridColumns({
            columns: [
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-manual-flag',
                    codename: 'NameManuallyEdited',
                    field: 'NameManuallyEdited',
                    dataType: 'BOOLEAN',
                    headerName: 'Name manually edited',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {
                        hidden: true
                    }
                }
            ]
        } as never)

        expect(columns.map((column) => column.field)).toEqual(['Title'])
    })
})
