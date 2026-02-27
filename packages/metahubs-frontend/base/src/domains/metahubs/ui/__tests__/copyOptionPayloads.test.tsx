import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VersionedLocalizedContent } from '@universo/types'

vi.mock('@universo/template-mui', () => ({
    createEntityActions: vi.fn((config: unknown) => config),
    createMemberActions: vi.fn((config: unknown) => config),
    LocalizedInlineField: () => null,
    useCodenameAutoFill: () => undefined,
    notifyError: vi.fn()
}))

const makeVlc = (content: string): VersionedLocalizedContent<string> => ({
    _schema: 'v1',
    _primary: 'en',
    locales: { en: { content } }
})

const baseHelpers = () => ({
    refreshList: vi.fn().mockResolvedValue(undefined),
    enqueueSnackbar: vi.fn()
})

type CopyDescriptor = {
    id?: string
    dialog?: {
        buildProps: (ctx: unknown) => {
            onSave: (values: unknown) => Promise<void>
        }
    }
}

describe('Entity copy option payloads', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('normalizes hub copy options before sending payload', async () => {
        const mod = await import('../../../hubs/ui/HubActions')
        const copy = (mod.default as CopyDescriptor[]).find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const copyEntity = vi.fn().mockResolvedValue(undefined)
        const helpers = baseHelpers()
        const props = copy?.dialog?.buildProps({
            entity: { id: 'hub-1', codename: 'main-hub', name: 'Main hub', description: '' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { copyEntity },
            helpers
        })
        expect(props).toBeTruthy()

        await props?.onSave({
            nameVlc: makeVlc('Main hub (copy)'),
            descriptionVlc: null,
            codename: 'main-hub-copy',
            copyAllRelations: false
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'hub-1',
            expect.objectContaining({
                copyAllRelations: false,
                copyCatalogRelations: false,
                copyEnumerationRelations: false
            })
        )
        expect(helpers.refreshList).toHaveBeenCalled()
    })

    it('normalizes catalog copy options before sending payload', async () => {
        const mod = await import('../../../catalogs/ui/CatalogActions')
        const copy = (mod.default as CopyDescriptor[]).find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const copyEntity = vi.fn().mockResolvedValue(undefined)
        const helpers = baseHelpers()
        const props = copy?.dialog?.buildProps({
            entity: { id: 'catalog-1', codename: 'products', name: 'Products', description: '' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { copyEntity },
            helpers
        })
        expect(props).toBeTruthy()

        await props?.onSave({
            nameVlc: makeVlc('Products (copy)'),
            descriptionVlc: null,
            codename: 'products-copy',
            copyAttributes: false,
            copyElements: true
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'catalog-1',
            expect.objectContaining({
                copyAttributes: false,
                copyElements: false
            })
        )
        expect(helpers.refreshList).toHaveBeenCalled()
    })

    it('applies default enumeration copy options when not provided', async () => {
        const mod = await import('../../../enumerations/ui/EnumerationActions')
        const copy = (mod.default as CopyDescriptor[]).find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const copyEntity = vi.fn().mockResolvedValue(undefined)
        const helpers = baseHelpers()
        const props = copy?.dialog?.buildProps({
            entity: { id: 'enum-1', codename: 'status', name: 'Status', description: '' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { copyEntity },
            helpers
        })
        expect(props).toBeTruthy()

        await props?.onSave({
            nameVlc: makeVlc('Status (copy)'),
            descriptionVlc: null,
            codename: 'status-copy'
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'enum-1',
            expect.objectContaining({
                copyValues: true
            })
        )
        expect(helpers.refreshList).toHaveBeenCalled()
    })
})
