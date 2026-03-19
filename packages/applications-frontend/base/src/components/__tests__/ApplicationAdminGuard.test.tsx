import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ApplicationAdminGuard from '../ApplicationAdminGuard'

vi.mock('@universo/auth-frontend', () => ({
    useAuth: () => ({
        isAuthenticated: true,
        loading: false
    })
}))

vi.mock('@universo/template-mui', () => ({
    Loader: () => <div data-testid='guard-loader'>loading</div>,
    isAccessDeniedError: () => false
}))

const getApplication = vi.fn()

vi.mock('../../api/applications', () => ({
    getApplication: (...args: unknown[]) => getApplication(...args)
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

describe('ApplicationAdminGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('waits for a full detail refetch when cache only contains shell fields', async () => {
        const queryClient = createQueryClient()
        queryClient.setQueryData(['applications', 'detail', 'app-1'], {
            name: 'Shell app',
            slug: 'shell-app',
            schemaName: 'app_shell'
        })

        getApplication.mockResolvedValue({
            data: {
                id: 'app-1',
                name: 'Shell app',
                slug: 'shell-app',
                schemaName: 'app_shell',
                role: 'owner',
                permissions: {
                    manageApplication: true
                }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/a/app-1/admin']}>
                    <Routes>
                        <Route
                            path='/a/:applicationId/admin'
                            element={
                                <ApplicationAdminGuard>
                                    <div>admin-content</div>
                                </ApplicationAdminGuard>
                            }
                        />
                        <Route path='/a/:applicationId' element={<div>runtime-content</div>} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(screen.getByTestId('guard-loader')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('admin-content')).toBeInTheDocument()
        })

        expect(screen.queryByText('runtime-content')).not.toBeInTheDocument()
        expect(getApplication).toHaveBeenCalledWith('app-1')
    })
})
