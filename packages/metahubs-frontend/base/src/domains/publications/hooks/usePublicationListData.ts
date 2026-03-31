import { useMemo, useCallback, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedSearch } from '@universo/template-mui'
import type { PaginationState, PaginationActions } from '@universo/template-mui'

import { usePublicationsList } from '../hooks/usePublications'
import { useMetahubDetails } from '../../metahubs'
import type { Publication } from '../api'
import { listBranchOptions } from '../../branches/api/branches'
import { getVLCString } from '../../../types'

export function usePublicationListData() {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { i18n } = useTranslation()

    // Use publications list hook
    const {
        data: publicationsResponse,
        isLoading,
        error,
        refetch
    } = usePublicationsList(metahubId ?? '', {
        enabled: !!metahubId
    })

    // Fetch metahub details for the create dialog's Metahub tab
    const { data: metahub, isLoading: isMetahubLoading } = useMetahubDetails(metahubId ?? '', {
        enabled: !!metahubId
    })

    const { data: branchesResponse } = useQuery({
        queryKey: ['metahub-branches', 'options', 'publication', metahubId],
        queryFn: () => listBranchOptions(metahubId ?? '', { sortBy: 'name', sortOrder: 'asc' }),
        enabled: !!metahubId
    })

    const branches = branchesResponse?.items ?? []
    const defaultBranchId = branchesResponse?.meta?.defaultBranchId ?? branches[0]?.id ?? null

    const getBranchLabel = useCallback(
        (branchId?: string | null) => {
            if (!branchId) return ''
            const branch = branches.find((item) => item.id === branchId)
            if (!branch) return `Deleted branch (${branchId})`
            const name = getVLCString(branch.name, i18n.language) || getVLCString(branch.name, 'en') || branch.codename
            return `${name} (${branch.codename})`
        },
        [branches, i18n.language]
    )

    const publications = publicationsResponse?.items ?? []

    // Local (client-side) search + pagination.
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [searchQuery, setSearchQuery] = useState('')

    const setSearch = useCallback((nextSearch: string) => {
        setSearchQuery(nextSearch)
        setCurrentPage(1)
    }, [])

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: setSearch,
        delay: 0
    })

    const filteredPublications = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return publications

        return publications.filter((publication) => {
            const name = (getVLCString(publication.name, i18n.language) || '').toLowerCase()
            const description = (getVLCString(publication.description, i18n.language) || '').toLowerCase()
            const schemaName = (publication.schemaName || '').toLowerCase()
            return name.includes(query) || description.includes(query) || schemaName.includes(query)
        })
    }, [publications, i18n.language, searchQuery])

    const totalItems = filteredPublications.length
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0

    useEffect(() => {
        if (totalPages === 0) {
            if (currentPage !== 1) setCurrentPage(1)
            return
        }
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    const visiblePublications = useMemo(() => {
        if (totalItems === 0) return []
        const start = (currentPage - 1) * pageSize
        return filteredPublications.slice(start, start + pageSize)
    }, [currentPage, filteredPublications, pageSize, totalItems])

    const pagination: PaginationState = useMemo(
        () => ({
            currentPage,
            pageSize,
            totalItems,
            totalPages,
            hasNextPage: totalPages > 0 ? currentPage < totalPages : false,
            hasPreviousPage: currentPage > 1,
            search: searchQuery
        }),
        [currentPage, pageSize, searchQuery, totalItems, totalPages]
    )

    const paginationActions: PaginationActions = useMemo(
        () => ({
            goToPage: (page: number) => {
                if (totalPages === 0) {
                    setCurrentPage(1)
                    return
                }
                const safePage = Math.max(1, Math.min(page, totalPages))
                setCurrentPage(safePage)
            },
            nextPage: () => {
                if (totalPages === 0) return
                setCurrentPage((p) => Math.min(p + 1, totalPages))
            },
            previousPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
            setSearch,
            setSort: () => undefined,
            setPageSize: (nextSize: number) => {
                const safeSize = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 20
                setPageSize(safeSize)
                setCurrentPage(1)
            }
        }),
        [setSearch, totalPages]
    )

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(publications)) {
            publications.forEach((publication) => {
                if (publication?.id) {
                    imagesMap[publication.id] = []
                }
            })
        }
        return imagesMap
    }, [publications])

    const publicationMap = useMemo(() => {
        if (!Array.isArray(publications)) return new Map<string, Publication>()
        return new Map(publications.map((publication) => [publication.id, publication]))
    }, [publications])

    return {
        metahubId,
        metahub,
        isMetahubLoading,
        publications,
        isLoading,
        error,
        refetch,
        branches,
        defaultBranchId,
        getBranchLabel,
        handleSearchChange,
        searchQuery,
        visiblePublications,
        pagination,
        paginationActions,
        totalItems,
        images,
        publicationMap
    }
}
