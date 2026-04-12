import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
    usePublicationApplications: vi.fn(),
    mutate: vi.fn(),
    navigate: vi.fn(),
    updatePublicationMutate: vi.fn()
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
        EmptyListState: ({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) => (
            <div>
                <div>{title}</div>
                {action ? (
                    <button type='button' onClick={action.onClick}>
                        {action.label}
                    </button>
                ) : null}
            </div>
        ),
        APIEmptySVG: 'api-empty',
        FlowListTable: ({
            data,
            renderActions
        }: {
            data: Array<Record<string, any>>
            renderActions: (row: Record<string, any>) => ReactNode
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
        LocalizedInlineField: ({
            label,
            onChange
        }: {
            label: string
            onChange: (next: { _schema: 'v1'; _primary: 'en'; locales: { en: { content: string } } }) => void
        }) => (
            <button
                type='button'
                onClick={() =>
                    onChange({
                        _schema: 'v1',
                        _primary: 'en',
                        locales: {
                            en: {
                                content: label.toLowerCase().includes('name') ? 'App From Publication' : 'Generated from publication'
                            }
                        }
                    })
                }
            >
                Fill {label}
            </button>
        ),
        useDebouncedSearch: () => ({
            handleSearchChange: () => undefined
        }),
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

vi.mock('../../hooks/usePublicationApplications', () => ({
    usePublicationApplications: mocks.usePublicationApplications
}))

vi.mock('../../hooks/applicationMutations', () => ({
    useCreatePublicationApplication: () => ({
        mutate: mocks.mutate,
        isPending: false
    })
}))

vi.mock('../../hooks/usePublicationDetails', () => ({
    usePublicationDetails: () => ({
        data: {
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
    })
}))

vi.mock('../../hooks/mutations', () => ({
    useUpdatePublication: () => ({
        mutate: mocks.updatePublicationMutate,
        isPending: false
    })
}))

vi.mock('../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
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

vi.mock('@universo/template-mui/components/dialogs', () => ({
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
    }),
    resolveDialogMaxWidth: (maxWidth: unknown, fallback: unknown) => maxWidth ?? fallback,
    mergeDialogPaperProps: (_base: unknown, next: unknown) => next,
    mergeDialogSx: (base: unknown) => base,
    EntityFormDialog: ({ open, title }: { open?: boolean; title?: string }) =>
        open ? <div data-testid='publication-settings-dialog'>{title}</div> : null
}))

import { PublicationApplicationList } from '../PublicationApplicationList'

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/metahub/metahub-1/publication/publication-1/applications']}>
            <Routes>
                <Route path='/metahub/:metahubId/publication/:publicationId/applications' element={<PublicationApplicationList />} />
            </Routes>
        </MemoryRouter>
    )

describe('PublicationApplicationList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.usePublicationApplications.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'app-1',
                        slug: 'shopping-list',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Shopping List' } }
                        },
                        description: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Shopping list runtime app' } }
                        },
                        createdAt: '2026-03-12T08:00:00.000Z'
                    }
                ]
            },
            isLoading: false,
            error: null
        })
    })

    it('creates an application from the publication with schema creation enabled', async () => {
        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole('button', { name: 'create' }))
        await user.click(screen.getByRole('button', { name: 'Fill table.name' }))
        await user.click(screen.getByRole('radio', { name: 'Public' }))
        await user.click(screen.getByRole('checkbox', { name: 'Add workspaces' }))
        await user.click(screen.getByRole('switch', { name: 'Create application schema' }))
        await user.click(screen.getAllByRole('button', { name: 'create' }).at(-1)!)

        await waitFor(() => {
            expect(mocks.mutate).toHaveBeenCalledWith(
                {
                    metahubId: 'metahub-1',
                    publicationId: 'publication-1',
                    data: {
                        name: { en: 'App From Publication' },
                        description: undefined,
                        namePrimaryLocale: 'en',
                        descriptionPrimaryLocale: undefined,
                        createApplicationSchema: true,
                        isPublic: true,
                        workspacesEnabled: false
                    }
                },
                expect.objectContaining({
                    onSuccess: expect.any(Function)
                })
            )
        })
    })

    it('opens runtime and admin links for the linked application', async () => {
        const user = userEvent.setup()
        const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

        renderPage()

        await user.click(screen.getByRole('button', { name: '' }))
        await user.click(screen.getByRole('menuitem', { name: 'Open application' }))
        expect(windowOpenSpy).toHaveBeenCalledWith('/a/app-1', '_blank', 'noopener,noreferrer')

        await user.click(screen.getByRole('button', { name: '' }))
        await user.click(screen.getByRole('menuitem', { name: 'Application dashboard' }))
        expect(windowOpenSpy).toHaveBeenCalledWith('/a/app-1/admin', '_blank', 'noopener,noreferrer')

        windowOpenSpy.mockRestore()
    })

    it('keeps the publication settings tab accessible from the applications subview', async () => {
        const user = userEvent.setup()

        renderPage()

        await user.click(screen.getByRole('tab', { name: 'Settings' }))

        expect(screen.getByTestId('publication-settings-dialog')).toHaveTextContent('Edit Publication')
    })
})
