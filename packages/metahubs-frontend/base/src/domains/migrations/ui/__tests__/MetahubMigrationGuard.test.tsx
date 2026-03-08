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
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('@universo/utils', async () => {
    const actual = await vi.importActual<typeof import('@universo/utils')>('@universo/utils')
    return {
        ...actual,
        extractAxiosError: (error: unknown) => (error instanceof Error ? error.message : String(error)),
        isPendingEntity: actual.isPendingEntity ?? ((item: any) => Boolean(item?.__pending)),
        getPendingAction: actual.getPendingAction ?? ((item: any) => (item?.__pending ? item?.__pendingAction : undefined)),
        makePendingMarkers:
            actual.makePendingMarkers ??
            ((action: string, options?: { feedbackVisible?: boolean }) => ({
                __pending: true,
                __pendingAction: action,
                ...(options?.feedbackVisible ? { __pendingFeedbackVisible: true } : {})
            })),
        isPendingInteractionBlocked:
            actual.isPendingInteractionBlocked ?? ((item: any) => item?.__pendingAction === 'create' || item?.__pendingAction === 'copy'),
        shouldShowPendingFeedback:
            actual.shouldShowPendingFeedback ??
            ((item: any) => {
                if (!item?.__pending) return false
                if (item.__pendingAction === 'create' || item.__pendingAction === 'copy') {
                    return Boolean(item.__pendingFeedbackVisible)
                }
                return true
            }),
        revealPendingFeedback:
            actual.revealPendingFeedback ??
            ((item: any) => {
                if (item?.__pendingAction !== 'create' && item?.__pendingAction !== 'copy') return item
                if (item?.__pendingFeedbackVisible) return item
                return { ...item, __pendingFeedbackVisible: true }
            }),
        getNextOptimisticSortOrder:
            actual.getNextOptimisticSortOrder ??
            ((items: any[] | null | undefined, startAt = 1) => {
                const source = Array.isArray(items) ? items : []
                const maxSortOrder = source.reduce((max, entry) => {
                    const sortOrder = entry?.sortOrder
                    return typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? Math.max(max, sortOrder) : max
                }, startAt - 1)
                return maxSortOrder + 1
            }),
        stripPendingMarkers:
            actual.stripPendingMarkers ??
            ((item: any) => {
                if (!item || typeof item !== 'object') return item
                const { __pending, __pendingAction, __pendingFeedbackVisible, ...rest } = item
                return rest
            })
    }
})

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
