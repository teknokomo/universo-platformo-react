import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
    listApplicationLayoutScopes: vi.fn(),
    listApplicationLayouts: vi.fn(),
    getApplicationLayout: vi.fn(),
    listApplicationLayoutWidgetObject: vi.fn(),
    moveApplicationLayoutWidget: vi.fn(),
    toggleApplicationLayoutWidget: vi.fn(),
    upsertApplicationLayoutWidget: vi.fn(),
    deleteApplicationLayoutWidget: vi.fn(),
    resetApplicationLayoutWidgetConfigsBatch: vi.fn(),
    resetApplicationLayoutConfig: vi.fn(),
    updateApplicationLayoutWidgetConfig: vi.fn(),
    createApplicationLayout: vi.fn(),
    updateApplicationLayout: vi.fn(),
    deleteApplicationLayout: vi.fn(),
    copyApplicationLayout: vi.fn()
}))
const snackbarMocks = vi.hoisted(() => ({
    enqueueSnackbar: vi.fn()
}))
const confirmMocks = vi.hoisted(() => ({
    confirm: vi.fn()
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: snackbarMocks.enqueueSnackbar })
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const dictionary: Record<string, string> = {
                'layouts.widgets.menuWidget': 'Menu',
                'layouts.widgets.overviewCards': 'Overview cards',
                'layouts.widgets.interpretationNetworkWorkspace': 'Interpretation network workspace',
                'layouts.widgets.workspaceSwitcher': 'Workspace switcher',
                'layouts.widgets.recordsTable': 'Records table',
                'layouts.interpretationNetworkEditor.title': 'Interpretation network workspace',
                'layouts.workspaceSwitcherEditor.title': 'Workspace switcher',
                'layouts.workspaceSwitcherEditor.readOnly':
                    'The workspace switcher uses the published application workspace state and has no widget-specific settings yet.',
                'layouts.workspaceSwitcherEditor.hint':
                    'Use application settings to control which workspace settings can be changed inside workspaces.',
                'layouts.widgetCustomization.application': 'Customized in application',
                'layouts.widgetCustomization.metahub': 'Inherited from metahub',
                'layouts.interpretationNetworkEditor.saveError': 'Failed to save widget settings',
                'settings.matrix.singleSystemStructuresExist':
                    'Single-system mode cannot be enabled while ordinary Structures exist. Delete them first.',
                'settings.matrix.reset': 'Restore metahub settings',
                'settings.matrix.singleSystemMetadataMissing':
                    'Single-system mode cannot be enabled because the Structure metadata is incomplete.',
                'layouts.marketing.reset': 'Restore template defaults',
                'layouts.marketing.resetTitle': 'Restore marketing page defaults?',
                'layouts.marketing.resetDescription':
                    'This restores the theme, colors, and section visibility for this application layout. Workspace content and metahub records will not change.',
                'layouts.marketing.resetConfirm': 'Restore defaults',
                'layouts.marketing.resetSuccess': 'Marketing appearance restored to template defaults.'
            }
            const template = dictionary[key] ?? fallback ?? key
            if (!params) return template
            return Object.entries(params).reduce(
                (message, [paramKey, value]) => message.replace(`{{${paramKey}}}`, String(value)),
                template
            )
        },
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo-react/template-mui', () => ({
    EDITABLE_SIDE_MENU_MODES: ['wide', 'compact', 'overlay'],
    ViewHeaderMUI: ({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) => (
        <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
            {children}
        </div>
    ),
    ToolbarControls: ({ onViewModeChange }: { onViewModeChange?: (mode: string) => void }) => (
        <div>
            <button type='button' onClick={() => onViewModeChange?.('card')}>
                card-view
            </button>
            <button type='button' onClick={() => onViewModeChange?.('list')}>
                list-view
            </button>
        </div>
    ),
    FlowListTable: ({ data, customColumns }: { data?: Array<Record<string, unknown>>; customColumns?: Array<Record<string, unknown>> }) => (
        <div data-testid='flow-list-table'>
            {Array.isArray(data) && Array.isArray(customColumns)
                ? data.map((row, index) => (
                      <div key={String(row.id ?? index)}>
                          {customColumns.map((column) => (
                              <div key={String(column.id)}>{typeof column.render === 'function' ? column.render(row) : null}</div>
                          ))}
                      </div>
                  ))
                : null}
        </div>
    ),
    LayoutAuthoringList: ({ items, viewMode, listContentTestId }: any) => (
        <div data-testid={listContentTestId}>
            <div>{viewMode}</div>
            {(items ?? []).map((item: any) => (
                <div key={item.id}>
                    <div>{item.title}</div>
                    <div>{item.meta}</div>
                    <div>{item.statusContent}</div>
                </div>
            ))}
            {viewMode === 'list' ? <div data-testid='flow-list-table' /> : null}
        </div>
    ),
    LayoutAuthoringDetails: ({ zones, onDragEnd }: any) => (
        <div data-testid='layout-authoring-details'>
            {Array.isArray(zones)
                ? zones.map((zone: any) => (
                      <div key={zone.zone}>
                          <h2>{zone.title}</h2>
                          {(zone.items ?? []).map((item: any) => (
                              <div key={item.id}>
                                  <button type='button' onClick={item.onClick}>
                                      {item.label}
                                  </button>
                                  {item.inheritedLabel ? <span>{item.inheritedLabel}</span> : null}
                              </div>
                          ))}
                      </div>
                  ))
                : null}
            <button type='button' onClick={() => onDragEnd?.({ active: { id: 'widget-center-1' }, over: { id: 'zone:top' } })}>
                move-widget-center-to-top
            </button>
        </div>
    ),
    LayoutStateChips: ({ labels, isDefault, sourceKind, syncState, isActive }: any) => (
        <div>
            <span>{isActive ? labels.active : labels.inactive}</span>
            {isDefault ? <span>{labels.default}</span> : null}
            {sourceKind ? <span>{labels.source?.[sourceKind]}</span> : null}
            {syncState ? <span>{labels.syncState?.[syncState]}</span> : null}
        </div>
    ),
    normalizeSideMenuConfig: (value: any) => ({
        availableModes:
            Array.isArray(value?.availableModes) && value.availableModes.length > 0 ? value.availableModes : ['wide', 'compact', 'overlay'],
        primaryMode: typeof value?.primaryMode === 'string' ? value.primaryMode : 'wide',
        rememberUserChoice: typeof value?.rememberUserChoice === 'boolean' ? value.rememberUserChoice : true
    }),
    EntityFormDialog: ({ open, title, extraFields, onSave }: any) =>
        open ? (
            <div data-testid='entity-form-dialog'>
                <h3>{title}</h3>
                {typeof extraFields === 'function' ? extraFields() : null}
                <button type='button' onClick={onSave}>
                    Save
                </button>
            </div>
        ) : null,
    StandardDialog: ({ open, title, children, actions }: any) =>
        open ? (
            <div role='dialog' aria-label={title}>
                <h2>{title}</h2>
                <div>{children}</div>
                {actions ? <div data-testid='standard-dialog-actions'>{actions}</div> : null}
            </div>
        ) : null,
    LocalizedInlineField: ({ label }: { label: string }) => <div>{label}</div>,
    EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
    APIEmptySVG: 'api-empty',
    useConfirm: () => ({ confirm: confirmMocks.confirm })
}))

