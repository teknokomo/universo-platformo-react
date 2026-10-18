import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeInlineTabularEditor } from '../RuntimeInlineTabularEditor'
import type { FieldConfig } from '../dialogs/FormDialog'
import { fetchTabularRows } from '../../api/api'

const i18nState = vi.hoisted(() => ({
    language: 'en'
}))

const gridApiState = vi.hoisted(() => {
    const focusCalls: unknown[][] = []
    const editCalls: unknown[] = []

    return {
        focusCalls,
        editCalls,
        gridRows: [] as Record<string, unknown>[],
        processRowUpdate: null as null | ((next: Record<string, unknown>, previous: Record<string, unknown>) => Promise<unknown>),
        apiRef: {
            current: {
                setCellFocus: (...args: unknown[]) => focusCalls.push(args),
                startCellEditMode: (args: unknown) => editCalls.push(args)
            }
        }
    }
})

vi.mock('react-i18next', () => {
    const dictionaries = {
        en: {
            'tabular.errorFetch': 'Failed to load rows',
            'tabular.retry': 'Retry',
            'tabular.addRow': 'Add Row',
            'tabular.delete': 'Delete',
            'app.actions': 'Actions'
        },
        ru: {
            'tabular.errorFetch': 'Не удалось загрузить строки',
            'tabular.retry': 'Повторить',
            'tabular.addRow': 'Добавить строку',
            'tabular.delete': 'Удалить',
            'app.actions': 'Действия'
        }
    }

    return {
        useTranslation: () => ({
            t: (key: string, fallback?: string) =>
                dictionaries[i18nState.language as keyof typeof dictionaries]?.[
                    key as keyof (typeof dictionaries)[keyof typeof dictionaries]
                ] ??
                fallback ??
                key,
            i18n: { language: i18nState.language }
        })
    }
})

vi.mock('@mui/x-data-grid', async () => {
    const actual = await vi.importActual<typeof import('@mui/x-data-grid')>('@mui/x-data-grid')

    return {
        ...actual,
        DataGrid: ({
            rows,
            columns,
            processRowUpdate
        }: {
            rows: Record<string, unknown>[]
            columns: Array<{ field: string; renderCell?: (params: unknown) => React.ReactNode }>
            processRowUpdate: typeof gridApiState.processRowUpdate
        }) => {
            gridApiState.gridRows = rows
            gridApiState.processRowUpdate = processRowUpdate
            const actions = columns.find((column) => column.field === '__actions')
            return (
                <div data-testid='tabular-grid'>
                    {rows.map((row) => (
                        <div key={String(row.id)} data-testid={`grid-row-${row.id}`}>
                            <span>{String(row.title ?? '')}</span>
                            <span>{String(row.group ?? '')}</span>
                            {actions?.renderCell?.({ id: row.id, row })}
                        </div>
                    ))}
                </div>
            )
        },
        useGridApiRef: () => gridApiState.apiRef
    }
})

vi.mock('../../api/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/api')>()

    return {
        ...actual,
        fetchTabularRows: vi.fn()
    }
})

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

const childFields: FieldConfig[] = [
    {
        id: 'title',
        label: 'Title',
        type: 'STRING',
        required: false,
        validationRules: {},
        uiConfig: {}
    }
]

const renderEditor = (locale: 'en' | 'ru', options: { currentWorkspaceId?: string | null } = {}) => {
    i18nState.language = locale

    return render(
        <QueryClientProvider client={createQueryClient()}>
            <RuntimeInlineTabularEditor
                apiBaseUrl='/api/v1'
                applicationId='017f22e2-79b0-7cc3-98c4-dc0c0c073993'
                objectCollectionId='017f22e2-79b0-7cc3-98c4-dc0c0c073994'
                currentWorkspaceId={options.currentWorkspaceId}
                parentRecordId='017f22e2-79b0-7cc3-98c4-dc0c0c073995'
                componentId='017f22e2-79b0-7cc3-98c4-dc0c0c073996'
                childFields={childFields}
                label='Lessons'
                locale={locale}
            />
        </QueryClientProvider>
    )
}

const renderDeferredEditor = (childFieldsOverride: FieldConfig[], onRowsLoaded = vi.fn()) =>
    render(
        <QueryClientProvider client={createQueryClient()}>
            <RuntimeInlineTabularEditor
                apiBaseUrl='/api/v1'
                applicationId='017f22e2-79b0-7cc3-98c4-dc0c0c073993'
                objectCollectionId='017f22e2-79b0-7cc3-98c4-dc0c0c073994'
                parentRecordId='017f22e2-79b0-7cc3-98c4-dc0c0c073995'
                componentId='017f22e2-79b0-7cc3-98c4-dc0c0c073996'
                childFields={childFieldsOverride}
                label='Lessons'
                locale='en'
                deferPersistence
                onRowsLoaded={onRowsLoaded}
                onChange={vi.fn()}
            />
        </QueryClientProvider>
    )

