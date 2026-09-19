import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { extractAxiosError, getVLCString } from '@universo-react/utils'

import {
    getApplicationPublicEntryWorkspace,
    listApplicationRuntimeWorkspaces,
    updateApplicationPublicEntryWorkspace
} from '../../api/applications'
import { applicationsQueryKeys } from '../../api/queryKeys'

type PublicEntryWorkspaceSettingsOptions = {
    applicationId?: string
    enabled: boolean
    locale: string
}

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

    const runtimeWorkspacesQuery = useQuery({
        queryKey: applicationId
            ? applicationsQueryKeys.runtimeWorkspaces(applicationId)
            : ['applications', 'settings', 'missing', 'runtime-workspaces'],
        queryFn: () => listApplicationRuntimeWorkspaces(applicationId!, { limit: 100, offset: 0 }),
        enabled: Boolean(applicationId) && enabled,
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

    const workspaceOptions = useMemo(
        () =>
            (runtimeWorkspacesQuery.data?.items ?? [])
                .filter(
                    (workspace) =>
                        workspace.workspaceType !== 'personal' && workspace.personalUserId == null && workspace.status === 'active'
                )
                .map((workspace) => ({
                    id: workspace.id,
                    label:
                        getVLCString(workspace.name as Parameters<typeof getVLCString>[0], locale) ||
                        getVLCString(workspace.name as Parameters<typeof getVLCString>[0], 'en') ||
                        t('settings.unnamedWorkspace')
                })),
        [locale, runtimeWorkspacesQuery.data?.items, t]
    )

    const retry = async () => {
        await Promise.allSettled([publicEntryWorkspaceQuery.refetch(), runtimeWorkspacesQuery.refetch()])
    }

    const onChange = (workspaceId: string | null) => {
        if (!enabled || !applicationId || publicEntryWorkspaceMutation.isPending) return
        setSelectedWorkspaceId(workspaceId)
        publicEntryWorkspaceMutation.mutate(workspaceId)
    }

    return {
        workspaceId: enabled
            ? selectedWorkspaceId !== undefined
                ? selectedWorkspaceId
                : publicEntryWorkspaceQuery.data?.workspaceId ?? null
            : undefined,
        workspaceOptions,
        isLoading: enabled && (publicEntryWorkspaceQuery.isLoading || runtimeWorkspacesQuery.isLoading),
        isError: enabled && (publicEntryWorkspaceQuery.isError || runtimeWorkspacesQuery.isError),
        isSaving: publicEntryWorkspaceMutation.isPending,
        retry,
        onChange
    }
}
