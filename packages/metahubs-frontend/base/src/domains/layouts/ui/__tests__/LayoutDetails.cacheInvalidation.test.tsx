import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { extractCatalogLayoutBehaviorConfig } from '@universo/utils'

const {
    getLayout,
    listLayoutZoneWidgets,
    getLayoutZoneWidgetsCatalog,
    updateLayout,
    toggleLayoutZoneWidgetActive
} = vi.hoisted(() => ({
    getLayout: vi.fn(),
    listLayoutZoneWidgets: vi.fn(),
    getLayoutZoneWidgetsCatalog: vi.fn(),
    updateLayout: vi.fn(),
    toggleLayoutZoneWidgetActive: vi.fn()
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
    updateLayout,
    assignLayoutZoneWidget: vi.fn(),
    moveLayoutZoneWidget: vi.fn(),
    removeLayoutZoneWidget: vi.fn(),
    updateLayoutZoneWidgetConfig: vi.fn(),
    toggleLayoutZoneWidgetActive
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

vi.mock('../MenuWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../ColumnsContainerEditorDialog', () => ({ default: () => null }))
vi.mock('../QuizWidgetEditorDialog', () => ({ default: () => null }))

import { metahubsQueryKeys } from '../../../shared'
import LayoutDetails from '../LayoutDetails'

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const seedGlobalLayoutResponse = () => {
    getLayout.mockResolvedValue({
        data: {
            id: 'layout-global',
            catalogId: null,
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
            createdAt: '2026-04-06T00:00:00.000Z',
            updatedAt: '2026-04-06T00:00:00.000Z'
        }
    })

    listLayoutZoneWidgets.mockResolvedValue([
        {
            id: 'widget-global',
            layoutId: 'layout-global',
            zone: 'left',
            widgetKey: 'menuWidget',
            sortOrder: 1,
            config: { title: 'Catalogs' },
            isActive: true,
            isInherited: false
        }
    ])

    getLayoutZoneWidgetsCatalog.mockResolvedValue([{ key: 'menuWidget', allowedZones: ['left', 'right'], multiInstance: false }])
}

describe('LayoutDetails cache invalidation for global layouts', () => {
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
        seedGlobalLayoutResponse()
        updateLayout.mockResolvedValue({ data: { ok: true } })
        toggleLayoutZoneWidgetActive.mockResolvedValue({ data: { ok: true } })
    })

    it('invalidates the full layouts root after toggling a widget on a global base layout', async () => {
        const queryClient = createQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layout/layout-global']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('layout-widget-widget-global')).toBeInTheDocument()
        })

        invalidateSpy.mockClear()

        fireEvent.click(screen.getByTestId('layout-widget-toggle-widget-global'))

        await waitFor(() => {
            expect(toggleLayoutZoneWidgetActive).toHaveBeenCalledWith('metahub-1', 'layout-global', 'widget-global', false)
        })

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.layoutsRoot('metahub-1') })
    })

    it('invalidates the full layouts root after changing global catalog behavior settings', async () => {
        const queryClient = createQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layout/layout-global']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(screen.getByRole('switch', { name: 'Show create button' })).toBeInTheDocument()
        })

        invalidateSpy.mockClear()

        fireEvent.click(screen.getByRole('switch', { name: 'Show create button' }))

        await waitFor(() => {
            expect(updateLayout).toHaveBeenCalledWith('metahub-1', 'layout-global', expect.objectContaining({ config: expect.any(Object) }))
        })

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.layoutsRoot('metahub-1') })
    })

    it('stores persisted row reorder settings inside catalog behavior config', async () => {
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layout/layout-global']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(screen.getByRole('switch', { name: 'Enable row reordering' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('switch', { name: 'Enable row reordering' }))

        await waitFor(() => {
            expect(updateLayout).toHaveBeenCalledWith('metahub-1', 'layout-global', expect.objectContaining({ config: expect.any(Object) }))
        })

        const lastCall = updateLayout.mock.calls.at(-1)
        const nextConfig = lastCall?.[2]?.config as Record<string, unknown>

        expect(nextConfig.enableRowReordering).toBeUndefined()
        expect(extractCatalogLayoutBehaviorConfig(nextConfig)).toEqual(
            expect.objectContaining({
                enableRowReordering: true
            })
        )
    })
})