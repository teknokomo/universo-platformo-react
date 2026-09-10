import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
    initReactI18next: {
        type: '3rdParty',
        init: () => undefined
    },
    useTranslation: () => ({
        i18n: {
            language: 'en',
            resolvedLanguage: 'en',
            changeLanguage: vi.fn().mockResolvedValue(undefined)
        }
    })
}))

vi.mock('../standalone/DashboardApp', () => ({
    default: ({ applicationId, locale }: { applicationId: string; locale: string }) => (
        <div>
            dashboard:{applicationId}:{locale}
        </div>
    )
}))

vi.mock('../standalone/GuestApp', () => ({
    default: ({ locale }: { locale: string }) => <div>guest-app:{locale}</div>
}))

import App from '../App'

describe('App', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/')
        window.localStorage.clear()
    })

    it('renders the guest runtime for direct public pathname routes', () => {
        window.history.replaceState({}, '', '/public/a/018f8a78-7b8f-7c1d-a111-222233334444/links/demo-content')

        render(<App />)

        expect(screen.getByText('guest-app:en')).toBeInTheDocument()
    })

    it('falls back to the dashboard runtime for hash-based application routes', () => {
        window.history.replaceState({}, '', '/#/a/018f8a78-7b8f-7c1d-a111-222233334445')

        render(<App />)

        expect(screen.getByText('dashboard:018f8a78-7b8f-7c1d-a111-222233334445:en')).toBeInTheDocument()
    })

    it('prefers the explicit standalone locale from the URL before browser defaults', () => {
        window.localStorage.setItem('i18nextLng', 'en')
        window.history.replaceState({}, '', '/public/a/018f8a78-7b8f-7c1d-a111-222233334444/links/demo-content?locale=ru')

        render(<App />)

        expect(screen.getByText('guest-app:ru')).toBeInTheDocument()
    })

    it('uses the persisted i18next locale for standalone guest routes when no explicit query is provided', () => {
        window.localStorage.setItem('i18nextLng', 'ru')
        window.history.replaceState({}, '', '/public/a/018f8a78-7b8f-7c1d-a111-222233334444/links/demo-content')

        render(<App />)

        expect(screen.getByText('guest-app:ru')).toBeInTheDocument()
    })

    it('recomputes the standalone hash route when its locale changes without a reload', async () => {
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334445'
        window.history.replaceState({}, '', `/#/a/${applicationId}?locale=en`)

        render(<App />)
        expect(screen.getByText(`dashboard:${applicationId}:en`)).toBeInTheDocument()

        act(() => {
            window.history.pushState({}, '', `/#/a/${applicationId}?locale=ru`)
            window.dispatchEvent(new PopStateEvent('popstate'))
        })

        await waitFor(() => {
            expect(screen.getByText(`dashboard:${applicationId}:ru`)).toBeInTheDocument()
        })
    })
})
