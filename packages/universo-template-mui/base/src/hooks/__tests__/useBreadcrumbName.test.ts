import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useAuth } from '@universo/auth-frontend'
import {
    createEntityNameHook,
    createTruncateFunction,
    useLinkedCollectionName,
    useLinkedCollectionNameStandalone,
    useOptionListName,
    useTreeEntityName,
    useMetahubPublicationName,
    useValueGroupNameStandalone,
    useMetaverseName,
    truncateMetaverseName
} from '../useBreadcrumbName'

jest.mock('@universo/auth-frontend', () => ({
    useAuth: jest.fn()
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockClientGet = jest.fn()
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

describe('useBreadcrumbName', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        })
        mockClientGet.mockClear()
        mockUseAuth.mockReturnValue({
            client: { get: mockClientGet },
            loading: false
        } as never)
    })

    afterEach(() => {
        queryClient.clear()
    })

    afterAll(() => {
        mockConsoleWarn.mockRestore()
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
            expect(mockClientGet).not.toHaveBeenCalled()
        })

        it('should fetch entity name and return it', async () => {
            mockClientGet.mockResolvedValueOnce({
                data: { name: 'Test Entity Name' }
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

            expect(mockClientGet).toHaveBeenCalledWith('/tests/test-id-123')
        })

        it('should use custom nameField when provided', async () => {
            mockClientGet.mockResolvedValueOnce({
                data: { title: 'Custom Field Value', name: 'Wrong Field' }
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

        it('should fall back to any available locale from VLC content', async () => {
            mockClientGet.mockResolvedValueOnce({
                data: {
                    name: {
                        _primary: 'de',
                        locales: {
                            de: { content: 'Deutscher Name' }
                        }
                    }
                }
            })

            const useTestEntityName = createEntityNameHook({
                entityType: 'test',
                apiPath: 'tests'
            })

            const { result } = renderHook(() => useTestEntityName('locale-fallback-id'), { wrapper })

            await waitFor(() => {
                expect(result.current).toBe('Deutscher Name')
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
            expect(mockClientGet).not.toHaveBeenCalled()
        })

        it('should return null when fetch fails', async () => {
            mockClientGet.mockRejectedValueOnce({ response: { status: 404 } })

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

        it('should serve cached results immediately and then refetch on remount', async () => {
            mockClientGet.mockResolvedValue({
                data: { name: 'Cached Name' }
            })

            const useTestEntityName = createEntityNameHook({
                entityType: 'cached',
                apiPath: 'cached-entities'
            })

            // First render
            const { result: result1 } = renderHook(() => useTestEntityName('cache-test-id'), { wrapper })

            await waitFor(() => {
                expect(result1.current).toBe('Cached Name')
            })

            // Second render with same ID - should use cache
            const { result: result2 } = renderHook(() => useTestEntityName('cache-test-id'), { wrapper })

            await waitFor(() => {
                expect(result2.current).toBe('Cached Name')
            })

            // The second mount gets cached data immediately, then performs the forced mount refetch.
            expect(mockClientGet).toHaveBeenCalledTimes(2)
        })

        it('should wait for auth loading before fetching', async () => {
            let authLoading = true
            mockUseAuth.mockImplementation(
                () =>
                    ({
                        client: { get: mockClientGet },
                        loading: authLoading
                    } as never)
            )
            mockClientGet.mockResolvedValueOnce({ data: { name: 'After Auth Ready' } })

            const useTestEntityName = createEntityNameHook({
                entityType: 'test',
                apiPath: 'tests'
            })

            const { result, rerender } = renderHook(() => useTestEntityName('delayed-id'), { wrapper })

            expect(result.current).toBeNull()
            expect(mockClientGet).not.toHaveBeenCalled()

            authLoading = false
            rerender()

            await waitFor(() => {
                expect(result.current).toBe('After Auth Ready')
            })

            expect(mockClientGet).toHaveBeenCalledWith('/tests/delayed-id')
        })
    })

    describe('Pre-configured hooks', () => {
        it('useMetaverseName should call correct API endpoint', async () => {
            mockClientGet.mockResolvedValueOnce({
                data: { name: 'My Metaverse' }
            })

            const { result } = renderHook(() => useMetaverseName('mv-123'), { wrapper })

            await waitFor(() => {
                expect(result.current).toBe('My Metaverse')
            })

            expect(mockClientGet).toHaveBeenCalledWith('/metaverses/mv-123')
        })

        it('uses entity-owned hub and catalog endpoints for breadcrumb names', async () => {
            mockClientGet
                .mockResolvedValueOnce({
                    data: {
                        name: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Hub Name' }
                            }
                        }
                    }
                })
                .mockResolvedValueOnce({
                    data: {
                        name: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Catalog Name' }
                            }
                        }
                    }
                })
                .mockResolvedValueOnce({
                    data: {
                        name: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Standalone Catalog Name' }
                            }
                        }
                    }
                })

            const { result: hubResult } = renderHook(() => useTreeEntityName('mh-1', 'hub-1'), { wrapper })
            const { result: catalogResult } = renderHook(() => useLinkedCollectionName('mh-1', 'hub-1', 'catalog-1'), { wrapper })
            const { result: standaloneCatalogResult } = renderHook(() => useLinkedCollectionNameStandalone('mh-1', 'catalog-1'), {
                wrapper
            })

            await waitFor(() => {
                expect(hubResult.current).toBe('Hub Name')
                expect(catalogResult.current).toBe('Catalog Name')
                expect(standaloneCatalogResult.current).toBe('Standalone Catalog Name')
            })

            expect(mockClientGet).toHaveBeenNthCalledWith(1, '/metahub/mh-1/entities/hub/instance/hub-1')
            expect(mockClientGet).toHaveBeenNthCalledWith(
                2,
                '/metahub/mh-1/entities/catalog/instance/hub-1/catalog/catalog-1'
            )
            expect(mockClientGet).toHaveBeenNthCalledWith(3, '/metahub/mh-1/entities/catalog/instance/catalog-1')
        })

        it('uses entity-owned set and enumeration endpoints for breadcrumb names', async () => {
            mockClientGet
                .mockResolvedValueOnce({
                    data: {
                        name: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Set Name' }
                            }
                        }
                    }
                })
                .mockResolvedValueOnce({
                    data: {
                        name: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Enumeration Name' }
                            }
                        }
                    }
                })

            const { result: setResult } = renderHook(() => useValueGroupNameStandalone('mh-1', 'set-1'), { wrapper })
            const { result: enumerationResult } = renderHook(() => useOptionListName('mh-1', 'enum-1'), { wrapper })

            await waitFor(() => {
                expect(setResult.current).toBe('Set Name')
                expect(enumerationResult.current).toBe('Enumeration Name')
            })

            expect(mockClientGet).toHaveBeenNthCalledWith(1, '/metahub/mh-1/entities/set/instance/set-1')
            expect(mockClientGet).toHaveBeenNthCalledWith(2, '/metahub/mh-1/entities/enumeration/instance/enum-1')
        })

        it('useMetahubPublicationName does not reuse publication detail objects as breadcrumb cache', async () => {
            queryClient.setQueryData(['metahubs', 'detail', 'mh-1', 'publications', 'detail', 'pub-1'], {
                id: 'pub-1',
                name: {
                    _primary: 'en',
                    locales: {
                        en: { content: 'Detail Object Name' }
                    }
                }
            })

            mockClientGet.mockResolvedValueOnce({
                data: {
                    name: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Breadcrumb Name' }
                        }
                    }
                }
            })

            const { result } = renderHook(() => useMetahubPublicationName('mh-1', 'pub-1'), { wrapper })

            expect(result.current).toBeNull()

            await waitFor(() => {
                expect(result.current).toBe('Breadcrumb Name')
            })

            expect(mockClientGet).toHaveBeenCalledWith('/metahub/mh-1/publication/pub-1')
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
            expect(truncate('Exactly 10')).toBe('Exactly 10') // Exactly 10 chars - no truncation
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
