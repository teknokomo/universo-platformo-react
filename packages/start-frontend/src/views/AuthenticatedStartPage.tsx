/**
 * AuthenticatedStartPage - Onboarding wizard for new authenticated users
 *
 * Prefetches onboarding data once to decide whether the user should see the
 * completion state or continue the onboarding flow with preloaded catalog items.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from '@universo/auth-frontend'
import { useAbility } from '@universo/store'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { CompletionStep } from '../components/CompletionStep'
import { StartFooter } from '../components/StartFooter'
import { completeOnboarding, getOnboardingItems } from '../api/onboarding'

export default function AuthenticatedStartPage() {
    const navigate = useNavigate()
    const { refresh } = useAuth()
    const { refreshAbility } = useAbility()
    const [isReady, setIsReady] = useState(false)
    const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)
    const [prefetchedItems, setPrefetchedItems] = useState<Awaited<ReturnType<typeof getOnboardingItems>> | null>(null)
    const [isCompleting, setIsCompleting] = useState(false)
    const [completionError, setCompletionError] = useState<string | null>(null)

    // Check onboarding status on mount
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const data = await getOnboardingItems()
                setPrefetchedItems(data)
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

    const handleCompletionAction = useCallback(async () => {
        setIsCompleting(true)
        setCompletionError(null)

        try {
            if (!onboardingCompleted) {
                const result = await completeOnboarding()
                setOnboardingCompleted(result.onboardingCompleted)
            }

            await refresh()
            await refreshAbility()
            navigate('/', { replace: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to complete onboarding'
            setCompletionError(message)
        } finally {
            setIsCompleting(false)
        }
    }, [onboardingCompleted, refresh, refreshAbility, navigate])

    const handleStartOver = useCallback(() => {
        setCompletionError(null)
        setOnboardingCompleted(false)
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
                    <Container maxWidth='md' sx={{ pt: { xs: 2, sm: 14 }, pb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
                        <CompletionStep
                            onStartOver={handleStartOver}
                            onPrimaryAction={handleCompletionAction}
                            primaryActionLoading={isCompleting}
                            error={completionError}
                        />
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
                <OnboardingWizard
                    initialItems={prefetchedItems}
                    onComplete={handleCompletionAction}
                    completionLoading={isCompleting}
                    completionError={completionError}
                />
            </Box>
            <StartFooter variant='internal' />
        </Box>
    )
}
