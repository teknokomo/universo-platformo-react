import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RuntimeWorkspace } from '@universo-react/apps-template-mui'
import type { TFunction } from 'i18next'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { extractAxiosError, getVLCString } from '@universo-react/utils'

import {
    getApplicationPublicEntryWorkspace,
    getApplicationRuntimeWorkspace,
    listApplicationRuntimeWorkspaces,
    updateApplicationPublicEntryWorkspace
} from '../../api/applications'
import { applicationsQueryKeys } from '../../api/queryKeys'

type PublicEntryWorkspaceSettingsOptions = {
    applicationId?: string
    enabled: boolean
    locale: string
}

const PUBLIC_ENTRY_WORKSPACE_PAGE_SIZE = 100

const publicEntryWorkspaceErrorMessage = (error: unknown, t: TFunction<'applications'>): string => {
    const code = extractAxiosError(error).code

    switch (code) {
        case 'PUBLIC_ENTRY_WORKSPACE_CONFLICT':
            return t('settings.publicEntryWorkspaceConflict')
        case 'PUBLIC_ENTRY_WORKSPACE_NOT_FOUND':
            return t('settings.publicEntryWorkspaceNotFound')
        case 'PUBLIC_ENTRY_WORKSPACE_INVALID':
            return t('settings.publicEntryWorkspaceInvalid')
        case 'APPLICATION_SCHEMA_NOT_CONFIGURED':
        case 'WORKSPACE_SUBSYSTEM_NOT_READY':
        case 'WORKSPACES_DISABLED':
            return t('settings.publicEntryWorkspaceNotReady')
        default:
            return t('settings.publicEntryWorkspaceSaveError')
    }
}

const isSelectablePublicEntryWorkspace = (workspace: RuntimeWorkspace): boolean =>
    workspace.workspaceType !== 'personal' && workspace.personalUserId == null && workspace.status === 'active'

