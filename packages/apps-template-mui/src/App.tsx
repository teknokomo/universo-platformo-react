import { useEffect, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import DashboardApp from './standalone/DashboardApp'
import GuestApp from './standalone/GuestApp'
// Side-effect: register i18n namespace
import './i18n'

function resolveStandaloneLocation() {
    if (typeof window === 'undefined') {
        return {
            guestRouteSource: '',
            runtimeRouteSource: ''
        }
    }

    return {
        guestRouteSource: `${window.location.pathname}${window.location.hash}`,
        runtimeRouteSource: window.location.hash || window.location.pathname
    }
}

function resolveStandaloneLocale() {
    if (typeof window === 'undefined') {
        return 'en'
    }

    const explicitLocale = new URL(window.location.href).searchParams.get('locale')
    const storedLocale = window.localStorage.getItem('i18nextLng')
    const candidates = [explicitLocale, storedLocale, window.document.documentElement.lang, window.navigator.language, 'en']
    for (const candidate of candidates) {
        if (typeof candidate !== 'string') continue
        const normalized = candidate.trim().slice(0, 2).toLowerCase()
        if (/^[a-z]{2}$/.test(normalized)) {
            return normalized
        }
    }

    return 'en'
}

export default function App() {
    const { i18n } = useTranslation('apps')
    const queryClient = useMemo(() => new QueryClient(), [])
    const locationState = useMemo(resolveStandaloneLocation, [])
    const locale = useMemo(resolveStandaloneLocale, [])

    // Standalone dev entry: applicationId is required; you can provide it via URL hash for quick testing.
    // Example: http://localhost:5174/#/a/<uuid>
    const applicationId = useMemo(() => {
        const match = locationState.runtimeRouteSource.match(/\/a\/([0-9a-fA-F-]{16,})/)
        return match?.[1] ?? ''
    }, [locationState.runtimeRouteSource])
    const isGuestRoute = useMemo(() => {
        return /\/public\/a\/[0-9a-fA-F-]{16,}\/links\/[^/?#]+/.test(locationState.guestRouteSource)
    }, [locationState.guestRouteSource])

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale
        }

        if ((i18n.resolvedLanguage || i18n.language)?.slice(0, 2).toLowerCase() !== locale) {
            void i18n.changeLanguage(locale)
        }
    }, [i18n, locale])

    return (
        <QueryClientProvider client={queryClient}>
            {isGuestRoute ? (
                <GuestApp locale={locale} apiBaseUrl='/api/v1' />
            ) : (
                <DashboardApp applicationId={applicationId} locale={locale} apiBaseUrl='/api/v1' />
            )}
        </QueryClientProvider>
    )
}