vi.mock('../../api/applications', () => ({
    listApplicationLayoutScopes: apiMocks.listApplicationLayoutScopes,
    listApplicationLayouts: apiMocks.listApplicationLayouts,
    getApplicationLayout: apiMocks.getApplicationLayout,
    listApplicationLayoutWidgetObject: apiMocks.listApplicationLayoutWidgetObject,
    moveApplicationLayoutWidget: apiMocks.moveApplicationLayoutWidget,
    toggleApplicationLayoutWidget: apiMocks.toggleApplicationLayoutWidget,
    upsertApplicationLayoutWidget: apiMocks.upsertApplicationLayoutWidget,
    deleteApplicationLayoutWidget: apiMocks.deleteApplicationLayoutWidget,
    resetApplicationLayoutWidgetConfigsBatch: apiMocks.resetApplicationLayoutWidgetConfigsBatch,
    resetApplicationLayoutConfig: apiMocks.resetApplicationLayoutConfig,
    updateApplicationLayoutWidgetConfig: apiMocks.updateApplicationLayoutWidgetConfig,
    createApplicationLayout: apiMocks.createApplicationLayout,
    updateApplicationLayout: apiMocks.updateApplicationLayout,
    deleteApplicationLayout: apiMocks.deleteApplicationLayout,
    copyApplicationLayout: apiMocks.copyApplicationLayout
}))

import ApplicationLayouts from '../ApplicationLayouts'
import { STORAGE_KEYS } from '../../constants/storage'
import { applicationsQueryKeys } from '../../api/queryKeys'

