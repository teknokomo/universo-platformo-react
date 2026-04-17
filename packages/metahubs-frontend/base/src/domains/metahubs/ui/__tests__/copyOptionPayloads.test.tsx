import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent } from '@universo/utils'

vi.mock('@universo/template-mui', () => ({
    createEntityActions: vi.fn((config: unknown) => config),
    createMemberActions: vi.fn((config: unknown) => config),
    LocalizedInlineField: () => null,
    useCodenameAutoFillVlc: () => undefined,
    notifyError: vi.fn()
}))

const makeVlc = (content: string): VersionedLocalizedContent<string> => createLocalizedContent('en', content)

const asCopyDescriptors = (value: unknown): readonly CopyDescriptor[] => value as unknown as readonly CopyDescriptor[]

const baseHelpers = () => ({
    refreshList: vi.fn().mockResolvedValue(undefined),
    enqueueSnackbar: vi.fn()
})

const expectImmediateSettlement = async (result: void | Promise<void> | undefined) => {
    let settled = false

    if (result && typeof (result as Promise<void>).finally === 'function') {
        void (result as Promise<void>).finally(() => {
            settled = true
        })
    } else {
        settled = true
    }

    await Promise.resolve()
    expect(settled).toBe(true)
}

type CopyDescriptor = {
    id?: string
    dialog?: {
        buildProps: (ctx: unknown) => {
            onSave: (values: unknown) => void | Promise<void>
        }
    }
}

describe('Entity copy option payloads', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('normalizes hub copy options before sending payload', async () => {
        const mod = await import('../../../entities/presets/ui/TreeEntityActions')
        const copy = asCopyDescriptors(mod.default).find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const copyEntity = vi.fn().mockReturnValue(new Promise(() => {}))
        const helpers = baseHelpers()
        const props = copy?.dialog?.buildProps({
            entity: { id: 'hub-1', codename: 'main-hub', name: 'Main hub', description: '' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { copyEntity },
            helpers
        })
        expect(props).toBeTruthy()

        const result = props?.onSave({
            nameVlc: makeVlc('Main hub (copy)'),
            descriptionVlc: null,
            codename: makeVlc('main-hub-copy'),
            copyAllRelations: false
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'hub-1',
            expect.objectContaining({
                copyAllRelations: false,
                copyLinkedCollectionRelations: false,
                copyOptionListRelations: false
            })
        )
        await expectImmediateSettlement(result)
        expect(helpers.refreshList).not.toHaveBeenCalled()
    })

    it('normalizes catalog copy options before sending payload', async () => {
        const mod = await import('../../../entities/presets/ui/LinkedCollectionActions')
        const copy = asCopyDescriptors(mod.default).find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const copyEntity = vi.fn().mockReturnValue(new Promise(() => {}))
        const helpers = baseHelpers()
        const props = copy?.dialog?.buildProps({
            entity: { id: 'catalog-1', codename: 'products', name: 'Products', description: '' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { copyEntity },
            helpers
        })
        expect(props).toBeTruthy()

        const result = props?.onSave({
            nameVlc: makeVlc('Products (copy)'),
            descriptionVlc: null,
            codename: makeVlc('products-copy'),
            copyFieldDefinitions: false,
            copyRecords: true
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'catalog-1',
            expect.objectContaining({
                copyFieldDefinitions: false,
                copyRecords: false
            })
        )
        await expectImmediateSettlement(result)
        expect(helpers.refreshList).not.toHaveBeenCalled()
    })

    it('applies default enumeration copy options when not provided', async () => {
        const mod = await import('../../../entities/presets/ui/OptionListActions')
        const copy = asCopyDescriptors(mod.default).find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const copyEntity = vi.fn().mockReturnValue(new Promise(() => {}))
        const helpers = baseHelpers()
        const props = copy?.dialog?.buildProps({
            entity: { id: 'enum-1', codename: 'status', name: 'Status', description: '' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { copyEntity },
            helpers
        })
        expect(props).toBeTruthy()

        const result = props?.onSave({
            nameVlc: makeVlc('Status (copy)'),
            descriptionVlc: null,
            codename: 'status-copy'
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'enum-1',
            expect.objectContaining({
                copyOptionValues: true
            })
        )
        await expectImmediateSettlement(result)
        expect(helpers.refreshList).not.toHaveBeenCalled()
    })

    it('returns immediately from publication edit save while update mutation is still pending', async () => {
        const mod = await import('../../../publications/ui/PublicationActions')
        const edit = asCopyDescriptors(mod.default).find((descriptor) => descriptor.id === 'edit')
        expect(edit).toBeTruthy()

        const updateEntity = vi.fn().mockReturnValue(new Promise(() => {}))
        const helpers = baseHelpers()
        const props = edit?.dialog?.buildProps({
            entity: { id: 'publication-1', name: 'Main publication', description: 'Initial', accessMode: 'full' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { updateEntity },
            helpers
        })

        const result = props?.onSave({
            nameVlc: makeVlc('Main publication updated'),
            descriptionVlc: null,
            accessMode: 'restricted'
        })

        expect(updateEntity).toHaveBeenCalledWith(
            'publication-1',
            expect.objectContaining({
                name: { en: 'Main publication updated' }
            })
        )
        await expectImmediateSettlement(result)
        expect(helpers.refreshList).not.toHaveBeenCalled()
    })

    it('returns immediately from metahub edit save while update mutation is still pending', async () => {
        const mod = await import('../MetahubActions')
        const edit = asCopyDescriptors(mod.default).find((descriptor) => descriptor.id === 'edit')
        expect(edit).toBeTruthy()

        const updateEntity = vi.fn().mockReturnValue(new Promise(() => {}))
        const helpers = baseHelpers()
        const props = edit?.dialog?.buildProps({
            entity: { id: 'metahub-1', codename: 'main-hub', name: 'Main hub', description: '' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { updateEntity },
            helpers
        })

        const result = props?.onSave({
            nameVlc: makeVlc('Main hub updated'),
            descriptionVlc: null,
            codename: makeVlc('main-hub-updated')
        })

        expect(updateEntity).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({
                codename: expect.objectContaining({
                    _primary: 'en',
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'main-hub-updated' })
                    })
                }),
                name: { en: 'Main hub updated' }
            })
        )
        expect(result).toBeUndefined()
        expect(helpers.refreshList).not.toHaveBeenCalled()
    })

    it('returns immediately from metahub copy save while copy mutation is still pending', async () => {
        const mod = await import('../MetahubActions')
        const copy = asCopyDescriptors(mod.default).find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const copyEntity = vi.fn().mockReturnValue(new Promise(() => {}))
        const helpers = baseHelpers()
        const props = copy?.dialog?.buildProps({
            entity: { id: 'metahub-1', codename: 'main-hub', name: 'Main hub', description: '' },
            uiLocale: 'en',
            t: (key: string, defaultValue?: string) => defaultValue ?? key,
            api: { copyEntity },
            helpers
        })

        const result = props?.onSave({
            nameVlc: makeVlc('Main hub (copy)'),
            descriptionVlc: null,
            codename: makeVlc('main-hub-copy'),
            copyDefaultBranchOnly: false,
            copyAccess: true
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({
                codename: expect.objectContaining({
                    _primary: 'en',
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'main-hub-copy' })
                    })
                }),
                name: { en: 'Main hub (copy)' },
                copyDefaultBranchOnly: false,
                copyAccess: true
            })
        )
        expect(result).toBeUndefined()
        expect(helpers.refreshList).not.toHaveBeenCalled()
    })
})
