/**
 * AuthenticatedStartPage - Onboarding wizard for new authenticated users
 *
 * Displays a multi-step wizard to help users select their interests:
 * - Projects (Global Goals)
 * - Campaigns (Personal Interests)
 * - Clusters (Platform Features)
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { registerOnboardingI18n } from '../i18n/register'

export default function AuthenticatedStartPage() {
    const { i18n } = useTranslation()
    const [isReady, setIsReady] = useState(false)

    // Register onboarding i18n resources on mount - synchronously before render
    useEffect(() => {
        registerOnboardingI18n(i18n)
        setIsReady(true)
    }, [i18n])

    // Wait for i18n to be registered before rendering wizard
    if (!isReady) {
        return null
    }

    return <OnboardingWizard />
}