describe('RuntimeInlineTabularEditor fetch errors', () => {
    beforeEach(() => {
        vi.mocked(fetchTabularRows).mockReset()
        i18nState.language = 'en'
        gridApiState.focusCalls.length = 0
        gridApiState.editCalls.length = 0
    })

    it('sanitizes backend details in English fetch failures', async () => {
        vi.mocked(fetchTabularRows).mockRejectedValue(
            new Error('SQL relation app_runtime.child_rows does not exist for 018f8a78-7b8f-7c1d-a111-2222333346ff')
        )

        renderEditor('en')

        expect(await screen.findByText('Failed to load rows')).toBeInTheDocument()
        expect(screen.queryByText(/018f8a78-7b8f-7c1d-a111-2222333346ff/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/SQL relation/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/app_runtime\.child_rows/i)).not.toBeInTheDocument()
    })

    it('retries a failed table load so the parent form can become ready', async () => {
        const onRowsLoaded = vi.fn()
        vi.mocked(fetchTabularRows)
            .mockRejectedValueOnce(new Error('SQL relation app_runtime.child_rows is temporarily unavailable'))
            .mockResolvedValueOnce({ items: [], total: 0 })

        renderDeferredEditor(childFields, onRowsLoaded)

        expect(await screen.findByText('Failed to load rows')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

        await waitFor(() => expect(fetchTabularRows).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.queryByText('Failed to load rows')).not.toBeInTheDocument())
        expect(onRowsLoaded).toHaveBeenCalledWith([])
        expect(screen.getByTestId('tabular-grid')).toBeInTheDocument()
    })

    it('requests child rows inside the current workspace scope', async () => {
        vi.mocked(fetchTabularRows).mockResolvedValue({ items: [], total: 0 })

        renderEditor('en', { currentWorkspaceId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997' })

        await waitFor(() =>
            expect(fetchTabularRows).toHaveBeenCalledWith(
                expect.objectContaining({
                    workspaceId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
                })
            )
        )
    })

    it('sanitizes backend details in Russian fetch failures', async () => {
        vi.mocked(fetchTabularRows).mockRejectedValue(
            new Error('SQL relation app_runtime.child_rows does not exist for 018f8a78-7b8f-7c1d-a111-2222333346ff')
        )

        renderEditor('ru')

        expect(await screen.findByText('Не удалось загрузить строки')).toBeInTheDocument()
        await waitFor(() => expect(screen.queryByText(/018f8a78-7b8f-7c1d-a111-2222333346ff/i)).not.toBeInTheDocument())
        expect(screen.queryByText(/SQL relation/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/app_runtime\.child_rows/i)).not.toBeInTheDocument()
    })

    it('starts editing the first visible field after adding a deferred row with hidden generated fields', async () => {
        vi.mocked(fetchTabularRows).mockResolvedValue({ items: [], total: 0 })
        const originalRequestAnimationFrame = window.requestAnimationFrame
        window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0)
            return 0
        }) as typeof window.requestAnimationFrame

        try {
            renderDeferredEditor([
                {
                    id: 'CellId',
                    label: 'Cell ID',
                    type: 'STRING',
                    uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
                },
                {
                    id: 'Name',
                    label: 'Name',
                    type: 'STRING'
                }
            ])

            await waitFor(() => expect(screen.getByTestId('tabular-grid')).toBeInTheDocument())
            fireEvent.click(screen.getByRole('button', { name: 'Add Row' }))

            await waitFor(() =>
                expect(gridApiState.editCalls).toContainEqual({
                    id: '__local_new_1',
                    field: 'Name'
                })
            )
            expect(gridApiState.focusCalls).toContainEqual(['__local_new_1', 'Name'])
            expect(gridApiState.editCalls).not.toContainEqual({
                id: '__local_new_1',
                field: 'CellId'
            })
        } finally {
            window.requestAnimationFrame = originalRequestAnimationFrame
        }
    })

    it('reports initially loaded deferred rows once when the parent updates during the callback', async () => {
        vi.mocked(fetchTabularRows).mockResolvedValue({
            items: [{ id: 'row-1', title: 'First row' }],
            total: 1
        })
        const queryClient = createQueryClient()

        const Harness = () => {
            const [loadCount, setLoadCount] = useState(0)

            return (
                <QueryClientProvider client={queryClient}>
                    <div data-testid='loaded-callback-count'>{loadCount}</div>
                    <RuntimeInlineTabularEditor
                        apiBaseUrl='/api/v1'
                        applicationId='017f22e2-79b0-7cc3-98c4-dc0c0c073993'
                        objectCollectionId='017f22e2-79b0-7cc3-98c4-dc0c0c073994'
                        parentRecordId='017f22e2-79b0-7cc3-98c4-dc0c0c073995'
                        componentId='017f22e2-79b0-7cc3-98c4-dc0c0c073996'
                        childFields={childFields}
                        label='Lessons'
                        locale='en'
                        deferPersistence
                        onChange={vi.fn()}
                        onRowsLoaded={() => setLoadCount((count) => count + 1)}
                    />
                </QueryClientProvider>
            )
        }

        render(<Harness />)

        await waitFor(() => expect(screen.getByTestId('loaded-callback-count')).toHaveTextContent('1'))
        expect(fetchTabularRows).toHaveBeenCalledTimes(1)
    })
})

