import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
    listApplicationLayoutScopes: vi.fn(),
    listApplicationLayouts: vi.fn(),
    getApplicationLayout: vi.fn(),
    listApplicationLayoutWidgetCatalog: vi.fn(),
    moveApplicationLayoutWidget: vi.fn(),
    toggleApplicationLayoutWidget: vi.fn(),
    upsertApplicationLayoutWidget: vi.fn(),
    deleteApplicationLayoutWidget: vi.fn(),
    updateApplicationLayoutWidgetConfig: vi.fn(),
    createApplicationLayout: vi.fn(),
    updateApplicationLayout: vi.fn(),
    deleteApplicationLayout: vi.fn(),
    copyApplicationLayout: vi.fn()
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const dictionary: Record<string, string> = {
                'layouts.widgets.menuWidget': 'Menu',
                'layouts.widgets.overviewCards': 'Overview cards',
                'layouts.widgets.recordsTable': 'Records table'
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

vi.mock('@universo/template-mui', () => ({
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
                              <button key={item.id} type='button' onClick={item.onClick}>
                                  {item.label}
                              </button>
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
    LocalizedInlineField: ({ label }: { label: string }) => <div>{label}</div>,
    EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
    APIEmptySVG: 'api-empty'
}))

vi.mock('../../api/applications', () => ({
    listApplicationLayoutScopes: apiMocks.listApplicationLayoutScopes,
    listApplicationLayouts: apiMocks.listApplicationLayouts,
    getApplicationLayout: apiMocks.getApplicationLayout,
    listApplicationLayoutWidgetCatalog: apiMocks.listApplicationLayoutWidgetCatalog,
    moveApplicationLayoutWidget: apiMocks.moveApplicationLayoutWidget,
    toggleApplicationLayoutWidget: apiMocks.toggleApplicationLayoutWidget,
    upsertApplicationLayoutWidget: apiMocks.upsertApplicationLayoutWidget,
    deleteApplicationLayoutWidget: apiMocks.deleteApplicationLayoutWidget,
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
                }
            ]
        })
        apiMocks.listApplicationLayoutWidgetCatalog.mockResolvedValue([
            { key: 'menuWidget', allowedZones: ['left', 'center'], multiInstance: true },
            { key: 'overviewCards', allowedZones: ['top', 'right'], multiInstance: false }
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
    })
})
