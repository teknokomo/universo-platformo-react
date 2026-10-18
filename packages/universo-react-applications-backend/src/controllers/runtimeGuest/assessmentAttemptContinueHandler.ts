import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { isUuidV7 } from '@universo-react/utils'
import { z } from 'zod'
import { finalizeGuestAssessmentAttempt } from '../../services/guestAssessmentAttemptLifecycleService'
import { findGuestAssessmentAttempt, updateGuestAssessmentAttempt } from '../../persistence/guestAssessmentAttemptStore'
import { resumeAssessmentAttemptTimer } from '../../services/assessmentAttemptTiming'
import { lockGuestAccessLinkWorkspace } from '../../services/guestAccessLinkRevocation'
import type { GuestAssessmentAttemptHandlerDependencies, GuestAssessmentAttemptSupport } from './assessmentAttemptSupport'

export const createContinueGuestAssessmentAttemptHandler = (
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
        lockPublicGuestRuntimeKey
    } = dependencies
    const { guestAttemptSessionSchema, resolveGuestAttemptAccess, revalidateGuestAttemptAccess, parseAttemptRuntime, toGuestAttemptState } =
        support
    const continueGuestAssessmentAttemptSchema = guestAttemptSessionSchema
        .extend({ phaseRevision: z.number().int().nonnegative().max(1100) })
        .strict()

    const continueGuestAssessmentAttempt = async (req: Request, res: Response) => {
        res.setHeader('Cache-Control', 'no-store')
        const { applicationId, attemptId } = req.params
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const config = requirePublicGuestRuntimeConfig(ctx, res)
            if (!config) return
            if (!isUuidV7(attemptId)) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            const parsed = continueGuestAssessmentAttemptSchema.safeParse(req.body)
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

            const outcome = await ctx.manager.transaction(async (tx: DbExecutor) => {
                if (!(await lockPublicApplicationForGuestAssessment(tx, applicationId))) return { status: 404 as const, state: null }
                await lockGuestAccessLinkWorkspace({
                    executor: tx,
                    schemaName: ctx.schemaName,
                    workspacesEnabled: ctx.workspacesEnabled,
                    workspaceId: access.link.workspaceId
                })
                const currentLink = await loadCurrentAccessLinkRecordForUpdate(
                    tx,
                    ctx.schemaName,
                    config,
                    ctx.workspacesEnabled,
                    access.link
                )
                if (!currentLink || !currentLink.isActive) return { status: 404 as const, state: null }
                if (
                    !(await revalidateGuestAttemptAccess(tx, ctx, config, parsed.data.participantId, parsed.data.sessionToken, currentLink))
                ) {
                    return { status: 404 as const, state: null }
                }
                await lockPublicGuestRuntimeKey(tx, `${ctx.schemaName}:guest-attempt:${currentLink.workspaceId ?? ''}:${attemptId}`)
                const attempt = await findGuestAssessmentAttempt(tx, persistence.attemptTable, attemptId, parsed.data.participantId, true)
                if (!attempt || attempt.accessLinkId !== currentLink.id) return { status: 404 as const, state: null }

                const currentState = async (currentAttempt: Record<string, unknown> & { id: string }) =>
                    toGuestAttemptState(tx, persistence.attemptTable, persistence.responseTable, currentAttempt, locale)
                const { flow, runtimeState } = parseAttemptRuntime(attempt)
                if (String(attempt.status).toLowerCase() !== 'started') {
                    return { status: 409 as const, state: await currentState(attempt) }
                }

                const expectedRevision = parsed.data.phaseRevision
                if (runtimeState.phaseRevision > expectedRevision) {
                    return { status: 200 as const, state: await currentState(attempt) }
                }
                if (runtimeState.phaseRevision < expectedRevision || runtimeState.phase !== 'block_intro' || flow.blocks.length === 0) {
                    return { status: 409 as const, state: await currentState(attempt) }
                }

                const now = new Date()
                let timing = {
                    timerState: runtimeState.timerState,
                    deadlineAt: runtimeState.deadlineAt,
                    frozenRemainingMs: runtimeState.frozenRemainingMs
                }
                if (runtimeState.timerState === 'running') {
                    const deadlineMs = timing.deadlineAt ? Date.parse(timing.deadlineAt) : Number.NaN
                    if (Number.isFinite(deadlineMs) && deadlineMs <= now.getTime()) {
                        const timedOut = await finalizeGuestAssessmentAttempt(
                            tx,
                            persistence.attemptTable,
                            persistence.responseTable,
                            attemptId,
                            parsed.data.participantId,
                            'timed_out',
                            new Date(deadlineMs)
                        )
                        return { status: 200 as const, state: timedOut ? await currentState(timedOut) : null }
                    }
                } else if (runtimeState.timerState === 'paused') {
                    timing = resumeAssessmentAttemptTimer(timing, now)
                }

                const columns = persistence.attemptTable.columns
                const phaseRevision = runtimeState.phaseRevision + 1
                const updates = {
                    [columns.phase]: 'question',
                    [columns.phaseRevision]: phaseRevision,
                    [columns.timerState]: timing.timerState,
                    [columns.deadlineAt]: timing.deadlineAt,
                    [columns.frozenRemainingMs]: timing.frozenRemainingMs
                }
                await updateGuestAssessmentAttempt(
                    tx,
                    persistence.attemptTable,
                    attemptId,
                    parsed.data.participantId,
                    updates,
                    parsed.data.participantId
                )
                return {
                    status: 200 as const,
                    state: await currentState({
                        ...attempt,
                        phase: 'question',
                        phaseRevision,
                        timerState: timing.timerState,
                        deadlineAt: timing.deadlineAt,
                        frozenRemainingMs: timing.frozenRemainingMs
                    })
                }
            })

            if (!outcome.state) {
                res.status(outcome.status).json({ error: 'Quiz attempt not found' })
                return
            }
            if (outcome.status === 409) {
                res.status(409).json({ error: 'Block introduction is no longer current', attempt: outcome.state })
                return
            }
            res.json(outcome.state)
        })
    }

    return continueGuestAssessmentAttempt
}
