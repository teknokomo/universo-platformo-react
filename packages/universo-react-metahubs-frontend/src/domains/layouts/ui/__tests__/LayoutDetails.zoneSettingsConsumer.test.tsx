import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const localeMocks = vi.hoisted(() => ({ language: 'en' as 'en' | 'ru' }))
const permissionMocks = vi.hoisted(() => ({ canManage: true }))
const snackbarMocks = vi.hoisted(() => ({ enqueueSnackbar: vi.fn() }))

const dictionaries = {
    ru: {
        'layouts.zones.marketingHeader': 'Шапка маркетинговой страницы',
        'layouts.zones.marketingMain': 'Содержимое маркетинговой страницы',
        'layouts.zones.marketingFooter': 'Подвал маркетинговой страницы',
        'layouts.zoneSettings.settings': 'Настройки',
        'layouts.zoneSettings.headerBehavior': 'Поведение шапки',
        'layouts.zoneSettings.fixed': 'Закреплена на экране',
        'layouts.zoneSettings.flow': 'Прокручивается вместе со страницей',
        'layouts.zoneSettings.inherited': 'Унаследовано из текущего источника макета',
        'layouts.zoneSettings.customized': 'Настроено для этого макета',
        'layouts.zoneSettings.cancel': 'Отмена',
        'layouts.zoneSettings.save': 'Сохранить',
        'layouts.zoneSettings.reset': 'Сбросить переопределение',
        'layouts.zoneSettings.saving': 'Сохранение…',
        'layouts.zoneSettingVersionConflict': 'Макет изменился в другой сессии. Перезагрузите его и повторите попытку.'
    }
} as const

const commonTranslations = (key: string, fallbackOrOptions?: string | { defaultValue?: string }) => {
    const localized = localeMocks.language === 'ru' ? dictionaries.ru[key as keyof typeof dictionaries.ru] : undefined
    const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : fallbackOrOptions?.defaultValue
    return localized ?? fallback ?? key
}

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const localized = localeMocks.language === 'ru' ? dictionaries.ru[key as keyof typeof dictionaries.ru] : undefined
            const template = localized ?? fallback ?? key
            if (!params) return template
            return Object.entries(params).reduce(
                (message, [paramKey, value]) => message.replace(`{{${paramKey}}}`, String(value)),
                template
            )
        },
        i18n: { language: localeMocks.language }
    })
}))

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({ t: commonTranslations })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: snackbarMocks.enqueueSnackbar })
}))

vi.mock('@universo-react/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo-react/template-mui')>('@universo-react/template-mui')
    return {
        ...actual,
        TemplateMainCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        ViewHeaderMUI: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
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

vi.mock('../../api', () => ({
    ...layoutApiMocks
}))

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
import { metahubsQueryKeys } from '../../../shared'

const createMarketingLayout = (neutral: Record<string, unknown> = {}) => ({
    id: 'layout-1',
    scopeEntityId: null,
    templateKey: 'marketing-page',
    name: {
        _schema: 'v1',
        _primary: 'en',
        locales: {
            en: { content: 'Marketing page' },
            ru: { content: 'Маркетинговая страница' }
        }
    },
    description: null,
    config: {},
    neutral,
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    version: 7,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z'
})

const renderPage = (layout: ReturnType<typeof createMarketingLayout>) => {
    layoutApiMocks.getLayout.mockResolvedValue({ data: layout })
    layoutApiMocks.listLayoutZoneWidgets.mockResolvedValue([])
    layoutApiMocks.getLayoutZoneWidgetObjects.mockResolvedValue([])

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })
    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/metahub/metahub-1/resources/layout/layout-1']}>
                <Routes>
                    <Route path='/metahub/:metahubId/resources/layout/:layoutId' element={<LayoutDetails />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
    return { ...result, queryClient }
}

