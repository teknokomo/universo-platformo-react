import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    addInterpretationNetworkFavorite,
    fetchInterpretationNetworkFavorites,
    removeInterpretationNetworkFavorite,
    type InterpretationNetworkFavoriteListItem,
    type InterpretationNetworkFavoriteTarget
} from './runtimeInterpretationNetworkFavoritesApi'

export type InterpretationNetworkFavoritesFeedback = 'added' | 'alreadyPresent' | 'removed' | 'alreadyAbsent' | 'error'

export type UseInterpretationNetworkFavoritesOptions = {
    apiBaseUrl?: string | null
    applicationId?: string | null
    workspaceId?: string | null
    locale: string
    queryKeyPrefix?: readonly unknown[]
    enabled: boolean
}

const FAVORITES_PAGE_SIZE = 200

export const interpretationNetworkFavoritesQueryKeys = {
    root: ['interpretation-network-favorites'] as const,
    scope: (options: UseInterpretationNetworkFavoritesOptions) =>
        [
            ...(options.queryKeyPrefix ?? []),
            'interpretation-network-favorites',
            'authenticated',
            options.apiBaseUrl?.replace(/\/$/, '') ?? null,
            options.applicationId ?? null,
            options.workspaceId ?? null
        ] as const,
    list: (options: UseInterpretationNetworkFavoritesOptions) =>
        [...interpretationNetworkFavoritesQueryKeys.scope(options), 'list', options.locale] as const,
    matchesScope: (
        queryKey: readonly unknown[],
        scope: Pick<UseInterpretationNetworkFavoritesOptions, 'apiBaseUrl' | 'applicationId' | 'workspaceId'>
    ) => {
        const markerIndex = queryKey.lastIndexOf('interpretation-network-favorites')
        if (markerIndex < 0) return false
        return (
            queryKey[markerIndex + 1] === 'authenticated' &&
            queryKey[markerIndex + 2] === (scope.apiBaseUrl?.replace(/\/$/, '') ?? null) &&
            queryKey[markerIndex + 3] === (scope.applicationId ?? null) &&
            queryKey[markerIndex + 4] === (scope.workspaceId ?? null)
        )
    }
}

const targetKey = (target: InterpretationNetworkFavoriteTarget): string =>
    `${target.interpretationId.toLowerCase()}:${target.cellId.toLowerCase()}`

export function useInterpretationNetworkFavorites(options: UseInterpretationNetworkFavoritesOptions) {
    const queryClient = useQueryClient()
    const scopeKey = interpretationNetworkFavoritesQueryKeys.scope(options)
    const queryKey = interpretationNetworkFavoritesQueryKeys.list(options)
    const apiBaseUrl = options.apiBaseUrl
    const applicationId = options.applicationId
    const workspaceId = options.workspaceId
    const enabled = options.enabled && Boolean(apiBaseUrl && applicationId)
    const [feedback, setFeedback] = useState<InterpretationNetworkFavoritesFeedback | null>(null)

    const favoritesQuery = useInfiniteQuery({
        queryKey,
        enabled,
        initialPageParam: 0,
        queryFn: ({ pageParam }) => {
            if (!apiBaseUrl || !applicationId) throw new Error('Favorites runtime context is unavailable.')
            return fetchInterpretationNetworkFavorites({
                apiBaseUrl,
                applicationId,
                workspaceId,
                locale: options.locale,
                limit: FAVORITES_PAGE_SIZE,
                offset: pageParam
            })
        },
        getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.reduce((count, page) => count + page.items.length, 0) : undefined),
        staleTime: 30_000
    })

    const addMutation = useMutation({
        mutationKey: [...scopeKey, 'add'],
        mutationFn: (target: InterpretationNetworkFavoriteTarget) => {
            if (!apiBaseUrl || !applicationId) throw new Error('Favorites runtime context is unavailable.')
            return addInterpretationNetworkFavorite({ apiBaseUrl, applicationId, workspaceId }, target)
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKey })
    })

    const removeMutation = useMutation({
        mutationKey: [...scopeKey, 'remove'],
        mutationFn: (favoriteId: string) => {
            if (!apiBaseUrl || !applicationId) throw new Error('Favorites runtime context is unavailable.')
            return removeInterpretationNetworkFavorite({ apiBaseUrl, applicationId, workspaceId }, favoriteId)
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKey })
    })

    const items = useMemo<InterpretationNetworkFavoriteListItem[]>(
        () => favoritesQuery.data?.pages.flatMap((page) => page.items) ?? [],
        [favoritesQuery.data?.pages]
    )
    const favoriteByTarget = useMemo(() => {
        const result = new Map<string, string>()
        for (const item of items) {
            if (item.availability === 'available') result.set(targetKey(item.target), item.favoriteId)
        }
        return result
    }, [items])

    const isFavorite = useCallback(
        (target: InterpretationNetworkFavoriteTarget | null | undefined) => Boolean(target && favoriteByTarget.has(targetKey(target))),
        [favoriteByTarget]
    )

    const toggleFavorite = useCallback(
        async (target: InterpretationNetworkFavoriteTarget) => {
            if (!enabled) return
            const favoriteId = favoriteByTarget.get(targetKey(target))
            try {
                if (favoriteId) {
                    const result = await removeMutation.mutateAsync(favoriteId)
                    setFeedback(result.removed ? 'removed' : 'alreadyAbsent')
                } else {
                    const result = await addMutation.mutateAsync(target)
                    setFeedback(result.created ? 'added' : 'alreadyPresent')
                }
            } catch {
                setFeedback('error')
            }
        },
        [addMutation, enabled, favoriteByTarget, removeMutation]
    )

    const removeFavorite = useCallback(
        async (favoriteId: string) => {
            if (!enabled) return
            try {
                const result = await removeMutation.mutateAsync(favoriteId)
                setFeedback(result.removed ? 'removed' : 'alreadyAbsent')
            } catch {
                setFeedback('error')
            }
        },
        [enabled, removeMutation]
    )

    const { fetchNextPage, hasNextPage, isFetchingNextPage } = favoritesQuery
    const loadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
    }, [fetchNextPage, hasNextPage, isFetchingNextPage])

    const clearFeedback = useCallback(() => setFeedback(null), [])
    const isMutationPending = addMutation.isPending || removeMutation.isPending

    return useMemo(
        () => ({
            items,
            enabled,
            isLoading: favoritesQuery.isPending || favoritesQuery.isFetching,
            isError: favoritesQuery.isError,
            hasNextPage: favoritesQuery.hasNextPage === true,
            isFetchingNextPage: favoritesQuery.isFetchingNextPage,
            loadMore,
            isMutationPending,
            feedback,
            clearFeedback,
            isFavorite,
            toggleFavorite,
            removeFavorite
        }),
        [
            clearFeedback,
            enabled,
            favoritesQuery.hasNextPage,
            favoritesQuery.isError,
            favoritesQuery.isFetching,
            favoritesQuery.isFetchingNextPage,
            favoritesQuery.isPending,
            feedback,
            isFavorite,
            isMutationPending,
            items,
            loadMore,
            removeFavorite,
            toggleFavorite
        ]
    )
}
