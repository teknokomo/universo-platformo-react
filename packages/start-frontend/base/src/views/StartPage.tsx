/**
 * StartPage - Conditional start page based on authentication status
 *
 * Shows:
 * - GuestStartPage for non-authenticated users (landing with testimonials)
 * - AuthenticatedStartPage for authenticated users (onboarding wizard)
 */
import { useAuth } from '@universo/auth-frontend'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import GuestStartPage from './GuestStartPage'
import AuthenticatedStartPage from './AuthenticatedStartPage'

// Simple loader component
function Loader() {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh'
            }}
        >
            <CircularProgress />
        </Box>
    )
}

export default function StartPage() {
    const { isAuthenticated, loading } = useAuth()

    // Show loader while checking authentication status
    if (loading) {
        return <Loader />
    }

    // Render appropriate page based on authentication status
    return isAuthenticated ? <AuthenticatedStartPage /> : <GuestStartPage />
}
