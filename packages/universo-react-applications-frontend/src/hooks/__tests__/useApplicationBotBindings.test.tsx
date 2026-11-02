import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApplicationBotBinding } from '../../api/applicationBotBindings'
import { applicationsQueryKeys } from '../../api/queryKeys'
import {
    useCreateApplicationBotBinding,
    useReleaseApplicationBotBinding,
    useUpdateApplicationBotBinding
} from '../useApplicationBotBindings'

const apiMocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), release: vi.fn() }))

vi.mock('../../api/applicationBotBindings', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/applicationBotBindings')>()
    return {
        ...actual,
        createApplicationBotBinding: apiMocks.create,
        updateApplicationBotBinding: apiMocks.update,
        releaseApplicationBotBinding: apiMocks.release
    }
})

const binding: ApplicationBotBinding = {
    id: '018f0000-0000-7000-8000-000000000001',
    applicationId: 'application-1',
    platform: 'telegram',
    botUsername: 'supportbot',
    displayName: null,
    shortId: 'aBcdefGhijkLmNopQrStUv',
    status: 'draft',
    version: 1,
    createdAt: '2026-10-31T10:00:00.000Z',
    updatedAt: '2026-10-31T10:00:00.000Z'
}

afterEach(() => {
    vi.clearAllMocks()
})

describe('useCreateApplicationBotBinding', () => {
    it('awaits the binding-list invalidation before the mutation settles', async () => {
        apiMocks.create.mockResolvedValue(binding)
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
        let resolveInvalidation!: () => void
        const invalidation = new Promise<void>((resolve) => {
            resolveInvalidation = resolve
        })
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidation as never)
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
        const { result } = renderHook(() => useCreateApplicationBotBinding('application-1'), { wrapper })
        let settled = false
        let operation!: Promise<ApplicationBotBinding>

        act(() => {
            operation = result.current.mutateAsync({ platform: 'telegram', botUsername: 'supportbot' }).then((value) => {
                settled = true
                return value
            })
        })
        await waitFor(() =>
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.botBindings('application-1') })
        )

        expect(settled).toBe(false)
        expect(queryClient.getQueryData(applicationsQueryKeys.botBindingDetail('application-1', binding.id))).toEqual(binding)

        resolveInvalidation()
        await act(async () => expect(await operation).toEqual(binding))
        expect(settled).toBe(true)
    })
})

describe('useUpdateApplicationBotBinding', () => {
    it('awaits list and detail invalidation before the mutation settles', async () => {
        const updatedBinding = { ...binding, status: 'active' as const, version: 2 }
        apiMocks.update.mockResolvedValue(updatedBinding)
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
        let resolveInvalidation!: () => void
        const invalidation = new Promise<void>((resolve) => {
            resolveInvalidation = resolve
        })
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidation as never)
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
        const { result } = renderHook(() => useUpdateApplicationBotBinding('application-1'), { wrapper })
        let settled = false
        let operation!: Promise<ApplicationBotBinding>

        act(() => {
            operation = result.current
                .mutateAsync({
                    bindingId: binding.id,
                    data: { expectedVersion: 1, status: 'active' }
                })
                .then((value) => {
                    settled = true
                    return value
                })
        })

        await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2))
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.botBindingsList('application-1') })
        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: applicationsQueryKeys.botBindingDetail('application-1', updatedBinding.id)
        })
        expect(settled).toBe(false)
        expect(queryClient.getQueryData(applicationsQueryKeys.botBindingDetail('application-1', updatedBinding.id))).toEqual(updatedBinding)

        resolveInvalidation()
        await act(async () => expect(await operation).toEqual(updatedBinding))
        expect(settled).toBe(true)
    })
})

describe('useReleaseApplicationBotBinding', () => {
    it('awaits list and detail invalidation before the mutation settles', async () => {
        apiMocks.release.mockResolvedValue(undefined)
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
        let resolveInvalidation!: () => void
        const invalidation = new Promise<void>((resolve) => {
            resolveInvalidation = resolve
        })
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidation as never)
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
        const { result } = renderHook(() => useReleaseApplicationBotBinding('application-1'), { wrapper })
        let settled = false
        let operation!: Promise<void>

        act(() => {
            operation = result.current.mutateAsync({ bindingId: binding.id, expectedVersion: 4 }).then(() => {
                settled = true
            })
        })

        await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2))
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.botBindingsList('application-1') })
        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: applicationsQueryKeys.botBindingDetail('application-1', binding.id)
        })
        expect(settled).toBe(false)

        resolveInvalidation()
        await act(async () => expect(await operation).toBeUndefined())
        expect(settled).toBe(true)
    })
})
