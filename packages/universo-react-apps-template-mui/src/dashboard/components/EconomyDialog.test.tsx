import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInstance } from 'i18next'
import { initReactI18next, I18nextProvider } from 'react-i18next'
import type { EconomySummary } from '@universo-react/types'
import { AppsApiError } from '../../api/client'
import EconomyDialog from './EconomyDialog'
import { DashboardDetailsProvider } from '../DashboardDetailsContext'
import enApps from '../../i18n/locales/en/apps.json'
import ruApps from '../../i18n/locales/ru/apps.json'

const apiMocks = vi.hoisted(() => ({
    fetchRuntimeEconomySummary: vi.fn(),
    postEconomyTrade: vi.fn()
}))

vi.mock('../../api/api', () => ({
    fetchRuntimeEconomySummary: apiMocks.fetchRuntimeEconomySummary,
    postEconomyTrade: apiMocks.postEconomyTrade
}))

const i18n = createInstance()

beforeAll(async () => {
    await i18n.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: 'en',
        resources: { en: { apps: enApps }, ru: { apps: ruApps } },
        interpolation: { escapeValue: false }
    })
})

const stationSummary: EconomySummary = {
    wallet: { currency: 'CR', balance: 1000 },
    cargo: [{ nomenclatureCode: 'ORE', nomenclatureName: 'Iron Ore', quantity: 10, unit: 'Kg', massKg: 10 }],
    capacity: { usedKg: 10, maxKg: 100 },
    market: [
        { nomenclatureCode: 'ORE', nomenclatureName: 'Iron Ore', side: 'sell', price: 10, unit: 'Kg' },
        { nomenclatureCode: 'FUEL', nomenclatureName: 'Fuel', side: 'buy', price: 5, unit: 'Liter' }
    ],
    operations: [
        {
            id: '018f8a78-7b8f-7c1d-8111-2222333344e1',
            type: 'StarterGrant',
            quantity: 1000,
            total: 1000,
            occurredAt: '2026-11-12T10:00:00.000Z'
        }
    ],
    atStation: true,
    stationName: 'Dock Alpha'
}

const buildDetails = (overrides: Record<string, unknown> = {}) => ({
    title: 'Flight',
    applicationId: 'app-1',
    apiBaseUrl: '/api/v1',
    locale: 'en',
    runtimeAccessMode: 'member',
    permissions: { editContent: true },
    runtimeQueryKeyPrefix: ['runtime'],
    currentWorkspaceId: 'ws-1',
    ...overrides
})

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const renderPanel = (detailsOverrides: Record<string, unknown> = {}, options: { open?: boolean } = {}) => {
    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const onCloseSpy = vi.fn()
    render(
        <QueryClientProvider client={queryClient}>
            <I18nextProvider i18n={i18n}>
                <DashboardDetailsProvider value={buildDetails(detailsOverrides) as never}>
                    <EconomyDialog open={options.open ?? true} onClose={onCloseSpy} />
                </DashboardDetailsProvider>
            </I18nextProvider>
        </QueryClientProvider>
    )
    return { queryClient, invalidateSpy, onCloseSpy }
}

const typeQuantity = async (side: 'sell' | 'buy', value: string) => {
    const user = userEvent.setup()
    const field = screen.getByTestId(`economy-${side}-quantity`) as HTMLInputElement
    await user.type(field, value)
    return user
}