const controlledFields: FieldConfig[] = [
    ...childFields,
    { id: 'group', label: 'Group', type: 'STRING' },
    { id: 'position', codename: 'Position', label: 'Position', type: 'NUMBER' }
]
const ordering = { orderFieldCodename: 'Position', labelFieldCodename: 'title' }

const renderControlledDeferred = (initialRows: Record<string, unknown>[], rejectCandidates = false) => {
    vi.mocked(fetchTabularRows).mockResolvedValue({ items: initialRows, total: initialRows.length })
    const emitted = vi.fn()
    const loaded = vi.fn()
    const queryClient = createQueryClient()
    const Harness = () => {
        const [value, setValue] = useState<Record<string, unknown>[] | undefined>()
        const [revision, setRevision] = useState(0)
        const [holdCandidates, setHoldCandidates] = useState(rejectCandidates)
        return (
            <QueryClientProvider client={queryClient}>
                <output data-testid='parent-revision'>{revision}</output>
                <button
                    onClick={() => {
                        setHoldCandidates(false)
                        setValue(emitted.mock.calls.at(-1)?.[0])
                    }}
                >
                    Accept candidate
                </button>
                <button onClick={() => setRevision((previous) => previous + 1)}>Rerender parent</button>
                <button onClick={() => setValue((previous) => previous?.map((row) => ({ ...row, group: 'first-section' })))}>
                    Assign section
                </button>
                <button onClick={() => setValue((previous) => previous?.map((row) => ({ ...row, group: null })))}>Clear section</button>
                <RuntimeInlineTabularEditor
                    apiBaseUrl='/api/v1'
                    applicationId='app'
                    objectCollectionId='object'
                    parentRecordId='parent'
                    componentId='table'
                    childFields={controlledFields.map((field) => ({ ...field }))}
                    label='Items'
                    locale='en'
                    rowOrdering={ordering}
                    deferPersistence
                    value={value}
                    onRowsLoaded={(rows) => {
                        loaded(rows)
                        setValue(rows)
                    }}
                    onChange={(rows) => {
                        emitted(rows)
                        setValue((previous) => (holdCandidates ? [...(previous ?? [])] : rows))
                    }}
                />
            </QueryClientProvider>
        )
    }
    const view = render(<Harness />)
    return { ...view, emitted, loaded, queryClient }
}

const editFirstRow = async (title: string) => {
    const previous = gridApiState.gridRows[0]
    await act(async () => {
        await gridApiState.processRowUpdate!({ ...previous, title }, previous)
    })
}
const openRowMenu = (rowId: string) => {
    fireEvent.click(within(screen.getByTestId(`grid-row-${rowId}`)).getByRole('button', { name: 'Actions' }))
}

