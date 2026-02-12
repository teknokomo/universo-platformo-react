import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MetahubMigrationGuard from '../MetahubMigrationGuard'
import { useMetahubMigrationsStatus } from '../../hooks'

vi.mock('../../hooks', () => ({
    useMetahubMigrationsStatus: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('@universo/utils', () => ({
    extractAxiosError: (error: unknown) => (error instanceof Error ? error.message : String(error))
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const renderGuard = (route: string) => {
    const queryClient = createQueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>
                <Routes>
                    <Route
                        path='/metahub/:metahubId/*'
                        element={
                            <MetahubMigrationGuard>
                                <div data-testid='guard-content'>guard-content</div>
                            </MetahubMigrationGuard>
                        }
                    />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('MetahubMigrationGuard', () => {
    it('blocks non-migration routes when migration is required', () => {
        vi.mocked(useMetahubMigrationsStatus).mockReturnValue({
            isLoading: false,
            error: null,
            data: {
                branchId: 'branch-1',
                schemaName: 'mhb_schema',
                currentStructureVersion: 1,
                targetStructureVersion: 2,
                structureUpgradeRequired: true,
                templateUpgradeRequired: false,
                migrationRequired: true,
                blockers: [],
                status: 'requires_migration',
                code: 'MIGRATION_REQUIRED',
                currentTemplateVersionId: null,
                currentTemplateVersionLabel: null,
                targetTemplateVersionId: null,
                targetTemplateVersionLabel: null
            },
            refetch: vi.fn()
        } as unknown as ReturnType<typeof useMetahubMigrationsStatus>)

        renderGuard('/metahub/019c4ea1-d889-705b-9798-1d28ba55a603/catalogs')

        expect(screen.getByText('Migration required')).toBeInTheDocument()
        expect(screen.queryByTestId('guard-content')).not.toBeInTheDocument()
    })

    it('allows content on migration route even when migration is required', () => {
        vi.mocked(useMetahubMigrationsStatus).mockReturnValue({
            isLoading: false,
            error: null,
            data: {
                branchId: 'branch-1',
                schemaName: 'mhb_schema',
                currentStructureVersion: 1,
                targetStructureVersion: 2,
                structureUpgradeRequired: true,
                templateUpgradeRequired: false,
                migrationRequired: true,
                blockers: [],
                status: 'requires_migration',
                code: 'MIGRATION_REQUIRED',
                currentTemplateVersionId: null,
                currentTemplateVersionLabel: null,
                targetTemplateVersionId: null,
                targetTemplateVersionLabel: null
            },
            refetch: vi.fn()
        } as unknown as ReturnType<typeof useMetahubMigrationsStatus>)

        renderGuard('/metahub/019c4ea1-d889-705b-9798-1d28ba55a603/migrations')

        expect(screen.getByTestId('guard-content')).toBeInTheDocument()
    })

    it('renders protected content when migration is not required', () => {
        vi.mocked(useMetahubMigrationsStatus).mockReturnValue({
            isLoading: false,
            error: null,
            data: {
                branchId: 'branch-1',
                schemaName: 'mhb_schema',
                currentStructureVersion: 2,
                targetStructureVersion: 2,
                structureUpgradeRequired: false,
                templateUpgradeRequired: false,
                migrationRequired: false,
                blockers: [],
                status: 'up_to_date',
                code: 'UP_TO_DATE',
                currentTemplateVersionId: null,
                currentTemplateVersionLabel: null,
                targetTemplateVersionId: null,
                targetTemplateVersionLabel: null
            },
            refetch: vi.fn()
        } as unknown as ReturnType<typeof useMetahubMigrationsStatus>)

        renderGuard('/metahub/019c4ea1-d889-705b-9798-1d28ba55a603/catalogs')

        expect(screen.getByTestId('guard-content')).toBeInTheDocument()
    })
})