describe('EconomyDialog', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        await act(async () => {
            await i18n.changeLanguage('en')
        })
    })

    it('renders wallet, cargo, capacity, market and operations sections from the summary payload', async () => {
        apiMocks.fetchRuntimeEconomySummary.mockResolvedValue(stationSummary)
        renderPanel()

        expect(await screen.findByTestId('economy-panel')).toBeInTheDocument()
        expect(screen.getByTestId('economy-balance')).toHaveTextContent('1,000 CR')
        expect(screen.getByTestId('economy-cargo-list')).toHaveTextContent('Ore')
        expect(screen.getByTestId('economy-capacity-bar')).toBeInTheDocument()
        expect(screen.getByText('Used 10 of 100 kg')).toBeInTheDocument()
        expect(screen.getByTestId('economy-market-list')).toHaveTextContent('Sell · 10 / Kg')
        expect(screen.getByTestId('economy-market-list')).toHaveTextContent('Buy · 5 / Liter')
        expect(screen.getByTestId('economy-sell-quantity')).toBeInTheDocument()
        expect(screen.getByTestId('economy-sell-button')).toBeInTheDocument()
        expect(screen.getByTestId('economy-buy-quantity')).toBeInTheDocument()
        expect(screen.getByTestId('economy-buy-button')).toBeInTheDocument()
        expect(screen.getByTestId('economy-operations-list')).toHaveTextContent('Starter grant')
        expect(screen.getByText('Docked at Dock Alpha. Market is available.')).toBeInTheDocument()

        // No raw IDs or codes on user surfaces — names come from the payload.
        expect(screen.queryByText(/ORE/)).not.toBeInTheDocument()
        expect(screen.queryByText(/018f8a78/)).not.toBeInTheDocument()
    })

    it('disables trade buttons while the ship is away from a station', async () => {
        apiMocks.fetchRuntimeEconomySummary.mockResolvedValue({ ...stationSummary, atStation: false, stationName: null })
        renderPanel()

        await screen.findByTestId('economy-panel')
        await typeQuantity('sell', '2')
        expect(screen.getByTestId('economy-sell-button')).toBeDisabled()
        expect(screen.getByTestId('economy-buy-button')).toBeDisabled()
        expect(screen.queryByText('Docked at Dock Alpha. Market is available.')).not.toBeInTheDocument()
        expect(apiMocks.postEconomyTrade).not.toHaveBeenCalled()
    })

    it('maps trade error codes to the localized Russian message', async () => {
        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        apiMocks.fetchRuntimeEconomySummary.mockResolvedValue(stationSummary)
        apiMocks.postEconomyTrade.mockRejectedValue(new AppsApiError('Not enough funds to buy', 409, 'ECONOMY_INSUFFICIENT_FUNDS'))
        renderPanel({ locale: 'ru' })

        await screen.findByTestId('economy-panel')
        const user = await typeQuantity('buy', '1')
        await user.click(screen.getByTestId('economy-buy-button'))

        expect(await screen.findByTestId('economy-error')).toHaveTextContent('На кошельке недостаточно средств для этой покупки.')
        expect(apiMocks.postEconomyTrade).toHaveBeenCalledTimes(1)
    })

    it('disables trade buttons when edit permissions are denied', async () => {
        apiMocks.fetchRuntimeEconomySummary.mockResolvedValue(stationSummary)
        renderPanel({ permissions: { editContent: false } })

        await screen.findByTestId('economy-panel')
        await typeQuantity('sell', '2')
        expect(screen.getByTestId('economy-sell-button')).toBeDisabled()
        expect(screen.getByTestId('economy-buy-button')).toBeDisabled()
    })

    it('posts the trade with an idempotency key, invalidates the summary and never shows raw ids', async () => {
        apiMocks.fetchRuntimeEconomySummary.mockResolvedValue(stationSummary)
        apiMocks.postEconomyTrade.mockResolvedValue({
            operationId: '018f8a78-7b8f-7c1d-8111-2222333344e2',
            walletBalance: 1050,
            cargo: [{ nomenclatureCode: 'ORE', nomenclatureName: 'Iron Ore', quantity: 5, unit: 'Kg', massKg: 5 }]
        })
        const { invalidateSpy } = renderPanel()

        await screen.findByTestId('economy-panel')
        const user = await typeQuantity('sell', '5')
        await user.click(screen.getByTestId('economy-sell-button'))

        await waitFor(() =>
            expect(apiMocks.postEconomyTrade).toHaveBeenCalledWith('/api/v1', 'app-1', 'sell', expect.anything(), expect.any(String))
        )
        const [, , kind, body, idempotencyKey] = apiMocks.postEconomyTrade.mock.calls[0] as [
            string,
            string,
            string,
            Record<string, unknown>,
            string
        ]
        expect(kind).toBe('sell')
        expect(body.nomenclatureCode).toBe('ORE')
        expect(body.quantity).toBe(5)
        expect(idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)

        await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['runtime', 'economy-summary'] }))
        expect(await screen.findByText('Trade completed.')).toBeInTheDocument()

        // Success surfaces stay name-based: no operation ids, no nomenclature codes.
        expect(screen.queryByText(/018f8a78/)).not.toBeInTheDocument()
        expect(screen.queryByText(/ORE/)).not.toBeInTheDocument()
        expect(screen.getByTestId('economy-cargo-list')).toHaveTextContent('Ore')
    })

    it('closes through the visible Close action (strict-modal contract)', async () => {
        apiMocks.fetchRuntimeEconomySummary.mockResolvedValue(stationSummary)
        const { onCloseSpy } = renderPanel()

        await screen.findByTestId('economy-panel')
        const user = userEvent.setup()
        await user.click(screen.getByTestId('economy-dialog-close'))
        expect(onCloseSpy).toHaveBeenCalledTimes(1)
    })

    it('renders permission-denied without fetching in public runtime mode', async () => {
        renderPanel({ runtimeAccessMode: 'public' })

        expect(screen.getByTestId('economy-panel')).toBeInTheDocument()
        expect(screen.getByText('You do not have access to this content.')).toBeInTheDocument()
        expect(apiMocks.fetchRuntimeEconomySummary).not.toHaveBeenCalled()
        expect(screen.queryByTestId('economy-balance')).not.toBeInTheDocument()
    })

    it('does not fetch the summary while the dialog is closed', async () => {
        renderPanel({}, { open: false })

        // The query is disabled while closed — no request, no content.
        expect(apiMocks.fetchRuntimeEconomySummary).not.toHaveBeenCalled()
        expect(screen.queryByTestId('economy-balance')).not.toBeInTheDocument()
    })
})
