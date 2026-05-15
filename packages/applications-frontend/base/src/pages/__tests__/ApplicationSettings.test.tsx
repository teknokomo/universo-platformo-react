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
    updateApplicationWorkspaceLimits: vi.fn(),
    updateApplication: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
import { getApplicationWorkspaceLimits, updateApplication, updateApplicationWorkspaceLimits } from '../../api/applications'

const mockedUseApplicationDetails = vi.mocked(useApplicationDetails)
const mockedGetApplicationWorkspaceLimits = vi.mocked(getApplicationWorkspaceLimits)
const mockedUpdateApplication = vi.mocked(updateApplication)
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
        mockedUpdateApplication.mockResolvedValue({
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
                settings: {
                    dialogSizePreset: 'medium',
                    dialogAllowFullscreen: false,
                    dialogAllowResize: true,
                    dialogCloseBehavior: 'strict-modal'
                },
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
                version: 2
            }
        } as never)
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
        expect(screen.getByTestId('application-setting-dialogSizePreset')).toBeInTheDocument()

        const fullscreenToggle = screen
            .getByTestId('application-setting-dialogAllowFullscreen')
            .querySelector('input[type="checkbox"]') as HTMLInputElement | null

        expect(fullscreenToggle).not.toBeNull()
        await userEvent.click(fullscreenToggle!)
        await userEvent.click(screen.getByTestId('application-settings-general-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    expectedVersion: 1,
                    settings: expect.objectContaining({
                        dialogAllowFullscreen: false
                    })
                })
            )
        })

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

        await userEvent.click(screen.getByRole('tab', { name: 'Limits' }))
        expect(
            screen.getByText(
                'Set row limits per object for every workspace. When the limit is reached, users will not be able to create more records in that object.'
            )
        ).toBeInTheDocument()
        expect(screen.getByText('Limits settings will become available after the application schema is created.')).toBeInTheDocument()
        expect(
            screen.queryByText('Limits are available only for applications created with workspace mode enabled.')
        ).not.toBeInTheDocument()
        expect(mockedGetApplicationWorkspaceLimits).not.toHaveBeenCalled()
    })

    it('saves mutable application visibility through the shared general save button and keeps workspace mode read-only', async () => {
        mockedUpdateApplication.mockResolvedValueOnce({
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
                isPublic: true,
                workspacesEnabled: true,
                schemaName: 'app_workspace_demo',
                schemaStatus: 'synced',
                schemaSyncedAt: null,
                schemaError: null,
                connectorsCount: 0,
                membersCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 2
            }
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
                        <MemoryRouter initialEntries={['/applications/app-1/settings']}>
                            <Routes>
                                <Route path='/applications/:applicationId/settings' element={<ApplicationSettings />} />
                            </Routes>
                        </MemoryRouter>
                    </QueryClientProvider>
                </SnackbarProvider>
            </I18nextProvider>
        )

        expect(screen.getByTestId('application-setting-visibility')).toHaveTextContent('Workspace mode')
        expect(screen.getByTestId('application-setting-visibility')).toHaveTextContent('Enabled')

        const visibilitySwitch = within(screen.getByTestId('application-setting-visibility')).getByRole('switch') as HTMLInputElement
        await userEvent.click(visibilitySwitch)

        expect(screen.queryByTestId('application-settings-visibility-save')).not.toBeInTheDocument()
        await userEvent.click(screen.getByTestId('application-settings-general-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    isPublic: true,
                    expectedVersion: 1,
                    settings: expect.objectContaining({
                        dialogSizePreset: expect.any(String)
                    })
                })
            )
        })
    })

    it('saves generic runtime policy settings through the general settings form', async () => {
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

        await userEvent.click(within(screen.getByTestId('application-setting-dashboardDefaultMode')).getByRole('combobox'))
        await userEvent.click(screen.getByRole('option', { name: 'First menu item' }))
        await userEvent.click(within(screen.getByTestId('application-setting-datasourceExecutionPolicy')).getByRole('combobox'))
        await userEvent.click(screen.getByRole('option', { name: 'Layout only' }))
        await userEvent.click(within(screen.getByTestId('application-setting-workspaceOpenBehavior')).getByRole('combobox'))
        await userEvent.click(screen.getByRole('option', { name: 'Default workspace' }))
        await userEvent.click(screen.getByTestId('application-settings-general-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    expectedVersion: 1,
                    settings: expect.objectContaining({
                        dashboardDefaultMode: 'first-menu-item',
                        datasourceExecutionPolicy: 'layout-only',
                        workspaceOpenBehavior: 'default-workspace'
                    })
                })
            )
        })
    })

    it('saves connector schema diff localization setting from the connectors tab', async () => {
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

        await userEvent.click(screen.getByRole('tab', { name: 'Connectors' }))
        await userEvent.click(screen.getByTestId('application-settings-schema-diff-localized-labels-switch'))
        await userEvent.click(screen.getByTestId('application-settings-connectors-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    expectedVersion: 1,
                    settings: expect.objectContaining({
                        schemaDiffLocalizedLabels: false
                    })
                })
            )
        })
    })

    it('saves role policy capabilities through the access settings tab', async () => {
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

        await userEvent.click(screen.getByRole('tab', { name: 'Access' }))
        await userEvent.click(screen.getByRole('checkbox', { name: 'member readReports' }))
        await userEvent.click(screen.getByTestId('application-settings-access-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    expectedVersion: 1,
                    settings: expect.objectContaining({
                        rolePolicies: expect.objectContaining({
                            templates: expect.arrayContaining([
                                expect.objectContaining({
                                    baseRole: 'member',
                                    rules: expect.arrayContaining([
                                        expect.objectContaining({
                                            capability: 'readReports',
                                            effect: 'allow',
                                            scope: 'workspace'
                                        })
                                    ])
                                })
                            ])
                        })
                    })
                })
            )
        })
    })

    it('does not send server-managed public runtime settings from the general settings form', async () => {
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
                version: 5,
                settings: {
                    dialogSizePreset: 'medium',
                    dialogAllowFullscreen: true,
                    dialogAllowResize: true,
                    dialogCloseBehavior: 'strict-modal',
                    sectionLinksEnabled: true,
                    dashboardDefaultMode: 'layout-default',
                    datasourceExecutionPolicy: 'workspace-scoped',
                    workspaceOpenBehavior: 'last-used',
                    publicRuntime: {
                        guest: {
                            objects: { students: 'Students' }
                        }
                    }
                }
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
                        <MemoryRouter initialEntries={['/applications/app-1/settings']}>
                            <Routes>
                                <Route path='/applications/:applicationId/settings' element={<ApplicationSettings />} />
                            </Routes>
                        </MemoryRouter>
                    </QueryClientProvider>
                </SnackbarProvider>
            </I18nextProvider>
        )

        const sectionLinksSwitch = within(screen.getByTestId('application-setting-sectionLinksEnabled')).getByRole(
            'switch'
        ) as HTMLInputElement
        await userEvent.click(sectionLinksSwitch)
        await userEvent.click(screen.getByTestId('application-settings-general-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    expectedVersion: 5,
                    settings: expect.not.objectContaining({
                        publicRuntime: expect.anything()
                    })
                })
            )
        })
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
