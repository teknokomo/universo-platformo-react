import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import AppMainLayout from '../layouts/AppMainLayout'

const PUBLIC_CSRF_STORAGE_KEY_PREFIX = 'apps-template-mui:public-csrf'
const GUEST_PARTICIPANT_ID_HEADER = 'X-Guest-Participant-Id'
const GUEST_SESSION_TOKEN_HEADER = 'X-Guest-Session-Token'

const getPublicCsrfStorageKey = (applicationId?: string) =>
    applicationId ? `${PUBLIC_CSRF_STORAGE_KEY_PREFIX}:${applicationId}` : PUBLIC_CSRF_STORAGE_KEY_PREFIX

const resolvePathParams = () => {
    if (typeof window === 'undefined') {
        return { applicationId: '', slug: '' }
    }

    const source = `${window.location.pathname}${window.location.hash}`
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

type GuestSession = {
    participantId: string
    studentId?: string
    sessionToken: string
}

type GuestRuntimeModule = {
    type: 'module'
    id: string
    title: string
    description?: string
    contentItems: Array<{
        id: string
        itemType: string
        itemTitle?: string
        itemContent?: string
        quizId?: string
        sortOrder: number
    }>
}

type GuestRuntimeQuiz = {
    type: 'quiz'
    id: string
    title: string
    description?: string
    passingScorePercent?: number
    questions: Array<{
        id: string
        prompt: string
        description?: string
        explanation?: string
        options: Array<{ id: string; label: string }>
    }>
}

type GuestRuntimePayload = GuestRuntimeModule | GuestRuntimeQuiz

const normalizeGuestSession = (value: unknown): GuestSession | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }

    const raw = value as Partial<GuestSession>
    const participantId = typeof raw.participantId === 'string' ? raw.participantId : typeof raw.studentId === 'string' ? raw.studentId : ''
    const sessionToken = typeof raw.sessionToken === 'string' ? raw.sessionToken : ''
    if (!participantId || !sessionToken) {
        return null
    }

    return {
        participantId,
        studentId: typeof raw.studentId === 'string' ? raw.studentId : participantId,
        sessionToken
    }
}

export interface GuestAppProps {
    applicationId?: string
    slug?: string
    apiBaseUrl: string
    locale: string
}

