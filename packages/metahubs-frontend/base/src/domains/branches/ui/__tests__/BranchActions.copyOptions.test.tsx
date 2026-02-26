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

const createCopyContext = () => {
    const copyEntity = vi.fn().mockResolvedValue(undefined)
    const refreshList = vi.fn().mockResolvedValue(undefined)

    const ctx = {
        entity: {
            id: 'branch-1',
            metahubId: 'metahub-1',
            codename: 'main',
            name: 'Main',
            description: '',
            isActive: false,
            isDefault: false
        },
        uiLocale: 'en',
        t: (key: string, defaultValue?: string) => defaultValue ?? key,
        api: { copyEntity },
        helpers: {
            refreshList,
            enqueueSnackbar: vi.fn()
        },
        runtime: {}
    } as any

    return { ctx, copyEntity, refreshList }
}

describe('BranchActions copy options', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders copy dialog with an options tab', async () => {
        const mod = await import('../BranchActions')
        const descriptors = mod.default as any[]
        const copy = descriptors.find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const { ctx } = createCopyContext()
        const props = copy.dialog.buildProps(ctx)
        const tabs = props.tabs({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(Array.isArray(tabs)).toBe(true)
        expect(tabs.some((tab: any) => tab.id === 'options')).toBe(true)
    })

    it('normalizes copy options in payload when saving copy dialog', async () => {
        const mod = await import('../BranchActions')
        const descriptors = mod.default as any[]
        const copy = descriptors.find((descriptor) => descriptor.id === 'copy')
        expect(copy).toBeTruthy()

        const { ctx, copyEntity, refreshList } = createCopyContext()
        const props = copy.dialog.buildProps(ctx)

        await props.onSave({
            nameVlc: makeVlc('Main (copy)'),
            descriptionVlc: null,
            codename: 'main-copy',
            fullCopy: false,
            copyLayouts: true,
            copyHubs: true,
            copyCatalogs: false,
            copyEnumerations: true
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'branch-1',
            expect.objectContaining({
                sourceBranchId: 'branch-1',
                fullCopy: false,
                copyLayouts: true,
                copyHubs: true,
                copyCatalogs: false,
                copyEnumerations: true
            })
        )
        expect(refreshList).toHaveBeenCalled()
    })
})
