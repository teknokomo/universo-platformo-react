import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { MessengerBindingsPanel } from '../MessengerBindingsPanel'
import { listAliasesByApplication } from '../../../api/applicationAliasesApi'
import { applicationAliasesQueryKeys } from '../../../api/applicationAliasesQueryKeys'

const mocks = vi.hoisted(() => ({
    enqueueSnackbar: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    release: vi.fn(),
    bindingsQuery: {
        isLoading: false,
        isError: false,
        isSuccess: true,
        data: [] as Array<Record<string, unknown>>,
        refetch: vi.fn()
    }
}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()
    return {
        ...actual,
        useTranslation: () => ({
            i18n: { language: 'en', resolvedLanguage: 'en' },
            t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
                const template = typeof fallback === 'string' ? fallback : key
                const values = typeof fallback === 'object' ? fallback : options ?? {}
                return template.replace(/\{\{([^}]+)\}\}/gu, (_match, name: string) => String(values[name] ?? `{{${name}}}`))
            }
        })
    }
})

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }) }))

vi.mock('@universo-react/template-mui', () => ({
    gridSpacing: 2,
    ItemCard: ({
        data,
        titleTooltip,
        footerStackOnMobile,
        titleEndContent,
        footerStartContent,
        footerEndContent
    }: {
        data: { name?: string; description?: string }
        titleTooltip?: string
        footerStackOnMobile?: boolean
        titleEndContent?: React.ReactNode
        footerStartContent?: React.ReactNode
        footerEndContent?: React.ReactNode
    }) => (
        <article data-mobile-footer-stack={footerStackOnMobile ? 'true' : undefined}>
            <h2 aria-label={titleTooltip}>{data.name}</h2>
            <p>{data.description}</p>
            {titleEndContent}
            {footerStartContent}
            {footerEndContent}
        </article>
    )
}))

vi.mock('../../../api/applicationAliasesApi', () => ({ listAliasesByApplication: vi.fn() }))

vi.mock('../../../hooks/useApplicationBotBindings', () => ({
    useApplicationBotBindings: () => mocks.bindingsQuery,
    useCreateApplicationBotBinding: () => ({ mutateAsync: mocks.create, isPending: false }),
    useUpdateApplicationBotBinding: () => ({ mutateAsync: mocks.update, isPending: false }),
    useReleaseApplicationBotBinding: () => ({ mutateAsync: mocks.release, isPending: false })
}))

const binding = {
    id: 'binding-uuid-internal',
    applicationId: 'application-uuid-internal',
    platform: 'telegram' as const,
    botUsername: 'supportbot',
    displayName: 'Support',
    shortId: 'aBcdefGhijkLmNopQrStUv',
    status: 'active' as const,
    version: 7,
    createdAt: '2026-10-31T10:00:00.000Z',
    updatedAt: '2026-10-31T10:01:00.000Z'
}

const renderPanel = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <MemoryRouter>
            <QueryClientProvider client={queryClient}>
                <MessengerBindingsPanel applicationId='application-uuid-internal' isPublic />
            </QueryClientProvider>
        </MemoryRouter>
    )
    return queryClient
}

