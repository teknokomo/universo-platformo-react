import type { Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import type { PublicRuntimeSchemaContext } from '../../shared/publicRuntimeAccess'
import { resolveGuestAssessmentRuntimeTables } from '../../services/guestAssessmentRuntimeTables'
import {
    listGuestAssessmentResponses,
    type GuestAssessmentAttemptTable,
    type GuestAssessmentResponseTable
} from '../../persistence/guestAssessmentAttemptStore'
import {
    assessmentAttemptQuestionsSchema,
    toGuestAssessmentAttemptState,
    type AssessmentAttemptQuestion
} from '../../services/assessmentAttemptLifecycle'
import { assessmentAttemptFlowSnapshotSchema, parseAssessmentAttemptRuntimeState } from '../../services/assessmentAttemptFlow'
import { getAssessmentAttemptRemainingMs } from '../../services/assessmentAttemptTiming'
import type { PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'
import type { GuestAssessmentAccessLink } from './accessLinkTypes'
import { normalizeAccessLinkDate, normalizeAccessLinkNumber } from './shared'

export type { GuestAssessmentAccessLink } from './accessLinkTypes'

type GuestAssessmentQuizPayload = {
    type: 'quiz'
    completionText: string
    completionTextSource?: unknown
    questionCount: number
    questions: unknown[]
    blocks?: Array<{ key: string; title: string; introduction: string | null; sortOrder: number }>
    pauseTimerOnBlockIntro?: boolean
    blockRelativeNumbering?: boolean
    maxAttempts: number | null
    timeLimitSeconds: number | null
    passingScorePercent: number | null
}

type GuestRuntimeTarget = { type: 'content' | 'quiz'; id: string }

type GuestAccessLinkAvailability = { ok: true } | { ok: false; status: number; error: string }

type GuestRuntimeLocaleResult = { valid: true; locale: string } | { valid: false }

type GuestSessionValidation = { isValid: boolean; accessLinkId: string | null; workspaceId: string | null }

export type GuestAssessmentAttemptHandlerDependencies = {
    withPublicRuntimeContext: (
        applicationId: string,
        res: Response,
        work: (ctx: PublicRuntimeSchemaContext) => Promise<void>,
        options?: {
            beforeTransaction?: (ctx: PublicRuntimeSchemaContext) => Promise<void>
        }
    ) => Promise<void>
    requirePublicGuestRuntimeConfig: (ctx: PublicRuntimeSchemaContext, res: Response) => PublicGuestRuntimeConfig | null
    validateGuestSession: (
        executor: DbExecutor,
        schemaName: string,
        workspacesEnabled: boolean,
        config: PublicGuestRuntimeConfig,
        participantId: string,
        sessionToken: string
    ) => Promise<GuestSessionValidation & { quizIntakeVerified: boolean }>
    setPublicWorkspaceContext: (executor: DbExecutor, schemaName: string, workspaceId: string | null) => Promise<boolean>
    loadAccessLinkRecordBy: (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        lookup: { type: 'slug'; value: string } | { type: 'id'; value: string },
        workspaceId: string | null,
        forUpdate?: boolean
    ) => Promise<GuestAssessmentAccessLink | null>
    resolveAllowedRuntimeTarget: (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        link: GuestAssessmentAccessLink,
        requestedTargetType?: 'content' | 'assessment' | 'quiz',
        requestedTargetId?: string,
        options?: { lockContentNode?: boolean }
    ) => Promise<GuestRuntimeTarget | null>
    buildQuizPayload: (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        quizId: string,
        includeAnswers: boolean,
        locale: string,
        workspaceId?: string | null,
        includeQuestions?: boolean,
        options?: { lockParentRecord?: boolean; includeCompletionTextSource?: boolean }
    ) => Promise<GuestAssessmentQuizPayload | null>
    resolveGuestAssessmentRuntimeTables: typeof resolveGuestAssessmentRuntimeTables
    lockPublicApplicationForGuestAssessment: (executor: DbExecutor, applicationId: string) => Promise<boolean>
    loadCurrentAccessLinkRecordForUpdate: (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        workspacesEnabled: boolean,
        link: GuestAssessmentAccessLink
    ) => Promise<GuestAssessmentAccessLink | null>
    lockPublicGuestRuntimeKey: (executor: DbExecutor, key: string) => Promise<void>
    createUuidV7: (executor: DbExecutor) => Promise<string>
    assertAccessLinkAvailable: (link: GuestAssessmentAccessLink, options: { enforceQuota: boolean }) => GuestAccessLinkAvailability
    resolveGuestRuntimeLocale: (value: unknown) => GuestRuntimeLocaleResult
    normalizeAccessLinkDate: (value: unknown) => string | null
    normalizeAccessLinkNumber: (value: unknown) => number | null
    guestParticipantIdHeader: string
    legacyGuestStudentIdHeader: string
    guestSessionTokenHeader: string
    maxGuestSessionTokenLength: number
}

export const createGuestAssessmentAttemptSupport = (dependencies: GuestAssessmentAttemptHandlerDependencies) => {
    const { validateGuestSession, setPublicWorkspaceContext, loadAccessLinkRecordBy, maxGuestSessionTokenLength } = dependencies
    const MAX_GUEST_ANSWER_ID_LENGTH = 128
    const guestAttemptSessionSchema = z.object({
        participantId: z.string().uuid(),
        sessionToken: z.string().trim().min(1).max(maxGuestSessionTokenLength)
    })

    const startGuestAssessmentAttemptSchema = guestAttemptSessionSchema.extend({ assessmentId: z.string().uuid() }).strict()

    const answerGuestAssessmentQuestionSchema = guestAttemptSessionSchema
        .extend({
            questionId: z.string().uuid(),
            optionId: z.string().trim().min(1).max(MAX_GUEST_ANSWER_ID_LENGTH)
        })
        .strict()

    const parseAssessmentAttemptSnapshot = (value: unknown): AssessmentAttemptQuestion[] => {
        let decoded = value
        if (typeof value === 'string') {
            try {
                decoded = JSON.parse(value)
            } catch {
                throw new Error('Stored assessment snapshot is invalid')
            }
        }
        return assessmentAttemptQuestionsSchema.parse(decoded)
    }

    const parseAssessmentAttemptFlowSnapshot = (value: unknown) => {
        let decoded = value
        if (typeof value === 'string') {
            try {
                decoded = JSON.parse(value)
            } catch {
                throw new Error('Stored assessment flow snapshot is invalid')
            }
        }
        return assessmentAttemptFlowSnapshotSchema.parse(decoded)
    }

    const parseAttemptRuntime = (attempt: Record<string, unknown>) => {
        const questions = parseAssessmentAttemptSnapshot(attempt.questionsSnapshot)
        const flow = parseAssessmentAttemptFlowSnapshot(attempt.flowSnapshot)
        const runtimeState = parseAssessmentAttemptRuntimeState({
            phase: String(attempt.phase ?? ''),
            phaseRevision: normalizeAccessLinkNumber(attempt.phaseRevision) ?? Number.NaN,
            timerState: String(attempt.timerState ?? ''),
            deadlineAt: normalizeAccessLinkDate(attempt.deadlineAt),
            frozenRemainingMs: normalizeAccessLinkNumber(attempt.frozenRemainingMs),
            effectiveTimeLimitSeconds: Math.floor(normalizeAccessLinkNumber(attempt.effectiveTimeLimitSeconds) ?? 0),
            status: String(attempt.status ?? ''),
            flow,
            questionBlockKeys: questions.map((question) => question.blockKey)
        })
        return { questions, flow, runtimeState }
    }

    const parseSelectedOptionIds = (value: unknown): string[] => {
        let decoded = value
        if (typeof value === 'string') {
            try {
                decoded = JSON.parse(value)
            } catch {
                return []
            }
        }
        return Array.isArray(decoded) ? decoded.filter((id): id is string => typeof id === 'string') : []
    }

    const toGuestAttemptState = async (
        executor: DbExecutor,
        attemptTable: GuestAssessmentAttemptTable,
        responseTable: GuestAssessmentResponseTable,
        attempt: Record<string, unknown> & { id: string },
        locale: string
    ) => {
        const { questions, flow, runtimeState } = parseAttemptRuntime(attempt)
        const storedResponses = await listGuestAssessmentResponses(executor, responseTable, attempt.id)
        const answeredQuestionIds = storedResponses.map((response) => String(response.questionId))
        const rawStatus = String(attempt.status ?? 'Started')
        const finishedReason = typeof attempt.finishedReason === 'string' ? attempt.finishedReason : null
        const isRevoked = rawStatus.toLowerCase() === 'revoked' || finishedReason === 'revoked'
        const result =
            rawStatus.toLowerCase() === 'started'
                ? null
                : {
                      score: normalizeAccessLinkNumber(attempt.score) ?? 0,
                      total: normalizeAccessLinkNumber(attempt.totalQuestions) ?? questions.length,
                      passed: attempt.passed === true,
                      finishedReason: finishedReason ?? (rawStatus.toLowerCase() === 'timedout' ? 'timed_out' : 'submitted')
                  }
        const publicStatus =
            rawStatus.toLowerCase() === 'started' ? 'in_progress' : rawStatus.toLowerCase() === 'timedout' ? 'timed_out' : 'completed'
        const startedAt = normalizeAccessLinkDate(attempt.startedAt) ?? new Date(0).toISOString()
        const serverNow = new Date()
        const remainingMs = getAssessmentAttemptRemainingMs(
            {
                timerState: runtimeState.timerState,
                deadlineAt: runtimeState.deadlineAt,
                frozenRemainingMs: runtimeState.frozenRemainingMs
            },
            serverNow
        )
        const state = toGuestAssessmentAttemptState({
            attemptId: attempt.id,
            attemptNumber: normalizeAccessLinkNumber(attempt.attemptNumber) ?? 1,
            status: publicStatus,
            startedAt,
            deadlineAt: runtimeState.deadlineAt,
            questions,
            answeredQuestionIds,
            flow,
            phase: runtimeState.phase,
            phaseRevision: runtimeState.phaseRevision,
            timerState: runtimeState.timerState,
            remainingMs,
            locale,
            result
        })
        return {
            ...state,
            ...(isRevoked ? { completionText: '' } : {}),
            serverNow: serverNow.toISOString(),
            locale
        }
    }

    const resolveGuestAttemptAccess = async (
        ctx: PublicRuntimeSchemaContext,
        config: PublicGuestRuntimeConfig,
        participantId: string,
        sessionToken: string,
        res: Response
    ) => {
        res.setHeader('Cache-Control', 'no-store')
        const session = await validateGuestSession(ctx.manager, ctx.schemaName, ctx.workspacesEnabled, config, participantId, sessionToken)
        if (!session.isValid || !session.accessLinkId) {
            res.status(403).json({ error: 'Guest session is invalid or expired' })
            return null
        }
        if (!session.quizIntakeVerified) {
            res.status(403).json({ error: 'Quiz access requires recorded guest consent', code: 'GUEST_QUIZ_INTAKE_REQUIRED' })
            return null
        }

        if (ctx.workspacesEnabled) {
            const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, session.workspaceId)
            if (!hasWorkspace) {
                res.status(403).json({ error: 'Guest session workspace is not available' })
                return null
            }
        }

        const link = await loadAccessLinkRecordBy(
            ctx.manager,
            ctx.schemaName,
            config,
            { type: 'id', value: session.accessLinkId },
            session.workspaceId
        )
        if (!link) {
            res.status(403).json({ error: 'Guest session is invalid or expired' })
            return null
        }

        if (ctx.workspacesEnabled) {
            const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, link.workspaceId)
            if (!hasWorkspace) {
                res.status(403).json({ error: 'Guest session workspace is not available' })
                return null
            }
        }

        return { session, link }
    }

    const revalidateGuestAttemptAccess = async (
        executor: DbExecutor,
        ctx: PublicRuntimeSchemaContext,
        config: PublicGuestRuntimeConfig,
        participantId: string,
        sessionToken: string,
        link: GuestAssessmentAccessLink
    ): Promise<boolean> => {
        const session = await validateGuestSession(executor, ctx.schemaName, ctx.workspacesEnabled, config, participantId, sessionToken)
        const normalizeId = (value: string | null | undefined): string | null => value?.toLowerCase() ?? null

        return (
            session.isValid &&
            normalizeId(session.accessLinkId) === normalizeId(link.id) &&
            normalizeId(session.workspaceId) === normalizeId(link.workspaceId) &&
            session.quizIntakeVerified
        )
    }

    return {
        guestAttemptSessionSchema,
        startGuestAssessmentAttemptSchema,
        answerGuestAssessmentQuestionSchema,
        parseAssessmentAttemptSnapshot,
        parseAssessmentAttemptFlowSnapshot,
        parseAttemptRuntime,
        parseSelectedOptionIds,
        toGuestAttemptState,
        resolveGuestAttemptAccess,
        revalidateGuestAttemptAccess
    }
}

export type GuestAssessmentAttemptSupport = ReturnType<typeof createGuestAssessmentAttemptSupport>
