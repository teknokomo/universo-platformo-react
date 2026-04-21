import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import WorkspaceManagerDialog from '../WorkspaceManagerDialog'
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

vi.mock('../../../api/api', async () => {
    const actual = await vi.importActual('../../../api/api')
    return {
        ...actual,
        fetchWithCsrf: mocks.fetchWithCsrf
    }
})

vi.mock('../../../components/dialogs/ConfirmDeleteDialog', () => ({
    default: ({ open, onConfirm }: { open: boolean; onConfirm: () => Promise<void> | void; children?: ReactNode }) =>
        open ? (
            <div data-testid='confirm-delete-dialog'>
                <button onClick={() => void onConfirm()}>confirm-remove</button>
            </div>
        ) : null
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

describe('WorkspaceManagerDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)

                if (url.endsWith('/runtime/workspaces')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'ws-1',
                                    codename: 'main',
                                    name: 'Main',
                                    workspaceType: 'shared',
                                    status: 'active',
                                    isDefault: true,
                                    roleCodename: 'owner'
                                }
                            ]
                        })
                    } as Response
                }

                if (url.endsWith('/runtime/workspaces/ws-1/members')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                { userId: 'user-1', roleCodename: 'owner' },
                                { userId: 'user-2', roleCodename: 'member' }
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

    it('limits invite role choices to member and confirms removals', async () => {
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
                    <WorkspaceManagerDialog open onClose={() => undefined} />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Main')).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'workspace.inviteRole' })).toHaveTextContent('workspace.roleMember')

        const removeButtons = await screen.findAllByLabelText('workspace.removeMember')
        fireEvent.click(removeButtons[0])

        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument()
        fireEvent.click(screen.getByText('confirm-remove'))

        await waitFor(() => {
            expect(mocks.fetchWithCsrf).toHaveBeenCalledWith(
                '/api/v1',
                '/api/v1/applications/app-1/runtime/workspaces/ws-1/members/user-1',
                expect.objectContaining({ method: 'DELETE' })
            )
        })
    })

    it('hides member-management controls for shared-workspace members', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)

                if (url.endsWith('/runtime/workspaces')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'ws-1',
                                    codename: 'main',
                                    name: 'Main',
                                    workspaceType: 'shared',
                                    status: 'active',
                                    isDefault: true,
                                    roleCodename: 'member'
                                }
                            ]
                        })
                    } as Response
                }

                if (url.endsWith('/runtime/workspaces/ws-1/members')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                { userId: 'user-1', roleCodename: 'owner' },
                                { userId: 'user-2', roleCodename: 'member' }
                            ]
                        })
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

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
                    <WorkspaceManagerDialog open onClose={() => undefined} />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Main')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'workspace.invite' })).not.toBeInTheDocument()
        expect(screen.queryByLabelText('workspace.removeMember')).not.toBeInTheDocument()
    })
})
