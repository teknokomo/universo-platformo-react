import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('entity actions config modules', () => {
    it('export createEntityActions config with correct i18nPrefix and initial form data mapping', async () => {
        const createEntityActions = vi.fn((config: any) => config)

        vi.doMock('@universo/template-mui', () => ({
            createEntityActions
        }))

        const { default: metaverseActions } = await import('../MetaverseActions')
        const { default: sectionActions } = await import('../SectionActions')
        const { default: entityActions } = await import('../EntityActions')

        expect(createEntityActions).toHaveBeenCalledTimes(3)

        expect(metaverseActions.i18nPrefix).toBe('metaverses')
        expect(metaverseActions.getInitialFormData({ name: 'M', description: undefined })).toEqual({
            initialName: 'M',
            initialDescription: ''
        })

        expect(sectionActions.i18nPrefix).toBe('sections')
        expect(sectionActions.getInitialFormData({ name: 'S', description: 'd' })).toEqual({
            initialName: 'S',
            initialDescription: 'd'
        })

        expect(entityActions.i18nPrefix).toBe('entities')
        expect(entityActions.getInitialFormData({ name: 'E', description: '' })).toEqual({
            initialName: 'E',
            initialDescription: ''
        })
    })
})
