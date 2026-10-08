import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { metahubsQueryKeys } from '../../../shared'
import { getLayoutWidgetDefinition } from '@universo-react/types'

const {
    getLayout,
    listLayoutZoneWidgets,
    getLayoutZoneWidgetObjects,
    assignLayoutZoneWidget,
    marketingBindingDialog,
    marketingConfigDialog
} = vi.hoisted(() => ({
    getLayout: vi.fn(),
    listLayoutZoneWidgets: vi.fn(),
    getLayoutZoneWidgetObjects: vi.fn(),
    assignLayoutZoneWidget: vi.fn(),
    marketingBindingDialog: vi.fn(),
    marketingConfigDialog: vi.fn()
}))
const mockUseMetahubDetails = vi.fn()

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, options?: string | Record<string, unknown>) => {
            const parameters = typeof options === 'object' && options !== null ? options : {}
            const fallback = typeof options === 'string' ? options : parameters.defaultValue
            return Object.entries(parameters).reduce(
                (message, [name, replacement]) =>
                    name === 'defaultValue' ? message : message.replaceAll(`{{${name}}}`, String(replacement)),
                typeof fallback === 'string' ? fallback : key
            )
        },
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
    LayoutAuthoringDetails: ({ beforeZonesContent, zones, onAddWidgetRequest }: any) => (
        <div>
            {beforeZonesContent}
            {zones.map((zone: any) => (
                <section key={zone.zone} data-testid={`layout-zone-${zone.zone}`}>
                    <button type='button' disabled={Boolean(zone.addDisabled)}>
                        Add widget
                    </button>
                    {(zone.availableWidgets ?? []).map((widget: any) => (
                        <button
                            key={`${zone.zone}-${widget.key}`}
                            type='button'
                            data-testid={`available-widget-${zone.zone}-${widget.key}`}
                            onClick={() => onAddWidgetRequest?.(zone.zone, widget.key)}
                        >
                            add-{widget.key}
                        </button>
                    ))}
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
                            {item.onDuplicate ? (
                                <button type='button' data-testid={`layout-widget-duplicate-${item.id}`} onClick={item.onDuplicate}>
                                    duplicate
                                </button>
                            ) : null}
                        </div>
                    ))}
                </section>
            ))}
        </div>
    ),
    LayoutZoneSettingsDialog: () => null,
    MarketingWidgetConfigDialog: (props: any) => {
        marketingConfigDialog(props)
        return props.open ? (
            <button type='button' onClick={() => void props.onSave(props.initialConfig ?? { showLeadForm: true })}>
                Save presentation
            </button>
        ) : null
    },
    notifyError: vi.fn(),
    useConfirm: () => ({ confirm: vi.fn(async () => true) }),
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
    updateLayout: vi.fn(),
    assignLayoutZoneWidget,
    moveLayoutZoneWidget: vi.fn(),
    removeLayoutZoneWidget: vi.fn(),
    updateLayoutZoneWidgetConfig: vi.fn(),
    toggleLayoutZoneWidgetActive: vi.fn()
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

vi.mock('../../../entities/hooks', () => ({
    useEntityInstancesQuery: () => ({
        data: { items: [{ id: 'hero-object', codename: 'MarketingPageHero', name: 'Hero content' }] },
        isLoading: false,
        error: null
    })
}))

