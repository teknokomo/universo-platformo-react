import React, { useState, useEffect, useCallback } from 'react'
import { Box, Button, Container, Step, StepLabel, Stepper, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { WelcomeStep } from './WelcomeStep'
import { SelectionStep } from './SelectionStep'
import { CompletionStep } from './CompletionStep'
import { getOnboardingItems, joinItems } from '../api/onboarding'
import type { OnboardingItems, OnboardingStep } from '../types'

const STEPS: OnboardingStep[] = ['welcome', 'projects', 'campaigns', 'clusters', 'completion']

interface OnboardingWizardProps {
    onComplete?: () => void
}

/**
 * OnboardingWizard - Multi-step wizard for new user onboarding
 *
 * Steps:
 * 1. Welcome - Introduction with image
 * 2. Projects (Global Goals) - Select global goals
 * 3. Campaigns (Personal Interests) - Select personal interests
 * 4. Clusters (Platform Features) - Select platform features
 * 5. Completion - Final message
 */
export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
    const { t } = useTranslation('onboarding')
    const [activeStep, setActiveStep] = useState(0)
    const [items, setItems] = useState<OnboardingItems | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Selection state
    const [selectedProjects, setSelectedProjects] = useState<string[]>([])
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
    const [selectedClusters, setSelectedClusters] = useState<string[]>([])

    // Load items on mount
    useEffect(() => {
        const loadItems = async () => {
            try {
                setIsLoading(true)
                setError(null)
                const data = await getOnboardingItems()
                setItems(data)

                // Initialize selections from already-selected items
                const projectsSelected = data.projects.filter((p) => p.isSelected).map((p) => p.id)
                const campaignsSelected = data.campaigns.filter((c) => c.isSelected).map((c) => c.id)
                const clustersSelected = data.clusters.filter((c) => c.isSelected).map((c) => c.id)

                // Auto-select first item if nothing is selected and items exist
                if (projectsSelected.length === 0 && data.projects.length > 0) {
                    projectsSelected.push(data.projects[0].id)
                }
                if (campaignsSelected.length === 0 && data.campaigns.length > 0) {
                    campaignsSelected.push(data.campaigns[0].id)
                }
                if (clustersSelected.length === 0 && data.clusters.length > 0) {
                    clustersSelected.push(data.clusters[0].id)
                }

                setSelectedProjects(projectsSelected)
                setSelectedCampaigns(campaignsSelected)
                setSelectedClusters(clustersSelected)
            } catch (err) {
                console.error('[OnboardingWizard] Failed to load items:', err)
                setError(t('errors.loadFailed'))
            } finally {
                setIsLoading(false)
            }
        }

        loadItems()
    }, [t])

    const handleNext = useCallback(async () => {
        const currentStepName = STEPS[activeStep]

        // Save all selections only when moving from the last selection step to completion
        // This prevents unintended side effects from syncing incomplete selections
        if (currentStepName === 'clusters') {
            try {
                setIsSaving(true)
                setError(null)
                await joinItems({
                    projectIds: selectedProjects,
                    campaignIds: selectedCampaigns,
                    clusterIds: selectedClusters
                })
                // Onboarding completed successfully - notify parent
                // (still proceed to completion step for user to see the final message)
            } catch (err) {
                console.error('[OnboardingWizard] Failed to save selections:', err)
                setError(t('errors.saveFailed'))
                setIsSaving(false)
                return // Do not proceed if save fails
            } finally {
                setIsSaving(false)
            }
        }

        // Move to next step
        if (activeStep < STEPS.length - 1) {
            setActiveStep((prev) => prev + 1)
            // If we just moved to completion step, notify parent that onboarding is done
            if (STEPS[activeStep + 1] === 'completion' && onComplete) {
                onComplete()
            }
        }
    }, [activeStep, selectedProjects, selectedCampaigns, selectedClusters, onComplete, t])

    const handleBack = useCallback(() => {
        if (activeStep > 0) {
            setActiveStep((prev) => prev - 1)
        }
    }, [activeStep])

    const handleStartOver = useCallback(() => {
        setActiveStep(0)
    }, [])

    const currentStep = STEPS[activeStep]

    const renderStepContent = () => {
        if (isLoading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            )
        }

        switch (currentStep) {
            case 'welcome':
                return <WelcomeStep />
            case 'projects':
                return (
                    <SelectionStep
                        title={t('steps.projects.title')}
                        subtitle={t('steps.projects.subtitle')}
                        items={items?.projects || []}
                        selectedIds={selectedProjects}
                        onSelectionChange={setSelectedProjects}
                    />
                )
            case 'campaigns':
                return (
                    <SelectionStep
                        title={t('steps.campaigns.title')}
                        subtitle={t('steps.campaigns.subtitle')}
                        items={items?.campaigns || []}
                        selectedIds={selectedCampaigns}
                        onSelectionChange={setSelectedCampaigns}
                    />
                )
            case 'clusters':
                return (
                    <SelectionStep
                        title={t('steps.clusters.title')}
                        subtitle={t('steps.clusters.subtitle')}
                        items={items?.clusters || []}
                        selectedIds={selectedClusters}
                        onSelectionChange={setSelectedClusters}
                    />
                )
            case 'completion':
                return <CompletionStep />
            default:
                return null
        }
    }

    const stepLabels = [
        t('steps.welcome.label'),
        t('steps.projects.label'),
        t('steps.campaigns.label'),
        t('steps.clusters.label'),
        t('steps.completion.label')
    ]

    return (
        <Container maxWidth="md" sx={{ pt: { xs: 14, sm: 4 }, pb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 }, overflow: 'hidden' }}>
            {/* Stepper - hide labels on mobile to prevent overflow */}
            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: { xs: 2, sm: 4 }, display: { xs: 'none', sm: 'flex' } }}>
                {stepLabels.map((label, index) => (
                    <Step key={index}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {/* Error message */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Step content */}
            <Box sx={{ minHeight: { xs: 'auto', sm: 400 } }}>{renderStepContent()}</Box>

            {/* Navigation buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: { xs: 2, sm: 4 }, pb: { xs: 2, sm: 0 } }}>
                {activeStep === 0 ? (
                    <Box /> // Empty placeholder for first step
                ) : (
                    <Button onClick={handleBack} disabled={isSaving} variant="outlined">
                        {t('buttons.back')}
                    </Button>
                )}
                {activeStep === STEPS.length - 1 ? (
                    <Button onClick={handleStartOver} variant="contained" color="primary">
                        {t('buttons.startOver')}
                    </Button>
                ) : (
                    <Button onClick={handleNext} disabled={isLoading || isSaving} variant="contained" color="primary">
                        {isSaving ? <CircularProgress size={24} color="inherit" /> : t('buttons.next')}
                    </Button>
                )}
            </Box>
        </Container>
    )
}
