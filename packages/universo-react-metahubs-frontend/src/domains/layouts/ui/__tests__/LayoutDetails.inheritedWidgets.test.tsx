import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    moveLayoutZoneWidget,
    replaceLayoutZoneWidgetBindings,
    marketingBindingDialog,
    marketingConfigDialog
} = vi.hoisted(() => ({
    getLayout: vi.fn(),
    listLayoutZoneWidgets: vi.fn(),
    getLayoutZoneWidgetObjects: vi.fn(),
    assignLayoutZoneWidget: vi.fn(),
    moveLayoutZoneWidget: vi.fn(),
    replaceLayoutZoneWidgetBindings: vi.fn(),
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
    LayoutAuthoringDetails: ({ beforeZonesContent, zones, onAddWidgetRequest, onDragEnd }: any) => (
        <div>
            {beforeZonesContent}
            <button
                type='button'
                data-testid='simulate-messenger-nested-reorder'
                onClick={() =>
                    void onDragEnd?.({
                        active: { id: 'messenger-child' },
                        over: { id: 'messenger-sibling', data: { current: undefined } }
                    })
                }
            >
                Simulate nested reorder
            </button>
            <button
                type='button'
                data-testid='simulate-messenger-root-to-slot-drag'
                onClick={() =>
                    void onDragEnd?.({
                        active: { id: 'messenger-root-candidate' },
                        over: {
                            id: 'nested-slot:messenger-container-instance:column:main',
                            data: {
                                current: {
                                    type: 'nested-slot',
                                    parentInstanceKey: 'messenger-container-instance',
                                    slotKey: 'column:main'
                                }
                            }
                        }
                    })
                }
            >
                Simulate root to nested drag
            </button>
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
    moveLayoutZoneWidget,
    replaceLayoutZoneWidgetBindings,
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

vi.mock('../MenuWidgetEditorDialog', () => ({
    default: ({
        open,
        config,
        onSave
    }: {
        open: boolean
        config: { variant: 'generated' | 'manual' } | null
        onSave: (config: { variant: 'generated' | 'manual' }) => void
    }) =>
        open ? (
            <div role='dialog' aria-label='menu widget editor'>
                <span data-testid='menu-widget-editor-variant'>{config?.variant ?? 'generated'}</span>
                <button type='button' data-testid='save-menu-widget' onClick={() => void onSave({ variant: 'generated' })}>
                    Save generated menu
                </button>
            </div>
        ) : null
}))
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

    it('renders persisted Messenger child placements inside their authored parent slot', async () => {
        const parentDefinition = getLayoutWidgetDefinition('columnsContainer')
        const childDefinition = getLayoutWidgetDefinition('detailsTitle')
        if (!parentDefinition || !childDefinition) throw new Error('Messenger placement metadata is missing')

        getLayout.mockResolvedValueOnce({
            data: {
                id: 'layout-messenger',
                scopeEntityId: null,
                templateKey: 'messenger-app',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Messenger' } } },
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
        const parent = {
            id: 'messenger-container',
            layoutId: 'layout-messenger',
            zone: 'center',
            widgetKey: 'columnsContainer',
            instanceKey: 'messenger-container-instance',
            parentInstanceKey: null,
            slotKey: null,
            sortOrder: 0,
            config: { columns: [{ slotKey: 'column:main', width: 12 }] },
            isActive: true,
            isInherited: false,
            version: 1
        }
        const child = {
            id: 'messenger-child',
            layoutId: 'layout-messenger',
            zone: 'center',
            widgetKey: 'detailsTitle',
            instanceKey: 'messenger-child-instance',
            parentInstanceKey: parent.instanceKey,
            slotKey: 'column:main',
            sortOrder: 1,
            config: { align: 'left', level: 'h2' },
            isActive: true,
            isInherited: false,
            version: 1
        }
        const sibling = {
            ...child,
            id: 'messenger-sibling',
            instanceKey: 'messenger-sibling-instance',
            sortOrder: 2,
            version: 2
        }
        const rootCandidate = {
            ...child,
            id: 'messenger-root-candidate',
            instanceKey: 'messenger-root-candidate-instance',
            parentInstanceKey: null,
            slotKey: null,
            sortOrder: 0,
            version: 3
        }
        listLayoutZoneWidgets.mockResolvedValueOnce([parent, child, sibling, rootCandidate])
        getLayoutZoneWidgetObjects.mockResolvedValueOnce([parentDefinition, childDefinition])

        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources/layout/layout-messenger']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('layout-widget-messenger-container')).toBeInTheDocument())
        expect(screen.queryByTestId('layout-widget-messenger-child')).not.toBeInTheDocument()

        const parentSlot = screen.getByRole('group', { name: `${parentDefinition.defaultLabel} · nesting.column` })
        const renderedChildren = within(parentSlot).getAllByText(childDefinition.defaultLabel)
        expect(renderedChildren).toHaveLength(2)
        for (const renderedChild of renderedChildren) {
            expect(renderedChild.closest('[role="group"]')).toBe(parentSlot)
        }

        fireEvent.click(screen.getByTestId('simulate-messenger-nested-reorder'))
        fireEvent.click(screen.getByTestId('simulate-messenger-root-to-slot-drag'))

        await waitFor(() => expect(moveLayoutZoneWidget).toHaveBeenCalledTimes(2))
        expect(moveLayoutZoneWidget).toHaveBeenNthCalledWith(1, 'metahub-1', 'layout-messenger', {
            widgetId: child.id,
            targetZone: 'center',
            targetIndex: 1,
            targetParentInstanceKey: parent.instanceKey,
            targetSlotKey: 'column:main',
            expectedVersion: child.version
        })
        expect(moveLayoutZoneWidget).toHaveBeenNthCalledWith(2, 'metahub-1', 'layout-messenger', {
            widgetId: rootCandidate.id,
            targetZone: 'center',
            targetIndex: 2,
            targetParentInstanceKey: parent.instanceKey,
            targetSlotKey: 'column:main',
            expectedVersion: rootCandidate.version
        })
    })

    it('creates, edits, and reorders a Messenger menu child through API persistence and refetch', async () => {
        const parentDefinition = getLayoutWidgetDefinition('detailsTabs')
        const menuDefinition = getLayoutWidgetDefinition('menuWidget', { variant: 'generated' })
        const siblingDefinition = getLayoutWidgetDefinition('detailsTitle')
        if (!parentDefinition || !menuDefinition || !siblingDefinition) {
            throw new Error('Messenger nested-placement metadata is missing')
        }

        type ServerPlacement = {
            id: string
            layoutId: string
            zone: string
            widgetKey: string
            instanceKey: string
            parentInstanceKey: string | null
            slotKey: string | null
            sortOrder: number
            config: Record<string, unknown>
            isActive: boolean
            isInherited: boolean
            version: number
        }

        const parentInstanceKey = 'messenger-overview-tabs-instance'
        const slotKey = 'tab:overview'
        const menuPlacementId = 'messenger-overview-menu'
        getLayout.mockReset()
        listLayoutZoneWidgets.mockReset()
        getLayoutZoneWidgetObjects.mockReset()
        assignLayoutZoneWidget.mockReset()
        replaceLayoutZoneWidgetBindings.mockReset()
        moveLayoutZoneWidget.mockReset()
        let persistedPlacements: ServerPlacement[] = [
            {
                id: 'messenger-overview-tabs',
                layoutId: 'layout-messenger',
                zone: 'center',
                widgetKey: 'detailsTabs',
                instanceKey: parentInstanceKey,
                parentInstanceKey: null,
                slotKey: null,
                sortOrder: 0,
                config: { tabs: [{ slotKey, label: 'Overview', isDefault: true }] },
                isActive: true,
                isInherited: false,
                version: 1
            },
            {
                id: 'messenger-overview-title',
                layoutId: 'layout-messenger',
                zone: 'center',
                widgetKey: 'detailsTitle',
                instanceKey: 'messenger-overview-title-instance',
                parentInstanceKey,
                slotKey,
                sortOrder: 1,
                config: { align: 'left', level: 'h2' },
                isActive: true,
                isInherited: false,
                version: 1
            }
        ]
        const serverReads: ServerPlacement[][] = []
        const clonePlacement = (placement: ServerPlacement): ServerPlacement => ({
            ...placement,
            config: { ...placement.config }
        })
        const readServerPlacements = () => persistedPlacements.map(clonePlacement)

        getLayout.mockResolvedValue({
            data: {
                id: 'layout-messenger',
                scopeEntityId: null,
                templateKey: 'messenger-app',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Messenger' } } },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                version: 11,
                createdAt: '2026-04-06T00:00:00.000Z',
                updatedAt: '2026-04-06T00:00:00.000Z'
            }
        })
        listLayoutZoneWidgets.mockImplementation(async () => {
            const response = readServerPlacements()
            serverReads.push(response)
            return response
        })
        getLayoutZoneWidgetObjects.mockResolvedValue([parentDefinition, menuDefinition, siblingDefinition])
        assignLayoutZoneWidget.mockImplementationOnce(
            async (
                _metahubId: string,
                layoutId: string,
                input: {
                    zone: string
                    widgetKey: string
                    parentInstanceKey?: string
                    slotKey?: string
                    config?: Record<string, unknown>
                }
            ) => {
                const siblings = persistedPlacements.filter(
                    (placement) =>
                        placement.parentInstanceKey === (input.parentInstanceKey ?? null) && placement.slotKey === (input.slotKey ?? null)
                )
                const createdPlacement: ServerPlacement = {
                    id: menuPlacementId,
                    layoutId,
                    zone: input.zone,
                    widgetKey: input.widgetKey,
                    instanceKey: 'messenger-overview-menu-instance',
                    parentInstanceKey: input.parentInstanceKey ?? null,
                    slotKey: input.slotKey ?? null,
                    sortOrder: siblings.length ? Math.max(...siblings.map(({ sortOrder }) => sortOrder)) + 1 : 0,
                    config: input.config ?? { variant: 'generated' },
                    isActive: true,
                    isInherited: false,
                    version: 1
                }
                persistedPlacements = [...persistedPlacements, createdPlacement]
                return { data: clonePlacement(createdPlacement) }
            }
        )
        replaceLayoutZoneWidgetBindings.mockImplementationOnce(
            async (_metahubId: string, _layoutId: string, widgetId: string, input: { rendererConfig: Record<string, unknown> }) => {
                const placement = persistedPlacements.find(({ id }) => id === widgetId)
                if (!placement) throw new Error(`Unknown placement: ${widgetId}`)
                placement.config = input.rendererConfig
                placement.version += 1
                return { data: { item: clonePlacement(placement) } }
            }
        )
        moveLayoutZoneWidget.mockImplementationOnce(
            async (_metahubId: string, _layoutId: string, input: { widgetId: string; targetIndex?: number; targetZone?: string }) => {
                const moving = persistedPlacements.find(({ id }) => id === input.widgetId)
                if (!moving) throw new Error(`Unknown placement: ${input.widgetId}`)
                const targetZone = input.targetZone ?? moving.zone
                const siblings = persistedPlacements
                    .filter(
                        (placement) =>
                            placement.id !== moving.id &&
                            placement.zone === targetZone &&
                            placement.parentInstanceKey === moving.parentInstanceKey &&
                            placement.slotKey === moving.slotKey
                    )
                    .sort((left, right) => left.sortOrder - right.sortOrder)
                const targetIndex = Math.max(0, Math.min(input.targetIndex ?? siblings.length, siblings.length))
                siblings.splice(targetIndex, 0, moving)
                siblings.forEach((placement, index) => {
                    placement.sortOrder = index
                })
                moving.version += 1
                return { data: { items: readServerPlacements() } }
            }
        )

        render(
            <QueryClientProvider
                client={
                    new QueryClient({
                        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
                    })
                }
            >
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources/layout/layout-messenger']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources/layout/:layoutId' element={<LayoutDetails />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        const getOverviewSlot = () => screen.getByRole('group', { name: /Overview$/ })
        await screen.findByRole('group', { name: /Overview$/ })
        expect(within(getOverviewSlot()).getByTestId('nested-placement-messenger-overview-title')).toBeInTheDocument()

        fireEvent.click(within(getOverviewSlot()).getByRole('button', { name: /^nesting\.addChild:/ }))
        fireEvent.click(await screen.findByRole('menuitem', { name: menuDefinition.defaultLabel }))
        expect(await screen.findByRole('dialog', { name: 'menu widget editor' })).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('save-menu-widget'))

        await waitFor(() => expect(assignLayoutZoneWidget).toHaveBeenCalledOnce())
        await waitFor(() => {
            expect(serverReads.at(-1)?.find(({ id }) => id === menuPlacementId)).toMatchObject({
                widgetKey: 'menuWidget',
                parentInstanceKey,
                slotKey,
                sortOrder: 2,
                config: { variant: 'generated' }
            })
        })
        expect(assignLayoutZoneWidget).toHaveBeenCalledWith('metahub-1', 'layout-messenger', {
            zone: 'center',
            widgetKey: 'menuWidget',
            config: { variant: 'generated' },
            parentInstanceKey,
            slotKey,
            expectedVersion: 11
        })
        const createdMenu = await screen.findByTestId(`nested-placement-${menuPlacementId}`)
        expect(within(getOverviewSlot()).getByTestId(`nested-placement-${menuPlacementId}`)).toBe(createdMenu)

        fireEvent.click(within(createdMenu).getByRole('button', { name: 'common:actions.edit' }))
        expect(await screen.findByRole('dialog', { name: 'menu widget editor' })).toBeInTheDocument()
        expect(screen.getByTestId('menu-widget-editor-variant')).toHaveTextContent('generated')
        fireEvent.click(screen.getByTestId('save-menu-widget'))

        await waitFor(() => {
            expect(serverReads.at(-1)?.find(({ id }) => id === menuPlacementId)).toMatchObject({
                version: 2,
                config: { variant: 'generated' }
            })
        })
        expect(replaceLayoutZoneWidgetBindings).toHaveBeenCalledWith('metahub-1', 'layout-messenger', menuPlacementId, {
            expectedVersion: 1,
            bindings: [],
            rendererConfig: { variant: 'generated' },
            locale: 'en'
        })

        const reorderedMenu = screen.getByTestId(`nested-placement-${menuPlacementId}`)
        fireEvent.click(within(reorderedMenu).getByRole('button', { name: 'nesting.moveUp' }))
        await waitFor(() => {
            expect(serverReads.at(-1)?.find(({ id }) => id === menuPlacementId)).toMatchObject({ sortOrder: 0, version: 3 })
            expect(serverReads.at(-1)?.find(({ id }) => id === 'messenger-overview-title')).toMatchObject({ sortOrder: 1 })
        })
        expect(moveLayoutZoneWidget).toHaveBeenCalledWith('metahub-1', 'layout-messenger', {
            widgetId: menuPlacementId,
            targetZone: 'center',
            targetIndex: 0,
            expectedVersion: 2
        })
        expect(
            Array.from(getOverviewSlot().querySelectorAll('[data-testid^="nested-placement-"]')).map((element) =>
                element.getAttribute('data-testid')
            )
        ).toEqual([`nested-placement-${menuPlacementId}`, 'nested-placement-messenger-overview-title'])
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
