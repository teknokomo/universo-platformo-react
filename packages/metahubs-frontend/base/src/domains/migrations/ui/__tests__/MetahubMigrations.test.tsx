import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
    useQuery: vi.fn(),
    useMetahubMigrationsList: vi.fn(),
    useMetahubMigrationsPlan: vi.fn(),
    mutate: vi.fn()
}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()
    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key,
            i18n: { language: 'en' }
        })
    }
})

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useParams: () => ({ metahubId: 'metahub-1' })
    }
})

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    return {
        ...actual,
        useQuery: mocks.useQuery
    }
})

vi.mock('@universo/template-mui', () => ({
    PAGE_CONTENT_GUTTER_MX: 0,
    TemplateMainCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ViewHeaderMUI: ({ title }: { title: string }) => <h1>{title}</h1>,
    FlowListTable: ({ data }: { data: Array<{ name: string }> }) => (
        <div data-testid='flow-list-table'>{data.map((row) => row.name).join(', ')}</div>
    ),
    PaginationControls: () => <div data-testid='pagination-controls' />,
    EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
    APIEmptySVG: 'api-empty'
}))

vi.mock('../../hooks', () => ({
    useMetahubMigrationsList: mocks.useMetahubMigrationsList,
    useMetahubMigrationsPlan: mocks.useMetahubMigrationsPlan,
    useApplyMetahubMigrations: () => ({
        mutate: mocks.mutate,
        isPending: false,
        error: null
    })
}))

import MetahubMigrations from '../MetahubMigrations'

describe('MetahubMigrations', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mocks.useQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'branch-1',
                        codename: 'main',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Main branch' } }
                        }
                    }
                ],
                meta: {
                    activeBranchId: 'branch-1',
                    defaultBranchId: 'branch-1'
                }
            }
        })

        mocks.useMetahubMigrationsList.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'migration-1',
                        name: 'baseline.fixed',
                        fromVersion: '0.1.0',
                        toVersion: '0.1.0',
                        appliedAt: '2026-03-12T10:00:00.000Z',
                        meta: { kind: 'baseline', templateVersionLabel: '0.1.0' }
                    }
                ],
                total: 1
            },
            isLoading: false,
            error: null
        })
    })

    it('runs a dry run with the effective branch id from the page controls', async () => {
        mocks.useMetahubMigrationsPlan.mockReturnValue({
            data: {
                structureUpgradeRequired: true,
                templateUpgradeRequired: false
            },
            isLoading: false,
            error: null
        })

        const user = userEvent.setup()
        render(<MetahubMigrations />)

        await user.click(screen.getByRole('button', { name: 'Dry run' }))

        expect(mocks.mutate).toHaveBeenCalledWith({
            metahubId: 'metahub-1',
            branchId: 'branch-1',
            dryRun: true,
            cleanupMode: 'confirm'
        })
    })

    it('disables apply when no structure or template upgrade is pending', () => {
        mocks.useMetahubMigrationsPlan.mockReturnValue({
            data: {
                structureUpgradeRequired: false,
                templateUpgradeRequired: false
            },
            isLoading: false,
            error: null
        })

        render(<MetahubMigrations />)

        expect(screen.getByRole('button', { name: 'Apply migrations' })).toBeDisabled()
    })
})
