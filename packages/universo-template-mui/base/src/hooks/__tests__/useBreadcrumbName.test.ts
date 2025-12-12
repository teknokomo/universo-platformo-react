import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import {
    createEntityNameHook,
    createTruncateFunction,
    useMetaverseName,
    useClusterName,
    truncateMetaverseName
} from '../useBreadcrumbName'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('useBreadcrumbName', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        })
        mockFetch.mockClear()
    })

    afterEach(() => {
        queryClient.clear()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children)

    describe('createEntityNameHook', () => {
        it('should create a hook that returns null for null entityId', async () => {
            const useTestEntityName = createEntityNameHook({
                entityType: 'test',
                apiPath: 'tests'
            })

            const { result } = renderHook(() => useTestEntityName(null), { wrapper })

            // Should return null immediately without making API call
            expect(result.current).toBeNull()
            expect(mockFetch).not.toHaveBeenCalled()
        })

        it('should fetch entity name and return it', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ name: 'Test Entity Name' })
            })

            const useTestEntityName = createEntityNameHook({
                entityType: 'test',
                apiPath: 'tests'
            })

            const { result } = renderHook(() => useTestEntityName('test-id-123'), { wrapper })

            // Initially returns null while loading
            expect(result.current).toBeNull()

            await waitFor(() => {
                expect(result.current).toBe('Test Entity Name')
            })

            expect(mockFetch).toHaveBeenCalledWith('/api/v1/tests/test-id-123', expect.objectContaining({
                method: 'GET',
                credentials: 'include'
            }))
        })

        it('should use custom nameField when provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ title: 'Custom Field Value', name: 'Wrong Field' })
            })

            const useTestEntityName = createEntityNameHook({
                entityType: 'custom',
                apiPath: 'customs',
                nameField: 'title'
            })

            const { result } = renderHook(() => useTestEntityName('custom-123'), { wrapper })

            await waitFor(() => {
                expect(result.current).toBe('Custom Field Value')
            })
        })

        it('should use custom fetcher when provided', async () => {
            const customFetcher = jest.fn().mockResolvedValue('Custom Fetcher Result')

            const useTestEntityName = createEntityNameHook({
                entityType: 'custom',
                fetcher: customFetcher
            })

            const { result } = renderHook(() => useTestEntityName('entity-456'), { wrapper })

            await waitFor(() => {
                expect(result.current).toBe('Custom Fetcher Result')
            })

            expect(customFetcher).toHaveBeenCalledWith('entity-456')
            expect(mockFetch).not.toHaveBeenCalled()
        })

        it('should return null when fetch fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            })

            const useTestEntityName = createEntityNameHook({
                entityType: 'test',
                apiPath: 'tests'
            })

            const { result } = renderHook(() => useTestEntityName('nonexistent-id'), { wrapper })

            // Should return null on error
            await waitFor(() => {
                expect(result.current).toBeNull()
            })
        })

        it('should cache results with same queryKey', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ name: 'Cached Name' })
            })

            const useTestEntityName = createEntityNameHook({
                entityType: 'cached',
                apiPath: 'cached-entities'
            })

            // First render
            const { result: result1 } = renderHook(
                () => useTestEntityName('cache-test-id'),
                { wrapper }
            )

            await waitFor(() => {
                expect(result1.current).toBe('Cached Name')
            })

            // Second render with same ID - should use cache
            const { result: result2 } = renderHook(
                () => useTestEntityName('cache-test-id'),
                { wrapper }
            )

            await waitFor(() => {
                expect(result2.current).toBe('Cached Name')
            })

            // fetch should only be called once due to caching
            expect(mockFetch).toHaveBeenCalledTimes(1)
        })
    })

    describe('Pre-configured hooks', () => {
        it('useMetaverseName should call correct API endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ name: 'My Metaverse' })
            })

            const { result } = renderHook(() => useMetaverseName('mv-123'), { wrapper })

            await waitFor(() => {
                expect(result.current).toBe('My Metaverse')
            })

            expect(mockFetch).toHaveBeenCalledWith('/api/v1/metaverses/mv-123', expect.anything())
        })

        it('useClusterName should call correct API endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ name: 'Production Cluster' })
            })

            const { result } = renderHook(() => useClusterName('cluster-456'), { wrapper })

            await waitFor(() => {
                expect(result.current).toBe('Production Cluster')
            })

            expect(mockFetch).toHaveBeenCalledWith('/api/v1/clusters/cluster-456', expect.anything())
        })
    })

    describe('createTruncateFunction', () => {
        it('should not truncate short names', () => {
            const truncate = createTruncateFunction(30)
            expect(truncate('Short Name')).toBe('Short Name')
        })

        it('should truncate long names with ellipsis', () => {
            const truncate = createTruncateFunction(20)
            const longName = 'This is a very long name that exceeds the limit'
            const result = truncate(longName)

            expect(result.length).toBe(20)
            expect(result).toBe('This is a very long…')
        })

        it('should respect custom default maxLength', () => {
            const truncate = createTruncateFunction(10)
            const result = truncate('Hello World!')

            expect(result).toBe('Hello Wor…')
        })

        it('should allow per-call maxLength override', () => {
            const truncate = createTruncateFunction(30)
            const result = truncate('Hello World!', 5)

            expect(result).toBe('Hell…')
        })

        it('should handle exact boundary length', () => {
            const truncate = createTruncateFunction(10)
            expect(truncate('Exactly 10')).toBe('Exactly 10')  // Exactly 10 chars - no truncation
            expect(truncate('Exactly 11x')).toBe('Exactly 1…') // 11 chars → 9 chars + ellipsis = 10
        })
    })

    describe('Pre-configured truncate functions', () => {
        it('truncateMetaverseName should truncate at 30 chars by default', () => {
            const longName = 'This is a very long metaverse name that should be truncated'
            const result = truncateMetaverseName(longName)

            expect(result.length).toBe(30)
            expect(result.endsWith('…')).toBe(true)
        })

        it('truncateMetaverseName should accept custom maxLength', () => {
            const result = truncateMetaverseName('Metaverse Name', 10)
            expect(result).toBe('Metaverse…')
        })
    })
})
