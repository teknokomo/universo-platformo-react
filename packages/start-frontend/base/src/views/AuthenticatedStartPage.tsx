/**
 * AuthenticatedStartPage - Onboarding wizard for new authenticated users
 *
 * Displays a multi-step wizard to help users select their interests:
 * - Projects (Global Goals)
 * - Campaigns (Personal Interests)
 * - Clusters (Platform Features)
 *
 * If onboarding is already completed, shows the CompletionStep directly.
 * Footer with contact information is shown at the bottom.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import CircularProgress from '@mui/material/CircularProgress'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { CompletionStep } from '../components/CompletionStep'
import { StartFooter } from '../components/StartFooter'
import { getOnboardingItems } from '../api/onboarding'

export default function AuthenticatedStartPage() {
    const [isReady, setIsReady] = useState(false)
    const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)

    // Check onboarding status on mount
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const data = await getOnboardingItems()
                setOnboardingCompleted(data.onboardingCompleted)
            } catch (err) {
                console.error('[AuthenticatedStartPage] Failed to check onboarding status, defaulting to show wizard:', err)
                // Default to showing wizard on error (intentional UX fallback)
                setOnboardingCompleted(false)
            }
            setIsReady(true)
        }
        checkStatus()
    }, [])

    // Show loading while checking status
    if (!isReady) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        )
    }

    // Show completion screen if already onboarded
    if (onboardingCompleted) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Box sx={{ flex: 1 }}>
                    <Container maxWidth='md' sx={{ pt: { xs: 14, sm: 14 }, pb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
                        <CompletionStep onStartOver={() => setOnboardingCompleted(false)} />
                    </Container>
                </Box>
                <StartFooter variant='internal' />
            </Box>
        )
    }

    // Show wizard for users who haven't completed onboarding
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Box sx={{ flex: 1 }}>
                <OnboardingWizard onComplete={() => setOnboardingCompleted(true)} />
            </Box>
            <StartFooter variant='internal' />
        </Box>
    )
}
