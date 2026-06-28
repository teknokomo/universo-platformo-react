import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
            'tabular.addRow': 'Add Row',
            'tabular.delete': 'Delete',
            'app.actions': 'Actions'
        },
        ru: {
            'tabular.errorFetch': 'Не удалось загрузить строки',
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
        DataGrid: () => <div data-testid='tabular-grid' />,
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

const renderDeferredEditor = (childFieldsOverride: FieldConfig[]) =>
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
})
