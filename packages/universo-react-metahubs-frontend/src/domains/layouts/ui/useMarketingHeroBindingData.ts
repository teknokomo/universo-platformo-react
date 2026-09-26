import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCommonTranslations } from '@universo-react/i18n'
import { getCodenamePrimary } from '@universo-react/utils'
import { getMarketingActionSectionTargets } from '@universo-react/types'

import * as componentsApi from '../../entities/metadata/component/api'
import * as recordsApi from '../../entities/metadata/record/api'
import { useEntityInstancesQuery } from '../../entities/hooks'
import { createDefaultMarketingAction } from '../../entities/metadata/record/ui/fields/marketingAction'
import { invalidateRecordsQueries, metahubsQueryKeys } from '../../shared'
import type { RecordItem } from '../../../types'
import type { normalizeLocale } from '../../../types'
import * as layoutsApi from '../api'
import type { LayoutZoneWidgetBinding, WidgetBindingSource } from '../api/layouts'
import { buildHeroRecordFields, getHeroComponentKey, getHeroRecordLabel, MARKETING_PAGE_HUB_CODENAME } from './marketingHeroAuthoring'

export type HeroRecordOption = { id: string; label: string; semanticKey?: string }
type NormalizedLocale = ReturnType<typeof normalizeLocale>
const HERO_RECORD_PAGE_SIZE = 50

type UseMarketingHeroBindingDataOptions = {
    open: boolean
    metahubId: string
    layoutId: string
    widgetId: string | null
    canManageLayouts: boolean
    canEditContent: boolean
    heroObjectId: string | null
    locale: NormalizedLocale
    selectedRecordId: string | null
    recordSearch: string
    lastSavedRecord: RecordItem | null
}

