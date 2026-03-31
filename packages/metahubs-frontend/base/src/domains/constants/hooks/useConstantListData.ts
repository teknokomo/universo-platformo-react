import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDebouncedSearch, usePaginated } from '@universo/template-mui'
import { useSettingValue } from '../../settings/hooks/useSettings'
import { metahubsQueryKeys } from '../../shared'
import { getSetById } from '../../sets'
import * as constantsApi from '../api'
import { useMetahubHubs } from '../../hubs/hooks'
import { toConstantDisplay } from '../../../types'
import type { Constant } from '../../../types'

export function useConstantListData() {
    const { metahubId, hubId: hubIdParam, setId } = useParams<{ metahubId: string; hubId?: string; setId: string }>()
    const { i18n } = useTranslation()
    const constantCodenameScope = useSettingValue<string>('sets.constantCodenameScope') ?? 'per-level'

    const {
        data: setForHubResolution,
        isLoading: isSetResolutionLoading,
        error: setResolutionError
    } = useQuery({
        queryKey: metahubId && setId ? metahubsQueryKeys.setDetail(metahubId, setId) : ['metahubs', 'sets', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !setId) throw new Error('metahubId and setId are required')
            return getSetById(metahubId, setId)
        },
        enabled: !!metahubId && !!setId && !hubIdParam
    })

    const effectiveHubId = hubIdParam || setForHubResolution?.hubs?.[0]?.id

    // Hubs (shared hook — staleTime: 5min, deduplication via same queryKey)
    const allHubs = useMetahubHubs(metahubId)

    const canLoadConstants = !!metahubId && !!setId && (!hubIdParam || !isSetResolutionLoading)

    const paginationResult = usePaginated<Constant, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && setId
                ? (params) =>
                      effectiveHubId
                          ? metahubsQueryKeys.constantsList(metahubId, effectiveHubId, setId, { ...params, locale: i18n.language })
                          : metahubsQueryKeys.constantsListDirect(metahubId, setId, { ...params, locale: i18n.language })
                : () => ['empty'],
        queryFn:
            metahubId && setId
                ? (params) =>
                      effectiveHubId
                          ? constantsApi.listConstants(metahubId, effectiveHubId, setId, { ...params, locale: i18n.language })
                          : constantsApi.listConstantsDirect(metahubId, setId, { ...params, locale: i18n.language })
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadConstants
    })

    const { data: constants, isLoading, error } = paginationResult
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const isGlobalScope = constantCodenameScope === 'global'
    const { data: globalCodenamesData } = useQuery({
        queryKey: metahubsQueryKeys.allConstantCodenames(metahubId ?? '', setId ?? ''),
        queryFn: () => constantsApi.listAllConstantCodenames(metahubId ?? '', setId ?? ''),
        enabled: isGlobalScope && !!metahubId && !!setId
    })

    const codenameEntities = useMemo(() => {
        if (isGlobalScope && globalCodenamesData?.items) return globalCodenamesData.items
        return constants ?? []
    }, [constants, globalCodenamesData?.items, isGlobalScope])

    const constantsMap = useMemo(() => new Map((constants ?? []).map((constant) => [constant.id, constant])), [constants])

    const sortedConstants = useMemo(
        () => [...(constants ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id)),
        [constants]
    )
    const orderMap = useMemo(() => new Map(sortedConstants.map((constant, index) => [constant.id, index])), [sortedConstants])
    const tableData = useMemo(
        () => sortedConstants.map((constant) => toConstantDisplay(constant, i18n.language)),
        [sortedConstants, i18n.language]
    )

    return {
        metahubId,
        hubIdParam,
        setId,
        effectiveHubId,
        setForHubResolution,
        setResolutionError,
        allHubs,
        constants,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        constantsMap,
        sortedConstants,
        orderMap,
        tableData
    }
}
