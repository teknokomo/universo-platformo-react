import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { isPendingEntity } from '@universo/utils'
import { usePaginated, useDebouncedSearch, useUserSettings } from '@universo/template-mui'
import type { Metahub, MetahubDisplay } from '../../../types'
import { toMetahubDisplay } from '../../../types'
import * as metahubsApi from '../api'
import { metahubsQueryKeys } from '../../shared'

type ListMetahubsParams = Parameters<typeof metahubsApi.listMetahubs>[0]

export function useMetahubListData() {
    const { i18n } = useTranslation()

    // Get user settings for showAll preference
    const { settings } = useUserSettings()
    const showAll = settings.admin?.showAllItems ?? false

    // Create query function that includes showAll parameter
    const queryFnWithShowAll = useCallback((params: ListMetahubsParams) => metahubsApi.listMetahubs({ ...params, showAll }), [showAll])

    // Use paginated hook for metahubs list
    const paginationResult = usePaginated<Metahub, 'name' | 'codename' | 'created' | 'updated'>({
        queryKeyFn: (params) => [...metahubsQueryKeys.list(params), { showAll }],
        queryFn: queryFnWithShowAll,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: metahubs, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Convert metahubs to display format
    const metahubsDisplay = useMemo(() => {
        if (!Array.isArray(metahubs)) return []
        const currentLocale = i18n.language
        return metahubs.map((metahub) => toMetahubDisplay(metahub, currentLocale))
    }, [metahubs, i18n.language])

    const metahubMap = useMemo(() => {
        if (!Array.isArray(metahubs)) return new Map<string, Metahub>()
        return new Map(metahubs.map((metahub) => [metahub.id, metahub]))
    }, [metahubs])

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(metahubsDisplay)) {
            metahubsDisplay.forEach((metahub) => {
                if (metahub?.id) {
                    imagesMap[metahub.id] = []
                }
            })
        }
        return imagesMap
    }, [metahubsDisplay])

    // Helper to find a resolved metahub by codename (for pending navigation)
    const findResolvedMetahub = useCallback(
        (codename: string): MetahubDisplay | undefined => metahubsDisplay.find((m) => !isPendingEntity(m) && m.codename === codename),
        [metahubsDisplay]
    )

    const hasPendingMetahub = useCallback(
        (pendingId: string): boolean => metahubsDisplay.some((m) => m.id === pendingId),
        [metahubsDisplay]
    )

    return {
        metahubs,
        metahubsDisplay,
        metahubMap,
        images,
        isLoading,
        error,
        paginationResult,
        handleSearchChange,
        findResolvedMetahub,
        hasPendingMetahub
    }
}
