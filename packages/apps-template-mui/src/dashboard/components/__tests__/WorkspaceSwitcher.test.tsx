import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import WorkspaceSwitcher from '../WorkspaceSwitcher'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'

const mocks = vi.hoisted(() => ({
    fetchWithCsrf: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
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
        onChange
    }: {
        children: ReactNode
        value: string
        onChange: (event: { target: { value: string } }) => void
    }) => (
        <select aria-label='workspace-select' value={value} onChange={(event) => onChange({ target: { value: event.target.value } })}>
            {children}
        </select>
    ),
    selectClasses: { select: 'MuiSelect-select' }
}))

vi.mock('@mui/material/MenuItem', () => ({
    default: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>
}))

vi.mock('@mui/material/ListItemText', () => ({
    default: ({ primary }: { primary?: ReactNode }) => <>{primary}</>
}))

vi.mock('@mui/material/Chip', () => ({
    default: ({ label }: { label?: ReactNode }) => <>{label}</>
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

vi.mock('../WorkspaceManagerDialog', () => ({
    default: ({ open }: { open: boolean }) => (open ? <div data-testid='workspace-manager-dialog'>manager</div> : null)
}))

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
                                    codename: 'main',
                                    name: 'Main',
                                    workspaceType: 'personal',
                                    status: 'active',
                                    isDefault: true,
                                    roleCodename: 'owner'
                                },
                                {
                                    id: 'ws-2',
                                    codename: 'class-a',
                                    name: 'Class A',
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

        const workspaceSelect = await screen.findByLabelText('workspace-select')
        expect(workspaceSelect).toHaveValue('ws-1')
        expect(screen.getByRole('option', { name: /Main/ })).toBeInTheDocument()

        fireEvent.change(workspaceSelect, { target: { value: 'ws-2' } })

        await waitFor(() => {
            expect(mocks.fetchWithCsrf).toHaveBeenCalledWith(
                '/api/v1',
                '/api/v1/applications/app-1/runtime/workspaces/ws-2/default',
                expect.objectContaining({ method: 'PATCH' })
            )
        })
    })
})
