import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { useMetahubDetails } from '../useMetahubDetails'

const mocks = vi.hoisted(() => ({ getMetahub: vi.fn() }))

vi.mock('../../api', () => ({ getMetahub: mocks.getMetahub }))

describe('useMetahubDetails cancellation', () => {
    it('aborts its in-flight permissions request when the page observer unmounts', async () => {
        let requestSignal: AbortSignal | undefined
        mocks.getMetahub.mockImplementation((_metahubId: string, signal?: AbortSignal) => {
            if (!signal) throw new Error('Metahub details request did not receive the query AbortSignal')
            requestSignal = signal
            return new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(new DOMException('The request was aborted', 'AbortError')), {
                    once: true
                })
            })
        })

        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        const { unmount } = renderHook(() => useMetahubDetails('metahub-1'), { wrapper })

        try {
            await waitFor(() => expect(requestSignal).toBeInstanceOf(AbortSignal))
            expect(requestSignal?.aborted).toBe(false)

            unmount()

            await waitFor(() => expect(requestSignal?.aborted).toBe(true))
        } finally {
            unmount()
            queryClient.clear()
        }
    })
})
