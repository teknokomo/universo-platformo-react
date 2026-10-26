import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InterpretationNetworkCellStylePolicy } from '@universo-react/types'
import type { RuntimeWorkspaceSettingsResponse } from '../../../../../api/workspaces'
import type { DashboardDetailsSlot } from '../../../../contracts'
import { useInterpretationNetworkWorkspaceSettings } from '../useInterpretationNetworkWorkspaceSettings'

const { fetchRuntimeWorkspaceSettings } = vi.hoisted(() => ({ fetchRuntimeWorkspaceSettings: vi.fn() }))

vi.mock('../../../../../api/workspaces', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../../api/workspaces')>()),
    fetchRuntimeWorkspaceSettings
}))

const policy = (fillColor: boolean): InterpretationNetworkCellStylePolicy => ({
    allowedColors: ['#ffffff'],
    allowCustomColors: false,
    editable: { fillColor, textColor: false, borderColor: false, borderWidth: false, borderStyle: false }
})

const response = {
    items: [],
    widgetSettings: [],
    effectiveWidgetConfigs: [
        {
            target: { kind: 'widget', instanceKey: 'matrix-main' },
            widgetKey: 'interpretationNetworkWorkspace',
            zone: 'center',
            semanticRegion: 'main',
            config: {},
            cellStylePolicy: policy(true),
            layoutToken: 'layout-token'
        },
        {
            target: { kind: 'widget', instanceKey: 'matrix-sidebar' },
            widgetKey: 'interpretationNetworkWorkspace',
            zone: 'right',
            semanticRegion: 'sidebar',
            config: {},
            cellStylePolicy: policy(false),
            layoutToken: 'layout-token'
        }
    ],
    layoutToken: 'layout-token',
    canManage: false
} satisfies RuntimeWorkspaceSettingsResponse

describe('useInterpretationNetworkWorkspaceSettings', () => {
    beforeEach(() => {
        fetchRuntimeWorkspaceSettings.mockReset().mockResolvedValue(response)
    })

    it('shares the layout settings snapshot across widget placements', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const details: DashboardDetailsSlot = {
            title: 'Application',
            applicationId: 'application-id',
            apiBaseUrl: '/api/v1',
            currentWorkspaceId: 'workspace-id',
            runtimeAccessMode: 'member',
            workspacesEnabled: true,
            runtimeQueryKeyPrefix: ['runtime']
        }
        const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

        const { result } = renderHook(
            () => ({
                main: useInterpretationNetworkWorkspaceSettings({
                    details,
                    instanceKey: 'matrix-main',
                    locale: 'en',
                    applicationCellStylePolicy: policy(false)
                }),
                sidebar: useInterpretationNetworkWorkspaceSettings({
                    details,
                    instanceKey: 'matrix-sidebar',
                    locale: 'en',
                    applicationCellStylePolicy: policy(false)
                })
            }),
            { wrapper }
        )

        await waitFor(() => expect(fetchRuntimeWorkspaceSettings).toHaveBeenCalledTimes(1))
        await waitFor(() => {
            expect(result.current.main.effectiveCellStylePolicy.editable.fillColor).toBe(true)
            expect(result.current.sidebar.effectiveCellStylePolicy.editable.fillColor).toBe(false)
        })
    })
})
