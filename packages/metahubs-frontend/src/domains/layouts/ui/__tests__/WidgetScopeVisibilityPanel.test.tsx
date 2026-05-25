import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { listLayoutWidgetScopeVisibility, updateLayoutWidgetScopeVisibility } = vi.hoisted(() => ({
    listLayoutWidgetScopeVisibility: vi.fn(),
    updateLayoutWidgetScopeVisibility: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => {
            if (key === 'layouts.widgetScopeVisibility.entityMeta') {
                return `${options?.kind ?? ''}${options?.codename ?? ''}`
            }
            return defaultValue ?? key
        },
        i18n: { language: 'ru' }
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('@universo/template-mui', () => ({
    notifyError: vi.fn()
}))

vi.mock('../../api', () => ({
    listLayoutWidgetScopeVisibility,
    updateLayoutWidgetScopeVisibility
}))

import WidgetScopeVisibilityPanel from '../WidgetScopeVisibilityPanel'

const renderPanel = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <WidgetScopeVisibilityPanel metahubId='metahub-1' layoutId='layout-1' widgetId='widget-1' />
        </QueryClientProvider>
    )
}

describe('WidgetScopeVisibilityPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        listLayoutWidgetScopeVisibility.mockResolvedValue([
            {
                scopeEntityId: 'section-1',
                kind: 'section',
                codename: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Courses' },
                        ru: { content: 'Курсы' }
                    }
                },
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Courses' },
                        ru: { content: 'Курсы' }
                    }
                },
                layoutId: null,
                layoutName: null,
                isVisible: true,
                isOverridden: false
            }
        ])
        updateLayoutWidgetScopeVisibility.mockResolvedValue({ data: { item: { scopeEntityId: 'section-1', isVisible: false } } })
    })

    it('renders localized layout-capable scopes and saves visibility overrides', async () => {
        const user = userEvent.setup()
        renderPanel()

        expect(await screen.findByText('Курсы')).toBeInTheDocument()
        expect(screen.getByText('section · Курсы')).toBeInTheDocument()
        expect(screen.getByText('Inherited')).toBeInTheDocument()

        await user.click(screen.getByTestId('layout-widget-scope-visibility-switch-section-1').querySelector('input') as HTMLElement)

        await waitFor(() => {
            expect(updateLayoutWidgetScopeVisibility).toHaveBeenCalledWith('metahub-1', 'layout-1', 'widget-1', 'section-1', false)
        })
    })
})