describe('RuntimeInlineTabularEditor controlled deferred rows', () => {
    beforeEach(() => {
        vi.mocked(fetchTabularRows).mockReset()
        i18nState.language = 'en'
        gridApiState.gridRows = []
        gridApiState.focusCalls.length = 0
        gridApiState.editCalls.length = 0
    })

    it('initializes through onRowsLoaded once without emitting edits or blocking later server refresh', async () => {
        const { loaded, emitted, queryClient } = renderControlledDeferred([{ id: 'row-one', title: 'Original', group: null, position: 1 }])
        await screen.findByText('Original')
        expect(loaded).toHaveBeenCalledTimes(1)
        expect(emitted).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Rerender parent' }))
        expect(loaded).toHaveBeenCalledTimes(1)
        vi.mocked(fetchTabularRows).mockResolvedValue({
            items: [{ id: 'row-one', title: 'Refreshed', group: null, position: 1 }],
            total: 1
        })
        await act(async () => {
            await queryClient.invalidateQueries({ queryKey: ['tabularRows'] })
        })
        expect(await screen.findByText('Refreshed')).toBeInTheDocument()
        expect(emitted).not.toHaveBeenCalled()
    })

    it('rolls back an unaccepted first row without re-emitting or retaining a pending edit', async () => {
        const { emitted, loaded } = renderControlledDeferred([], true)
        await waitFor(() => expect(loaded).toHaveBeenCalledTimes(1))
        fireEvent.click(screen.getByRole('button', { name: 'Add Row' }))
        await waitFor(() => expect(gridApiState.gridRows).toEqual([]))
        expect(emitted).toHaveBeenCalledTimes(1)
        expect(emitted.mock.calls[0][0]).toHaveLength(1)
        expect(gridApiState.editCalls).toEqual([])
    })

    it('shows a confirmed candidate after the parent first rolls it back while awaiting confirmation', async () => {
        const { emitted, loaded } = renderControlledDeferred([], true)
        await waitFor(() => expect(loaded).toHaveBeenCalledTimes(1))
        fireEvent.click(screen.getByRole('button', { name: 'Add Row' }))
        await waitFor(() => expect(gridApiState.gridRows).toEqual([]))
        fireEvent.click(screen.getByRole('button', { name: 'Accept candidate' }))
        await waitFor(() => expect(gridApiState.gridRows).toHaveLength(1))
        const confirmedId = gridApiState.gridRows[0].id
        await editFirstRow('Confirmed section')
        expect(gridApiState.gridRows[0].id).toBe(confirmedId)
        expect(emitted.mock.calls.at(-1)?.[0][0].title).toBe('Confirmed section')
    })

    it('restores a rejected last-row deletion with its original grid identity and content', async () => {
        const { emitted } = renderControlledDeferred([{ id: 'persisted-row', title: 'Keep me', group: 'first-section', position: 1 }], true)
        await screen.findByText('Keep me')
        openRowMenu('persisted-row')
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
        fireEvent.click(screen.getByTestId('confirm-delete-confirm'))
        await waitFor(() => expect(emitted).toHaveBeenCalledWith([]))
        expect(await screen.findByTestId('grid-row-persisted-row')).toHaveTextContent('Keep me')
        expect(gridApiState.gridRows[0].group).toBe('first-section')
        expect(emitted).toHaveBeenCalledTimes(1)
    })

    it('shows external grouping patches and retains them in subsequent edits in both directions', async () => {
        const { emitted } = renderControlledDeferred([{ id: 'persisted-row', title: 'Original', group: null, position: 1 }])
        await screen.findByText('Original')
        fireEvent.click(screen.getByRole('button', { name: 'Assign section' }))
        expect(await screen.findByText('first-section')).toBeInTheDocument()
        expect(gridApiState.gridRows[0].id).toBe('persisted-row')
        expect(emitted).not.toHaveBeenCalled()
        await editFirstRow('Edited grouped')
        expect(emitted).toHaveBeenLastCalledWith([{ title: 'Edited grouped', group: 'first-section', position: 1 }])
        const echoedRows = gridApiState.gridRows
        fireEvent.click(screen.getByRole('button', { name: 'Rerender parent' }))
        expect(gridApiState.gridRows).toBe(echoedRows)
        fireEvent.click(screen.getByRole('button', { name: 'Clear section' }))
        await waitFor(() => expect(gridApiState.gridRows[0].group).toBeNull())
        await editFirstRow('Edited flat')
        expect(emitted).toHaveBeenLastCalledWith([{ title: 'Edited flat', group: null, position: 1 }])
        expect(gridApiState.gridRows[0].id).toBe('persisted-row')
    })

    it('preserves identities on accepted add, edit, copy, reorder and delete echoes', async () => {
        const { emitted } = renderControlledDeferred([{ id: 'persisted-row', title: 'Original', group: null, position: 1 }])
        await screen.findByText('Original')
        fireEvent.click(screen.getByRole('button', { name: 'Add Row' }))
        await waitFor(() => expect(gridApiState.gridRows).toHaveLength(2))
        expect(gridApiState.gridRows.map((row) => row.id)).toEqual(['persisted-row', '__local_new_1'])
        await editFirstRow('Edited')
        openRowMenu('persisted-row')
        fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))
        await waitFor(() => expect(gridApiState.gridRows).toHaveLength(3))
        const copyId = String(gridApiState.gridRows[1].id)
        expect(copyId).toMatch(/^__local_copy_/)
        openRowMenu(copyId)
        fireEvent.click(screen.getByRole('menuitem', { name: /Move down/ }))
        await waitFor(() => expect(gridApiState.gridRows.map((row) => row.id)).toEqual(['persisted-row', '__local_new_1', copyId]))
        expect(emitted.mock.calls.at(-1)?.[0].map((row: Record<string, unknown>) => row.position)).toEqual([1, 2, 3])
        openRowMenu('__local_new_1')
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
        fireEvent.click(screen.getByTestId('confirm-delete-confirm'))
        await waitFor(() => expect(gridApiState.gridRows.map((row) => row.id)).toEqual(['persisted-row', copyId]))
        expect(emitted.mock.calls.at(-1)?.[0].map((row: Record<string, unknown>) => row.title)).toEqual(['Edited', 'Edited'])
    })
})
