import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
    usePublicationsList: vi.fn(),
    useMetahubDetails: vi.fn(),
    createMutate: vi.fn(),
    mutateAsync: vi.fn(),
    enqueueSnackbar: vi.fn(),
    useQuery: vi.fn()
}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()
    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key,
            i18n: { language: 'en' }
        })
    }
})

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar })
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    return {
        ...actual,
        useQuery: mocks.useQuery
    }
})

vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo/template-mui')>('@universo/template-mui')
    return {
        TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        ItemCard: ({ children, headerAction }: { children?: ReactNode; headerAction?: ReactNode }) => (
            <div>
                {headerAction}
                {children}
            </div>
        ),
        ToolbarControls: ({ primaryAction }: { primaryAction?: { label: string; disabled?: boolean; onClick: () => void } }) =>
            primaryAction ? (
                <button type='button' disabled={primaryAction.disabled} onClick={primaryAction.onClick}>
                    {primaryAction.label}
                </button>
            ) : null,
        EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
        SkeletonGrid: () => <div>Loading...</div>,
        APIEmptySVG: 'api-empty',
        useDebouncedSearch: () => ({
            handleSearchChange: () => undefined
        }),
        PaginationControls: () => null,
        FlowListTable: ({
            data,
            renderActions
        }: {
            data: Array<Record<string, any>>
            renderActions: (row: Record<string, any>) => React.ReactNode
        }) => (
            <div>
                {data.map((row) => (
                    <div key={row.id}>
                        <span>{row.name}</span>
                        {renderActions(row)}
                    </div>
                ))}
            </div>
        ),
        gridSpacing: 2,
        useConfirm: () => ({
            confirm: vi.fn().mockResolvedValue(true)
        }),
        LocalizedInlineField: () => null,
        CollapsibleSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        revealPendingEntityFeedback: vi.fn(),
        createMemberActions: vi.fn(() => []),
        createEntityActions: vi.fn(() => []),
        ViewHeaderMUI: ({ title, children }: { title: string; children?: ReactNode }) => (
            <div>
                <h1>{title}</h1>
                {children}
            </div>
        ),
        BaseEntityMenu: ({
            entity,
            createContext
        }: {
            entity: { id: string }
            createContext: (baseContext: Record<string, any>) => Record<string, any>
        }) => {
            const context = createContext({
                entity,
                t: (_key: string, fallback?: string) => fallback ?? _key,
                helpers: {}
            })

            return (
                <button type='button' onClick={() => void context.api.syncEntity(entity.id, true)}>
                    Sync Publication
                </button>
            )
        },
        useListDialogs: actual.useListDialogs
    }
})

vi.mock('@universo/template-mui/components/dialogs', () => ({
    EntityFormDialog: ({
        open,
        title,
        onSave,
        saveButtonText
    }: {
        open?: boolean
        title?: string
        onSave?: (data: Record<string, any>) => void
        saveButtonText?: string
    }) =>
        open ? (
            <div data-testid='publication-entity-form-dialog'>
                <div data-testid='publication-entity-form-title'>{title}</div>
                <button
                    type='button'
                    onClick={() =>
                        onSave?.({
                            nameVlc: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Publication Acceptance' } }
                            },
                            descriptionVlc: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Created from page acceptance' } }
                            },
                            versionNameVlc: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Initial Version' } }
                            },
                            versionDescriptionVlc: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'First version payload' } }
                            },
                            versionBranchId: 'branch-1',
                            autoCreateApplication: true,
                            createApplicationSchema: true,
                            applicationNameVlc: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Generated App' } }
                            },
                            applicationDescriptionVlc: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Generated from publication flow' } }
                            },
                            applicationIsPublic: true
                        })
                    }
                >
                    {saveButtonText ?? 'Create'}
                </button>
            </div>
        ) : null,
    ConfirmDeleteDialog: () => null,
    ConflictResolutionDialog: () => null
}))

vi.mock('../../hooks/mutations', () => ({
    useCreatePublication: () => ({ mutate: mocks.createMutate, isPending: false }),
    useUpdatePublication: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useDeletePublication: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useSyncPublication: () => ({
        mutateAsync: mocks.mutateAsync,
        isPending: false
    })
}))

