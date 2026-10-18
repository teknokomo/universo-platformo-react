import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { finalizeGuestAssessmentAttempt as finalizeGuestAssessmentAttemptRecord } from '../../services/guestAssessmentAttemptLifecycleService'
import {
    findGuestAssessmentAttempt,
    findGuestAssessmentResponse,
    insertGuestAssessmentRecord,
    listGuestAssessmentResponses,
    updateGuestAssessmentAttempt
} from '../../persistence/guestAssessmentAttemptStore'
import { validateRuntimeEntityRecordPolicy } from '../../shared/entityMutationPolicy'
import { UUID_REGEX } from '../../shared/runtimeHelpers'
import { freezeAssessmentAttemptTimer } from '../../services/assessmentAttemptTiming'
import { lockGuestAccessLinkWorkspace } from '../../services/guestAccessLinkRevocation'
import type { GuestAssessmentAttemptHandlerDependencies, GuestAssessmentAttemptSupport } from './assessmentAttemptSupport'

export const createSaveGuestAssessmentAnswerHandler = (
    dependencies: GuestAssessmentAttemptHandlerDependencies,
    support: GuestAssessmentAttemptSupport
) => {
    const {
        withPublicRuntimeContext,
        requirePublicGuestRuntimeConfig,
        resolveGuestRuntimeLocale,
        resolveGuestAssessmentRuntimeTables,
        lockPublicApplicationForGuestAssessment,
        loadCurrentAccessLinkRecordForUpdate,
        lockPublicGuestRuntimeKey,
        createUuidV7,
        normalizeAccessLinkDate
    } = dependencies
    const {
        answerGuestAssessmentQuestionSchema,
        parseAttemptRuntime,
        parseSelectedOptionIds,
        resolveGuestAttemptAccess,
        revalidateGuestAttemptAccess,
        toGuestAttemptState
    } = support
    const saveGuestAssessmentAnswer = async (req: Request, res: Response) => {
        const { applicationId, attemptId } = req.params
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const config = requirePublicGuestRuntimeConfig(ctx, res)
            if (!config) return
            if (!UUID_REGEX.test(attemptId)) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            const parsed = answerGuestAssessmentQuestionSchema.safeParse(req.body)
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
            const persistence = await resolveGuestAssessmentRuntimeTables(ctx.manager, ctx.schemaName, config, access.link.workspaceId)
            if (!persistence) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            if (
                validateRuntimeEntityRecordPolicy(res, persistence.attemptBinding.config) ||
                validateRuntimeEntityRecordPolicy(res, persistence.responseBinding.config)
            )
                return

            const outcome = await ctx.manager.transaction(async (tx: DbExecutor) => {
                await lockGuestAccessLinkWorkspace({
                    executor: tx,
                    schemaName: ctx.schemaName,
                    workspacesEnabled: ctx.workspacesEnabled,
                    workspaceId: access.link.workspaceId
                })
                if (!(await lockPublicApplicationForGuestAssessment(tx, applicationId))) {
                    return { responseStatus: 404, attemptState: null }
                }
                const currentLink = await loadCurrentAccessLinkRecordForUpdate(
                    tx,
                    ctx.schemaName,
                    config,
                    ctx.workspacesEnabled,
                    access.link
                )
                if (!currentLink) return { responseStatus: 404, attemptState: null }
                if (!currentLink.isActive) return { responseStatus: 404, attemptState: null }
                if (
                    !(await revalidateGuestAttemptAccess(tx, ctx, config, parsed.data.participantId, parsed.data.sessionToken, currentLink))
                ) {
                    return { responseStatus: 404, attemptState: null }
                }
                await lockPublicGuestRuntimeKey(tx, `${ctx.schemaName}:guest-attempt:${currentLink.workspaceId ?? ''}:${attemptId}`)
                const attempt = await findGuestAssessmentAttempt(tx, persistence.attemptTable, attemptId, parsed.data.participantId, true)
                if (!attempt || attempt.accessLinkId !== currentLink.id) {
                    return { responseStatus: 404, attemptState: null }
                }
                const buildOutcome = async (responseStatus: number, currentAttempt: Record<string, unknown> & { id: string }) => {
                    return {
                        responseStatus,
                        attemptState: await toGuestAttemptState(
                            tx,
                            persistence.attemptTable,
                            persistence.responseTable,
                            currentAttempt,
                            locale
                        )
                    }
                }
                const isAttemptStarted = String(attempt.status).toLowerCase() === 'started'
                const { questions, flow, runtimeState } = parseAttemptRuntime(attempt)
                const responseSubmittedAt = new Date()
                const question = questions.find((item) => item.id === parsed.data.questionId)
                if (!question) return buildOutcome(isAttemptStarted ? 400 : 409, attempt)
                if (!question.options.some((option) => option.id === parsed.data.optionId)) {
                    return buildOutcome(isAttemptStarted ? 400 : 409, attempt)
                }
                await lockPublicGuestRuntimeKey(
                    tx,
                    `${ctx.schemaName}:guest-answer:${currentLink.workspaceId ?? ''}:${attemptId}:${question.id}`
                )
                const existing = await findGuestAssessmentResponse(tx, persistence.responseTable, attemptId, question.id)
                if (existing) {
                    const selectedIds = parseSelectedOptionIds(existing.selectedOptionIds)
                    if (selectedIds.length === 1 && selectedIds[0] === parsed.data.optionId) return buildOutcome(200, attempt)
                    return buildOutcome(409, attempt)
                }

                if (!isAttemptStarted) return buildOutcome(409, attempt)

                // A retry after a committed final answer in a block must return the committed state,
                // even though that write has already moved the attempt to the next block introduction.
                if (runtimeState.phase !== 'question') return buildOutcome(409, attempt)
                const deadline = normalizeAccessLinkDate(attempt.deadlineAt)
                if (runtimeState.timerState === 'running' && deadline && Date.parse(deadline) <= responseSubmittedAt.getTime()) {
                    const timedOutAttempt = await finalizeGuestAssessmentAttemptRecord(
                        tx,
                        persistence.attemptTable,
                        persistence.responseTable,
                        attemptId,
                        parsed.data.participantId,
                        'timed_out'
                    )
                    return buildOutcome(409, timedOutAttempt ?? attempt)
                }

                const responses = await listGuestAssessmentResponses(tx, persistence.responseTable, attemptId)
                const answered = new Set(responses.map((item) => String(item.questionId)))
                const currentQuestion = questions.find((item) => !answered.has(item.id))
                if (!currentQuestion || currentQuestion.id !== question.id) {
                    return buildOutcome(409, attempt)
                }

                const responseColumns = persistence.responseTable.columns
                const id = await createUuidV7(tx)
                await insertGuestAssessmentRecord(
                    tx,
                    persistence.responseTable,
                    {
                        [responseColumns.studentId]: parsed.data.participantId,
                        [responseColumns.quizId]: String(attempt.quizId),
                        [responseColumns.attemptId]: attemptId,
                        [responseColumns.questionId]: question.id,
                        [responseColumns.selectedOptionIds]: JSON.stringify([parsed.data.optionId]),
                        [responseColumns.isCorrect]:
                            question.options.find((option) => option.id === parsed.data.optionId)?.isCorrect === true,
                        [responseColumns.attemptNumber]: attempt.attemptNumber,
                        [responseColumns.submittedAt]: responseSubmittedAt.toISOString()
                    },
                    id,
                    parsed.data.participantId
                )
                const nextAnswered = new Set([...answered, question.id])
                const nextQuestion = questions.find((item) => !nextAnswered.has(item.id))
                if (!nextQuestion) {
                    const completedAttempt = await finalizeGuestAssessmentAttemptRecord(
                        tx,
                        persistence.attemptTable,
                        persistence.responseTable,
                        attemptId,
                        parsed.data.participantId,
                        'submitted',
                        responseSubmittedAt
                    )
                    return buildOutcome(200, completedAttempt ?? attempt)
                }
                const entersNextBlock = Boolean(
                    nextQuestion &&
                        question.blockKey !== null &&
                        nextQuestion.blockKey !== null &&
                        question.blockKey !== nextQuestion.blockKey
                )
                if (!entersNextBlock) return buildOutcome(200, attempt)

                let timing = {
                    timerState: runtimeState.timerState,
                    deadlineAt: runtimeState.deadlineAt,
                    frozenRemainingMs: runtimeState.frozenRemainingMs
                }
                if (flow.pauseTimerOnBlockIntro && runtimeState.timerState === 'running') {
                    const frozen = freezeAssessmentAttemptTimer(timing, responseSubmittedAt)
                    if ('expiredAt' in frozen) {
                        const timedOutAttempt = await finalizeGuestAssessmentAttemptRecord(
                            tx,
                            persistence.attemptTable,
                            persistence.responseTable,
                            attemptId,
                            parsed.data.participantId,
                            'timed_out',
                            new Date(Date.parse(frozen.expiredAt))
                        )
                        return buildOutcome(200, timedOutAttempt ?? attempt)
                    }
                    timing = frozen.timing
                }
                const phaseRevision = runtimeState.phaseRevision + 1
                const attemptColumns = persistence.attemptTable.columns
                const phaseUpdates = {
                    [attemptColumns.phase]: 'block_intro',
                    [attemptColumns.phaseRevision]: phaseRevision,
                    [attemptColumns.timerState]: timing.timerState,
                    [attemptColumns.deadlineAt]: timing.deadlineAt,
                    [attemptColumns.frozenRemainingMs]: timing.frozenRemainingMs
                }
                await updateGuestAssessmentAttempt(
                    tx,
                    persistence.attemptTable,
                    attemptId,
                    parsed.data.participantId,
                    phaseUpdates,
                    parsed.data.participantId
                )
                return buildOutcome(200, {
                    ...attempt,
                    phase: 'block_intro',
                    phaseRevision,
                    timerState: timing.timerState,
                    deadlineAt: timing.deadlineAt,
                    frozenRemainingMs: timing.frozenRemainingMs
                })
            })

            if (outcome.responseStatus !== 200) {
                if (outcome.attemptState) {
                    res.status(outcome.responseStatus).json({
                        error: 'Answer could not be saved',
                        attempt: outcome.attemptState
                    })
                    return
                }
                res.status(outcome.responseStatus).json({ error: 'Quiz attempt not found' })
                return
            }
            if (!outcome.attemptState) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            res.json({
                ok: true,
                attempt: outcome.attemptState
            })
        })
    }

    return saveGuestAssessmentAnswer
}
