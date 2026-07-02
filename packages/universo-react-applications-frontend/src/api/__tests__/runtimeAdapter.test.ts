import { beforeEach, describe, expect, it, vi } from 'vitest'

const applicationsApiMocks = vi.hoisted(() => ({
    getApplicationRuntime: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
    getApplicationRuntimeRow: vi.fn().mockResolvedValue({ id: 'row-1' }),
    listApplicationRuntimeTabularRows: vi.fn().mockResolvedValue([]),
    createApplicationRuntimeRow: vi.fn().mockResolvedValue({ id: 'row-new' }),
    updateApplicationRuntimeRow: vi.fn().mockResolvedValue({ id: 'row-1' }),
    deleteApplicationRuntimeRow: vi.fn().mockResolvedValue(undefined),
    restoreApplicationRuntimeRow: vi.fn().mockResolvedValue(undefined),
    copyApplicationRuntimeRow: vi.fn().mockResolvedValue({ id: 'row-copy' }),
    runApplicationRuntimeRecordCommand: vi.fn().mockResolvedValue({ id: 'row-1' }),
    runApplicationRuntimeWorkflowAction: vi.fn().mockResolvedValue({ id: 'row-1' }),
    reorderApplicationRuntimeRows: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../applications', () => applicationsApiMocks)

describe('createRuntimeAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes runtime row targets as scalar API parameters', async () => {
        const { createRuntimeAdapter } = await import('../runtimeAdapter')
        const adapter = createRuntimeAdapter('app-1')
        const target = { objectCollectionId: 'object-1', sectionId: 'section-1' }

        await adapter.fetchRow('row-1', target)
        await adapter.createRow({ title: 'New' }, target)
        await adapter.updateRow('row-1', { title: 'Updated' }, target, 3)
        await adapter.deleteRow('row-1', target, 4)
        await adapter.restoreRow?.('row-1', target, 5)

        expect(applicationsApiMocks.getApplicationRuntimeRow).toHaveBeenCalledWith({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            sectionId: 'section-1'
        })
        expect(applicationsApiMocks.createApplicationRuntimeRow).toHaveBeenCalledWith({
            applicationId: 'app-1',
            data: { title: 'New' },
            objectCollectionId: 'object-1',
            sectionId: 'section-1'
        })
        expect(applicationsApiMocks.updateApplicationRuntimeRow).toHaveBeenCalledWith({
            applicationId: 'app-1',
            rowId: 'row-1',
            data: { title: 'Updated' },
            objectCollectionId: 'object-1',
            sectionId: 'section-1',
            expectedVersion: 3
        })
        expect(applicationsApiMocks.deleteApplicationRuntimeRow).toHaveBeenCalledWith({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            sectionId: 'section-1',
            expectedVersion: 4
        })
        expect(applicationsApiMocks.restoreApplicationRuntimeRow).toHaveBeenCalledWith({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            sectionId: 'section-1',
            expectedVersion: 5,
            restoreTarget: undefined
        })
    })

    it('uses object collection as the fallback section target', async () => {
        const { createRuntimeAdapter } = await import('../runtimeAdapter')
        const adapter = createRuntimeAdapter('app-1')

        await adapter.fetchRow('row-1', { objectCollectionId: 'object-1' })

        expect(applicationsApiMocks.getApplicationRuntimeRow).toHaveBeenCalledWith({
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'object-1',
            sectionId: 'object-1'
        })
    })
})
