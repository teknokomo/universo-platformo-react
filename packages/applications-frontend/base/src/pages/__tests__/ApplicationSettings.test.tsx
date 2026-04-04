import { vi } from 'vitest'

import type { ReactNode } from 'react'

vi.mock('@universo/template-mui', () => ({
    TemplateMainCard: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    PAGE_CONTENT_GUTTER_MX: 2,
    PAGE_TAB_BAR_SX: {},
    ViewHeaderMUI: ({ title, description }: { title: string; description?: string }) => (
        <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
        </div>
    )
}))

vi.mock('../../api/useApplicationDetails', () => ({
    useApplicationDetails: vi.fn()
}))

vi.mock('../../api/applications', () => ({
    getApplicationWorkspaceLimits: vi.fn(),
    updateApplicationWorkspaceLimits: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'
import applicationsEn from '../../i18n/locales/en/applications.json'
import applicationsRu from '../../i18n/locales/ru/applications.json'
import ApplicationSettings from '../ApplicationSettings'
import { useApplicationDetails } from '../../api/useApplicationDetails'
import { getApplicationWorkspaceLimits, updateApplicationWorkspaceLimits } from '../../api/applications'

const mockedUseApplicationDetails = vi.mocked(useApplicationDetails)
const mockedGetApplicationWorkspaceLimits = vi.mocked(getApplicationWorkspaceLimits)
const mockedUpdateApplicationWorkspaceLimits = vi.mocked(updateApplicationWorkspaceLimits)

describe('ApplicationSettings', () => {
    beforeEach(async () => {
        vi.clearAllMocks()

        const i18n = getI18nInstance()
        registerNamespace('common', { en: commonEn, ru: commonRu })
        registerNamespace('applications', { en: applicationsEn, ru: applicationsRu })
        await i18n.changeLanguage('en')

        mockedUseApplicationDetails.mockReturnValue({
            data: {
                id: 'app-1',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Workspace Demo' }
                    }
                },
                description: null,
                slug: 'workspace-demo',
                isPublic: false,
                workspacesEnabled: true,
                schemaName: 'app_workspace_demo',
                schemaStatus: 'synced',
                schemaSyncedAt: null,
                schemaError: null,
                connectorsCount: 0,
                membersCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1
            } as never,
            isLoading: false,
            isError: false
        } as never)

        mockedGetApplicationWorkspaceLimits.mockResolvedValue([
            {
                objectId: '018f8a78-7b8f-7c1d-a111-222233334499',
                codename: 'orders',
                codenameDisplay: 'Заказы',
                tableName: 'orders',
                name: 'Orders',
                maxRows: 3
            }
        ])
        mockedUpdateApplicationWorkspaceLimits.mockResolvedValue([])
    })

    it('loads workspace limits and saves edited values', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const i18n = getI18nInstance()

        render(
            <I18nextProvider i18n={i18n}>
                <SnackbarProvider>
                    <QueryClientProvider client={queryClient}>
                        <MemoryRouter initialEntries={['/applications/app-1/settings']}>
                            <Routes>
                                <Route path='/applications/:applicationId/settings' element={<ApplicationSettings />} />
                            </Routes>
                        </MemoryRouter>
                    </QueryClientProvider>
                </SnackbarProvider>
            </I18nextProvider>
        )

        expect(screen.getByText('Application Settings')).toBeInTheDocument()
        expect(screen.queryByText('Workspace Demo')).not.toBeInTheDocument()
        expect(screen.getByText('General application settings will be available in future versions.')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('tab', { name: 'Limits' }))

        await waitFor(() => {
            expect(mockedGetApplicationWorkspaceLimits).toHaveBeenCalledWith('app-1', 'en')
        })

        expect(await screen.findByText('Заказы')).toBeInTheDocument()
        const input = await screen.findByLabelText('Max rows')
        await userEvent.clear(input)
        await userEvent.type(input, '9')
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(mockedUpdateApplicationWorkspaceLimits).toHaveBeenCalledWith('app-1', [
                {
                    objectId: '018f8a78-7b8f-7c1d-a111-222233334499',
                    maxRows: 9
                }
            ])
        })
    })

    it('keeps limits unavailable until runtime schema and workspace mode are ready', async () => {
        mockedUseApplicationDetails.mockReturnValue({
            data: {
                id: 'app-2',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Draft App' }
                    }
                },
                description: null,
                slug: 'draft-app',
                isPublic: false,
                workspacesEnabled: false,
                schemaName: 'app_draft_app',
                schemaStatus: 'draft',
                schemaSyncedAt: null,
                schemaError: null,
                connectorsCount: 0,
                membersCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1
            } as never,
            isLoading: false,
            isError: false
        } as never)

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const i18n = getI18nInstance()

        render(
            <I18nextProvider i18n={i18n}>
                <SnackbarProvider>
                    <QueryClientProvider client={queryClient}>
                        <MemoryRouter initialEntries={['/applications/app-2/settings']}>
                            <Routes>
                                <Route path='/applications/:applicationId/settings' element={<ApplicationSettings />} />
                            </Routes>
                        </MemoryRouter>
                    </QueryClientProvider>
                </SnackbarProvider>
            </I18nextProvider>
        )

        expect(screen.queryByText('Draft App')).not.toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Limits' })).toBeInTheDocument()
        expect(
            screen.getByText('Application settings that depend on runtime schema will become available after the schema is created.')
        ).toBeInTheDocument()
        expect(
            screen.getByText('Workspace-specific settings are available only for applications created with workspace mode enabled.')
        ).toBeInTheDocument()

        await userEvent.click(screen.getByRole('tab', { name: 'Limits' }))
        expect(screen.getByText('Limits settings will become available after the application schema is created.')).toBeInTheDocument()
        expect(mockedGetApplicationWorkspaceLimits).not.toHaveBeenCalled()
    })

    it('does not load limits while schema provisioning is still pending', async () => {
        mockedUseApplicationDetails.mockReturnValue({
            data: {
                id: 'app-3',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Pending App' }
                    }
                },
                description: null,
                slug: 'pending-app',
                isPublic: false,
                workspacesEnabled: true,
                schemaName: 'app_pending_app',
                schemaStatus: 'pending',
                schemaSyncedAt: null,
                schemaError: null,
                connectorsCount: 0,
                membersCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1
            } as never,
            isLoading: false,
            isError: false
        } as never)

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const i18n = getI18nInstance()

        render(
            <I18nextProvider i18n={i18n}>
                <SnackbarProvider>
                    <QueryClientProvider client={queryClient}>
                        <MemoryRouter initialEntries={['/applications/app-3/settings']}>
                            <Routes>
                                <Route path='/applications/:applicationId/settings' element={<ApplicationSettings />} />
                            </Routes>
                        </MemoryRouter>
                    </QueryClientProvider>
                </SnackbarProvider>
            </I18nextProvider>
        )

        await userEvent.click(screen.getByRole('tab', { name: 'Limits' }))

        expect(screen.getByText('Limits settings will become available after the application schema is created.')).toBeInTheDocument()
        expect(screen.queryByText('Failed to load limits')).not.toBeInTheDocument()
        expect(mockedGetApplicationWorkspaceLimits).not.toHaveBeenCalled()
    })
})
