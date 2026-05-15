import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'

import * as recordsApi from '../api'
import * as componentsApi from '../../component/api'
import * as fixedValuesApi from '../../fixedValue/api'
import { getObjectCollectionById } from '../../../presets/api/objectCollections'
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
        objectCollectionId,
        kindKey: routeKindKey
    } = useParams<{
        metahubId: string
        treeEntityId?: string
        objectCollectionId: string
        kindKey?: string
    }>()
    const { i18n } = useTranslation()
    const entityKindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'object' })

    // Resolve treeEntityId from object when treeEntityId is not in the URL (object-centric routes)
    const {
        data: objectForHubResolution,
        isLoading: isObjectResolutionLoading,
        error: objectResolutionError
    } = useQuery({
        queryKey:
            metahubId && objectCollectionId
                ? metahubsQueryKeys.objectCollectionDetail(metahubId, objectCollectionId, entityKindKey)
                : ['metahubs', 'objectCollections', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !objectCollectionId) throw new Error('metahubId and objectCollectionId are required')
            return getObjectCollectionById(metahubId, objectCollectionId, entityKindKey)
        },
        enabled: !!metahubId && !!objectCollectionId && !hubIdParam
    })

    const effectiveTreeEntityId = hubIdParam || objectForHubResolution?.treeEntities?.[0]?.id

    // Hubs (shared hook — staleTime: 5min, deduplication via same queryKey)
    const treeEntities = useTreeEntities(metahubId)

    const canLoadData = !!metahubId && !!objectCollectionId && (!hubIdParam || !isObjectResolutionLoading)

    // Components for this object
    const { data: componentsData } = useQuery({
        queryKey:
            metahubId && objectCollectionId
                ? effectiveTreeEntityId
                    ? metahubsQueryKeys.componentsList(metahubId, effectiveTreeEntityId, objectCollectionId, {
                          limit: 100,
                          locale: i18n.language,
                          includeShared: true
                      })
                    : metahubsQueryKeys.componentsListDirect(metahubId, objectCollectionId, {
                          limit: 100,
                          locale: i18n.language,
                          includeShared: true
                      })
                : ['empty'],
        queryFn:
            metahubId && objectCollectionId
                ? () =>
                      effectiveTreeEntityId
                          ? componentsApi.listComponents(metahubId, effectiveTreeEntityId, objectCollectionId, {
                                limit: 100,
                                locale: i18n.language,
                                includeShared: true
                            })
                          : componentsApi.listComponentsDirect(metahubId, objectCollectionId, {
                                limit: 100,
                                locale: i18n.language,
                                includeShared: true
                            })
                : async () => ({ items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }),
        enabled: canLoadData
    })
    const components = useMemo(() => componentsData?.items ?? [], [componentsData])

    // Settings
    const allowElementCopy = useSettingValue<boolean>('entity.object.allowElementCopy')
    const allowElementDelete = useSettingValue<boolean>('entity.object.allowElementDelete')

    // TABLE components → child components (batch endpoint eliminates N+1)
    const tableComponents = useMemo(() => components.filter((a) => a.dataType === 'TABLE'), [components])
    const tableParentIds = useMemo(() => tableComponents.map((a) => a.id), [tableComponents])

    const { data: childComponentsMap } = useQuery({
        queryKey: ['metahubs', 'childComponentsForElements', metahubId, objectCollectionId, tableParentIds.join(',')],
        queryFn: async () => {
            if (!metahubId || !objectCollectionId || tableParentIds.length === 0) return {}
            return effectiveTreeEntityId
                ? await componentsApi.listChildComponentsBatch(metahubId, effectiveTreeEntityId, objectCollectionId, tableParentIds)
                : await componentsApi.listChildComponentsBatchDirect(metahubId, objectCollectionId, tableParentIds)
        },
        enabled: canLoadData && tableParentIds.length > 0
    })

    // Child REF → enumeration values
    const childEnumTargetIds = useMemo(() => {
        if (!childComponentsMap) return [] as string[]
        const ids = new Set<string>()
        Object.values(childComponentsMap).forEach((children) => {
            children.forEach((child) => {
                if (child.dataType !== 'REF') return
                const kind = child.targetEntityKind ?? null
                const targetId = child.targetEntityId ?? null
                if (kind === 'enumeration' && targetId) ids.add(targetId)
            })
        })
        return Array.from(ids)
    }, [childComponentsMap])

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

    // Ordered components
    const orderedComponents = useMemo(
        () =>
            components
                .map((cmp, index) => ({ cmp, index }))
                .sort((a, b) => {
                    const orderA = a.cmp.sortOrder ?? 0
                    const orderB = b.cmp.sortOrder ?? 0
                    return orderA - orderB || a.index - b.index
                })
                .map((item) => item.cmp),
        [components]
    )

    // Set constant targets
    const setConstantTargets = useMemo(() => {
        const pairs = new Set<string>()
        orderedComponents.forEach((component) => {
            if (component.dataType !== 'REF') return
            if (component.targetEntityKind !== 'set') return
            if (!component.targetEntityId || !component.targetConstantId) return
            pairs.add(`${component.targetEntityId}:${component.targetConstantId}`)
        })
        if (childComponentsMap) {
            Object.values(childComponentsMap).forEach((children) => {
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
    }, [childComponentsMap, orderedComponents])

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
            metahubId && objectCollectionId
                ? (params) =>
                      effectiveTreeEntityId
                          ? metahubsQueryKeys.recordsList(metahubId, effectiveTreeEntityId, objectCollectionId, params)
                          : metahubsQueryKeys.recordsListDirect(metahubId, objectCollectionId, params)
                : () => ['empty'],
        queryFn:
            metahubId && objectCollectionId
                ? (params) =>
                      effectiveTreeEntityId
                          ? recordsApi.listRecords(metahubId, effectiveTreeEntityId, objectCollectionId, params)
                          : recordsApi.listRecordsDirect(metahubId, objectCollectionId, params)
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

    // Visible component columns (first 4)
    const visibleComponentsForColumns = useMemo(() => orderedComponents.slice(0, 4), [orderedComponents])

    const visibleRefComponentsForColumns = useMemo(
        () =>
            visibleComponentsForColumns.filter((cmp) => {
                const targetKind = cmp.targetEntityKind ?? null
                const targetId = cmp.targetEntityId ?? null
                return cmp.dataType === 'REF' && Boolean(targetKind && targetId)
            }),
        [visibleComponentsForColumns]
    )

    const refComponentsForColumns = useMemo(
        () =>
            visibleRefComponentsForColumns.filter((cmp) => {
                const targetKind = cmp.targetEntityKind ?? null
                return Boolean(targetKind && targetKind !== 'set')
            }),
        [visibleRefComponentsForColumns]
    )

    // Ref target display map
    const refTargetByComponent = useMemo(() => {
        const map: Record<
            string,
            {
                kind: string
                targetId: string
                targetConstantId?: string | null
                setConstantLabel?: string | null
            }
        > = {}
        visibleRefComponentsForColumns.forEach((cmp) => {
            const targetKind = cmp.targetEntityKind ?? null
            const targetId = cmp.targetEntityId ?? null
            if (!targetId || !targetKind) return
            if (targetKind === 'set') {
                const targetConstantId = cmp.targetConstantId ?? null
                const targetConstant =
                    targetConstantId && targetId
                        ? (setConstantsMap?.[targetId] ?? []).find((constant) => constant.id === targetConstantId) ?? null
                        : null
                map[cmp.codename] = {
                    kind: targetKind,
                    targetId,
                    targetConstantId,
                    setConstantLabel: targetConstant ? resolveSetConstantLabel(targetConstant, i18n.language) : null
                }
                return
            }
            map[cmp.codename] = { kind: targetKind, targetId }
        })
        return map
    }, [visibleRefComponentsForColumns, setConstantsMap, i18n.language])

    // Ref IDs by target (for batch display resolution)
    const refIdsByTarget = useMemo(() => {
        const map: Record<string, Set<string>> = {}
        if (!Array.isArray(records) || refComponentsForColumns.length === 0) return map
        refComponentsForColumns.forEach((cmp) => {
            const targetKind = cmp.targetEntityKind ?? null
            const targetId = cmp.targetEntityId ?? null
            if (!targetId || !targetKind || targetKind === 'set') return
            const mapKey = `${targetKind}:${targetId}`
            if (!map[mapKey]) map[mapKey] = new Set()
            records.forEach((element) => {
                const rawValue = element.data?.[cmp.codename]
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
    }, [records, refComponentsForColumns])

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

                if (targetKind === 'object') {
                    const componentsResponse = await componentsApi.listComponentsDirect(metahubId, targetId, {
                        limit: 100,
                        locale: i18n.language,
                        includeShared: true
                    })
                    const targetAttrs = componentsResponse?.items ?? []

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
        objectCollectionId,
        effectiveTreeEntityId,
        treeEntities,
        objectForHubResolution,
        isObjectResolutionLoading,
        objectResolutionError,
        canLoadData,
        components,
        orderedComponents,
        childComponentsMap,
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
        visibleComponentsForColumns,
        refTargetByComponent,
        refDisplayMap,
        isFetchingRefDisplayMap,
        refIdsKey
    }
}
