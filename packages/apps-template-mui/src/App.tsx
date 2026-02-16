import { useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardApp from './standalone/DashboardApp'
// Side-effect: register i18n namespace
import './i18n'

export default function App() {
    const queryClient = useMemo(() => new QueryClient(), [])

    // Standalone dev entry: applicationId is required; you can provide it via URL hash for quick testing.
    // Example: http://localhost:5174/#/a/<uuid>
    const applicationId = useMemo(() => {
        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        const match = hash.match(/\/a\/([0-9a-fA-F-]{16,})/)
        return match?.[1] ?? ''
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            <DashboardApp applicationId={applicationId} locale='ru' apiBaseUrl='/api/v1' />
        </QueryClientProvider>
    )
}
