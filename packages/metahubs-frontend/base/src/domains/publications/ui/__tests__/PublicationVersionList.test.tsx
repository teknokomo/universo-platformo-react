import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
    usePublicationVersionListData: vi.fn(),
    usePublicationDetails: vi.fn(),
    updatePublicationMutate: vi.fn(),
    navigate: vi.fn()
}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, fallback?: string) => {
                if (fallback) return fallback
                if (key === 'settings.title') return 'Settings'
                return key
            },
            i18n: { language: 'en' }
        })
    }
})

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mocks.navigate
    }
})

vi.mock('@universo/template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo/template-mui')>()
    return {
        TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        ToolbarControls: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void } }) =>
            primaryAction ? (
                <button type='button' onClick={primaryAction.onClick}>
                    {primaryAction.label}
                </button>
            ) : null,
        EmptyListState: ({ title, description, action }: { title: string; description?: string; action?: { label: string; onClick: () => void } }) => (
            <div>
                <div>{title}</div>
                {description ? <div>{description}</div> : null}
                {action ? (
                    <button type='button' onClick={action.onClick}>
                        {action.label}
                    </button>
                ) : null}
            </div>
        ),
        APIEmptySVG: 'api-empty',
        FlowListTable: ({ data }: { data: Array<Record<string, any>> }) => (
            <div>
                {data.map((row) => (
                    <div key={row.id}>{row.name}</div>
                ))}
            </div>
        ),
        LocalizedInlineField: () => null,
        PaginationControls: () => null,
        ViewHeaderMUI: ({ title, children }: { title: string; children?: ReactNode }) => (
            <div>
                <h1>{title}</h1>
                {children}
            </div>
        ),
        useListDialogs: actual.useListDialogs
    }
})

vi.mock('@universo/template-mui/components/dialogs', () => ({
    EntityFormDialog: ({ open, title }: { open?: boolean; title?: string }) =>
        open ? <div data-testid='publication-settings-dialog'>{title}</div> : null,
    mergeDialogPaperProps: (_base: unknown, next: unknown) => next,
    mergeDialogSx: (base: unknown) => base,
    resolveDialogMaxWidth: (maxWidth: unknown, fallback: unknown) => maxWidth ?? fallback,
    useDialogPresentation: ({ onClose }: { onClose?: () => void }) => ({
        dialogProps: {
            onClose,
            maxWidth: 'sm',
            fullWidth: true,
            disableEscapeKeyDown: false,
            PaperProps: undefined
        },
        titleActions: null,
        contentSx: undefined,
        resizeHandle: null
    })
}))

vi.mock('../../hooks/usePublicationVersionListData', () => ({
    usePublicationVersionListData: mocks.usePublicationVersionListData
}))

vi.mock('../../hooks/usePublicationDetails', () => ({
    usePublicationDetails: mocks.usePublicationDetails
}))

vi.mock('../../hooks/mutations', () => ({
    useUpdatePublication: () => ({
        mutate: mocks.updatePublicationMutate,
        isPending: false
    })
}))

vi.mock('../../hooks/versionMutations', () => ({
    useCreatePublicationVersion: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdatePublicationVersion: () => ({ mutate: vi.fn(), isPending: false }),
    useActivatePublicationVersion: () => ({ mutate: vi.fn(), isPending: false }),
    useDeletePublicationVersion: () => ({ mutate: vi.fn(), isPending: false }),
    useImportSnapshotVersion: () => ({ mutate: vi.fn(), isPending: false, error: null })
}))

vi.mock('../../api', () => ({
    exportPublicationVersion: vi.fn(async () => undefined)
}))

vi.mock('../PublicationActions', () => ({
    buildInitialValues: vi.fn(() => ({})),
    buildFormTabs: vi.fn(() => []),
    validatePublicationForm: vi.fn(() => ({})),
    canSavePublicationForm: vi.fn(() => true),
    toPayload: vi.fn((data: Record<string, unknown>) => data)
}))

vi.mock('../publicationSettingsQueries', () => ({
    invalidatePublicationSettingsQueries: vi.fn(async () => undefined)
}))

vi.mock('../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../ImportSnapshotDialog', () => ({
    ImportSnapshotDialog: () => null
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    return {
        ...actual,
        useQueryClient: () => ({
            invalidateQueries: vi.fn(),
            setQueryData: vi.fn(),
            setQueriesData: vi.fn()
        })
    }
})

import { PublicationVersionList } from '../PublicationVersionList'

const baseVersionData = {
    metahubId: 'metahub-1',
    publicationId: 'publication-1',
    rawVersions: [
        {
            id: 'version-1',
            name: {
                _schema: 'v1',
                _primary: 'en',
                locales: { en: { content: 'Version One' } }
            },
            description: null,
            branchId: 'branch-main',
            version: 1
        }
    ],
    versions: [
        {
            id: 'version-1',
            name: 'Version One',
            versionNumber: 1,
            createdAt: '2026-04-06T12:00:00.000Z',
            isActive: true
        }
    ],
    isLoading: false,
    error: null,
    branches: [{ id: 'branch-main' }],
    defaultBranchId: 'branch-main',
    getBranchLabel: () => 'Main',
    searchValue: '',
    handleSearchChange: vi.fn(),
    filteredVersions: [
        {
            id: 'version-1',
            name: 'Version One',
            versionNumber: 1,
            createdAt: '2026-04-06T12:00:00.000Z',
            isActive: true
        }
    ],
    paginatedVersions: [
        {
            id: 'version-1',
            name: 'Version One',
            versionNumber: 1,
            createdAt: '2026-04-06T12:00:00.000Z',
            isActive: true
        }
    ],
    paginationState: {
        page: 0,
        rowsPerPage: 10,
        totalCount: 1
    },
    paginationActions: {
        setPage: vi.fn(),
        setRowsPerPage: vi.fn()
    }
}

const publicationDetails = {
    id: 'publication-1',
    version: 7,
    accessMode: 'full',
    name: {
        _schema: 'v1',
        _primary: 'en',
        locales: { en: { content: 'Publication One' } }
    },
    description: {
        _schema: 'v1',
        _primary: 'en',
        locales: { en: { content: 'Publication description' } }
    }
}

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/metahub/metahub-1/publication/publication-1/versions']}>
            <Routes>
                <Route path='/metahub/:metahubId/publication/:publicationId/versions' element={<PublicationVersionList />} />
            </Routes>
        </MemoryRouter>
    )

describe('PublicationVersionList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.usePublicationVersionListData.mockReturnValue(baseVersionData)
        mocks.usePublicationDetails.mockReturnValue({ data: publicationDetails })
    })

    it('renders versions while publication details are still loading', () => {
        mocks.usePublicationDetails.mockReturnValue({ data: undefined })

        renderPage()

        expect(screen.getByRole('heading', { name: 'Versions' })).toBeInTheDocument()
        expect(screen.getByText('Version One')).toBeInTheDocument()
        expect(screen.queryByTestId('publication-settings-dialog')).not.toBeInTheDocument()
    })

    it('opens the settings dialog once publication details are available', async () => {
        const user = userEvent.setup()

        renderPage()

        await user.click(screen.getByRole('tab', { name: 'Settings' }))

        expect(screen.getByTestId('publication-settings-dialog')).toHaveTextContent('Edit Publication')
    })
})