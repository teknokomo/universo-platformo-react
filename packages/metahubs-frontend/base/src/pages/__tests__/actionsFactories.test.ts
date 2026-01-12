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

    it('HubActions exports edit/delete descriptors for localized forms', async () => {
        const mod = await import('../HubActions')

        // HubActions exports an array of ActionDescriptors directly (not via createEntityActions)
        const descriptors = mod.default as any[]
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del.dialog).toBeTruthy()
    })

    it('CatalogActions exports edit/delete descriptors for localized forms', async () => {
        const mod = await import('../CatalogActions')

        // CatalogActions exports an array of ActionDescriptors directly (not via createEntityActions)
        const descriptors = mod.default as any[]
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del.dialog).toBeTruthy()
    })

    it('MetahubMemberActions passes correct config', async () => {
        const mod = await import('../MetahubMemberActions')

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
