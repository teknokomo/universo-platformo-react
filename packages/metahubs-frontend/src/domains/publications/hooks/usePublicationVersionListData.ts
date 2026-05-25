import { useMemo, useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedSearch } from '@universo/template-mui'
import type { FlowListTableData } from '@universo/template-mui'

import { usePublicationVersions } from '../hooks/usePublicationVersions'
import type { PublicationVersion } from '../api'
import { listBranchOptions } from '../../branches/api/branches'
import { getVLCString } from '../../../types'

export interface VersionTableRow extends FlowListTableData {
    id: string
    name: string
    versionNumber: number
    description: string | null
    isActive: boolean
    createdAt: string
    branchLabel: string
}

export function usePublicationVersionListData() {
    const { metahubId, publicationId } = useParams<{ metahubId: string; publicationId: string }>()
    const { i18n } = useTranslation()

    // ── Data queries ───────────────────────────────────────────────────
    const { data: versionsResponse, isLoading, error } = usePublicationVersions(metahubId!, publicationId!)
    const rawVersions = useMemo<PublicationVersion[]>(() => versionsResponse?.items ?? [], [versionsResponse])

    // Branches for labels and create dialog
    const { data: branchesResponse } = useQuery({
        queryKey: ['metahub-branches', 'options', 'publication-versions-page', metahubId],
        queryFn: () => listBranchOptions(metahubId!, { sortBy: 'name', sortOrder: 'asc' }),
        enabled: Boolean(metahubId)
    })
    const branches = useMemo(() => branchesResponse?.items ?? [], [branchesResponse])
    const defaultBranchId = branchesResponse?.meta?.defaultBranchId ?? branches[0]?.id ?? null

    const getBranchLabel = useCallback(
        (branchId?: string | null) => {
            if (!branchId) return ''
            const branch = branches.find((b) => b.id === branchId)
            if (!branch) return 'Deleted branch'
            const codename = getVLCString(branch.codename, i18n.language) || getVLCString(branch.codename, 'en') || ''
            const name = getVLCString(branch.name, i18n.language) || getVLCString(branch.name, 'en') || codename || branchId
            return codename ? `${name} (${codename})` : name
        },
        [branches, i18n.language]
    )

    // ── Table data ─────────────────────────────────────────────────────
    const versions: VersionTableRow[] = useMemo(
        () =>
            rawVersions.map((v) => ({
                id: v.id,
                name: getVLCString(v.name, i18n.language) || `Version ${v.versionNumber}`,
                versionNumber: v.versionNumber,
                description: getVLCString(v.description, i18n.language) || null,
                isActive: v.isActive,
                createdAt: v.createdAt,
                branchLabel: getBranchLabel(v.branchId)
            })),
        [rawVersions, i18n.language, getBranchLabel]
    )

    // ── Search ─────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('')
    const { searchValue, handleSearchChange } = useDebouncedSearch({ onSearchChange: setSearchQuery, delay: 0 })

    const filteredVersions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return versions
        return versions.filter((v) => {
            const name = (v.name || '').toLowerCase()
            return name.includes(query) || `v${v.versionNumber}`.includes(query)
        })
    }, [versions, searchQuery])

    // ── Pagination ─────────────────────────────────────────────────────
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(20)

    const paginatedVersions = useMemo(() => {
        const start = page * pageSize
        return filteredVersions.slice(start, start + pageSize)
    }, [filteredVersions, page, pageSize])

    const paginationState = useMemo(
        () => ({
            currentPage: page + 1,
            pageSize,
            totalItems: filteredVersions.length,
            totalPages: Math.ceil(filteredVersions.length / pageSize),
            hasNextPage: (page + 1) * pageSize < filteredVersions.length,
            hasPreviousPage: page > 0
        }),
        [page, pageSize, filteredVersions.length]
    )

    const paginationActions = useMemo(
        () => ({
            goToPage: (p: number) => setPage(p - 1),
            nextPage: () => setPage((prev) => prev + 1),
            previousPage: () => setPage((prev) => Math.max(0, prev - 1)),
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            setSearch: () => {},
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            setSort: () => {},
            setPageSize: (size: number) => {
                setPageSize(size)
                setPage(0)
            }
        }),
        []
    )

    return {
        metahubId,
        publicationId,
        rawVersions,
        versions,
        isLoading,
        error,
        branches,
        defaultBranchId,
        getBranchLabel,
        searchValue,
        handleSearchChange,
        filteredVersions,
        paginatedVersions,
        paginationState,
        paginationActions
    }
}
