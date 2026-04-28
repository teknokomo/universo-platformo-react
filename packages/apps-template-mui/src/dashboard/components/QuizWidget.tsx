import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Chip,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    LinearProgress,
    Radio,
    RadioGroup,
    Stack,
    Typography
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { type QuizWidgetConfig } from '@universo/types'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { executeClientScriptMethod } from '../runtime/browserScriptRuntime'
import {
    createClientScriptContext,
    fetchRuntimeClientBundle,
    fetchRuntimeScripts,
    isClientScriptMethodTarget
} from './runtimeWidgetHelpers'

type QuizOption = {
    id: string
    label: string
}

type QuizQuestion = {
    id: string
    prompt: string
    description?: string
    multiple?: boolean
    difficulty?: number
    options: QuizOption[]
}

type QuizModel = {
    title: string
    description?: string
    submitLabel?: string
    nextLabel?: string
    questions: QuizQuestion[]
}

type QuizSubmissionResult = {
    questionId?: string
    correct?: boolean
    explanation?: string
    score?: number
    total?: number
    message?: string
    completed?: boolean
    correctOptionIds?: Record<string, string[]>
}

type QuizSubmissionPacket = {
    result: QuizSubmissionResult | null
    responses: Record<string, string[]>
}

const AUTO_ADVANCE_DELAY_MS = 1200

const readString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const readNumber = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

const normalizeQuizModel = (value: unknown, fallbackTitle: string): QuizModel | null => {
    if (!value || typeof value !== 'object') {
        return null
    }

    const source = value as Record<string, unknown>
    const rawQuestions = Array.isArray(source.questions) ? source.questions : Array.isArray(value) ? (value as unknown[]) : []
    const questions: QuizQuestion[] = rawQuestions.flatMap((question, index) => {
        if (!question || typeof question !== 'object') {
            return []
        }

        const rawQuestion = question as Record<string, unknown>
        const rawOptions = Array.isArray(rawQuestion.options) ? rawQuestion.options : []
        const options = rawOptions
            .map((option, optionIndex) => {
                if (!option || typeof option !== 'object') {
                    return null
                }

                const rawOption = option as Record<string, unknown>
                const label = readString(rawOption.label, readString(rawOption.title, ''))
                if (!label) {
                    return null
                }

                return {
                    id: readString(rawOption.id, `option-${index}-${optionIndex}`),
                    label
                } satisfies QuizOption
            })
            .filter((option): option is QuizOption => Boolean(option))

        const prompt = readString(rawQuestion.prompt, readString(rawQuestion.question, ''))
        if (!prompt || options.length === 0) {
            return []
        }

        return [
            {
                id: readString(rawQuestion.id, `question-${index}`),
                prompt,
                description: readString(rawQuestion.description, ''),
                multiple: Boolean(rawQuestion.multiple),
                difficulty: readNumber(rawQuestion.difficulty, 0) || undefined,
                options
            }
        ]
    })

    if (questions.length === 0) {
        return null
    }

    return {
        title: readString(source.title, fallbackTitle),
        description: readString(source.description, ''),
        submitLabel: readString(source.submitLabel, ''),
        nextLabel: readString(source.nextLabel, ''),
        questions
    }
}

const normalizeSubmissionResult = (value: unknown): QuizSubmissionResult | null => {
    if (!value || typeof value !== 'object') {
        return null
    }

    const source = value as Record<string, unknown>
    const correctOptionIdsSource =
        source.correctOptionIds && typeof source.correctOptionIds === 'object'
            ? (source.correctOptionIds as Record<string, unknown>)
            : undefined

    const correctOptionIds = correctOptionIdsSource
        ? Object.fromEntries(
              Object.entries(correctOptionIdsSource).map(([questionId, optionIds]) => [
                  questionId,
                  Array.isArray(optionIds) ? optionIds.filter((optionId): optionId is string => typeof optionId === 'string') : []
              ])
          )
        : undefined

    return {
        questionId: readString(source.questionId, ''),
        correct: typeof source.correct === 'boolean' ? source.correct : undefined,
        explanation: readString(source.explanation, ''),
        score: typeof source.score === 'number' ? source.score : undefined,
        total: typeof source.total === 'number' ? source.total : undefined,
        message: readString(source.message, ''),
        completed: typeof source.completed === 'boolean' ? source.completed : undefined,
        correctOptionIds
    }
}

