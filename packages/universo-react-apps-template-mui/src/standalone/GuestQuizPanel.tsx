import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import LinearProgress from '@mui/material/LinearProgress'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { isGuestSessionUnavailableError } from './guestRuntimeUtils'
import type { GuestQuizAttempt, GuestQuizQuestion, GuestRuntimeQuiz } from './guestRuntimeTypes'

type AsyncMutationStatus = { isPending: boolean; error: unknown }
type FinalizeMutationStatus = AsyncMutationStatus & { mutate: (attemptId: string) => void }

type GuestQuizPanelProps = {
    activeQuizId: string | null
    runtime: GuestRuntimeQuiz | null
    quizAttempt: GuestQuizAttempt | null
    currentQuestionIndex: number
    currentQuestion: GuestQuizQuestion | null
    selectedOptionId: string
    timeRemaining: number | null
    isRefreshingAttempt: boolean
    initializeQuizAttemptMutation: AsyncMutationStatus
    saveAnswerMutation: AsyncMutationStatus
    finalizeQuizMutation: FinalizeMutationStatus
    handleRetryQuiz: () => void
    handleBackToContent: () => void
    handleSelectOption: (optionId?: string) => void | Promise<void>
    handleRetryAnswer: (optionId?: string) => void | Promise<void>
    formatGuestError: (error: unknown, key: string, fallback: string) => string
    normalizeAttemptLimit: (value: unknown) => number | null
}

