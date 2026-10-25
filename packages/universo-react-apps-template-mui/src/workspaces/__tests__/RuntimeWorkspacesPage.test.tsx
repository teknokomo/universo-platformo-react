import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RuntimeWorkspacesPage from '../RuntimeWorkspacesPage'
import enApps from '../../i18n/locales/en/apps.json'
import { DashboardDetailsProvider } from '../../dashboard/DashboardDetailsContext'
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
    fetchRuntimeWorkspaceSettings: vi.fn(),
    inviteRuntimeWorkspaceMember: vi.fn(),
    createRuntimeWorkspace: vi.fn(),
    updateRuntimeWorkspace: vi.fn(),
    copyRuntimeWorkspace: vi.fn(),
    deleteRuntimeWorkspace: vi.fn(),
    convertRuntimeWorkspaceToShared: vi.fn(),
    removeRuntimeWorkspaceMember: vi.fn(),
    updateDefaultRuntimeWorkspace: vi.fn(),
    updateRuntimeWorkspaceSettings: vi.fn(),
    resetRuntimeWorkspaceSeededContent: vi.fn()
}))

const i18nState = vi.hoisted(() => ({
    language: 'en',
    translations: {
        en: {
            'workspace.widgetSettings.widgetTitle': '{{widget}} — {{location}} (widget {{number}})',
            'workspace.widgetSettings.widgetName': 'Interpretation Network',
            'workspace.widgetSettings.locations.center': 'Center zone',
            'workspace.widgetSettings.duplicateColor': 'This color is already in the allowed list.',
            'workspace.settingKeys.sectionLinksEnabled': 'Section-specific links',
            'workspace.settingKeys.sectionLinksEnabled.description': 'Generate a separate URL for each application menu section.',
            'workspace.settingKeys.dashboardDefaultMode': 'Runtime start dashboard',
            'workspace.settingKeys.dashboardDefaultMode.description':
                'Controls which dashboard section opens first in the published application.',
            'workspace.errors.copyReferenceUnresolved': 'A required workspace reference could not be copied.',
            'workspace.errors.copyAccessLinkIntakeInvalid': 'This workspace has invalid guest intake settings and could not be copied.',
            'workspace.errors.copyTemplateMaterialsExcluded':
                'Some materials are linked to templates that are not included in the copy, so the workspace cannot be copied.',
            'workspace.errors.seedResetFailed': 'Seeded workspace content could not be reset.'
        },
        ru: {
            'workspace.widgetSettings.widgetTitle': '{{widget}} — {{location}} (виджет {{number}})',
            'workspace.widgetSettings.widgetName': 'Трактовочная сеть',
            'workspace.widgetSettings.locations.center': 'Центральная зона',
            'workspace.widgetSettings.duplicateColor': 'Этот цвет уже есть в списке разрешённых.',
            'workspace.errors.userNotFound': 'Пользователь не найден',
            'workspace.errors.copyReferenceUnresolved': 'Не удалось скопировать обязательную связь рабочего пространства.',
            'workspace.errors.copyAccessLinkIntakeInvalid':
                'В рабочем пространстве настроена некорректная гостевая анкета, поэтому его нельзя скопировать.',
            'workspace.errors.copyTemplateMaterialsExcluded':
                'Некоторые материалы связаны с шаблонами, которые не входят в копию, поэтому рабочее пространство нельзя скопировать.',
            'workspace.errors.seedResetFailed': 'Не удалось сбросить исходные данные рабочего пространства.'
        }
    } as Record<string, string>
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: i18nState.language },
        t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
            const language = i18nState.language.split(/[-_]/)[0]?.toLowerCase() || 'en'
            const template =
                i18nState.translations[language]?.[_key] ??
                (typeof fallbackOrOptions === 'string'
                    ? fallbackOrOptions
                    : typeof fallbackOrOptions?.defaultValue === 'string'
                    ? fallbackOrOptions.defaultValue
                    : _key)
            return template.replace(/\{\{(\w+)\}\}/gu, (_match, key: string) => String(fallbackOrOptions?.[key] ?? `{{${key}}}`))
        }
    })
}))

