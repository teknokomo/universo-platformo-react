import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRuntimeWorkspaceSettings, type RuntimeWorkspaceSettingsResponse } from '../../../../api/workspaces'
import type { InterpretationNetworkCellStylePolicy } from '@universo-react/types'
import type { DashboardDetailsSlot } from '../../../contracts'

type UseInterpretationNetworkWorkspaceSettingsOptions = {
    details: DashboardDetailsSlot | null | undefined
    instanceKey: string
    locale: string
    applicationCellStylePolicy: InterpretationNetworkCellStylePolicy
}

const LOCKED_CELL_STYLE_POLICY: InterpretationNetworkCellStylePolicy = {
    allowedColors: [],
    allowCustomColors: false,
    editable: { fillColor: false, textColor: false, borderColor: false, borderWidth: false, borderStyle: false }
}

export function useInterpretationNetworkWorkspaceSettings({
    details,
    instanceKey,
    locale,
    applicationCellStylePolicy
}: UseInterpretationNetworkWorkspaceSettingsOptions) {
    const enabled =
        details?.runtimeAccessMode === 'member' &&
        details.workspacesEnabled === true &&
        Boolean(details.apiBaseUrl && details.applicationId && details.currentWorkspaceId)

    const query = useQuery<RuntimeWorkspaceSettingsResponse>({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'interpretationNetworkWorkspaceSettings',
            details?.applicationId,
            details?.currentWorkspaceId,
            details?.runtimeLayoutTarget?.targetKind,
            details?.runtimeLayoutTarget?.entityTypeId,
            locale
        ],
        enabled,
        queryFn: () =>
            fetchRuntimeWorkspaceSettings({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details!.currentWorkspaceId!,
                targetKind: details?.runtimeLayoutTarget?.targetKind,
                entityTypeId: details?.runtimeLayoutTarget?.entityTypeId,
                locale
            })
    })

    const effectiveWidgetConfig = query.data?.effectiveWidgetConfigs.find(
        (entry) =>
            entry.target.kind === 'widget' &&
            entry.target.instanceKey === instanceKey &&
            entry.widgetKey === 'interpretationNetworkWorkspace'
    )
    const effectiveCellStylePolicy = useMemo(
        () => (enabled ? effectiveWidgetConfig?.cellStylePolicy ?? LOCKED_CELL_STYLE_POLICY : applicationCellStylePolicy),
        [applicationCellStylePolicy, effectiveWidgetConfig?.cellStylePolicy, enabled]
    )

    return { effectiveCellStylePolicy }
}