describe('LayoutDetails shared zone-settings consumer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localeMocks.language = 'en'
        permissionMocks.canManage = true
        vi.stubGlobal(
            'ResizeObserver',
            class ResizeObserver {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
    })

    it('uses the real shared controls for keyboard focus, pending state and version-conflict rollback', async () => {
        const user = userEvent.setup()
        const layout = createMarketingLayout({ zoneSettings: { 'marketing-header': { position: 'fixed' } } })
        let rejectUpdate!: (reason?: unknown) => void
        layoutApiMocks.updateLayoutZoneSetting.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectUpdate = reject)))
        const { queryClient } = renderPage(layout)

        const settingsButton = await screen.findByRole('button', { name: 'Settings: Marketing header' })
        await act(async () => {
            settingsButton.focus()
        })
        await user.keyboard('{Enter}')

        const dialog = await screen.findByRole('dialog', { name: 'Settings: Marketing header' })
        expect(dialog).toHaveClass('MuiDialog-paperFullWidth', 'MuiDialog-paperWidthSm')
        expect(within(dialog).getByText('Customized for this layout')).toBeInTheDocument()
        await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))

        await user.click(within(dialog).getByRole('radio', { name: 'Scrolls with page' }))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(layoutApiMocks.updateLayoutZoneSetting).toHaveBeenCalledWith(
                'metahub-1',
                'layout-1',
                'marketing-header',
                'position',
                'flow',
                7
            )
        })
        expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDisabled()
        expect(
            queryClient.getQueryData<any>(metahubsQueryKeys.layoutDetail('metahub-1', 'layout-1'))?.neutral?.zoneSettings?.[
                'marketing-header'
            ]?.position
        ).toBe('flow')

        rejectUpdate({
            response: { status: 409, data: { code: 'METAHUB_LAYOUT_ZONE_SETTING_VERSION_CONFLICT' } }
        })

        await waitFor(() => {
            expect(within(dialog).getByText('This layout changed in another session. Reload it and try again.')).toBeInTheDocument()
        })
        expect(
            queryClient.getQueryData<any>(metahubsQueryKeys.layoutDetail('metahub-1', 'layout-1'))?.neutral?.zoneSettings?.[
                'marketing-header'
            ]?.position
        ).toBe('fixed')

        const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' })
        await waitFor(() => expect(cancelButton).toBeEnabled())
        await user.click(cancelButton)
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings: Marketing header' })).not.toBeInTheDocument())
        await waitFor(() => expect(settingsButton).toHaveFocus())
    })

    it('shows inherited/customized state and performs a targeted reset with the current version', async () => {
        const user = userEvent.setup()
        const layout = createMarketingLayout({ zoneSettings: { 'marketing-header': { position: 'flow' } } })
        layoutApiMocks.resetLayoutZoneSetting.mockResolvedValueOnce({ ...layout, neutral: {}, version: 8 })
        renderPage(layout)

        expect(await screen.findByText('Customized for this layout')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Settings: Marketing header' }))
        const dialog = screen.getByRole('dialog', { name: 'Settings: Marketing header' })
        expect(within(dialog).getByText('Customized for this layout')).toBeInTheDocument()
        const resetButton = within(dialog).getByRole('button', { name: 'Reset override' })
        expect(resetButton).toBeEnabled()
        await user.click(resetButton)

        await waitFor(() => {
            expect(layoutApiMocks.resetLayoutZoneSetting).toHaveBeenCalledWith('metahub-1', 'layout-1', 'marketing-header', 'position', 7)
        })
    })

    it('keeps inherited zone settings localized and read-only without exposing mutation controls', async () => {
        const user = userEvent.setup()
        localeMocks.language = 'ru'
        permissionMocks.canManage = false
        const layout = createMarketingLayout()
        renderPage(layout)

        const settingsButton = await screen.findByRole('button', { name: 'Настройки: Шапка маркетинговой страницы' })
        expect(settingsButton).toBeEnabled()
        await user.click(settingsButton)
        const dialog = screen.getByRole('dialog', { name: 'Настройки: Шапка маркетинговой страницы' })
        expect(within(dialog).getByText('Унаследовано из текущего источника макета')).toBeInTheDocument()
        expect(within(dialog).getByRole('radio', { name: 'Закреплена на экране' })).toBeDisabled()
        expect(within(dialog).getByRole('radio', { name: 'Прокручивается вместе со страницей' })).toBeDisabled()
        expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled()
        expect(within(dialog).getByRole('button', { name: 'Сбросить переопределение' })).toBeDisabled()
        await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))
        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: 'Настройки: Шапка маркетинговой страницы' })).not.toBeInTheDocument()
        )
        expect(layoutApiMocks.updateLayoutZoneSetting).not.toHaveBeenCalled()
        expect(layoutApiMocks.resetLayoutZoneSetting).not.toHaveBeenCalled()
    })
})
