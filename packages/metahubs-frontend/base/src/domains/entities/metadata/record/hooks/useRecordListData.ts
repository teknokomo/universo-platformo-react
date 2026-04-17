import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'

import * as recordsApi from '../api'
import * as fieldDefinitionsApi from '../../fieldDefinition/api'
import * as fixedValuesApi from '../../fixedValue/api'
import { getLinkedCollectionById } from '../../../presets/api/linkedCollections'
import { listOptionValues } from '../../../presets/api/optionLists'
import { getEntityInstance } from '../../../api/entityInstances'
import { metahubsQueryKeys } from '../../../../shared'
import { getVLCString } from '../../../../../types'
import type { FixedValue, RecordItem } from '../../../../../types'
import { useSettingValue } from '../../../../settings/hooks/useSettings'
import { useTreeEntities } from '../../../presets/hooks/useTreeEntities'
import { resolveSetConstantLabel } from '../ui/recordListUtils'
import { resolveEntityChildKindKey } from '../../../../shared/entityMetadataRoutePaths'

export function useRecordListData() {
    const {
        metahubId,
        treeEntityId: hubIdParam,
        linkedCollectionId,
        kindKey: routeKindKey
    } = useParams<{
        metahubId: string
        treeEntityId?: string
        linkedCollectionId: string
        kindKey?: string
    }>()
    const { i18n } = useTranslation()
    const entityKindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'catalog' })

    // Resolve treeEntityId from catalog when treeEntityId is not in the URL (catalog-centric routes)
    const {
        data: catalogForHubResolution,
        isLoading: isCatalogResolutionLoading,
        error: catalogResolutionError
    } = useQuery({
        queryKey:
            metahubId && linkedCollectionId
                ? metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId, entityKindKey)
                : ['metahubs', 'linkedCollections', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !linkedCollectionId) throw new Error('metahubId and linkedCollectionId are required')
            return getLinkedCollectionById(metahubId, linkedCollectionId, entityKindKey)
        },
        enabled: !!metahubId && !!linkedCollectionId && !hubIdParam
    })

    const effectiveTreeEntityId = hubIdParam || catalogForHubResolution?.treeEntities?.[0]?.id

    // Hubs (shared hook — staleTime: 5min, deduplication via same queryKey)
    const treeEntities = useTreeEntities(metahubId)

    const canLoadData = !!metahubId && !!linkedCollectionId && (!hubIdParam || !isCatalogResolutionLoading)

    // Attributes for this catalog
    const { data: attributesData } = useQuery({
        queryKey:
            metahubId && linkedCollectionId
                ? effectiveTreeEntityId
                    ? metahubsQueryKeys.fieldDefinitionsList(metahubId, effectiveTreeEntityId, linkedCollectionId, {
                          limit: 100,
                          locale: i18n.language,
                          includeShared: true
                      })
                    : metahubsQueryKeys.fieldDefinitionsListDirect(metahubId, linkedCollectionId, {
                          limit: 100,
                          locale: i18n.language,
                          includeShared: true
                      })
                : ['empty'],
        queryFn:
            metahubId && linkedCollectionId
                ? () =>
                      effectiveTreeEntityId
                          ? fieldDefinitionsApi.listFieldDefinitions(metahubId, effectiveTreeEntityId, linkedCollectionId, {
                                limit: 100,
                                locale: i18n.language,
                                includeShared: true
                            })
                          : fieldDefinitionsApi.listFieldDefinitionsDirect(metahubId, linkedCollectionId, {
                                limit: 100,
                                locale: i18n.language,
                                includeShared: true
                            })
                : async () => ({ items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }),
        enabled: canLoadData
    })
    const fieldDefinitions = useMemo(() => attributesData?.items ?? [], [attributesData])

    // Settings
    const allowElementCopy = useSettingValue<boolean>('entity.catalog.allowElementCopy')
    const allowElementDelete = useSettingValue<boolean>('entity.catalog.allowElementDelete')

    // TABLE fieldDefinitions → child fieldDefinitions (batch endpoint eliminates N+1)
    const tableAttributes = useMemo(() => fieldDefinitions.filter((a) => a.dataType === 'TABLE'), [fieldDefinitions])
    const tableParentIds = useMemo(() => tableAttributes.map((a) => a.id), [tableAttributes])

    const { data: childAttributesMap } = useQuery({
        queryKey: ['metahubs', 'childAttributesForElements', metahubId, linkedCollectionId, tableParentIds.join(',')],
        queryFn: async () => {
            if (!metahubId || !linkedCollectionId || tableParentIds.length === 0) return {}
            return effectiveTreeEntityId
                ? await fieldDefinitionsApi.listChildFieldDefinitionsBatch(
                      metahubId,
                      effectiveTreeEntityId,
                      linkedCollectionId,
                      tableParentIds
                  )
                : await fieldDefinitionsApi.listChildFieldDefinitionsBatchDirect(metahubId, linkedCollectionId, tableParentIds)
        },
        enabled: canLoadData && tableParentIds.length > 0
    })

    // Child REF → enumeration values
    const childEnumTargetIds = useMemo(() => {
        if (!childAttributesMap) return [] as string[]
        const ids = new Set<string>()
        Object.values(childAttributesMap).forEach((children) => {
            children.forEach((child) => {
                if (child.dataType !== 'REF') return
                const kind = child.targetEntityKind ?? null
                const targetId = child.targetEntityId ?? null
                if (kind === 'enumeration' && targetId) ids.add(targetId)
            })
        })
        return Array.from(ids)
    }, [childAttributesMap])

    const { data: childEnumValuesMap } = useQuery({
        queryKey: ['metahubs', 'childEnumValues', metahubId, [...childEnumTargetIds].sort().join(','), i18n.language],
        queryFn: async () => {
            if (!metahubId || childEnumTargetIds.length === 0) return {}
            const result: Record<
                string,
                Array<{ id: string; label: string; codename?: string; isDefault?: boolean; sortOrder?: number }>
            > = {}
            await Promise.all(
                childEnumTargetIds.map(async (enumId) => {
                    try {
                        const resp = await listOptionValues(metahubId, enumId, { includeShared: true })
                        result[enumId] = (resp.items ?? [])
                            .slice()
                            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                            .map((item) => ({
                                id: item.id,
                                label: getVLCString(item.name, i18n.language) || getVLCString(item.name, 'en') || item.codename || item.id,
                                codename: item.codename,
                                isDefault: Boolean(item.isDefault),
                                sortOrder: item.sortOrder
                            }))
                    } catch (err) {
                        console.warn(`[RecordList] Failed to load enum values for ${enumId}:`, err)
                        result[enumId] = []
                    }
                })
            )
            return result
        },
        enabled: Boolean(metahubId) && childEnumTargetIds.length > 0
    })

    // Ordered fieldDefinitions
    const orderedAttributes = useMemo(
        () =>
            fieldDefinitions
                .map((attr, index) => ({ attr, index }))
                .sort((a, b) => {
                    const orderA = a.attr.sortOrder ?? 0
                    const orderB = b.attr.sortOrder ?? 0
                    return orderA - orderB || a.index - b.index
                })
                .map((item) => item.attr),
        [fieldDefinitions]
    )

    // Set constant targets
    const setConstantTargets = useMemo(() => {
        const pairs = new Set<string>()
        orderedAttributes.forEach((attribute) => {
            if (attribute.dataType !== 'REF') return
            if (attribute.targetEntityKind !== 'set') return
            if (!attribute.targetEntityId || !attribute.targetConstantId) return
            pairs.add(`${attribute.targetEntityId}:${attribute.targetConstantId}`)
        })
        if (childAttributesMap) {
            Object.values(childAttributesMap).forEach((children) => {
                children.forEach((child) => {
                    if (child.dataType !== 'REF') return
                    if (child.targetEntityKind !== 'set') return
                    if (!child.targetEntityId || !child.targetConstantId) return
                    pairs.add(`${child.targetEntityId}:${child.targetConstantId}`)
                })
            })
        }
        return Array.from(pairs)
            .map((pair) => {
                const [valueGroupId, fixedValueId] = pair.split(':')
                return { valueGroupId, fixedValueId }
            })
            .filter((pair) => pair.valueGroupId && pair.fixedValueId)
            .sort((a, b) => a.valueGroupId.localeCompare(b.valueGroupId) || a.fixedValueId.localeCompare(b.fixedValueId))
    }, [childAttributesMap, orderedAttributes])

    const { data: setConstantsMap } = useQuery({
        queryKey: [
            'metahubs',
            'setConstantsForElements',
            metahubId,
            setConstantTargets.map((target) => `${target.valueGroupId}:${target.fixedValueId}`).join(','),
            i18n.language
        ],
        queryFn: async () => {
            if (!metahubId || setConstantTargets.length === 0) return {}
            const result: Record<string, FixedValue[]> = {}
            await Promise.all(
                setConstantTargets.map(async ({ valueGroupId: setTargetId, fixedValueId }) => {
                    try {
                        const response = await fixedValuesApi.getFixedValueDirect(metahubId, setTargetId, fixedValueId)
                        const current = result[setTargetId] ?? []
                        result[setTargetId] = [...current, response.data]
                    } catch (err) {
                        console.warn(`[RecordList] Failed to load constant ${fixedValueId} for set ${setTargetId}:`, err)
                    }
                })
            )
            return result
        },
        enabled: Boolean(metahubId) && setConstantTargets.length > 0
    })

    // Pagination for records list
    const paginationResult = usePaginated<RecordItem, 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && linkedCollectionId
                ? (params) =>
                      effectiveTreeEntityId
                          ? metahubsQueryKeys.recordsList(metahubId, effectiveTreeEntityId, linkedCollectionId, params)
                          : metahubsQueryKeys.recordsListDirect(metahubId, linkedCollectionId, params)
                : () => ['empty'],
        queryFn:
            metahubId && linkedCollectionId
                ? (params) =>
                      effectiveTreeEntityId
                          ? recordsApi.listRecords(metahubId, effectiveTreeEntityId, linkedCollectionId, params)
                          : recordsApi.listRecordsDirect(metahubId, linkedCollectionId, params)
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadData
    })

    const { data: records, isLoading, error } = paginationResult

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted records
    const sortedElements = useMemo(
        () =>
            [...records].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [records]
    )

    const images = useMemo(() => {
        const imagesMap: Record<string, never[]> = {}
        if (Array.isArray(sortedElements)) {
            sortedElements.forEach((element) => {
                if (element?.id) imagesMap[element.id] = []
            })
        }
        return imagesMap
    }, [sortedElements])

    const elementMap = useMemo(() => {
        if (!Array.isArray(sortedElements)) return new Map<string, RecordItem>()
        return new Map(sortedElements.map((element) => [element.id, element]))
    }, [sortedElements])

    const elementOrderMap = useMemo(() => {
        const map = new Map<string, number>()
        sortedElements.forEach((element, index) => {
            map.set(element.id, index)
        })
        return map
    }, [sortedElements])

    // Visible attribute columns (first 4)
    const visibleAttributesForColumns = useMemo(() => orderedAttributes.slice(0, 4), [orderedAttributes])

    const visibleRefAttributesForColumns = useMemo(
        () =>
            visibleAttributesForColumns.filter((attr) => {
                const targetKind = attr.targetEntityKind ?? null
                const targetId = attr.targetEntityId ?? null
                return attr.dataType === 'REF' && Boolean(targetKind && targetId)
            }),
        [visibleAttributesForColumns]
    )

    const refAttributesForColumns = useMemo(
        () =>
            visibleRefAttributesForColumns.filter((attr) => {
                const targetKind = attr.targetEntityKind ?? null
                return Boolean(targetKind && targetKind !== 'set')
            }),
        [visibleRefAttributesForColumns]
    )

    // Ref target display map
    const refTargetByAttribute = useMemo(() => {
        const map: Record<
            string,
            {
                kind: string
                targetId: string
                targetConstantId?: string | null
                setConstantLabel?: string | null
            }
        > = {}
        visibleRefAttributesForColumns.forEach((attr) => {
            const targetKind = attr.targetEntityKind ?? null
            const targetId = attr.targetEntityId ?? null
            if (!targetId || !targetKind) return
            if (targetKind === 'set') {
                const targetConstantId = attr.targetConstantId ?? null
                const targetConstant =
                    targetConstantId && targetId
                        ? (setConstantsMap?.[targetId] ?? []).find((constant) => constant.id === targetConstantId) ?? null
                        : null
                map[attr.codename] = {
                    kind: targetKind,
                    targetId,
                    targetConstantId,
                    setConstantLabel: targetConstant ? resolveSetConstantLabel(targetConstant, i18n.language) : null
                }
                return
            }
            map[attr.codename] = { kind: targetKind, targetId }
        })
        return map
    }, [visibleRefAttributesForColumns, setConstantsMap, i18n.language])

    // Ref IDs by target (for batch display resolution)
    const refIdsByTarget = useMemo(() => {
        const map: Record<string, Set<string>> = {}
        if (!Array.isArray(records) || refAttributesForColumns.length === 0) return map
        refAttributesForColumns.forEach((attr) => {
            const targetKind = attr.targetEntityKind ?? null
            const targetId = attr.targetEntityId ?? null
            if (!targetId || !targetKind || targetKind === 'set') return
            const mapKey = `${targetKind}:${targetId}`
            if (!map[mapKey]) map[mapKey] = new Set()
            records.forEach((element) => {
                const rawValue = element.data?.[attr.codename]
                const resolvedId =
                    typeof rawValue === 'string' && rawValue.length > 0
                        ? rawValue
                        : rawValue && typeof rawValue === 'object'
                        ? typeof (rawValue as Record<string, unknown>).id === 'string'
                            ? ((rawValue as Record<string, unknown>).id as string)
                            : null
                        : null
                if (resolvedId) map[mapKey].add(resolvedId)
            })
        })
        return map
    }, [records, refAttributesForColumns])

    const refIdsKey = useMemo(
        () =>
            Object.entries(refIdsByTarget)
                .map(([targetKey, idsSet]) => ({ targetKey, ids: Array.from(idsSet).sort() }))
                .sort((a, b) => a.targetKey.localeCompare(b.targetKey)),
        [refIdsByTarget]
    )

    const { data: refDisplayMap, isFetching: isFetchingRefDisplayMap } = useQuery({
        queryKey: ['metahubs', 'ref-display', metahubId, refIdsKey, i18n.language],
        enabled: Boolean(metahubId && refIdsKey.length > 0),
        staleTime: 30000,
        queryFn: async () => {
            if (!metahubId) return {}
            const result: Record<string, Record<string, string>> = {}
            const { toRecordItemDisplay } = await import('../../../../../types')

            for (const entry of refIdsKey) {
                if (!entry.ids.length) continue
                const [targetKind, targetId] = entry.targetKey.split(':')
                if (!targetId || !targetKind || targetKind === 'set') continue

                if (targetKind === 'catalog') {
                    const attributesResponse = await fieldDefinitionsApi.listFieldDefinitionsDirect(metahubId, targetId, {
                        limit: 100,
                        locale: i18n.language,
                        includeShared: true
                    })
                    const targetAttrs = attributesResponse?.items ?? []

                    const elementsResponse = await Promise.all(
                        entry.ids.map(async (id) => {
                            try {
                                const response = await recordsApi.getRecordDirect(metahubId, targetId, id)
                                return response.data
                            } catch {
                                return null
                            }
                        })
                    )

                    const displayMap: Record<string, string> = {}
                    elementsResponse.filter(Boolean).forEach((element) => {
                        const display = toRecordItemDisplay(element as RecordItem, targetAttrs, i18n.language)
                        displayMap[(element as RecordItem).id] = display.name || (element as RecordItem).id
                    })
                    result[entry.targetKey] = displayMap
                    continue
                }

                if (targetKind === 'enumeration') {
                    const valuesResponse = await listOptionValues(metahubId, targetId, { includeShared: true })
                    const valuesDisplayMap: Record<string, string> = {}
                    valuesResponse.items.forEach((item) => {
                        valuesDisplayMap[item.id] = getVLCString(item.name, i18n.language) || getVLCString(item.name, 'en') || item.codename
                    })
                    result[entry.targetKey] = valuesDisplayMap
                    continue
                }

                const entityDisplayMap: Record<string, string> = {}
                const entities = await Promise.all(
                    entry.ids.map(async (id) => {
                        try {
                            return await getEntityInstance(metahubId, id)
                        } catch {
                            return null
                        }
                    })
                )

                entities.filter(Boolean).forEach((entity) => {
                    entityDisplayMap[String(entity!.id)] =
                        getVLCString(entity!.name, i18n.language) ||
                        getVLCString(entity!.name, 'en') ||
                        getVLCString(entity!.codename, i18n.language) ||
                        getVLCString(entity!.codename, 'en') ||
                        String(entity!.id)
                })
                result[entry.targetKey] = entityDisplayMap
            }

            return result
        }
    })

    return {
        metahubId,
        hubIdParam,
        linkedCollectionId,
        effectiveTreeEntityId,
        treeEntities,
        catalogForHubResolution,
        isCatalogResolutionLoading,
        catalogResolutionError,
        canLoadData,
        fieldDefinitions,
        orderedAttributes,
        childAttributesMap,
        childEnumValuesMap,
        setConstantsMap,
        allowElementCopy,
        allowElementDelete,
        paginationResult,
        records,
        isLoading,
        error,
        handleSearchChange,
        sortedElements,
        images,
        elementMap,
        elementOrderMap,
        visibleAttributesForColumns,
        refTargetByAttribute,
        refDisplayMap,
        isFetchingRefDisplayMap,
        refIdsKey
    }
}
