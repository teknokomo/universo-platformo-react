import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import RuntimeWorkspacesPage from '../RuntimeWorkspacesPage'
import ruApps from '../../i18n/locales/ru/apps.json'

const visibleAnchorRect = {
    x: 10,
    y: 10,
    top: 10,
    left: 10,
    bottom: 50,
    right: 210,
    width: 200,
    height: 40,
    toJSON: () => visibleAnchorRect
} satisfies DOMRect

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => visibleAnchorRect
})

const apiMocks = vi.hoisted(() => ({
    fetchRuntimeWorkspaces: vi.fn(),
    fetchRuntimeWorkspace: vi.fn(),
    fetchRuntimeWorkspaceMembers: vi.fn(),
    inviteRuntimeWorkspaceMember: vi.fn(),
    createRuntimeWorkspace: vi.fn(),
    updateRuntimeWorkspace: vi.fn(),
    copyRuntimeWorkspace: vi.fn(),
    deleteRuntimeWorkspace: vi.fn(),
    removeRuntimeWorkspaceMember: vi.fn(),
    updateDefaultRuntimeWorkspace: vi.fn()
}))

const i18nState = vi.hoisted(() => ({
    language: 'en',
    translations: {
        ru: {
            'workspace.errors.userNotFound': 'Пользователь не найден'
        }
    } as Record<string, string>
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: i18nState.language },
        t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
            const language = i18nState.language.split(/[-_]/)[0]?.toLowerCase() || 'en'
            if (language === 'ru' && i18nState.translations.ru[_key]) {
                return i18nState.translations.ru[_key]
            }
            return typeof fallbackOrOptions === 'string'
                ? fallbackOrOptions
                : typeof fallbackOrOptions?.defaultValue === 'string'
                ? fallbackOrOptions.defaultValue
                : _key
        }
    })
}))