export default function GuestQuizPanel({
    activeQuizId,
    runtime,
    quizAttempt,
    currentQuestion,
    selectedOptionId,
    timeRemaining,
    isRefreshingAttempt,
    initializeQuizAttemptMutation,
    saveAnswerMutation,
    finalizeQuizMutation,
    handleRetryQuiz,
    handleBackToContent,
    handleSelectOption,
    handleRetryAnswer,
    formatGuestError,
    normalizeAttemptLimit
}: GuestQuizPanelProps) {
    const { t } = useTranslation('apps')
    const questionHeadingRef = useRef<HTMLHeadingElement | null>(null)
    const [pendingAnswer, setPendingAnswer] = useState<{ questionId: string; optionId: string } | null>(null)
    const currentQuestionId = currentQuestion?.id ?? null
    const pendingAnswerId = pendingAnswer?.questionId === currentQuestionId ? pendingAnswer.optionId : null
    const confirmationRequired = runtime?.type === 'quiz' && runtime.confirmAnswerBeforeNext === true
    const quizAttemptStatus = quizAttempt?.status
    const quizPhase = quizAttempt?.phase
    const phaseRevision = quizAttempt?.phaseRevision

    useEffect(() => {
        setPendingAnswer(null)
        if (currentQuestionId || quizPhase === 'block_intro' || quizAttemptStatus === 'completed') {
            questionHeadingRef.current?.focus()
        }
    }, [currentQuestionId, phaseRevision, quizPhase, quizAttemptStatus])

    const submitAnswer = (optionId: string) => {
        setPendingAnswer(null)
        void handleSelectOption(optionId)
    }

    const handleRadioGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const target = event.target
        if (!(target instanceof HTMLInputElement) || target.type !== 'radio' || target.disabled) return

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            const radios = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)'))
            const currentIndex = radios.indexOf(target)
            if (currentIndex < 0 || radios.length === 0) return
            event.preventDefault()
            const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
            const nextIndex = (currentIndex + direction + radios.length) % radios.length
            const nextRadio = radios[nextIndex]
            if (!nextRadio) return
            setPendingAnswer({ questionId: currentQuestionId ?? '', optionId: nextRadio.value })
            nextRadio.focus()
            return
        }

        if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
            event.preventDefault()
            if (confirmationRequired) {
                setPendingAnswer({ questionId: currentQuestionId ?? '', optionId: target.value })
            } else {
                submitAnswer(pendingAnswerId ?? target.value)
            }
        }
    }

    const renderQuiz = () => {
        const remaining = Math.max(0, timeRemaining ?? 0)
        const countdown = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
        const result = quizAttempt?.status === 'completed' ? quizAttempt.result : null
        const sessionUnavailableError = isGuestSessionUnavailableError(saveAnswerMutation.error)
            ? saveAnswerMutation.error
            : isGuestSessionUnavailableError(finalizeQuizMutation.error)
            ? finalizeQuizMutation.error
            : null
        const sessionUnavailable = sessionUnavailableError !== null
        const quizRuntime = runtime?.type === 'quiz' ? runtime : null
        const maxAttempts = quizRuntime ? normalizeAttemptLimit(quizRuntime.maxAttempts) : 0
        const attemptNumber = quizAttempt?.attemptNumber
        const canRetryQuiz = Boolean(
            result &&
                result.finishedReason !== 'revoked' &&
                quizRuntime &&
                (maxAttempts === null || (attemptNumber !== null && attemptNumber !== undefined && attemptNumber < maxAttempts))
        )
        const timeLimitSeconds = runtime?.type === 'quiz' ? runtime.timeLimitSeconds : null
        const timeLimitMinutes =
            typeof timeLimitSeconds === 'number' && Number.isFinite(timeLimitSeconds) && timeLimitSeconds > 0
                ? Math.ceil(timeLimitSeconds / 60)
                : null
        const allQuestionsAnswered =
            quizAttempt?.status === 'in_progress' && quizAttempt.phase === 'question' && !currentQuestion && !sessionUnavailable
        const hasBlockIntro = Boolean(
            quizAttempt?.status === 'in_progress' && quizAttempt.phase === 'block_intro' && quizAttempt.currentBlock
        )
        const continuing = Boolean(hasBlockIntro && saveAnswerMutation.isPending)
        const progressLabel = quizAttempt
            ? t('guest.quizAnsweredProgress', {
                  defaultValue: '{{answered}} of {{total}} questions answered',
                  answered: quizAttempt.answeredCount,
                  total: quizAttempt.totalQuestions
              })
            : ''

        return (
            <Stack spacing={2}>
                {initializeQuizAttemptMutation.isPending ? (
                    <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }} role='status' aria-live='polite'>
                        <CircularProgress size={20} />
                        <Typography>{t('guest.quizAttemptStarting', 'Loading your quiz...')}</Typography>
                    </Stack>
                ) : null}

                {initializeQuizAttemptMutation.error ? (
                    <Alert severity='error' role='alert'>
                        {formatGuestError(
                            initializeQuizAttemptMutation.error,
                            'guest.errors.quizAttemptLoad',
                            'Failed to load your quiz attempt.'
                        )}
                    </Alert>
                ) : null}

                {quizAttempt?.resumed && quizAttempt.status === 'in_progress' ? (
                    <Alert severity='info'>{t('guest.quizAttemptResumed', 'Your saved quiz attempt has been restored.')}</Alert>
                ) : null}

                {quizAttempt?.status === 'in_progress' && !sessionUnavailable ? (
                    <Stack spacing={1}>
                        {quizAttempt.timerState === 'untimed' ? (
                            <Typography>{t('guest.quizNoTimeLimit', 'There is no time limit for this quiz.')}</Typography>
                        ) : timeLimitMinutes !== null ? (
                            <Typography>
                                {t('guest.quizTimeLimit', {
                                    defaultValue: 'You have {{minutes}} minutes to complete this quiz.',
                                    minutes: timeLimitMinutes
                                })}
                            </Typography>
                        ) : null}
                        {quizAttempt.timerState === 'paused' ? (
                            <Alert severity='info' role='status' aria-live='polite'>
                                {t(
                                    'guest.quizTimerPaused',
                                    'The timer is paused. Your remaining time will stay frozen until you continue.'
                                )}
                            </Alert>
                        ) : null}
                        {timeRemaining !== null ? (
                            <Stack direction='row' spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography>{t('guest.quizTimeRemaining', 'Time remaining')}</Typography>
                                <Typography
                                    variant='h6'
                                    component='p'
                                    role='timer'
                                    aria-live='off'
                                    aria-label={`${t('guest.quizTimeRemaining', 'Time remaining')}: ${countdown}`}
                                >
                                    {countdown}
                                </Typography>
                            </Stack>
                        ) : null}
                    </Stack>
                ) : null}

                {result ? (
                    <Card variant='outlined'>
                        <CardContent>
                            <Stack spacing={1.5}>
                                <Typography ref={questionHeadingRef} tabIndex={-1} variant='h5' component='h2'>
                                    {t('guest.quizResultTitle', 'Quiz completed')}
                                </Typography>
                                {result.finishedReason === 'revoked' ? (
                                    <Alert severity='info' role='status' aria-live='polite'>
                                        {t('guest.quizRevokedResult', 'This quiz attempt was closed because its access link was revoked.')}
                                    </Alert>
                                ) : result.correctCount !== null && result.totalQuestions !== null ? (
                                    <Alert
                                        severity={typeof result.passed !== 'boolean' ? 'info' : result.passed ? 'success' : 'error'}
                                        role='status'
                                        aria-live='polite'
                                    >
                                        {typeof result.passed === 'boolean' ? (
                                            <Box component='span' sx={{ fontWeight: 600, mr: 1 }}>
                                                {result.passed ? t('guest.quizPassed', 'Passed') : t('guest.quizNotPassed', 'Not passed')}
                                            </Box>
                                        ) : null}
                                        {t('guest.quizScore', {
                                            defaultValue: 'Correct answers: {{score}} / {{total}}',
                                            score: result.correctCount,
                                            total: result.totalQuestions
                                        })}
                                    </Alert>
                                ) : null}
                                {result.finishedReason === 'timed_out' ? (
                                    <Alert severity='warning' role='status'>
                                        {t('guest.quizTimedOutResult', 'Time expired. Your saved answers were scored.')}
                                    </Alert>
                                ) : null}
                                {result.completionText ? <Typography>{result.completionText}</Typography> : null}
                                {canRetryQuiz || activeQuizId ? (
                                    <Stack direction='row' spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                        {canRetryQuiz ? (
                                            <Button variant='contained' onClick={handleRetryQuiz}>
                                                {t('guest.retryQuiz', 'Try again')}
                                            </Button>
                                        ) : null}
                                        {activeQuizId ? (
                                            <Button variant='outlined' onClick={handleBackToContent}>
                                                {t('guest.backToContent', 'Back to content')}
                                            </Button>
                                        ) : null}
                                    </Stack>
                                ) : null}
                            </Stack>
                        </CardContent>
                    </Card>
                ) : null}

                {quizAttempt?.status === 'in_progress' && !sessionUnavailable ? (
                    <>
                        <LinearProgress
                            variant='determinate'
                            value={quizAttempt.totalQuestions > 0 ? (quizAttempt.answeredCount / quizAttempt.totalQuestions) * 100 : 0}
                            aria-label={progressLabel}
                        />
                        <Typography role='status' aria-live='polite' aria-atomic='true'>
                            {progressLabel}
                        </Typography>
                    </>
                ) : null}

                {quizAttempt?.status === 'in_progress' &&
                quizAttempt.phase === 'block_intro' &&
                quizAttempt.currentBlock !== null &&
                !sessionUnavailable ? (
                    <Card variant='outlined'>
                        <CardContent>
                            <Stack spacing={1.5}>
                                <Typography ref={questionHeadingRef} tabIndex={-1} variant='h5' component='h2'>
                                    {quizAttempt.currentBlock.title}
                                </Typography>
                                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{quizAttempt.currentBlock.introduction}</Typography>
                                {saveAnswerMutation.error ? (
                                    <Alert severity='error' role='alert'>
                                        {formatGuestError(
                                            saveAnswerMutation.error,
                                            'guest.errors.quizContinue',
                                            'Failed to continue to the next quiz question.'
                                        )}
                                    </Alert>
                                ) : null}
                                {continuing ? (
                                    <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }} role='status' aria-live='polite'>
                                        <CircularProgress size={18} />
                                        <Typography>{t('guest.continuingQuiz', 'Loading the next question...')}</Typography>
                                    </Stack>
                                ) : null}
                                <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <Button
                                        variant='contained'
                                        onClick={() => void handleSelectOption()}
                                        disabled={
                                            saveAnswerMutation.isPending ||
                                            finalizeQuizMutation.isPending ||
                                            isRefreshingAttempt ||
                                            timeRemaining === 0
                                        }
                                    >
                                        {continuing
                                            ? t('guest.continuingQuiz', 'Loading the next question...')
                                            : saveAnswerMutation.error
                                            ? t('guest.retryQuizContinue', 'Retry continue')
                                            : t('guest.continueQuiz', 'Continue')}
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                ) : null}

                {quizAttempt?.status === 'in_progress' && quizAttempt.phase === 'question' && currentQuestion && !sessionUnavailable ? (
                    <>
                        <Card variant='outlined'>
                            <CardContent>
                                <Stack spacing={1.5}>
                                    <Typography variant='overline'>
                                        {t('guest.quizQuestionDisplayNumber', {
                                            defaultValue: 'Question {{number}}',
                                            number: currentQuestion.displayNumber
                                        })}
                                    </Typography>
                                    <Typography
                                        id='guest-quiz-current-question'
                                        ref={questionHeadingRef}
                                        tabIndex={-1}
                                        variant='h6'
                                        component='h2'
                                    >
                                        {currentQuestion.prompt}
                                    </Typography>
                                    <RadioGroup
                                        aria-labelledby='guest-quiz-current-question'
                                        aria-required='true'
                                        value={pendingAnswerId || selectedOptionId || ''}
                                        onKeyDown={handleRadioGroupKeyDown}
                                        onChange={(event) => {
                                            const optionId = event.target.value
                                            if (confirmationRequired) {
                                                setPendingAnswer({ questionId: currentQuestionId ?? '', optionId })
                                            } else {
                                                submitAnswer(optionId)
                                            }
                                        }}
                                    >
                                        {currentQuestion.options.map((option) => (
                                            <FormControlLabel
                                                key={option.id}
                                                value={option.id}
                                                control={
                                                    <Radio
                                                        disabled={
                                                            timeRemaining === 0 ||
                                                            finalizeQuizMutation.isPending ||
                                                            saveAnswerMutation.isPending ||
                                                            isRefreshingAttempt
                                                        }
                                                    />
                                                }
                                                label={option.label}
                                            />
                                        ))}
                                    </RadioGroup>
                                    <FormHelperText>
                                        {confirmationRequired
                                            ? pendingAnswerId
                                                ? t('guest.quizAnswerSelectedToConfirm', 'Answer selected. Confirm to continue.')
                                                : t('guest.quizChooseAnswerToConfirm', 'Choose an answer, then confirm to continue.')
                                            : pendingAnswerId
                                            ? t('guest.quizKeyboardSubmitHint', 'Use Space or Enter to submit the focused answer.')
                                            : t('guest.quizSelectAnswer', 'Choose an answer to continue.')}
                                    </FormHelperText>
                                    {confirmationRequired && pendingAnswerId ? (
                                        <Button
                                            variant='contained'
                                            onClick={() => submitAnswer(pendingAnswerId)}
                                            disabled={
                                                timeRemaining === 0 ||
                                                finalizeQuizMutation.isPending ||
                                                saveAnswerMutation.isPending ||
                                                isRefreshingAttempt
                                            }
                                        >
                                            {t('guest.quizSubmitAnswer', 'Submit answer')}
                                        </Button>
                                    ) : null}
                                </Stack>
                            </CardContent>
                        </Card>
                        {timeRemaining === 0 ? (
                            <Stack spacing={1}>
                                <Alert severity='warning' role='status' aria-live='polite'>
                                    {t('guest.quizTimeExpired', 'Time is up. Your saved answers are being finalized.')}
                                </Alert>
                                {finalizeQuizMutation.error && !sessionUnavailable && !finalizeQuizMutation.isPending ? (
                                    <Button variant='contained' onClick={() => finalizeQuizMutation.mutate(quizAttempt.attemptId)}>
                                        {t('guest.retryQuizFinish', 'Retry finishing the quiz')}
                                    </Button>
                                ) : null}
                            </Stack>
                        ) : null}
                        {saveAnswerMutation.isPending || isRefreshingAttempt ? (
                            <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }} role='status' aria-live='polite'>
                                <CircularProgress size={18} />
                                <Typography>
                                    {isRefreshingAttempt
                                        ? t('guest.syncingQuizAttempt', 'Checking your saved progress...')
                                        : t('guest.savingAnswer', 'Saving answer...')}
                                </Typography>
                            </Stack>
                        ) : null}
                    </>
                ) : null}

                {allQuestionsAnswered ? (
                    <Stack spacing={1}>
                        <Typography role='status' aria-live='polite'>
                            {finalizeQuizMutation.isPending
                                ? t('guest.finishingQuiz', 'Finishing quiz...')
                                : t('guest.quizAllAnswersSaved', 'All answers are saved. Your result is being prepared.')}
                        </Typography>
                        {finalizeQuizMutation.error && !sessionUnavailable ? (
                            <Button variant='contained' onClick={() => finalizeQuizMutation.mutate(quizAttempt.attemptId)}>
                                {t('guest.retryQuizFinish', 'Retry finishing the quiz')}
                            </Button>
                        ) : null}
                    </Stack>
                ) : null}

                {!result &&
                    (sessionUnavailable ? (
                        <Alert severity='info' role='status' aria-live='polite'>
                            {sessionUnavailableError.message}
                        </Alert>
                    ) : saveAnswerMutation.error && quizAttempt?.phase !== 'block_intro' ? (
                        <Stack spacing={1}>
                            <Alert severity='error' role='alert'>
                                {formatGuestError(saveAnswerMutation.error, 'guest.errors.quizAnswerSave', 'Failed to save your answer.')}
                            </Alert>
                            {selectedOptionId ? (
                                <Button
                                    variant='contained'
                                    onClick={() => void handleRetryAnswer(pendingAnswerId ?? selectedOptionId)}
                                    disabled={saveAnswerMutation.isPending || isRefreshingAttempt || timeRemaining === 0}
                                >
                                    {t('guest.retryAnswerSave', 'Retry saving answer')}
                                </Button>
                            ) : null}
                        </Stack>
                    ) : null)}
                {finalizeQuizMutation.error && !sessionUnavailable ? (
                    <Alert severity='error' role='alert'>
                        {formatGuestError(finalizeQuizMutation.error, 'guest.errors.quizFinalize', 'Failed to finish the quiz.')}
                    </Alert>
                ) : null}
                {activeQuizId && !result ? (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant='text'
                            onClick={handleBackToContent}
                            disabled={
                                initializeQuizAttemptMutation.isPending || saveAnswerMutation.isPending || finalizeQuizMutation.isPending
                            }
                        >
                            {t('guest.backToContent', 'Back to content')}
                        </Button>
                    </Box>
                ) : null}
                {!quizAttempt && !initializeQuizAttemptMutation.isPending && !initializeQuizAttemptMutation.error ? (
                    <Typography role='status' aria-live='polite'>
                        {t('guest.quizAttemptStarting', 'Loading your quiz...')}
                    </Typography>
                ) : null}
            </Stack>
        )
    }
    return renderQuiz()
}
