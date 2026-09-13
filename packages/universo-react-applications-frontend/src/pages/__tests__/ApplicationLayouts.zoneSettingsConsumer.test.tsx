import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 15_000 })

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
    updateApplicationLayoutZoneSetting: vi.fn(),
    resetApplicationLayoutZoneSetting: vi.fn(),
    updateApplicationLayoutWidgetConfig: vi.fn(),
    createApplicationLayout: vi.fn(),
    updateApplicationLayout: vi.fn(),
    deleteApplicationLayout: vi.fn(),
    copyApplicationLayout: vi.fn()
}))

const snackbarMocks = vi.hoisted(() => ({ enqueueSnackbar: vi.fn() }))
const localeMocks = vi.hoisted(() => ({ language: 'en' as 'en' | 'ru' }))

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

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: snackbarMocks.enqueueSnackbar })
}))

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
    useCommonTranslations: () => ({
        t: (key: string, fallbackOrOptions?: string | { defaultValue?: string }) => {
            const localized = localeMocks.language === 'ru' ? dictionaries.ru[key as keyof typeof dictionaries.ru] : undefined
            const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : fallbackOrOptions?.defaultValue
            return localized ?? fallback ?? key
        }
    })
}))

vi.mock('@universo-react/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo-react/template-mui')>('@universo-react/template-mui')
    return {
        ...actual,
        ViewHeaderMUI: ({ title, children }: { title: string; children?: React.ReactNode }) => (
            <div>
                <h1>{title}</h1>
                {children}
            </div>
        ),
        LayoutAuthoringList: () => null,
        LayoutStateChips: () => null,
        MarketingWidgetConfigDialog: () => null,
        useConfirm: () => ({ confirm: vi.fn(async () => true) })
    }
})

vi.mock('../application-layouts/LayoutRuntimeSettingsPanels', () => ({ LayoutRuntimeSettingsPanels: () => null }))
vi.mock('../application-layouts/ApplicationLayoutListDialogs', () => ({ ApplicationLayoutListDialogs: () => null }))
vi.mock('../application-layouts/ApplicationLayoutWidgetEditors', () => ({ ApplicationLayoutWidgetEditors: () => null }))
vi.mock('../application-layouts/ApplicationLayoutListMenu', () => ({ ApplicationLayoutListMenu: () => null }))
vi.mock('../application-layouts/ApplicationMarketingAppearancePanel', () => ({ ApplicationMarketingAppearancePanel: () => null }))

vi.mock('../../api/applications', () => ({
    ...apiMocks
}))

import ApplicationLayouts from '../ApplicationLayouts'
import { applicationsQueryKeys } from '../../api/queryKeys'

const createMarketingLayout = (neutral: Record<string, unknown> = {}) => ({
    id: 'layout-1',
    scopeId: 'global',
    scopeKind: 'global',
    scopeEntityId: null,
    templateKey: 'marketing-page',
    name: { en: 'Marketing page', ru: 'Маркетинговая страница' },
    description: null,
    config: {},
    neutral,
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    sourceKind: 'metahub',
    sourceLayoutId: 'source-layout-1',
    sourceSnapshotHash: null,
    sourceContentHash: null,
    localContentHash: null,
    syncState: 'clean',
    isSourceExcluded: false,
    version: 7
})

const configureMarketingQueries = (layout: ReturnType<typeof createMarketingLayout>) => {
    apiMocks.listApplicationLayouts.mockResolvedValue({
        items: [layout],
        pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
    })
    apiMocks.getApplicationLayout.mockResolvedValue({ item: layout, widgets: [] })
    apiMocks.listApplicationLayoutWidgetObject.mockResolvedValue([])
}

const renderPage = (layout: ReturnType<typeof createMarketingLayout>, canManage = true) => {
    configureMarketingQueries(layout)
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })
    queryClient.setQueryData(applicationsQueryKeys.detail('app-1'), {
        id: 'app-1',
        role: canManage ? 'owner' : 'member',
        permissions: { manageApplication: canManage }
    })

    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/a/app-1/admin/layouts/layout-1']}>
                <Routes>
                    <Route path='/a/:applicationId/admin/layouts/:layoutId' element={<ApplicationLayouts />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
    return { ...result, queryClient }
}

