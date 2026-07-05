import { vi } from 'vitest'

import type { ReactNode } from 'react'

vi.mock('@universo-react/template-mui', () => ({
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
    listApplicationLayoutScopes: vi.fn(),
    listApplicationLayouts: vi.fn(),
    listApplicationLayoutWidgets: vi.fn(),
    updateApplicationLayoutWidgetConfig: vi.fn(),
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
import { getInstance as getI18nInstance } from '@universo-react/i18n/instance'
import { registerNamespace } from '@universo-react/i18n/registry'
import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import applicationsEn from '../../i18n/locales/en/applications.json'
import applicationsRu from '../../i18n/locales/ru/applications.json'
import ApplicationSettings from '../ApplicationSettings'
import { useApplicationDetails } from '../../api/useApplicationDetails'
import {
    getApplicationWorkspaceLimits,
    listApplicationLayoutScopes,
    listApplicationLayouts,
    listApplicationLayoutWidgets,
    updateApplication,
    updateApplicationLayoutWidgetConfig,
    updateApplicationWorkspaceLimits
} from '../../api/applications'

const mockedUseApplicationDetails = vi.mocked(useApplicationDetails)
const mockedGetApplicationWorkspaceLimits = vi.mocked(getApplicationWorkspaceLimits)
const mockedListApplicationLayoutScopes = vi.mocked(listApplicationLayoutScopes)
const mockedListApplicationLayouts = vi.mocked(listApplicationLayouts)
const mockedListApplicationLayoutWidgets = vi.mocked(listApplicationLayoutWidgets)
const mockedUpdateApplication = vi.mocked(updateApplication)
const mockedUpdateApplicationLayoutWidgetConfig = vi.mocked(updateApplicationLayoutWidgetConfig)
const mockedUpdateApplicationWorkspaceLimits = vi.mocked(updateApplicationWorkspaceLimits)

const createRuntimeReadyApplication = (overrides: Record<string, unknown> = {}) =>
    ({
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
        version: 1,
        ...overrides
    } as never)

const renderSettings = (applicationId = 'app-1') => {
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
                    <MemoryRouter initialEntries={[`/applications/${applicationId}/settings`]}>
                        <Routes>
                            <Route path='/applications/:applicationId/settings' element={<ApplicationSettings />} />
                        </Routes>
                    </MemoryRouter>
                </QueryClientProvider>
            </SnackbarProvider>
        </I18nextProvider>
    )

    return queryClient
}

describe('ApplicationSettings', () => {
    beforeEach(async () => {
        vi.clearAllMocks()

        const i18n = getI18nInstance()
        registerNamespace('common', { en: commonEn, ru: commonRu })
        registerNamespace('applications', { en: applicationsEn, ru: applicationsRu })
        await i18n.changeLanguage('en')

        mockedUseApplicationDetails.mockReturnValue({
            data: createRuntimeReadyApplication(),
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
        mockedListApplicationLayouts.mockResolvedValue({
            items: [],
            pagination: {
                total: 0,
                limit: 100,
                offset: 0,
                count: 0,
                hasMore: false
            }
        })
        mockedListApplicationLayoutScopes.mockResolvedValue([])
        mockedListApplicationLayoutWidgets.mockResolvedValue([])
        mockedUpdateApplicationLayoutWidgetConfig.mockResolvedValue({} as never)
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
        expect(screen.queryByRole('tab', { name: 'Matrix' })).not.toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Learning Content' })).not.toBeInTheDocument()

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
            expect(mockedUpdateApplication.mock.calls[0][1].settings).not.toHaveProperty('learningContent')
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

    it('hides limits until runtime schema and workspace mode are ready', async () => {
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
        expect(screen.queryByRole('tab', { name: 'Limits' })).not.toBeInTheDocument()
        expect(screen.queryByText('Limits settings will become available after the application schema is created.')).not.toBeInTheDocument()
        expect(mockedGetApplicationWorkspaceLimits).not.toHaveBeenCalled()
    })

    it('strips stale Learning Content settings from generic saves when no LMS widget is materialized', async () => {
        mockedUseApplicationDetails.mockReturnValue({
            data: createRuntimeReadyApplication({
                settings: {
                    dialogSizePreset: 'medium',
                    learningContent: {
                        defaultView: 'cards'
                    }
                }
            }),
            isLoading: false,
            isError: false
        } as never)

        renderSettings()

        expect(screen.queryByRole('tab', { name: 'Learning Content' })).not.toBeInTheDocument()
        const visibilitySwitch = within(screen.getByTestId('application-setting-visibility')).getByRole('switch') as HTMLInputElement
        await userEvent.click(visibilitySwitch)
        await userEvent.click(screen.getByTestId('application-settings-general-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    isPublic: true,
                    settings: expect.not.objectContaining({
                        learningContent: expect.anything()
                    })
                })
            )
        })
    })

    it('preserves hidden Learning Content settings while materialized layout discovery is unresolved', async () => {
        mockedUseApplicationDetails.mockReturnValue({
            data: createRuntimeReadyApplication({
                settings: {
                    dialogSizePreset: 'medium',
                    learningContent: {
                        defaultView: 'cards'
                    }
                }
            }),
            isLoading: false,
            isError: false
        } as never)
        mockedListApplicationLayouts.mockImplementation(() => new Promise(() => undefined))

        renderSettings()

        expect(screen.queryByRole('tab', { name: 'Learning Content' })).not.toBeInTheDocument()
        const visibilitySwitch = within(screen.getByTestId('application-setting-visibility')).getByRole('switch') as HTMLInputElement
        await userEvent.click(visibilitySwitch)
        await userEvent.click(screen.getByTestId('application-settings-general-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    isPublic: true,
                    settings: expect.objectContaining({
                        learningContent: expect.objectContaining({
                            defaultView: 'cards'
                        })
                    })
                })
            )
        })
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

    it('previews and downgrades unsupported scoped role policy grants before saving', async () => {
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
                version: 1,
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'reviewerPolicy',
                                title: 'Reviewer permissions',
                                baseRole: 'editor',
                                rules: [
                                    {
                                        capability: 'assignment.review',
                                        effect: 'allow',
                                        scope: 'recordOwner'
                                    }
                                ]
                            }
                        ]
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

        await userEvent.click(screen.getByRole('tab', { name: 'Access' }))

        expect(screen.getByTestId('application-settings-unsupported-scope-warning')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('checkbox', { name: 'member readReports' }))
        await userEvent.click(screen.getByTestId('application-settings-access-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    settings: expect.objectContaining({
                        rolePolicies: expect.objectContaining({
                            templates: expect.arrayContaining([
                                expect.objectContaining({
                                    codename: 'reviewerPolicy',
                                    rules: expect.arrayContaining([
                                        expect.objectContaining({
                                            capability: 'assignment.review',
                                            effect: 'deny',
                                            scope: 'recordOwner'
                                        })
                                    ])
                                })
                            ])
                        })
                    })
                })
            )
        })
    }, 30_000)

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

    it('saves typed Learning Content defaults through the existing settings page', async () => {
        mockedUseApplicationDetails.mockReturnValue({
            data: createRuntimeReadyApplication({
                settings: {
                    learningContent: {
                        defaultView: 'table'
                    }
                }
            }),
            isLoading: false,
            isError: false
        } as never)
        mockedListApplicationLayouts.mockResolvedValue({
            items: [
                {
                    id: 'layout-1',
                    scopeId: null,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    name: { en: 'Dashboard' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    sourceKind: 'application',
                    syncState: 'in_sync',
                    isSourceExcluded: false,
                    version: 3
                }
            ],
            pagination: {
                total: 1,
                limit: 100,
                offset: 0,
                count: 1,
                hasMore: false
            }
        } as never)
        mockedListApplicationLayoutWidgets.mockResolvedValue([
            {
                id: 'widget-1',
                layoutId: 'layout-1',
                zone: 'main',
                widgetKey: 'learnerPlayer',
                sortOrder: 0,
                config: { sharedBehavior: 'learningContent' },
                isActive: true,
                version: 7
            }
        ] as never)

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

        await userEvent.click(await screen.findByRole('tab', { name: 'Learning Content' }))

        expect(screen.getByTestId('application-setting-learning-content-resource-types')).toBeInTheDocument()
        expect(screen.getByTestId('application-settings-learning-content-column-Instructor')).toBeInTheDocument()

        await userEvent.click(screen.getByTestId('application-settings-learning-content-resource-xapi-enabled'))
        await userEvent.click(screen.getByTestId('application-settings-learning-content-column-CreatedBy'))
        await userEvent.click(screen.getByTestId('application-settings-learning-content-save'))

        await waitFor(() => {
            expect(mockedUpdateApplication).toHaveBeenCalledWith(
                'app-1',
                expect.objectContaining({
                    expectedVersion: 1,
                    settings: expect.objectContaining({
                        learningContent: expect.objectContaining({
                            defaultView: 'table',
                            supportedResourceTypes: expect.arrayContaining([
                                expect.objectContaining({
                                    resourceType: 'xapi',
                                    enabled: false,
                                    deferred: true
                                })
                            ]),
                            columnPreset: expect.objectContaining({
                                columns: expect.arrayContaining([
                                    expect.objectContaining({
                                        field: 'CreatedBy',
                                        visible: true
                                    })
                                ])
                            })
                        })
                    })
                })
            )
        })
    })

    it('does not expose Learning Content settings for generic details and resource widgets without LMS behavior', async () => {
        mockedUseApplicationDetails.mockReturnValue({
            data: createRuntimeReadyApplication({
                settings: {
                    learningContent: {
                        defaultView: 'table'
                    }
                }
            }),
            isLoading: false,
            isError: false
        } as never)
        mockedListApplicationLayouts.mockResolvedValue({
            items: [
                {
                    id: 'layout-1',
                    scopeId: null,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    name: { en: 'Dashboard' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    sourceKind: 'application',
                    syncState: 'in_sync',
                    isSourceExcluded: false,
                    version: 3
                }
            ],
            pagination: {
                total: 1,
                limit: 100,
                offset: 0,
                count: 1,
                hasMore: false
            }
        } as never)
        mockedListApplicationLayoutWidgets.mockResolvedValue([
            {
                id: 'widget-1',
                layoutId: 'layout-1',
                zone: 'main',
                widgetKey: 'detailsTable',
                sortOrder: 0,
                config: { datasource: { kind: 'records.list', objectCodename: 'Structure' } },
                isActive: true,
                version: 7
            },
            {
                id: 'widget-2',
                layoutId: 'layout-1',
                zone: 'right',
                widgetKey: 'resourcePreview',
                sortOrder: 1,
                config: { source: { type: 'url', url: 'https://example.test' } },
                isActive: true,
                version: 3
            }
        ] as never)

        renderSettings()

        await waitFor(() => {
            expect(mockedListApplicationLayoutWidgets).toHaveBeenCalledWith('app-1', 'layout-1')
        })
        expect(screen.queryByRole('tab', { name: 'Learning Content' })).not.toBeInTheDocument()
    })

    it('detects Learning Content settings from a nested learner player widget', async () => {
        mockedListApplicationLayouts.mockResolvedValue({
            items: [
                {
                    id: 'layout-1',
                    scopeId: null,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    name: { en: 'Dashboard' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    sourceKind: 'application',
                    syncState: 'in_sync',
                    isSourceExcluded: false,
                    version: 3
                }
            ],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        } as never)
        mockedListApplicationLayoutWidgets.mockResolvedValue([
            {
                id: 'widget-1',
                layoutId: 'layout-1',
                zone: 'main',
                widgetKey: 'detailsTabs',
                sortOrder: 0,
                config: {
                    tabs: [
                        {
                            id: 'player',
                            widgets: [{ widgetKey: 'learnerPlayer', isActive: true, config: {} }]
                        }
                    ]
                },
                isActive: true,
                version: 7
            }
        ] as never)

        renderSettings()

        expect(await screen.findByRole('tab', { name: 'Learning Content' })).toBeInTheDocument()
    })

    it('shows matrix tab only when an active materialized interpretation workspace widget exists', async () => {
        mockedListApplicationLayouts.mockResolvedValue({
            items: [
                {
                    id: 'layout-1',
                    scopeId: null,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    name: { en: 'Dashboard' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    sourceKind: 'application',
                    syncState: 'in_sync',
                    isSourceExcluded: false,
                    version: 3
                }
            ],
            pagination: {
                total: 1,
                limit: 100,
                offset: 0,
                count: 1,
                hasMore: false
            }
        } as never)
        mockedListApplicationLayoutWidgets.mockResolvedValue([
            {
                id: 'widget-1',
                layoutId: 'layout-1',
                zone: 'main',
                widgetKey: 'interpretationNetworkWorkspace',
                sortOrder: 0,
                config: { matrixMode: 'hierarchicalCells' },
                isActive: true,
                version: 7
            }
        ] as never)
        mockedUpdateApplicationLayoutWidgetConfig.mockResolvedValue({
            id: 'widget-1',
            layoutId: 'layout-1',
            zone: 'main',
            widgetKey: 'interpretationNetworkWorkspace',
            sortOrder: 0,
            config: { matrixMode: 'independentRows', conceptCodename: 'Structure' },
            isActive: true,
            version: 8
        } as never)

        renderSettings()

        expect(await screen.findByRole('tab', { name: 'Matrix' })).toBeInTheDocument()
    })

    it('discovers feature settings from active layouts after the first layouts page', async () => {
        const firstLayout = {
            id: 'layout-1',
            scopeId: null,
            scopeKind: 'global',
            scopeEntityId: null,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            description: null,
            config: {},
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            sourceKind: 'application',
            syncState: 'in_sync',
            isSourceExcluded: false,
            version: 3
        }
        const secondLayout = {
            ...firstLayout,
            id: 'layout-2',
            name: { en: 'Interpretation Network' },
            isDefault: false,
            sortOrder: 1
        }

        mockedListApplicationLayouts
            .mockResolvedValueOnce({
                items: [firstLayout],
                pagination: {
                    total: 2,
                    limit: 100,
                    offset: 0,
                    count: 1,
                    hasMore: true
                }
            } as never)
            .mockResolvedValueOnce({
                items: [secondLayout],
                pagination: {
                    total: 2,
                    limit: 100,
                    offset: 1,
                    count: 1,
                    hasMore: false
                }
            } as never)
        mockedListApplicationLayoutWidgets.mockImplementation(async (_applicationId, layoutId) =>
            layoutId === 'layout-2'
                ? ([
                      {
                          id: 'widget-2',
                          layoutId,
                          zone: 'main',
                          widgetKey: 'interpretationNetworkWorkspace',
                          sortOrder: 0,
                          config: { matrixMode: 'hierarchicalCells' },
                          isActive: true,
                          version: 7
                      }
                  ] as never)
                : []
        )

        renderSettings()

        expect(await screen.findByRole('tab', { name: 'Matrix' })).toBeInTheDocument()
        expect(mockedListApplicationLayouts).toHaveBeenCalledWith('app-1', {
            limit: 100,
            offset: 0,
            scopeEntityId: null
        })
        expect(mockedListApplicationLayouts).toHaveBeenCalledWith('app-1', {
            limit: 100,
            offset: 1,
            scopeEntityId: null
        })
        expect(mockedListApplicationLayouts).not.toHaveBeenCalledWith(
            'app-1',
            expect.objectContaining({
                scopeEntityId: undefined
            })
        )
        expect(mockedListApplicationLayoutWidgets).toHaveBeenCalledWith('app-1', 'layout-2')
    })

    it('discovers feature settings from scoped materialized layouts', async () => {
        const scopedLayout = {
            id: 'layout-scoped',
            scopeId: 'object-structure',
            scopeKind: 'entity',
            scopeEntityId: 'object-structure',
            templateKey: 'dashboard',
            name: { en: 'Structure scoped dashboard' },
            description: null,
            config: {},
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            sourceKind: 'application',
            syncState: 'in_sync',
            isSourceExcluded: false,
            version: 3
        }
        mockedListApplicationLayoutScopes.mockResolvedValue([
            {
                id: 'object-structure',
                scopeKind: 'entity',
                objectCollectionId: 'object-structure',
                scopeEntityId: 'object-structure',
                name: 'Structure'
            }
        ] as never)
        mockedListApplicationLayouts.mockImplementation(async (_applicationId, params) =>
            params?.scopeEntityId === 'object-structure'
                ? ({
                      items: [scopedLayout],
                      pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
                  } as never)
                : ({
                      items: [],
                      pagination: { total: 0, limit: 100, offset: 0, count: 0, hasMore: false }
                  } as never)
        )
        mockedListApplicationLayoutWidgets.mockImplementation(async (_applicationId, layoutId) =>
            layoutId === 'layout-scoped'
                ? ([
                      {
                          id: 'widget-scoped',
                          layoutId,
                          zone: 'main',
                          widgetKey: 'interpretationNetworkWorkspace',
                          sortOrder: 0,
                          config: { matrixMode: 'hierarchicalCells' },
                          isActive: true,
                          version: 7
                      }
                  ] as never)
                : []
        )

        renderSettings()

        expect(await screen.findByRole('tab', { name: 'Matrix' })).toBeInTheDocument()
        expect(mockedListApplicationLayouts).toHaveBeenCalledWith('app-1', {
            limit: 100,
            offset: 0,
            scopeEntityId: 'object-structure'
        })
        expect(mockedListApplicationLayoutWidgets).toHaveBeenCalledWith('app-1', 'layout-scoped')
    })

    it('saves matrix mode through the layout widget config API', async () => {
        mockedListApplicationLayouts.mockResolvedValue({
            items: [
                {
                    id: 'layout-1',
                    scopeId: null,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    name: { en: 'Dashboard' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    sourceKind: 'application',
                    syncState: 'in_sync',
                    isSourceExcluded: false,
                    version: 3
                }
            ],
            pagination: {
                total: 1,
                limit: 100,
                offset: 0,
                count: 1,
                hasMore: false
            }
        } as never)
        mockedListApplicationLayoutWidgets.mockResolvedValue([
            {
                id: 'widget-1',
                layoutId: 'layout-1',
                zone: 'main',
                widgetKey: 'interpretationNetworkWorkspace',
                sortOrder: 0,
                config: {
                    matrixMode: 'hierarchicalCells',
                    hierarchyLayout: 'horizontalRows',
                    hierarchyRowMode: 'allNodes',
                    positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 },
                    serverModuleCodename: 'interpretation-runtime',
                    conceptCodename: 'Structure',
                    relationCodename: 'Interpretation',
                    tableTemplateCodename: 'Interpretation Network Matrix',
                    _tp_created_at: '2026-07-03T00:00:00.000Z',
                    _tp_updated_at: '2026-07-03T01:00:00.000Z',
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: {
                            content: 'Matrix',
                            version: 1,
                            isActive: true,
                            createdAt: '1970-01-01T00:00:00.000Z',
                            updatedAt: '1970-01-01T00:00:00.000Z'
                        }
                    },
                    visibleFor: {
                        sectionCodenames: ['Structure'],
                        objectCollectionCodenames: ['Structure']
                    }
                },
                isActive: true,
                version: 7
            }
        ] as never)

        const queryClient = renderSettings()
        queryClient.setQueryData(['interpretationNetworkWorkspace', 'app-1'], { cached: true })
        queryClient.setQueryData(['interpretationNetworkWorkspace', 'app-1', 'workspace-1', 'en', { matrixMode: 'hierarchicalCells' }], {
            cached: true
        })
        queryClient.setQueryData(['interpretationNetworkWorkspaceMatrix', 'app-1', 'workspace-1', 'structure-1', 'matrix-column'], {
            cached: true
        })

        await userEvent.click(await screen.findByRole('tab', { name: 'Matrix' }))
        await userEvent.click(within(screen.getByTestId('application-setting-matrix-mode')).getByRole('combobox'))
        await userEvent.click(screen.getByRole('option', { name: 'Independent rows' }))
        expect(mockedUpdateApplicationLayoutWidgetConfig).not.toHaveBeenCalled()
        await userEvent.click(screen.getByTestId('application-settings-matrix-save'))

        await waitFor(() => {
            expect(mockedUpdateApplicationLayoutWidgetConfig).toHaveBeenCalledWith('app-1', 'layout-1', 'widget-1', {
                config: {
                    matrixMode: 'independentRows',
                    hierarchyLayout: 'horizontalRows',
                    hierarchyRowMode: 'allNodes',
                    positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 },
                    serverModuleCodename: 'interpretation-runtime',
                    conceptCodename: 'Structure',
                    relationCodename: 'Interpretation',
                    tableTemplateCodename: 'Interpretation Network Matrix',
                    visibleFor: {
                        sectionCodenames: ['Structure'],
                        objectCollectionCodenames: ['Structure']
                    }
                },
                expectedVersion: 7
            })
        })
        const savedConfig = mockedUpdateApplicationLayoutWidgetConfig.mock.calls[0][3].config as Record<string, unknown>
        expect(savedConfig).toMatchObject({
            serverModuleCodename: 'interpretation-runtime',
            relationCodename: 'Interpretation',
            tableTemplateCodename: 'Interpretation Network Matrix'
        })
        expect(savedConfig).not.toHaveProperty('_schema')
        expect(savedConfig).not.toHaveProperty('_primary')
        expect(savedConfig).not.toHaveProperty('locales')
        await waitFor(() => {
            expect(within(screen.getByTestId('application-setting-matrix-mode')).getByRole('combobox')).toHaveTextContent(
                'Independent rows'
            )
        })
        expect(mockedUpdateApplication).not.toHaveBeenCalled()
        expect(queryClient.getQueryState(['interpretationNetworkWorkspace', 'app-1'])?.isInvalidated).toBe(true)
        expect(
            queryClient.getQueryState(['interpretationNetworkWorkspace', 'app-1', 'workspace-1', 'en', { matrixMode: 'hierarchicalCells' }])
                ?.isInvalidated
        ).toBe(true)
        expect(
            queryClient.getQueryState(['interpretationNetworkWorkspaceMatrix', 'app-1', 'workspace-1', 'structure-1', 'matrix-column'])
                ?.isInvalidated
        ).toBe(true)
    })

    it('keeps a feature tab visible while materialized layout capability discovery is refreshing', async () => {
        let resolveRefetchLayouts:
            | ((value: {
                  items: Array<Record<string, unknown>>
                  pagination: { total: number; limit: number; offset: number; count: number; hasMore: boolean }
              }) => void)
            | undefined
        const layout = {
            id: 'layout-1',
            scopeId: null,
            scopeKind: 'global',
            scopeEntityId: null,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            description: null,
            config: {},
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            sourceKind: 'application',
            syncState: 'in_sync',
            isSourceExcluded: false,
            version: 3
        }
        const layoutResponse = {
            items: [layout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        }
        mockedListApplicationLayouts.mockResolvedValueOnce(layoutResponse as never).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveRefetchLayouts = resolve
                }) as never
        )
        mockedListApplicationLayoutWidgets.mockImplementation(async (_applicationId, layoutId) =>
            layoutId === 'layout-1'
                ? ([
                      {
                          id: 'widget-1',
                          layoutId,
                          zone: 'main',
                          widgetKey: 'interpretationNetworkWorkspace',
                          sortOrder: 0,
                          config: { matrixMode: 'hierarchicalCells' },
                          isActive: true,
                          version: 7
                      }
                  ] as never)
                : []
        )

        const queryClient = renderSettings()

        const matrixTab = await screen.findByRole('tab', { name: 'Matrix' })
        await userEvent.click(matrixTab)
        expect(await screen.findByTestId('application-setting-matrix-mode')).toBeInTheDocument()

        void queryClient.refetchQueries({ queryKey: ['applications', 'app-1', 'settings', 'materialized-layouts'] })

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: 'Matrix' })).toBeDisabled()
        })
        expect(screen.getByRole('tab', { name: 'Matrix' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'General', selected: true })).not.toBeInTheDocument()

        resolveRefetchLayouts?.(layoutResponse)
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: 'Matrix' })).not.toBeDisabled()
        })
        expect(await screen.findByTestId('application-setting-matrix-mode')).toBeInTheDocument()
    })

    it('saves matrix settings to every active interpretation workspace widget', async () => {
        const globalLayout = {
            id: 'layout-global',
            scopeId: null,
            scopeKind: 'global',
            scopeEntityId: null,
            templateKey: 'dashboard',
            name: { en: 'Global dashboard' },
            description: null,
            config: {},
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            sourceKind: 'application',
            syncState: 'in_sync',
            isSourceExcluded: false,
            version: 3
        }
        const scopedLayout = {
            ...globalLayout,
            id: 'layout-scoped',
            scopeId: 'object-structure',
            scopeKind: 'entity',
            scopeEntityId: 'object-structure',
            name: { en: 'Scoped dashboard' }
        }
        mockedListApplicationLayoutScopes.mockResolvedValue([
            {
                id: 'object-structure',
                scopeKind: 'entity',
                objectCollectionId: 'object-structure',
                scopeEntityId: 'object-structure',
                name: 'Structure'
            }
        ] as never)
        mockedListApplicationLayouts.mockImplementation(async (_applicationId, params) => {
            if (params?.scopeEntityId === 'object-structure') {
                return {
                    items: [scopedLayout],
                    pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
                } as never
            }
            if (params?.scopeEntityId === null) {
                return {
                    items: [globalLayout],
                    pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
                } as never
            }
            return {
                items: [globalLayout],
                pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
            } as never
        })
        mockedListApplicationLayoutWidgets.mockImplementation(async (_applicationId, layoutId) =>
            layoutId === 'layout-global' || layoutId === 'layout-scoped'
                ? ([
                      {
                          id: layoutId === 'layout-global' ? 'widget-global' : 'widget-scoped',
                          layoutId,
                          zone: 'main',
                          widgetKey: 'interpretationNetworkWorkspace',
                          sortOrder: 0,
                          config: { matrixMode: 'hierarchicalCells', conceptCodename: 'Structure' },
                          isActive: true,
                          version: 7
                      }
                  ] as never)
                : []
        )
        mockedUpdateApplicationLayoutWidgetConfig.mockImplementation(async (_applicationId, layoutId, widgetId, input) => ({
            id: widgetId,
            layoutId,
            zone: 'main',
            widgetKey: 'interpretationNetworkWorkspace',
            sortOrder: 0,
            config: input.config,
            isActive: true,
            version: 8
        }))

        renderSettings()

        await userEvent.click(await screen.findByRole('tab', { name: 'Matrix' }))
        await userEvent.click(within(screen.getByTestId('application-setting-matrix-mode')).getByRole('combobox'))
        await userEvent.click(screen.getByRole('option', { name: 'Independent rows' }))
        await userEvent.click(screen.getByTestId('application-settings-matrix-save'))

        await waitFor(() => {
            expect(mockedUpdateApplicationLayoutWidgetConfig).toHaveBeenCalledTimes(2)
        })
        expect(mockedUpdateApplicationLayoutWidgetConfig).toHaveBeenCalledWith(
            'app-1',
            'layout-global',
            'widget-global',
            expect.objectContaining({
                config: expect.objectContaining({
                    matrixMode: 'independentRows',
                    hierarchyLayout: 'horizontalRows',
                    positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 }
                }),
                expectedVersion: 7
            })
        )
        expect(mockedUpdateApplicationLayoutWidgetConfig).toHaveBeenCalledWith(
            'app-1',
            'layout-scoped',
            'widget-scoped',
            expect.objectContaining({
                config: expect.objectContaining({
                    matrixMode: 'independentRows',
                    hierarchyLayout: 'horizontalRows',
                    positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 }
                }),
                expectedVersion: 7
            })
        )
    })

    it('saves matrix settings to the active scoped workspace widget when no global widget exists', async () => {
        mockedListApplicationLayoutScopes.mockResolvedValue([
            {
                id: 'object-structure',
                scopeKind: 'entity',
                objectCollectionId: 'object-structure',
                scopeEntityId: 'object-structure',
                name: 'Structure'
            }
        ] as never)
        mockedListApplicationLayouts.mockImplementation(async (_applicationId, params) => {
            if (params?.scopeEntityId === null) {
                return {
                    items: [],
                    pagination: { total: 0, limit: 100, offset: 0, count: 0, hasMore: false }
                } as never
            }
            if (params?.scopeEntityId === 'object-structure') {
                return {
                    items: [
                        {
                            id: 'layout-scoped',
                            scopeId: 'object-structure',
                            scopeKind: 'entity',
                            scopeEntityId: 'object-structure',
                            templateKey: 'dashboard',
                            name: { en: 'Scoped dashboard' },
                            description: null,
                            config: {},
                            isActive: true,
                            isDefault: false,
                            sortOrder: 0,
                            sourceKind: 'application',
                            syncState: 'in_sync',
                            isSourceExcluded: false,
                            version: 3
                        }
                    ],
                    pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
                } as never
            }
            return {
                items: [],
                pagination: { total: 0, limit: 100, offset: 0, count: 0, hasMore: false }
            } as never
        })
        mockedListApplicationLayoutWidgets.mockResolvedValue([
            {
                id: 'widget-scoped',
                layoutId: 'layout-scoped',
                zone: 'main',
                widgetKey: 'interpretationNetworkWorkspace',
                sortOrder: 0,
                config: { matrixMode: 'hierarchicalCells', conceptCodename: 'Structure' },
                isActive: true,
                version: 7
            }
        ] as never)

        renderSettings()

        await userEvent.click(await screen.findByRole('tab', { name: 'Matrix' }))
        await userEvent.click(within(screen.getByTestId('application-setting-matrix-mode')).getByRole('combobox'))
        await userEvent.click(screen.getByRole('option', { name: 'Independent rows' }))
        await userEvent.click(screen.getByTestId('application-settings-matrix-save'))

        await waitFor(() => {
            expect(mockedUpdateApplicationLayoutWidgetConfig).toHaveBeenCalledWith(
                'app-1',
                'layout-scoped',
                'widget-scoped',
                expect.objectContaining({
                    config: expect.objectContaining({
                        matrixMode: 'independentRows',
                        hierarchyRowMode: 'focusedPath',
                        conceptCodename: 'Structure'
                    }),
                    expectedVersion: 7
                })
            )
        })
    })

    it('saves matrix hierarchy layout and position numbering settings through widget config', async () => {
        mockedListApplicationLayouts.mockResolvedValue({
            items: [
                {
                    id: 'layout-1',
                    scopeId: null,
                    scopeKind: 'global',
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    name: { en: 'Dashboard' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    sourceKind: 'application',
                    syncState: 'in_sync',
                    isSourceExcluded: false,
                    version: 3
                }
            ],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        } as never)
        mockedListApplicationLayoutWidgets.mockResolvedValue([
            {
                id: 'widget-1',
                layoutId: 'layout-1',
                zone: 'main',
                widgetKey: 'interpretationNetworkWorkspace',
                sortOrder: 0,
                config: {
                    matrixMode: 'hierarchicalCells',
                    hierarchyLayout: 'horizontalRows',
                    hierarchyRowMode: 'allNodes',
                    positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 },
                    conceptCodename: 'Structure'
                },
                isActive: true,
                version: 7
            }
        ] as never)

        renderSettings()

        await userEvent.click(await screen.findByRole('tab', { name: 'Matrix' }))
        await userEvent.click(within(screen.getByTestId('application-setting-matrix-hierarchy-layout')).getByRole('combobox'))
        await userEvent.click(screen.getByRole('option', { name: 'Vertical tree' }))
        expect(mockedUpdateApplicationLayoutWidgetConfig).not.toHaveBeenCalled()
        await userEvent.click(screen.getByTestId('application-settings-matrix-save'))

        await waitFor(() => {
            expect(mockedUpdateApplicationLayoutWidgetConfig).toHaveBeenCalledWith(
                'app-1',
                'layout-1',
                'widget-1',
                expect.objectContaining({
                    config: expect.objectContaining({
                        matrixMode: 'hierarchicalCells',
                        hierarchyLayout: 'verticalTree',
                        hierarchyRowMode: 'allNodes',
                        positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 },
                        conceptCodename: 'Structure'
                    }),
                    expectedVersion: 7
                })
            )
        })

        await userEvent.click(within(screen.getByTestId('application-setting-matrix-position-numbering-root')).getByRole('switch'))
        await userEvent.click(screen.getByTestId('application-settings-matrix-save'))

        await waitFor(() => {
            expect(mockedUpdateApplicationLayoutWidgetConfig).toHaveBeenLastCalledWith(
                'app-1',
                'layout-1',
                'widget-1',
                expect.objectContaining({
                    config: expect.objectContaining({
                        hierarchyLayout: 'verticalTree',
                        hierarchyRowMode: 'allNodes',
                        positionNumbering: { enabled: true, includeRoot: false, startIndex: 1 }
                    }),
                    expectedVersion: 7
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

        expect(screen.queryByRole('tab', { name: 'Limits' })).not.toBeInTheDocument()
        expect(screen.queryByText('Limits settings will become available after the application schema is created.')).not.toBeInTheDocument()
        expect(screen.queryByText('Failed to load limits')).not.toBeInTheDocument()
        expect(mockedGetApplicationWorkspaceLimits).not.toHaveBeenCalled()
    })
})
