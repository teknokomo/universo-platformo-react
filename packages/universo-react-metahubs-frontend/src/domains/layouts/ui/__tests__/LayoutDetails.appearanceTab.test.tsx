import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

const layoutApiMocks = vi.hoisted(() => ({
    getLayout: vi.fn(),
    listLayoutZoneWidgets: vi.fn(),
    getLayoutZoneWidgetObjects: vi.fn(),
    updateLayout: vi.fn(),
    updateLayoutZoneSetting: vi.fn(),
    resetLayoutZoneSetting: vi.fn(),
    assignLayoutZoneWidget: vi.fn(),
    moveLayoutZoneWidget: vi.fn(),
    removeLayoutZoneWidget: vi.fn(),
    resetLayoutZoneWidgetOverride: vi.fn(),
    updateLayoutZoneWidgetConfig: vi.fn(),
    toggleLayoutZoneWidgetActive: vi.fn()
}))

const permissionMocks = vi.hoisted(() => ({ canManage: true }))
const snackbarMocks = vi.hoisted(() => ({ enqueueSnackbar: vi.fn() }))
const themePresetHookMocks = vi.hoisted(() => ({
    useThemePresetsQuery: vi.fn(),
    useApplyLayoutAppearance: vi.fn(),
    useResetLayoutAppearance: vi.fn(),
    useApplyLatestLayoutAppearance: vi.fn(),
    useCreateThemePreset: vi.fn(),
    useCopyThemePreset: vi.fn(),
    useDeleteThemePreset: vi.fn()
}))

const idleMutation = { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})) }

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, fallback?: string | { defaultValue?: string }) =>
            (typeof fallback === 'string' ? fallback : fallback?.defaultValue) ?? key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, fallbackOrOptions?: string | { defaultValue?: string }) =>
            (typeof fallbackOrOptions === 'string' ? fallbackOrOptions : fallbackOrOptions?.defaultValue) ?? key
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: snackbarMocks.enqueueSnackbar })
}))

vi.mock('@universo-react/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo-react/template-mui')>('@universo-react/template-mui')
    return {
        ...actual,
        TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        ViewHeaderMUI: ({ title, children }: { title?: string; children?: ReactNode }) => (
            <div>
                <h1>{title}</h1>
                {children}
            </div>
        ),
        MarketingWidgetConfigDialog: () => null,
        notifyError: vi.fn(),
        useConfirm: () => ({ confirm: vi.fn(async () => true) })
    }
})

vi.mock('@universo-react/template-mui/components/dialogs', () => ({ ConfirmDeleteDialog: () => null }))
vi.mock('../MarketingWidgetBindingDialog', () => ({ default: () => null }))

vi.mock('../../api', () => ({
    ...layoutApiMocks
}))

vi.mock('../../api/themePresets', () => ({
    exportThemePreset: vi.fn(),
    listThemePresets: vi.fn()
}))

vi.mock('../hooks/useThemePresets', () => themePresetHookMocks)

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: () => ({ data: { permissions: { manageMetahub: permissionMocks.canManage } } })
}))

vi.mock('../../../entities/hooks', () => ({
    useEntityInstancesQuery: () => ({ data: { items: [] }, isLoading: false, error: null, refetch: vi.fn() })
}))

vi.mock('../MenuWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../ColumnsContainerEditorDialog', () => ({ default: () => null }))
vi.mock('../QuizWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../PlayCanvasCanvasWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../InterpretationNetworkWorkspaceWidgetEditorDialog', () => ({ default: () => null }))
vi.mock('../WidgetBehaviorEditorDialog', () => ({ default: () => null }))
vi.mock('../LayoutRuntimeSettingsPanel', () => ({ default: () => null }))

import LayoutDetails from '../LayoutDetails'

const createDashboardLayout = () => ({
    id: 'layout-1',
    scopeEntityId: null,
    templateKey: 'dashboard',
    name: {
        _schema: 'v1',
        _primary: 'en',
        locales: {
            en: { content: 'Dashboard layout' },
            ru: { content: 'Макет дашборда' }
        }
    },
    description: null,
    config: {},
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    version: 5,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z'
})

const renderPage = () => {
    layoutApiMocks.getLayout.mockResolvedValue({ data: createDashboardLayout() })
    layoutApiMocks.listLayoutZoneWidgets.mockResolvedValue([])
    layoutApiMocks.getLayoutZoneWidgetObjects.mockResolvedValue([])

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/metahub/metahub-1/resources/layout/layout-1']}>
                <Routes>
                    <Route path='/metahub/:metahubId/resources/layout/:layoutId' element={<LayoutDetails />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('LayoutDetails appearance tab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        permissionMocks.canManage = true
        themePresetHookMocks.useThemePresetsQuery.mockReturnValue({
            data: { file: [], presets: [] },
            isLoading: false,
            isError: false,
            refetch: vi.fn()
        })
        for (const hook of [
            'useApplyLayoutAppearance',
            'useResetLayoutAppearance',
            'useApplyLatestLayoutAppearance',
            'useCreateThemePreset',
            'useCopyThemePreset',
            'useDeleteThemePreset'
        ] as const) {
            themePresetHookMocks[hook].mockReturnValue(idleMutation)
        }
        vi.stubGlobal(
            'ResizeObserver',
            class ResizeObserver {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
    })

    it('shows the main authoring content by default and the appearance section only on its tab', async () => {
        const user = userEvent.setup()
        renderPage()

        // Default tab is "Main": zone authoring is visible, appearance is not.
        expect((await screen.findAllByText('No widgets in this zone yet.')).length).toBeGreaterThan(0)
        expect(screen.queryByTestId('metahub-appearance-section')).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: 'Theme' }))

        // Appearance tab: the shared appearance section replaces zone authoring.
        expect(await screen.findByTestId('metahub-appearance-section')).toBeInTheDocument()
        expect(screen.queryByText('No widgets in this zone yet.')).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: 'Main' }))

        expect((await screen.findAllByText('No widgets in this zone yet.')).length).toBeGreaterThan(0)
        expect(screen.queryByTestId('metahub-appearance-section')).not.toBeInTheDocument()
    })
})