export default function GuestApp(props: GuestAppProps) {
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()
    const pathParams = resolvePathParams()
    const applicationId = props.applicationId ?? pathParams.applicationId
    const slug = props.slug ?? pathParams.slug
    const apiBaseUrl = props.apiBaseUrl
    const locale = useMemo(() => resolveGuestRuntimeLocale(props.locale), [props.locale])
    const storageKey = `apps-template-mui:guest-session:${applicationId}:${slug}`

    const [displayName, setDisplayName] = useState('')
    const [session, setSession] = useState<GuestSession | null>(null)
    const [currentItemIndex, setCurrentItemIndex] = useState(0)
    const [activeQuizId, setActiveQuizId] = useState<string | null>(null)
    const [answers, setAnswers] = useState<Record<string, string[]>>({})
    const [moduleCompleted, setModuleCompleted] = useState(false)
    const publicCsrfStorageKey = getPublicCsrfStorageKey(applicationId)

    const resolveCsrfToken = async (forceRefresh = false) => {
        if (typeof window !== 'undefined' && !forceRefresh) {
            const storedToken = window.sessionStorage.getItem(publicCsrfStorageKey)
            if (storedToken) {
                return storedToken
            }
        }

        const response = await fetch(`${apiBaseUrl}/auth/csrf`, {
            method: 'GET',
            credentials: 'same-origin'
        })
        if (!response.ok) {
            throw new Error(t('guest.errors.sessionCreate', 'Failed to create guest session.'))
        }

        const payload = (await response.json()) as { csrfToken?: string }
        if (typeof payload.csrfToken !== 'string' || payload.csrfToken.length === 0) {
            throw new Error(t('guest.errors.sessionCreate', 'Failed to create guest session.'))
        }

        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(publicCsrfStorageKey, payload.csrfToken)
        }

        return payload.csrfToken
    }

    const fetchWithPublicCsrf = async (input: RequestInfo | URL, init: RequestInit) => {
        const execute = async (forceRefresh = false) => {
            const csrfToken = await resolveCsrfToken(forceRefresh)
            const headers = new Headers(init.headers ?? {})
            headers.set('X-CSRF-Token', csrfToken)
            return fetch(input, {
                ...init,
                headers
            })
        }

        const response = await execute(false)
        if (response.status === 419) {
            return execute(true)
        }

        return response
    }

    useEffect(() => {
        if (typeof window === 'undefined' || !applicationId || !slug) return
        try {
            const stored = window.sessionStorage.getItem(storageKey)
            if (!stored) return
            const parsed = normalizeGuestSession(JSON.parse(stored))
            if (parsed) {
                setSession(parsed)
            }
        } catch {
            window.sessionStorage.removeItem(storageKey)
        }
    }, [applicationId, slug, storageKey])

    const linkQuery = useQuery({
        queryKey: ['guest-link', applicationId, slug],
        enabled: Boolean(applicationId && slug),
        queryFn: async () => {
            const params = new URLSearchParams({ locale })
            const response = await fetch(`${apiBaseUrl}/public/a/${applicationId}/links/${encodeURIComponent(slug)}?${params.toString()}`)
            if (!response.ok) {
                throw new Error(t('guest.errors.linkNotFound', 'Access link was not found or is no longer active.'))
            }
            return (await response.json()) as {
                id: string
                title?: string
                targetType: 'module' | 'quiz'
                targetId: string
            }
        }
    })

    const sessionMutation = useMutation({
        mutationFn: async () => {
            const accessLinkId = linkQuery.data?.id
            if (!accessLinkId) {
                throw new Error(t('guest.errors.linkNotFound', 'Access link was not found or is no longer active.'))
            }

            const response = await fetchWithPublicCsrf(`${apiBaseUrl}/public/a/${applicationId}/guest-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName,
                    accessLinkId
                })
            })
            if (!response.ok) {
                throw new Error(t('guest.errors.sessionCreate', 'Failed to create guest session.'))
            }
            const payload = normalizeGuestSession(await response.json())
            if (!payload) {
                throw new Error(t('guest.errors.sessionCreate', 'Failed to create guest session.'))
            }
            return payload
        },
        onSuccess: (nextSession) => {
            setSession(nextSession)
            setActiveQuizId(null)
            setCurrentItemIndex(0)
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(storageKey, JSON.stringify(nextSession))
            }
        }
    })

    const runtimeQuery = useQuery({
        queryKey: ['guest-runtime', applicationId, slug, locale, session?.participantId ?? null, activeQuizId],
        enabled: Boolean(applicationId && slug && linkQuery.data && session?.participantId && session?.sessionToken),
        queryFn: async () => {
            const params = new URLSearchParams({ slug, locale })
            if (activeQuizId) {
                params.set('targetType', 'quiz')
                params.set('targetId', activeQuizId)
            }
            const headers = new Headers()
            if (session?.participantId && session?.sessionToken) {
                headers.set(GUEST_PARTICIPANT_ID_HEADER, session.participantId)
                headers.set(GUEST_SESSION_TOKEN_HEADER, session.sessionToken)
            }
            const response = await fetch(`${apiBaseUrl}/public/a/${applicationId}/runtime?${params.toString()}`, {
                headers
            })
            if (!response.ok) {
                throw new Error(t('guest.errors.runtimeLoad', 'Failed to load public learning content.'))
            }
            return (await response.json()) as GuestRuntimePayload
        }
    })

    const progressMutation = useMutation({
        mutationFn: async (input: { moduleId: string; progressPercent: number; lastAccessedItemIndex: number; status: string }) => {
            if (!session) return
            const response = await fetchWithPublicCsrf(`${apiBaseUrl}/public/a/${applicationId}/runtime/guest-progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participantId: session.participantId,
                    sessionToken: session.sessionToken,
                    contentNodeId: input.moduleId,
                    progressPercent: input.progressPercent,
                    lastAccessedItemIndex: input.lastAccessedItemIndex,
                    status: input.status
                })
            })

            if (!response.ok) {
                throw new Error(t('guest.errors.progressSave', 'Failed to save module progress.'))
            }

            return (await response.json()) as { ok: boolean }
        }
    })

    const submitQuizMutation = useMutation({
        mutationFn: async (quizId: string) => {
            if (!session) {
                throw new Error(t('guest.errors.sessionMissing', 'Guest session is required before submitting a quiz.'))
            }

            const response = await fetchWithPublicCsrf(`${apiBaseUrl}/public/a/${applicationId}/runtime/guest-submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participantId: session.participantId,
                    sessionToken: session.sessionToken,
                    assessmentId: quizId,
                    answers
                })
            })
            if (!response.ok) {
                throw new Error(t('guest.errors.quizSubmit', 'Failed to submit the quiz.'))
            }
            return (await response.json()) as { score: number; total: number; passed: boolean }
        },
        onSuccess: () => {
            setAnswers({})
            void queryClient.invalidateQueries({ queryKey: ['guest-runtime', applicationId, slug] })
        }
    })

    const handleOpenQuiz = (quizId: string) => {
        submitQuizMutation.reset()
        setAnswers({})
        setActiveQuizId(quizId)
    }

    const handleBackToModule = () => {
        submitQuizMutation.reset()
        setAnswers({})
        setActiveQuizId(null)
    }

    const runtime = runtimeQuery.data
    const currentItem = runtime?.type === 'module' ? runtime.contentItems[currentItemIndex] ?? null : null
    const totalItems = runtime?.type === 'module' ? runtime.contentItems.length : 0

    useEffect(() => {
        if (runtime?.type !== 'module') {
            setModuleCompleted(false)
            return
        }

        setModuleCompleted(false)
    }, [runtime?.id, runtime?.type])

    const handleStartGuestSession = () => {
        if (!displayName.trim()) return
        sessionMutation.mutate()
    }

    const handleMoveModule = (nextIndex: number) => {
        if (!runtime || runtime.type !== 'module') return
        const boundedIndex = Math.max(0, Math.min(nextIndex, runtime.contentItems.length - 1))
        setModuleCompleted(false)
        setCurrentItemIndex(boundedIndex)
        if (session) {
            const progressPercent = runtime.contentItems.length > 0 ? ((boundedIndex + 1) / runtime.contentItems.length) * 100 : 0
            progressMutation.mutate({
                moduleId: runtime.id,
                progressPercent,
                lastAccessedItemIndex: boundedIndex,
                status: progressPercent >= 100 ? 'completed' : 'in_progress'
            })
        }
    }

    const handleAnswerChange = (questionId: string, optionId: string) => {
        setAnswers((prev) => ({
            ...prev,
            [questionId]: [optionId]
        }))
    }

    const handleCompleteModule = async () => {
        if (!runtime || runtime.type !== 'module') return

        if (!session) {
            setModuleCompleted(true)
            return
        }

        try {
            await progressMutation.mutateAsync({
                moduleId: runtime.id,
                progressPercent: 100,
                lastAccessedItemIndex: Math.max(totalItems - 1, 0),
                status: 'completed'
            })

            setModuleCompleted(true)
        } catch {
            setModuleCompleted(false)
        }
    }

    const renderModuleItem = () => {
        if (!currentItem) return null

        if (currentItem.itemType === 'text') {
            return <Typography sx={{ whiteSpace: 'pre-wrap' }}>{currentItem.itemContent}</Typography>
        }

        if (currentItem.itemType === 'image') {
            return (
                <Box
                    component='img'
                    src={currentItem.itemContent}
                    alt={currentItem.itemTitle || 'module item'}
                    sx={{ width: '100%', borderRadius: 2 }}
                />
            )
        }

        if (currentItem.itemType === 'video_url') {
            return (
                <Box sx={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe
                        src={currentItem.itemContent}
                        title={currentItem.itemTitle || 'video'}
                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                        allowFullScreen
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 12 }}
                    />
                </Box>
            )
        }

        const quizId = currentItem.quizId

        if (currentItem.itemType === 'quiz_ref' && quizId) {
            return (
                <Button variant='contained' onClick={() => handleOpenQuiz(quizId)}>
                    {t('guest.openQuiz', 'Open quiz')}
                </Button>
            )
        }

        return <Alert severity='info'>{t('guest.unsupportedContent', 'This content item type is not supported in guest mode yet.')}</Alert>
    }

    const renderQuiz = (quiz: GuestRuntimeQuiz) => (
        <Stack spacing={2}>
            {quiz.questions.map((question) => (
                <Card key={question.id} variant='outlined'>
                    <CardContent>
                        <Stack spacing={1.5}>
                            <Typography variant='h6'>{question.prompt}</Typography>
                            {question.description ? <Typography color='text.secondary'>{question.description}</Typography> : null}
                            <RadioGroup
                                value={answers[question.id]?.[0] ?? ''}
                                onChange={(event) => handleAnswerChange(question.id, event.target.value)}
                            >
                                {question.options.map((option) => (
                                    <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.label} />
                                ))}
                            </RadioGroup>
                        </Stack>
                    </CardContent>
                </Card>
            ))}

            <Stack direction='row' spacing={1} justifyContent='flex-end'>
                {activeQuizId ? (
                    <Button variant='text' onClick={handleBackToModule}>
                        {t('guest.backToModule', 'Back to module')}
                    </Button>
                ) : null}
                <Button variant='contained' onClick={() => submitQuizMutation.mutate(quiz.id)} disabled={submitQuizMutation.isPending}>
                    {submitQuizMutation.isPending ? t('guest.submittingQuiz', 'Submitting...') : t('guest.submitQuiz', 'Submit quiz')}
                </Button>
            </Stack>

            {submitQuizMutation.data ? (
                <Alert severity={submitQuizMutation.data.passed ? 'success' : 'warning'}>
                    {t('guest.quizResult', {
                        defaultValue: 'Score {{score}} / {{total}}',
                        score: submitQuizMutation.data.score,
                        total: submitQuizMutation.data.total
                    })}
                </Alert>
            ) : null}
        </Stack>
    )

    if (!applicationId || !slug) {
        return (
            <AppMainLayout>
                <Box sx={{ p: 3 }}>
                    <Alert severity='warning'>{t('guest.invalidLink', 'Public guest link is invalid.')}</Alert>
                </Box>
            </AppMainLayout>
        )
    }

    return (
        <AppMainLayout>
            <Box sx={{ width: '100%', maxWidth: 960, mx: 'auto', py: 4, px: 2 }}>
                {!session ? (
                    <Card>
                        <CardHeader title={linkQuery.data?.title ?? t('guest.enterNameTitle', 'Enter your name to continue')} />
                        <CardContent>
                            <Stack spacing={2}>
                                {linkQuery.isLoading ? (
                                    <Stack direction='row' spacing={1} alignItems='center'>
                                        <CircularProgress size={20} />
                                        <Typography>{t('guest.loadingLink', 'Loading access link...')}</Typography>
                                    </Stack>
                                ) : null}
                                {linkQuery.error instanceof Error ? <Alert severity='error'>{linkQuery.error.message}</Alert> : null}
                                <TextField
                                    value={displayName}
                                    onChange={(event) => setDisplayName(event.target.value)}
                                    label={t('guest.displayName', 'Your name')}
                                />
                                <Button
                                    variant='contained'
                                    onClick={handleStartGuestSession}
                                    disabled={!displayName.trim() || sessionMutation.isPending || linkQuery.isLoading || !linkQuery.data}
                                >
                                    {sessionMutation.isPending ? t('guest.starting', 'Starting...') : t('guest.start', 'Start learning')}
                                </Button>
                                {sessionMutation.error instanceof Error ? (
                                    <Alert severity='error'>{sessionMutation.error.message}</Alert>
                                ) : null}
                            </Stack>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader
                            title={runtime?.title ?? linkQuery.data?.title ?? t('guest.loadingContent', 'Loading content...')}
                            subheader={runtime?.description}
                        />
                        <CardContent>
                            {runtimeQuery.isLoading ? (
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <CircularProgress size={20} />
                                    <Typography>{t('guest.loadingContent', 'Loading content...')}</Typography>
                                </Stack>
                            ) : null}

                            {runtimeQuery.error instanceof Error ? <Alert severity='error'>{runtimeQuery.error.message}</Alert> : null}

                            {runtime?.type === 'module' ? (
                                moduleCompleted ? (
                                    <Stack spacing={2}>
                                        <Alert severity='success'>
                                            {t('guest.moduleCompleted', 'Module complete. Progress has been recorded for this session.')}
                                        </Alert>
                                        <Stack direction='row' spacing={1} justifyContent='flex-end'>
                                            <Button
                                                variant='outlined'
                                                onClick={() => {
                                                    setModuleCompleted(false)
                                                    setCurrentItemIndex(0)
                                                }}
                                            >
                                                {t('guest.restartModule', 'Restart module')}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                ) : (
                                    <Stack spacing={2}>
                                        <LinearProgress
                                            variant='determinate'
                                            value={totalItems > 0 ? ((currentItemIndex + 1) / totalItems) * 100 : 0}
                                        />
                                        {currentItem?.itemTitle ? <Typography variant='h6'>{currentItem.itemTitle}</Typography> : null}
                                        {renderModuleItem()}
                                        <Stack direction='row' spacing={1} justifyContent='space-between'>
                                            <Button
                                                variant='outlined'
                                                onClick={() => handleMoveModule(currentItemIndex - 1)}
                                                disabled={currentItemIndex === 0}
                                            >
                                                {t('guest.previous', 'Previous')}
                                            </Button>
                                            {currentItemIndex >= totalItems - 1 ? (
                                                <Button variant='contained' onClick={handleCompleteModule}>
                                                    {t('guest.completeModule', 'Complete module')}
                                                </Button>
                                            ) : (
                                                <Button variant='contained' onClick={() => handleMoveModule(currentItemIndex + 1)}>
                                                    {t('guest.next', 'Next')}
                                                </Button>
                                            )}
                                        </Stack>
                                    </Stack>
                                )
                            ) : null}

                            {runtime?.type === 'quiz' ? renderQuiz(runtime) : null}

                            {submitQuizMutation.error instanceof Error ? (
                                <Alert severity='error' sx={{ mt: 2 }}>
                                    {submitQuizMutation.error.message}
                                </Alert>
                            ) : null}
                        </CardContent>
                    </Card>
                )}
            </Box>
        </AppMainLayout>
    )
}