describe('ApplicationLayouts shared zone-settings consumer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localeMocks.language = 'en'
        apiMocks.listApplicationLayoutScopes.mockResolvedValue([
            { id: 'global', scopeKind: 'global', scopeEntityId: null, kind: null, tableName: null, codename: {}, name: 'Global' }
        ])
    })

    it('uses the real shared authoring/settings controls for keyboard focus, pending state and conflict rollback', async () => {
        const user = userEvent.setup()
        const layout = createMarketingLayout({ sourceZoneSettings: { 'marketing-header': { position: 'fixed' } } })
        let rejectUpdate!: (reason?: unknown) => void
        apiMocks.updateApplicationLayoutZoneSetting.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectUpdate = reject)))
        const { queryClient } = renderPage(layout)

        const settingsButton = await screen.findByRole('button', { name: 'Settings: Marketing header' })
        await act(async () => {
            settingsButton.focus()
        })
        await user.keyboard('{Enter}')

        const dialog = await screen.findByRole('dialog', { name: 'Settings: Marketing header' })
        expect(dialog).toHaveClass('MuiDialog-paperFullWidth', 'MuiDialog-paperWidthSm')
        expect(within(dialog).getByText('Inherited from the current layout source')).toBeInTheDocument()
        await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
        expect(within(dialog).getByRole('button', { name: 'Reset override' })).toBeDisabled()

        await user.click(within(dialog).getByRole('radio', { name: 'Scrolls with page' }))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(apiMocks.updateApplicationLayoutZoneSetting).toHaveBeenCalledWith('app-1', 'layout-1', 'marketing-header', 'position', {
                value: 'flow',
                expectedVersion: 7
            })
        })
        expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDisabled()
        expect(
            queryClient.getQueryData<any>(applicationsQueryKeys.layoutDetail('app-1', 'layout-1'))?.item?.neutral?.zoneSettings?.[
                'marketing-header'
            ]?.position
        ).toBe('flow')

        rejectUpdate({
            isAxiosError: true,
            response: { status: 409, data: { error: 'APPLICATION_LAYOUT_ZONE_SETTING_VERSION_CONFLICT' } }
        })

        await waitFor(() => {
            expect(within(dialog).getByText('This layout changed in another session. Reload it and try again.')).toBeInTheDocument()
        })
        expect(
            queryClient.getQueryData<any>(applicationsQueryKeys.layoutDetail('app-1', 'layout-1'))?.item?.neutral?.zoneSettings
        ).toBeUndefined()

        const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' })
        await waitFor(() => expect(cancelButton).toBeEnabled())
        await user.click(cancelButton)
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings: Marketing header' })).not.toBeInTheDocument())
        await waitFor(() => expect(settingsButton).toHaveFocus())
    })

    it('shows customized state through the real shared authoring surface and performs a targeted reset', async () => {
        const user = userEvent.setup()
        const layout = createMarketingLayout({
            zoneSettings: { 'marketing-header': { position: 'flow' } },
            sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
        })
        apiMocks.resetApplicationLayoutZoneSetting.mockResolvedValueOnce({
            ...layout,
            neutral: { sourceZoneSettings: { 'marketing-header': { position: 'fixed' } } },
            version: 8
        })
        renderPage(layout)

        expect(await screen.findByText('Customized for this layout')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Settings: Marketing header' }))
        const dialog = screen.getByRole('dialog', { name: 'Settings: Marketing header' })
        expect(within(dialog).getByText('Customized for this layout')).toBeInTheDocument()
        const resetButton = within(dialog).getByRole('button', { name: 'Reset override' })
        expect(resetButton).toBeEnabled()
        await user.click(resetButton)

        await waitFor(() => {
            expect(apiMocks.resetApplicationLayoutZoneSetting).toHaveBeenCalledWith('app-1', 'layout-1', 'marketing-header', 'position', {
                expectedVersion: 7
            })
        })
    })

    it('exposes localized read-only access through the real shared authoring action', async () => {
        const user = userEvent.setup()
        localeMocks.language = 'ru'
        const layout = createMarketingLayout({ sourceZoneSettings: { 'marketing-header': { position: 'fixed' } } })
        renderPage(layout, false)

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
        expect(apiMocks.updateApplicationLayoutZoneSetting).not.toHaveBeenCalled()
        expect(apiMocks.resetApplicationLayoutZoneSetting).not.toHaveBeenCalled()
    })

    it('keeps customized read-only settings visible while preventing reset and save', async () => {
        const user = userEvent.setup()
        const layout = createMarketingLayout({
            zoneSettings: { 'marketing-header': { position: 'flow' } },
            sourceZoneSettings: { 'marketing-header': { position: 'fixed' } }
        })
        renderPage(layout, false)

        const settingsButton = await screen.findByRole('button', { name: 'Settings: Marketing header' })
        await user.click(settingsButton)
        const dialog = screen.getByRole('dialog', { name: 'Settings: Marketing header' })
        expect(within(dialog).getByText('Customized for this layout')).toBeInTheDocument()
        expect(within(dialog).getByRole('radio', { name: 'Fixed on screen' })).toBeDisabled()
        expect(within(dialog).getByRole('radio', { name: 'Scrolls with page' })).toBeDisabled()
        expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
        expect(within(dialog).getByRole('button', { name: 'Reset override' })).toBeDisabled()

        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings: Marketing header' })).not.toBeInTheDocument())
        expect(apiMocks.updateApplicationLayoutZoneSetting).not.toHaveBeenCalled()
        expect(apiMocks.resetApplicationLayoutZoneSetting).not.toHaveBeenCalled()
    })
})
