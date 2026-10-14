import type { Request, Response } from 'express'
import { ZodError } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import {
    buildAssessmentAttemptSnapshot,
    createAssessmentQuestionSetDigest,
    type SourceAssessmentQuestion
} from '../../services/assessmentAttemptLifecycle'
import { finalizeGuestAssessmentAttempt as finalizeGuestAssessmentAttemptRecord } from '../../services/guestAssessmentAttemptLifecycleService'
import { insertGuestAssessmentRecord, listGuestAssessmentAttempts } from '../../persistence/guestAssessmentAttemptStore'
import { validateRuntimeEntityRecordPolicy } from '../../shared/entityMutationPolicy'
import { lockGuestAccessLinkWorkspace } from '../../services/guestAccessLinkRevocation'
import type { GuestAssessmentAttemptHandlerDependencies, GuestAssessmentAttemptSupport } from './assessmentAttemptSupport'

export const createStartGuestAssessmentAttemptHandler = (
    dependencies: GuestAssessmentAttemptHandlerDependencies,
    support: GuestAssessmentAttemptSupport
) => {
    const {
        withPublicRuntimeContext,
        requirePublicGuestRuntimeConfig,
        resolveAllowedRuntimeTarget,
        buildQuizPayload,
        resolveGuestAssessmentRuntimeTables,
        lockPublicApplicationForGuestAssessment,
        loadCurrentAccessLinkRecordForUpdate,
        lockPublicGuestRuntimeKey,
        createUuidV7,
        assertAccessLinkAvailable,
        resolveGuestRuntimeLocale,
        normalizeAccessLinkDate,
        normalizeAccessLinkNumber
    } = dependencies
    const { startGuestAssessmentAttemptSchema, resolveGuestAttemptAccess, revalidateGuestAttemptAccess, toGuestAttemptState } = support
    const startGuestAssessmentAttempt = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const config = requirePublicGuestRuntimeConfig(ctx, res)
            if (!config) return
            const parsed = startGuestAssessmentAttemptSchema.safeParse(req.body)
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
                return
            }
            const localeResult = resolveGuestRuntimeLocale(req.query.locale)
            if (!localeResult.valid) {
                res.status(400).json({ error: 'Invalid locale' })
                return
            }
            const locale = localeResult.locale
            const access = await resolveGuestAttemptAccess(ctx, config, parsed.data.participantId, parsed.data.sessionToken, res)
            if (!access) return
            const { link } = access
            if (!link.isActive) {
                res.status(403).json({ error: 'Access link is inactive' })
                return
            }
            const allowed = await resolveAllowedRuntimeTarget(
                ctx.manager,
                ctx.schemaName,
                config,
                link,
                'assessment',
                parsed.data.assessmentId
            )
            if (!allowed || allowed.type !== 'quiz') {
                res.status(403).json({ error: 'Quiz is not available for this guest session' })
                return
            }

            const quiz = await buildQuizPayload(
                ctx.manager,
                ctx.schemaName,
                config,
                parsed.data.assessmentId,
                true,
                locale,
                link.workspaceId
            )
            if (!quiz || quiz.type !== 'quiz' || quiz.questions.length === 0) {
                res.status(404).json({ error: 'Quiz is not available' })
                return
            }
            const persistence = await resolveGuestAssessmentRuntimeTables(ctx.manager, ctx.schemaName, config, link.workspaceId)
            if (!persistence) {
                res.status(400).json({ error: 'Assessment attempt storage is not available' })
                return
            }
            if (
                validateRuntimeEntityRecordPolicy(res, persistence.attemptBinding.config) ||
                validateRuntimeEntityRecordPolicy(res, persistence.responseBinding.config)
            )
                return

            let activeQuiz = quiz
            let completionText = typeof activeQuiz.completionText === 'string' ? activeQuiz.completionText : ''
            let attemptState: Record<string, unknown> | null = null
            let conflict: 'unavailable' | 'attempt_limit' | null = null
            try {
                await ctx.manager.transaction(async (tx: DbExecutor) => {
                    if (!(await lockPublicApplicationForGuestAssessment(tx, applicationId))) {
                        conflict = 'unavailable'
                        return
                    }
                    await lockGuestAccessLinkWorkspace({
                        executor: tx,
                        schemaName: ctx.schemaName,
                        workspacesEnabled: ctx.workspacesEnabled,
                        workspaceId: link.workspaceId
                    })
                    const currentLink = await loadCurrentAccessLinkRecordForUpdate(tx, ctx.schemaName, config, ctx.workspacesEnabled, link)
                    if (!currentLink || !currentLink.isActive || currentLink.workspaceId !== link.workspaceId) {
                        conflict = 'unavailable'
                        return
                    }
                    const sessionIsStillValid = await revalidateGuestAttemptAccess(
                        tx,
                        ctx,
                        config,
                        parsed.data.participantId,
                        parsed.data.sessionToken,
                        currentLink
                    )
                    if (!sessionIsStillValid) {
                        conflict = 'unavailable'
                        return
                    }
                    const currentAllowedTarget = await resolveAllowedRuntimeTarget(
                        tx,
                        ctx.schemaName,
                        config,
                        currentLink,
                        'assessment',
                        parsed.data.assessmentId,
                        { lockContentNode: true }
                    )
                    if (
                        !currentAllowedTarget ||
                        currentAllowedTarget.type !== 'quiz' ||
                        currentAllowedTarget.id !== parsed.data.assessmentId
                    ) {
                        conflict = 'unavailable'
                        return
                    }
                    const currentQuiz = await buildQuizPayload(
                        tx,
                        ctx.schemaName,
                        config,
                        parsed.data.assessmentId,
                        true,
                        locale,
                        currentLink.workspaceId,
                        true,
                        { lockParentRecord: true }
                    )
                    if (!currentQuiz || currentQuiz.type !== 'quiz' || currentQuiz.questions.length === 0) {
                        conflict = 'unavailable'
                        return
                    }
                    activeQuiz = currentQuiz
                    completionText = typeof activeQuiz.completionText === 'string' ? activeQuiz.completionText : ''
                    await lockPublicGuestRuntimeKey(
                        tx,
                        `${ctx.schemaName}:guest-attempt-allocation:${link.workspaceId ?? ''}:${parsed.data.participantId}:${
                            parsed.data.assessmentId
                        }`
                    )
                    const previousAttempts = await listGuestAssessmentAttempts(
                        tx,
                        persistence.attemptTable,
                        parsed.data.participantId,
                        parsed.data.assessmentId,
                        false
                    )
                    const startedAttempt = [...previousAttempts]
                        .reverse()
                        .find((item) => String(item.status ?? '').toLowerCase() === 'started')
                    if (startedAttempt) {
                        const deadline = normalizeAccessLinkDate(startedAttempt.deadlineAt)
                        let currentAttempt: (Record<string, unknown> & { id: string }) | null
                        if (deadline && Date.parse(deadline) <= Date.now()) {
                            currentAttempt = await finalizeGuestAssessmentAttemptRecord(
                                tx,
                                persistence.attemptTable,
                                persistence.responseTable,
                                startedAttempt.id,
                                parsed.data.participantId,
                                'timed_out'
                            )
                        } else {
                            currentAttempt = startedAttempt
                        }
                        if (currentAttempt) {
                            attemptState = await toGuestAttemptState(
                                tx,
                                persistence.attemptTable,
                                persistence.responseTable,
                                currentAttempt,
                                locale,
                                completionText
                            )
                        }
                        return
                    }

                    const availability = assertAccessLinkAvailable(currentLink, { enforceQuota: false })
                    if (!availability.ok) {
                        conflict = 'unavailable'
                        return
                    }
                    const maxAttempts = normalizeAccessLinkNumber(activeQuiz.maxAttempts)
                    if (maxAttempts !== null && previousAttempts.length >= maxAttempts) {
                        conflict = 'attempt_limit'
                        return
                    }

                    const sourceQuestions = activeQuiz.questions as SourceAssessmentQuestion[]
                    const questionSnapshot = buildAssessmentAttemptSnapshot(sourceQuestions)
                    const now = new Date()
                    const timeLimitSeconds = normalizeAccessLinkNumber(activeQuiz.timeLimitSeconds)
                    const effectiveSeconds = timeLimitSeconds !== null && timeLimitSeconds > 0 ? Math.floor(timeLimitSeconds) : 0
                    const deadlineAt = effectiveSeconds > 0 ? new Date(now.getTime() + effectiveSeconds * 1000).toISOString() : null
                    const id = await createUuidV7(tx)
                    const fields = persistence.attemptTable.columns
                    await insertGuestAssessmentRecord(
                        tx,
                        persistence.attemptTable,
                        {
                            [fields.studentId]: parsed.data.participantId,
                            [fields.quizId]: parsed.data.assessmentId,
                            [fields.attemptNumber]: previousAttempts.length + 1,
                            [fields.startedAt]: now.toISOString(),
                            [fields.submittedAt]: null,
                            [fields.deadlineAt]: deadlineAt,
                            [fields.effectiveTimeLimitSeconds]: effectiveSeconds,
                            [fields.passingScorePercentSnapshot]: activeQuiz.passingScorePercent,
                            [fields.finishedReason]: null,
                            [fields.questionsSnapshot]: JSON.stringify(questionSnapshot),
                            [fields.questionSetDigest]: createAssessmentQuestionSetDigest(questionSnapshot),
                            [fields.accessLinkId]: currentLink.id,
                            [fields.classIdSnapshot]: currentLink.classId,
                            [fields.score]: 0,
                            [fields.scorePercent]: null,
                            [fields.totalQuestions]: questionSnapshot.length,
                            [fields.passed]: false,
                            [fields.status]: 'Started'
                        },
                        id,
                        parsed.data.participantId
                    )
                    const attempt = {
                        id,
                        studentId: parsed.data.participantId,
                        quizId: parsed.data.assessmentId,
                        attemptNumber: previousAttempts.length + 1,
                        startedAt: now.toISOString(),
                        submittedAt: null,
                        deadlineAt,
                        effectiveTimeLimitSeconds: effectiveSeconds,
                        passingScorePercentSnapshot: activeQuiz.passingScorePercent,
                        finishedReason: null,
                        questionsSnapshot: questionSnapshot,
                        questionSetDigest: createAssessmentQuestionSetDigest(questionSnapshot),
                        accessLinkId: currentLink.id,
                        score: 0,
                        totalQuestions: questionSnapshot.length,
                        passed: false,
                        status: 'Started'
                    }
                    attemptState = await toGuestAttemptState(
                        tx,
                        persistence.attemptTable,
                        persistence.responseTable,
                        attempt,
                        locale,
                        completionText
                    )
                })
            } catch (error) {
                if (error instanceof ZodError) {
                    res.status(422).json({ error: 'Quiz configuration is invalid', code: 'GUEST_QUIZ_CONFIGURATION_INVALID' })
                    return
                }
                throw error
            }

            if (conflict) {
                res.status(409).json(
                    conflict === 'attempt_limit'
                        ? { error: 'Quiz attempt limit reached', code: 'GUEST_QUIZ_ATTEMPTS_EXHAUSTED' }
                        : { error: 'Quiz access is no longer available', code: 'GUEST_QUIZ_ACCESS_UNAVAILABLE' }
                )
                return
            }
            if (!attemptState) {
                res.status(409).json({ error: 'Quiz attempt could not be started' })
                return
            }
            res.status(200).json(attemptState)
        })
    }

    return startGuestAssessmentAttempt
}
