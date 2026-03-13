import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { metahubsQueryKeys } from '../../../shared'

const mocks = vi.hoisted(() => ({
    enqueueSnackbar: vi.fn(),
    t: (key: string, fallback?: string) => fallback ?? key,
    publicationsApi: {
        syncPublication: vi.fn()
    },
    templateMui: {
        applyOptimisticCreate: vi.fn(),
        applyOptimisticDelete: vi.fn(),
        applyOptimisticUpdate: vi.fn(),
        confirmOptimisticCreate: vi.fn(),
        confirmOptimisticUpdate: vi.fn(),
        generateOptimisticId: vi.fn(() => 'opt-1'),
        getCurrentLanguageKey: vi.fn(() => 'en'),
        rollbackOptimisticSnapshots: vi.fn(),
        safeInvalidateQueries: vi.fn(),
        safeInvalidateQueriesInactive: vi.fn()
    },
    utils: {
        getVLCString: vi.fn(),
        makePendingMarkers: vi.fn(() => ({}))
    }
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar })
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({
        t: mocks.t,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/template-mui', () => mocks.templateMui)

vi.mock('@universo/utils', () => mocks.utils)

vi.mock('../../api', () => mocks.publicationsApi)

import * as hooks from '../mutations'

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

beforeEach(() => {
    vi.clearAllMocks()
    mocks.publicationsApi.syncPublication.mockReset()
})

describe('publication sync mutations', () => {
    it('shows warning snackbar and invalidates publication queries when destructive confirmation is required', async () => {
        mocks.publicationsApi.syncPublication.mockResolvedValue({ status: 'pending_confirmation' })

        const queryClient = createTestQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        let syncPublication: ReturnType<typeof hooks.useSyncPublication> | undefined

        function Probe() {
            syncPublication = hooks.useSyncPublication()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await syncPublication!.mutateAsync({ metahubId: 'mh-1', publicationId: 'pub-1', confirmDestructive: false })
        })

        expect(mocks.publicationsApi.syncPublication).toHaveBeenCalledWith('mh-1', 'pub-1', false)
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.publications('mh-1') })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.publicationDetail('mh-1', 'pub-1') })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.detail('mh-1') })
        expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Destructive changes detected. Confirm to proceed.', {
            variant: 'warning'
        })
    })

    it('shows success snackbar when publication sync completes', async () => {
        mocks.publicationsApi.syncPublication.mockResolvedValue({ status: 'synced' })

        const queryClient = createTestQueryClient()
        let syncPublication: ReturnType<typeof hooks.useSyncPublication> | undefined

        function Probe() {
            syncPublication = hooks.useSyncPublication()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await syncPublication!.mutateAsync({ metahubId: 'mh-2', publicationId: 'pub-2', confirmDestructive: true })
        })

        expect(mocks.publicationsApi.syncPublication).toHaveBeenCalledWith('mh-2', 'pub-2', true)
        expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Schema synchronized', { variant: 'success' })
    })

    it('shows error snackbar when publication sync fails', async () => {
        mocks.publicationsApi.syncPublication.mockRejectedValue(new Error('publication sync failed'))

        const queryClient = createTestQueryClient()
        let syncPublication: ReturnType<typeof hooks.useSyncPublication> | undefined

        function Probe() {
            syncPublication = hooks.useSyncPublication()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await expect(syncPublication!.mutateAsync({ metahubId: 'mh-3', publicationId: 'pub-3' })).rejects.toThrow(
                'publication sync failed'
            )
        })

        expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('publication sync failed', { variant: 'error' })
    })
})
