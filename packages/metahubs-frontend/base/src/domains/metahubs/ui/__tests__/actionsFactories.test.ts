import { beforeEach, describe, expect, it, vi } from 'vitest'

type DescriptorLike = { id?: string; dialog?: unknown; onSelect?: unknown }
type ChildrenProps = { children?: unknown }

const asDescriptors = (value: unknown): readonly DescriptorLike[] => value as unknown as readonly DescriptorLike[]

const asDialogDescriptors = (value: unknown): readonly (DescriptorLike & { dialog?: { buildProps?: (ctx: any) => any } })[] =>
    value as unknown as readonly (DescriptorLike & { dialog?: { buildProps?: (ctx: any) => any } })[]

const buildLinkedCollectionDisplay = () => ({
    id: 'catalog-1',
    metahubId: 'metahub-1',
    name: 'LinkedCollectionEntity 1',
    codename: 'CatalogOne',
    description: '',
    isSingleHub: false,
    isRequiredHub: false,
    sortOrder: 0,
    createdAt: '2026-04-14T00:00:00.000Z',
    updatedAt: '2026-04-14T00:00:00.000Z',
    treeEntityId: 'hub-1'
})

const createEntityActions = vi.fn((config: unknown) => config)
const createMemberActions = vi.fn((config: unknown) => config)

vi.mock('@universo/template-mui', () => ({
    createEntityActions,
    createMemberActions,
    createEditActionIcon: () => null,
    createCopyActionIcon: () => null,
    createDeleteActionIcon: () => null,
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

        const descriptors = asDescriptors(mod.default)
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const copy = descriptors.find((d) => d.id === 'copy')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit?.dialog).toBeTruthy()
        expect(copy).toBeTruthy()
        expect(copy?.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del?.dialog || del?.onSelect).toBeTruthy()
    }, 30000)

    it('Metahub edit dialog opens the scripts tab in metahub-level scope', async () => {
        const mod = await import('../MetahubActions')

        const descriptors = asDialogDescriptors(mod.default)
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

    it('TreeEntityActions exports edit/copy/delete descriptors for localized forms', async () => {
        const mod = await import('../../../entities/presets/ui/TreeEntityActions')

        // TreeEntityActions exports an array of ActionDescriptors directly (not via createEntityActions)
        const descriptors = asDescriptors(mod.default)
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const copy = descriptors.find((d) => d.id === 'copy')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit?.dialog).toBeTruthy()
        expect(copy).toBeTruthy()
        expect(copy?.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del?.dialog || del?.onSelect).toBeTruthy()
    }, 20000)

    it('LinkedCollectionActions exports edit/copy/delete descriptors for localized forms', async () => {
        const mod = await import('../../../entities/presets/ui/LinkedCollectionActions')

        // LinkedCollectionActions exports an array of ActionDescriptors directly (not via createEntityActions)
        const descriptors = asDescriptors(mod.default)
        expect(Array.isArray(descriptors)).toBe(true)
        expect(mod.buildInitialValues).toBeTypeOf('function')
        expect(mod.validateLinkedCollectionForm).toBeTypeOf('function')

        const edit = descriptors.find((d) => d.id === 'edit')
        const copy = descriptors.find((d) => d.id === 'copy')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit?.dialog).toBeTruthy()
        expect(copy).toBeTruthy()
        expect(copy?.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del?.dialog || del?.onSelect).toBeTruthy()
    }, 30000)

    it('LinkedCollectionEntity edit dialog passes metahub and catalog context into the layout tab', async () => {
        const mod = await import('../../../entities/presets/ui/LinkedCollectionActions')

        const descriptors = asDialogDescriptors(mod.default)
        const edit = descriptors.find((d) => d.id === 'edit')
        expect(edit?.dialog?.buildProps).toBeTypeOf('function')

        const props = edit!.dialog!.buildProps!({
            entity: buildLinkedCollectionDisplay(),
            entityKind: 'linkedCollection',
            catalogMap: new Map(),
            treeEntities: [],
            metahubId: 'metahub-1',
            uiLocale: 'en',
            t: (key: string, fallback?: string) => fallback ?? key
        })

        expect(
            mod.buildInitialValues({
                entity: buildLinkedCollectionDisplay(),
                entityKind: 'linkedCollection',
                catalogMap: new Map(),
                treeEntities: [],
                metahubId: 'metahub-1',
                uiLocale: 'en',
                t: (key: string, fallback?: string) => fallback ?? key
            })
        ).toEqual(
            expect.objectContaining({
                codenameTouched: true,
                treeEntityIds: ['hub-1']
            })
        )

        const tabs = props.tabs({
            values: { treeEntityIds: [], isSingleHub: false, isRequiredHub: false },
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })
        const layoutTab = tabs.find((tab: any) => tab.id === 'layout')

        expect(layoutTab).toBeTruthy()
        expect(layoutTab.content.props.metahubId).toBe('metahub-1')
        expect(layoutTab.content.props.linkedCollectionId).toBe('catalog-1')
    })

    it('LinkedCollectionEntity copy dialog build props remain callable for fire-and-forget copy flows', async () => {
        const mod = await import('../../../entities/presets/ui/LinkedCollectionActions')

        const descriptors = asDialogDescriptors(mod.default)
        const copy = descriptors.find((d) => d.id === 'copy')
        expect(copy?.dialog?.buildProps).toBeTypeOf('function')

        const props = copy!.dialog!.buildProps!({
            entity: buildLinkedCollectionDisplay(),
            entityKind: 'linkedCollection',
            catalogMap: new Map(),
            treeEntities: [],
            metahubId: 'metahub-1',
            uiLocale: 'en',
            t: (key: string, fallback?: string) => fallback ?? key
        })

        expect(props.initialExtraValues).toEqual(
            expect.objectContaining({
                codename: null,
                codenameTouched: false,
                treeEntityIds: ['hub-1']
            })
        )
    })

    it('OptionListActions exports edit/copy/delete descriptors for localized forms', async () => {
        const mod = await import('../../../entities/presets/ui/OptionListActions')

        const descriptors = asDescriptors(mod.default)
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const copy = descriptors.find((d) => d.id === 'copy')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit?.dialog).toBeTruthy()
        expect(copy).toBeTruthy()
        expect(copy?.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        expect(del?.dialog || del?.onSelect).toBeTruthy()
    }, 30000)

    it('MetahubMemberActions passes correct config', async () => {
        const mod = await import('../MetahubMemberActions')

        const cfg = mod.default as { i18nPrefix?: string; entityType?: string }
        expect(cfg.i18nPrefix).toBe('metahubs')
        expect(cfg.entityType).toBe('metahub')
    })
})
