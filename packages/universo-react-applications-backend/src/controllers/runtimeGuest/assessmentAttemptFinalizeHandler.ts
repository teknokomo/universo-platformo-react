import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { finalizeGuestAssessmentAttempt as finalizeGuestAssessmentAttemptRecord } from '../../services/guestAssessmentAttemptLifecycleService'
import { findGuestAssessmentAttempt, listGuestAssessmentResponses } from '../../persistence/guestAssessmentAttemptStore'
import { UUID_REGEX } from '../../shared/runtimeHelpers'
import { lockGuestAccessLinkWorkspace } from '../../services/guestAccessLinkRevocation'
import type { GuestAssessmentAttemptHandlerDependencies, GuestAssessmentAttemptSupport } from './assessmentAttemptSupport'

export const createFinalizeGuestAssessmentAttemptHandler = (
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
        normalizeAccessLinkDate
    } = dependencies
    const {
        guestAttemptSessionSchema,
        getAttemptCompletionText,
        parseAssessmentAttemptSnapshot,
        resolveGuestAttemptAccess,
        revalidateGuestAttemptAccess,
        toGuestAttemptState
    } = support
    const finalizeGuestAssessmentAttempt = async (req: Request, res: Response) => {
        const { applicationId, attemptId } = req.params
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const config = requirePublicGuestRuntimeConfig(ctx, res)
            if (!config) return
            if (!UUID_REGEX.test(attemptId)) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            const parsed = guestAttemptSessionSchema.safeParse(req.body)
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
                await lockGuestAccessLinkWorkspace({
                    executor: tx,
                    schemaName: ctx.schemaName,
                    workspacesEnabled: ctx.workspacesEnabled,
                    workspaceId: access.link.workspaceId
                })
                if (!(await lockPublicApplicationForGuestAssessment(tx, applicationId))) {
                    return { responseStatus: 404 as const, attemptState: null }
                }
                const currentLink = await loadCurrentAccessLinkRecordForUpdate(
                    tx,
                    ctx.schemaName,
                    config,
                    ctx.workspacesEnabled,
                    access.link
                )
                if (!currentLink) return { responseStatus: 404 as const, attemptState: null }
                if (!currentLink.isActive) return { responseStatus: 404 as const, attemptState: null }
                if (
                    !(await revalidateGuestAttemptAccess(tx, ctx, config, parsed.data.participantId, parsed.data.sessionToken, currentLink))
                ) {
                    return { responseStatus: 404 as const, attemptState: null }
                }

                await lockPublicGuestRuntimeKey(tx, `${ctx.schemaName}:guest-attempt:${currentLink.workspaceId ?? ''}:${attemptId}`)
                const attempt = await findGuestAssessmentAttempt(tx, persistence.attemptTable, attemptId, parsed.data.participantId, true)
                if (!attempt || attempt.accessLinkId !== currentLink.id) return { responseStatus: 404 as const, attemptState: null }

                if (String(attempt.status).toLowerCase() === 'started') {
                    const deadline = normalizeAccessLinkDate(attempt.deadlineAt)
                    const isExpired = Boolean(deadline && Date.parse(deadline) <= Date.now())
                    if (!isExpired) {
                        const questions = parseAssessmentAttemptSnapshot(attempt.questionsSnapshot)
                        const responses = await listGuestAssessmentResponses(tx, persistence.responseTable, attemptId)
                        if (responses.length < questions.length) {
                            return { responseStatus: 409 as const, attemptState: null }
                        }
                    }
                }

                const finalizedAttempt =
                    (await finalizeGuestAssessmentAttemptRecord(
                        tx,
                        persistence.attemptTable,
                        persistence.responseTable,
                        attemptId,
                        parsed.data.participantId,
                        'submitted'
                    )) ?? attempt
                const completionText = await getAttemptCompletionText(
                    tx,
                    ctx.schemaName,
                    config,
                    currentLink,
                    String(finalizedAttempt.quizId),
                    locale
                )
                return {
                    responseStatus: 200 as const,
                    attemptState: await toGuestAttemptState(
                        tx,
                        persistence.attemptTable,
                        persistence.responseTable,
                        finalizedAttempt,
                        locale,
                        completionText
                    )
                }
            })

            if (outcome.responseStatus === 404) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            if (outcome.responseStatus === 409) {
                res.status(409).json({ error: 'Answer every question before finishing the quiz' })
                return
            }
            res.json(outcome.attemptState)
        })
    }

    return finalizeGuestAssessmentAttempt
}