const renderPage = (initialEntry = '/a/app-1/admin/layouts/layout-1') => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path='/a/:applicationId/admin/layouts' element={<ApplicationLayouts />} />
                    <Route path='/a/:applicationId/admin/layouts/:layoutId' element={<ApplicationLayouts />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )

    return { ...result, queryClient }
}

const createMarketingLayout = (config: Record<string, unknown> = {}) => ({
    id: 'layout-1',
    scopeId: 'global',
    scopeKind: 'global',
    scopeEntityId: null,
    templateKey: 'marketing-page',
    name: { en: 'Marketing' },
    description: null,
    config: {
        themeMode: 'dark',
        sectionOrder: ['hero', 'logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq', 'footer'],
        sectionVisibility: { hero: false },
        primaryColor: '#1976d2',
        accentColor: '#9c27b0',
        allowEmailActions: true,
        allowTelephoneActions: true,
        externalLinkTarget: 'new-tab',
        ...config
    },
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
    version: 7
})

describe('ApplicationLayouts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()

        apiMocks.listApplicationLayoutScopes.mockResolvedValue([
            { id: 'global', scopeKind: 'global', scopeEntityId: null, kind: null, tableName: null, codename: {}, name: 'Global' }
        ])
        apiMocks.listApplicationLayouts.mockResolvedValue({
            items: [
                {
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
                }
            ],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
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
                    id: 'widget-top-1',
                    layoutId: 'layout-1',
                    zone: 'top',
                    widgetKey: 'overviewCards',
                    sortOrder: 0,
                    config: {},
                    isActive: true,
                    version: 1
                },
                {
                    id: 'widget-center-1',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'menuWidget',
                    sortOrder: 0,
                    config: {
                        title: {
                            locales: {
                                en: { content: 'Training' }
                            }
                        }
                    },
                    isActive: true,
                    version: 3
                },
                {
                    id: 'widget-bottom-1',
                    layoutId: 'layout-1',
                    zone: 'bottom',
                    widgetKey: 'notes',
                    sortOrder: 0,
                    config: {},
                    isActive: false,
                    version: 1
                },
                {
                    id: 'widget-matrix-1',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'interpretationNetworkWorkspace',
                    sortOrder: 1,
                    config: {
                        matrixMode: 'hierarchicalCells',
                        allowedMatrixViews: ['table', 'horizontalRows'],
                        defaultMatrixView: 'table',
                        splitPane: { enabled: true }
                    },
                    sourceConfig: {
                        matrixMode: 'hierarchicalCells',
                        allowedMatrixViews: ['table'],
                        defaultMatrixView: 'table',
                        splitPane: { enabled: false }
                    },
                    isCustomized: true,
                    isActive: true,
                    version: 2
                },
                {
                    id: 'widget-workspace-switcher-1',
                    layoutId: 'layout-1',
                    zone: 'left',
                    widgetKey: 'workspaceSwitcher',
                    sortOrder: 1,
                    config: {},
                    isActive: true,
                    version: 1
                }
            ]
        })
        apiMocks.listApplicationLayoutWidgetObject.mockResolvedValue([
            { key: 'menuWidget', allowedZones: ['left', 'center'], multiInstance: true },
            { key: 'overviewCards', allowedZones: ['top', 'right'], multiInstance: false },
            { key: 'interpretationNetworkWorkspace', allowedZones: ['center'], multiInstance: true },
            { key: 'workspaceSwitcher', allowedZones: ['left'], multiInstance: false }
        ])
        apiMocks.moveApplicationLayoutWidget.mockResolvedValue({
            id: 'widget-center-1',
            layoutId: 'layout-1',
            zone: 'top',
            widgetKey: 'menuWidget',
            sortOrder: 1,
            config: {},
            isActive: true,
            version: 4
        })
        apiMocks.toggleApplicationLayoutWidget.mockResolvedValue({})
        apiMocks.upsertApplicationLayoutWidget.mockResolvedValue({})
        apiMocks.deleteApplicationLayoutWidget.mockResolvedValue(undefined)
        apiMocks.resetApplicationLayoutWidgetConfigsBatch.mockResolvedValue([])
        apiMocks.resetApplicationLayoutConfig.mockResolvedValue({})
        confirmMocks.confirm.mockResolvedValue(true)
        apiMocks.updateApplicationLayoutWidgetConfig.mockResolvedValue({})
        apiMocks.createApplicationLayout.mockResolvedValue({})
        apiMocks.updateApplicationLayout.mockResolvedValue({})
        apiMocks.deleteApplicationLayout.mockResolvedValue(undefined)
        apiMocks.copyApplicationLayout.mockResolvedValue({})
    })

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

        await user.click(screen.getByRole('button', { name: 'move-widget-center-to-top' }))

        await waitFor(() => {
            expect(apiMocks.moveApplicationLayoutWidget).toHaveBeenCalledWith('app-1', 'layout-1', {
                widgetId: 'widget-center-1',
                targetZone: 'top',
                targetIndex: 1,
                expectedVersion: 3
            })
        })
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

    it('confirms and resets marketing appearance to template defaults with the layout version', async () => {
        const user = userEvent.setup()
        const marketingLayout = createMarketingLayout()
        apiMocks.listApplicationLayouts.mockResolvedValue({
            items: [marketingLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValue({ item: marketingLayout, widgets: [] })
        apiMocks.updateApplicationLayout.mockResolvedValue(marketingLayout)
        apiMocks.resetApplicationLayoutConfig.mockResolvedValueOnce({
            ...marketingLayout,
            config: {
                themeMode: 'system',
                sectionOrder: ['hero', 'logos', 'features', 'testimonials', 'highlights', 'pricing', 'faq', 'footer'],
                sectionVisibility: {},
                allowEmailActions: true,
                allowTelephoneActions: true,
                externalLinkTarget: 'new-tab'
            },
            version: 8
        })

        renderPage()

        await waitFor(() => expect(screen.getByTestId('application-marketing-appearance-panel')).toBeInTheDocument())
        const resetButton = screen.getByRole('button', { name: 'Restore template defaults' })
        expect(resetButton).toBeEnabled()
        await user.click(resetButton)

        await waitFor(() => {
            expect(confirmMocks.confirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Restore marketing page defaults?',
                    confirmButtonName: 'Restore defaults'
                })
            )
            expect(apiMocks.resetApplicationLayoutConfig).toHaveBeenCalledWith('app-1', 'layout-1', { expectedVersion: 7 })
        })
    })

    it('does not reset marketing appearance when the confirmation is cancelled', async () => {
        const user = userEvent.setup()
        const marketingLayout = createMarketingLayout({
            themeMode: 'system',
            sectionVisibility: {}
        })
        confirmMocks.confirm.mockResolvedValueOnce(false)
        apiMocks.listApplicationLayouts.mockResolvedValueOnce({
            items: [marketingLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValueOnce({ item: marketingLayout, widgets: [] })

        renderPage()
        await waitFor(() => expect(screen.getByTestId('application-marketing-appearance-panel')).toBeInTheDocument())
        await user.click(screen.getByRole('button', { name: 'Restore template defaults' }))

        await waitFor(() => expect(confirmMocks.confirm).toHaveBeenCalled())
        expect(apiMocks.resetApplicationLayoutConfig).not.toHaveBeenCalled()
    })

    it('edits marketing section order and action policy through typed controls', async () => {
        const user = userEvent.setup()
        const marketingLayout = createMarketingLayout()
        apiMocks.listApplicationLayouts.mockResolvedValue({
            items: [marketingLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValue({ item: marketingLayout, widgets: [] })
        apiMocks.updateApplicationLayout.mockResolvedValue(marketingLayout)

        renderPage()

        await waitFor(() => expect(screen.getByTestId('application-marketing-appearance-panel')).toBeInTheDocument())
        await user.click(screen.getByTestId('application-marketing-section-down-hero'))
        await waitFor(() => {
            expect(apiMocks.updateApplicationLayout).toHaveBeenCalledWith(
                'app-1',
                'layout-1',
                expect.objectContaining({
                    expectedVersion: 7,
                    config: expect.objectContaining({
                        sectionOrder: ['logos', 'hero', 'features', 'testimonials', 'highlights', 'pricing', 'faq', 'footer'],
                        allowEmailActions: true,
                        allowTelephoneActions: true
                    })
                })
            )
        })

        apiMocks.updateApplicationLayout.mockClear()
        await user.click(screen.getByLabelText('Allow email actions'))
        await waitFor(() => {
            expect(apiMocks.updateApplicationLayout).toHaveBeenCalledWith(
                'app-1',
                'layout-1',
                expect.objectContaining({ config: expect.objectContaining({ allowEmailActions: false }) })
            )
        })

        apiMocks.updateApplicationLayout.mockClear()
        await user.click(screen.getByLabelText('Allow telephone actions'))
        await waitFor(() => {
            expect(apiMocks.updateApplicationLayout).toHaveBeenCalledWith(
                'app-1',
                'layout-1',
                expect.objectContaining({ config: expect.objectContaining({ allowTelephoneActions: false }) })
            )
        })
    })
})
