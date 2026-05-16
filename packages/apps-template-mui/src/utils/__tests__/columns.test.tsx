import { describe, expect, it } from 'vitest'
import { toFieldConfigs } from '../columns'

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
