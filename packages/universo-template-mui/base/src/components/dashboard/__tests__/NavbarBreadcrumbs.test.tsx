import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import NavbarBreadcrumbs from '../NavbarBreadcrumbs'

const mockClientGet = jest.fn()

jest.mock('@universo/auth-frontend', () => ({
    __esModule: true,
    useAuth: () => ({
        client: {
            get: mockClientGet
        },
        loading: false
    })
}))

jest.mock('@universo/store', () => ({
    __esModule: true,
    useHasGlobalAccess: () => ({
        isSuperuser: false,
        canAccessAdminPanel: false,
        globalRoles: [],
        ability: null,
        loading: false
    })
}))

jest.mock('@universo/i18n', () => ({
    __esModule: true,
    default: {
        resolvedLanguage: 'en',
        language: 'en',
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key
    }
}))

jest.mock('react-i18next', () => ({
    __esModule: true,
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => {
            const labels: Record<string, string> = {
                metahubs: 'Metahubs',
                applications: 'Applications',
                administration: 'Administration',
                access: 'Access',
                settings: 'Settings',
                branches: 'Branches',
                entities: 'Entities',
                commonSection: 'Resources',
                publications: 'Publications',
                versions: 'Versions',
                migrations: 'Migrations',
                connectors: 'Connectors',
                users: 'Users',
                roles: 'Roles',
                board: 'Board',
                locales: 'Locales',
                instance: 'Instance',
                role: 'Role',
                hubs: 'Hubs',
                objects: 'Objects',
                sets: 'Sets',
                enumerations: 'Enumerations',
                components: 'Components',
                elements: 'Elements',
                constants: 'Constants',
                values: 'Values',
                'metahubs:components.system.title': 'System Components'
            }

            return labels[key] || options?.defaultValue || key
        }
    })
}))

jest.mock('../../../hooks', () => ({
    __esModule: true,
    truncateMetahubName: (value: string) => value,
    truncateApplicationName: (value: string) => value,
    useMetahubPublicationName: () => null,
    useTreeEntityName: (_metahubId: string | null, treeEntityId: string | null) => (treeEntityId ? `Hub ${treeEntityId}` : null),
    useObjectCollectionName: (_metahubId: string | null, _hubId: string | null, objectCollectionId: string | null) =>
        objectCollectionId ? `Object ${objectCollectionId}` : null,
    useObjectCollectionNameStandalone: (_metahubId: string | null, objectCollectionId: string | null) =>
        objectCollectionId ? `Object ${objectCollectionId}` : null,
    useValueGroupNameStandalone: (_metahubId: string | null, valueGroupId: string | null) => (valueGroupId ? `Set ${valueGroupId}` : null),
    truncateObjectCollectionName: (value: string) => value,
    truncateValueGroupName: (value: string) => value,
    useOptionListName: (_metahubId: string | null, optionListId: string | null) => (optionListId ? `Enumeration ${optionListId}` : null),
    truncateOptionListName: (value: string) => value,
    truncatePublicationName: (value: string) => value,
    useConnectorName: () => null,
    truncateConnectorName: (value: string) => value,
    useLayoutName: () => null,
    truncateLayoutName: (value: string) => value
}))

jest.mock('@universo/admin-frontend', () => ({
    __esModule: true,
    useInstanceName: () => null,
    truncateInstanceName: (value: string) => value,
    useRoleName: () => null,
    truncateRoleName: (value: string) => value
}))

const theme = createTheme()

const renderBreadcrumbs = (path: string) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false }
        }
    })

    return render(
        <ThemeProvider theme={theme}>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                    <NavbarBreadcrumbs />
                </MemoryRouter>
            </QueryClientProvider>
        </ThemeProvider>
    )
}

describe('NavbarBreadcrumbs', () => {
    beforeEach(() => {
        mockClientGet.mockReset()
        mockClientGet.mockImplementation((path: string) => {
            if (path === '/metahub/mhb-1') {
                return Promise.resolve({
                    data: {
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Metahub One' } }
                        }
                    }
                })
            }

            if (path === '/metahub/mhb-1/entity-types') {
                return Promise.resolve({ data: { items: [] } })
            }

            return Promise.reject(new Error(`Unexpected breadcrumb request: ${path}`))
        })
    })

    it('renders entity-route object list breadcrumbs', async () => {
        renderBreadcrumbs('/metahub/mhb-1/entities/object/instances')

        await waitFor(() => {
            expect(screen.getByText('Objects')).toBeInTheDocument()
        })
        expect(screen.getByRole('link', { name: 'Entities' })).toHaveAttribute('href', '/metahub/mhb-1/entities')
    })

    it('renders entity-route hub instance with nested objects breadcrumbs', async () => {
        renderBreadcrumbs('/metahub/mhb-1/entities/hub/instance/hub-1/objects')

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'Hubs' })).toHaveAttribute('href', '/metahub/mhb-1/entities/hub/instances')
        })

        expect(screen.getByRole('link', { name: 'Hub hub-1' })).toHaveAttribute('href', '/metahub/mhb-1/entities/hub/instance/hub-1/hubs')
        expect(screen.getByText('Objects')).toBeInTheDocument()
    })

    it('renders entity-route set list breadcrumbs', async () => {
        renderBreadcrumbs('/metahub/mhb-1/entities/set/instances')

        await waitFor(() => {
            expect(screen.getByText('Sets')).toBeInTheDocument()
        })
        expect(screen.getByRole('link', { name: 'Entities' })).toHaveAttribute('href', '/metahub/mhb-1/entities')
    })

    it('uses localized entity type presentation for Page breadcrumbs', async () => {
        mockClientGet.mockImplementation((path: string) => {
            if (path === '/metahub/mhb-1') {
                return Promise.resolve({
                    data: {
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'LMS Portal' },
                                ru: { content: 'Учебный портал LMS' }
                            }
                        }
                    }
                })
            }

            if (path === '/metahub/mhb-1/entity-types') {
                return Promise.resolve({
                    data: {
                        items: [
                            {
                                kindKey: 'page',
                                codename: {
                                    _schema: 'v1',
                                    _primary: 'en',
                                    locales: {
                                        en: { content: 'Page' },
                                        ru: { content: 'Страница' }
                                    }
                                },
                                presentation: {
                                    name: {
                                        _schema: 'v1',
                                        _primary: 'en',
                                        locales: {
                                            en: { content: 'Pages' },
                                            ru: { content: 'Страницы' }
                                        }
                                    }
                                },
                                ui: {
                                    nameKey: 'metahubs:pages.title'
                                }
                            }
                        ]
                    }
                })
            }

            return Promise.reject(new Error(`Unexpected breadcrumb request: ${path}`))
        })

        renderBreadcrumbs('/metahub/mhb-1/entities/page/instances')

        expect(screen.getByText('Pages')).toBeInTheDocument()
        expect(screen.queryByText('pages')).not.toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('Pages')).toBeInTheDocument()
        })
        expect(screen.queryByText('pages')).not.toBeInTheDocument()
        expect(screen.queryByText('metahubs:pages.title')).not.toBeInTheDocument()
    })
})
