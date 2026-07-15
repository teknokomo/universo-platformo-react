import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const {
    getLayout,
    listLayoutZoneWidgets,
    getLayoutZoneWidgetObjects,
    updateLayoutZoneWidgetConfig,
    assignLayoutZoneWidget,
    moveLayoutZoneWidget,
    removeLayoutZoneWidget,
    toggleLayoutZoneWidgetActive,
    updateLayout
} = vi.hoisted(() => ({
    getLayout: vi.fn(),
    listLayoutZoneWidgets: vi.fn(),
    getLayoutZoneWidgetObjects: vi.fn(),
    updateLayoutZoneWidgetConfig: vi.fn(),
    assignLayoutZoneWidget: vi.fn(),
    moveLayoutZoneWidget: vi.fn(),
    removeLayoutZoneWidget: vi.fn(),
    toggleLayoutZoneWidgetActive: vi.fn(),
    updateLayout: vi.fn()
}))
const mockUseMetahubDetails = vi.fn()

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string, options?: Record<string, unknown>) =>
            Object.entries(options ?? {}).reduce(
                (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)),
                fallback ?? _key
            ),
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo-react/template-mui', () => ({
    EDITABLE_SIDE_MENU_MODES: ['wide', 'compact', 'overlay'],
    TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ViewHeaderMUI: ({ children, title }: { children?: ReactNode; title?: string }) => (
        <div>
            <h1>{title}</h1>
            {children}
        </div>
    ),
    LayoutAuthoringDetails: ({ beforeZonesContent, zones }: any) => (
        <div>
            {beforeZonesContent}
            {zones.map((zone: any) => (
                <section key={zone.zone} data-testid={`layout-zone-${zone.zone}`}>
                    {zone.items.map((item: any) => (
                        <div key={item.id} data-testid={`layout-widget-${item.id}`}>
                            {item.onEdit ? (
                                <button type='button' data-testid={`layout-widget-edit-${item.id}`} onClick={item.onEdit}>
                                    edit
                                </button>
                            ) : null}
                        </div>
                    ))}
                </section>
            ))}
        </div>
    ),
    EntityFormDialog: ({
        open,
        title,
        extraFields,
        onSave,
        saveButtonText
    }: {
        open: boolean
        title: string
        extraFields: () => ReactNode
        onSave: () => void | Promise<void>
        saveButtonText: string
    }) => {
        const [saveFailed, setSaveFailed] = useState(false)
        return open ? (
            <div role='dialog' aria-label={title}>
                {extraFields()}
                {saveFailed ? <span data-testid='dialog-save-error'>save failed</span> : null}
                <button
                    type='button'
                    onClick={() => {
                        setSaveFailed(false)
                        void Promise.resolve(onSave()).catch(() => setSaveFailed(true))
                    }}
                >
                    {saveButtonText}
                </button>
            </div>
        ) : null
    },
    notifyError: vi.fn(),
    normalizeSideMenuConfig: (value: any) => ({
        availableModes:
            Array.isArray(value?.availableModes) && value.availableModes.length > 0 ? value.availableModes : ['wide', 'compact', 'overlay'],
        primaryMode: typeof value?.primaryMode === 'string' ? value.primaryMode : 'wide',
        rememberUserChoice: typeof value?.rememberUserChoice === 'boolean' ? value.rememberUserChoice : true
    }),
    PAGE_CONTENT_GUTTER_MX: 0
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('../../api', () => ({
    getLayout,
    listLayoutZoneWidgets,
    getLayoutZoneWidgetObjects,
    updateLayout,
    assignLayoutZoneWidget,
    moveLayoutZoneWidget,
    removeLayoutZoneWidget,
    updateLayoutZoneWidgetConfig,
    toggleLayoutZoneWidgetActive
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

vi.mock('../MenuWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../ColumnsContainerEditorDialog', () => ({ default: () => null }))
vi.mock('../QuizWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../PlayCanvasCanvasWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../WidgetBehaviorEditorDialog', () => ({ default: () => null }))
vi.mock('../WidgetScopeVisibilityPanel', () => ({ default: () => null }))

import LayoutDetails from '../LayoutDetails'

const renderDetails = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/metahub/metahub-1/resources/layout/layout-1']}>
                <Routes>
                    <Route path='/metahub/:metahubId/resources/layout/:layoutId' element={<LayoutDetails />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('LayoutDetails interpretation network widget editor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: true } }
        })
        vi.stubGlobal(
            'ResizeObserver',
            class ResizeObserver {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )

        getLayout.mockResolvedValue({
            data: {
                id: 'layout-1',
                scopeEntityId: null,
                templateKey: 'dashboard',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Global layout' }
                    }
                },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                version: 1,
                createdAt: '2026-07-07T00:00:00.000Z',
                updatedAt: '2026-07-07T00:00:00.000Z'
            }
        })
        listLayoutZoneWidgets.mockResolvedValue([
            {
                id: 'widget-network',
                layoutId: 'layout-1',
                zone: 'center',
                widgetKey: 'interpretationNetworkWorkspace',
                sortOrder: 1,
                config: {
                    matrixMode: 'hierarchicalCells',
                    allowedMatrixViews: ['horizontalRows'],
                    defaultMatrixView: 'horizontalRows',
                    showHierarchicalTableHeaderCard: false,
                    showMatrixTreeTotalCells: false,
                    colorBreadcrumbsByCell: false,
                    conceptCodename: 'concepts',
                    splitPane: { enabled: true }
                },
                isActive: true,
                isInherited: false
            }
        ])
        getLayoutZoneWidgetObjects.mockResolvedValue([
            { key: 'interpretationNetworkWorkspace', allowedZones: ['center'], multiInstance: false }
        ])
        updateLayoutZoneWidgetConfig.mockResolvedValue({
            data: {
                item: {
                    id: 'widget-network',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'interpretationNetworkWorkspace',
                    sortOrder: 1,
                    config: {
                        matrixMode: 'hierarchicalCells',
                        allowedMatrixViews: ['table', 'horizontalRows'],
                        defaultMatrixView: 'table',
                        tableProjection: 'hierarchicalPath',
                        breadcrumbDepth: { mode: 'full' },
                        toolbarLayout: 'horizontal',
                        showHierarchicalTableHeaderCard: false,
                        showMatrixTreeTotalCells: false,
                        colorBreadcrumbsByCell: false,
                        conceptCodename: 'concepts',
                        splitPane: { enabled: true }
                    },
                    isActive: true,
                    isInherited: false
                }
            }
        })
    })

    it('opens the focused editor and persists display settings through the widget config endpoint', async () => {
        const user = userEvent.setup()
        renderDetails()

        await waitFor(() => {
            expect(screen.getByTestId('layout-widget-widget-network')).toBeInTheDocument()
        })

        await user.click(screen.getByTestId('layout-widget-edit-widget-network'))
        const dialog = screen.getByRole('dialog', { name: 'Interpretation network workspace' })

        await user.click(within(dialog).getByRole('checkbox', { name: 'Table view' }))
        await user.click(within(dialog).getByRole('combobox', { name: 'Default view' }))
        await user.click(screen.getByRole('option', { name: 'Table view' }))
        expect(within(dialog).getByRole('combobox', { name: 'Levels' })).toHaveAttribute('aria-disabled', 'true')
        await user.click(within(dialog).getByRole('combobox', { name: 'Path' }))
        await user.click(screen.getByRole('option', { name: 'Last levels' }))
        await user.click(within(dialog).getByRole('combobox', { name: 'Levels' }))
        await user.click(screen.getByRole('option', { name: '4' }))
        await user.click(within(dialog).getByRole('switch', { name: 'Show hierarchical table headers' }))
        const headerCardSwitch = within(dialog).getByRole('switch', { name: 'Show focused parent card' })
        expect(headerCardSwitch).not.toBeChecked()
        await user.click(headerCardSwitch)
        await user.click(within(dialog).getByRole('switch', { name: 'Use cell colors for breadcrumbs' }))
        await user.click(within(dialog).getByRole('switch', { name: 'Show total cells in tree' }))
        await user.click(within(dialog).getByRole('combobox', { name: 'Toolbar layout' }))
        await user.click(screen.getByRole('option', { name: 'Vertical' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(updateLayoutZoneWidgetConfig).toHaveBeenCalledWith('metahub-1', 'layout-1', 'widget-network', {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table',
            tableProjection: 'hierarchicalPath',
            breadcrumbDepth: { mode: 'last', count: 4 },
            toolbarLayout: 'vertical',
            showHierarchicalTableHeaders: true,
            showHierarchicalTableHeaderCard: true,
            showMatrixTreeTotalCells: true,
            colorBreadcrumbsByCell: true,
            allowNewAxesInCellDialog: false,
            conceptCodename: 'concepts',
            splitPane: { enabled: true }
        })
    })

    it('keeps the editor open when persisting display settings fails', async () => {
        const user = userEvent.setup()
        updateLayoutZoneWidgetConfig.mockRejectedValueOnce(new Error('save failed'))
        renderDetails()

        await waitFor(() => {
            expect(screen.getByTestId('layout-widget-widget-network')).toBeInTheDocument()
        })

        await user.click(screen.getByTestId('layout-widget-edit-widget-network'))
        const dialog = screen.getByRole('dialog', { name: 'Interpretation network workspace' })

        await user.click(within(dialog).getByRole('checkbox', { name: 'Table view' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(await within(dialog).findByTestId('dialog-save-error')).toHaveTextContent('save failed')
        expect(screen.getByRole('dialog', { name: 'Interpretation network workspace' })).toBeInTheDocument()
        expect(updateLayoutZoneWidgetConfig).toHaveBeenCalledTimes(1)
    })
})
