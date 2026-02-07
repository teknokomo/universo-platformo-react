import { beforeEach, describe, expect, it, vi } from 'vitest'

const createEntityActions = vi.fn((config: any) => config)
const createMemberActions = vi.fn((config: any) => config)

vi.mock('@universo/template-mui', () => ({
    createEntityActions,
    createMemberActions,
    useViewPreference: (key: string) => ['card', vi.fn()],
    DEFAULT_VIEW_STYLE: 'card'
}))

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('Applications page action factories', () => {
    it('ApplicationActions exports edit/copy/delete descriptors for localized forms', async () => {
        const mod = await import('../ApplicationActions')

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
        expect(del.dialog).toBeTruthy()
    })

    it('ConnectorActions exports edit/delete descriptors for localized forms', async () => {
        const mod = await import('../ConnectorActions')

        // ConnectorActions exports an array of ActionDescriptors directly (not via createEntityActions)
        const descriptors = mod.default as any[]
        expect(Array.isArray(descriptors)).toBe(true)

        const edit = descriptors.find((d) => d.id === 'edit')
        const del = descriptors.find((d) => d.id === 'delete')

        expect(edit).toBeTruthy()
        expect(edit.dialog).toBeTruthy()
        expect(del).toBeTruthy()
        // Connector delete is handled via onSelect -> openDeleteDialog helper
        expect(del.onSelect).toBeTruthy()
    }, 15000)

    it('ApplicationMemberActions passes correct config', async () => {
        const mod = await import('../ApplicationMemberActions')

        expect(createMemberActions).toHaveBeenCalledTimes(1)
        expect(createMemberActions).toHaveBeenCalledWith(
            expect.objectContaining({
                i18nPrefix: 'applications',
                entityType: 'application'
            })
        )

        const cfg = mod.default as any
        expect(cfg.i18nPrefix).toBe('applications')
        expect(cfg.entityType).toBe('application')
    })
})
