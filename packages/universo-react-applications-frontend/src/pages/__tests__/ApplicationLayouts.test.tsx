import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { applicationsQueryKeys } from '../../api/queryKeys'
import { STORAGE_KEYS } from '../../constants/storage'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
    apiMocks,
    initializeApplicationLayouts,
    localeMocks,
    renderPage,
    resetApplicationLayoutsMocks,
    snackbarMocks
} from './ApplicationLayouts.test-support'

const createSourceDashboardLayout = (syncState: 'clean' | 'conflict' | 'source_removed' = 'clean') => ({
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
    syncState,
    isSourceExcluded: false,
    version: 1
})

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
        expect(screen.getByText('Menu')).toBeInTheDocument()
        expect(screen.getByText('Overview cards')).toBeInTheDocument()
        expect(screen.getByText('Customized in application')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Back to applications' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'add-Workspace switcher' })).not.toBeInTheDocument()

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

    it.each(['en', 'ru'] as const)('keeps local Application placements editable in %s', async (language) => {
        localeMocks.language = language
        renderPage()

        await waitFor(() => expect(screen.getByTestId('layout-authoring-details')).toBeInTheDocument())
        expect(screen.getByTestId('layout-widget-edit-widget-top-1')).toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-duplicate-widget-top-1')).not.toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-remove-widget-top-1')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-toggle-widget-top-1')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-drag-widget-top-1')).toBeInTheDocument()
    })

    it('labels dashboard widgets inherited from a metahub layout and exposes registry-authorized actions', async () => {
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
                    zone: 'center',
                    widgetKey: 'overviewCards',
                    instanceKey: 'overview-cards-inherited',
                    parentWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a3',
                    slotKey: 'columns:primary',
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
                },
                {
                    id: 'widget-inherited-dashboard-root',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'overviewCards',
                    instanceKey: 'overview-cards-root',
                    parentWidgetId: null,
                    slotKey: null,
                    sortOrder: 1,
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
        expect(screen.getAllByText('Inherited from metahub')).toHaveLength(2)
        expect(screen.getByText('Customized in application')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-edit-widget-inherited-dashboard')).toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-duplicate-widget-inherited-dashboard')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-remove-widget-inherited-dashboard')).not.toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-toggle-widget-inherited-dashboard')).toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-drag-widget-inherited-dashboard')).not.toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-edit-widget-inherited-dashboard-root')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-toggle-widget-inherited-dashboard-root')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-drag-widget-inherited-dashboard-root')).toBeInTheDocument()
        expect(document.querySelectorAll('[data-testid^="layout-widget-move-widget-inherited-dashboard-"]')).toHaveLength(0)
        expect(screen.queryByText('018f8a78-7b8f-7c1d-a111-2222333344a3')).not.toBeInTheDocument()
    })

    it.each(['en', 'ru'] as const)(
        'uses registry presentation and root overrides for source-managed Dashboard widgets in %s',
        async (language) => {
            localeMocks.language = language
            const user = userEvent.setup()
            const sourceLayout = createSourceDashboardLayout()
            const firstConfig = {
                maxCards: 4,
                density: 'compact'
            }
            apiMocks.getApplicationLayout.mockResolvedValue({
                item: sourceLayout,
                widgets: [
                    {
                        id: 'widget-source-dashboard-first',
                        layoutId: 'layout-1',
                        zone: 'center',
                        widgetKey: 'overviewCards',
                        instanceKey: 'dashboard-overview-main',
                        parentWidgetId: null,
                        slotKey: null,
                        sortOrder: 0,
                        config: firstConfig,
                        sourceConfig: { ...firstConfig },
                        sourceWidgetId: 'source-dashboard-first',
                        sourceBaseWidgetId: 'source-dashboard-first',
                        isCustomized: true,
                        isActive: true,
                        version: 4
                    },
                    {
                        id: 'widget-source-dashboard-second',
                        layoutId: 'layout-1',
                        zone: 'center',
                        widgetKey: 'overviewCards',
                        instanceKey: 'dashboard-overview-secondary',
                        parentWidgetId: null,
                        slotKey: null,
                        sortOrder: 1,
                        config: { maxCards: 5, density: 'standard' },
                        sourceConfig: { maxCards: 5, density: 'standard' },
                        sourceWidgetId: 'source-dashboard-second',
                        sourceBaseWidgetId: 'source-dashboard-second',
                        isCustomized: false,
                        isActive: true,
                        version: 2
                    }
                ]
            })
            apiMocks.updateApplicationLayoutWidgetConfig.mockResolvedValueOnce({})
            apiMocks.toggleApplicationLayoutWidget.mockResolvedValueOnce({})
            apiMocks.moveApplicationLayoutWidget.mockResolvedValueOnce({})
            apiMocks.resetApplicationLayoutWidgetConfigsBatch.mockResolvedValueOnce({})

            renderPage()

            const firstWidgetId = 'widget-source-dashboard-first'
            expect(await screen.findByTestId(`layout-widget-edit-${firstWidgetId}`)).toBeInTheDocument()
            expect(screen.getByTestId(`layout-widget-toggle-${firstWidgetId}`)).toBeInTheDocument()
            expect(screen.getByTestId(`layout-widget-drag-${firstWidgetId}`)).toBeInTheDocument()
            expect(screen.getByTestId(`layout-widget-reset-${firstWidgetId}`)).toBeInTheDocument()
            expect(screen.queryByTestId(`layout-widget-duplicate-${firstWidgetId}`)).not.toBeInTheDocument()
            expect(screen.queryByTestId(`layout-widget-remove-${firstWidgetId}`)).not.toBeInTheDocument()
            expect(document.querySelectorAll(`[data-testid^="layout-widget-move-${firstWidgetId}-"]`)).toHaveLength(0)

            await user.click(screen.getByTestId(`layout-widget-edit-${firstWidgetId}`))
            const editor = screen.getByTestId('layout-widget-presentation-dialog-mock')
            expect(editor).toHaveAttribute('data-widget-key', 'overviewCards')
            expect(editor).toHaveAttribute('data-renderer-config-has-instance-key', 'false')
            await user.click(screen.getByRole('button', { name: 'save-widget-presentation' }))
            await waitFor(() => {
                expect(apiMocks.updateApplicationLayoutWidgetConfig).toHaveBeenCalledWith('app-1', 'layout-1', firstWidgetId, {
                    expectedVersion: 4,
                    config: { maxCards: 6, density: 'comfortable' }
                })
            })

            await user.click(screen.getByTestId(`layout-widget-toggle-${firstWidgetId}`))
            await waitFor(() => {
                expect(apiMocks.toggleApplicationLayoutWidget).toHaveBeenCalledWith('app-1', 'layout-1', firstWidgetId, {
                    isActive: false,
                    expectedVersion: 4
                })
            })

            await user.click(screen.getByTestId(`layout-widget-drag-${firstWidgetId}`))
            await waitFor(() => {
                expect(apiMocks.moveApplicationLayoutWidget).toHaveBeenCalledWith('app-1', 'layout-1', {
                    widgetId: firstWidgetId,
                    targetZone: 'center',
                    targetIndex: 1,
                    targetPlacement: undefined,
                    expectedVersion: 4
                })
            })

            await user.click(screen.getByTestId(`layout-widget-reset-${firstWidgetId}`))
            await waitFor(() => {
                expect(apiMocks.resetApplicationLayoutWidgetConfigsBatch).toHaveBeenCalledWith('app-1', {
                    updates: [{ layoutId: 'layout-1', widgetId: firstWidgetId, expectedVersion: 4 }]
                })
            })
        }
    )

    it.each([
        ['en', 'source_removed'],
        ['ru', 'source_removed'],
        ['en', 'conflict'],
        ['ru', 'conflict']
    ] as const)('locks source-managed Dashboard actions for %s when the source is %s', async (language, syncState) => {
        localeMocks.language = language
        apiMocks.getApplicationLayout.mockResolvedValue({
            item: createSourceDashboardLayout(syncState),
            widgets: [
                {
                    id: `widget-dashboard-${syncState}`,
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'overviewCards',
                    parentWidgetId: 'parent-internal-id',
                    slotKey: 'column:primary',
                    sortOrder: 0,
                    config: { maxCards: 4, density: 'compact' },
                    sourceConfig: { maxCards: 4, density: 'compact' },
                    sourceWidgetId: 'source-dashboard-widget',
                    sourceBaseWidgetId: 'source-dashboard-widget',
                    isCustomized: true,
                    isActive: true,
                    version: 2
                }
            ]
        })

        renderPage()

        const widgetId = `widget-dashboard-${syncState}`
        await waitFor(() => expect(screen.getByTestId('layout-authoring-details')).toBeInTheDocument())
        expect(screen.queryByTestId(`layout-widget-edit-${widgetId}`)).not.toBeInTheDocument()
        expect(screen.queryByTestId(`layout-widget-toggle-${widgetId}`)).not.toBeInTheDocument()
        expect(screen.queryByTestId(`layout-widget-drag-${widgetId}`)).not.toBeInTheDocument()
        expect(screen.queryByTestId(`layout-widget-reset-${widgetId}`)).not.toBeInTheDocument()
        expect(screen.queryByTestId(`layout-widget-remove-${widgetId}`)).not.toBeInTheDocument()
        expect(screen.queryByTestId(`layout-widget-duplicate-${widgetId}`)).not.toBeInTheDocument()
        expect(screen.queryByText('parent-internal-id')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-presentation-dialog-mock')).not.toBeInTheDocument()
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
        expect(screen.getAllByRole('button', { name: 'add-Divider' }).length).toBeGreaterThan(0)
        expect(screen.queryByRole('button', { name: 'add-Workspace switcher' })).not.toBeInTheDocument()
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

    it('rolls back optimistic registry presentation updates when the save mutation fails', async () => {
        const user = userEvent.setup()
        apiMocks.updateApplicationLayoutWidgetConfig.mockRejectedValueOnce(new Error('save failed'))
        const { queryClient } = renderPage()

        await waitFor(() => {
            expect(screen.getByText('Homepage')).toBeInTheDocument()
        })

        await user.click(screen.getByTestId('layout-widget-edit-widget-top-1'))
        expect(screen.getByTestId('layout-widget-presentation-dialog-mock')).toHaveAttribute('data-widget-key', 'overviewCards')
        await user.click(screen.getByRole('button', { name: 'save-widget-presentation' }))

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

        fireEvent.click(screen.getByTestId('layout-widget-edit-widget-matrix-1'))

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
        fireEvent.click(screen.getByTestId('layout-widget-edit-widget-matrix-1'))
        fireEvent.click(screen.getByTestId('application-settings-matrix-reset'))

        await waitFor(() => {
            expect(apiMocks.resetApplicationLayoutWidgetConfigsBatch).toHaveBeenCalledWith('app-1', {
                updates: [{ layoutId: 'layout-1', widgetId: 'widget-matrix-1', expectedVersion: 2 }]
            })
        })
        await waitFor(() => {
            expect(snackbarMocks.enqueueSnackbar).toHaveBeenCalledWith('Metahub settings restored', { variant: 'success' })
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
        fireEvent.click(screen.getByTestId('layout-widget-edit-widget-matrix-1'))
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
        fireEvent.click(screen.getByTestId('layout-widget-edit-widget-matrix-1'))
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
        fireEvent.click(screen.getByTestId('layout-widget-edit-widget-matrix-1'))
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

        await user.click(screen.getByRole('button', { name: 'Edit widget: Workspace switcher' }))

        expect(screen.getByRole('dialog', { name: 'Workspace switcher' })).toBeInTheDocument()
        expect(
            screen.getByText(
                'The workspace switcher uses the published application workspace state and has no widget-specific settings yet.'
            )
        ).toBeInTheDocument()
        expect(screen.queryByDisplayValue(/\{/)).not.toBeInTheDocument()
    })
})
