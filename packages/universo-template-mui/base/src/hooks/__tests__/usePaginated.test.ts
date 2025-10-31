import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { usePaginated } from '../usePaginated'
import type { PaginatedResponse } from '../../types/pagination'

// Mock API responses
const createMockResponse = (page: number, pageSize: number, total: number): PaginatedResponse<any> => ({
    items: Array.from({ length: Math.min(pageSize, total - (page - 1) * pageSize) }, (_, i) => ({
        id: `item-${(page - 1) * pageSize + i + 1}`,
        name: `Item ${(page - 1) * pageSize + i + 1}`
    })),
    pagination: {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        count: Math.min(pageSize, total - (page - 1) * pageSize),
        total,
        hasMore: page * pageSize < total
    }
})

describe('usePaginated', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
    })

    afterEach(() => {
        queryClient.clear()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children)

    describe('Initial State', () => {
        it('should initialize with default values', async () => {
            const mockQueryFn = jest.fn().mockResolvedValue(createMockResponse(1, 20, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.pagination.currentPage).toBe(1)
            expect(result.current.pagination.pageSize).toBe(20)
            expect(result.current.pagination.totalItems).toBe(100)
            expect(result.current.data).toHaveLength(20)
        })

        it('should use custom initial values', async () => {
            const mockQueryFn = jest.fn().mockResolvedValue(createMockResponse(2, 10, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn,
                        initialLimit: 10,
                        initialPage: 2,
                        sortBy: 'name',
                        sortOrder: 'asc'
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.pagination.currentPage).toBe(2)
            expect(result.current.pagination.pageSize).toBe(10)
        })
    })

    describe('Pagination Actions', () => {
        it('should navigate to next page', async () => {
            const mockQueryFn = jest
                .fn()
                .mockResolvedValueOnce(createMockResponse(1, 20, 100))
                .mockResolvedValueOnce(createMockResponse(2, 20, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.pagination.currentPage).toBe(1)

            result.current.actions.nextPage()

            await waitFor(() => {
                expect(result.current.pagination.currentPage).toBe(2)
            })
        })

        it('should navigate to previous page', async () => {
            const mockQueryFn = jest
                .fn()
                .mockResolvedValueOnce(createMockResponse(2, 20, 100))
                .mockResolvedValueOnce(createMockResponse(1, 20, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn,
                        initialPage: 2
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.pagination.currentPage).toBe(2)

            result.current.actions.previousPage()

            await waitFor(() => {
                expect(result.current.pagination.currentPage).toBe(1)
            })
        })

        it('should not go beyond last page', async () => {
            const mockQueryFn = jest.fn().mockResolvedValue(createMockResponse(5, 20, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn,
                        initialPage: 5
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            const currentPage = result.current.pagination.currentPage
            result.current.actions.nextPage()

            await waitFor(() => {
                expect(result.current.pagination.currentPage).toBe(currentPage)
            })
        })

        it('should not go below page 1', async () => {
            const mockQueryFn = jest.fn().mockResolvedValue(createMockResponse(1, 20, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            result.current.actions.previousPage()

            await waitFor(() => {
                expect(result.current.pagination.currentPage).toBe(1)
            })
        })

        it('should go to specific page', async () => {
            const mockQueryFn = jest
                .fn()
                .mockResolvedValueOnce(createMockResponse(1, 20, 100))
                .mockResolvedValueOnce(createMockResponse(3, 20, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            result.current.actions.goToPage(3)

            await waitFor(() => {
                expect(result.current.pagination.currentPage).toBe(3)
            })
        })
    })

    describe('Search Functionality', () => {
        it('should reset to page 1 when search changes', async () => {
            const mockQueryFn = jest
                .fn()
                .mockResolvedValueOnce(createMockResponse(2, 20, 100))
                .mockResolvedValueOnce(createMockResponse(1, 20, 50))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn,
                        initialPage: 2
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.pagination.currentPage).toBe(2)

            result.current.actions.setSearch('test query')

            await waitFor(() => {
                expect(result.current.pagination.currentPage).toBe(1)
                expect(result.current.pagination.search).toBe('test query')
            })
        })
    })

    describe('Sort Functionality', () => {
        it('should reset to page 1 when sort changes', async () => {
            const mockQueryFn = jest
                .fn()
                .mockResolvedValueOnce(createMockResponse(2, 20, 100))
                .mockResolvedValueOnce(createMockResponse(1, 20, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn,
                        initialPage: 2
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.pagination.currentPage).toBe(2)

            result.current.actions.setSort('name', 'asc')

            await waitFor(() => {
                expect(result.current.pagination.currentPage).toBe(1)
            })
        })
    })

    describe('Page Size Changes', () => {
        it('should reset to page 1 when page size changes', async () => {
            const mockQueryFn = jest
                .fn()
                .mockResolvedValueOnce(createMockResponse(2, 20, 100))
                .mockResolvedValueOnce(createMockResponse(1, 50, 100))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn,
                        initialPage: 2
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.pagination.currentPage).toBe(2)
            expect(result.current.pagination.pageSize).toBe(20)

            result.current.actions.setPageSize(50)

            await waitFor(() => {
                expect(result.current.pagination.currentPage).toBe(1)
                expect(result.current.pagination.pageSize).toBe(50)
            })
        })
    })

    describe('Error Handling', () => {
        it('should handle API errors and eventually show error state', async () => {
            const mockQueryFn = jest.fn().mockRejectedValue(new Error('API Error'))

            const { result } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn
                    }),
                { wrapper }
            )

            // Wait for retries to complete (default is 2 retries + initial call = 3 total)
            await waitFor(
                () => {
                    expect(mockQueryFn).toHaveBeenCalledTimes(3) // Initial + 2 retries
                },
                { timeout: 5000 }
            )

            // After retries, error state should be set
            await waitFor(
                () => {
                    expect(result.current.isError).toBe(true)
                },
                { timeout: 1000 }
            )

            expect(result.current.error).toBeTruthy()
        })
    })

    describe('Actions Stability', () => {
        it('should memoize actions object', async () => {
            const mockQueryFn = jest.fn().mockResolvedValue(createMockResponse(1, 20, 100))

            const { result, rerender } = renderHook(
                () =>
                    usePaginated({
                        queryKeyFn: (params) => ['test', params],
                        queryFn: mockQueryFn
                    }),
                { wrapper }
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            const firstActions = result.current.actions

            rerender()

            await waitFor(() => {
                expect(result.current.actions).toBe(firstActions)
            })
        })
    })
})
