import React from 'react'
import { vi } from 'vitest'
import { act } from 'react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders, screen, waitFor } from '@testing/frontend'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import ARJSPublisher from '../ARJSPublisher.jsx'

const {
    mockGetCurrentUrlIds,
    mockLoadARJSSettings,
    mockSaveARJSSettings,
    mockPublish,
    mockGetGlobalSettings,
    mockCreateGroupLink,
    mockPublishClient
} = vi.hoisted(
    () => ({
        mockGetCurrentUrlIds: vi.fn(() => ({ flowId: 'flow-123', unikId: 'unik-42' })),
        mockLoadARJSSettings: vi.fn(async () => ({ projectTitle: 'Demo Project', isPublic: false })),
        mockSaveARJSSettings: vi.fn(async () => undefined),
        mockPublish: vi.fn(async () => ({ publicationId: 'pub-123' })),
        mockGetGlobalSettings: vi.fn(async () => ({ data: { success: true, data: {} } })),
        mockCreateGroupLink: vi.fn(async () => ({ id: 'link-123', baseSlug: 'abc123def456' })),
        mockPublishClient: {
            get: vi.fn(async () => ({ data: {} })),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            defaults: { headers: { common: {} } },
            interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
        }
    })
)

vi.mock('../../../api', async (importOriginal) => {
    const actual = await importOriginal()

    return {
        ...actual,
        getCurrentUrlIds: mockGetCurrentUrlIds,
        ARJSPublicationApi: {
            loadARJSSettings: mockLoadARJSSettings,
            saveARJSSettings: mockSaveARJSSettings
        },
        ChatflowsApi: {
            loadSettings: mockLoadARJSSettings,
            saveSettings: mockSaveARJSSettings
        },
        ARJSPublishApi: {
            publishARJS: mockPublish
        },
        PublicationApi: {
            getGlobalSettings: mockGetGlobalSettings,
            getCanvasById: vi.fn(async () => ({ data: {} }))
        },
        PublishLinksApi: {
            listLinks: vi.fn(async () => []),
            createGroupLink: mockCreateGroupLink,
            deleteLink: vi.fn(async () => ({ success: true }))
        },
        getPublishApiClient: vi.fn(() => mockPublishClient)
    }
})

vi.mock('../../../api/common', () => ({
    getCurrentUrlIds: mockGetCurrentUrlIds,
    getApiBaseUrl: () => 'http://localhost:3000'
}))

vi.mock('../../utils/base58Validator', () => ({
    isValidBase58: vi.fn(() => true)
}))

const createQueryClientWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    return Wrapper
}

describe('ARJSPublisher', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('publishes the current flow when toggling the public switch', async () => {
        const onPublish = vi.fn()

        await act(async () => {
            await renderWithProviders(
                <ARJSPublisher
                    flow={{ id: 'flow-123', name: 'Demo Flow' }}
                    unikId='unik-42'
                    onPublish={onPublish}
                    onCancel={() => {}}
                    initialConfig={{}}
                />,
                {
                    withRedux: false,
                    withRouter: false,
                    additionalWrappers: [createQueryClientWrapper()]
                }
            )
        })

        await waitFor(() => expect(mockLoadARJSSettings).toHaveBeenCalledWith('flow-123'))

        const toggle = await screen.findByRole('checkbox', { name: /configuration\.makePublic/i })
        await userEvent.click(toggle)

        await waitFor(() => expect(mockCreateGroupLink).toHaveBeenCalledTimes(1))

        const lastSaveCall = mockSaveARJSSettings.mock.calls.at(-1)
        expect(lastSaveCall?.[0]).toBe('flow-123')
        expect(lastSaveCall?.[1]).toEqual(
            expect.objectContaining({
                isPublic: true,
                timerConfig: {
                    enabled: false,
                    limitSeconds: 60,
                    position: 'top-center'
                }
            })
        )
        expect(mockCreateGroupLink).toHaveBeenCalledWith('flow-123', 'arjs', undefined)
    })

    it('shows error alert with retry when loading settings fails', async () => {
        mockLoadARJSSettings.mockRejectedValueOnce(new Error('rate limit exceeded'))

        await act(async () => {
            await renderWithProviders(
                <ARJSPublisher
                    flow={{ id: 'flow-123', name: 'Demo Flow' }}
                    unikId='unik-42'
                    onPublish={() => {}}
                    onCancel={() => {}}
                    initialConfig={{}}
                />,
                {
                    withRedux: false,
                    withRouter: false,
                    additionalWrappers: [createQueryClientWrapper()]
                }
            )
        })

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent(/rate limit exceeded/i)

        mockLoadARJSSettings.mockResolvedValue({ projectTitle: 'Recovered', isPublic: false })

        const retryButton = screen.getByRole('button', { name: /retry|повторить/i })
        await userEvent.click(retryButton)

        await waitFor(() => expect(mockLoadARJSSettings).toHaveBeenCalledTimes(2))
    })
})