/** Loads Hero entities and records, then derives the dialog's selectable record data. */
export function useMarketingHeroBindingData({
    open,
    metahubId,
    layoutId,
    widgetId,
    canManageLayouts,
    canEditContent,
    heroObjectId,
    locale,
    selectedRecordId,
    recordSearch,
    lastSavedRecord
}: UseMarketingHeroBindingDataOptions) {
    const { t } = useCommonTranslations()
    const queryClient = useQueryClient()
    const deferredRecordSearch = useDeferredValue(recordSearch.trim())
    const [recordPage, setRecordPage] = useState(0)

    useEffect(() => {
        if (!open) setRecordPage(0)
    }, [open])

    const hubsQuery = useEntityInstancesQuery(
        metahubId,
        open
            ? {
                  kind: 'hub',
                  locale,
                  limit: 1000,
                  offset: 0,
                  sortBy: 'codename',
                  sortOrder: 'asc'
              }
            : undefined
    )
    const treeEntityId = useMemo(
        () =>
            (hubsQuery.data?.items ?? []).find((entity) => getCodenamePrimary(entity.codename) === MARKETING_PAGE_HUB_CODENAME)?.id ?? null,
        [hubsQuery.data?.items]
    )

    const componentParams = useMemo(
        () => ({
            limit: 100,
            offset: 0,
            sortBy: 'sortOrder',
            sortOrder: 'asc' as const,
            locale,
            scope: 'all' as const,
            includeShared: true
        }),
        [locale]
    )
    const componentsQueryKey =
        treeEntityId && heroObjectId
            ? metahubsQueryKeys.componentsList(metahubId, treeEntityId, heroObjectId, componentParams)
            : ['metahubs', 'marketingHero', 'components', 'empty']
    const componentsQuery = useQuery({
        queryKey: componentsQueryKey,
        queryFn: () => componentsApi.listComponents(metahubId, treeEntityId!, heroObjectId!, componentParams),
        enabled: Boolean(open && treeEntityId && heroObjectId),
        staleTime: 30_000
    })
    const components = useMemo(() => componentsQuery.data?.items ?? [], [componentsQuery.data?.items])
    const formFields = useMemo(
        () => buildHeroRecordFields(components, locale, t('layouts.marketing.heroAuthoring.contentField', 'Content field')),
        [components, locale, t]
    )
    const actionFieldIds = useMemo(
        () => new Set(components.filter((component) => component.validationRules?.format === 'marketingAction').map(getHeroComponentKey)),
        [components]
    )
    const primaryActionField = useMemo(
        () => components.find((component) => component.validationRules?.format === 'marketingAction' && component.isRequired),
        [components]
    )
    const defaultCreateData = useMemo(
        () => (primaryActionField ? { [getHeroComponentKey(primaryActionField)]: createDefaultMarketingAction('internal') } : {}),
        [primaryActionField]
    )

    const recordParams = useMemo(
        () => ({
            limit: HERO_RECORD_PAGE_SIZE,
            offset: recordPage * HERO_RECORD_PAGE_SIZE,
            sortBy: 'updated',
            sortOrder: 'desc' as const,
            ...(deferredRecordSearch ? { search: deferredRecordSearch } : {})
        }),
        [deferredRecordSearch, recordPage]
    )
    const recordsQueryKey =
        treeEntityId && heroObjectId
            ? metahubsQueryKeys.recordsList(metahubId, treeEntityId, heroObjectId, recordParams)
            : ['metahubs', 'marketingHero', 'records', 'empty']
    const recordsQuery = useQuery({
        queryKey: recordsQueryKey,
        queryFn: () => recordsApi.listRecords(metahubId, treeEntityId!, heroObjectId!, recordParams),
        enabled: Boolean(open && treeEntityId && heroObjectId),
        staleTime: 15_000
    })
    const recordTotal = recordsQuery.data?.pagination.total ?? 0
    const recordPageCount = Math.max(1, Math.ceil(recordTotal / HERO_RECORD_PAGE_SIZE))

    useEffect(() => {
        if (recordPage >= recordPageCount) setRecordPage(Math.max(0, recordPageCount - 1))
    }, [recordPage, recordPageCount])

    const bindingQueryKey = widgetId
        ? metahubsQueryKeys.layoutZoneWidgetBinding(metahubId, layoutId, widgetId, locale)
        : ['metahubs', 'layouts', 'heroBinding', 'new']
    const bindingQuery = useQuery({
        queryKey: bindingQueryKey,
        queryFn: async () => (await layoutsApi.getLayoutZoneWidgetBinding(metahubId, layoutId, widgetId!, locale)).data,
        enabled: Boolean(open && widgetId),
        staleTime: 0
    })

    const sourcesQueryKey = [
        'metahubs',
        'layouts',
        layoutId,
        'widget-binding-sources',
        'marketing.hero',
        'content',
        locale,
        widgetId
    ] as const
    const sourcesQuery = useQuery({
        queryKey: sourcesQueryKey,
        queryFn: async () =>
            (await layoutsApi.getWidgetBindingSources(metahubId, layoutId, 'marketing.hero', 'content', locale, widgetId ?? undefined)).data
                .items,
        enabled: Boolean(open && layoutId && canManageLayouts),
        staleTime: 30_000
    })

    const usageQuery = useQuery({
        queryKey: ['metahubs', 'layouts', layoutId, 'widget-binding-usage', selectedRecordId, widgetId],
        queryFn: async () => (await layoutsApi.getWidgetBindingUsage(metahubId, layoutId, selectedRecordId!, widgetId ?? undefined)).data,
        enabled: Boolean(open && canEditContent && selectedRecordId),
        staleTime: 10_000
    })

    const layoutWidgetsQuery = useQuery({
        queryKey: metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId),
        queryFn: () => layoutsApi.listLayoutZoneWidgets(metahubId, layoutId),
        enabled: Boolean(open && layoutId),
        staleTime: 15_000
    })
    const actionSectionTargets = useMemo(() => getMarketingActionSectionTargets(layoutWidgetsQuery.data ?? []), [layoutWidgetsQuery.data])

    const detailQueryKey =
        treeEntityId && heroObjectId && selectedRecordId
            ? [...metahubsQueryKeys.records(metahubId, treeEntityId, heroObjectId), 'detail', selectedRecordId]
            : ['metahubs', 'marketingHero', 'recordDetail', 'empty']
    const selectedRecordQuery = useQuery({
        queryKey: detailQueryKey,
        queryFn: async () => (await recordsApi.getRecord(metahubId, treeEntityId!, heroObjectId!, selectedRecordId!)).data,
        enabled: Boolean(open && treeEntityId && heroObjectId && selectedRecordId),
        staleTime: 0
    })

    const records = useMemo(() => recordsQuery.data?.items ?? [], [recordsQuery.data?.items])
    const selectedRecord = selectedRecordQuery.data ?? records.find((record) => record.id === selectedRecordId) ?? lastSavedRecord
    const fallbackLabel = t('layouts.marketing.heroAuthoring.untitledRecord', 'Untitled Hero content')
    const recordOptions = useMemo(() => {
        const optionMap = new Map<string, HeroRecordOption>()
        for (const record of records)
            optionMap.set(record.id, {
                id: record.id,
                label: getHeroRecordLabel(record, components, locale, fallbackLabel),
                semanticKey: typeof record.data?.HeroKey === 'string' ? record.data.HeroKey : undefined
            })
        if (lastSavedRecord) {
            optionMap.set(lastSavedRecord.id, {
                id: lastSavedRecord.id,
                label: getHeroRecordLabel(lastSavedRecord, components, locale, fallbackLabel),
                semanticKey: typeof lastSavedRecord.data?.HeroKey === 'string' ? lastSavedRecord.data.HeroKey : undefined
            })
        }
        if (selectedRecordQuery.data) {
            optionMap.set(selectedRecordQuery.data.id, {
                id: selectedRecordQuery.data.id,
                label: getHeroRecordLabel(selectedRecordQuery.data, components, locale, fallbackLabel),
                semanticKey: typeof selectedRecordQuery.data.data?.HeroKey === 'string' ? selectedRecordQuery.data.data.HeroKey : undefined
            })
        }
        const binding = bindingQuery.data
        if (binding && !optionMap.has(binding.recordId))
            optionMap.set(binding.recordId, { id: binding.recordId, label: binding.label || fallbackLabel })
        return [...optionMap.values()].sort((left, right) => left.label.localeCompare(right.label, locale))
    }, [bindingQuery.data, components, fallbackLabel, lastSavedRecord, locale, records, selectedRecordQuery.data])
    const selectedOption = recordOptions.find((option) => option.id === selectedRecordId) ?? null
    const currentBindingId = bindingQuery.data?.recordId ?? null
    const selectedRecordVersion =
        selectedRecord?.version ??
        (selectedRecordId && selectedRecordId === currentBindingId ? bindingQuery.data?.recordVersion : undefined)

    const invalidateHeroRecords = async (recordId?: string) => {
        if (!treeEntityId || !heroObjectId) return
        await invalidateRecordsQueries.all(queryClient, metahubId, treeEntityId, heroObjectId)
        if (recordId) {
            await queryClient.invalidateQueries({
                queryKey: [...metahubsQueryKeys.records(metahubId, treeEntityId, heroObjectId), 'detail', recordId]
            })
        }
        if (widgetId) await queryClient.invalidateQueries({ queryKey: bindingQueryKey })
    }

    const setBindingCache = (binding: LayoutZoneWidgetBinding) => queryClient.setQueryData(bindingQueryKey, binding)
    const setSourceCache = (source: WidgetBindingSource) =>
        queryClient.setQueryData(sourcesQueryKey, (previous: typeof sourcesQuery.data) => {
            const current = previous ?? []
            return current.some((item) => item.entityId === source.entityId) ? current : [...current, source]
        })
    const retry = () => {
        void hubsQuery.refetch()
        void componentsQuery.refetch()
        void recordsQuery.refetch()
        if (widgetId) void bindingQuery.refetch()
        void layoutWidgetsQuery.refetch()
        if (selectedRecordId) void selectedRecordQuery.refetch()
    }

    const refreshBindingState = async () => {
        const [bindingResult] = await Promise.all([
            bindingQuery.refetch(),
            layoutWidgetsQuery.refetch(),
            selectedRecordId ? selectedRecordQuery.refetch() : Promise.resolve(undefined)
        ])
        if (bindingResult.isError || !bindingResult.data) throw bindingResult.error ?? new Error('HERO_BINDING_REFRESH_FAILED')
        return bindingResult.data
    }

    return {
        treeEntityId,
        components,
        formFields,
        actionFieldIds,
        defaultCreateData,
        selectedRecord,
        selectedRecordVersion,
        recordOptions,
        selectedOption,
        sources: sourcesQuery.data ?? [],
        setSourceCache,
        sourcesLoading: sourcesQuery.isLoading,
        sourceError: sourcesQuery.error,
        sharedSourceUsageCount: sourcesQuery.data?.find((source) => source.entityId === heroObjectId)?.otherWidgetUsageCount ?? 0,
        sharedUsageCount: usageQuery.data?.usageCount ?? 0,
        usageLoading: usageQuery.isLoading,
        actionSectionTargets,
        actionSectionTargetsState: layoutWidgetsQuery.isLoading ? 'loading' : layoutWidgetsQuery.isError ? 'unavailable' : 'ready',
        recordPage,
        recordPageCount,
        setRecordPage,
        currentBindingId,
        isLoading:
            hubsQuery.isLoading ||
            componentsQuery.isLoading ||
            recordsQuery.isLoading ||
            layoutWidgetsQuery.isLoading ||
            Boolean(widgetId && bindingQuery.isLoading),
        queryError: hubsQuery.error || componentsQuery.error || recordsQuery.error || bindingQuery.error || layoutWidgetsQuery.error,
        treeEntityMissing: open && !hubsQuery.isLoading && !treeEntityId,
        heroEntityMissing: open && !heroObjectId,
        selectedRecordError: selectedRecordQuery.error,
        hasSelectedRecord: Boolean(selectedRecordQuery.data),
        isSelectedRecordFetching: selectedRecordQuery.isFetching,
        isRecordsFetching: recordsQuery.isFetching,
        hasNoRecords: recordTotal === 0 && !recordsQuery.isFetching,
        bindingRecordId: bindingQuery.data?.recordId ?? null,
        bindingWidgetVersion: bindingQuery.data?.widgetVersion ?? null,
        invalidateHeroRecords,
        setBindingCache,
        retry,
        refreshBindingState,
        retrySelectedRecord: () => void selectedRecordQuery.refetch()
    }
}
