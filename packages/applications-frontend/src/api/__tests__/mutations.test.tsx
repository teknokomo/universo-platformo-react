import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            },
            mutations: {
                retry: false
            }
        }
    })

function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

describe('runtime cell mutation helpers', () => {
    it('keeps the latest pending value per cell while preserving independent cells', async () => {
        vi.doMock('../applications', () => ({
            getApplicationRuntimeRow: vi.fn(),
            createApplicationRuntimeRow: vi.fn(),
            updateApplicationRuntimeRow: vi.fn(),
            deleteApplicationRuntimeRow: vi.fn(),
            updateApplicationRuntimeCell: vi.fn()
        }))
        vi.doMock('@universo/template-mui', () => ({
            safeInvalidateQueries: vi.fn()
        }))

        const { buildPendingRuntimeCellMap, getRuntimeCellPendingKey } = await import('../mutations')

        const pendingMap = buildPendingRuntimeCellMap([
            { rowId: 'row-1', field: 'done', value: true, submittedAt: 10 },
            { rowId: 'row-2', field: 'done', value: false, submittedAt: 15 },
            { rowId: 'row-1', field: 'done', value: false, submittedAt: 20 }
        ])

        expect(pendingMap.get(getRuntimeCellPendingKey('row-1', 'done'))).toBe(false)
        expect(pendingMap.get(getRuntimeCellPendingKey('row-2', 'done'))).toBe(false)
        expect(pendingMap.size).toBe(2)
    })

    it('tracks concurrent pending checkbox mutations per application', async () => {
        const firstPending = createDeferred<void>()
        const secondPending = createDeferred<void>()
        const otherApplicationPending = createDeferred<void>()
        const safeInvalidateQueries = vi.fn((queryClient: QueryClient, _domain: unknown, ...queryKeys: unknown[]) => {
            queryKeys.forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey: queryKey as readonly unknown[] })
            })
        })
        const updateApplicationRuntimeCell = vi
            .fn()
            .mockImplementationOnce(() => firstPending.promise)
            .mockImplementationOnce(() => secondPending.promise)
            .mockImplementationOnce(() => otherApplicationPending.promise)

        vi.doMock('../applications', () => ({
            getApplicationRuntimeRow: vi.fn(),
            createApplicationRuntimeRow: vi.fn(),
            updateApplicationRuntimeRow: vi.fn(),
            deleteApplicationRuntimeRow: vi.fn(),
            updateApplicationRuntimeCell
        }))
        vi.doMock('@universo/template-mui', () => ({
            safeInvalidateQueries
        }))

        const { buildPendingRuntimeCellMap, getRuntimeCellPendingKey, usePendingRuntimeCellMutations, useUpdateRuntimeCell } = await import(
            '../mutations'
        )

        const queryClient = createTestQueryClient()
        let mutateApp1: ((params: { rowId: string; field: string; value: boolean | null; objectCollectionId?: string }) => void) | undefined
        let mutateApp2: ((params: { rowId: string; field: string; value: boolean | null; objectCollectionId?: string }) => void) | undefined
        let pendingApp1: Array<{ rowId: string; field: string; value: boolean | null; submittedAt: number }> = []
        let pendingApp2: Array<{ rowId: string; field: string; value: boolean | null; submittedAt: number }> = []

        function Probe() {
            const app1Mutation = useUpdateRuntimeCell({ applicationId: 'app-1' })
            const app2Mutation = useUpdateRuntimeCell({ applicationId: 'app-2' })

            mutateApp1 = app1Mutation.mutate
            mutateApp2 = app2Mutation.mutate
            pendingApp1 = usePendingRuntimeCellMutations({ applicationId: 'app-1' })
            pendingApp2 = usePendingRuntimeCellMutations({ applicationId: 'app-2' })

            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        await act(async () => {
            mutateApp1?.({ rowId: 'row-1', field: 'done', value: true })
            mutateApp1?.({ rowId: 'row-2', field: 'done', value: false })
            mutateApp2?.({ rowId: 'row-9', field: 'done', value: true })
            await Promise.resolve()
        })

        await waitFor(() => {
            expect(pendingApp1).toHaveLength(2)
        })
        expect(pendingApp2).toHaveLength(1)

        const pendingMap = buildPendingRuntimeCellMap(pendingApp1)
        expect(pendingMap.get(getRuntimeCellPendingKey('row-1', 'done'))).toBe(true)
        expect(pendingMap.get(getRuntimeCellPendingKey('row-2', 'done'))).toBe(false)
        expect(pendingMap.has(getRuntimeCellPendingKey('row-9', 'done'))).toBe(false)

        firstPending.resolve()
        secondPending.resolve()
        otherApplicationPending.resolve()

        await waitFor(() => {
            expect(pendingApp1).toHaveLength(0)
        })
        await waitFor(() => {
            expect(pendingApp2).toHaveLength(0)
        })

        expect(updateApplicationRuntimeCell).toHaveBeenCalledTimes(3)
        expect(safeInvalidateQueries).toHaveBeenCalled()
    })
})
