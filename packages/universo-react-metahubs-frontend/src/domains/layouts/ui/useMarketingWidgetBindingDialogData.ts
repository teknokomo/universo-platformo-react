import { useMemo } from 'react'
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { getCodenamePrimary } from '@universo-react/utils'
import { useEntityInstancesQuery } from '../../entities/hooks'
import * as componentsApi from '../../entities/metadata/component/api'
import { getLayoutZoneWidgetBindings, listWidgetBindingRecords, listWidgetBindingSources } from '../api'
import { metahubsQueryKeys } from '../../shared'
import {
    buildDynamicFields,
    EMPTY_RECORD_COMPONENTS,
    hasUnsupportedRequiredRecordComponents,
    type DraftBinding,
    type MarketingWidgetBindingDialogProps
} from './marketingWidgetBindingDialogModel'
import { MARKETING_PAGE_HUB_CODENAME, type WidgetBindingSlotDefinition } from '@universo-react/types'

type MarketingWidgetBindingTranslate = (key: string, options?: { defaultValue?: string }) => string

type UseMarketingWidgetBindingDialogDataParams = Pick<
    MarketingWidgetBindingDialogProps,
    'metahubId' | 'layoutId' | 'widgetKey' | 'widgetId' | 'open' | 'canManageLayouts' | 'canEditContent'
> & {
    placementId: string | null
    locale: 'en' | 'ru'
    variant: string
    activeSlot: WidgetBindingSlotDefinition | undefined
    activeDraft: DraftBinding | undefined
    parentDraft: DraftBinding | undefined
    parentSignature: string
    relationSlotsWithDraft: WidgetBindingSlotDefinition[]
    draftBindings: Record<string, DraftBinding>
    sourceSearch: string
    recordSearch: string
    t: MarketingWidgetBindingTranslate
}

