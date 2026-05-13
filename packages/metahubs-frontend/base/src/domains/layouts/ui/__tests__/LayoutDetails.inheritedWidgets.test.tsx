import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

const { getLayout, listLayoutZoneWidgets, getLayoutZoneWidgetsCatalog } = vi.hoisted(() => ({
    getLayout: vi.fn(),
    listLayoutZoneWidgets: vi.fn(),
    getLayoutZoneWidgetsCatalog: vi.fn()
}))
const mockUseMetahubDetails = vi.fn()

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/template-mui', () => ({
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
                    <button type='button' disabled={Boolean(zone.addDisabled)}>
                        Add widget
                    </button>
                    {zone.items.map((item: any) => (
                        <div key={item.id} data-testid={`layout-widget-${item.id}`}>
                            <button type='button' data-testid={`layout-widget-drag-${item.id}`} disabled={item.draggable === false}>
                                drag
                            </button>
                            {item.inheritedLabel ? (
                                <span data-testid={`layout-widget-inherited-${item.id}`}>{item.inheritedLabel}</span>
                            ) : null}
                            {item.onEdit ? (
                                <button type='button' data-testid={`layout-widget-edit-${item.id}`} onClick={item.onEdit}>
                                    edit
                                </button>
                            ) : null}
                            {item.onToggleActive ? (
                                <button
                                    type='button'
                                    data-testid={`layout-widget-toggle-${item.id}`}
                                    onClick={() => item.onToggleActive(!item.isActive)}
                                >
                                    toggle
                                </button>
                            ) : null}
                            {item.onRemove ? (
                                <button type='button' data-testid={`layout-widget-remove-${item.id}`} onClick={item.onRemove}>
                                    remove
                                </button>
                            ) : null}
                        </div>
                    ))}
                </section>
            ))}
        </div>
    ),
    notifyError: vi.fn(),
    PAGE_CONTENT_GUTTER_MX: 0
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('../../api', () => ({
    getLayout,
    listLayoutZoneWidgets,
    getLayoutZoneWidgetsCatalog,
    updateLayout: vi.fn(),
    assignLayoutZoneWidget: vi.fn(),
    moveLayoutZoneWidget: vi.fn(),
    removeLayoutZoneWidget: vi.fn(),
    updateLayoutZoneWidgetConfig: vi.fn(),
    toggleLayoutZoneWidgetActive: vi.fn()
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

vi.mock('../MenuWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../ColumnsContainerEditorDialog', () => ({ default: () => null }))
vi.mock('../QuizWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../WidgetBehaviorEditorDialog', () => ({ default: () => null }))

import LayoutDetails from '../LayoutDetails'

describe('LayoutDetails inherited widget contract', () => {
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
                scopeEntityId: 'catalog-1',
                templateKey: 'dashboard',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'LinkedCollectionEntity layout' }
                    }
                },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                version: 1,
                createdAt: '2026-04-06T00:00:00.000Z',
                updatedAt: '2026-04-06T00:00:00.000Z'
            }
        })

        listLayoutZoneWidgets.mockResolvedValue([
            {
                id: 'widget-inherited-locked',
                layoutId: 'layout-1',
                zone: 'left',
                widgetKey: 'menuWidget',
                sortOrder: 1,
                config: {
                    title: 'Catalogs',
                    sharedBehavior: {
                        canDeactivate: false,
                        canExclude: false,
                        positionLocked: true
                    }
                },
                isActive: true,
                isInherited: true
            },
            {
                id: 'widget-inherited-flexible',
                layoutId: 'layout-1',
                zone: 'top',
                widgetKey: 'header',
                sortOrder: 1,
                config: {},
                isActive: true,
                isInherited: true
            },
            {
                id: 'widget-owned',
                layoutId: 'layout-1',
                zone: 'right',
                widgetKey: 'columnsContainer',
                sortOrder: 1,
                config: { columns: [] },
                isActive: true,
                isInherited: false
            }
        ])

        getLayoutZoneWidgetsCatalog.mockResolvedValue([
            { key: 'menuWidget', allowedZones: ['left', 'right'], multiInstance: false },
            { key: 'header', allowedZones: ['top'], multiInstance: false },
            { key: 'columnsContainer', allowedZones: ['left', 'center', 'right'], multiInstance: true }
        ])
    })

    it('shows only the inherited widget controls allowed by sharedBehavior', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/entities/catalog/instance/catalog-1/layout/layout-1']}>
                    <Routes>
                        <Route
                            path='/metahub/:metahubId/entities/:kindKey/instance/:scopeEntityId/layout/:layoutId'
                            element={<LayoutDetails />}
                        />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('layout-widget-widget-inherited-locked')).toBeInTheDocument()
        })

        expect(screen.getByTestId('layout-widget-inherited-widget-inherited-locked')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-drag-widget-inherited-locked')).toBeDisabled()
        expect(screen.queryByTestId('layout-widget-toggle-widget-inherited-locked')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-edit-widget-inherited-locked')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-remove-widget-inherited-locked')).not.toBeInTheDocument()

        expect(screen.getByTestId('layout-widget-inherited-widget-inherited-flexible')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-drag-widget-inherited-flexible')).not.toBeDisabled()
        expect(screen.getByTestId('layout-widget-toggle-widget-inherited-flexible')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-remove-widget-inherited-flexible')).toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-edit-widget-inherited-flexible')).not.toBeInTheDocument()

        expect(screen.getByTestId('layout-widget-edit-widget-owned')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-remove-widget-owned')).toBeInTheDocument()
    })

    it('disables layout mutations in read-only mode when the user lacks manage permission', async () => {
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false } }
        })

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/entities/catalog/instance/catalog-1/layout/layout-1']}>
                    <Routes>
                        <Route
                            path='/metahub/:metahubId/entities/:kindKey/instance/:scopeEntityId/layout/:layoutId'
                            element={<LayoutDetails />}
                        />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('layout-widget-widget-owned')).toBeInTheDocument()
        })

        expect(screen.queryByTestId('layout-widget-edit-widget-owned')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-remove-widget-owned')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-toggle-widget-owned')).not.toBeInTheDocument()

        const addButtons = screen.getAllByRole('button', { name: 'Add widget' })
        expect(addButtons.length).toBeGreaterThan(0)
        for (const button of addButtons) {
            expect(button).toBeDisabled()
        }
    })
})