vi.mock('@universo/template-mui', () => ({
    ViewHeaderMUI: ({
        title,
        children,
        searchValue,
        searchPlaceholder,
        onSearchChange
    }: {
        title: ReactNode
        children?: ReactNode
        searchValue?: string
        searchPlaceholder?: string
        onSearchChange?: (event: { target: { value: string } }) => void
    }) => (
        <section>
            <h1>{title}</h1>
            <input
                aria-label={searchPlaceholder ?? 'search'}
                value={searchValue ?? ''}
                onChange={(event) => onSearchChange?.({ target: { value: event.target.value } })}
            />
            {children}
        </section>
    ),
    ToolbarControls: ({
        primaryAction,
        viewToggleEnabled,
        viewMode,
        onViewModeChange,
        cardViewTitle,
        listViewTitle
    }: {
        primaryAction?: { label: string; onClick: () => void; disabled?: boolean; startIcon?: ReactNode }
        viewToggleEnabled?: boolean
        viewMode?: 'card' | 'list'
        onViewModeChange?: (mode: 'card' | 'list') => void
        cardViewTitle?: string
        listViewTitle?: string
    }) => (
        <div>
            {viewToggleEnabled ? (
                <>
                    <button
                        type='button'
                        title={cardViewTitle ?? 'Card view'}
                        aria-pressed={viewMode === 'card'}
                        onClick={() => onViewModeChange?.('card')}
                    >
                        Card view
                    </button>
                    <button
                        type='button'
                        title={listViewTitle ?? 'Table view'}
                        aria-pressed={viewMode === 'list'}
                        onClick={() => onViewModeChange?.('list')}
                    >
                        Table view
                    </button>
                </>
            ) : null}
            {primaryAction ? (
                <button onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                    {primaryAction.label}
                </button>
            ) : null}
        </div>
    ),
    ItemCard: ({
        data,
        onClick,
        footerStartContent,
        footerEndContent,
        headerAction,
        titleEndContent
    }: {
        data: { id: string; name?: string; displayName?: string; description?: string }
        onClick?: () => void
        footerStartContent?: ReactNode
        footerEndContent?: ReactNode
        headerAction?: ReactNode
        titleEndContent?: ReactNode
    }) => (
        <article>
            {headerAction}
            <button type='button' onClick={onClick}>
                {data.displayName ?? data.name ?? data.id}
            </button>
            {titleEndContent}
            <span>{data.description}</span>
            {footerStartContent}
            {footerEndContent}
        </article>
    ),
    FlowListTable: ({
        data,
        renderActions
    }: {
        data: Array<{ id: string; name?: string; displayName?: string; description?: string; email?: string | null }>
        renderActions?: (row: { id: string; name?: string; displayName?: string; description?: string; email?: string | null }) => ReactNode
    }) => (
        <table>
            <tbody>
                {data.map((row) => (
                    <tr key={row.id}>
                        <td>{row.displayName ?? row.name ?? row.id}</td>
                        <td>{row.description ?? row.email}</td>
                        <td>{renderActions?.(row)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    ),
    PaginationControls: ({ pagination }: { pagination: { totalItems: number } }) => (
        <div aria-label='pagination-total'>{pagination.totalItems}</div>
    )
}))

const vlc = (content: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString()
        }
    }
})

vi.mock('../../components/dialogs/FormDialog', () => ({
    FormDialog: (props: {
        open: boolean
        title: string
        fields: Array<{ id: string; label: string }>
        initialData?: Record<string, unknown>
        error?: string | null
        saveButtonText?: string
        onSubmit: (data: Record<string, unknown>) => Promise<void>
    }) => {
        const readInitialValue = (value: unknown): string => {
            if (typeof value === 'string') return value
            if (!value || typeof value !== 'object') return ''
            const entry = ((value as { locales?: Record<string, { content?: unknown }> }).locales ?? {}).en
            return typeof entry?.content === 'string' ? entry.content : ''
        }

        return props.open ? (
            <div role='dialog'>
                <p>{props.title}</p>
                {props.error ? <p role='alert'>{props.error}</p> : null}
                {props.fields.map((field) => (
                    <label key={field.id}>
                        {field.label}
                        <input aria-label={field.label} defaultValue={readInitialValue(props.initialData?.[field.id])} />
                    </label>
                ))}
                <button
                    onClick={() => {
                        const values = Object.fromEntries(
                            props.fields.map((field) => [
                                field.id,
                                (document.querySelector(`input[aria-label="${field.label}"]`) as HTMLInputElement | null)?.value ?? ''
                            ])
                        )
                        void props.onSubmit(values)
                    }}
                >
                    {props.saveButtonText ?? 'Save'}
                </button>
            </div>
        ) : null
    }
}))

vi.mock('../../components/dialogs/ConfirmDeleteDialog', () => ({
    ConfirmDeleteDialog: ({
        open,
        title,
        error,
        onConfirm
    }: {
        open: boolean
        title: string
        error?: string
        onConfirm: () => Promise<void> | void
    }) =>
        open ? (
            <div role='dialog'>
                <p>{title}</p>
                {error ? <p role='alert'>{error}</p> : null}
                <button onClick={() => void Promise.resolve(onConfirm()).catch(() => undefined)}>Confirm remove</button>
            </div>
        ) : null
}))

vi.mock('../../api/workspaces', () => ({
    fetchRuntimeWorkspaces: (...args: unknown[]) => apiMocks.fetchRuntimeWorkspaces(...args),
    fetchRuntimeWorkspace: (...args: unknown[]) => apiMocks.fetchRuntimeWorkspace(...args),
    fetchRuntimeWorkspaceMembers: (...args: unknown[]) => apiMocks.fetchRuntimeWorkspaceMembers(...args),
    inviteRuntimeWorkspaceMember: (...args: unknown[]) => apiMocks.inviteRuntimeWorkspaceMember(...args),
    createRuntimeWorkspace: (...args: unknown[]) => apiMocks.createRuntimeWorkspace(...args),
    updateRuntimeWorkspace: (...args: unknown[]) => apiMocks.updateRuntimeWorkspace(...args),
    copyRuntimeWorkspace: (...args: unknown[]) => apiMocks.copyRuntimeWorkspace(...args),
    deleteRuntimeWorkspace: (...args: unknown[]) => apiMocks.deleteRuntimeWorkspace(...args),
    removeRuntimeWorkspaceMember: (...args: unknown[]) => apiMocks.removeRuntimeWorkspaceMember(...args),
    updateDefaultRuntimeWorkspace: (...args: unknown[]) => apiMocks.updateDefaultRuntimeWorkspace(...args)
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const renderPage = (props: Partial<Parameters<typeof RuntimeWorkspacesPage>[0]> = {}) =>
    render(
        <QueryClientProvider client={createQueryClient()}>
            <RuntimeWorkspacesPage applicationId='app-1' apiBaseUrl='/api/v1' locale='en' {...props} />
        </QueryClientProvider>
    )

describe('RuntimeWorkspacesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18nState.language = 'en'
        apiMocks.fetchRuntimeWorkspaces.mockResolvedValue({
            items: [
                {
                    id: 'ws-personal',
                    name: vlc('Personal'),
                    description: vlc('Personal workspace'),
                    workspaceType: 'personal',
                    personalUserId: 'user-1',
                    status: 'active',
                    isDefault: true,
                    roleCodename: 'owner'
                },
                {
                    id: 'ws-shared',
                    name: vlc('Class A'),
                    description: vlc('Shared class workspace'),
                    workspaceType: 'shared',
                    personalUserId: null,
                    status: 'active',
                    isDefault: false,
                    roleCodename: 'owner'
                }
            ],
            total: 2,
            limit: 20,
            offset: 0,
            currentWorkspaceId: 'ws-personal'
        })
        apiMocks.fetchRuntimeWorkspace.mockImplementation(async ({ workspaceId }: { workspaceId: string }) => {
            if (workspaceId === 'ws-shared') {
                return {
                    id: 'ws-shared',
                    name: vlc('Class A'),
                    description: vlc('Shared class workspace'),
                    workspaceType: 'shared',
                    personalUserId: null,
                    status: 'active',
                    isDefault: false,
                    roleCodename: 'owner'
                }
            }
            return {
                id: workspaceId,
                name: vlc(workspaceId),
                description: vlc('Hidden workspace'),
                workspaceType: 'shared',
                personalUserId: null,
                status: 'active',
                isDefault: false,
                roleCodename: 'member'
            }
        })
        apiMocks.fetchRuntimeWorkspaceMembers.mockImplementation(async ({ workspaceId }: { workspaceId: string }) => ({
            items:
                workspaceId === 'ws-shared'
                    ? [
                          {
                              userId: 'user-1',
                              roleCodename: 'owner',
                              email: 'owner@example.com',
                              nickname: 'Owner',
                              canRemove: false
                          },
                          {
                              userId: 'user-2',
                              roleCodename: 'member',
                              email: 'member@example.com',
                              nickname: 'Member',
                              canRemove: true
                          }
                      ]
                    : [
                          {
                              userId: 'user-1',
                              roleCodename: 'owner',
                              email: 'owner@example.com',
                              nickname: 'Owner',
                              canRemove: false
                          }
                      ],
            total: workspaceId === 'ws-shared' ? 2 : 1,
            limit: 20,
            offset: 0
        }))
        apiMocks.inviteRuntimeWorkspaceMember.mockResolvedValue(undefined)
        apiMocks.createRuntimeWorkspace.mockResolvedValue({ id: 'ws-created' })
        apiMocks.updateRuntimeWorkspace.mockResolvedValue(undefined)
        apiMocks.copyRuntimeWorkspace.mockResolvedValue({ id: 'ws-copy' })
        apiMocks.deleteRuntimeWorkspace.mockResolvedValue(undefined)
        apiMocks.updateDefaultRuntimeWorkspace.mockResolvedValue(undefined)
    })

    it('renders workspace cards without showing access management on the list route', async () => {
        renderPage()

        expect(await screen.findByRole('heading', { name: 'Workspaces' })).toBeInTheDocument()
        expect(await screen.findByRole('button', { name: 'Class A' })).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Workspace actions' })).toHaveLength(2)
        expect(screen.getByLabelText('Default')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Set default' })).not.toBeInTheDocument()
        expect(screen.getByTestId('runtime-workspaces-card-view')).toBeInTheDocument()
        expect(screen.queryByText('owner@example.com')).not.toBeInTheDocument()
        expect(apiMocks.fetchRuntimeWorkspaceMembers).not.toHaveBeenCalled()
    })

    it('creates a workspace with localized name and description', async () => {
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Create' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Workspace name'), { target: { value: 'New space' } })
        fireEvent.change(within(dialog).getByLabelText('Workspace description'), { target: { value: 'New description' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            expect(apiMocks.createRuntimeWorkspace).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                name: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'New space' })
                    })
                }),
                description: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'New description' })
                    })
                })
            })
        })
    })

    it('opens workspace actions and supports edit, copy, and delete flows', async () => {
        renderPage()
        await screen.findByRole('button', { name: 'Class A' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[1])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Set default' }))
        await waitFor(() => {
            expect(apiMocks.updateDefaultRuntimeWorkspace).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-shared'
            })
        })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[1])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
        let dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Workspace name'), { target: { value: 'Class B' } })
        fireEvent.change(within(dialog).getByLabelText('Workspace description'), { target: { value: 'Edited description' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
        await waitFor(() => {
            expect(apiMocks.updateRuntimeWorkspace).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-shared',
                name: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'Class B' })
                    })
                }),
                description: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'Edited description' })
                    })
                })
            })
        })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[1])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy' }))
        dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }))
        await waitFor(() => {
            expect(apiMocks.copyRuntimeWorkspace).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-shared',
                name: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'Class A (copy)' })
                    })
                }),
                description: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'Shared class workspace' })
                    })
                })
            })
        })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[1])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
        dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm remove' }))
        await waitFor(() => {
            expect(apiMocks.deleteRuntimeWorkspace).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-shared'
            })
        })
    })

    it('renders the selected workspace dashboard on the workspace detail route', async () => {
        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'dashboard' })

        expect(await screen.findByRole('heading', { name: 'Class A' })).toBeInTheDocument()
        await waitFor(() => {
            expect(apiMocks.fetchRuntimeWorkspaceMembers).toHaveBeenLastCalledWith(
                expect.objectContaining({ applicationId: 'app-1', workspaceId: 'ws-shared' })
            )
        })
        expect(screen.getByText('Shared')).toBeInTheDocument()
        expect(screen.getByText('Owner')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    })

    it('renders a route workspace detail even when the workspace is not in the current list page', async () => {
        apiMocks.fetchRuntimeWorkspaces.mockResolvedValueOnce({
            items: [
                {
                    id: 'ws-personal',
                    name: vlc('Personal'),
                    description: vlc('Personal workspace'),
                    workspaceType: 'personal',
                    personalUserId: 'user-1',
                    status: 'active',
                    isDefault: true,
                    roleCodename: 'owner'
                }
            ],
            total: 25,
            limit: 20,
            offset: 0,
            currentWorkspaceId: 'ws-personal'
        })
        apiMocks.fetchRuntimeWorkspace.mockResolvedValueOnce({
            id: 'ws-hidden',
            name: vlc('Hidden Class'),
            description: vlc('Hidden description'),
            workspaceType: 'shared',
            personalUserId: null,
            status: 'active',
            isDefault: false,
            roleCodename: 'member'
        })
        apiMocks.fetchRuntimeWorkspaceMembers.mockResolvedValueOnce({
            items: [],
            total: 0,
            limit: 20,
            offset: 0
        })

        renderPage({ routeWorkspaceId: 'ws-hidden', routeSection: 'dashboard' })

        expect(await screen.findByRole('heading', { name: 'Hidden Class' })).toBeInTheDocument()
        expect(apiMocks.fetchRuntimeWorkspace).toHaveBeenCalledWith(
            expect.objectContaining({
                applicationId: 'app-1',
                workspaceId: 'ws-hidden'
            })
        )
        expect(screen.getByText('Member')).toBeInTheDocument()
    })

    it('renders workspace access and invites a member through the isolated runtime UI', async () => {
        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'access' })

        expect(await screen.findByText('owner@example.com')).toBeInTheDocument()
        expect(screen.getByText('member@example.com')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-workspace-members-card-view')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: '  invited@example.com  ' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

        await waitFor(() => {
            expect(apiMocks.inviteRuntimeWorkspaceMember).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-shared',
                email: 'invited@example.com',
                roleCodename: 'member'
            })
        })
    })

    it('localizes known backend workspace errors in Russian runtime UI', async () => {
        i18nState.language = 'ru'
        apiMocks.inviteRuntimeWorkspaceMember.mockRejectedValueOnce(
            Object.assign(new Error('Backend text changed'), { code: 'USER_NOT_FOUND' })
        )

        renderPage({ locale: 'ru', routeWorkspaceId: 'ws-shared', routeSection: 'access' })

        expect(await screen.findByText('owner@example.com')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'missing@example.com' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Пользователь не найден')
        expect(within(dialog).queryByText('User not found')).not.toBeInTheDocument()
    })

    it('uses host SPA navigation callback for workspace detail navigation', async () => {
        const onNavigate = vi.fn()
        renderPage({ onNavigate })

        const [personalWorkspaceCard] = await screen.findAllByTestId('runtime-workspace-card')
        fireEvent.click(within(personalWorkspaceCard).getByText('Personal'))

        expect(onNavigate).toHaveBeenCalledWith('/a/app-1/workspaces/ws-personal')
    })

    it('switches workspace members between card and list views', async () => {
        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'access' })
        expect(await screen.findByText('member@example.com')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-workspace-members-card-view')).toBeInTheDocument()

        fireEvent.click(screen.getByTitle('Member list view'))

        expect(screen.queryByTestId('runtime-workspace-members-card-view')).not.toBeInTheDocument()
        expect(screen.getByText('member@example.com')).toBeInTheDocument()

        fireEvent.click(screen.getByTitle('Member card view'))

        expect(screen.getByTestId('runtime-workspace-members-card-view')).toBeInTheDocument()
    })

    it('does not render remove actions for the last owner and removes eligible members', async () => {
        apiMocks.removeRuntimeWorkspaceMember.mockResolvedValue(undefined)

        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'access' })
        await screen.findByText('member@example.com')

        expect(screen.getAllByRole('button', { name: 'Remove member' })).toHaveLength(1)
        fireEvent.click(screen.getByRole('button', { name: 'Remove member' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm remove' }))

        await waitFor(() => {
            expect(apiMocks.removeRuntimeWorkspaceMember).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-shared',
                userId: 'user-2'
            })
        })

        cleanup()
        renderPage({ routeWorkspaceId: 'ws-personal', routeSection: 'access' })
        await screen.findByText('owner@example.com')
        expect(screen.queryByRole('button', { name: 'Remove member' })).not.toBeInTheDocument()
    })

    it('ships the Russian runtime workspace title used by published applications', () => {
        expect(ruApps.workspace.title).toBe('Рабочие пространства')
        expect(ruApps.workspace.errors.userNotFound).toBe('Пользователь не найден')
        expect(ruApps.workspace.errors.lastOwnerRemovalBlocked).toBe('Нельзя удалить последнего владельца рабочего пространства')
    })
})
