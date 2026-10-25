import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteInterpretationNetworkMaterial } from '../../../../api/interpretationNetwork'
import { useMaterialMutations } from './useMaterialMutations'

vi.mock('../../../../api/interpretationNetwork', () => ({
    createInterpretationNetworkMaterial: vi.fn(),
    deleteInterpretationNetworkMaterial: vi.fn(),
    setInterpretationNetworkPrimaryMaterial: vi.fn(),
    updateInterpretationNetworkMaterial: vi.fn()
}))

const mockedDeleteMaterial = vi.mocked(deleteInterpretationNetworkMaterial)

const createMutationOptions = (overrides: Record<string, unknown> = {}) => ({
    t: ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction<'interpretationNetwork'>,
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    details: { apiBaseUrl: 'http://localhost:3000', applicationId: 'application-id', currentWorkspaceId: 'workspace-id' },
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    interpretationId: '019f2000-0000-7000-8000-000000000751',
    selectedCell: { id: '019f2000-0000-7000-8000-000000000752' },
    selectedRawCell: { id: 'raw-cell', _upl_version: 5 },
    cellMaterials: [{ id: '019f2000-0000-7000-8000-000000000753', _upl_version: 6 }],
    materials: [],
    materialDialogMode: null,
    editingMaterialId: null,
    openedMaterialId: null,
    setMaterialDialogMode: vi.fn(),
    setEditingMaterialId: vi.fn(),
    setSelectedMaterialId: vi.fn(),
    setOpenedMaterialId: vi.fn(),
    setMaterialDialogError: vi.fn(),
    setPrimaryActionError: vi.fn(),
    setDeleteMaterialError: vi.fn(),
    ...overrides
})

const renderMaterialMutations = (options: ReturnType<typeof createMutationOptions>) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={options.queryClient}>{children}</QueryClientProvider>
    )
    return renderHook(() => useMaterialMutations(options as never), { wrapper })
}

describe('useMaterialMutations deletion', () => {
    beforeEach(() => vi.clearAllMocks())

    it('deletes a versioned material and invalidates every affected workspace projection', async () => {
        const options = createMutationOptions()
        const invalidateQueries = vi.spyOn(options.queryClient, 'invalidateQueries').mockResolvedValue(undefined as never)
        mockedDeleteMaterial.mockResolvedValue({ primaryMaterialCleared: false, cellVersion: 5 })
        const { result } = renderMaterialMutations(options)

        await act(async () => {
            await result.current.deleteMaterialMutation.mutateAsync('019f2000-0000-7000-8000-000000000753')
        })

        expect(mockedDeleteMaterial).toHaveBeenCalledWith(
            expect.objectContaining({
                applicationId: 'application-id',
                workspaceId: 'workspace-id',
                interpretationId: '019f2000-0000-7000-8000-000000000751',
                cellId: '019f2000-0000-7000-8000-000000000752',
                materialId: '019f2000-0000-7000-8000-000000000753',
                expectedCellVersion: 5,
                expectedMaterialVersion: 6
            })
        )
        expect(invalidateQueries).toHaveBeenCalledTimes(3)
        expect(options.setDeleteMaterialError).toHaveBeenLastCalledWith(null)
    })

    it('blocks deletion when delete permission is absent', async () => {
        const options = createMutationOptions({ canDeleteContent: false })
        const { result } = renderMaterialMutations(options)

        await expect(result.current.deleteMaterialMutation.mutateAsync('019f2000-0000-7000-8000-000000000753')).rejects.toThrow(
            'permission-denied'
        )

        expect(mockedDeleteMaterial).not.toHaveBeenCalled()
        expect(options.setDeleteMaterialError).toHaveBeenLastCalledWith('Could not delete the material.')
    })

    it('fails closed when the cell or material version is unavailable', async () => {
        const options = createMutationOptions({ selectedRawCell: {}, cellMaterials: [{ id: '019f2000-0000-7000-8000-000000000753' }] })
        const { result } = renderMaterialMutations(options)

        await expect(result.current.deleteMaterialMutation.mutateAsync('019f2000-0000-7000-8000-000000000753')).rejects.toThrow(
            'version-unavailable'
        )

        expect(mockedDeleteMaterial).not.toHaveBeenCalled()
        expect(options.setDeleteMaterialError).toHaveBeenLastCalledWith('Could not delete the material.')
    })
})
