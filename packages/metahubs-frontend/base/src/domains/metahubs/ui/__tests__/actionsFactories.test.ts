import { beforeEach, describe, expect, it, vi } from 'vitest'

type DescriptorLike = { id?: string; dialog?: unknown; onSelect?: unknown }
type ChildrenProps = { children?: unknown }

const createEntityActions = vi.fn((config: unknown) => config)
const createMemberActions = vi.fn((config: unknown) => config)

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
        Stack: ({ children }: ChildrenProps) => children ?? null,
        Box: ({ children }: ChildrenProps) => children ?? null,
        RadioGroup: ({ children }: ChildrenProps) => children ?? null,
        FormControlLabel: ({ children }: ChildrenProps) => children ?? null,
        Radio: () => null,
        Typography: ({ children }: ChildrenProps) => children ?? null,
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

        const descriptors = mod.default as DescriptorLike[]
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

    it('HubActions exports edit/copy/delete descriptors for localized forms', async () => {
        const mod = await import('../../../hubs/ui/HubActions')

        // HubActions exports an array of ActionDescriptors directly (not via createEntityActions)
        const descriptors = mod.default as DescriptorLike[]
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
    }, 20000)

    it('CatalogActions exports edit/copy/delete descriptors for localized forms', async () => {
        const mod = await import('../../../catalogs/ui/CatalogActions')

        // CatalogActions exports an array of ActionDescriptors directly (not via createEntityActions)
        const descriptors = mod.default as DescriptorLike[]
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

    it('EnumerationActions exports edit/copy/delete descriptors for localized forms', async () => {
        const mod = await import('../../../enumerations/ui/EnumerationActions')

        const descriptors = mod.default as DescriptorLike[]
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

    it('MetahubMemberActions passes correct config', async () => {
        const mod = await import('../MetahubMemberActions')

        const cfg = mod.default as { i18nPrefix?: string; entityType?: string }
        expect(cfg.i18nPrefix).toBe('metahubs')
        expect(cfg.entityType).toBe('metahub')
    })
})
