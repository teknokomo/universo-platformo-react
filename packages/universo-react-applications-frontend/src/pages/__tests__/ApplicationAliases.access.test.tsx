import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const accessMocks = vi.hoisted(() => ({
    ability: null as { can: (action: string, subject: string) => boolean } | null,
    isSuperuser: false
}))

vi.mock('@universo-react/store', () => ({
    useHasGlobalAccess: () => ({
        ability: accessMocks.ability,
        isSuperuser: accessMocks.isSuperuser,
        loading: false
    })
}))

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({ t: (key: string) => (key === 'addNew' ? 'Add' : key) })
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) =>
            ({
                'aliases.page.title': 'Slugs',
                'aliases.page.searchPlaceholder': 'Search addresses...',
                'aliases.filters.showReleased': 'Show released addresses',
                'aliases.settings.title': 'Settings',
                'aliases.noPermission': 'You do not have permission to manage application addresses.',
                'aliases.readRequiredToView': 'Viewing the public address registry requires the read permission.',
                addNew: 'Add'
            }[key] ??
            options?.defaultValue ??
            key),
        i18n: { language: 'en', resolvedLanguage: 'en', changeLanguage: vi.fn() }
    })
}))

vi.mock('@universo-react/template-mui', () => ({
    APIEmptySVG: 'empty.svg',
    BaseEntityMenu: () => null,
    EmptyListState: () => <div data-testid='aliases-empty' />,
    FlowListTable: () => <div data-testid='aliases-table' />,
    PaginationControls: () => null,
    ToolbarControls: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void } }) =>
        primaryAction ? (
            <button type='button' onClick={primaryAction.onClick}>
                {primaryAction.label}
            </button>
        ) : null,
    ViewHeaderMUI: ({ title, search, children }: { title: string; search?: boolean; children?: ReactNode }) => (
        <div data-testid='aliases-header' data-search={String(search)}>
            <h1>{title}</h1>
            {children}
        </div>
    ),
    useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
    useDebouncedSearch: () => ({ handleSearchChange: vi.fn() }),
    usePaginated: () => ({
        data: [{ id: '018f8a78-7b8f-7c1d-a111-2222333344aa' }],
        isLoading: false,
        error: null,
        pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false },
        actions: { setSearch: vi.fn(), goToPage: vi.fn(), setLimit: vi.fn() }
    })
}))

vi.mock('../../api/applicationAliasesApi', () => ({
    createApplicationAlias: vi.fn(),
    getApplicationAliasErrorCode: vi.fn(),
    listAliasApplicationOptions: vi.fn(),
    listApplicationAliases: vi.fn(),
    releaseApplicationAlias: vi.fn(),
    renameApplicationAlias: vi.fn(),
    setPrimaryApplicationAlias: vi.fn()
}))

vi.mock('../../components/ApplicationAliasDialog', () => ({
    default: () => null
}))

import ApplicationAliases from '../ApplicationAliases'
import { APPLICATION_ALIAS_SUBJECT } from '../../utils/applicationAliasAbility'

const createAbility = (allowed: ReadonlySet<string>) => ({
    can: (action: string, subject: string) => allowed.has(`${action}:${subject}`)
})

const renderAliasesPage = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })

    render(
        <QueryClientProvider client={queryClient}>
            <ApplicationAliases />
        </QueryClientProvider>
    )
}

describe('ApplicationAliases page access', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        accessMocks.ability = null
        accessMocks.isSuperuser = false
    })

    it('shows the permission warning only when no alias capability is held', () => {
        accessMocks.ability = createAbility(new Set())

        renderAliasesPage()

        expect(screen.getByText('You do not have permission to manage application addresses.')).toBeInTheDocument()
        expect(screen.queryByTestId('aliases-header')).not.toBeInTheDocument()
    })

    it('keeps the page reachable for a create-only grant and explains the missing read capability', () => {
        accessMocks.ability = createAbility(new Set([`create:${APPLICATION_ALIAS_SUBJECT}`]))

        renderAliasesPage()

        expect(screen.getByText('Slugs')).toBeInTheDocument()
        expect(screen.getByText('Viewing the public address registry requires the read permission.')).toBeInTheDocument()
        expect(screen.queryByTestId('aliases-table')).not.toBeInTheDocument()
        expect(screen.getByTestId('aliases-header')).toHaveAttribute('data-search', 'false')
        // The create dialog's application picker is served by the read-gated
        // application-options endpoint, so the action stays hidden without read.
        expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    })

    it('renders the registry and create action for read plus create grants', () => {
        accessMocks.ability = createAbility(new Set([`read:${APPLICATION_ALIAS_SUBJECT}`, `create:${APPLICATION_ALIAS_SUBJECT}`]))

        renderAliasesPage()

        expect(screen.getByTestId('aliases-table')).toBeInTheDocument()
        expect(screen.getByTestId('aliases-header')).toHaveAttribute('data-search', 'true')
        expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    })
})
