import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const navigateMock = vi.fn()
const invalidateQueriesMock = vi.fn()
const enqueueSnackbarMock = vi.fn()

const currentHub = {
    id: 'hub-1',
    codename: 'hub-one',
    name: {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: 'TreeEntity One',
                version: 1,
                isActive: true,
                createdAt: '2026-03-13T00:00:00.000Z',
                updatedAt: '2026-03-13T00:00:00.000Z'
            }
        }
    },
    description: null,
    sortOrder: 0,
    parentTreeEntityId: null
}

type LocalizedValue = {
    locales?: Record<string, { content?: string }>
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({
        enqueueSnackbar: enqueueSnackbarMock
    })
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: invalidateQueriesMock
    }),
    useQuery: ({ queryKey }: { queryKey?: unknown[] } = {}) => ({
        data: Array.isArray(queryKey) && queryKey.includes('entity-types-list') ? { items: [] } : { items: [currentHub] }
    })
}))

vi.mock('@universo/template-mui', () => ({
    TemplateMainCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ItemCard: () => null,
    createMemberActions: () => [],
    ToolbarControls: () => null,
    EmptyListState: () => null,
    SkeletonGrid: () => null,
    APIEmptySVG: () => null,
    usePaginated: () => ({
        data: [currentHub],
        isLoading: false,
        error: null,
        pagination: { limit: 20, offset: 0, count: 1, total: 1, hasMore: false },
        actions: {
            setSearch: vi.fn()
        }
    }),
    useDebouncedSearch: () => ({
        handleSearchChange: vi.fn()
    }),
    PaginationControls: () => null,
    FlowListTable: () => <div data-testid='flow-list-table' />,
    gridSpacing: 2,
    useConfirm: () => ({
        confirm: vi.fn()
    }),
    LocalizedInlineField: () => null,
    useCodenameAutoFillVlc: () => undefined,
    EntitySelectionPanel: () => null,
    revealPendingEntityFeedback: vi.fn(),
    ViewHeaderMUI: () => null,
    BaseEntityMenu: () => null,
    useListDialogs: () => ({
        dialogs: {
            create: { open: false },
            edit: { open: false, item: null },
            copy: { open: false, item: null },
            delete: { open: false, item: null },
            conflict: { open: false, data: null }
        },
        openCreate: vi.fn(),
        openEdit: vi.fn(),
        openCopy: vi.fn(),
        openDelete: vi.fn(),
        openConflict: vi.fn(),
        close: vi.fn()
    })
}))

vi.mock('@universo/template-mui/components/dialogs', () => ({
    EntityFormDialog: ({ open, title }: { open: boolean; title: string }) => (open ? <div role='dialog' aria-label={title} /> : null),
    ConflictResolutionDialog: () => null
}))

vi.mock('../../hooks/treeEntityMutations', () => ({
    useCreateTreeEntity: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useUpdateTreeEntity: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useDeleteTreeEntity: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useCopyTreeEntity: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useReorderTreeEntity: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../../../hooks', () => ({
    useEntityTypesQuery: () => ({
        data: { items: [] },
        isLoading: false,
        isError: false,
        error: null
    })
}))

vi.mock('../../../../../hooks/useViewPreference', () => ({
    useViewPreference: () => ['table', vi.fn()]
}))

vi.mock('../../../../shared', () => ({
    fetchAllPaginatedItems: vi.fn(),
    metahubsQueryKeys: {
        childTreeEntitiesList: (...args: unknown[]) => ['child-treeEntities-list', ...args],
        treeEntitiesList: (...args: unknown[]) => ['treeEntities-list', ...args],
        entityTypesList: (...args: unknown[]) => ['entity-types-list', ...args],
        childTreeEntities: (...args: unknown[]) => ['child-treeEntities', ...args],
        treeEntities: (...args: unknown[]) => ['treeEntities', ...args],
        treeEntityDetail: (...args: unknown[]) => ['hub-detail', ...args]
    },
    invalidateTreeEntitiesQueries: {
        all: vi.fn()
    }
}))

vi.mock('../../../../../types', () => ({
    getVLCString: (value: LocalizedValue | null | undefined, locale = 'en') =>
        value?.locales?.[locale]?.content ?? value?.locales?.en?.content ?? '',
    toTreeEntityDisplay: <THub,>(hub: THub) => hub
}))

vi.mock('@universo/utils', () => ({
    isOptimisticLockConflict: () => false,
    extractConflictInfo: () => null,
    isPendingEntity: () => false,
    getPendingAction: () => null
}))

vi.mock('../../../../../utils/codename', () => ({
    sanitizeCodenameForStyle: (value: string) => value,
    normalizeCodenameForStyle: (value: string) => value,
    isValidCodenameForStyle: () => true
}))

vi.mock('../../../../settings/hooks/useCodenameConfig', () => ({
    useCodenameConfig: () => ({
        style: 'kebab',
        alphabet: 'latin',
        allowMixed: false
    })
}))

vi.mock('../../../../../utils/localizedInput', () => ({
    extractLocalizedInput: () => null,
    hasPrimaryContent: () => true,
    normalizeLocale: (value: string) => value
}))

vi.mock('../../../../../components', () => ({
    CodenameField: () => null,
    TreeDeleteDialog: () => null,
    ExistingCodenamesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ContainerParentSelectionPanel: () => null
}))

vi.mock('../TreeEntityActions', () => ({
    __esModule: true,
    default: [],
    buildInitialValues: () => ({}),
    buildFormTabs: () => [],
    validateTreeEntityForm: () => null,
    canSaveTreeEntityForm: () => true,
    toPayload: (value: unknown) => value
}))

vi.mock('../../../../settings/hooks/useEntityPermissions', () => ({
    useEntityPermissions: () => ({
        allowCopy: true,
        allowDelete: true,
        allowAttachExistingEntities: true,
        allowHubNesting: true
    })
}))

vi.mock('../../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../../api/trees', () => ({
    listTreeEntities: vi.fn(),
    listChildTreeEntities: vi.fn()
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock
    }
})

import TreeEntityList from '../TreeEntityList'

describe('TreeEntityList settings reopen flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reopens the hub settings dialog from one-shot location state and clears the state afterwards', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/metahub/metahub-1/entities/hub/instance/hub-1/instances',
                        state: { openHubSettings: true }
                    }
                ]}
            >
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instances' element={<TreeEntityList />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByRole('dialog', { name: 'Edit TreeEntity' })).toBeInTheDocument()
        })

        expect(navigateMock).toHaveBeenCalledWith('/metahub/metahub-1/entities/hub/instance/hub-1/instances', {
            replace: true,
            state: null
        })
    })
})
