import React, { useState, useEffect, useCallback } from 'react'
import { Box, Button, Container, Step, StepLabel, Stepper, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { WelcomeStep } from './WelcomeStep'
import { SelectionStep } from './SelectionStep'
import { CompletionStep } from './CompletionStep'
import { getOnboardingItems, syncSelections } from '../api/onboarding'
import type { OnboardingItems, OnboardingStep } from '../types'

const STEPS: OnboardingStep[] = ['welcome', 'goals', 'topics', 'features', 'completion']

interface OnboardingWizardProps {
    initialItems?: OnboardingItems | null
    onComplete?: () => Promise<void> | void
    completionLoading?: boolean
    completionError?: string | null
}

const buildInitialSelections = (data: OnboardingItems): { goals: string[]; topics: string[]; features: string[] } => {
    const goals = data.goals.filter((item) => item.isSelected).map((item) => item.id)
    const topics = data.topics.filter((item) => item.isSelected).map((item) => item.id)
    const features = data.features.filter((item) => item.isSelected).map((item) => item.id)

    if (goals.length === 0 && data.goals.length > 0) {
        goals.push(data.goals[0].id)
    }
    if (topics.length === 0 && data.topics.length > 0) {
        topics.push(data.topics[0].id)
    }
    if (features.length === 0 && data.features.length > 0) {
        features.push(data.features[0].id)
    }

    return { goals, topics, features }
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
    initialItems = null,
    onComplete,
    completionLoading = false,
    completionError = null
}) => {
    const { t } = useTranslation('onboarding')
    const [activeStep, setActiveStep] = useState(0)
    const [items, setItems] = useState<OnboardingItems | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Selection state
    const [selectedGoals, setSelectedGoals] = useState<string[]>([])
    const [selectedTopics, setSelectedTopics] = useState<string[]>([])
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])

    // Load items on mount
    useEffect(() => {
        const loadItems = async () => {
            try {
                setIsLoading(true)
                setError(null)
                const data = initialItems ?? (await getOnboardingItems())
                const selections = buildInitialSelections(data)

                setItems(data)
                setSelectedGoals(selections.goals)
                setSelectedTopics(selections.topics)
                setSelectedFeatures(selections.features)
            } catch (err) {
                console.error('[OnboardingWizard] Failed to load items:', err)
                setError(t('errors.loadFailed'))
            } finally {
                setIsLoading(false)
            }
        }

        loadItems()
    }, [initialItems, t])

    const handleNext = useCallback(async () => {
        const currentStepName = STEPS[activeStep]

        // Save selections before entering the completion step.
        if (currentStepName === 'features') {
            try {
                setIsSaving(true)
                setError(null)
                await syncSelections({
                    goals: selectedGoals,
                    topics: selectedTopics,
                    features: selectedFeatures
                })
            } catch (err) {
                console.error('[OnboardingWizard] Failed to save selections:', err)
                setError(t('errors.saveFailed'))
                setIsSaving(false)
                return
            } finally {
                setIsSaving(false)
            }
        }

        if (activeStep < STEPS.length - 1) {
            setActiveStep((prev) => prev + 1)
        }
    }, [activeStep, selectedGoals, selectedTopics, selectedFeatures, t])

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
            case 'goals':
                return (
                    <SelectionStep
                        title={t('steps.goals.title')}
                        subtitle={t('steps.goals.subtitle')}
                        items={items?.goals || []}
                        selectedIds={selectedGoals}
                        onSelectionChange={setSelectedGoals}
                    />
                )
            case 'topics':
                return (
                    <SelectionStep
                        title={t('steps.topics.title')}
                        subtitle={t('steps.topics.subtitle')}
                        items={items?.topics || []}
                        selectedIds={selectedTopics}
                        onSelectionChange={setSelectedTopics}
                    />
                )
            case 'features':
                return (
                    <SelectionStep
                        title={t('steps.features.title')}
                        subtitle={t('steps.features.subtitle')}
                        items={items?.features || []}
                        selectedIds={selectedFeatures}
                        onSelectionChange={setSelectedFeatures}
                    />
                )
            case 'completion':
                return <CompletionStep primaryActionLoading={completionLoading} error={completionError} />
            default:
                return null
        }
    }

    const stepLabels = [
        t('steps.welcome.label'),
        t('steps.goals.label'),
        t('steps.topics.label'),
        t('steps.features.label'),
        t('steps.completion.label')
    ]

    return (
        <Container maxWidth='md' sx={{ pt: { xs: 14, sm: 4 }, pb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 }, overflow: 'hidden' }}>
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
                <Alert severity='error' sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Step content */}
            <Box sx={{ minHeight: { xs: 'auto', sm: 400 } }}>{renderStepContent()}</Box>

            {/* Navigation buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: { xs: 2, sm: 4 }, pb: { xs: 2, sm: 0 } }}>
                {activeStep === STEPS.length - 1 ? (
                    // Completion step: Start Over (left) + Start Acting (right)
                    <>
                        <Button onClick={handleStartOver} variant='outlined' color='primary' disabled={completionLoading}>
                            {t('buttons.startOver')}
                        </Button>
                        <Button
                            onClick={onComplete}
                            variant='contained'
                            color='primary'
                            disabled={completionLoading || !onComplete}
                            startIcon={completionLoading ? <CircularProgress size={16} color='inherit' /> : null}
                        >
                            {t('buttons.startActing')}
                        </Button>
                    </>
                ) : (
                    <>
                        {activeStep === 0 ? (
                            <Box /> // Empty placeholder for first step
                        ) : (
                            <Button onClick={handleBack} disabled={isSaving} variant='outlined'>
                                {t('buttons.back')}
                            </Button>
                        )}
                        <Button onClick={handleNext} disabled={isLoading || isSaving} variant='contained' color='primary'>
                            {isSaving ? <CircularProgress size={24} color='inherit' /> : t('buttons.next')}
                        </Button>
                    </>
                )}
            </Box>
        </Container>
    )
}