vi.mock('../../components/runtime-ui', () => ({
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
                        void props.onSubmit(values).catch(() => undefined)
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

vi.mock('../../api/workspaces', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
        ...actual,
        fetchRuntimeWorkspaces: (...args: unknown[]) => apiMocks.fetchRuntimeWorkspaces(...args),
        fetchRuntimeWorkspace: (...args: unknown[]) => apiMocks.fetchRuntimeWorkspace(...args),
        fetchRuntimeWorkspaceMembers: (...args: unknown[]) => apiMocks.fetchRuntimeWorkspaceMembers(...args),
        fetchRuntimeWorkspaceSettings: (...args: unknown[]) => apiMocks.fetchRuntimeWorkspaceSettings(...args),
        inviteRuntimeWorkspaceMember: (...args: unknown[]) => apiMocks.inviteRuntimeWorkspaceMember(...args),
        createRuntimeWorkspace: (...args: unknown[]) => apiMocks.createRuntimeWorkspace(...args),
        updateRuntimeWorkspace: (...args: unknown[]) => apiMocks.updateRuntimeWorkspace(...args),
        copyRuntimeWorkspace: (...args: unknown[]) => apiMocks.copyRuntimeWorkspace(...args),
        deleteRuntimeWorkspace: (...args: unknown[]) => apiMocks.deleteRuntimeWorkspace(...args),
        convertRuntimeWorkspaceToShared: (...args: unknown[]) => apiMocks.convertRuntimeWorkspaceToShared(...args),
        removeRuntimeWorkspaceMember: (...args: unknown[]) => apiMocks.removeRuntimeWorkspaceMember(...args),
        updateDefaultRuntimeWorkspace: (...args: unknown[]) => apiMocks.updateDefaultRuntimeWorkspace(...args),
        updateRuntimeWorkspaceSettings: (...args: unknown[]) => apiMocks.updateRuntimeWorkspaceSettings(...args),
        resetRuntimeWorkspaceSeededContent: (...args: unknown[]) => apiMocks.resetRuntimeWorkspaceSeededContent(...args)
    }
})

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const renderPage = (
    props: Partial<Parameters<typeof RuntimeWorkspacesPage>[0]> = {},
    runtimeLayoutTarget?: { targetKind: 'page' | 'object'; entityTypeId: string }
) =>
    render(
        <DashboardDetailsProvider value={{ title: 'Runtime', ...(runtimeLayoutTarget ? { runtimeLayoutTarget } : {}) }}>
            <QueryClientProvider client={createQueryClient()}>
                <RuntimeWorkspacesPage applicationId='app-1' apiBaseUrl='/api/v1' locale='en' {...props} />
            </QueryClientProvider>
        </DashboardDetailsProvider>
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
            currentWorkspaceId: 'ws-personal',
            permissions: {
                canCreateSharedWorkspace: true,
                canManageApplication: true
            }
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
        apiMocks.convertRuntimeWorkspaceToShared.mockResolvedValue({ id: 'ws-personal' })
        apiMocks.updateDefaultRuntimeWorkspace.mockResolvedValue(undefined)
        apiMocks.resetRuntimeWorkspaceSeededContent.mockResolvedValue({
            resetRows: 0,
            operationId: '019f7f10-0000-7000-8000-000000000004',
            canManage: true
        })
        apiMocks.fetchRuntimeWorkspaceSettings.mockResolvedValue({
            canManage: true,
            items: [
                {
                    key: 'sectionLinksEnabled',
                    value: true,
                    source: 'application',
                    isInherited: true,
                    allowed: true,
                    version: null,
                    definition: {
                        key: 'sectionLinksEnabled',
                        labelKey: 'workspace.test.sectionLinksEnabled',
                        descriptionKey: 'workspace.test.sectionLinksEnabledDescription',
                        tab: 'navigation',
                        controlType: 'boolean',
                        defaultValue: true
                    }
                },
                {
                    key: 'dashboardDefaultMode',
                    value: 'first-menu-item',
                    source: 'workspace',
                    isInherited: false,
                    allowed: true,
                    version: 3,
                    definition: {
                        key: 'dashboardDefaultMode',
                        labelKey: 'workspace.test.dashboardDefaultMode',
                        descriptionKey: 'workspace.test.dashboardDefaultModeDescription',
                        tab: 'navigation',
                        controlType: 'select',
                        defaultValue: 'layout-default',
                        options: ['layout-default', 'first-menu-item']
                    }
                }
            ],
            widgetSettings: []
        })
        apiMocks.updateRuntimeWorkspaceSettings.mockResolvedValue({
            canManage: true,
            items: [
                {
                    key: 'sectionLinksEnabled',
                    value: false,
                    source: 'workspace',
                    isInherited: false,
                    allowed: true,
                    version: 2,
                    definition: {
                        key: 'sectionLinksEnabled',
                        labelKey: 'workspace.test.sectionLinksEnabled',
                        descriptionKey: 'workspace.test.sectionLinksEnabledDescription',
                        tab: 'navigation',
                        controlType: 'boolean',
                        defaultValue: true
                    }
                },
                {
                    key: 'dashboardDefaultMode',
                    value: 'layout-default',
                    source: 'application',
                    isInherited: true,
                    allowed: true,
                    version: null,
                    definition: {
                        key: 'dashboardDefaultMode',
                        labelKey: 'workspace.test.dashboardDefaultMode',
                        descriptionKey: 'workspace.test.dashboardDefaultModeDescription',
                        tab: 'navigation',
                        controlType: 'select',
                        defaultValue: 'layout-default',
                        options: ['layout-default', 'first-menu-item']
                    }
                }
            ],
            widgetSettings: []
        })
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

    it('hides shared-workspace creation when the server denies the capability', async () => {
        apiMocks.fetchRuntimeWorkspaces.mockResolvedValueOnce({
            items: [
                {
                    id: 'ws-member',
                    name: vlc('Member space'),
                    description: vlc('Read-only shared workspace'),
                    workspaceType: 'shared',
                    personalUserId: null,
                    status: 'active',
                    isDefault: true,
                    roleCodename: 'member'
                }
            ],
            total: 1,
            limit: 20,
            offset: 0,
            currentWorkspaceId: 'ws-member',
            permissions: {
                canCreateSharedWorkspace: false,
                canManageApplication: false
            }
        })

        renderPage()

        expect(await screen.findByRole('button', { name: 'Member space' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
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
    }, 30_000)

    it('localizes unresolved workspace copy references by backend error code', async () => {
        i18nState.language = 'ru'
        apiMocks.copyRuntimeWorkspace.mockRejectedValueOnce(
            Object.assign(new Error('Backend copy details'), { code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED' })
        )

        renderPage({ locale: 'ru' })
        await screen.findByRole('button', { name: 'Class A' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[1])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Не удалось скопировать обязательную связь рабочего пространства.'
        )
        expect(within(dialog).queryByText('Backend copy details')).not.toBeInTheDocument()
    })

    it('localizes invalid guest intake settings when copying a workspace', async () => {
        i18nState.language = 'ru'
        apiMocks.copyRuntimeWorkspace.mockRejectedValueOnce(
            Object.assign(new Error('Backend copy details'), { code: 'WORKSPACE_COPY_ACCESS_LINK_INTAKE_INVALID' })
        )

        renderPage({ locale: 'ru' })
        await screen.findByRole('button', { name: 'Class A' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[1])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'В рабочем пространстве настроена некорректная гостевая анкета, поэтому его нельзя скопировать.'
        )
        expect(within(dialog).queryByText('Backend copy details')).not.toBeInTheDocument()
    })

    it.each([
        {
            locale: 'en',
            language: 'en',
            localizedMessage: 'Some materials are linked to templates that are not included in the copy, so the workspace cannot be copied.'
        },
        {
            locale: 'ru',
            language: 'ru',
            localizedMessage:
                'Некоторые материалы связаны с шаблонами, которые не входят в копию, поэтому рабочее пространство нельзя скопировать.'
        }
    ])('shows the $language copy error without exposing backend message or details', async ({ locale, language, localizedMessage }) => {
        const backendMessage = 'Workspace copy cannot preserve TableTemplate Material relationships across excluded records'
        const backendDetails = 'MaterialRef references excluded TableTemplate row "table-template-42"'
        i18nState.language = language
        apiMocks.copyRuntimeWorkspace.mockRejectedValueOnce(
            Object.assign(new Error(backendMessage), {
                code: 'WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED',
                details: backendDetails
            })
        )

        renderPage({ locale })
        await screen.findByRole('button', { name: 'Class A' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[1])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }))

        const alert = await within(dialog).findByRole('alert')
        expect(alert).toHaveTextContent(localizedMessage)
        expect(within(dialog).queryByText(backendMessage, { exact: false })).not.toBeInTheDocument()
        expect(within(dialog).queryByText(backendDetails, { exact: false })).not.toBeInTheDocument()
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
        expect(screen.getAllByTestId('runtime-workspace-metric-card')).toHaveLength(3)
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
            currentWorkspaceId: 'ws-personal',
            permissions: {
                canCreateSharedWorkspace: true,
                canManageApplication: true
            }
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

    it('does not expose workspace IDs when workspace names are missing', async () => {
        const rawWorkspaceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073998'
        apiMocks.fetchRuntimeWorkspaces.mockResolvedValueOnce({
            items: [
                {
                    id: rawWorkspaceId,
                    name: null,
                    description: null,
                    workspaceType: 'shared',
                    personalUserId: null,
                    status: 'active',
                    isDefault: false,
                    roleCodename: 'member'
                }
            ],
            total: 1,
            limit: 20,
            offset: 0,
            currentWorkspaceId: rawWorkspaceId
        })

        renderPage()

        expect(await screen.findByRole('button', { name: 'Untitled workspace' })).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(rawWorkspaceId)
    })

    it('does not expose route workspace IDs when selected workspace names are missing', async () => {
        const rawWorkspaceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073999'
        apiMocks.fetchRuntimeWorkspace.mockResolvedValueOnce({
            id: rawWorkspaceId,
            name: null,
            description: null,
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

        renderPage({ routeWorkspaceId: rawWorkspaceId, routeSection: 'dashboard' })

        expect(await screen.findByRole('heading', { name: 'Untitled workspace' })).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(rawWorkspaceId)
    })

    it('does not expose member user IDs when member names and emails are missing', async () => {
        const rawUserId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        apiMocks.fetchRuntimeWorkspaceMembers.mockResolvedValueOnce({
            items: [
                {
                    userId: rawUserId,
                    roleCodename: 'member',
                    email: null,
                    nickname: null,
                    canRemove: true
                }
            ],
            total: 1,
            limit: 20,
            offset: 0
        })

        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'access' })

        expect(await screen.findByText('Workspace member')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(rawUserId)
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

    it('blocks invalid workspace invite email input before the mutation', async () => {
        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'access' })

        expect(await screen.findByText('owner@example.com')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'invalid-workspace-email' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

        expect(await within(dialog).findByText('Enter a valid email address.')).toBeInTheDocument()
        expect(apiMocks.inviteRuntimeWorkspaceMember).not.toHaveBeenCalled()
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

    it('sanitizes unknown workspace mutation errors before rendering runtime dialogs', async () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073996'
        apiMocks.inviteRuntimeWorkspaceMember.mockRejectedValueOnce(
            new Error(`SQL relation app_runtime.workspace_members failed for ${rawRecordId}`)
        )

        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'access' })

        expect(await screen.findByText('owner@example.com')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'missing@example.com' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Please try again or reload the page.')
        expect(within(dialog).queryByText('SQL relation')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('app_runtime.workspace_members')).not.toBeInTheDocument()
        expect(within(dialog).queryByText(rawRecordId)).not.toBeInTheDocument()
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

    it('renders workspace setting controls and updates allowed overrides', async () => {
        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'settings' }, { targetKind: 'page', entityTypeId: 'page-type-1' })

        expect(await screen.findByRole('heading', { name: 'Class A: Settings' })).toBeInTheDocument()
        expect(screen.getByText('Section-specific links')).toBeInTheDocument()
        expect(screen.queryByText('workspace.test.sectionLinksEnabled')).not.toBeInTheDocument()
        expect(screen.queryByText('settings.keys.sectionLinksEnabled')).not.toBeInTheDocument()
        expect(screen.getByText('Inherited from application')).toBeInTheDocument()
        expect(screen.getByText('Overridden in this workspace')).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Section-specific links'))
        await waitFor(() => {
            expect(apiMocks.updateRuntimeWorkspaceSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiBaseUrl: '/api/v1',
                    applicationId: 'app-1',
                    workspaceId: 'ws-shared',
                    targetKind: 'page',
                    entityTypeId: 'page-type-1',
                    settings: [expect.objectContaining({ key: 'sectionLinksEnabled', value: false })],
                    resets: []
                })
            )
        })
    })

    it('shows only delegated widget settings and sends semantic targets for workspace color overrides', async () => {
        const instanceKey = 'matrix-main'
        apiMocks.fetchRuntimeWorkspaceSettings.mockResolvedValue({
            canManage: true,
            items: [],
            widgetSettings: [
                {
                    key: 'interpretationNetwork.cellStylePolicy.allowedColors',
                    target: { kind: 'widget', instanceKey },
                    value: ['#000000'],
                    source: 'application',
                    isInherited: true,
                    allowed: true,
                    version: null
                }
            ],
            effectiveWidgetConfigs: [
                {
                    target: { kind: 'widget', instanceKey },
                    widgetKey: 'interpretationNetworkWorkspace',
                    zone: 'center',
                    semanticRegion: 'main',
                    config: { cellStylePolicy: { allowedColors: ['#000000'] } },
                    cellStylePolicy: { allowedColors: ['#000000'] },
                    layoutToken: 'test-layout-token'
                }
            ]
        })

        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'settings' }, { targetKind: 'page', entityTypeId: 'page-type-1' })

        expect(await screen.findByRole('heading', { name: 'Interpretation Network — Center zone (widget 1)' })).toBeInTheDocument()
        expect(screen.getByText('Allowed colors')).toBeInTheDocument()
        expect(screen.getByLabelText('Color 1 (HEX)')).toHaveValue('#000000')
        expect(screen.queryByText(instanceKey)).not.toBeInTheDocument()
        await waitFor(() => {
            expect(apiMocks.fetchRuntimeWorkspaceSettings).toHaveBeenCalledWith(
                expect.objectContaining({ targetKind: 'page', entityTypeId: 'page-type-1' })
            )
        })

        const newColorInput = screen.getByLabelText('New allowed color (HEX)') as HTMLInputElement
        expect(newColorInput.type).toBe('text')
        const pickerButton = screen.getByRole('button', { name: 'Choose color for New allowed color (HEX)' })
        expect(pickerButton).toHaveStyle({ width: '32px', height: '32px' })
        const inputFrame = newColorInput.closest('.MuiOutlinedInput-root')
        const adornment = inputFrame?.querySelector('.MuiInputAdornment-positionEnd')
        expect(inputFrame).not.toBeNull()
        expect(adornment?.parentElement).toBe(inputFrame)
        expect(pickerButton.parentElement).toBe(adornment)
        expect(inputFrame).toHaveStyle({ height: '40px', alignItems: 'center' })
        expect(adornment).toHaveStyle({ height: '32px', maxHeight: '32px', alignSelf: 'center', marginRight: '0px' })
        expect(pickerButton).toHaveStyle({ width: '32px', height: '32px', margin: '0px' })
        fireEvent.change(newColorInput, { target: { value: '#000000' } })
        expect(screen.getByRole('status')).toHaveTextContent('This color is already in the allowed list.')
        expect(screen.getByRole('button', { name: 'Add color' })).toBeDisabled()
        fireEvent.change(newColorInput, { target: { value: '#607D8B' } })
        await userEvent.click(pickerButton)
        const pickerDialog = screen.getByRole('dialog', { name: 'Choose color for New allowed color (HEX)' })
        const hexPicker = pickerDialog.querySelector('.react-colorful') as HTMLElement | null
        expect(hexPicker).not.toBeNull()
        expect(hexPicker).toHaveStyle({ width: '240px', height: '160px' })
        expect(pickerDialog).not.toHaveTextContent('RGB')
        await userEvent.keyboard('{Escape}')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Add color' }))
        const secondColorInput = screen.getByLabelText('Color 2 (HEX)') as HTMLInputElement
        expect(secondColorInput.type).toBe('text')
        expect(secondColorInput).toHaveValue('#607D8B')
        await userEvent.click(screen.getByRole('button', { name: 'Save colors' }))

        await waitFor(() => {
            expect(apiMocks.updateRuntimeWorkspaceSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiBaseUrl: '/api/v1',
                    applicationId: 'app-1',
                    workspaceId: 'ws-shared',
                    targetKind: 'page',
                    entityTypeId: 'page-type-1',
                    settings: [
                        {
                            key: 'interpretationNetwork.cellStylePolicy.allowedColors',
                            target: { kind: 'widget', instanceKey },
                            value: ['#000000', '#607D8B']
                        }
                    ],
                    resets: []
                })
            )
        })
    })

    it('confirms and executes an authorized seeded-content reset', async () => {
        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'settings' })

        expect(await screen.findByRole('heading', { name: 'Class A: Settings' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Reset seeded content' }))
        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveTextContent('Reset seeded content?')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm remove' }))

        await waitFor(() => {
            expect(apiMocks.resetRuntimeWorkspaceSeededContent).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-shared'
            })
        })
    })

    it('localizes a seeded-content reset failure by backend error code', async () => {
        i18nState.language = 'ru'
        apiMocks.resetRuntimeWorkspaceSeededContent.mockRejectedValueOnce(
            Object.assign(new Error('Backend reset details'), { code: 'WORKSPACE_SEED_RESET_FAILED' })
        )

        renderPage({ locale: 'ru', routeWorkspaceId: 'ws-shared', routeSection: 'settings' })
        expect(await screen.findByRole('heading', { name: 'Class A: Settings' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Reset seeded content' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm remove' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Не удалось сбросить исходные данные рабочего пространства.')
        expect(within(dialog).queryByText('Backend reset details')).not.toBeInTheDocument()
    })

    it('does not fetch workspace settings on dashboard or access routes and keeps member fetches off settings routes', async () => {
        renderPage({ routeWorkspaceId: 'ws-shared' })

        expect(await screen.findByRole('heading', { name: 'Class A' })).toBeInTheDocument()
        expect(apiMocks.fetchRuntimeWorkspaceSettings).not.toHaveBeenCalled()
        expect(apiMocks.fetchRuntimeWorkspaceMembers).toHaveBeenCalledTimes(1)

        cleanup()
        apiMocks.fetchRuntimeWorkspaceMembers.mockClear()
        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'access' })

        expect(await screen.findByRole('heading', { name: 'Class A: Access' })).toBeInTheDocument()
        expect(apiMocks.fetchRuntimeWorkspaceSettings).not.toHaveBeenCalled()
        expect(apiMocks.fetchRuntimeWorkspaceMembers).toHaveBeenCalledTimes(1)

        cleanup()
        apiMocks.fetchRuntimeWorkspaceMembers.mockClear()
        renderPage({ routeWorkspaceId: 'ws-shared', routeSection: 'settings' })

        expect(await screen.findByRole('heading', { name: 'Class A: Settings' })).toBeInTheDocument()
        expect(apiMocks.fetchRuntimeWorkspaceSettings).toHaveBeenCalledTimes(1)
        expect(apiMocks.fetchRuntimeWorkspaceMembers).not.toHaveBeenCalled()
    })

    it('ships localized runtime workspace resources', () => {
        expect(enApps.workspace.errors.copyTemplateMaterialsExcluded).toBe(
            'Some materials are linked to templates that are not included in the copy, so the workspace cannot be copied.'
        )
        expect(ruApps.workspace.title).toBe('Рабочие пространства')
        expect(ruApps.workspace.errors.copyTemplateMaterialsExcluded).toBe(
            'Некоторые материалы связаны с шаблонами, которые не входят в копию, поэтому рабочее пространство нельзя скопировать.'
        )
        expect(ruApps.workspace.settingKeys.sectionLinksEnabled).toBe('Индивидуальные ссылки разделов')
        expect(ruApps.workspace.settingKeys['learningContent.defaultView']).toBe('Вид контента по умолчанию')
        expect(ruApps.workspace.errors.userNotFound).toBe('Пользователь не найден')
        expect(ruApps.workspace.errors.lastOwnerRemovalBlocked).toBe('Нельзя удалить последнего владельца рабочего пространства')
        expect(ruApps.workspace.actions.makeShared).toBe('Сделать общим')
        expect(ruApps.workspace.convertOneWayLine).toBe('Это изменение необратимо.')
        expect(ruApps.workspace.convertDataLine).toBe('Рабочее пространство, записи и связи сохраняются.')
    })

    it('converts an owner-owned personal workspace through the explicit confirmation dialog', async () => {
        renderPage({ currentUserId: 'user-1' })
        await screen.findByRole('button', { name: 'Personal' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[0])
        expect(await screen.findByRole('menuitem', { name: 'Make shared' })).not.toBeDisabled()
        fireEvent.click(screen.getByRole('menuitem', { name: 'Make shared' }))
        // The row actions menu closes when the confirmation dialog opens.
        await waitFor(() => {
            expect(screen.queryByRole('menuitem', { name: 'Make shared' })).not.toBeInTheDocument()
        })

        const dialog = await screen.findByRole('dialog', { name: 'Convert to shared workspace?' })
        expect(
            within(dialog).getByText(
                'Every application member sees this workspace with baseline member rights; existing owner roles are kept.'
            )
        ).toBeInTheDocument()
        expect(within(dialog).getByText('This change is permanent and cannot be undone.')).toBeInTheDocument()
        // The described-by target covers both the one-way warning and the detail bullet list.
        expect(dialog).toHaveAttribute('aria-describedby', 'runtime-convert-shared-description')
        const describedContent = document.getElementById('runtime-convert-shared-description')
        expect(describedContent?.getAttribute('role') ?? 'group').toBeDefined()
        expect(describedContent).toHaveTextContent('This change is permanent and cannot be undone.')
        expect(
            within(dialog).getByText(
                'Existing guest links in this workspace become eligible when configured. Anonymous public access is not enabled automatically.'
            )
        ).toBeInTheDocument()
        expect(within(dialog).getByText('The workspace, its records and links are preserved.')).toBeInTheDocument()

        // Initial focus rests on the safe (Cancel) action for an irreversible change.
        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Convert to shared' }))
        await waitFor(() => {
            expect(apiMocks.convertRuntimeWorkspaceToShared).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-personal'
            })
        })
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Convert to shared workspace?' })).not.toBeInTheDocument()
        })
    })

    it('keeps the conversion action disabled for shared workspaces', async () => {
        renderPage()
        await screen.findByRole('button', { name: 'Class A' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[1])
        const makeSharedItem = await screen.findByRole('menuitem', { name: 'Make shared' })
        expect(makeSharedItem).toHaveAttribute('aria-disabled', 'true')
    })

    it('disables Make shared for an invited co-owner who does not own the personal workspace', async () => {
        renderPage({ currentUserId: 'user-2' })
        await screen.findByRole('button', { name: 'Personal' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[0])
        const makeSharedItem = await screen.findByRole('menuitem', { name: 'Make shared' })
        expect(makeSharedItem).toHaveAttribute('aria-disabled', 'true')
    })

    it('supports a keyboard-only conversion path from menu open through dialog confirm', async () => {
        apiMocks.convertRuntimeWorkspaceToShared.mockResolvedValue({ id: 'ws-personal' })
        renderPage({ currentUserId: 'user-1' })
        const user = userEvent.setup()
        const actionsButton = await screen.findAllByRole('button', { name: 'Workspace actions' })

        // The row menu opens through the button activation seam (happy-dom
        // lacks the native Enter→click button mapping); the dialog staging
        // below stays keyboard-driven.
        fireEvent.click(actionsButton[0]!)
        const makeSharedItem = await screen.findByRole('menuitem', { name: 'Make shared' })
        expect(makeSharedItem).not.toBeDisabled()
        // Menu items are `li` elements without native Enter activation in
        // happy-dom, so the dialog opens through the item activation seam; the
        // dialog staging below stays keyboard-driven (initial focus, Tab,
        // Enter, Escape in the dedicated test).
        fireEvent.focus(makeSharedItem)
        fireEvent.click(makeSharedItem)

        const dialog = await screen.findByRole('dialog', { name: 'Convert to shared workspace?' })
        const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' })
        expect(cancelButton).toHaveFocus()
        // Tab really moves focus to the destructive action inside the dialog.
        await user.tab()
        const convertButton = within(dialog).getByRole('button', { name: 'Convert to shared' })
        expect(convertButton).toHaveFocus()
        // Enter on the focused destructive action confirms the conversion.
        await user.keyboard('{Enter}')
        await waitFor(() => {
            expect(apiMocks.convertRuntimeWorkspaceToShared).toHaveBeenCalledWith({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'ws-personal'
            })
        })
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Convert to shared workspace?' })).not.toBeInTheDocument()
        })
    })

    it('closes the conversion dialog with Escape without converting', async () => {
        renderPage({ currentUserId: 'user-1' })
        const user = userEvent.setup()
        await screen.findByRole('button', { name: 'Personal' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[0])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Make shared' }))
        const dialog = await screen.findByRole('dialog', { name: 'Convert to shared workspace?' })
        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

        await user.keyboard('{Escape}')
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Convert to shared workspace?' })).not.toBeInTheDocument()
        })
        expect(apiMocks.convertRuntimeWorkspaceToShared).not.toHaveBeenCalled()
    })

    it('keeps the conversion dialog open with a localized error when the backend rejects it', async () => {
        apiMocks.convertRuntimeWorkspaceToShared.mockRejectedValue(
            Object.assign(new Error('Only the personal workspace owner can convert it to shared'), {
                code: 'WORKSPACE_CONVERSION_BLOCKED'
            })
        )
        renderPage({ currentUserId: 'user-1' })
        await screen.findByRole('button', { name: 'Personal' })

        fireEvent.click(screen.getAllByRole('button', { name: 'Workspace actions' })[0])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Make shared' }))
        const dialog = screen.getByRole('dialog', { name: 'Convert to shared workspace?' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Convert to shared' }))

        await waitFor(() => {
            const alerts = within(dialog)
                .getAllByRole('alert')
                .map((el) => el.textContent ?? '')
            expect(alerts).toContain('Only the personal workspace owner can convert it to shared')
        })
        expect(screen.getByRole('dialog', { name: 'Convert to shared workspace?' })).toBeInTheDocument()
    })
})