describe('MessengerBindingsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.bindingsQuery.data = []
        mocks.create.mockResolvedValue(binding)
        mocks.update.mockResolvedValue(binding)
        mocks.release.mockResolvedValue(undefined)
        vi.mocked(listAliasesByApplication).mockResolvedValue([
            {
                id: 'alias-record-id',
                applicationId: binding.applicationId,
                alias: 'messenger-home',
                isPrimary: true,
                routingMode: 'canonical',
                status: 'active'
            }
        ])
    })

    it('creates a normalized bot connection through the existing settings surface', async () => {
        const user = userEvent.setup()
        renderPanel()

        const addButton = screen.getByRole('button', { name: 'Add bot connection' })
        await waitFor(() => expect(addButton).toBeEnabled())
        await user.click(addButton)
        await user.type(screen.getByRole('textbox', { name: 'Bot username' }), '@SupportTeam')
        await user.type(screen.getByRole('textbox', { name: 'Display name (optional)' }), 'Support')
        await user.click(screen.getByRole('button', { name: 'Save connection' }))

        expect(mocks.create).toHaveBeenCalledWith({ platform: 'telegram', botUsername: 'supportteam', displayName: 'Support' })
        expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Bot connection saved', { variant: 'success' })
    })

    it('blocks contact or credential data in the optional display name before making an API request', async () => {
        const user = userEvent.setup()
        renderPanel()

        await user.click(screen.getByRole('button', { name: 'Add bot connection' }))
        await user.type(screen.getByRole('textbox', { name: 'Bot username' }), 'supportbot')
        const displayName = screen.getByRole('textbox', { name: 'Display name (optional)' })
        await user.type(displayName, 'support@example.com')
        await user.click(screen.getByRole('button', { name: 'Save connection' }))

        expect(mocks.create).not.toHaveBeenCalled()
        expect(displayName).toHaveAttribute('aria-invalid', 'true')
        expect(screen.getByText('Use a short label only. Do not include contact details or credentials.')).toBeInTheDocument()
    })

    it('accepts the full 120-code-point label limit when supplementary characters use two UTF-16 units', async () => {
        const user = userEvent.setup()
        renderPanel()

        await user.click(screen.getByRole('button', { name: 'Add bot connection' }))
        await user.type(screen.getByRole('textbox', { name: 'Bot username' }), 'supportbot')
        const displayName = screen.getByRole('textbox', { name: 'Display name (optional)' })
        fireEvent.change(displayName, { target: { value: '😀'.repeat(120) } })
        await user.click(screen.getByRole('button', { name: 'Save connection' }))

        expect(mocks.create).toHaveBeenCalledWith({
            platform: 'telegram',
            botUsername: 'supportbot',
            displayName: '😀'.repeat(120)
        })
    })

    it('revalidates the username and clears stale validation feedback when the platform changes', async () => {
        const user = userEvent.setup()
        renderPanel()

        const addButton = screen.getByRole('button', { name: 'Add bot connection' })
        await waitFor(() => expect(addButton).toBeEnabled())
        await user.click(addButton)
        const platform = screen.getByRole('combobox', { name: 'Platform' })
        await user.click(platform)
        await user.click(screen.getByRole('option', { name: 'MAX', exact: true }))
        await user.type(screen.getByRole('textbox', { name: 'Bot username' }), '@invalidbot')
        await user.click(screen.getByRole('button', { name: 'Save connection' }))
        expect(await screen.findByText('MAX bot usernames must not contain @.')).toBeInTheDocument()

        await user.click(platform)
        await user.click(screen.getByRole('option', { name: 'Telegram', exact: true }))
        expect(screen.queryByText('MAX bot usernames must not contain @.')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Save connection' }))
        await waitFor(() => {
            expect(mocks.create).toHaveBeenCalledWith({ platform: 'telegram', botUsername: 'invalidbot' })
        })
    })

    it('localizes duplicate bot conflicts without showing the backend message', async () => {
        const user = userEvent.setup()
        mocks.create.mockRejectedValue({
            isAxiosError: true,
            response: { status: 409, data: { error: 'raw internal conflict text' } }
        })
        renderPanel()

        const addButton = screen.getByRole('button', { name: 'Add bot connection' })
        await waitFor(() => expect(addButton).toBeEnabled())
        await user.click(addButton)
        await user.type(screen.getByRole('textbox', { name: 'Bot username' }), 'supportbot')
        await user.click(screen.getByRole('button', { name: 'Save connection' }))

        expect(await screen.findByText('This bot is already connected to the application.')).toBeInTheDocument()
        expect(screen.queryByText('raw internal conflict text')).not.toBeInTheDocument()
    })

    it('rejects MAX usernames containing @ with a localized message', async () => {
        const user = userEvent.setup()
        renderPanel()

        const addButton = screen.getByRole('button', { name: 'Add bot connection' })
        await waitFor(() => expect(addButton).toBeEnabled())
        await user.click(addButton)
        await user.click(screen.getByRole('combobox', { name: 'Platform' }))
        await user.click(screen.getByRole('option', { name: 'MAX' }))
        expect(screen.getByRole('combobox', { name: 'Platform' })).toHaveTextContent('MAX')
        await user.type(screen.getByRole('textbox', { name: 'Bot username' }), '@maxhelper123')
        await user.click(screen.getByRole('button', { name: 'Save connection' }))

        expect(mocks.create).not.toHaveBeenCalled()
        expect(await screen.findByText('MAX bot usernames must not contain @.')).toBeInTheDocument()
    })

    it('shows localized created and updated timestamps on each connection card', () => {
        mocks.bindingsQuery.data = [binding]
        renderPanel()

        expect(screen.getByText(/^Created:/u)).toHaveTextContent('Created:')
        expect(screen.getByText(/^Updated:/u)).toHaveTextContent('Updated:')
        expect(screen.getByText(/^Created:/u).textContent).not.toMatch(/Invalid Date/u)
        expect(screen.getByText(/^Updated:/u).textContent).not.toMatch(/Invalid Date/u)
        expect(screen.queryByText(binding.id, { exact: true })).not.toBeInTheDocument()
        expect(screen.queryByText(binding.applicationId, { exact: true })).not.toBeInTheDocument()
    })

    it('keeps long bot names and usernames reviewable without exposing internal IDs', () => {
        const longUsername = 'very_long_support_bot_username'
        const longDisplayName = 'Customer support and billing questions'
        mocks.bindingsQuery.data = [{ ...binding, botUsername: longUsername, displayName: longDisplayName }]
        renderPanel()

        expect(screen.getByRole('heading', { name: `${longDisplayName} (@${longUsername})` })).toBeInTheDocument()
        expect(screen.getByRole('article')).toHaveAttribute('data-mobile-footer-stack', 'true')
        expect(screen.queryByText(binding.id, { exact: true })).not.toBeInTheDocument()
        expect(screen.queryByText(binding.applicationId, { exact: true })).not.toBeInTheDocument()
    })

    it('uses the primary public alias when the alias registry is available', async () => {
        vi.mocked(listAliasesByApplication).mockResolvedValue([
            {
                id: 'alias-record-id',
                applicationId: binding.applicationId,
                alias: 'messenger-home',
                isPrimary: true,
                routingMode: 'canonical',
                status: 'active'
            }
        ])
        const queryClient = renderPanel()

        await waitFor(() =>
            expect(queryClient.getQueryState(applicationAliasesQueryKeys.byApplication(binding.applicationId))?.status).toBe('success')
        )
        expect(screen.getByRole('textbox', { name: 'Web application address' })).toHaveValue(`${window.location.origin}/a/messenger-home`)
    })

    it('does not expose an internal Application UUID when alias lookup fails', async () => {
        vi.mocked(listAliasesByApplication).mockRejectedValue(new Error('Alias registry is not available to this user'))
        const queryClient = renderPanel()

        await waitFor(() =>
            expect(queryClient.getQueryState(applicationAliasesQueryKeys.byApplication(binding.applicationId))?.status).toBe('error')
        )
        expect(
            await screen.findByText('The primary public address could not be loaded. Retry before copying a Web App URL.')
        ).toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: 'Web application address' })).not.toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(binding.applicationId)
        expect(screen.queryByRole('link', { name: 'Manage public addresses' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add bot connection' })).toBeEnabled()
    })

    it('guides the operator to configure a primary public address without exposing the Application UUID', async () => {
        vi.mocked(listAliasesByApplication).mockResolvedValue([])
        const queryClient = renderPanel()

        await waitFor(() =>
            expect(queryClient.getQueryState(applicationAliasesQueryKeys.byApplication(binding.applicationId))?.status).toBe('success')
        )
        expect(
            await screen.findByText(
                'No primary public address is set. Ask a platform administrator to open this application’s Settings from the Applications list, choose Public addresses, and set a primary address. Then return here and retry.'
            )
        ).toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: 'Web application address' })).not.toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(binding.applicationId)
        expect(screen.queryByRole('link', { name: 'Manage public addresses' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Add bot connection' })).toBeEnabled()
    })

    it('does not render a public URL while the alias lookup is loading', async () => {
        let resolveAliases: ((value: Awaited<ReturnType<typeof listAliasesByApplication>>) => void) | undefined
        vi.mocked(listAliasesByApplication).mockReturnValue(
            new Promise((resolve) => {
                resolveAliases = resolve
            })
        )
        const queryClient = renderPanel()

        expect(screen.getByText('Checking for a primary public address...')).toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: 'Web application address' })).not.toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(binding.applicationId)
        expect(screen.getByRole('button', { name: 'Add bot connection' })).toBeEnabled()
        resolveAliases?.([])
        await waitFor(() =>
            expect(queryClient.getQueryState(applicationAliasesQueryKeys.byApplication(binding.applicationId))?.status).toBe('success')
        )
        expect(screen.queryByRole('textbox', { name: 'Web application address' })).not.toBeInTheDocument()
        expect(
            screen.getByText(
                'No primary public address is set. Ask a platform administrator to open this application’s Settings from the Applications list, choose Public addresses, and set a primary address. Then return here and retry.'
            )
        ).toBeInTheDocument()
    })

    it('disables bot setup for a closed application even when a public alias exists', async () => {
        render(
            <MemoryRouter>
                <QueryClientProvider
                    client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
                >
                    <MessengerBindingsPanel applicationId={binding.applicationId} isPublic={false} />
                </QueryClientProvider>
            </MemoryRouter>
        )

        await screen.findByRole('textbox', { name: 'Web application address' })
        expect(screen.getByRole('button', { name: 'Add bot connection' })).toBeDisabled()
    })

    it('updates a connection with its current version and the selected status', async () => {
        const user = userEvent.setup()
        mocks.bindingsQuery.data = [binding]
        renderPanel()

        await user.click(screen.getByRole('button', { name: 'Edit supportbot connection' }))
        await user.clear(screen.getByRole('textbox', { name: 'Bot username' }))
        await user.type(screen.getByRole('textbox', { name: 'Bot username' }), '@SupportTeam')
        await user.click(screen.getByRole('combobox', { name: 'Connection status' }))
        await user.click(screen.getByRole('option', { name: 'Disabled' }))
        await user.click(screen.getByRole('button', { name: 'Save connection' }))

        expect(mocks.update).toHaveBeenCalledWith({
            bindingId: binding.id,
            data: { botUsername: 'supportteam', displayName: 'Support', status: 'disabled', expectedVersion: binding.version }
        })
        expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Bot connection saved', { variant: 'success' })
    })

    it('copies the server-issued launch link and sends the current version on irreversible release', async () => {
        const user = userEvent.setup()
        mocks.bindingsQuery.data = [binding]
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        renderPanel()

        await user.click(screen.getByRole('button', { name: 'Copy Telegram launch link for supportbot' }))
        expect(writeText).toHaveBeenCalledWith('https://t.me/supportbot?startapp=aBcdefGhijkLmNopQrStUv')

        await user.click(screen.getByRole('button', { name: 'Release supportbot connection' }))
        await user.click(screen.getByRole('button', { name: 'Release connection' }))
        expect(mocks.release).toHaveBeenCalledWith({ bindingId: 'binding-uuid-internal', expectedVersion: 7 })
    })
})
