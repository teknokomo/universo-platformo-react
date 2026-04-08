import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const updateEnumerationValueMutate = vi.fn()
const updateEnumerationValueMutateAsync = vi.fn()

vi.mock('react-router-dom', () => ({
    useParams: () => ({ metahubId: 'metahub-1', enumerationId: 'enumeration-1' })
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string | { defaultValue?: string }) => {
            if (typeof fallback === 'string') return fallback
            return fallback?.defaultValue ?? _key
        },
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
        cancelQueries: vi.fn()
    }),
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
        const key = JSON.stringify(queryKey)
        if (key.includes('enumerationValues')) {
            return {
                data: {
                    items: [
                        {
                            id: 'value-1',
                            codename: 'value_one',
                            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Value One' } } },
                            description: null,
                            sortOrder: 1,
                            isDefault: false,
                            version: 3
                        }
                    ]
                },
                isLoading: false,
                error: null
            }
        }
        if (key.includes('detail')) {
            return {
                data: {
                    id: 'enumeration-1',
                    sortOrder: 1,
                    hubs: [{ id: 'hub-1' }],
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Enumeration One' } } }
                },
                isLoading: false,
                error: null
            }
        }
        if (key.includes('hubs')) {
            return {
                data: {
                    items: [{ id: 'hub-1', name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Hub' } } } }],
                    pagination: { total: 1, limit: 1000, offset: 0, count: 1, hasMore: false }
                },
                isLoading: false,
                error: null
            }
        }
        return {
            data: { canDelete: true },
            isLoading: false,
            error: null
        }
    }
}))

vi.mock('../../../settings/hooks/useCodenameConfig', () => ({
    useCodenameConfig: () => ({
        style: 'kebab-case',
        alphabet: 'en',
        allowMixed: false,
        autoConvertMixedAlphabets: true,
        autoReformat: true,
        requireReformat: false
    })
}))

vi.mock('../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../EnumerationActions', () => ({
    buildInitialValues: () => ({}),
    buildFormTabs: () => [],
    validateEnumerationForm: () => null,
    canSaveEnumerationForm: () => true,
    toPayload: () => ({})
}))

vi.mock('../../hooks', () => ({
    useUpdateEnumerationAtMetahub: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCreateEnumerationValue: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateEnumerationValue: () => ({
        mutate: updateEnumerationValueMutate,
        mutateAsync: updateEnumerationValueMutateAsync,
        isPending: false
    }),
    useDeleteEnumerationValue: () => ({ mutate: vi.fn(), isPending: false }),
    useMoveEnumerationValue: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useReorderEnumerationValue: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCopyEnumerationValue: () => ({ mutate: vi.fn(), isPending: false })
}))

vi.mock('../../../hubs', () => ({
    listHubs: vi.fn()
}))

vi.mock('../../../../components', () => ({
    ExistingCodenamesProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    CodenameField: () => null
}))

vi.mock('../../api', () => ({
    getEnumerationValueBlockingReferences: vi.fn(),
    getEnumerationById: vi.fn(),
    listEnumerationValues: vi.fn()
}))

vi.mock('../../../shared', () => ({
    fetchAllPaginatedItems: vi.fn(),
    metahubsQueryKeys: {
        enumerationValuesList: () => ['enumerationValues'],
        enumerationDetail: () => ['detail'],
        hubsList: () => ['hubs'],
        enumerationValues: () => ['enumerationValues']
    },
    sortSharedEntityList: <T extends { sortOrder?: number | null; effectiveSortOrder?: number | null; id: string }>(items: T[]) =>
        [...items].sort((left, right) => {
            const leftOrder =
                typeof left.effectiveSortOrder === 'number' ? left.effectiveSortOrder : left.sortOrder ?? Number.MAX_SAFE_INTEGER
            const rightOrder =
                typeof right.effectiveSortOrder === 'number' ? right.effectiveSortOrder : right.sortOrder ?? Number.MAX_SAFE_INTEGER
            return leftOrder - rightOrder || left.id.localeCompare(right.id)
        }),
    isSharedEntityRow: (value: { isShared?: boolean } | null | undefined) => value?.isShared === true,
    isSharedEntityMovable: (value: { isShared?: boolean; sharedBehavior?: { positionLocked?: boolean } | null } | null | undefined) =>
        value?.isShared !== true || value?.sharedBehavior?.positionLocked !== true,
    isSharedEntityActive: (value: { isActive?: boolean } | null | undefined) => value?.isActive !== false,
    reorderSharedEntityIds: (orderedIds: string[], activeId: string, overId: string) => {
        const fromIndex = orderedIds.indexOf(activeId)
        const toIndex = orderedIds.indexOf(overId)
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return orderedIds
        const nextIds = [...orderedIds]
        const [movedId] = nextIds.splice(fromIndex, 1)
        nextIds.splice(toIndex, 0, movedId)
        return nextIds
    }
}))

