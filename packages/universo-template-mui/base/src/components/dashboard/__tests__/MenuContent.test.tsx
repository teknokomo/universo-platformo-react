import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import MenuContent from '../MenuContent'

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
        ability: null
    })
}))

jest.mock('../../../navigation/roleAccess', () => ({
    __esModule: true,
    resolveShellAccess: () => ({
        visibility: {
            rootMenuIds: [],
            showMetahubsSection: false
        }
    })
}))

jest.mock('react-i18next', () => ({
    __esModule: true,
    useTranslation: () => ({
        t: (key: string) => key
    })
}))

const theme = createTheme()

beforeEach(() => {
    mockClientGet.mockReset()
    mockClientGet.mockRejectedValue({
        response: {
            status: 503
        }
    })
})

const renderMenu = (
    path: string,
    options?: {
        applicationDetail?: { schemaName?: string | null }
        metahubDetail?: { permissions?: { manageMetahub?: boolean; manageMembers?: boolean } }
        entityTypes?: Array<{
            kindKey: string
            published?: boolean
            codename?: unknown
            presentation?: { name?: unknown }
            ui?: { iconName?: string | null; nameKey?: string | null; sidebarSection?: 'objects' | 'admin' }
        }>
    }
) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false }
        }
    })

    const applicationId = path.match(/^\/a\/([^/]+)\/admin(?:\/|$)/)?.[1]
    if (applicationId && options?.applicationDetail) {
        queryClient.setQueryData(['applications', 'detail', applicationId], options.applicationDetail)
    }

    const metahubId = path.match(/^\/metahub\/([^/]+)/)?.[1]
    if (metahubId && options?.metahubDetail) {
        queryClient.setQueryData(['metahubs', 'detail', metahubId], options.metahubDetail)
    }
    if (metahubId && options?.entityTypes) {
        queryClient.setQueryData(['metahubs', 'detail', metahubId, 'entityTypes', 'menu'], {
            items: options.entityTypes
        })
    }

    return {
        queryClient,
        ...render(
            <ThemeProvider theme={theme}>
                <QueryClientProvider client={queryClient}>
                    <MemoryRouter initialEntries={[path]}>
                        <MenuContent />
                    </MemoryRouter>
                </QueryClientProvider>
            </ThemeProvider>
        )
    }
}

describe('MenuContent', () => {
    it('shows application settings only when runtime schema exists', () => {
        renderMenu('/a/app-1/admin', { applicationDetail: { schemaName: 'app_runtime' } })

        expect(screen.getByRole('link', { name: 'settings' })).toHaveAttribute('href', '/a/app-1/admin/settings')
    })

    it('keeps application settings visible in a disabled state while detail is still unresolved', () => {
        mockClientGet.mockImplementation(() => new Promise(() => undefined))

        renderMenu('/a/app-1/admin')

        expect(screen.getByText('settings')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'settings' })).not.toBeInTheDocument()
    })

    it('hides application settings when runtime schema is not created yet', () => {
        renderMenu('/a/app-1/admin', { applicationDetail: { schemaName: null } })

        expect(screen.queryByRole('link', { name: 'settings' })).not.toBeInTheDocument()
    })

    it('shows a published custom entity menu item for metahub managers', () => {
        renderMenu('/metahub/mhb-1/entities', {
            metahubDetail: { permissions: { manageMetahub: true, manageMembers: true } },
            entityTypes: [
                {
                    kindKey: 'catalog',
                    published: true,
                    presentation: { name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Catalogs' } } } },
                    ui: { iconName: 'IconDatabase', nameKey: 'metahubs:catalogs.title', sidebarSection: 'objects' }
                },
                {
                    kindKey: 'custom-order',
                    published: true,
                    codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                    ui: { iconName: 'IconBolt', nameKey: 'Custom Order', sidebarSection: 'objects' }
                },
                {
                    kindKey: 'custom-hidden',
                    published: false,
                    ui: { iconName: 'IconBolt', nameKey: 'Hidden Order', sidebarSection: 'objects' }
                }
            ]
        })

        expect(screen.getByRole('link', { name: 'Custom Order' })).toHaveAttribute('href', '/metahub/mhb-1/entities/custom-order/instances')
        expect(screen.queryByRole('link', { name: 'Hidden Order' })).not.toBeInTheDocument()
    })

    it('uses the authenticated client for metahub shell queries', async () => {
        mockClientGet.mockImplementation((path: string) => {
            if (path === '/metahub/mhb-1') {
                return Promise.resolve({
                    data: {
                        permissions: {
                            manageMetahub: true,
                            manageMembers: true
                        }
                    }
                })
            }

            if (path === '/metahub/mhb-1/entity-types?limit=1000&offset=0') {
                return Promise.resolve({
                    data: {
                        items: [
                            {
                                kindKey: 'custom-order',
                                published: true,
                                ui: { iconName: 'IconBolt', nameKey: 'Custom Order', sidebarSection: 'objects' }
                            }
                        ]
                    }
                })
            }

            return Promise.reject(new Error(`Unexpected menu request: ${path}`))
        })

        renderMenu('/metahub/mhb-1/entities')

        await waitFor(() => {
            expect(mockClientGet).toHaveBeenCalledWith('/metahub/mhb-1')
            expect(mockClientGet).toHaveBeenCalledWith('/metahub/mhb-1/entity-types?limit=1000&offset=0')
        })
    })

    it('hides metahub authoring-only navigation without manageMetahub permission', () => {
        renderMenu('/metahub/mhb-1/entities/catalog/instances', {
            metahubDetail: { permissions: { manageMetahub: false, manageMembers: false } },
            entityTypes: [
                {
                    kindKey: 'catalog',
                    published: true,
                    presentation: { name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Catalogs' } } } },
                    ui: { iconName: 'IconDatabase', nameKey: 'metahubs:catalogs.title', sidebarSection: 'objects' }
                },
                {
                    kindKey: 'custom-order',
                    published: true,
                    ui: { iconName: 'IconBolt', nameKey: 'Custom Order', sidebarSection: 'objects' }
                }
            ]
        })

        expect(screen.getByRole('link', { name: 'Catalogs' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Custom Order' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'commonSection' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'entities' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'publications' })).not.toBeInTheDocument()
    })
})
