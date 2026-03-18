import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MetapanelDashboard from './MetapanelDashboard'
import { getMetapanelStats } from '../api/dashboard'

vi.mock('../api/dashboard', () => ({
    getMetapanelStats: vi.fn()
}))

vi.mock('@mui/x-charts/SparkLineChart', () => ({
    SparkLineChart: () => <div data-testid='sparkline-chart' />
}))

vi.mock('@universo/template-mui', () => ({
    ViewHeaderMUI: ({ title, description }: { title: string; description?: string }) => (
        <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
        </div>
    ),
    StatCard: ({ title, value, description }: { title: string; value: string | number; description?: string }) => (
        <div>
            <span>{title}</span>
            <span>{value}</span>
            {description ? <span>{description}</span> : null}
        </div>
    ),
    HighlightedCard: ({ title, description, buttonText }: { title: string; description: string; buttonText: string }) => (
        <div>
            <span>{title}</span>
            <span>{description}</span>
            <button type='button'>{buttonText}</button>
        </div>
    )
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string) => {
            const dictionary: Record<string, string> = {
                title: 'Metapanel',
                subtitle: 'Workspace dashboard',
                overview: 'Overview',
                'stats.applications.title': 'Applications',
                'stats.applications.interval': 'Current platform snapshot',
                'stats.applications.description': 'Applications in the platform',
                'stats.metahubs.title': 'Metahubs',
                'stats.metahubs.interval': 'Current platform snapshot',
                'stats.metahubs.description': 'Metahubs available',
                'stats.users.title': 'Registered users',
                'stats.users.interval': 'Current platform snapshot',
                'stats.users.description': 'Users with global access',
                'documentation.title': 'Documentation',
                'documentation.description': 'Open platform guides',
                'documentation.button': 'Open documentation',
                'errors.loadFailed': 'Failed to load dashboard'
            }

            return dictionary[key] ?? key
        }
    })
}))

describe('MetapanelDashboard', () => {
    beforeEach(() => {
        vi.mocked(getMetapanelStats).mockResolvedValue({
            totalApplications: 51,
            totalMetahubs: 42,
            totalRoles: 7,
            totalGlobalUsers: 3,
            byRole: { user: 2 }
        })
    })

    it('renders the dashboard cards and documentation CTA from dashboard stats', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MetapanelDashboard />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Overview')).toBeInTheDocument()
        expect(screen.getByText('Registered users')).toBeInTheDocument()
        expect(screen.getByText('Applications')).toBeInTheDocument()
        expect(screen.getByText('Metahubs')).toBeInTheDocument()
        expect(screen.getByText('Documentation')).toBeInTheDocument()
        expect(screen.getByText('51')).toBeInTheDocument()
        expect(screen.getByText('42')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Open documentation' })).toBeInTheDocument()
    })
})
