import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlowListTable, ItemCard, PaginationControls, useViewPreference } from '..'

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, fallbackOrOptions?: string | Record<string, unknown>, interpolation?: Record<string, unknown>) => {
                const translations: Record<string, string> = {
                    'runtime.table.name': 'Name',
                    'runtime.table.description': 'Description',
                    'runtime.table.noRecords': 'No records',
                    'runtime.table.moveUp': 'Move up',
                    'runtime.table.moveDown': 'Move down',
                    'toolbar.search': 'Search...'
                }
                if (translations[key]) {
                    return translations[key]
                }
                if (key === 'pagination.displayedRows') {
                    const values = interpolation ?? (typeof fallbackOrOptions === 'object' ? fallbackOrOptions : {})
                    return `${values.from}-${values.to} of ${values.count}`
                }
                return typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key
            }
        })
    }
})

afterEach(() => {
    window.localStorage.removeItem('apps-template.view.runtime-test')
})

describe('runtime UI primitives', () => {
    it('renders card, table, and boxed pagination surfaces from the isolated apps template package', () => {
        const setPageSize = vi.fn()

        render(
            <>
                <ItemCard data={{ id: 'workspace-1', displayName: 'Primary workspace', description: 'Workspace description' }} />
                <FlowListTable
                    data={[{ id: 'workspace-1', displayName: 'Primary workspace', description: 'Workspace description' }]}
                    customColumns={[
                        { id: 'name', label: 'Name', render: (row) => row.displayName },
                        { id: 'description', label: 'Description', render: (row) => row.description }
                    ]}
                />
                <PaginationControls
                    pagination={{
                        currentPage: 1,
                        pageSize: 20,
                        totalItems: 35,
                        totalPages: 2,
                        hasNextPage: true,
                        hasPreviousPage: false
                    }}
                    actions={{
                        goToPage: vi.fn(),
                        nextPage: vi.fn(),
                        previousPage: vi.fn(),
                        setSearch: vi.fn(),
                        setSort: vi.fn(),
                        setPageSize
                    }}
                />
            </>
        )

        expect(screen.getAllByText('Primary workspace')).toHaveLength(2)
        expect(screen.getByTestId('runtime-list-surface')).toBeVisible()
        expect(screen.getByTestId('runtime-pagination-surface')).toBeVisible()
        expect(screen.getByText('1-20 of 35')).toBeVisible()
        expect(screen.getByRole('combobox')).toBeVisible()
    })

    it('loads persisted view preference after mount instead of during the initial render', async () => {
        window.localStorage.setItem('apps-template.view.runtime-test', 'card')

        const PreferenceProbe = () => {
            const [mode] = useViewPreference<'list' | 'card'>('runtime-test', 'list')
            return <span>{mode}</span>
        }

        render(<PreferenceProbe />)

        expect(await screen.findByText('card')).toBeVisible()
    })
})
