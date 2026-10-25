import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    fetchRuntimeWorkspaceSettings,
    updateRuntimeWorkspaceSettings,
    type RuntimeWorkspaceSetting,
    type RuntimeWorkspaceWidgetSetting
} from '../api/workspaces'
import { appQueryKeys, workspaceQueryKeys } from '../api/mutations'
import { useDashboardDetails } from '../dashboard/DashboardDetailsContext'

type SettingEntry = RuntimeWorkspaceSetting | RuntimeWorkspaceWidgetSetting

type SettingsMutation = { setting: SettingEntry; value: unknown } | { reset: SettingEntry }

interface UseRuntimeWorkspaceSettingsOptions {
    applicationId: string
    apiBaseUrl: string
    workspaceId: string | null
    enabled: boolean
    onMutationStart: () => void
    onMutationError: (error: Error) => void
}

/** Loads and updates the effective settings for the active runtime workspace. */
export function useRuntimeWorkspaceSettings({
    applicationId,
    apiBaseUrl,
    workspaceId,
    enabled,
    onMutationStart,
    onMutationError
}: UseRuntimeWorkspaceSettingsOptions) {
    const queryClient = useQueryClient()
    const runtimeLayoutTarget = useDashboardDetails()?.runtimeLayoutTarget
    const settingsQuery = useQuery({
        queryKey: workspaceId
            ? workspaceQueryKeys.settings(applicationId, workspaceId, runtimeLayoutTarget)
            : ['runtime-workspace-settings', applicationId, 'none'],
        enabled: Boolean(workspaceId) && enabled,
        queryFn: () =>
            fetchRuntimeWorkspaceSettings({
                apiBaseUrl,
                applicationId,
                workspaceId: workspaceId!,
                targetKind: runtimeLayoutTarget?.targetKind,
                entityTypeId: runtimeLayoutTarget?.entityTypeId
            })
    })

    const settingsMutation = useMutation({
        mutationFn: (input: SettingsMutation) =>
            updateRuntimeWorkspaceSettings({
                apiBaseUrl,
                applicationId,
                workspaceId: workspaceId!,
                targetKind: runtimeLayoutTarget?.targetKind,
                entityTypeId: runtimeLayoutTarget?.entityTypeId,
                settings:
                    'setting' in input
                        ? [
                              {
                                  key: input.setting.key,
                                  target: input.setting.target,
                                  value: input.value,
                                  ...(input.setting.version ? { expectedVersion: input.setting.version } : {})
                              }
                          ]
                        : [],
                resets:
                    'reset' in input
                        ? [
                              {
                                  key: input.reset.key,
                                  target: input.reset.target,
                                  ...(input.reset.version ? { expectedVersion: input.reset.version } : {})
                              }
                          ]
                        : []
            }),
        onMutate: onMutationStart,
        onSuccess: async (data) => {
            if (workspaceId) {
                queryClient.setQueryData(workspaceQueryKeys.settings(applicationId, workspaceId, runtimeLayoutTarget), data)
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['runtime', applicationId] }),
                queryClient.invalidateQueries({ queryKey: appQueryKeys.list(applicationId) })
            ])
        },
        onError: onMutationError
    })

    return {
        query: settingsQuery,
        isPending: settingsMutation.isPending,
        updateSetting: (setting: SettingEntry, value: unknown) => settingsMutation.mutate({ setting, value }),
        resetSetting: (setting: SettingEntry) => settingsMutation.mutate({ reset: setting })
    }
}
