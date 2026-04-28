import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import WorkspaceSwitcher from '../WorkspaceSwitcher'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'

const mocks = vi.hoisted(() => ({
    fetchWithCsrf: vi.fn()
}))

const i18nState = vi.hoisted(() => ({
    language: 'en'
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: i18nState.language },
        t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) =>
            typeof fallbackOrOptions === 'string'
                ? fallbackOrOptions
                : typeof fallbackOrOptions?.defaultValue === 'string'
                ? fallbackOrOptions.defaultValue
                : _key
    })
}))

vi.mock('@mui/material/Tooltip', () => ({
    default: ({ children }: { children: ReactNode }) => children
}))

vi.mock('@mui/material/Select', () => ({
    default: ({
        children,
        value,
        onChange,
        inputProps,
        renderValue,
        'data-testid': dataTestId
    }: {
        children: ReactNode
        value: string
        inputProps?: { 'aria-label'?: string }
        'data-testid'?: string
        renderValue?: () => ReactNode
        onChange: (event: { target: { value: string } }) => void
    }) => (
        <>
            <div data-testid={`${dataTestId}-value`}>{renderValue?.()}</div>
            <select
                aria-label={inputProps?.['aria-label'] ?? 'workspace-select'}
                data-testid={dataTestId}
                value={value}
                onChange={(event) => onChange({ target: { value: event.target.value } })}
            >
                {children}
            </select>
        </>
    ),
    selectClasses: { select: 'MuiSelect-select' }
}))

vi.mock('@mui/material/MenuItem', () => ({
    default: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>
}))

vi.mock('@mui/material/ListItemText', () => ({
    default: ({ primary, secondary }: { primary?: ReactNode; secondary?: ReactNode }) => (
        <>
            {primary}
            {secondary ? ` ${secondary}` : null}
        </>
    )
}))

vi.mock('@mui/material/ListItemAvatar', () => ({
    default: () => null
}))

vi.mock('@mui/material/ListItemIcon', () => ({
    default: () => null
}))

vi.mock('@mui/material/ListSubheader', () => ({
    default: ({ children }: { children?: ReactNode }) => (
        <option value='__subheader__' disabled>
            {children}
        </option>
    )
}))

vi.mock('@mui/material/Divider', () => ({
    default: () => null
}))

vi.mock('@mui/material/Avatar', () => ({
    default: () => null
}))

vi.mock('@mui/icons-material/FolderRounded', () => ({
    default: () => null
}))

vi.mock('@mui/icons-material/PersonRounded', () => ({
    default: () => null
}))

vi.mock('@mui/icons-material/ManageAccountsRounded', () => ({
    default: () => null
}))

vi.mock('../../../api/api', async () => {
    const actual = await vi.importActual('../../../api/api')
    return {
        ...actual,
        fetchWithCsrf: mocks.fetchWithCsrf
    }
})

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

describe('WorkspaceSwitcher', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18nState.language = 'en'

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.includes('/runtime/workspaces')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'ws-1',
                                    name: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: { content: 'Main' },
                                            ru: { content: 'Основное' }
                                        }
                                    },
                                    description: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: { content: 'Main workspace' },
                                            ru: { content: 'Основное рабочее пространство' }
                                        }
                                    },
                                    workspaceType: 'personal',
                                    status: 'active',
                                    isDefault: true,
                                    roleCodename: 'owner'
                                },
                                {
                                    id: 'ws-2',
                                    name: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: { content: 'Class A' },
                                            ru: { content: 'Класс А' }
                                        }
                                    },
                                    description: {
                                        _schema: '1',
                                        _primary: 'en',
                                        locales: {
                                            en: { content: 'Class workspace' },
                                            ru: { content: 'Рабочее пространство класса' }
                                        }
                                    },
                                    workspaceType: 'shared',
                                    status: 'active',
                                    isDefault: false,
                                    roleCodename: 'member'
                                }
                            ]
                        })
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        mocks.fetchWithCsrf.mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true })
        } satisfies Partial<Response>)
    })

    it('renders the current workspace and switches to another workspace', async () => {
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <DashboardDetailsProvider
                    value={
                        {
                            applicationId: 'app-1',
                            apiBaseUrl: '/api/v1',
                            currentWorkspaceId: 'ws-1',
                            workspacesEnabled: true,
                            rows: [],
                            columns: [],
                            title: 'Runtime'
                        } as never
                    }
                >
                    <WorkspaceSwitcher />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        const workspaceSelect = await screen.findByTestId('runtime-workspace-switcher')
        expect(workspaceSelect).toHaveValue('ws-1')
        expect(screen.getByRole('option', { name: /Main/ })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /Manage workspaces/ })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Manage workspaces/ })).not.toBeInTheDocument()

        fireEvent.change(workspaceSelect, { target: { value: 'ws-2' } })

        await waitFor(() => {
            expect(mocks.fetchWithCsrf).toHaveBeenCalledWith(
                '/api/v1',
                expect.stringContaining('/api/v1/applications/app-1/runtime/workspaces/ws-2/default'),
                expect.objectContaining({ method: 'PATCH' })
            )
        })
    })

    it('uses the active UI locale when rendering localized workspace names', async () => {
        i18nState.language = 'ru'
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <DashboardDetailsProvider
                    value={
                        {
                            applicationId: 'app-1',
                            apiBaseUrl: '/api/v1',
                            currentWorkspaceId: 'ws-1',
                            workspacesEnabled: true,
                            rows: [],
                            columns: [],
                            title: 'Runtime'
                        } as never
                    }
                >
                    <WorkspaceSwitcher />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        const workspaceSelect = await screen.findByTestId('runtime-workspace-switcher')
        expect(workspaceSelect).toHaveValue('ws-1')
        expect(screen.getByTestId('runtime-workspace-switcher-value')).toHaveTextContent('Основное')
        expect(screen.getByRole('option', { name: /Основное/ })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /Класс А/ })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: /Main/ })).not.toBeInTheDocument()
    })
})
