import { useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { usePaginated, useDebouncedSearch, revealPendingEntityFeedback } from '@universo/template-mui'
import { normalizeBranchCopyOptions } from '@universo/utils'
import type { MetahubBranch, MetahubBranchDisplay } from '../../../types'
import { getVLCString, toBranchDisplay } from '../../../types'
import * as branchesApi from '../api'
import { metahubsQueryKeys } from '../../shared'
import type { BranchFormValues } from '../ui/branchListUtils'

export const useBranchListData = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const paginationResult = usePaginated<MetahubBranch, 'name' | 'codename' | 'created' | 'updated'>({
        queryKeyFn: metahubId ? (params) => metahubsQueryKeys.branchesList(metahubId, params) : () => ['empty'],
        queryFn: metahubId
            ? (params) => branchesApi.listBranches(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!metahubId
    })

    const { data: branches, isLoading, error } = paginationResult

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const branchMap = useMemo(() => {
        if (!Array.isArray(branches)) return new Map<string, MetahubBranch>()
        return new Map(branches.map((branch) => [branch.id, branch]))
    }, [branches])

    const handlePendingBranchInteraction = useCallback(
        (branchId: string) => {
            if (!metahubId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.branches(metahubId),
                entityId: branchId,
                extraQueryKeys: [metahubsQueryKeys.branchDetail(metahubId, branchId)]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, metahubId, pendingInteractionMessage, queryClient]
    )

    const branchOptionsQuery = useQuery({
        queryKey: metahubId
            ? metahubsQueryKeys.branchesList(metahubId, { limit: 1000, offset: 0, sortBy: 'created', sortOrder: 'asc' })
            : ['empty'],
        queryFn: () =>
            metahubId
                ? branchesApi.listBranches(metahubId, { limit: 1000, offset: 0, sortBy: 'created', sortOrder: 'asc' })
                : Promise.resolve({ items: [], pagination: { limit: 0, offset: 0, count: 0, total: 0, hasMore: false } }),
        enabled: Boolean(metahubId)
    })

    const branchOptions = useMemo(() => {
        const items = branchOptionsQuery.data?.items ?? []
        return items.map((branch) => {
            const name = getVLCString(branch.name, i18n.language) || branch.codename || ''
            return {
                id: branch.id,
                label: name ? `${name} (${branch.codename})` : branch.codename,
                isDefault: branch.isDefault
            }
        })
    }, [branchOptionsQuery.data?.items, i18n.language])

    const sourceOptions = useMemo(() => {
        return [
            {
                id: '',
                label: t('metahubs:branches.sourceEmpty', 'Empty branch'),
                isEmpty: true
            },
            ...branchOptions
        ]
    }, [branchOptions, t])

    const localizedFormDefaults = useMemo<BranchFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            sourceBranchId: '',
            ...normalizeBranchCopyOptions()
        }),
        []
    )

    const getBranchDisplay = useCallback(
        (branch: MetahubBranch): MetahubBranchDisplay => {
            const display = toBranchDisplay(branch, i18n.language)
            return {
                ...display,
                name: display.name || branch.codename || '',
                description: display.description || ''
            }
        },
        [i18n.language]
    )

    return {
        metahubId,
        branches,
        isLoading,
        error,
        paginationResult,
        handleSearchChange,
        branchMap,
        handlePendingBranchInteraction,
        branchOptions,
        sourceOptions,
        localizedFormDefaults,
        getBranchDisplay
    }
}
