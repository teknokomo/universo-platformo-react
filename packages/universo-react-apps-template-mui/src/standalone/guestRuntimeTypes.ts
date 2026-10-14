// Guest runtime payload and view contracts.

import type { GuestIntakePolicy } from '@universo-react/types'

export type { GuestIntakePolicy } from '@universo-react/types'

export type GuestCaptchaConfig = {
    enabled: boolean
    siteKey: string | null
    testMode: boolean
}

export type GuestSession = {
    participantId: string
    studentId?: string
    sessionToken: string
}

export type GuestAccessLink = {
    id: string
    title?: string
    targetType: 'content' | 'quiz'
    targetId: string
    intake?: GuestIntakePolicy
}

export type GuestTranslate = (key: string, fallback: string) => string

export type GuestErrorFormatter = (error: unknown, key: string, fallback: string) => string

export type GuestFetchWithPublicCsrf = (input: RequestInfo | URL, init: RequestInit) => Promise<Response>

export type GuestRuntimeContent = {
    type: 'content'
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

export type GuestRuntimeQuiz = {
    type: 'quiz'
    id: string
    title: string
    description?: string
    passingScorePercent?: number
    maxAttempts?: number | string | null
    timeLimitSeconds?: number | null
    questionCount: number
    questions: Array<{
        id: string
        prompt: string
        options: Array<{ id: string; label: string }>
    }>
}

export type GuestRuntimePayload = GuestRuntimeContent | GuestRuntimeQuiz

export type GuestQuizQuestion = {
    id: string
    prompt: string
    options: Array<{ id: string; label: string }>
}

export type GuestQuizResult = {
    correctCount: number | null
    totalQuestions: number | null
    passed: boolean | null
    finishedReason: string
    completionText: string
}

export type GuestQuizAttempt = {
    attemptId: string
    attemptNumber: number | null
    status: 'in_progress' | 'completed'
    currentQuestionIndex: number
    totalQuestions: number
    answeredCount: number
    deadlineAt: string | null
    serverNow: string | null
    questions: GuestQuizQuestion[]
    result: GuestQuizResult | null
    resumed: boolean
}
