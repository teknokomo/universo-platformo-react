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
                catalogId: 'catalog-1',
                templateKey: 'dashboard',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Catalog layout' }
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
                id: 'widget-inherited',
                layoutId: 'layout-1',
                zone: 'left',
                widgetKey: 'menuWidget',
                sortOrder: 1,
                config: { title: 'Catalogs' },
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
            { key: 'columnsContainer', allowedZones: ['left', 'center', 'right'], multiInstance: true }
        ])
    })

    it('keeps inherited widgets draggable and toggleable but hides edit/delete actions', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/layout/layout-1']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/catalog/:catalogId/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('layout-widget-widget-inherited')).toBeInTheDocument()
        })

        expect(screen.getByTestId('layout-widget-inherited-widget-inherited')).toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-toggle-widget-inherited')).toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-edit-widget-inherited')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-remove-widget-inherited')).not.toBeInTheDocument()

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
                <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/layout/layout-1']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/catalog/:catalogId/layout/:layoutId' element={<LayoutDetails />} />
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