vi.mock('../dnd', () => ({
    DragOverlayValueRow: () => null
}))

const templateMuiMock = vi.hoisted(() => ({
    TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ToolbarControls: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void } }) => (
        <button onClick={primaryAction?.onClick} type='button'>
            {primaryAction?.label ?? 'create'}
        </button>
    ),
    EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
    APIEmptySVG: 'empty.svg',
    ViewHeaderMUI: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    LocalizedInlineField: () => null,
    useCodenameAutoFillVlc: () => undefined,
    revealPendingEntityFeedback: vi.fn()
}))

vi.mock('@universo/template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo/template-mui')>()
    return {
        ...templateMuiMock,
        useListDialogs: actual.useListDialogs,
        FlowListTable: ({
            data,
            renderActions
        }: {
            data: Array<Record<string, unknown>>
            renderActions?: (row: Record<string, unknown>) => ReactNode
        }) => (
            <div>
                {data.map((row) => (
                    <div key={String(row.id)}>
                        <span>{String(row.name ?? row.codename ?? row.id)}</span>
                        {renderActions?.(row)}
                    </div>
                ))}
            </div>
        ),
        BaseEntityMenu: ({
            entity,
            descriptors,
            createContext
        }: {
            entity: Record<string, unknown>
            descriptors: Array<{ id: string; onSelect?: (ctx: Record<string, unknown>) => void }>
            createContext: (ctx: Record<string, unknown>) => Record<string, unknown>
        }) => {
            const editDescriptor = descriptors.find((descriptor) => descriptor.id === 'edit')
            const context = createContext({
                entity,
                t: (_key: string, fallback?: string) => fallback ?? _key,
                helpers: {}
            })

            return (
                <button onClick={() => editDescriptor?.onSelect?.(context)} type='button'>
                    edit-enumeration-value
                </button>
            )
        }
    }
})

vi.mock('@universo/template-mui/components/dialogs', () => ({
    EntityFormDialog: ({
        open,
        onSave,
        initialExtraValues
    }: {
        open: boolean
        onSave: (data: Record<string, unknown>) => Promise<void>
        initialExtraValues: Record<string, unknown>
    }) => {
        if (!open) return null

        const values = {
            ...initialExtraValues,
            _hasCodenameDuplicate: false
        }

        return (
            <div data-testid='enumeration-value-dialog'>
                <button onClick={() => void onSave(values)} type='button'>
                    submit-enumeration-value
                </button>
            </div>
        )
    },
    ConfirmDeleteDialog: () => null
}))

import EnumerationValueList from '../EnumerationValueList'

describe('EnumerationValueList optimistic update flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses mutate instead of mutateAsync when saving edits and closes the dialog immediately', async () => {
        render(<EnumerationValueList />)

        fireEvent.click(screen.getByRole('button', { name: 'edit-enumeration-value' }))
        expect(screen.getByTestId('enumeration-value-dialog')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'submit-enumeration-value' }))

        await waitFor(() => {
            expect(updateEnumerationValueMutate).toHaveBeenCalledTimes(1)
        })

        expect(updateEnumerationValueMutateAsync).not.toHaveBeenCalled()
        expect(screen.queryByTestId('enumeration-value-dialog')).not.toBeInTheDocument()
    })
})
