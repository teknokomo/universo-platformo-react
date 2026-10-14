import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { GUEST_PARTICIPANT_ID_HEADER, GUEST_SESSION_TOKEN_HEADER } from './guestRuntimeUtils'
import type { GuestFetchWithPublicCsrf, GuestRuntimePayload, GuestSession, GuestTranslate } from './guestRuntimeTypes'

export type GuestProgressInput = {
    contentNodeId: string
    action: 'view' | 'complete' | 'recalculate'
    contentItemId?: string
}

export type GuestContentController = {
    runtimeQuery: UseQueryResult<GuestRuntimePayload, Error>
    runtime: GuestRuntimePayload | undefined
    currentItemIndex: number
    contentCompleted: boolean
    activeQuizId: string | null
    progressMutation: UseMutationResult<{ ok: boolean } | undefined, Error, GuestProgressInput>
    setCurrentItemIndex: (value: number) => void
    setContentCompleted: (value: boolean) => void
    handleMoveContent: (nextIndex: number) => void
    handleCompleteContent: () => Promise<void>
    handleOpenQuiz: (quizId: string) => void
    handleBackToContent: () => void
}

type UseGuestContentOptions = {
    applicationId: string
    slug: string
    apiBaseUrl: string
    locale: string
    session: GuestSession | null
    linkResolved: boolean
    fetchWithPublicCsrf: GuestFetchWithPublicCsrf
    translate: GuestTranslate
}

export function useGuestContent({
    applicationId,
    slug,
    apiBaseUrl,
    locale,
    session,
    linkResolved,
    fetchWithPublicCsrf,
    translate
}: UseGuestContentOptions): GuestContentController {
    const [currentItemIndex, setCurrentItemIndex] = useState(0)
    const [activeQuizId, setActiveQuizId] = useState<string | null>(null)
    const [contentCompleted, setContentCompleted] = useState(false)
    const contentScope = `${applicationId}:${slug}:${session?.participantId ?? ''}`

    useEffect(() => {
        setCurrentItemIndex(0)
        setActiveQuizId(null)
        setContentCompleted(false)
    }, [contentScope])

    const runtimeQuery = useQuery<GuestRuntimePayload>({
        queryKey: ['guest-runtime', applicationId, slug, locale, session?.participantId ?? null, activeQuizId],
        enabled: Boolean(applicationId && slug && linkResolved && session?.participantId && session.sessionToken),
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
            const response = await fetch(`${apiBaseUrl}/public/a/${applicationId}/runtime?${params.toString()}`, { headers })
            if (!response.ok) {
                throw new Error(translate('guest.errors.runtimeLoad', 'Failed to load public learning content.'))
            }
            return (await response.json()) as GuestRuntimePayload
        }
    })

    const progressMutation = useMutation<{ ok: boolean } | undefined, Error, GuestProgressInput>({
        mutationFn: async (input) => {
            if (!session) return
            const response = await fetchWithPublicCsrf(`${apiBaseUrl}/public/a/${applicationId}/runtime/guest-progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participantId: session.participantId,
                    sessionToken: session.sessionToken,
                    contentNodeId: input.contentNodeId,
                    action: input.action,
                    ...(input.contentItemId ? { contentItemId: input.contentItemId } : {})
                })
            })
            if (!response.ok) {
                throw new Error(translate('guest.errors.progressSave', 'Failed to save content progress.'))
            }
            return (await response.json()) as { ok: boolean }
        }
    })

    const handleMoveContent = useCallback(
        (nextIndex: number) => {
            const runtime = runtimeQuery.data
            if (!runtime || runtime.type !== 'content') return
            const boundedIndex = Math.max(0, Math.min(nextIndex, runtime.contentItems.length - 1))
            setContentCompleted(false)
            setCurrentItemIndex(boundedIndex)
            if (session) {
                const contentItemId = runtime.contentItems[boundedIndex]?.id
                progressMutation.mutate({
                    contentNodeId: runtime.id,
                    action: 'view',
                    ...(contentItemId ? { contentItemId } : {})
                })
            }
        },
        [progressMutation, runtimeQuery.data, session]
    )

    const handleCompleteContent = useCallback(async () => {
        const runtime = runtimeQuery.data
        if (!runtime || runtime.type !== 'content') return
        if (!session) {
            setContentCompleted(true)
            return
        }

        try {
            await progressMutation.mutateAsync({ contentNodeId: runtime.id, action: 'complete' })
            setContentCompleted(true)
        } catch {
            setContentCompleted(false)
        }
    }, [progressMutation, runtimeQuery.data, session])

    const handleOpenQuiz = useCallback((quizId: string) => setActiveQuizId(quizId), [])
    const handleBackToContent = useCallback(() => setActiveQuizId(null), [])

    useEffect(() => {
        if (runtimeQuery.data?.type === 'content') {
            setContentCompleted(false)
        }
    }, [runtimeQuery.data?.id, runtimeQuery.data?.type])

    return {
        runtimeQuery,
        runtime: runtimeQuery.data,
        currentItemIndex,
        contentCompleted,
        activeQuizId,
        progressMutation,
        setCurrentItemIndex,
        setContentCompleted,
        handleMoveContent,
        handleCompleteContent,
        handleOpenQuiz,
        handleBackToContent
    }
}
