import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({
    enqueueSnackbar: vi.fn(),
    listSettingsByCategory: vi.fn(),
    upsertSettingsBatch: vi.fn()
}))

vi.mock('@universo/template-mui', () => ({
    TemplateMainCard: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    PAGE_CONTENT_GUTTER_MX: 2,
    PAGE_TAB_BAR_SX: {},
    ViewHeaderMUI: ({ title }: { title: string }) => <h1>{title}</h1>
}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key
        })
    }
})

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar })
}))

vi.mock('../api/settingsApi', () => ({
    listSettingsByCategory: mocks.listSettingsByCategory,
    upsertSettingsBatch: mocks.upsertSettingsBatch
}))

import AdminSettings from './AdminSettings'

describe('AdminSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mocks.listSettingsByCategory.mockImplementation(async (category: string) => {
            if (category === 'general') {
                return {
                    items: [
                        {
                            id: 'setting-general-1',
                            category: 'general',
                            key: 'dialogSizePreset',
                            value: { _value: 'medium' },
                            createdAt: '2026-04-06T12:00:00.000Z',
                            updatedAt: '2026-04-06T12:00:00.000Z'
                        },
                        {
                            id: 'setting-general-2',
                            category: 'general',
                            key: 'dialogAllowFullscreen',
                            value: { _value: true },
                            createdAt: '2026-04-06T12:00:00.000Z',
                            updatedAt: '2026-04-06T12:00:00.000Z'
                        },
                        {
                            id: 'setting-general-3',
                            category: 'general',
                            key: 'dialogAllowResize',
                            value: { _value: true },
                            createdAt: '2026-04-06T12:00:00.000Z',
                            updatedAt: '2026-04-06T12:00:00.000Z'
                        },
                        {
                            id: 'setting-general-4',
                            category: 'general',
                            key: 'dialogCloseBehavior',
                            value: { _value: 'strict-modal' },
                            createdAt: '2026-04-06T12:00:00.000Z',
                            updatedAt: '2026-04-06T12:00:00.000Z'
                        }
                    ],
                    total: 4
                }
            }

            return {
                items: [],
                total: 0
            }
        })

        mocks.upsertSettingsBatch.mockResolvedValue({
            items: [
                {
                    id: 'setting-general-2',
                    category: 'general',
                    key: 'dialogAllowFullscreen',
                    value: { _value: false },
                    createdAt: '2026-04-06T12:00:00.000Z',
                    updatedAt: '2026-04-06T12:05:00.000Z'
                }
            ],
            total: 1
        })
    })

    it('loads general dialog settings and saves edited values', async () => {
        const user = userEvent.setup()
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <AdminSettings />
            </QueryClientProvider>
        )

        expect(screen.getByText('settings.title')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByTestId('admin-setting-dialogAllowFullscreen')).toBeInTheDocument()
        })

        const fullscreenToggle = screen
            .getByTestId('admin-setting-dialogAllowFullscreen')
            .querySelector('input[type="checkbox"]') as HTMLInputElement | null

        expect(fullscreenToggle).not.toBeNull()
        await user.click(fullscreenToggle!)
        await user.click(screen.getByRole('button', { name: 'settings.save' }))

        await waitFor(() => {
            expect(mocks.upsertSettingsBatch).toHaveBeenCalledWith('general', {
                dialogAllowFullscreen: false
            })
        })
    })
})