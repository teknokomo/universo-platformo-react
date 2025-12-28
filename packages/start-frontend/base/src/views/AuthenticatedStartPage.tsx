/**
 * AuthenticatedStartPage - Onboarding wizard for new authenticated users
 *
 * Displays a multi-step wizard to help users select their interests:
 * - Projects (Global Goals)
 * - Campaigns (Personal Interests)
 * - Clusters (Platform Features)
 *
 * If onboarding is already completed, shows the CompletionStep directly.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { CompletionStep } from '../components/CompletionStep'
import { getOnboardingItems } from '../api/onboarding'
import { registerOnboardingI18n } from '../i18n/register'

export default function AuthenticatedStartPage() {
    const { i18n } = useTranslation()
    const [isReady, setIsReady] = useState(false)
    const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)

    // Register onboarding i18n resources and check status on mount
    useEffect(() => {
        registerOnboardingI18n(i18n)

        const checkStatus = async () => {
            try {
                const data = await getOnboardingItems()
                setOnboardingCompleted(data.onboardingCompleted)
            } catch (err) {
                console.error(
                    '[AuthenticatedStartPage] Failed to check onboarding status, defaulting to show wizard:',
                    err
                )
                // Default to showing wizard on error (intentional UX fallback)
                setOnboardingCompleted(false)
            }
            setIsReady(true)
        }
        checkStatus()
    }, [i18n])

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
            <Container maxWidth="md" sx={{ pt: { xs: 14, sm: 14 }, pb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
                <CompletionStep onStartOver={() => setOnboardingCompleted(false)} />
            </Container>
        )
    }

    // Show wizard for users who haven't completed onboarding
    return <OnboardingWizard onComplete={() => setOnboardingCompleted(true)} />
}