vi.mock('../MenuWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../ColumnsContainerEditorDialog', () => ({ default: () => null }))
vi.mock('../QuizWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../PlayCanvasCanvasWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../WidgetBehaviorEditorDialog', () => ({ default: () => null }))
vi.mock('../MarketingWidgetBindingDialog', () => ({
    default: (props: unknown) => {
        marketingBindingDialog(props)
        return null
    }
}))

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
                scopeEntityId: 'object-1',
                templateKey: 'dashboard',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'ObjectCollectionEntity layout' }
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
                instanceKey: 'widget-inherited-locked-instance',
                zone: 'top',
                widgetKey: 'header',
                sortOrder: 1,
                parentInstanceKey: null,
                slotKey: null,
                config: {},
                isActive: true,
                isInherited: true
            },
            {
                id: 'widget-inherited-flexible',
                layoutId: 'layout-1',
                instanceKey: 'widget-inherited-flexible-instance',
                zone: 'left',
                widgetKey: 'menuWidget',
                sortOrder: 1,
                parentInstanceKey: null,
                slotKey: null,
                config: { variant: 'generated' },
                isActive: true,
                isInherited: true
            },
            {
                id: 'widget-owned',
                layoutId: 'layout-1',
                instanceKey: 'widget-owned-instance',
                zone: 'center',
                widgetKey: 'columnsContainer',
                sortOrder: 1,
                parentInstanceKey: null,
                slotKey: null,
                config: { columns: [] },
                isActive: true,
                isInherited: false
            }
        ])

        getLayoutZoneWidgetObjects.mockResolvedValue([
            getLayoutWidgetDefinition('menuWidget')!,
            getLayoutWidgetDefinition('header')!,
            getLayoutWidgetDefinition('columnsContainer')!
        ])
    })

    it('shows inherited widget controls allowed by registry placement policy', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/entities/object/instance/object-1/layout/layout-1']}>
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
        expect(screen.getByTestId('available-widget-left-menuWidget')).toBeInTheDocument()
        expect(screen.getByTestId('available-widget-top-header')).toBeInTheDocument()
    })

    it('shows the existing localized load error for invalid Marketing widget envelopes', async () => {
        getLayout.mockResolvedValueOnce({
            data: {
                id: 'layout-global',
                scopeEntityId: null,
                templateKey: 'marketing-page',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing' } } },
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
        listLayoutZoneWidgets.mockResolvedValueOnce([
            {
                id: 'invalid-marketing-widget',
                layoutId: 'layout-global',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                instanceKey: 'hero',
                sortOrder: 1,
                config: { __layout: 'invalid-envelope' },
                isActive: true,
                isInherited: false
            }
        ])
        getLayoutZoneWidgetObjects.mockResolvedValueOnce([])

        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources/layout/layout-global']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Failed to load layout zones')).toBeVisible()
        expect(screen.queryByTestId('layout-widget-invalid-marketing-widget')).not.toBeInTheDocument()
    })

    it('adds a registry-backed widget from a valid same-layout placement and submits its canonical bindings', async () => {
        mockUseMetahubDetails.mockReturnValue({ data: { permissions: { manageMetahub: true, editContent: true } } })
        getLayout.mockResolvedValueOnce({
            data: {
                id: 'layout-global',
                scopeEntityId: null,
                templateKey: 'marketing-page',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing' } } },
                description: null,
                config: {},
                neutral: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                version: 5,
                createdAt: '2026-04-06T00:00:00.000Z',
                updatedAt: '2026-04-06T00:00:00.000Z'
            }
        })
        listLayoutZoneWidgets.mockResolvedValueOnce([
            {
                id: 'hero-source',
                layoutId: 'layout-global',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                instanceKey: 'hero-source-instance',
                sortOrder: 1,
                config: { showLeadForm: true },
                isActive: true,
                version: 2,
                isInherited: false
            }
        ])
        getLayoutZoneWidgetObjects.mockResolvedValueOnce([getLayoutWidgetDefinition('marketing.hero')!])
        assignLayoutZoneWidget.mockResolvedValueOnce({
            data: {
                id: 'hero-new',
                layoutId: 'layout-global',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                config: { showLeadForm: true },
                isActive: true,
                version: 1
            }
        })

        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources/layout/layout-global']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        const add = await screen.findByTestId('available-widget-marketing-main-marketing.hero')
        fireEvent.click(add)
        fireEvent.click(await screen.findByRole('button', { name: 'Save presentation' }))
        await waitFor(() => {
            expect(marketingBindingDialog).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    open: true,
                    widgetId: null,
                    sourceWidgetId: 'hero-source',
                    duplicateMode: false,
                    widgetKey: 'marketing.hero'
                })
            )
        })
        expect(assignLayoutZoneWidget).not.toHaveBeenCalled()
        const addDialogProps = [...marketingBindingDialog.mock.calls]
            .map(([props]) => props as { open: boolean; onSelection: (value: unknown) => Promise<void> })
            .reverse()
            .find(({ open }) => open)
        if (!addDialogProps) throw new Error('The generic binding dialog did not open for Add')
        const bindings = { version: 1, slots: [{ slot: 'content', targets: [] }] }
        const config = { showLeadForm: false, __layout: { neutral: { bindings } } }
        await act(async () => {
            await addDialogProps.onSelection({ bindings, config })
        })
        expect(assignLayoutZoneWidget).toHaveBeenCalledWith('metahub-1', 'layout-global', {
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            config,
            expectedVersion: 5
        })
    })

    it('opens generic duplicate authoring with a persisted same-layout source and applies the selected bindings', async () => {
        mockUseMetahubDetails.mockReturnValue({ data: { permissions: { manageMetahub: true, editContent: true } } })
        getLayout.mockResolvedValueOnce({
            data: {
                id: 'layout-global',
                scopeEntityId: null,
                templateKey: 'marketing-page',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing' } } },
                description: null,
                config: {},
                neutral: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                version: 5,
                createdAt: '2026-04-06T00:00:00.000Z',
                updatedAt: '2026-04-06T00:00:00.000Z'
            }
        })
        listLayoutZoneWidgets.mockResolvedValueOnce([
            {
                id: 'hero-source',
                layoutId: 'layout-global',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                instanceKey: 'hero-a',
                sortOrder: 1,
                config: { showLeadForm: true },
                isActive: true,
                version: 2
            }
        ])
        getLayoutZoneWidgetObjects.mockResolvedValueOnce([getLayoutWidgetDefinition('marketing.hero')!])
        assignLayoutZoneWidget.mockResolvedValueOnce({
            data: {
                id: 'hero-copy',
                layoutId: 'layout-global',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                config: { showLeadForm: true },
                isActive: true,
                version: 1
            }
        })

        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources/layout/layout-global']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        fireEvent.click(await screen.findByTestId('layout-widget-duplicate-hero-source'))
        await waitFor(() => {
            expect(marketingBindingDialog).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    open: true,
                    widgetId: null,
                    sourceWidgetId: 'hero-source',
                    duplicateMode: true,
                    widgetKey: 'marketing.hero'
                })
            )
        })
        expect(assignLayoutZoneWidget).not.toHaveBeenCalled()
        const duplicateDialogProps = [...marketingBindingDialog.mock.calls]
            .map(([props]) => props as { open: boolean; onSelection: (value: unknown) => Promise<void> })
            .reverse()
            .find(({ open }) => open)
        if (!duplicateDialogProps) throw new Error('The generic binding dialog did not open for Duplicate')
        const bindings = { version: 1, slots: [{ slot: 'content', targets: [] }] }
        const config = { showLeadForm: true, __layout: { neutral: { bindings } } }
        await act(async () => {
            await duplicateDialogProps.onSelection({ bindings, config })
        })
        expect(assignLayoutZoneWidget).toHaveBeenCalledWith('metahub-1', 'layout-global', {
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            config,
            expectedVersion: 5
        })
    })

    it('opens the generic binding editor for editing an owned registry-backed widget', async () => {
        mockUseMetahubDetails.mockReturnValue({ data: { permissions: { manageMetahub: true, editContent: true } } })
        getLayout.mockResolvedValueOnce({
            data: {
                id: 'layout-global',
                scopeEntityId: null,
                templateKey: 'marketing-page',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing' } } },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                version: 5,
                createdAt: '2026-04-06T00:00:00.000Z',
                updatedAt: '2026-04-06T00:00:00.000Z'
            }
        })
        listLayoutZoneWidgets.mockResolvedValueOnce([
            {
                id: 'hero-edit',
                layoutId: 'layout-global',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                sortOrder: 1,
                config: { showLeadForm: true },
                isActive: true,
                version: 3,
                isInherited: false
            }
        ])
        getLayoutZoneWidgetObjects.mockResolvedValueOnce([getLayoutWidgetDefinition('marketing.hero')!])

        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layout/layout-global']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        fireEvent.click(await screen.findByTestId('layout-widget-edit-hero-edit'))
        await waitFor(() => {
            expect(marketingBindingDialog).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    open: true,
                    widgetId: 'hero-edit',
                    sourceWidgetId: 'hero-edit',
                    duplicateMode: false,
                    widgetKey: 'marketing.hero',
                    canManageLayouts: true
                })
            )
        })
        expect(marketingConfigDialog).not.toHaveBeenCalledWith(expect.objectContaining({ open: true }))
    })

    it('waits for layout metadata before deriving controls for already-loaded widgets', async () => {
        let resolveLayout: ((response: { data: Record<string, unknown> }) => void) | undefined
        getLayout.mockImplementationOnce(
            () =>
                new Promise<{ data: Record<string, unknown> }>((resolve) => {
                    resolveLayout = resolve
                })
        )
        listLayoutZoneWidgets.mockResolvedValueOnce([
            {
                id: 'widget-awaiting-layout',
                layoutId: 'layout-1',
                instanceKey: 'widget-awaiting-layout-instance',
                zone: 'center',
                widgetKey: 'columnsContainer',
                sortOrder: 1,
                parentInstanceKey: null,
                slotKey: null,
                config: { columns: [] },
                isActive: true,
                isInherited: false
            }
        ])

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/entities/object/instance/object-1/layout/layout-1']}>
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
            expect(listLayoutZoneWidgets).toHaveBeenCalled()
            expect(queryClient.getQueryData(metahubsQueryKeys.layoutZoneWidgets('metahub-1', 'layout-1'))).toHaveLength(1)
        })
        expect(screen.getByRole('progressbar')).toBeInTheDocument()

        if (!resolveLayout) throw new Error('Layout detail request did not start')
        resolveLayout({
            data: {
                id: 'layout-1',
                scopeEntityId: 'object-1',
                templateKey: 'dashboard',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Dashboard' } } },
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

        await waitFor(() => expect(screen.getByTestId('layout-widget-widget-awaiting-layout')).toBeInTheDocument())
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
                <MemoryRouter initialEntries={['/metahub/metahub-1/entities/object/instance/object-1/layout/layout-1']}>
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

    it('opens registry-backed binding details for editContent users while mutation controls still require manageMetahub', async () => {
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false, editContent: true } }
        })
        getLayout.mockResolvedValueOnce({
            data: {
                id: 'layout-marketing',
                scopeEntityId: null,
                templateKey: 'marketing-page',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing page' } } },
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
        listLayoutZoneWidgets.mockResolvedValueOnce([
            {
                id: 'hero-widget',
                layoutId: 'layout-marketing',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                sortOrder: 1,
                config: { showLeadForm: true },
                isActive: true,
                version: 13
            }
        ])
        getLayoutZoneWidgetObjects.mockResolvedValueOnce([getLayoutWidgetDefinition('marketing.hero')!])

        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layout/layout-marketing']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('layout-widget-edit-hero-widget')).toBeInTheDocument())
        const addWidgetButtons = screen.getAllByRole('button', { name: 'Add widget' })
        expect(addWidgetButtons.length).toBeGreaterThan(0)
        for (const button of addWidgetButtons) expect(button).toBeDisabled()
        fireEvent.click(screen.getByTestId('layout-widget-edit-hero-widget'))

        await waitFor(() => {
            expect(marketingBindingDialog).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    open: true,
                    widgetId: 'hero-widget',
                    sourceWidgetId: 'hero-widget',
                    duplicateMode: false,
                    canManageLayouts: false,
                    canEditContent: true
                })
            )
        })
    })

    it('keeps inherited bindings authoritative in marketing overlay layouts', async () => {
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: true, editContent: true } }
        })
        getLayout.mockResolvedValueOnce({
            data: {
                id: 'layout-scoped-marketing',
                scopeEntityId: 'object-1',
                baseLayoutId: 'layout-global-marketing',
                templateKey: 'marketing-page',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Scoped marketing page' } } },
                description: null,
                config: {},
                isActive: true,
                isDefault: false,
                sortOrder: 0,
                version: 1,
                createdAt: '2026-04-06T00:00:00.000Z',
                updatedAt: '2026-04-06T00:00:00.000Z'
            }
        })
        listLayoutZoneWidgets.mockResolvedValueOnce([
            {
                id: 'hero-widget-scoped',
                layoutId: 'layout-scoped-marketing',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                sortOrder: 1,
                config: { showLeadForm: true },
                isActive: true,
                version: 4,
                isInherited: true
            }
        ])
        getLayoutZoneWidgetObjects.mockResolvedValueOnce([getLayoutWidgetDefinition('marketing.hero')!])

        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/entities/object/instance/object-1/layout/layout-scoped-marketing']}>
                    <Routes>
                        <Route
                            path='/metahub/:metahubId/entities/:kindKey/instance/:scopeEntityId/layout/:layoutId'
                            element={<LayoutDetails />}
                        />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('layout-widget-hero-widget-scoped')).toBeInTheDocument())

        expect(screen.queryByTestId('available-widget-marketing-main-marketing.hero')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-edit-hero-widget-scoped')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-duplicate-hero-widget-scoped')).not.toBeInTheDocument()
        expect(marketingBindingDialog).not.toHaveBeenCalledWith(expect.objectContaining({ open: true }))
    })
})
