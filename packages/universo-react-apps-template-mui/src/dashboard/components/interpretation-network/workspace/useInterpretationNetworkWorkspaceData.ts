import { useQuery } from '@tanstack/react-query'
import { fetchAppData } from '../../../../api/api'
import type { DashboardDetailsSlot } from '../../../contracts'
import type { toConfig } from '../model'
import { fetchAllWorkspaceData, fetchSingleWorkspaceRowData } from './workspaceRuntime'

type UseInterpretationNetworkWorkspaceDataOptions = {
    details: DashboardDetailsSlot | null | undefined
    locale: string
    widgetConfig: ReturnType<typeof toConfig>
    widgetId?: string
    layoutId?: string
}

export function useInterpretationNetworkWorkspaceData({
    details,
    locale,
    widgetConfig,
    widgetId,
    layoutId
}: UseInterpretationNetworkWorkspaceDataOptions) {
    const singleSystemMode = widgetConfig.structureMode === 'singleSystem'
    const enabled = Boolean(details?.apiBaseUrl && details.applicationId)

    return useQuery({
        queryKey: ['interpretationNetworkWorkspace', details?.applicationId, details?.currentWorkspaceId, locale, widgetConfig],
        enabled,
        queryFn: async () => {
            const base = {
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details?.currentWorkspaceId,
                locale,
                widgetId,
                layoutId
            }
            if (singleSystemMode) {
                const concepts = await fetchSingleWorkspaceRowData(
                    fetchAppData,
                    { ...base, objectCollectionCodename: widgetConfig.conceptCodename },
                    [{ field: 'SystemKey', operator: 'equals', value: 'primary' }]
                )
                const systemStructureId = concepts.rows[0]?.id
                const [interpretations, materials] = await Promise.all([
                    fetchSingleWorkspaceRowData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.interpretationCodename }, [
                        {
                            field: widgetConfig.interpretationParentField,
                            operator: 'equals',
                            value: systemStructureId ?? '00000000-0000-0000-0000-000000000000'
                        }
                    ]),
                    fetchAllWorkspaceData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.materialCodename })
                ])
                return { concepts, interpretations, materials }
            }

            const [concepts, interpretations, materials] = await Promise.all([
                fetchAllWorkspaceData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.conceptCodename }),
                fetchAllWorkspaceData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.interpretationCodename }),
                fetchAllWorkspaceData(fetchAppData, { ...base, objectCollectionCodename: widgetConfig.materialCodename })
            ])
            return { concepts, interpretations, materials }
        }
    })
}
