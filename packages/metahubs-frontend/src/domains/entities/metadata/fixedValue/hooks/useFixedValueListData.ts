import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDebouncedSearch, usePaginated } from '@universo/template-mui'
import { useSettingValue } from '../../../../settings/hooks/useSettings'
import { metahubsQueryKeys, sortSharedEntityList } from '../../../../shared'
import { resolveEntityChildKindKey } from '../../../../shared/entityMetadataRoutePaths'
import { getValueGroupById } from '../../../presets/api/valueGroups'
import * as fixedValuesApi from '../api'
import { useTreeEntities } from '../../../presets/hooks/useTreeEntities'
import { toFixedValueDisplay } from '../../../../../types'
import type { FixedValue } from '../../../../../types'

type UseFixedValueListDataOptions = {
    metahubId?: string
    treeEntityId?: string | null
    valueGroupId?: string
    resolveSetDetails?: boolean
    includeSharedEntities?: boolean
}

export function useFixedValueListData(options: UseFixedValueListDataOptions = {}) {
    const {
        metahubId: routeMetahubId,
        treeEntityId: routeTreeEntityIdParam,
        valueGroupId: routeValueGroupId,
        kindKey: routeKindKey
    } = useParams<{ metahubId: string; treeEntityId?: string; valueGroupId: string; kindKey?: string }>()
    const { i18n } = useTranslation()
    const constantCodenameScope = useSettingValue<string>('entity.set.constantCodenameScope') ?? 'per-level'
    const metahubId = options.metahubId ?? routeMetahubId
    const hubIdParam = options.treeEntityId ?? routeTreeEntityIdParam
    const valueGroupId = options.valueGroupId ?? routeValueGroupId
    const kindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'set' })
    const resolveSetDetails = options.resolveSetDetails ?? true
    const includeSharedEntities = options.includeSharedEntities ?? true

    const {
        data: setForHubResolution,
        isLoading: isSetResolutionLoading,
        error: setResolutionError
    } = useQuery({
        queryKey:
            metahubId && valueGroupId
                ? metahubsQueryKeys.valueGroupDetail(metahubId, valueGroupId, kindKey)
                : ['metahubs', 'valueGroups', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !valueGroupId) throw new Error('metahubId and valueGroupId are required')
            return getValueGroupById(metahubId, valueGroupId, kindKey)
        },
        enabled: resolveSetDetails && !!metahubId && !!valueGroupId && !hubIdParam
    })

    const effectiveTreeEntityId = hubIdParam || setForHubResolution?.treeEntities?.[0]?.id

    // Hubs (shared hook — staleTime: 5min, deduplication via same queryKey)
    const allHubs = useTreeEntities(metahubId)

    const canLoadConstants = !!metahubId && !!valueGroupId && (!hubIdParam || !isSetResolutionLoading)

    const paginationResult = usePaginated<FixedValue, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && valueGroupId
                ? (params) =>
                      effectiveTreeEntityId
                          ? metahubsQueryKeys.fixedValuesList(metahubId, effectiveTreeEntityId, valueGroupId, {
                                ...params,
                                locale: i18n.language,
                                includeShared: includeSharedEntities,
                                kindKey
                            })
                          : metahubsQueryKeys.fixedValuesListDirect(metahubId, valueGroupId, {
                                ...params,
                                locale: i18n.language,
                                includeShared: includeSharedEntities,
                                kindKey
                            })
                : () => ['empty'],
        queryFn:
            metahubId && valueGroupId
                ? (params) =>
                      effectiveTreeEntityId
                          ? fixedValuesApi.listFixedValues(metahubId, effectiveTreeEntityId, valueGroupId, {
                                ...params,
                                locale: i18n.language,
                                includeShared: includeSharedEntities,
                                kindKey
                            })
                          : fixedValuesApi.listFixedValuesDirect(metahubId, valueGroupId, {
                                ...params,
                                locale: i18n.language,
                                includeShared: includeSharedEntities,
                                kindKey
                            })
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadConstants
    })

    const { data: fixedValues, isLoading, error } = paginationResult
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const isGlobalScope = constantCodenameScope === 'global'
    const { data: globalCodenamesData } = useQuery({
        queryKey: metahubsQueryKeys.allFixedValueCodenames(metahubId ?? '', valueGroupId ?? '', kindKey),
        queryFn: () => fixedValuesApi.listAllFixedValueCodenames(metahubId ?? '', valueGroupId ?? '', kindKey),
        enabled: isGlobalScope && !!metahubId && !!valueGroupId
    })

    const codenameEntities = useMemo(() => {
        if (isGlobalScope && globalCodenamesData?.items) return globalCodenamesData.items
        return fixedValues ?? []
    }, [fixedValues, globalCodenamesData?.items, isGlobalScope])

    const constantsMap = useMemo(() => new Map((fixedValues ?? []).map((constant) => [constant.id, constant])), [fixedValues])

    const sortedConstants = useMemo(() => sortSharedEntityList(fixedValues ?? []), [fixedValues])
    const orderMap = useMemo(() => new Map(sortedConstants.map((constant, index) => [constant.id, index])), [sortedConstants])
    const tableData = useMemo(
        () => sortedConstants.map((constant) => toFixedValueDisplay(constant, i18n.language)),
        [sortedConstants, i18n.language]
    )

    return {
        metahubId,
        hubIdParam,
        valueGroupId,
        kindKey,
        effectiveTreeEntityId,
        setForHubResolution,
        setResolutionError,
        allHubs,
        fixedValues,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        constantsMap,
        sortedConstants,
        orderMap,
        tableData,
        includeShared: includeSharedEntities
    }
}
