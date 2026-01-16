import { beforeEach, describe, expect, it, vi } from 'vitest'

const createEntityActions = vi.fn((config: any) => config)
const createMemberActions = vi.fn((config: any) => config)

vi.mock('@universo/template-mui', () => ({
    createEntityActions,
    createMemberActions,
    LocalizedInlineField: () => null,
    useCodenameAutoFill: () => undefined,
    notifyError: vi.fn()
}))

vi.mock('@mui/material', () => ({
    Divider: () => null,
    Stack: ({ children }: any) => children ?? null
}))

vi.mock('@mui/icons-material/Edit', () => ({
    default: () => null
}))

vi.mock('@mui/icons-material/Delete', () => ({
    default: () => null
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe('Metahubs page action factories', () => {
    it('MetahubActions exports edit/delete descriptors for localized forms', async () => {
        vi.resetModules()
        const mod = await import('../MetahubActions')

        expect(createEntityActions).not.toHaveBeenCalled()

        const descriptors = mod.default as any[]
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del.dialog || del.onSelect).toBeTruthy()
    })

    it(
        'HubActions exports edit/delete descriptors for localized forms',
        async () => {
            vi.resetModules()
            const mod = await import('../../../hubs/ui/HubActions')

            // HubActions exports an array of ActionDescriptors directly (not via createEntityActions)
            const descriptors = mod.default as any[]
            expect(Array.isArray(descriptors)).toBe(true)

            const edit = descriptors.find((d) => d.id === 'edit')
            const del = descriptors.find((d) => d.id === 'delete')

            expect(edit).toBeTruthy()
            expect(edit.dialog).toBeTruthy()
            expect(del).toBeTruthy()
            expect(del.dialog || del.onSelect).toBeTruthy()
        },
        10000
    )

    it('CatalogActions exports edit/delete descriptors for localized forms', async () => {
        vi.resetModules()
        const mod = await import('../../../catalogs/ui/CatalogActions')

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
        vi.resetModules()
        const mod = await import('../MetahubMemberActions')

        const cfg = mod.default as any
        expect(cfg.i18nPrefix).toBe('metahubs')
        expect(cfg.entityType).toBe('metahub')
    })
})