export function useMarketingWidgetBindingDialogData({
    metahubId,
    layoutId,
    widgetKey,
    widgetId,
    open,
    canManageLayouts,
    canEditContent,
    placementId,
    locale,
    variant,
    activeSlot,
    activeDraft,
    parentDraft,
    parentSignature,
    relationSlotsWithDraft,
    draftBindings,
    sourceSearch,
    recordSearch,
    t
}: UseMarketingWidgetBindingDialogDataParams) {
    const deferredSourceSearch = sourceSearch.trim().slice(0, 128)
    const deferredRecordSearch = recordSearch.trim().slice(0, 128)

    const bindingQuery = useQuery({
        queryKey: metahubsQueryKeys.layoutZoneWidgetBinding(metahubId, layoutId, placementId ?? '', locale),
        queryFn: async () => (await getLayoutZoneWidgetBindings(metahubId, layoutId, placementId!, locale)).data,
        enabled: open && Boolean(placementId)
    })

    const shouldLoadRecordMetadata = Boolean(
        (canManageLayouts || canEditContent) && open && activeDraft?.sourceKey && activeSlot?.selectorKinds.includes('semantic-key')
    )
    const hubsQuery = useEntityInstancesQuery(
        metahubId,
        shouldLoadRecordMetadata
            ? { kind: 'hub', limit: 20, offset: 0, sortBy: 'codename', sortOrder: 'asc', search: MARKETING_PAGE_HUB_CODENAME, locale }
            : undefined
    )
    const treeEntityId = useMemo(
        () =>
            (hubsQuery.data?.items ?? []).find((entity) => getCodenamePrimary(entity.codename) === MARKETING_PAGE_HUB_CODENAME)?.id ?? null,
        [hubsQuery.data?.items]
    )
    const objectsQuery = useEntityInstancesQuery(
        metahubId,
        shouldLoadRecordMetadata && treeEntityId
            ? {
                  kind: 'object',
                  treeEntityId,
                  limit: 20,
                  offset: 0,
                  sortBy: 'codename',
                  sortOrder: 'asc',
                  search: activeDraft?.sourceKey,
                  locale
              }
            : undefined
    )
    const sourceEntity = useMemo(
        () => (objectsQuery.data?.items ?? []).find((entity) => getCodenamePrimary(entity.codename) === activeDraft?.sourceKey) ?? null,
        [activeDraft?.sourceKey, objectsQuery.data?.items]
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
    const componentsQuery = useQuery({
        queryKey:
            treeEntityId && sourceEntity
                ? metahubsQueryKeys.componentsList(metahubId, treeEntityId, sourceEntity.id, componentParams)
                : ['metahubs', 'widgetBindingRecordComponents', 'empty'],
        queryFn: () => componentsApi.listComponents(metahubId, treeEntityId!, sourceEntity!.id, componentParams),
        enabled: Boolean(shouldLoadRecordMetadata && treeEntityId && sourceEntity)
    })
    const recordComponents = componentsQuery.data?.items ?? EMPTY_RECORD_COMPONENTS
    const semanticKeyComponents = useMemo(
        () =>
            new Set(
                activeSlot?.requirements.components
                    .filter(({ semanticKey }) => semanticKey)
                    .map(({ componentCodename }) => componentCodename) ?? []
            ),
        [activeSlot]
    )
    const recordFields = useMemo(
        () =>
            buildDynamicFields(
                recordComponents,
                locale,
                t,
                semanticKeyComponents,
                activeSlot?.requirements.recordPolicy?.requiredLocales,
                activeSlot?.requirements.recordPolicy?.conditionalRequired
            ),
        [
            activeSlot?.requirements.recordPolicy?.conditionalRequired,
            activeSlot?.requirements.recordPolicy?.requiredLocales,
            locale,
            recordComponents,
            semanticKeyComponents,
            t
        ]
    )
    const hasUnsupportedRequiredFields = useMemo(
        () => hasUnsupportedRequiredRecordComponents(recordComponents, semanticKeyComponents),
        [recordComponents, semanticKeyComponents]
    )
    const semanticKeyRequirement = activeSlot?.requirements.components.find(({ semanticKey }) => semanticKey)

    const sourcesQuery = useInfiniteQuery({
        queryKey: [
            ...metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId),
            'widgetBindingSources',
            widgetKey,
            activeSlot?.key ?? '',
            widgetId ?? '',
            variant,
            deferredSourceSearch,
            locale,
            parentSignature,
            activeDraft?.sourceKey ?? '',
            activeSlot?.relation ? parentDraft?.sourceKey ?? '' : ''
        ],
        initialPageParam: 0,
        queryFn: async ({ pageParam }) =>
            (
                await listWidgetBindingSources(
                    metahubId,
                    layoutId,
                    widgetKey,
                    activeSlot!.key,
                    widgetId,
                    locale,
                    pageParam,
                    deferredSourceSearch,
                    variant || undefined,
                    activeSlot!.relation ? parentDraft?.sourceKey : undefined,
                    activeDraft?.sourceKey
                )
            ).data,
        getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
        enabled: canManageLayouts && open && Boolean(activeSlot && (!activeSlot.relation || parentDraft))
    })

    const relationCompatibilityQueries = useQueries({
        queries: relationSlotsWithDraft.map((slot) => {
            const relation = slot.relation!
            const childSourceKey = draftBindings[slot.key]!.sourceKey
            const parentSourceKey = draftBindings[relation.parentSlot]!.sourceKey
            return {
                queryKey: [
                    ...metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId),
                    'widgetBindingRelationCompatibility',
                    widgetKey,
                    slot.key,
                    widgetId ?? '',
                    variant,
                    locale,
                    parentSourceKey,
                    childSourceKey
                ],
                queryFn: async () =>
                    (
                        await listWidgetBindingSources(
                            metahubId,
                            layoutId,
                            widgetKey,
                            slot.key,
                            widgetId,
                            locale,
                            0,
                            undefined,
                            variant || undefined,
                            parentSourceKey,
                            childSourceKey
                        )
                    ).data,
                enabled: canManageLayouts && open
            }
        })
    })
    const incompatibleRelationSlot = relationSlotsWithDraft.find(
        (_slot, index) => relationCompatibilityQueries[index]?.data?.selectedSource?.compatible === false
    )
    const relationChecksReady = relationCompatibilityQueries.every((query) => query.isSuccess)
    const relationCheckFailed = relationCompatibilityQueries.some((query) => query.isError)

    const recordsQuery = useInfiniteQuery({
        queryKey: [
            ...metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId),
            'widgetBindingRecords',
            widgetKey,
            activeSlot?.key ?? '',
            activeDraft?.sourceKey ?? '',
            variant,
            deferredRecordSearch,
            locale,
            activeDraft?.semanticKey ?? ''
        ],
        initialPageParam: 0,
        queryFn: async ({ pageParam }) =>
            (
                await listWidgetBindingRecords(
                    metahubId,
                    layoutId,
                    widgetKey,
                    activeSlot!.key,
                    widgetId,
                    activeDraft!.sourceKey,
                    locale,
                    pageParam,
                    deferredRecordSearch,
                    variant || undefined,
                    activeDraft!.semanticKey
                )
            ).data,
        getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
        enabled: canManageLayouts && open && Boolean(activeSlot && activeDraft?.sourceKey && activeDraft.selectorKind === 'semantic-key')
    })
    const sourceOptions = useMemo(() => {
        const pages = sourcesQuery.data?.pages ?? []
        const sources = pages.flatMap(({ sources: pageSources }) => pageSources)
        const selectedSource = pages.find(({ selectedSource: selected }) => selected)?.selectedSource
        return selectedSource && !sources.some(({ sourceKey }) => sourceKey === selectedSource.sourceKey)
            ? [selectedSource, ...sources]
            : sources
    }, [sourcesQuery.data])
    const recordOptions = useMemo(() => {
        const pages = recordsQuery.data?.pages ?? []
        const records = pages.flatMap(({ records: pageRecords }) => pageRecords)
        const selectedRecord = pages.find(({ selectedRecord: record }) => record)?.selectedRecord
        return selectedRecord && !records.some(({ semanticKey }) => semanticKey === selectedRecord.semanticKey)
            ? [selectedRecord, ...records]
            : records
    }, [recordsQuery.data])
    const activeSourceOption = activeDraft
        ? sourceOptions.find(({ sourceKey }) => sourceKey === activeDraft.sourceKey) ?? {
              sourceKey: activeDraft.sourceKey,
              label: activeDraft.sourceName,
              recordsCount: 0,
              selectorKinds: [activeDraft.selectorKind]
          }
        : null
    const activeRecordOption = activeDraft?.semanticKey
        ? recordOptions.find(({ semanticKey }) => semanticKey === activeDraft.semanticKey) ?? {
              semanticKey: activeDraft.semanticKey,
              label: activeDraft.selectionLabel ?? t('layouts.widgetBindings.untitledRecord', { defaultValue: 'Untitled content record' })
          }
        : null

    return {
        bindingQuery,
        hubsQuery,
        objectsQuery,
        componentsQuery,
        sourcesQuery,
        recordsQuery,
        relationCompatibilityQueries,
        relationChecksReady,
        relationCheckFailed,
        incompatibleRelationSlot,
        shouldLoadRecordMetadata,
        treeEntityId,
        sourceEntity,
        recordComponents,
        recordFields,
        hasUnsupportedRequiredFields,
        semanticKeyRequirement,
        sourceOptions,
        recordOptions,
        activeSourceOption,
        activeRecordOption
    }
}
