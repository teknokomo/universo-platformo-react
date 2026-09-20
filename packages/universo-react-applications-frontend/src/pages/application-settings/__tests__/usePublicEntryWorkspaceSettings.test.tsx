import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const apiMocks = vi.hoisted(() => ({
    getApplicationPublicEntryWorkspace: vi.fn(),
    getApplicationRuntimeWorkspace: vi.fn(),
    listApplicationRuntimeWorkspaces: vi.fn(),
    updateApplicationPublicEntryWorkspace: vi.fn()
}))

vi.mock('../../../api/applications', () => apiMocks)

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key
    })
}))

import { usePublicEntryWorkspaceSettings } from '../usePublicEntryWorkspaceSettings'

const buildWorkspace = (id: string, name: string) => ({
    id,
    name: {
        _schema: 'v1',
        _primary: 'en',
        locales: { en: { content: name } }
    },
    description: null,
    workspaceType: 'shared',
    personalUserId: null,
    status: 'active',
    isDefault: false,
    roleCodename: 'owner'
})

const FIRST_ID = '018f8a78-7b8f-7c1d-a111-2222333344aa'
const SECOND_ID = '018f8a78-7b8f-7c1d-a111-2222333344bb'
const THIRD_ID = '018f8a78-7b8f-7c1d-a111-2222333344cc'
const FOURTH_ID = '018f8a78-7b8f-7c1d-a111-2222333344dd'

const HookProbe = ({ applicationId = 'app-1', enabled = true }: { applicationId?: string; enabled?: boolean }) => {
    const settings = usePublicEntryWorkspaceSettings({ applicationId, enabled, locale: 'en' })

    return (
        <div>
            <span data-testid='workspace-id'>{settings.workspaceId ?? 'none'}</span>
            <span data-testid='workspace-options'>{settings.workspaceOptions.map((option) => option.label).join('|')}</span>
            <span data-testid='workspace-option-ids'>{settings.workspaceOptions.map((option) => option.id).join('|')}</span>
            <span data-testid='has-more'>{String(settings.hasMore)}</span>
            <button data-testid='load-more' onClick={() => settings.loadMore()}>
                load more
            </button>
        </div>
    )
}

const renderWorkspaceSettings = (props: { applicationId?: string; enabled?: boolean } = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, retryDelay: 0 },
            mutations: { retry: false }
        }
    })

    render(
        <QueryClientProvider client={queryClient}>
            <HookProbe {...props} />
        </QueryClientProvider>
    )
}

describe('usePublicEntryWorkspaceSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        apiMocks.getApplicationPublicEntryWorkspace.mockResolvedValue({ workspaceId: null })
        apiMocks.updateApplicationPublicEntryWorkspace.mockResolvedValue({ workspaceId: null })
    })

    it('requests the first bounded page of shared workspaces', async () => {
        apiMocks.listApplicationRuntimeWorkspaces.mockResolvedValue({
            items: [buildWorkspace(FIRST_ID, 'First workspace')],
            total: 1,
            limit: 100,
            offset: 0
        })

        renderWorkspaceSettings()

        await waitFor(() => {
            expect(screen.getByTestId('workspace-options')).toHaveTextContent('First workspace')
        })
        expect(apiMocks.listApplicationRuntimeWorkspaces).toHaveBeenCalledWith('app-1', { limit: 100, offset: 0 })
        expect(screen.getByTestId('has-more')).toHaveTextContent('false')
    })

    it('keeps the configured workspace visible when it sits outside the first page', async () => {
        apiMocks.getApplicationPublicEntryWorkspace.mockResolvedValue({ workspaceId: SECOND_ID })
        apiMocks.listApplicationRuntimeWorkspaces.mockResolvedValue({
            items: [buildWorkspace(FIRST_ID, 'First workspace')],
            total: 150,
            limit: 100,
            offset: 0
        })
        apiMocks.getApplicationRuntimeWorkspace.mockResolvedValue(buildWorkspace(SECOND_ID, 'Configured workspace'))

        renderWorkspaceSettings()

        await waitFor(() => {
            expect(screen.getByTestId('workspace-options')).toHaveTextContent('Configured workspace')
        })
        expect(screen.getByTestId('workspace-id')).toHaveTextContent(SECOND_ID)
        expect(apiMocks.getApplicationRuntimeWorkspace).toHaveBeenCalledWith('app-1', SECOND_ID)
        expect(screen.getByTestId('has-more')).toHaveTextContent('true')
    })

    it('appends the next page when the selector requests more workspaces', async () => {
        apiMocks.listApplicationRuntimeWorkspaces
            .mockResolvedValueOnce({
                items: [buildWorkspace(FIRST_ID, 'First workspace'), buildWorkspace(SECOND_ID, 'Second workspace')],
                total: 4,
                limit: 100,
                offset: 0
            })
            .mockResolvedValueOnce({
                items: [buildWorkspace(THIRD_ID, 'Third workspace'), buildWorkspace(FOURTH_ID, 'Fourth workspace')],
                total: 4,
                limit: 100,
                offset: 2
            })

        renderWorkspaceSettings()

        await waitFor(() => {
            expect(screen.getByTestId('workspace-options')).toHaveTextContent('Second workspace')
        })
        expect(screen.getByTestId('has-more')).toHaveTextContent('true')

        await userEvent.click(screen.getByTestId('load-more'))

        await waitFor(() => {
            expect(apiMocks.listApplicationRuntimeWorkspaces).toHaveBeenLastCalledWith('app-1', { limit: 100, offset: 2 })
        })
        await waitFor(() => {
            expect(screen.getByTestId('workspace-options')).toHaveTextContent('Fourth workspace')
        })
        expect(screen.getByTestId('has-more')).toHaveTextContent('false')
    })

    it('does not request workspace pages while disabled', () => {
        renderWorkspaceSettings({ enabled: false })

        expect(apiMocks.getApplicationPublicEntryWorkspace).not.toHaveBeenCalled()
        expect(apiMocks.listApplicationRuntimeWorkspaces).not.toHaveBeenCalled()
    })
})
