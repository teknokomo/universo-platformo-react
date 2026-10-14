import { useCallback, useMemo } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import AppMainLayout from '../layouts/AppMainLayout'
import GuestContentPanel from './GuestContentPanel'
import GuestIntakeForm from './GuestIntakeForm'
import GuestQuizPanel from './GuestQuizPanel'
import { normalizeAttemptLimit } from './guestRuntimeUtils'
import type { GuestTranslate } from './guestRuntimeTypes'
import { useGuestContent } from './useGuestContent'
import { useGuestQuizAttempt } from './useGuestQuizAttempt'
import { isValidGuestEmail, useGuestSession } from './useGuestSession'

const resolvePathParams = () => {
    if (typeof window === 'undefined') {
        return { applicationId: '', slug: '' }
    }

    const source = window.location.pathname + window.location.hash
    const match = source.match(/\/public\/a\/([^/]+)\/links\/([^/?#]+)/)
    return {
        applicationId: match?.[1] ?? '',
        slug: match?.[2] ? decodeURIComponent(match[2]) : ''
    }
}

const normalizeLocale = (value?: string | null) => {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim().slice(0, 2).toLowerCase()
    return /^[a-z]{2}$/.test(normalized) ? normalized : null
}

const resolveGuestRuntimeLocale = (fallbackLocale: string) => {
    if (typeof window === 'undefined') {
        return fallbackLocale
    }

    const explicitLocale = normalizeLocale(new URL(window.location.href).searchParams.get('locale'))
    if (explicitLocale) {
        return explicitLocale
    }

    const persistedLocale = normalizeLocale(window.localStorage.getItem('i18nextLng'))
    if (persistedLocale) {
        return persistedLocale
    }

    return normalizeLocale(fallbackLocale) ?? 'en'
}

export interface GuestAppProps {
    applicationId?: string
    slug?: string
    accessLinkId?: string | null
    workspaceId?: string | null
    apiBaseUrl: string
    locale: string
}

export default function GuestApp(props: GuestAppProps) {
    const { t } = useTranslation('apps')
    const pathParams = resolvePathParams()
    const applicationId = props.applicationId ?? pathParams.applicationId
    const slug = props.slug ?? pathParams.slug
    const accessLinkId = props.accessLinkId ?? null
    const workspaceId = props.workspaceId ?? null
    const apiBaseUrl = props.apiBaseUrl
    const locale = useMemo(() => resolveGuestRuntimeLocale(props.locale), [props.locale])
    const translate = useCallback<GuestTranslate>((key, fallback) => t(key, fallback), [t])

    const guestSession = useGuestSession({ applicationId, slug, accessLinkId, workspaceId, apiBaseUrl, locale, translate })
    const guestContent = useGuestContent({
        applicationId,
        slug,
        apiBaseUrl,
        locale,
        session: guestSession.session,
        linkResolved: Boolean(guestSession.linkQuery.data),
        fetchWithPublicCsrf: guestSession.fetchWithPublicCsrf,
        translate
    })
    const quizController = useGuestQuizAttempt({
        applicationId,
        slug,
        apiBaseUrl,
        locale,
        session: guestSession.session,
        activeQuizId: guestContent.activeQuizId,
        runtimeId: guestContent.runtime?.type === 'quiz' ? guestContent.runtime.id : null,
        fetchWithPublicCsrf: guestSession.fetchWithPublicCsrf,
        translate,
        onBackToContent: guestContent.handleBackToContent
    })

    if (!applicationId || !slug) {
        return (
            <AppMainLayout>
                <Box component='main' sx={{ p: 3 }}>
                    <Alert severity='warning'>{t('guest.invalidLink', 'Public guest link is invalid.')}</Alert>
                </Box>
            </AppMainLayout>
        )
    }

    return (
        <AppMainLayout>
            <Box component='main' sx={{ width: '100%', maxWidth: 960, mx: 'auto', py: 4, px: 2 }}>
                {!guestSession.session ? (
                    <GuestIntakeForm
                        applicationId={applicationId}
                        slug={slug}
                        guestSession={guestSession}
                        isValidGuestEmail={isValidGuestEmail}
                    />
                ) : (
                    <Card>
                        <CardHeader
                            title={
                                guestContent.runtime?.title ??
                                guestSession.linkQuery.data?.title ??
                                t('guest.loadingContent', 'Loading content...')
                            }
                            subheader={guestContent.runtime?.description}
                        />
                        <CardContent>
                            {guestContent.runtimeQuery.isLoading ? (
                                <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }}>
                                    <CircularProgress size={20} />
                                    <Typography>{t('guest.loadingContent', 'Loading content...')}</Typography>
                                </Stack>
                            ) : null}

                            {guestContent.runtimeQuery.error ? (
                                <Alert severity='error'>
                                    {guestSession.formatGuestError(
                                        guestContent.runtimeQuery.error,
                                        'guest.errors.runtimeLoad',
                                        'Failed to load public learning content.'
                                    )}
                                </Alert>
                            ) : null}

                            {guestContent.runtime?.type === 'content' ? (
                                <GuestContentPanel
                                    runtime={guestContent.runtime}
                                    currentItemIndex={guestContent.currentItemIndex}
                                    contentCompleted={guestContent.contentCompleted}
                                    setCurrentItemIndex={guestContent.setCurrentItemIndex}
                                    setContentCompleted={guestContent.setContentCompleted}
                                    handleMoveContent={guestContent.handleMoveContent}
                                    handleCompleteContent={guestContent.handleCompleteContent}
                                    handleOpenQuiz={guestContent.handleOpenQuiz}
                                />
                            ) : null}

                            {guestContent.runtime?.type === 'quiz' ? (
                                <GuestQuizPanel
                                    activeQuizId={guestContent.activeQuizId}
                                    runtime={guestContent.runtime}
                                    quizAttempt={quizController.quizAttempt}
                                    currentQuestionIndex={quizController.currentQuestionIndex}
                                    currentQuestion={quizController.currentQuestion}
                                    selectedOptionId={quizController.selectedOptionId}
                                    timeRemaining={quizController.timeRemaining}
                                    isRefreshingAttempt={quizController.isRefreshingAttempt}
                                    initializeQuizAttemptMutation={quizController.initializeQuizAttemptMutation}
                                    saveAnswerMutation={quizController.saveAnswerMutation}
                                    finalizeQuizMutation={quizController.finalizeQuizMutation}
                                    handleRetryQuiz={quizController.handleRetryQuiz}
                                    handleBackToContent={quizController.handleBackToContent}
                                    handleSelectOption={quizController.handleSelectOption}
                                    handleRetryAnswer={quizController.handleRetryAnswer}
                                    formatGuestError={guestSession.formatGuestError}
                                    normalizeAttemptLimit={normalizeAttemptLimit}
                                />
                            ) : null}
                        </CardContent>
                    </Card>
                )}
            </Box>
        </AppMainLayout>
    )
}
