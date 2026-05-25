import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { UpdateSeverity } from '@universo/types'
import ApplicationMigrationGuard from '../ApplicationMigrationGuard'
import { useApplicationMigrationStatus } from '../../hooks/useApplicationMigrationStatus'

vi.mock('../../hooks/useApplicationMigrationStatus', () => ({
    useApplicationMigrationStatus: vi.fn()
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('@universo/utils', async () => {
    const actual = await vi.importActual<typeof import('@universo/utils')>('@universo/utils')
    return {
        ...actual,
        extractAxiosError: (error: unknown) => {
            if (typeof error === 'object' && error !== null && 'status' in error) {
                return error as { message?: string; status?: number }
            }
            return { message: error instanceof Error ? error.message : String(error) }
        }
    }
})

vi.mock('@universo/apps-template-mui', () => ({
    AppMainLayout: ({ children }: { children: ReactNode }) => <div data-testid='app-main-layout'>{children}</div>
}))

const renderGuard = (route: string) =>
    render(
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                <Route path='/' element={<div data-testid='root-page'>root-page</div>} />
                <Route
                    path='/a/:applicationId/*'
                    element={
                        <ApplicationMigrationGuard>
                            <div data-testid='guard-content'>guard-content</div>
                        </ApplicationMigrationGuard>
                    }
                />
            </Routes>
        </MemoryRouter>
    )

const createStatusQuery = (overrides?: Record<string, unknown>) =>
    ({
        isLoading: false,
        error: null,
        data: {
            migrationRequired: true,
            severity: UpdateSeverity.MANDATORY,
            blockers: [],
            schemaExists: true,
            structureUpgradeRequired: true,
            publicationUpdateAvailable: false,
            currentUserRole: 'owner',
            isMaintenance: false
        },
        refetch: vi.fn(),
        ...overrides
    } as unknown as ReturnType<typeof useApplicationMigrationStatus>)

describe('ApplicationMigrationGuard', () => {
    it('blocks non-admin application routes when a mandatory update is required', () => {
        vi.mocked(useApplicationMigrationStatus).mockReturnValue(createStatusQuery())

        renderGuard('/a/app-1/runtime')

        expect(screen.getByTestId('app-main-layout')).toBeInTheDocument()
        expect(screen.getByText('Update required')).toBeInTheDocument()
        expect(screen.queryByTestId('guard-content')).not.toBeInTheDocument()
    })

    it('allows content on admin routes even when a mandatory update is required', () => {
        vi.mocked(useApplicationMigrationStatus).mockReturnValue(createStatusQuery())

        renderGuard('/a/app-1/admin')

        expect(screen.getByTestId('guard-content')).toBeInTheDocument()
        expect(screen.queryByText('Update required')).not.toBeInTheDocument()
    })

    it('shows UnderDevelopmentPage for non-privileged users when schema does not exist yet', () => {
        vi.mocked(useApplicationMigrationStatus).mockReturnValue(
            createStatusQuery({
                data: {
                    migrationRequired: true,
                    severity: UpdateSeverity.MANDATORY,
                    blockers: [],
                    schemaExists: false,
                    structureUpgradeRequired: true,
                    publicationUpdateAvailable: false,
                    currentUserRole: 'member',
                    isMaintenance: false
                }
            })
        )

        renderGuard('/a/app-1/runtime')

        expect(screen.getByText('Application is under development')).toBeInTheDocument()
        expect(screen.queryByText('Update required')).not.toBeInTheDocument()
    })

    it('shows MaintenancePage for non-privileged users during maintenance', () => {
        vi.mocked(useApplicationMigrationStatus).mockReturnValue(
            createStatusQuery({
                data: {
                    migrationRequired: true,
                    severity: UpdateSeverity.MANDATORY,
                    blockers: [],
                    schemaExists: true,
                    structureUpgradeRequired: true,
                    publicationUpdateAvailable: false,
                    currentUserRole: 'member',
                    isMaintenance: true
                }
            })
        )

        renderGuard('/a/app-1/runtime')

        expect(screen.getByText('Maintenance in progress')).toBeInTheDocument()
        expect(screen.queryByText('Update required')).not.toBeInTheDocument()
    })

    it('redirects to root when migration status returns 403', () => {
        vi.mocked(useApplicationMigrationStatus).mockReturnValue(
            createStatusQuery({
                error: { message: 'Forbidden', status: 403 }
            })
        )

        renderGuard('/a/app-1/runtime')

        expect(screen.getByTestId('root-page')).toBeInTheDocument()
    })
})
