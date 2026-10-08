import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@universo-react/i18n'
import type { DashboardLibraryTableWidgetConfig } from '@universo-react/types'
import type { GridRenderCellParams } from '@mui/x-data-grid'

import '../../../i18n'
import { fetchAppData, restoreAppRow, setRuntimeLibraryRelation, updateAppRow } from '../../../api'
import type { AppDataResponse } from '../../../api/api'
import { fetchRuntimeWorkspaceMembers } from '../../../api/workspaces'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import type { DashboardDetailsSlot, ZoneWidgetItem } from '../../contracts'
import LibraryDetailsTableWidget from '../LibraryDetailsTableWidget'
import type { CustomizedDataGridProps } from '../CustomizedDataGrid'

vi.mock('../../../api', () => ({
    fetchAppData: vi.fn(),
    restoreAppRow: vi.fn(),
    setRuntimeLibraryRelation: vi.fn(),
    updateAppRow: vi.fn()
}))
vi.mock('../../../api/workspaces', () => ({ fetchRuntimeWorkspaceMembers: vi.fn() }))
vi.mock('../CustomizedDataGrid', () => ({
    default: (props: CustomizedDataGridProps) => (
        <div data-testid='library-grid'>
            <span data-testid='library-grid-columns'>{props.columns.map((column) => column.field).join(',')}</span>
            {props.rows.flatMap((row) =>
                props.columns.map((column) => (
                    <span key={`${row.id}:${column.field}`}>
                        {column.renderCell
                            ? column.renderCell({ id: row.id, row, field: column.field, value: row[column.field] } as GridRenderCellParams)
                            : String(row[column.field] ?? '')}
                    </span>
                ))
            )}
        </div>
    )
}))
vi.mock('../DetailsTableCreateTargetMenu', () => ({ default: () => null }))

const sourceCollectionId = '019e44fc-a16a-760c-8190-280c4d9dc720'
const targetCollectionId = '019e44fc-a16a-760c-8190-280c4d9dc721'
const recordHandle = 'rh1.test-library-document-record-0001'
const targetRecordId = '019e44fc-a16a-760c-8190-280c4d9dc723'
const workspaceId = '019e44fc-a16a-760c-8190-280c4d9dc724'
const memberId = '019e44fc-a16a-760c-8190-280c4d9dc725'

const permissions = {
    createContent: false,
    editContent: false,
    deleteContent: false,
    manageApplication: false,
    manageMembers: false,
    readReports: false
}

const baseDetails: DashboardDetailsSlot = {
    title: 'Library',
    locale: 'en',
    apiBaseUrl: '/api/v1',
    applicationId: 'application-a',
    currentWorkspaceId: workspaceId,
    runtimeAccessMode: 'member',
    permissions,
    objectCollections: [
        { id: sourceCollectionId, codename: 'Documents' },
        { id: targetCollectionId, codename: 'Folders' }
    ]
}

const baseConfig: DashboardLibraryTableWidgetConfig = {
    variant: 'library',
    libraryView: 'all',
    lifecycleState: 'active',
    showSearch: true
}

const runtimeRow = {
    key: 'row-a',
    target: {
        recordHandle,
        entityCodename: 'Documents',
        version: 3,
        displayType: 'Document',
        starred: false,
        shared: false
    },
    cells: [{ key: 'Title', value: 'Document A' }]
}

const makeWidget = (config: DashboardLibraryTableWidgetConfig = baseConfig, total = 1): ZoneWidgetItem => ({
    id: '019e44fc-a16a-760c-8190-280c4d9dc726',
    instanceKey: 'library-details',
    widgetKey: 'detailsTable',
    zone: 'center',
    sortOrder: 1,
    isActive: true,
    parentInstanceKey: null,
    slotKey: null,
    config,
    runtimeData: {
        status: 'ready',
        data: {
            kind: 'table',
            columns: [{ key: 'Title', label: 'Title' }],
            rows: [runtimeRow],
            pagination: { total, limit: 1, offset: 0 }
        }
    }
})

const targetResponse = (offset = 0): AppDataResponse => ({
    objectCollection: {
        id: targetCollectionId,
        codename: 'Folders',
        tableName: 'folders',
        name: 'Folders'
    },
    sections: [],
    objectCollections: [],
    activeObjectCollectionId: targetCollectionId,
    columns: [
        {
            id: 'title-column',
            codename: 'Title',
            field: 'Title',
            dataType: 'STRING',
            headerName: 'Title',
            isRequired: false,
            validationRules: {},
            uiConfig: {}
        }
    ],
    rows: [{ id: targetRecordId, Title: `Folder ${Math.floor(offset / 100) + 1}` }],
    pagination: { total: 250, limit: 100, offset },
    settings: {},
    workspacesEnabled: true,
    currentWorkspaceId: workspaceId,
    permissions
})

const clients: QueryClient[] = []
const renderLibrary = (widget = makeWidget(), details: DashboardDetailsSlot = baseDetails) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    clients.push(client)
    return render(
        <QueryClientProvider client={client}>
            <DashboardDetailsProvider value={details}>
                <LibraryDetailsTableWidget widget={widget} />
            </DashboardDetailsProvider>
        </QueryClientProvider>
    )
}

