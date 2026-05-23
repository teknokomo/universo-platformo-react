import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColumnVisibilityControl, FlowListTable, ItemCard, PaginationControls, ToolbarControls, useViewPreference } from '..'

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
                    'runtime.table.moveUpRow': 'Move {{row}} up',
                    'runtime.table.moveDownRow': 'Move {{row}} down',
                    'runtime.table.untitled': 'Untitled row',
                    'runtime.card.untitled': 'Untitled item',
                    'toolbar.search': 'Search...',
                    'toolbar.columns': 'Columns',
                    'toolbar.columnsMenu': 'Table columns',
                    'toolbar.viewMode': 'View mode',
                    'toolbar.tableView': 'Table view',
                    'toolbar.cardView': 'Card view'
                }
                if (translations[key]) {
                    const values = interpolation ?? (typeof fallbackOrOptions === 'object' ? fallbackOrOptions : {})
                    return translations[key].replace(/\{\{(\w+)\}\}/g, (_match, name) => String(values[name] ?? ''))
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

    it('does not expose row IDs or raw JSON in generic card and default table fallbacks', () => {
        const rawId = '017f22e2-79b0-7cc3-98c4-dc0c0c073984'

        render(
            <>
                <ItemCard
                    data={{
                        id: rawId,
                        description: '{"blocks":[{"type":"paragraph","data":{"text":"Raw block"}}]}'
                    }}
                />
                <FlowListTable data={[{ id: rawId }]} />
            </>
        )

        expect(screen.getByText('Untitled item')).toBeVisible()
        expect(screen.getByText('Untitled row')).toBeVisible()
        expect(screen.queryByText(rawId)).not.toBeInTheDocument()
        expect(screen.queryByText(/blocks/)).not.toBeInTheDocument()
        expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
    })

    it('names sortable row actions with the readable row label', () => {
        render(
            <FlowListTable
                data={[
                    {
                        id: 'row-1',
                        cmp_01: {
                            _schema: '1',
                            locales: { en: { content: 'Lesson one' } },
                            _primary: 'en'
                        }
                    } as FlowListTableData & { cmp_01: unknown },
                    { id: 'row-2', Name: 'Lesson two' } as FlowListTableData & { Name: string }
                ]}
                sortableRows
            />
        )

        expect(screen.getByRole('button', { name: 'Move Lesson one down' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Move Lesson two up' })).toBeVisible()
    })

    it('does not expose raw JSON, UUIDs, or object placeholders from flow-list fallback cells', () => {
        const rawId = '017f22e2-79b0-7cc3-98c4-dc0c0c073985'

        render(
            <FlowListTable
                data={[
                    {
                        id: rawId,
                        displayName: 'Readable row',
                        description: '{"blocks":[{"type":"paragraph","data":{"text":"Raw block"}}]}',
                        metadata: { blocks: [{ type: 'paragraph' }] },
                        principalId: rawId
                    }
                ]}
                customColumns={[
                    { id: 'description', label: 'Description' },
                    { id: 'metadata', label: 'Metadata' },
                    { id: 'principalId', label: 'Principal' }
                ]}
            />
        )

        expect(screen.queryByText(rawId)).not.toBeInTheDocument()
        expect(screen.queryByText(/blocks/)).not.toBeInTheDocument()
        expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
    })

    it('does not expose raw JSON, UUIDs, or object placeholders from custom flow-list renderers', () => {
        const rawId = '017f22e2-79b0-7cc3-98c4-dc0c0c073986'

        render(
            <FlowListTable
                data={[{ id: rawId, displayName: 'Readable row' }]}
                customColumns={[
                    { id: 'safe', label: 'Safe', render: () => 'Readable value' },
                    { id: 'uuid', label: 'UUID', render: () => rawId },
                    { id: 'json', label: 'JSON', render: () => '{"blocks":[{"type":"paragraph"}]}' },
                    { id: 'object', label: 'Object', render: () => ({ blocks: [{ type: 'paragraph' }] } as unknown as string) }
                ]}
            />
        )

        expect(screen.getByText('Readable value')).toBeVisible()
        expect(screen.queryByText(rawId)).not.toBeInTheDocument()
        expect(screen.queryByText(/blocks/)).not.toBeInTheDocument()
        expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
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

    it('renders a generic column visibility menu and toggles business columns', () => {
        const onToggle = vi.fn()

        render(
            <ColumnVisibilityControl
                options={[
                    { field: 'title', label: 'Title', visible: true },
                    { field: 'status', label: 'Status', visible: false }
                ]}
                onToggle={onToggle}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Columns' }))
        expect(screen.getByRole('menu', { name: 'Table columns' })).toBeVisible()

        fireEvent.click(screen.getByText('Status'))
        expect(onToggle).toHaveBeenCalledWith('status', true)
    })

    it('uses localized toolbar labels for the view switcher and column menu defaults', () => {
        const onViewModeChange = vi.fn()
        const onToggle = vi.fn()

        render(
            <ToolbarControls
                viewToggleEnabled
                viewMode='list'
                onViewModeChange={onViewModeChange}
                columnVisibilityControl={{
                    options: [
                        { field: 'title', label: 'Title', visible: true },
                        { field: 'status', label: 'Status', visible: true }
                    ],
                    onToggle
                }}
            />
        )

        expect(screen.getByRole('group', { name: 'View mode' })).toBeVisible()
        fireEvent.click(screen.getByRole('button', { name: 'Card view' }))
        expect(onViewModeChange).toHaveBeenCalledWith('card')

        fireEvent.click(screen.getByRole('button', { name: 'Columns' }))
        expect(screen.getByRole('menu', { name: 'Table columns' })).toBeVisible()
    })
})
