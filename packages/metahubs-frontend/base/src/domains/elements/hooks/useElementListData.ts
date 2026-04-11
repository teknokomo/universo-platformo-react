import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch } from '@universo/template-mui'

import * as elementsApi from '../api'
import * as attributesApi from '../../attributes'
import * as constantsApi from '../../constants/api'
import { getCatalogById } from '../../catalogs'
import { listEnumerationValues } from '../../enumerations/api'
import { getEntityInstance } from '../../entities/api/entityInstances'
import { metahubsQueryKeys } from '../../shared'
import { getVLCString } from '../../../types'
import type { Constant, HubElement } from '../../../types'
import { useSettingValue } from '../../settings/hooks/useSettings'
import { useMetahubHubs } from '../../hubs/hooks'
import { resolveSetConstantLabel } from '../ui/elementListUtils'

export function useElementListData() {
    const { metahubId, hubId: hubIdParam, catalogId } = useParams<{ metahubId: string; hubId?: string; catalogId: string }>()
    const { i18n } = useTranslation()

    // Resolve hubId from catalog when hubId is not in the URL (catalog-centric routes)
    const {
        data: catalogForHubResolution,
        isLoading: isCatalogResolutionLoading,
        error: catalogResolutionError
    } = useQuery({
        queryKey:
            metahubId && catalogId ? metahubsQueryKeys.catalogDetail(metahubId, catalogId) : ['metahubs', 'catalogs', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !catalogId) throw new Error('metahubId and catalogId are required')
            return getCatalogById(metahubId, catalogId)
        },
        enabled: !!metahubId && !!catalogId && !hubIdParam
    })

    const effectiveHubId = hubIdParam || catalogForHubResolution?.hubs?.[0]?.id

    // Hubs (shared hook — staleTime: 5min, deduplication via same queryKey)
    const hubs = useMetahubHubs(metahubId)

    const canLoadData = !!metahubId && !!catalogId && (!hubIdParam || !isCatalogResolutionLoading)

    // Attributes for this catalog
    const { data: attributesData } = useQuery({
        queryKey:
            metahubId && catalogId
                ? effectiveHubId
                    ? metahubsQueryKeys.attributesList(metahubId, effectiveHubId, catalogId, {
                          limit: 100,
                          locale: i18n.language,
                          includeShared: true
                      })
                    : metahubsQueryKeys.attributesListDirect(metahubId, catalogId, {
                          limit: 100,
                          locale: i18n.language,
                          includeShared: true
                      })
                : ['empty'],
        queryFn:
            metahubId && catalogId
                ? () =>
                      effectiveHubId
                          ? attributesApi.listAttributes(metahubId, effectiveHubId, catalogId, {
                                limit: 100,
                                locale: i18n.language,
                                includeShared: true
                            })
                          : attributesApi.listAttributesDirect(metahubId, catalogId, {
                                limit: 100,
                                locale: i18n.language,
                                includeShared: true
                            })
                : async () => ({ items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }),
        enabled: canLoadData
    })
    const attributes = useMemo(() => attributesData?.items ?? [], [attributesData])

    // Settings
    const allowElementCopy = useSettingValue<boolean>('catalogs.allowElementCopy')
    const allowElementDelete = useSettingValue<boolean>('catalogs.allowElementDelete')

    // TABLE attributes → child attributes (batch endpoint eliminates N+1)
    const tableAttributes = useMemo(() => attributes.filter((a) => a.dataType === 'TABLE'), [attributes])
    const tableParentIds = useMemo(() => tableAttributes.map((a) => a.id), [tableAttributes])

    const { data: childAttributesMap } = useQuery({
        queryKey: ['metahubs', 'childAttributesForElements', metahubId, catalogId, tableParentIds.join(',')],
        queryFn: async () => {
            if (!metahubId || !catalogId || tableParentIds.length === 0) return {}
            return effectiveHubId
                ? await attributesApi.listChildAttributesBatch(metahubId, effectiveHubId, catalogId, tableParentIds)
                : await attributesApi.listChildAttributesBatchDirect(metahubId, catalogId, tableParentIds)
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
                        const resp = await listEnumerationValues(metahubId, enumId, { includeShared: true })
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
                        console.warn(`[ElementList] Failed to load enum values for ${enumId}:`, err)
                        result[enumId] = []
                    }
                })
            )
            return result
        },
        enabled: Boolean(metahubId) && childEnumTargetIds.length > 0
    })

    // Ordered attributes
    const orderedAttributes = useMemo(
        () =>
            attributes
                .map((attr, index) => ({ attr, index }))
                .sort((a, b) => {
                    const orderA = a.attr.sortOrder ?? 0
                    const orderB = b.attr.sortOrder ?? 0
                    return orderA - orderB || a.index - b.index
                })
                .map((item) => item.attr),
        [attributes]
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
                const [setId, constantId] = pair.split(':')
                return { setId, constantId }
            })
            .filter((pair) => pair.setId && pair.constantId)
            .sort((a, b) => a.setId.localeCompare(b.setId) || a.constantId.localeCompare(b.constantId))
    }, [childAttributesMap, orderedAttributes])

    const { data: setConstantsMap } = useQuery({
        queryKey: [
            'metahubs',
            'setConstantsForElements',
            metahubId,
            setConstantTargets.map((target) => `${target.setId}:${target.constantId}`).join(','),
            i18n.language
        ],
        queryFn: async () => {
            if (!metahubId || setConstantTargets.length === 0) return {}
            const result: Record<string, Constant[]> = {}
            await Promise.all(
                setConstantTargets.map(async ({ setId: setTargetId, constantId }) => {
                    try {
                        const response = await constantsApi.getConstantDirect(metahubId, setTargetId, constantId)
                        const current = result[setTargetId] ?? []
                        result[setTargetId] = [...current, response.data]
                    } catch (err) {
                        console.warn(`[ElementList] Failed to load constant ${constantId} for set ${setTargetId}:`, err)
                    }
                })
            )
            return result
        },
        enabled: Boolean(metahubId) && setConstantTargets.length > 0
    })

    // Pagination for elements list
    const paginationResult = usePaginated<HubElement, 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? metahubsQueryKeys.elementsList(metahubId, effectiveHubId, catalogId, params)
                          : metahubsQueryKeys.elementsListDirect(metahubId, catalogId, params)
                : () => ['empty'],
        queryFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? elementsApi.listElements(metahubId, effectiveHubId, catalogId, params)
                          : elementsApi.listElementsDirect(metahubId, catalogId, params)
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadData
    })

    const { data: elements, isLoading, error } = paginationResult

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Sorted elements
    const sortedElements = useMemo(
        () =>
            [...elements].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [elements]
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
        if (!Array.isArray(sortedElements)) return new Map<string, HubElement>()
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
        if (!Array.isArray(elements) || refAttributesForColumns.length === 0) return map
        refAttributesForColumns.forEach((attr) => {
            const targetKind = attr.targetEntityKind ?? null
            const targetId = attr.targetEntityId ?? null
            if (!targetId || !targetKind || targetKind === 'set') return
            const mapKey = `${targetKind}:${targetId}`
            if (!map[mapKey]) map[mapKey] = new Set()
            elements.forEach((element) => {
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
    }, [elements, refAttributesForColumns])

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
            const { toHubElementDisplay } = await import('../../../types')

            for (const entry of refIdsKey) {
                if (!entry.ids.length) continue
                const [targetKind, targetId] = entry.targetKey.split(':')
                if (!targetId || !targetKind || targetKind === 'set') continue

                if (targetKind === 'catalog') {
                    const attributesResponse = await attributesApi.listAttributesDirect(metahubId, targetId, {
                        limit: 100,
                        locale: i18n.language,
                        includeShared: true
                    })
                    const targetAttrs = attributesResponse?.items ?? []

                    const elementsResponse = await Promise.all(
                        entry.ids.map(async (id) => {
                            try {
                                const response = await elementsApi.getElementDirect(metahubId, targetId, id)
                                return response.data
                            } catch {
                                return null
                            }
                        })
                    )

                    const displayMap: Record<string, string> = {}
                    elementsResponse.filter(Boolean).forEach((element) => {
                        const display = toHubElementDisplay(element as HubElement, targetAttrs, i18n.language)
                        displayMap[(element as HubElement).id] = display.name || (element as HubElement).id
                    })
                    result[entry.targetKey] = displayMap
                    continue
                }

                if (targetKind === 'enumeration') {
                    const valuesResponse = await listEnumerationValues(metahubId, targetId, { includeShared: true })
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
        catalogId,
        effectiveHubId,
        hubs,
        catalogForHubResolution,
        isCatalogResolutionLoading,
        catalogResolutionError,
        canLoadData,
        attributes,
        orderedAttributes,
        childAttributesMap,
        childEnumValuesMap,
        setConstantsMap,
        allowElementCopy,
        allowElementDelete,
        paginationResult,
        elements,
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
