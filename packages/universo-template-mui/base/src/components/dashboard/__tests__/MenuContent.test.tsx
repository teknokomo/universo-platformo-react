import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import MenuContent from '../MenuContent'

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

const renderMenu = (path: string, applicationDetail?: { schemaName?: string | null }) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false }
        }
    })

    if (applicationDetail) {
        const applicationId = path.match(/^\/a\/([^/]+)\/admin(?:\/|$)/)?.[1]
        if (applicationId) {
            queryClient.setQueryData(['applications', 'detail', applicationId], applicationDetail)
        }
    }

    return render(
        <ThemeProvider theme={theme}>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[path]}>
                    <MenuContent />
                </MemoryRouter>
            </QueryClientProvider>
        </ThemeProvider>
    )
}

describe('MenuContent', () => {
    it('shows application settings only when runtime schema exists', () => {
        renderMenu('/a/app-1/admin', { schemaName: 'app_runtime' })

        expect(screen.getByRole('link', { name: 'settings' })).toHaveAttribute('href', '/a/app-1/admin/settings')
    })

    it('hides application settings when runtime schema is not created yet', () => {
        renderMenu('/a/app-1/admin', { schemaName: null })

        expect(screen.queryByRole('link', { name: 'settings' })).not.toBeInTheDocument()
    })
})
