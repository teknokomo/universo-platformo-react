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

vi.mock('@mui/material', async () => {
    const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material')
    return {
        ...actual,
        Divider: () => null,
        Stack: ({ children }: any) => children ?? null,
        Box: ({ children }: any) => children ?? null,
        RadioGroup: ({ children }: any) => children ?? null,
        FormControlLabel: ({ children }: any) => children ?? null,
        Radio: () => null,
        Typography: ({ children }: any) => children ?? null,
        Checkbox: () => null
    }
})

vi.mock('@mui/icons-material/Edit', () => ({
    default: () => null
}))

vi.mock('@mui/icons-material/Delete', () => ({
    default: () => null
}))

vi.mock('@mui/icons-material/ContentCopy', () => ({
    default: () => null
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe('Metahubs page action factories', () => {
    it('MetahubActions exports edit/copy/delete descriptors for localized forms', async () => {
        const mod = await import('../MetahubActions')

        expect(createEntityActions).not.toHaveBeenCalled()

        const descriptors = mod.default as any[]
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const copy = descriptors.find((d) => d.id === 'copy')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit.dialog).toBeTruthy()
        expect(copy).toBeTruthy()
        expect(copy.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del.dialog || del.onSelect).toBeTruthy()
    }, 30000)

    it('HubActions exports edit/delete descriptors for localized forms', async () => {
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
    }, 20000)

    it('CatalogActions exports edit/delete descriptors for localized forms', async () => {
        const mod = await import('../../../catalogs/ui/CatalogActions')

        // CatalogActions exports an array of ActionDescriptors directly (not via createEntityActions)
        const descriptors = mod.default as any[]
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del.dialog || del.onSelect).toBeTruthy()
    }, 30000)

    it('MetahubMemberActions passes correct config', async () => {
        const mod = await import('../MetahubMemberActions')

        const cfg = mod.default as any
        expect(cfg.i18nPrefix).toBe('metahubs')
        expect(cfg.entityType).toBe('metahub')
    })
})