vi.mock('../../hooks/usePublications', () => ({
    usePublicationsList: mocks.usePublicationsList
}))

vi.mock('../../../metahubs', () => ({
    useMetahubDetails: mocks.useMetahubDetails
}))

vi.mock('../../../branches/api/branches', () => ({
    listBranchOptions: vi.fn()
}))

vi.mock('../PublicationActions', () => ({
    default: [{ id: 'sync' }]
}))

import PublicationList from '../PublicationList'

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            },
            mutations: {
                retry: false
            }
        }
    })

const renderPage = () => {
    const queryClient = createQueryClient()

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/metahub/metahub-1/publications']}>
                <Routes>
                    <Route path='/metahub/:metahubId/publications' element={<PublicationList />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('PublicationList', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mocks.usePublicationsList.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'publication-1',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Publication One' } }
                        },
                        description: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Publication description' } }
                        },
                        accessMode: 'full'
                    }
                ]
            },
            isLoading: false,
            error: null,
            refetch: vi.fn()
        })

        mocks.useMetahubDetails.mockReturnValue({
            data: {
                id: 'metahub-1',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Metahub One' } }
                }
            },
            isLoading: false
        })

        mocks.useQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'branch-1',
                        codename: 'main',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Main branch' } }
                        }
                    }
                ],
                meta: {
                    defaultBranchId: 'branch-1'
                }
            }
        })
    })

    it('submits the publication create payload from the page dialog', async () => {
        mocks.usePublicationsList.mockReturnValue({
            data: { items: [] },
            isLoading: false,
            error: null,
            refetch: vi.fn()
        })

        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole('button', { name: 'create' }))
        expect(await screen.findByTestId('publication-entity-form-dialog')).toBeInTheDocument()
        expect(screen.getByTestId('publication-entity-form-title')).toHaveTextContent('Create Publication')

        await user.click(screen.getByTestId('publication-entity-form-dialog').querySelector('button') as HTMLButtonElement)

        await waitFor(() => {
            expect(mocks.createMutate).toHaveBeenCalledWith({
                metahubId: 'metahub-1',
                data: {
                    name: { en: 'Publication Acceptance' },
                    description: { en: 'Created from page acceptance' },
                    namePrimaryLocale: 'en',
                    descriptionPrimaryLocale: 'en',
                    autoCreateApplication: true,
                    createApplicationSchema: false,
                    versionName: { en: 'Initial Version' },
                    versionDescription: { en: 'First version payload' },
                    versionNamePrimaryLocale: 'en',
                    versionDescriptionPrimaryLocale: 'en',
                    versionBranchId: 'branch-1',
                    applicationName: { en: 'Generated App' },
                    applicationDescription: { en: 'Generated from publication flow' },
                    applicationNamePrimaryLocale: 'en',
                    applicationDescriptionPrimaryLocale: 'en',
                    applicationIsPublic: true,
                    runtimePolicy: {
                        workspaceMode: 'optional',
                        requiredWorkspaceModeAcknowledged: false
                    }
                }
            })
        })
    })

    it('shows the single-publication banner and forwards destructive sync confirmation to the mutation', async () => {
        mocks.mutateAsync.mockResolvedValue({ status: 'synced' })

        const user = userEvent.setup()
        renderPage()

        expect(
            screen.getByText(
                'Currently, only one Publication per Metahub is supported. Also, after creating a Publication, it cannot be deleted separately, only together with the entire Metahub. In future versions of Universo Platformo, these restrictions will be removed.'
            )
        ).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Sync Publication' }))

        await waitFor(() => {
            expect(mocks.mutateAsync).toHaveBeenCalledWith({
                metahubId: 'metahub-1',
                publicationId: 'publication-1',
                confirmDestructive: true
            })
        })
    })

    it('disables the create action when a publication already exists', () => {
        renderPage()

        expect(screen.getByRole('button', { name: 'create' })).toBeDisabled()
    })
})
