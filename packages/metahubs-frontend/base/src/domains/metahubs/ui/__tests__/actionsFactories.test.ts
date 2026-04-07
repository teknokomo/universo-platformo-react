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

    it('Metahub edit dialog opens the scripts tab in metahub-level scope', async () => {
        const mod = await import('../MetahubActions')

        const descriptors = mod.default as Array<DescriptorLike & { dialog?: { buildProps?: (ctx: any) => any } }>
        const edit = descriptors.find((d) => d.id === 'edit')
        expect(edit?.dialog?.buildProps).toBeTypeOf('function')

        const props = edit!.dialog!.buildProps!({
            entity: { id: 'metahub-1', name: 'Metahub 1', codename: 'MetahubOne' },
            metahubMap: new Map(),
            uiLocale: 'ru',
            t: (key: string, fallback?: string) => fallback ?? key
        })

        const tabs = props.tabs({ values: {}, setValue: vi.fn(), isLoading: false, errors: {} })
        const scriptsTab = tabs.find((tab: any) => tab.id === 'scripts')

        expect(scriptsTab).toBeTruthy()
        expect(scriptsTab.content.props.metahubId).toBe('metahub-1')
        expect(scriptsTab.content.props.attachedToKind).toBe('metahub')
        expect(scriptsTab.content.props.attachedToId).toBeNull()
    })

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
        expect(mod.buildInitialValues).toBeTypeOf('function')
        expect(mod.validateCatalogForm).toBeTypeOf('function')

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

    it('Catalog edit dialog passes metahub and catalog context into the layout tab', async () => {
        const mod = await import('../../../catalogs/ui/CatalogActions')

        const descriptors = mod.default as Array<DescriptorLike & { dialog?: { buildProps?: (ctx: any) => any } }>
        const edit = descriptors.find((d) => d.id === 'edit')
        expect(edit?.dialog?.buildProps).toBeTypeOf('function')

        const props = edit!.dialog!.buildProps!({
            entity: { id: 'catalog-1', name: 'Catalog 1', codename: 'CatalogOne' },
            catalogMap: new Map(),
            hubs: [],
            metahubId: 'metahub-1',
            uiLocale: 'en',
            t: (key: string, fallback?: string) => fallback ?? key
        })

        expect(
            mod.buildInitialValues({
                entity: { id: 'catalog-1', name: 'Catalog 1', codename: 'CatalogOne', hubId: 'hub-1' },
                catalogMap: new Map(),
                hubs: [],
                metahubId: 'metahub-1',
                uiLocale: 'en',
                t: (key: string, fallback?: string) => fallback ?? key
            })
        ).toEqual(
            expect.objectContaining({
                codenameTouched: true,
                hubIds: ['hub-1']
            })
        )

        const tabs = props.tabs({
            values: { hubIds: [], isSingleHub: false, isRequiredHub: false },
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })
        const layoutTab = tabs.find((tab: any) => tab.id === 'layout')

        expect(layoutTab).toBeTruthy()
        expect(layoutTab.content.props.metahubId).toBe('metahub-1')
        expect(layoutTab.content.props.catalogId).toBe('catalog-1')
    })

    it('Catalog copy dialog build props remain callable for fire-and-forget copy flows', async () => {
        const mod = await import('../../../catalogs/ui/CatalogActions')

        const descriptors = mod.default as Array<DescriptorLike & { dialog?: { buildProps?: (ctx: any) => any } }>
        const copy = descriptors.find((d) => d.id === 'copy')
        expect(copy?.dialog?.buildProps).toBeTypeOf('function')

        const props = copy!.dialog!.buildProps!({
            entity: { id: 'catalog-1', name: 'Catalog 1', codename: 'CatalogOne', hubId: 'hub-1' },
            catalogMap: new Map(),
            hubs: [],
            metahubId: 'metahub-1',
            uiLocale: 'en',
            t: (key: string, fallback?: string) => fallback ?? key
        })

        expect(props.initialExtraValues).toEqual(
            expect.objectContaining({
                codename: null,
                codenameTouched: false,
                hubIds: ['hub-1']
            })
        )
    })

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
