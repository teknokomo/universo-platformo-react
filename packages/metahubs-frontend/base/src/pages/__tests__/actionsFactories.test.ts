import { beforeEach, describe, expect, it, vi } from 'vitest'

const createEntityActions = vi.fn((config: any) => config)
const createMemberActions = vi.fn((config: any) => config)

vi.mock('@universo/template-mui', () => ({
    createEntityActions,
    createMemberActions
}))

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('Metahubs page action factories', () => {
    it('MetahubActions exports edit/delete descriptors for localized forms', async () => {
        const mod = await import('../MetahubActions')

        expect(createEntityActions).not.toHaveBeenCalled()

        const descriptors = mod.default as any[]
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del.dialog).toBeTruthy()
    })

    it('MetaSectionActions passes correct config and getInitialFormData works', async () => {
        const mod = await import('../MetaSectionActions')

        expect(createEntityActions).toHaveBeenCalledTimes(1)
        expect(createEntityActions).toHaveBeenCalledWith(
            expect.objectContaining({
                i18nPrefix: 'meta_sections',
                getInitialFormData: expect.any(Function)
            })
        )

        const cfg = mod.default as any
        expect(cfg.i18nPrefix).toBe('meta_sections')

        expect(cfg.getInitialFormData({ name: 'Section', description: undefined })).toEqual({
            initialName: 'Section',
            initialDescription: ''
        })
    })

    it('MetaEntityActions passes correct config and getInitialFormData works', async () => {
        const mod = await import('../MetaEntityActions')

        expect(createEntityActions).toHaveBeenCalledTimes(1)
        expect(createEntityActions).toHaveBeenCalledWith(
            expect.objectContaining({
                i18nPrefix: 'meta_entities',
                getInitialFormData: expect.any(Function)
            })
        )

        const cfg = mod.default as any
        expect(cfg.i18nPrefix).toBe('meta_entities')

        expect(cfg.getInitialFormData({ name: 'Entity', description: undefined })).toEqual({
            initialName: 'Entity',
            initialDescription: ''
        })
    })

    it('MemberActions passes correct config', async () => {
        const mod = await import('../MemberActions')

        expect(createMemberActions).toHaveBeenCalledTimes(1)
        expect(createMemberActions).toHaveBeenCalledWith(
            expect.objectContaining({
                i18nPrefix: 'metahubs',
                entityType: 'metahub'
            })
        )

        const cfg = mod.default as any
        expect(cfg.i18nPrefix).toBe('metahubs')
        expect(cfg.entityType).toBe('metahub')
    })
})