const resolveDifficultyColor = (difficulty?: number): 'default' | 'success' | 'warning' | 'error' => {
    if (difficulty === 1) {
        return 'success'
    }

    if (difficulty === 2) {
        return 'warning'
    }

    if (difficulty && difficulty >= 3) {
        return 'error'
    }

    return 'default'
}

export default function QuizWidget({ config }: { config?: Record<string, unknown> }) {
    const { t, i18n } = useTranslation('quiz')
    const details = useDashboardDetails()
    const widgetConfig = (config ?? {}) as QuizWidgetConfig
    const [answers, setAnswers] = useState<Record<string, string[]>>({})
    const [submittedResponses, setSubmittedResponses] = useState<Record<string, string[]>>({})
    const [currentIndex, setCurrentIndex] = useState(0)
    const [currentResult, setCurrentResult] = useState<QuizSubmissionResult | null>(null)
    const [finalResult, setFinalResult] = useState<QuizSubmissionResult | null>(null)
    const [currentScore, setCurrentScore] = useState(0)

    const applicationId = details?.applicationId
    const linkedCollectionId = details?.linkedCollectionId ?? null
    const apiBaseUrl = details?.apiBaseUrl ?? '/api/v1'
    const mountMethodName = widgetConfig.mountMethodName || 'mount'
    const submitMethodName = widgetConfig.submitMethodName || 'submit'

    const scriptsQuery = useQuery({
        queryKey: ['quiz-widget-scripts', applicationId, linkedCollectionId, widgetConfig.scriptCodename, widgetConfig.attachedToKind],
        enabled: Boolean(applicationId),
        queryFn: async () => {
            const shouldQueryCatalog = widgetConfig.attachedToKind !== 'metahub' && Boolean(linkedCollectionId)
            const shouldQueryMetahub = widgetConfig.attachedToKind !== 'catalog'

            const [catalogScripts, metahubScripts] = await Promise.all([
                shouldQueryCatalog
                    ? fetchRuntimeScripts({
                          apiBaseUrl,
                          applicationId: applicationId!,
                          attachedToKind: 'catalog',
                          attachedToId: linkedCollectionId
                      })
                    : Promise.resolve([]),
                shouldQueryMetahub
                    ? fetchRuntimeScripts({ apiBaseUrl, applicationId: applicationId!, attachedToKind: 'metahub' })
                    : Promise.resolve([])
            ])

            const items = [...catalogScripts, ...metahubScripts].filter(
                (script, index, array) =>
                    script.moduleRole === 'widget' &&
                    script.manifest.methods.some((method) => isClientScriptMethodTarget(method.target)) &&
                    array.findIndex((candidate) => candidate.id === script.id) === index
            )

            const selected = widgetConfig.scriptCodename
                ? items.find((script) => script.codename === widgetConfig.scriptCodename) ?? null
                : items[0] ?? null

            return { items, selected }
        }
    })

    const selectedScript = scriptsQuery.data?.selected ?? null

    const clientBundleQuery = useQuery({
        queryKey: ['quiz-widget-client-bundle', applicationId, selectedScript?.id],
        enabled: Boolean(applicationId && selectedScript),
        queryFn: async () => {
            if (!applicationId || !selectedScript) {
                return null
            }

            return await fetchRuntimeClientBundle({
                apiBaseUrl,
                applicationId,
                scriptId: selectedScript.id
            })
        }
    })

    const clientBundle = clientBundleQuery.data

    const quizModelQuery = useQuery({
        queryKey: ['quiz-widget-model', selectedScript?.id, linkedCollectionId, mountMethodName, widgetConfig.quizId],
        enabled: Boolean(applicationId && selectedScript && clientBundle),
        queryFn: async () => {
            if (!applicationId || !selectedScript || !clientBundle) {
                return null
            }

            if (!selectedScript.manifest.methods.some((method) => method.name === mountMethodName)) {
                return null
            }

            const rawModel = await executeClientScriptMethod({
                bundle: clientBundle,
                methodName: mountMethodName,
                args: widgetConfig.quizId ? [{ locale: i18n.language, quizId: widgetConfig.quizId }] : [i18n.language],
                context: createClientScriptContext({ apiBaseUrl, applicationId, script: selectedScript })
            })

            return normalizeQuizModel(rawModel, widgetConfig.title || t('defaultTitle', 'Space Quiz'))
        }
    })

    const quizModel = quizModelQuery.data
    const currentQuestion = quizModel?.questions[currentIndex] ?? null
    const currentAnswer = currentQuestion ? answers[currentQuestion.id] ?? [] : []
    const currentCorrectOptionIds = currentQuestion ? currentResult?.correctOptionIds?.[currentQuestion.id] ?? [] : []
    const isCurrentQuestionResolved = Boolean(currentQuestion && currentResult?.questionId === currentQuestion.id)
    const totalQuestions = quizModel?.questions.length ?? 0
    const progressValue = totalQuestions > 0 ? (Math.min(currentIndex + 1, totalQuestions) / totalQuestions) * 100 : 0

    useEffect(() => {
        if (!quizModel) {
            setAnswers({})
            setSubmittedResponses({})
            setCurrentIndex(0)
            setCurrentResult(null)
            setFinalResult(null)
            setCurrentScore(0)
            return
        }

        setAnswers((current) => {
            const next: Record<string, string[]> = {}
            for (const question of quizModel.questions) {
                next[question.id] = current[question.id] ?? []
            }
            return next
        })
        setSubmittedResponses({})
        setCurrentIndex(0)
        setCurrentResult(null)
        setFinalResult(null)
        setCurrentScore(0)
    }, [quizModel])

    useEffect(() => {
        if (!quizModel || !currentResult?.correct || finalResult) {
            return
        }

        const timer = window.setTimeout(() => {
            setCurrentIndex((value) => Math.min(value + 1, quizModel.questions.length - 1))
            setCurrentResult(null)
        }, AUTO_ADVANCE_DELAY_MS)

        return () => window.clearTimeout(timer)
    }, [currentResult, finalResult, quizModel])

    const submitMutation = useMutation({
        mutationFn: async (): Promise<QuizSubmissionPacket> => {
            if (!applicationId || !selectedScript || !clientBundle || !quizModel || !currentQuestion) {
                return {
                    result: null,
                    responses: submittedResponses
                }
            }

            const nextResponses = {
                ...submittedResponses,
                [currentQuestion.id]: currentAnswer
            }

            if (!selectedScript.manifest.methods.some((method) => method.name === submitMethodName)) {
                return {
                    result: {
                        questionId: currentQuestion.id,
                        message: t(
                            'answersCaptured',
                            'Answers captured locally. Add a submit() method in the widget script to validate them.'
                        )
                    },
                    responses: nextResponses
                }
            }

            const rawResult = await executeClientScriptMethod({
                bundle: clientBundle,
                methodName: submitMethodName,
                args: [
                    {
                        questionId: currentQuestion.id,
                        answerIds: currentAnswer,
                        responses: nextResponses,
                        quizId: widgetConfig.quizId,
                        locale: i18n.language
                    }
                ],
                context: createClientScriptContext({ apiBaseUrl, applicationId, script: selectedScript })
            })

            return {
                result: normalizeSubmissionResult(rawResult),
                responses: nextResponses
            }
        },
        onSuccess: ({ result, responses }) => {
            setSubmittedResponses(responses)
            setCurrentResult(result)
            if (typeof result?.score === 'number') {
                setCurrentScore(result.score)
            }
            if (result?.completed) {
                setFinalResult(result)
            }
        }
    })

    const currentScoreSummary = useMemo(() => {
        if (!quizModel) {
            return null
        }

        return t('currentScore', {
            defaultValue: 'Current score: {{score}} / {{total}}',
            score: currentScore,
            total: quizModel.questions.length
        })
    }, [currentScore, quizModel, t])

    const completionMessage = useMemo(() => {
        if (!finalResult || typeof finalResult.score !== 'number' || typeof finalResult.total !== 'number') {
            return null
        }

        const ratio = finalResult.total > 0 ? finalResult.score / finalResult.total : 0
        if (ratio >= 0.8) {
            return t('excellent', 'Excellent! You really know your space.')
        }
        if (ratio >= 0.5) {
            return t('good', 'Good job! Keep exploring the cosmos.')
        }
        return t('tryAgain', 'Nice try! Study up and try again.')
    }, [finalResult, t])

    const advanceToNextQuestion = () => {
        if (!quizModel) {
            return
        }

        setCurrentIndex((value) => Math.min(value + 1, quizModel.questions.length - 1))
        setCurrentResult(null)
    }

    const goToPreviousQuestion = () => {
        setCurrentIndex((value) => Math.max(value - 1, 0))
        setCurrentResult(null)
        setFinalResult(null)
    }

    const returnToQuestions = () => {
        setFinalResult(null)
        setCurrentResult(null)
    }

    const resetQuiz = () => {
        setAnswers({})
        setSubmittedResponses({})
        setCurrentIndex(0)
        setCurrentResult(null)
        setFinalResult(null)
        setCurrentScore(0)
    }

    const handleSingleChoice = (questionId: string, optionId: string) => {
        setAnswers((current) => ({ ...current, [questionId]: [optionId] }))
    }

    const handleMultipleChoice = (questionId: string, optionId: string, checked: boolean) => {
        setAnswers((current) => {
            const currentAnswer = current[questionId] ?? []
            const nextAnswer = checked
                ? Array.from(new Set([...currentAnswer, optionId]))
                : currentAnswer.filter((value) => value !== optionId)

            return { ...current, [questionId]: nextAnswer }
        })
    }

    if (!applicationId) {
        return (
            <Alert severity='info'>
                {t('missingRuntimeContext', 'Quiz widget is available only inside the application runtime surface.')}
            </Alert>
        )
    }

    if (scriptsQuery.isLoading || clientBundleQuery.isLoading || quizModelQuery.isLoading) {
        return (
            <Card variant='outlined'>
                <CardContent>
                    <Stack direction='row' spacing={1.5} alignItems='center'>
                        <CircularProgress size={20} />
                        <Typography variant='body2'>{t('loading', 'Loading quiz widget...')}</Typography>
                    </Stack>
                </CardContent>
            </Card>
        )
    }

    if (scriptsQuery.isError) {
        return <Alert severity='error'>{t('loadScriptsError', 'Failed to load widget scripts.')}</Alert>
    }

    if (quizModelQuery.isError) {
        return <Alert severity='error'>{t('loadQuizError', 'Failed to load quiz content from the widget script.')}</Alert>
    }

    if (clientBundleQuery.isError) {
        return <Alert severity='error'>{t('loadBundleError', 'Failed to load the widget client bundle.')}</Alert>
    }

    if (!selectedScript || !quizModel) {
        return (
            <Card variant='outlined'>
                <CardHeader title={widgetConfig.emptyStateTitle || t('emptyTitle', 'Quiz widget is not configured')} />
                <CardContent>
                    <Typography variant='body2' color='text.secondary'>
                        {widgetConfig.emptyStateDescription ||
                            t(
                                'emptyDescription',
                                'Attach an active widget script to the current catalog or metahub and expose a mount() method to render quiz content here.'
                            )}
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    if (finalResult) {
        return (
            <Card variant='outlined'>
                <LinearProgress variant='determinate' value={100} />
                <CardHeader title={quizModel.title} subheader={quizModel.description || undefined} />
                <CardContent>
                    <Stack spacing={2.5} alignItems='flex-start'>
                        <Typography variant='h5'>{t('complete', 'Quiz complete!')}</Typography>
                        <Typography variant='h3' sx={{ fontWeight: 700 }}>
                            {t('scoreSummary', {
                                defaultValue: 'Score: {{score}} / {{total}}',
                                score: finalResult.score ?? currentScore,
                                total: finalResult.total ?? totalQuestions
                            })}
                        </Typography>
                        {completionMessage ? <Alert severity='info'>{completionMessage}</Alert> : null}
                        <Stack direction='row' spacing={1}>
                            <Button variant='outlined' onClick={returnToQuestions}>
                                {t('backToQuestions', 'Back to questions')}
                            </Button>
                            <Button variant='contained' onClick={resetQuiz}>
                                {t('reset', 'Restart')}
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card variant='outlined'>
            <LinearProgress variant='determinate' value={progressValue} />
            <CardHeader title={quizModel.title} subheader={quizModel.description || undefined} />
            <CardContent>
                <Stack spacing={3}>
                    <Stack direction='row' spacing={1.5} alignItems='center' justifyContent='space-between'>
                        <Typography variant='overline'>
                            {t('questionOf', {
                                defaultValue: 'Question {{current}} of {{total}}',
                                current: currentIndex + 1,
                                total: totalQuestions
                            })}
                        </Typography>
                        {currentScoreSummary ? <Typography variant='body2'>{currentScoreSummary}</Typography> : null}
                    </Stack>

                    {currentQuestion ? (
                        <Box>
                            <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1.5 }}>
                                <Typography variant='h6'>{currentQuestion.prompt}</Typography>
                                {currentQuestion.difficulty ? (
                                    <Chip
                                        size='small'
                                        color={resolveDifficultyColor(currentQuestion.difficulty)}
                                        label={t('difficulty', {
                                            defaultValue: 'Difficulty {{level}}',
                                            level: currentQuestion.difficulty
                                        })}
                                    />
                                ) : null}
                            </Stack>

                            {currentQuestion.description ? (
                                <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
                                    {currentQuestion.description}
                                </Typography>
                            ) : null}

                            {currentQuestion.multiple ? (
                                <Stack spacing={1}>
                                    {currentQuestion.options.map((option) => {
                                        const checked = currentAnswer.includes(option.id)
                                        const isCorrect = currentCorrectOptionIds.includes(option.id)
                                        const isIncorrectSelection = isCurrentQuestionResolved && checked && !isCorrect

                                        return (
                                            <FormControlLabel
                                                key={option.id}
                                                control={
                                                    <Checkbox
                                                        checked={checked}
                                                        onChange={(event) =>
                                                            handleMultipleChoice(currentQuestion.id, option.id, event.target.checked)
                                                        }
                                                        disabled={submitMutation.isPending || isCurrentQuestionResolved}
                                                    />
                                                }
                                                label={
                                                    <Typography
                                                        color={
                                                            isCorrect
                                                                ? 'success.main'
                                                                : isIncorrectSelection
                                                                ? 'error.main'
                                                                : 'text.primary'
                                                        }
                                                    >
                                                        {option.label}
                                                    </Typography>
                                                }
                                            />
                                        )
                                    })}
                                </Stack>
                            ) : (
                                <RadioGroup
                                    value={currentAnswer[0] ?? ''}
                                    onChange={(event) => handleSingleChoice(currentQuestion.id, event.target.value)}
                                >
                                    {currentQuestion.options.map((option) => {
                                        const checked = currentAnswer.includes(option.id)
                                        const isCorrect = currentCorrectOptionIds.includes(option.id)
                                        const isIncorrectSelection = isCurrentQuestionResolved && checked && !isCorrect

                                        return (
                                            <FormControlLabel
                                                key={option.id}
                                                value={option.id}
                                                control={<Radio disabled={submitMutation.isPending || isCurrentQuestionResolved} />}
                                                label={
                                                    <Typography
                                                        color={
                                                            isCorrect
                                                                ? 'success.main'
                                                                : isIncorrectSelection
                                                                ? 'error.main'
                                                                : 'text.primary'
                                                        }
                                                    >
                                                        {option.label}
                                                    </Typography>
                                                }
                                            />
                                        )
                                    })}
                                </RadioGroup>
                            )}
                        </Box>
                    ) : null}

                    {currentResult ? (
                        <Alert severity={currentResult.correct ? 'success' : 'error'}>
                            <Stack spacing={0.75}>
                                <Typography sx={{ fontWeight: 600 }}>
                                    {currentResult.message ||
                                        (currentResult.correct ? t('correct', 'Correct!') : t('incorrect', 'Not quite...'))}
                                </Typography>
                                {currentResult.explanation ? (
                                    <Typography variant='body2'>
                                        {t('explanation', 'Explanation')}: {currentResult.explanation}
                                    </Typography>
                                ) : null}
                                {currentResult.correct && !finalResult ? (
                                    <Typography variant='body2'>{t('autoAdvance', 'Moving to the next question...')}</Typography>
                                ) : null}
                            </Stack>
                        </Alert>
                    ) : null}

                    {submitMutation.isError ? <Alert severity='error'>{t('submitError', 'Failed to submit quiz answers.')}</Alert> : null}

                    <Stack direction='row' spacing={1} justifyContent='flex-end'>
                        <Button variant='text' onClick={resetQuiz} disabled={submitMutation.isPending}>
                            {t('reset', 'Restart')}
                        </Button>
                        {currentIndex > 0 ? (
                            <Button variant='outlined' onClick={goToPreviousQuestion} disabled={submitMutation.isPending}>
                                {t('previousQuestion', 'Previous question')}
                            </Button>
                        ) : null}
                        {currentResult && !currentResult.correct && !finalResult ? (
                            <Button variant='outlined' onClick={advanceToNextQuestion} disabled={submitMutation.isPending}>
                                {quizModel.nextLabel || t('nextQuestion', 'Next question')}
                            </Button>
                        ) : null}
                        <Button
                            variant='contained'
                            onClick={() => submitMutation.mutate()}
                            disabled={
                                submitMutation.isPending || currentAnswer.length === 0 || isCurrentQuestionResolved || !currentQuestion
                            }
                        >
                            {quizModel.submitLabel || t('submit', 'Check answer')}
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    )
}
