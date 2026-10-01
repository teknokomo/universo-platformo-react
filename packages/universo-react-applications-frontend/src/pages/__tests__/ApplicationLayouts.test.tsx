import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { applicationsQueryKeys } from '../../api/queryKeys'
import { STORAGE_KEYS } from '../../constants/storage'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
    apiMocks,
    initializeApplicationLayouts,
    renderPage,
    resetApplicationLayoutsMocks,
    snackbarMocks
} from './ApplicationLayouts.test-support'

describe('ApplicationLayouts', () => {
    beforeAll(initializeApplicationLayouts, 30_000)
    beforeEach(resetApplicationLayoutsMocks)

    it('renders all supported zones and moves a widget to another zone', async () => {
        const user = userEvent.setup()
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Homepage')).toBeInTheDocument()
        })

        expect(screen.getByText('Top')).toBeInTheDocument()
        expect(screen.getByText('Left')).toBeInTheDocument()
        expect(screen.getByText('Center')).toBeInTheDocument()
        expect(screen.getByText('Right')).toBeInTheDocument()
        expect(screen.getByText('Bottom')).toBeInTheDocument()
        expect(screen.getByText('Menu: Training')).toBeInTheDocument()
        expect(screen.getByText('Overview cards')).toBeInTheDocument()
        expect(screen.getByText('Customized in application')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Back to applications' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'add-Workspace switcher' })).toBeInTheDocument()

        expect(screen.queryByRole('button', { name: 'layout-widget-move-widget-center-1-top' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'layout-widget-move-widget-divider-1-top' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'move-widget-divider-to-top' }))

        await waitFor(() => {
            expect(apiMocks.moveApplicationLayoutWidget).toHaveBeenCalledWith('app-1', 'layout-1', {
                widgetId: 'widget-divider-1',
                targetZone: 'top',
                targetIndex: 1,
                expectedVersion: 1
            })
        })
    })

    it('labels dashboard widgets inherited from a metahub layout instead of hiding their provenance', async () => {
        const metahubLayout = {
            id: 'layout-1',
            scopeId: 'global',
            scopeKind: 'global',
            scopeEntityId: null,
            templateKey: 'dashboard',
            name: { en: 'Homepage' },
            description: null,
            config: {},
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            sourceKind: 'metahub',
            sourceLayoutId: 'source-layout-1',
            sourceSnapshotHash: null,
            sourceContentHash: null,
            localContentHash: null,
            syncState: 'clean',
            isSourceExcluded: false,
            version: 1
        }
        apiMocks.listApplicationLayouts.mockResolvedValue({
            items: [metahubLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValue({
            item: metahubLayout,
            widgets: [
                {
                    id: 'widget-inherited-dashboard',
                    layoutId: 'layout-1',
                    zone: 'top',
                    widgetKey: 'overviewCards',
                    sortOrder: 0,
                    config: {},
                    sourceConfig: null,
                    sourceWidgetId: null,
                    sourceBaseWidgetId: null,
                    isCustomized: false,
                    isActive: true,
                    version: 1
                },
                {
                    id: 'widget-customized-dashboard',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'notes',
                    sortOrder: 0,
                    config: {},
                    sourceConfig: { text: 'custom' },
                    isCustomized: true,
                    isActive: true,
                    version: 2
                }
            ]
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Homepage')).toBeInTheDocument())
        expect(screen.getByText('Inherited from metahub')).toBeInTheDocument()
        expect(screen.getByText('Customized in application')).toBeInTheDocument()
    })

    it('does not label application-authored widgets whose lineage columns are null', async () => {
        apiMocks.getApplicationLayout.mockResolvedValue({
            item: {
                id: 'layout-1',
                scopeId: 'global',
                scopeKind: 'global',
                scopeEntityId: null,
                templateKey: 'dashboard',
                name: { en: 'Homepage' },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                sourceKind: 'application',
                sourceLayoutId: null,
                sourceSnapshotHash: null,
                sourceContentHash: null,
                localContentHash: null,
                syncState: 'clean',
                isSourceExcluded: false,
                version: 1
            },
            widgets: [
                {
                    id: 'widget-app-authored',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'overviewCards',
                    sortOrder: 0,
                    config: {},
                    sourceConfig: null,
                    sourceWidgetId: null,
                    sourceBaseWidgetId: null,
                    isCustomized: false,
                    isActive: true,
                    version: 1
                }
            ]
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Homepage')).toBeInTheDocument())
        expect(screen.queryByText('Inherited from metahub')).not.toBeInTheDocument()
        expect(screen.queryByText('Customized in application')).not.toBeInTheDocument()
    })

    it('renders application layouts in list view when the preference is stored', async () => {
        localStorage.setItem(STORAGE_KEYS.LAYOUT_DISPLAY_STYLE, 'list')
        renderPage('/a/app-1/admin/layouts')

        await waitFor(() => {
            expect(screen.getByTestId('flow-list-table')).toBeInTheDocument()
        })

        expect(screen.getByText('Homepage')).toBeInTheDocument()
        expect(screen.getByText('Application')).toBeInTheDocument()
        expect(screen.getByText('Clean')).toBeInTheDocument()
    })

    it('does not expose raw source layout ids in the details alert', async () => {
        const sourceLayoutId = '018f7b63-8e46-7cc2-8eb8-1f48b5087b7b'
        apiMocks.getApplicationLayout.mockResolvedValueOnce({
            item: {
                id: 'layout-1',
                scopeId: 'global',
                scopeKind: 'global',
                scopeEntityId: null,
                templateKey: 'dashboard',
                name: { en: 'Homepage' },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                sourceKind: 'metahub',
                sourceLayoutId,
                sourceSnapshotHash: null,
                sourceContentHash: null,
                localContentHash: null,
                syncState: 'source_updated',
                isSourceExcluded: false,
                version: 1
            },
            widgets: []
        })

        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Linked to source layout')).toBeInTheDocument()
        })
        expect(screen.queryByText(sourceLayoutId)).not.toBeInTheDocument()
        expect(screen.queryByText(/Source layout id/i)).not.toBeInTheDocument()
    })

    it('rolls back optimistic widget config updates when the save mutation fails', async () => {
        const user = userEvent.setup()
        apiMocks.updateApplicationLayoutWidgetConfig.mockRejectedValueOnce(new Error('save failed'))
        const { queryClient } = renderPage()

        await waitFor(() => {
            expect(screen.getByText('Homepage')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', { name: 'Overview cards' }))
        await user.type(screen.getByLabelText('Card title 1'), 'Optimistic card')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(apiMocks.updateApplicationLayoutWidgetConfig).toHaveBeenCalled()
        })
        await waitFor(() => {
            const cached = queryClient.getQueryData<any>(applicationsQueryKeys.layoutDetail('app-1', 'layout-1'))
            const widget = cached?.widgets?.find((item: any) => item.id === 'widget-top-1')
            expect(widget?.config).toEqual({})
        })
    }, 30_000)

    it('opens a typed Matrix editor for interpretation network widgets and saves without raw JSON editing', async () => {
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Homepage')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Interpretation network workspace' }))

        expect(screen.getByRole('heading', { name: 'Interpretation network workspace' })).toBeInTheDocument()
        expect(screen.getByTestId('application-layout-widget-customization-state')).toHaveTextContent('Customized in application')
        expect(screen.getAllByText('Matrix mode').length).toBeGreaterThan(0)
        expect(screen.queryByText('Widget configuration must be valid JSON.')).not.toBeInTheDocument()
        expect(screen.queryByDisplayValue(/\{/)).not.toBeInTheDocument()
        expect(within(screen.getByTestId('standard-dialog-actions')).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
        expect(within(screen.getByTestId('standard-dialog-actions')).getByRole('button', { name: 'Save' })).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1)
        expect(screen.getByTestId('application-settings-matrix-reset')).toHaveTextContent('Restore metahub settings')

        fireEvent.click(within(screen.getByTestId('application-setting-matrix-resizable-panes')).getByRole('switch'))
        await waitFor(() => {
            expect(screen.getByTestId('application-settings-matrix-save')).toBeEnabled()
        })
        fireEvent.click(screen.getByTestId('application-settings-matrix-save'))

        await waitFor(() => {
            expect(apiMocks.updateApplicationLayoutWidgetConfig).toHaveBeenCalledWith('app-1', 'layout-1', 'widget-matrix-1', {
                expectedVersion: 2,
                config: expect.objectContaining({
                    matrixMode: 'hierarchicalCells',
                    defaultMatrixView: 'table',
                    splitPane: { enabled: false }
                })
            })
        })
    }, 30_000)

    it('restores the current metahub config from the typed Matrix layout editor', async () => {
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Homepage')).toBeInTheDocument()
        })
        fireEvent.click(screen.getByRole('button', { name: 'Interpretation network workspace' }))
        fireEvent.click(screen.getByTestId('application-settings-matrix-reset'))

        await waitFor(() => {
            expect(apiMocks.resetApplicationLayoutWidgetConfigsBatch).toHaveBeenCalledWith('app-1', {
                updates: [{ layoutId: 'layout-1', widgetId: 'widget-matrix-1', expectedVersion: 2 }]
            })
        })
        expect(screen.queryByRole('dialog', { name: 'Interpretation network workspace' })).not.toBeInTheDocument()
    })

    it('keeps the Matrix editor open and reports incomplete metadata when reset is unsafe', async () => {
        apiMocks.resetApplicationLayoutWidgetConfigsBatch.mockRejectedValueOnce({
            isAxiosError: true,
            response: {
                status: 409,
                data: {
                    error: 'APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING',
                    code: 'APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING'
                }
            }
        })
        renderPage()

        await waitFor(() => expect(screen.getByText('Homepage')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Interpretation network workspace' }))
        fireEvent.click(screen.getByTestId('application-settings-matrix-reset'))

        await waitFor(() => {
            expect(snackbarMocks.enqueueSnackbar).toHaveBeenCalledWith(
                'Single-system mode cannot be enabled because the Structure metadata is incomplete.',
                { variant: 'error' }
            )
        })
        expect(screen.getByRole('dialog', { name: 'Interpretation network workspace' })).toBeInTheDocument()
    })

    it('keeps the Matrix editor open and reports a stale reset conflict', async () => {
        apiMocks.resetApplicationLayoutWidgetConfigsBatch.mockRejectedValueOnce({
            isAxiosError: true,
            response: {
                status: 409,
                data: { error: 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT' }
            }
        })
        renderPage()

        await waitFor(() => expect(screen.getByText('Homepage')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Interpretation network workspace' }))
        fireEvent.click(screen.getByTestId('application-settings-matrix-reset'))

        await waitFor(() => {
            expect(snackbarMocks.enqueueSnackbar).toHaveBeenCalledWith(
                'Matrix settings changed while you were editing. Reload the current values and try again.',
                { variant: 'error' }
            )
        })
        expect(screen.getByRole('dialog', { name: 'Interpretation network workspace' })).toBeInTheDocument()
    })

    it('keeps the Matrix editor open and shows a localized transition error until a retry succeeds', async () => {
        apiMocks.updateApplicationLayoutWidgetConfig.mockRejectedValueOnce({
            isAxiosError: true,
            response: {
                status: 409,
                data: {
                    error: 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST',
                    code: 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
                }
            }
        })
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Homepage')).toBeInTheDocument()
        })
        fireEvent.click(screen.getByRole('button', { name: 'Interpretation network workspace' }))
        fireEvent.click(within(screen.getByTestId('application-setting-matrix-resizable-panes')).getByRole('switch'))
        fireEvent.click(screen.getByTestId('application-settings-matrix-save'))

        await waitFor(() => {
            expect(snackbarMocks.enqueueSnackbar).toHaveBeenCalledWith(
                'Single-system mode cannot be enabled while ordinary Structures exist. Delete them first.',
                { variant: 'error' }
            )
        })
        expect(screen.getByRole('dialog', { name: 'Interpretation network workspace' })).toBeInTheDocument()

        apiMocks.updateApplicationLayoutWidgetConfig.mockResolvedValueOnce({})
        fireEvent.click(screen.getByTestId('application-settings-matrix-save'))

        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Interpretation network workspace' })).not.toBeInTheDocument()
        })
        expect(apiMocks.updateApplicationLayoutWidgetConfig).toHaveBeenCalledTimes(2)
    }, 30_000)

    it('opens workspace switcher editor as an explicit read-only dialog instead of a no-op', async () => {
        const user = userEvent.setup()
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Homepage')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', { name: 'Workspace switcher' }))

        expect(screen.getByRole('dialog', { name: 'Workspace switcher' })).toBeInTheDocument()
        expect(
            screen.getByText(
                'The workspace switcher uses the published application workspace state and has no widget-specific settings yet.'
            )
        ).toBeInTheDocument()
        expect(screen.queryByDisplayValue(/\{/)).not.toBeInTheDocument()
    })
})
