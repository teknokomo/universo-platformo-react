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
                content: 'Hub One',
                version: 1,
                isActive: true,
                createdAt: '2026-03-13T00:00:00.000Z',
                updatedAt: '2026-03-13T00:00:00.000Z'
            }
        }
    },
    description: null,
    sortOrder: 0,
    parentHubId: null
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
    useQuery: () => ({
        data: { items: [currentHub] }
    })
}))

vi.mock('@universo/template-mui', () => ({
    TemplateMainCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ItemCard: () => null,
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
    useCodenameAutoFill: () => undefined,
    useCodenameVlcSync: () => undefined,
    EntitySelectionPanel: () => null,
    revealPendingEntityFeedback: vi.fn(),
    ViewHeaderMUI: () => null,
    BaseEntityMenu: () => null
}))

vi.mock('@universo/template-mui/components/dialogs', () => ({
    EntityFormDialog: ({ open, title }: { open: boolean; title: string }) => (open ? <div role='dialog' aria-label={title} /> : null),
    ConflictResolutionDialog: () => null
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateHub: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useUpdateHub: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useDeleteHub: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useCopyHub: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useReorderHub: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../../../../hooks/useViewPreference', () => ({
    useViewPreference: () => ['table', vi.fn()]
}))

vi.mock('../../../shared', () => ({
    fetchAllPaginatedItems: vi.fn(),
    metahubsQueryKeys: {
        childHubsList: (...args: unknown[]) => ['child-hubs-list', ...args],
        hubsList: (...args: unknown[]) => ['hubs-list', ...args],
        childHubs: (...args: unknown[]) => ['child-hubs', ...args],
        hubs: (...args: unknown[]) => ['hubs', ...args],
        hubDetail: (...args: unknown[]) => ['hub-detail', ...args]
    },
    invalidateHubsQueries: {
        all: vi.fn()
    }
}))

vi.mock('../../../../types', () => ({
    getVLCString: (value: LocalizedValue | null | undefined, locale = 'en') =>
        value?.locales?.[locale]?.content ?? value?.locales?.en?.content ?? '',
    toHubDisplay: <THub,>(hub: THub) => hub
}))

vi.mock('@universo/utils', () => ({
    isOptimisticLockConflict: () => false,
    extractConflictInfo: () => null,
    isPendingEntity: () => false,
    getPendingAction: () => null
}))

vi.mock('../../../../utils/codename', () => ({
    sanitizeCodenameForStyle: (value: string) => value,
    normalizeCodenameForStyle: (value: string) => value,
    isValidCodenameForStyle: () => true
}))

vi.mock('../../../settings/hooks/useCodenameConfig', () => ({
    useCodenameConfig: () => ({
        style: 'kebab',
        alphabet: 'latin',
        allowMixed: false
    })
}))

vi.mock('../../../../utils/localizedInput', () => ({
    extractLocalizedInput: () => null,
    hasPrimaryContent: () => true,
    normalizeLocale: (value: string) => value
}))

vi.mock('../../../../components', () => ({
    CodenameField: () => null,
    HubDeleteDialog: () => null,
    ExistingCodenamesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HubParentSelectionPanel: () => null
}))

vi.mock('../HubActions', () => ({
    __esModule: true,
    default: [],
    buildInitialValues: () => ({}),
    buildFormTabs: () => [],
    validateHubForm: () => null,
    canSaveHubForm: () => true,
    toPayload: (value: unknown) => value
}))

vi.mock('../../../settings/hooks/useEntityPermissions', () => ({
    useEntityPermissions: () => ({
        allowCopy: true,
        allowDelete: true,
        allowAttachExistingEntities: true,
        allowHubNesting: true
    })
}))

vi.mock('../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../../api', () => ({
    listHubs: vi.fn(),
    listChildHubs: vi.fn()
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock
    }
})

import HubList from '../HubList'

describe('HubList settings reopen flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reopens the hub settings dialog from one-shot location state and clears the state afterwards', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/metahub/metahub-1/hub/hub-1/hubs',
                        state: { openHubSettings: true }
                    }
                ]}
            >
                <Routes>
                    <Route path='/metahub/:metahubId/hub/:hubId/hubs' element={<HubList />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByRole('dialog', { name: 'Edit Hub' })).toBeInTheDocument()
        })

        expect(navigateMock).toHaveBeenCalledWith('/metahub/metahub-1/hub/hub-1/hubs', { replace: true, state: null })
    })
})