const openRowActions = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Actions for Document A' }))
}

const selectOnlyComboboxOption = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
    await user.click(screen.getByRole('combobox', { name: label }))
    await user.click(await screen.findByRole('option', { name: option }))
}

beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.mocked(fetchAppData).mockImplementation(async ({ offset = 0 }) => targetResponse(offset))
    vi.mocked(fetchRuntimeWorkspaceMembers).mockImplementation(async ({ params }) => ({
        items: [{ userId: memberId, roleCodename: 'member', email: 'member@example.com', nickname: 'Alice', canRemove: false }],
        total: 250,
        limit: 100,
        offset: params?.offset ?? 0
    }))
    vi.mocked(restoreAppRow).mockResolvedValue(undefined)
    vi.mocked(setRuntimeLibraryRelation).mockResolvedValue(undefined)
    vi.mocked(updateAppRow).mockResolvedValue(undefined)
})

afterEach(() => {
    clients.forEach((client) => client.clear())
    clients.length = 0
    vi.clearAllMocks()
})

describe('LibraryDetailsTableWidget', () => {
    it('states when runtime rows are bounded and search only covers loaded rows', () => {
        renderLibrary(makeWidget(baseConfig, 25))

        expect(screen.getByTestId('library-bounded-data-note')).toHaveTextContent('Loaded 1 of 25 records.')
        expect(screen.getByTestId('library-bounded-data-note')).toHaveTextContent('Search applies to loaded rows only.')
    })

    it('does not show a bounded-data warning for a complete payload', () => {
        renderLibrary(makeWidget(baseConfig, 1))
        expect(screen.queryByTestId('library-bounded-data-note')).not.toBeInTheDocument()
    })

    it('uses the application Learning Content default view for the all-items library', () => {
        renderLibrary(makeWidget({ ...baseConfig, defaultViewMode: 'table', showViewToggle: true }), {
            ...baseDetails,
            settings: { learningContent: { defaultView: 'cards' } }
        })

        expect(screen.getByRole('button', { name: 'Card View' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.queryByTestId('library-grid')).not.toBeInTheDocument()
        expect(screen.getByText('Document A')).toBeInTheDocument()
    })

    it('hides restore and shared-member actions without edit permission', () => {
        const deletedConfig: DashboardLibraryTableWidgetConfig = { ...baseConfig, lifecycleState: 'deleted' }
        renderLibrary(makeWidget(deletedConfig))
        expect(screen.getByTestId('library-grid-columns')).not.toHaveTextContent('__actions')

        renderLibrary(
            makeWidget({
                ...baseConfig,
                rowActions: [
                    {
                        id: 'share-member',
                        kind: 'library.toggle',
                        libraryView: 'shared',
                        principalTarget: 'workspaceMember',
                        label: { en: 'Share access', ru: 'Открыть доступ' }
                    }
                ]
            })
        )
        expect(screen.queryByRole('button', { name: 'Actions for Document A' })).not.toBeInTheDocument()
    })

    it('forwards the current Entity revision to host-owned row actions', async () => {
        const user = userEvent.setup()
        const onOpenRowTarget = vi.fn()
        renderLibrary(makeWidget(), {
            ...baseDetails,
            permissions: { ...permissions, deleteContent: true },
            onOpenRowTarget
        })

        await openRowActions(user)
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

        expect(onOpenRowTarget).toHaveBeenCalledExactlyOnceWith(
            {
                rowId: recordHandle,
                expectedVersion: runtimeRow.target.version,
                objectCollectionId: sourceCollectionId,
                objectCollectionCodename: 'Documents'
            },
            'delete'
        )
    })

    it('surfaces a localized direct restore failure', async () => {
        const user = userEvent.setup()
        vi.mocked(restoreAppRow).mockRejectedValueOnce(new Error('SQL restore failed'))
        renderLibrary(makeWidget({ ...baseConfig, lifecycleState: 'deleted' }), {
            ...baseDetails,
            permissions: { ...permissions, editContent: true }
        })

        await user.click(screen.getByRole('button', { name: 'Restore' }))
        expect(await screen.findByText('Record could not be restored.')).toBeInTheDocument()
        expect(screen.queryByText('SQL restore failed')).not.toBeInTheDocument()
    })

    it('shares, removes access, and paginates workspace-member choices past 100', async () => {
        const user = userEvent.setup()
        const onRuntimeDataChanged = vi.fn().mockResolvedValue(undefined)
        const config: DashboardLibraryTableWidgetConfig = {
            ...baseConfig,
            rowActions: [
                {
                    id: 'share-member',
                    kind: 'library.toggle',
                    libraryView: 'shared',
                    principalTarget: 'workspaceMember',
                    label: { en: 'Share access', ru: 'Открыть доступ' }
                }
            ]
        }
        renderLibrary(makeWidget(config), {
            ...baseDetails,
            permissions: { ...permissions, editContent: true },
            onRuntimeDataChanged
        })

        await openRowActions(user)
        await user.click(screen.getByRole('menuitem', { name: 'Share access' }))
        expect(await screen.findByRole('dialog', { name: 'Share' })).toBeInTheDocument()
        await waitFor(() =>
            expect(fetchRuntimeWorkspaceMembers).toHaveBeenCalledWith(expect.objectContaining({ params: { limit: 100, offset: 0 } }))
        )

        await user.click(screen.getByRole('button', { name: /next page/i }))
        await waitFor(() =>
            expect(fetchRuntimeWorkspaceMembers).toHaveBeenLastCalledWith(expect.objectContaining({ params: { limit: 100, offset: 100 } }))
        )

        await selectOnlyComboboxOption(user, 'Workspace member', 'Alice (member@example.com)')
        await user.click(screen.getByRole('button', { name: 'Share' }))
        await waitFor(() =>
            expect(setRuntimeLibraryRelation).toHaveBeenCalledWith(
                expect.objectContaining({ relationKey: 'shared', active: true, principalType: 'workspaceMember', principalId: memberId })
            )
        )
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Share' })).not.toBeInTheDocument())
        await waitFor(() => expect(onRuntimeDataChanged).toHaveBeenCalledTimes(1))

        await openRowActions(user)
        await user.click(screen.getByRole('menuitem', { name: 'Share access' }))
        await selectOnlyComboboxOption(user, 'Workspace member', 'Alice (member@example.com)')
        await user.click(screen.getByRole('button', { name: 'Remove access' }))
        await waitFor(() =>
            expect(setRuntimeLibraryRelation).toHaveBeenLastCalledWith(
                expect.objectContaining({ relationKey: 'shared', active: false, principalType: 'workspaceMember', principalId: memberId })
            )
        )
        await waitFor(() => expect(onRuntimeDataChanged).toHaveBeenCalledTimes(2))
    }, 10_000)

    it('paginates move targets past the first 100 records', async () => {
        const user = userEvent.setup()
        renderLibrary(
            makeWidget({
                ...baseConfig,
                rowActions: [
                    {
                        id: 'move',
                        kind: 'field.updateWithTarget',
                        fieldCodename: 'ParentId',
                        targetObjectCollectionCodename: 'Folders',
                        label: { en: 'Move', ru: 'Переместить' }
                    }
                ]
            }),
            { ...baseDetails, permissions: { ...permissions, editContent: true } }
        )

        await openRowActions(user)
        await user.click(screen.getByRole('menuitem', { name: 'Move' }))
        expect(await screen.findByRole('dialog', { name: 'Choose target' })).toBeInTheDocument()
        await waitFor(() => expect(fetchAppData).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, offset: 0 })))
        await user.click(screen.getByRole('button', { name: /next page/i }))
        await waitFor(() => expect(fetchAppData).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, offset: 100 })))
    })

    it('paginates restore targets past the first 100 records', async () => {
        const user = userEvent.setup()
        renderLibrary(
            makeWidget({
                ...baseConfig,
                lifecycleState: 'deleted',
                restoreTarget: { targetObjectCollectionCodename: 'Folders', parentFieldCodename: 'ParentId' }
            }),
            { ...baseDetails, permissions: { ...permissions, editContent: true } }
        )

        await user.click(screen.getByRole('button', { name: 'Restore' }))
        expect(await screen.findByRole('dialog', { name: 'Restore to target' })).toBeInTheDocument()
        await waitFor(() => expect(fetchAppData).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, offset: 0 })))
        await user.click(screen.getByRole('button', { name: /next page/i }))
        await waitFor(() => expect(fetchAppData).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, offset: 100 })))
    })

    it('uses separate localized target query and mutation errors', async () => {
        const user = userEvent.setup()
        const config: DashboardLibraryTableWidgetConfig = {
            ...baseConfig,
            rowActions: [
                {
                    id: 'move',
                    kind: 'field.updateWithTarget',
                    fieldCodename: 'ParentId',
                    targetObjectCollectionCodename: 'Folders',
                    label: { en: 'Move', ru: 'Переместить' }
                }
            ]
        }
        vi.mocked(fetchAppData).mockRejectedValueOnce(new Error('SQL target query failed'))
        const first = renderLibrary(makeWidget(config), { ...baseDetails, permissions: { ...permissions, editContent: true } })
        await openRowActions(user)
        await user.click(screen.getByRole('menuitem', { name: 'Move' }))
        expect(await screen.findByText('Targets could not be loaded.')).toBeInTheDocument()
        first.unmount()

        vi.mocked(fetchAppData).mockResolvedValue(targetResponse())
        vi.mocked(updateAppRow).mockRejectedValueOnce(new Error('SQL update failed'))
        renderLibrary(makeWidget(config), { ...baseDetails, permissions: { ...permissions, editContent: true } })
        await openRowActions(user)
        await user.click(screen.getByRole('menuitem', { name: 'Move' }))
        await selectOnlyComboboxOption(user, 'Target', 'Folder 1')
        fireEvent.click(screen.getByRole('button', { name: 'Move' }))
        expect(await screen.findByText('Record could not be updated.')).toBeInTheDocument()
        expect(screen.queryByText('SQL update failed')).not.toBeInTheDocument()
    })
})
