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
    handleSelectOption: (optionId: string) => void | Promise<void>
    handleRetryAnswer: () => void | Promise<void>
    formatGuestError: (error: unknown, key: string, fallback: string) => string
    normalizeAttemptLimit: (value: unknown) => number | null
}

export default function GuestQuizPanel({
    activeQuizId,
    runtime,
    quizAttempt,
    currentQuestionIndex,
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
    const [pendingKeyboardOption, setPendingKeyboardOption] = useState<{ questionId: string; optionId: string } | null>(null)
    const currentQuestionId = currentQuestion?.id ?? null
    const pendingKeyboardOptionId = pendingKeyboardOption?.questionId === currentQuestionId ? pendingKeyboardOption.optionId : null
    const quizAttemptStatus = quizAttempt?.status

    useEffect(() => {
        setPendingKeyboardOption(null)
        if (currentQuestionId || quizAttemptStatus === 'completed') {
            questionHeadingRef.current?.focus()
        }
    }, [currentQuestionId, quizAttemptStatus])

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
            setPendingKeyboardOption({ questionId: currentQuestionId ?? '', optionId: nextRadio.value })
            nextRadio.focus()
            return
        }

        if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
            event.preventDefault()
            setPendingKeyboardOption({ questionId: currentQuestionId ?? '', optionId: target.value })
        }
    }

    const renderQuiz = () => {
        const remaining = Math.max(0, timeRemaining ?? 0)
        const countdown = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
        const result = quizAttempt?.status === 'completed' ? quizAttempt.result : null
        const sessionUnavailableError = isGuestSessionUnavailableError(saveAnswerMutation.error) ? saveAnswerMutation.error : null
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
        const allQuestionsAnswered = quizAttempt?.status === 'in_progress' && !currentQuestion && !sessionUnavailable

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
                        {timeLimitMinutes === null ? (
                            <Typography>{t('guest.quizNoTimeLimit', 'There is no time limit for this quiz.')}</Typography>
                        ) : (
                            <Typography>
                                {t('guest.quizTimeLimit', {
                                    defaultValue: 'You have {{minutes}} minutes to complete this quiz.',
                                    minutes: timeLimitMinutes
                                })}
                            </Typography>
                        )}
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

                {quizAttempt?.status === 'in_progress' && currentQuestion && !sessionUnavailable ? (
                    <>
                        <LinearProgress
                            variant='determinate'
                            value={quizAttempt.totalQuestions > 0 ? (quizAttempt.answeredCount / quizAttempt.totalQuestions) * 100 : 0}
                            aria-label={t('guest.quizProgress', {
                                defaultValue: 'Question {{current}} of {{total}}',
                                current: currentQuestionIndex + 1,
                                total: quizAttempt.totalQuestions
                            })}
                        />
                        <Typography role='status' aria-live='polite' aria-atomic='true'>
                            {t('guest.quizProgress', {
                                defaultValue: 'Question {{current}} of {{total}}',
                                current: currentQuestionIndex + 1,
                                total: quizAttempt.totalQuestions
                            })}
                        </Typography>
                        <Card variant='outlined'>
                            <CardContent>
                                <Stack spacing={1.5}>
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
                                        value={pendingKeyboardOptionId || selectedOptionId || ''}
                                        onKeyDown={handleRadioGroupKeyDown}
                                        onChange={(event) => {
                                            setPendingKeyboardOption(null)
                                            void handleSelectOption(event.target.value)
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
                                        {pendingKeyboardOptionId
                                            ? t(
                                                  'guest.quizKeyboardAnswerSelected',
                                                  'Answer selected. Use the Submit answer button to continue.'
                                              )
                                            : t('guest.quizSelectAnswer', 'Choose an answer to continue.')}
                                    </FormHelperText>
                                    {pendingKeyboardOptionId ? (
                                        <Button
                                            variant='contained'
                                            onClick={() => {
                                                setPendingKeyboardOption(null)
                                                void handleSelectOption(pendingKeyboardOptionId)
                                            }}
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
                                {finalizeQuizMutation.error && !finalizeQuizMutation.isPending ? (
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
                        {finalizeQuizMutation.error ? (
                            <Button variant='contained' onClick={() => finalizeQuizMutation.mutate(quizAttempt.attemptId)}>
                                {t('guest.retryQuizFinish', 'Retry finishing the quiz')}
                            </Button>
                        ) : null}
                    </Stack>
                ) : null}

                {sessionUnavailable ? (
                    <Alert severity='info' role='status' aria-live='polite'>
                        {sessionUnavailableError.message}
                    </Alert>
                ) : saveAnswerMutation.error ? (
                    <Stack spacing={1}>
                        <Alert severity='error' role='alert'>
                            {formatGuestError(saveAnswerMutation.error, 'guest.errors.quizAnswerSave', 'Failed to save your answer.')}
                        </Alert>
                        {selectedOptionId ? (
                            <Button
                                variant='contained'
                                onClick={() => void handleRetryAnswer()}
                                disabled={saveAnswerMutation.isPending || isRefreshingAttempt || timeRemaining === 0}
                            >
                                {t('guest.retryAnswerSave', 'Retry saving answer')}
                            </Button>
                        ) : null}
                    </Stack>
                ) : null}
                {finalizeQuizMutation.error ? (
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