export const usePublicEntryWorkspaceSettings = ({ applicationId, enabled, locale }: PublicEntryWorkspaceSettingsOptions) => {
    const { t } = useTranslation('applications')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null | undefined>(undefined)

    const publicEntryWorkspaceQuery = useQuery({
        queryKey: applicationId
            ? applicationsQueryKeys.publicEntryWorkspace(applicationId)
            : ['applications', 'settings', 'missing', 'public-entry-workspace'],
        queryFn: () => getApplicationPublicEntryWorkspace(applicationId!),
        enabled: Boolean(applicationId) && enabled,
        retry: false
    })

    const runtimeWorkspacesQuery = useInfiniteQuery({
        queryKey: applicationId
            ? [...applicationsQueryKeys.runtimeWorkspaces(applicationId), { limit: PUBLIC_ENTRY_WORKSPACE_PAGE_SIZE }]
            : ['applications', 'settings', 'missing', 'runtime-workspaces'],
        queryFn: ({ pageParam }) =>
            listApplicationRuntimeWorkspaces(applicationId!, {
                limit: PUBLIC_ENTRY_WORKSPACE_PAGE_SIZE,
                offset: pageParam
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const loadedCount = lastPage.offset + lastPage.items.length
            return loadedCount < lastPage.total ? loadedCount : undefined
        },
        enabled: Boolean(applicationId) && enabled,
        retry: false
    })

    const configuredWorkspaceId = publicEntryWorkspaceQuery.data?.workspaceId ?? null
    const loadedWorkspaces = useMemo(
        () => (runtimeWorkspacesQuery.data?.pages ?? []).flatMap((page) => page.items),
        [runtimeWorkspacesQuery.data?.pages]
    )
    const selectableLoadedWorkspaces = useMemo(() => loadedWorkspaces.filter(isSelectablePublicEntryWorkspace), [loadedWorkspaces])

    // The selector is a bounded page of a server-paginated list. The configured
    // workspace may sit on a later page, so it is resolved individually to keep
    // the current selection visible instead of rendering an empty value.
    const configuredWorkspaceOutsideOptions = Boolean(
        configuredWorkspaceId && !selectableLoadedWorkspaces.some((workspace) => workspace.id === configuredWorkspaceId)
    )
    const configuredWorkspaceQuery = useQuery({
        queryKey: applicationId
            ? [...applicationsQueryKeys.runtimeWorkspaces(applicationId), 'detail', configuredWorkspaceId]
            : ['applications', 'settings', 'missing', 'runtime-workspace-detail'],
        queryFn: () => {
            if (!applicationId || !configuredWorkspaceId) {
                throw new Error('Public entry workspace reference is not available')
            }
            return getApplicationRuntimeWorkspace(applicationId, configuredWorkspaceId)
        },
        enabled: Boolean(applicationId) && enabled && configuredWorkspaceOutsideOptions,
        retry: false
    })

    const publicEntryWorkspaceMutation = useMutation({
        mutationKey: ['applications', 'settings', 'public-entry-workspace', 'update'],
        mutationFn: (workspaceId: string | null) => updateApplicationPublicEntryWorkspace(applicationId!, workspaceId),
        onSuccess: async (saved) => {
            if (!applicationId) return
            setSelectedWorkspaceId(undefined)
            queryClient.setQueryData(applicationsQueryKeys.publicEntryWorkspace(applicationId), saved)
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.publicEntryWorkspace(applicationId) })
            enqueueSnackbar(t('settings.publicEntryWorkspaceSaved'), { variant: 'success' })
        },
        onError: (error) => {
            setSelectedWorkspaceId(undefined)
            enqueueSnackbar(publicEntryWorkspaceErrorMessage(error, t), { variant: 'error' })
        }
    })

    useEffect(() => {
        setSelectedWorkspaceId(undefined)
    }, [applicationId, enabled])

    const workspaceOptions = useMemo(() => {
        const optionsById = new Map<string, RuntimeWorkspace>()
        for (const workspace of selectableLoadedWorkspaces) {
            optionsById.set(workspace.id, workspace)
        }

        const configuredWorkspace = configuredWorkspaceQuery.data
        if (configuredWorkspace && !optionsById.has(configuredWorkspace.id)) {
            optionsById.set(configuredWorkspace.id, configuredWorkspace)
        }

        return [...optionsById.values()].map((workspace) => ({
            id: workspace.id,
            label:
                getVLCString(workspace.name as Parameters<typeof getVLCString>[0], locale) ||
                getVLCString(workspace.name as Parameters<typeof getVLCString>[0], 'en') ||
                t('settings.unnamedWorkspace')
        }))
    }, [configuredWorkspaceQuery.data, locale, selectableLoadedWorkspaces, t])

    const retry = async () => {
        await Promise.allSettled([
            publicEntryWorkspaceQuery.refetch(),
            runtimeWorkspacesQuery.refetch(),
            // `refetch()` ignores `enabled`; only touch the selected-workspace
            // lookup when it currently holds a resolvable reference.
            ...(configuredWorkspaceOutsideOptions ? [configuredWorkspaceQuery.refetch()] : [])
        ])
    }

    const loadMore = () => {
        if (!enabled || !runtimeWorkspacesQuery.hasNextPage || runtimeWorkspacesQuery.isFetchingNextPage) return
        void runtimeWorkspacesQuery.fetchNextPage()
    }

    const onChange = (workspaceId: string | null) => {
        if (!enabled || !applicationId || publicEntryWorkspaceMutation.isPending) return
        setSelectedWorkspaceId(workspaceId)
        publicEntryWorkspaceMutation.mutate(workspaceId)
    }

    return {
        workspaceId: enabled ? (selectedWorkspaceId !== undefined ? selectedWorkspaceId : configuredWorkspaceId) : undefined,
        workspaceOptions,
        isLoading:
            enabled && (publicEntryWorkspaceQuery.isLoading || runtimeWorkspacesQuery.isLoading || configuredWorkspaceQuery.isLoading),
        isError: enabled && (publicEntryWorkspaceQuery.isError || runtimeWorkspacesQuery.isError),
        isSaving: publicEntryWorkspaceMutation.isPending,
        hasMore: enabled && Boolean(runtimeWorkspacesQuery.hasNextPage),
        isLoadingMore: enabled && runtimeWorkspacesQuery.isFetchingNextPage,
        loadMore,
        retry,
        onChange
    }
}
