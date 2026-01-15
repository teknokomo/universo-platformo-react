import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const enqueueSnackbar = vi.fn()
const invalidateQueries = vi.fn()
const confirm = vi.fn().mockResolvedValue(true)

const inviteMutateAsync = vi.fn().mockResolvedValue(undefined)
const updateMutateAsync = vi.fn().mockResolvedValue(undefined)
const removeMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<any>('react-router-dom')
    return {
        ...actual,
        useParams: () => ({ applicationId: 'm1' })
    }
})

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        useTranslation: () => ({ i18n: { language: 'en' } })
    }
})

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({ t: (k: string, opts?: any) => (opts?.email ? `${k}:${opts.email}` : k) })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar })
}))

vi.mock('@universo/auth-frontend', async () => {
    const actual = await vi.importActual<typeof import('@universo/auth-frontend')>('@universo/auth-frontend')
    return {
        ...actual,
        useAuth: () => ({ user: { id: 'test-user-id' } })
    }
})

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<any>('@tanstack/react-query')
    return {
        ...actual,
        useQueryClient: () => ({ invalidateQueries })
    }
})

vi.mock('../ApplicationMemberActions', () => ({
    default: [{ id: 'edit' }, { id: 'remove' }]
}))

vi.mock('@universo/template-mui', () => {
    return {
        TemplateMainCard: ({ children }: any) => <div>{children}</div>,
        ItemCard: ({ data, headerAction }: any) => (
            <div>
                <div>{data?.email}</div>
                {headerAction}
            </div>
        ),
        MemberFormDialog: ({ open, onSave, title }: any) => {
            if (!open) return null
            return (
                <div role='dialog'>
                    <div>{title}</div>
                    <input aria-label='email' />
                    <button onClick={() => onSave?.({ email: 'new@b.c', role: 'member', comment: '' })}>save</button>
                </div>
            )
        },
        ConfirmDeleteDialog: ({ open, onConfirm }: any) => {
            if (!open) return null
            return (
                <div role='dialog'>
                    <button onClick={() => void onConfirm?.()}>confirm-delete</button>
                </div>
            )
        },
        ToolbarControls: ({ primaryAction, onViewModeChange }: any) => (
            <div>
                <button onClick={() => primaryAction?.onClick?.()}>{primaryAction?.label || 'invite'}</button>
                <button onClick={() => onViewModeChange?.('card')} title='Card View'>
                    Card View
                </button>
                <button onClick={() => onViewModeChange?.('list')} title='List View'>
                    List View
                </button>
            </div>
        ),
        EmptyListState: ({ imageAlt, action }: any) => (
            <div>
                <img alt={imageAlt} />
                {action ? <button onClick={action.onClick}>{action.label}</button> : null}
            </div>
        ),
        SkeletonGrid: () => <div />,
        APIEmptySVG: {},
        usePaginated: () => ({
            data: [
                { id: 'me', userId: 'test-user-id', role: 'admin', email: 'me@b.c', nickname: 'Me', createdAt: '2024-01-01T00:00:00Z' },
                { id: 'u1', userId: 'u1', role: 'member', email: 'a@b.c', nickname: 'Nick', createdAt: '2024-01-01T00:00:00Z' }
            ],
            isLoading: false,
            error: null,
            pagination: { total: 2, limit: 20, offset: 0, count: 2, hasMore: false },
            actions: { setSearch: vi.fn(), goToPage: vi.fn() }
        }),
        useDebouncedSearch: ({ onSearchChange }: any) => ({ handleSearchChange: onSearchChange }),
        PaginationControls: ({ actions }: any) => <button onClick={() => actions?.goToPage?.(1)}>paginate</button>,
        FlowListTable: ({ data }: any) => <div>{Array.isArray(data) ? data.map((m: any) => <div key={m.id}>{m.email}</div>) : null}</div>,
        gridSpacing: 2,
        ConfirmDialog: () => null,
        useConfirm: () => ({ confirm }),
        RoleChip: ({ role }: any) => <span>{role}</span>,
        BaseEntityMenu: ({ entity, createContext }: any) => {
            const ctx = createContext({ entity, t: (k: string) => k })
            return (
                <div>
                    <button
                        onClick={() => {
                            void ctx.helpers.confirm({ title: 'confirm.title', description: 'confirm.description' })
                            void ctx.api.updateEntity(entity.id, { email: entity.email, role: 'editor', comment: 'c' })
                            void ctx.helpers.refreshList()
                            ctx.helpers.enqueueSnackbar({ message: 'members.updateSuccess', options: { variant: 'success' } })
                        }}
                    >
                        edit
                    </button>
                    <button onClick={() => ctx.helpers.openDeleteDialog(entity)}>remove</button>
                </div>
            )
        },
        ViewHeaderMUI: ({ searchPlaceholder, onSearchChange, title, children }: any) => (
            <div>
                <h1>{title}</h1>
                <input placeholder={searchPlaceholder} onChange={(e) => onSearchChange?.(e.target.value)} />
                {children}
            </div>
        ),
        useViewPreference: () => ['card', vi.fn()],
        DEFAULT_VIEW_STYLE: 'card'
    }
})

vi.mock('../../hooks/mutations', () => ({
    useInviteMember: () => ({ mutateAsync: inviteMutateAsync, isPending: false }),
    useUpdateMemberRole: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
    useRemoveMember: () => ({ mutateAsync: removeMutateAsync, isPending: false })
}))

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('applicationMembersDisplayStyle', 'card')
})

describe('ApplicationMembers (coverage)', () => {
    it('executes invite/edit/remove flows and related callbacks', async () => {
        const { default: ApplicationMembers } = await import('../ApplicationMembers')

        await act(async () => {
            render(<ApplicationMembers />)
        })

        await waitFor(() => {
            expect(screen.getByText('members.inviteMember')).toBeInTheDocument()
        })

        // Search
        fireEvent.change(screen.getByPlaceholderText('members.searchPlaceholder'), { target: { value: 'nick' } })

        // Pagination controls
        fireEvent.click(screen.getByText('paginate'))

        // Invite flow
        fireEvent.click(screen.getByText('members.inviteMember'))
        fireEvent.click(screen.getByText('save'))

        await waitFor(() => {
            expect(inviteMutateAsync).toHaveBeenCalledWith({
                applicationId: 'm1',
                data: expect.objectContaining({ email: 'new@b.c', role: 'member' })
            })
        })

        // Edit flow (via mocked menu)
        fireEvent.click(screen.getByText('edit'))

        await waitFor(() => {
            expect(confirm).toHaveBeenCalled()
            expect(updateMutateAsync).toHaveBeenCalledWith({
                applicationId: 'm1',
                memberId: 'u1',
                data: expect.objectContaining({ role: 'editor', comment: 'c' })
            })
            expect(enqueueSnackbar).toHaveBeenCalledWith('members.updateSuccess', { variant: 'success' })
            expect(invalidateQueries).toHaveBeenCalled()
        })

        // Remove flow
        fireEvent.click(screen.getByText('remove'))
        fireEvent.click(screen.getByText('confirm-delete'))

        await waitFor(() => {
            expect(removeMutateAsync).toHaveBeenCalledWith({ applicationId: 'm1', memberId: 'u1' })
        })
    }, 20000)
})
