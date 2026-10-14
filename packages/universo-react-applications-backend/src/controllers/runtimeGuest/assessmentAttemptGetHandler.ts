import type { Request, Response } from 'express'
import { UUID_REGEX } from '../../shared/runtimeHelpers'
import { lockGuestAccessLinkWorkspace } from '../../services/guestAccessLinkRevocation'
import { finalizeGuestAssessmentAttempt as finalizeGuestAssessmentAttemptRecord } from '../../services/guestAssessmentAttemptLifecycleService'
import { findGuestAssessmentAttempt, findGuestAssessmentAttemptIdentity } from '../../persistence/guestAssessmentAttemptStore'
import type { GuestAssessmentAttemptHandlerDependencies, GuestAssessmentAttemptSupport } from './assessmentAttemptSupport'

export const createGetGuestAssessmentAttemptHandler = (
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
        normalizeAccessLinkDate,
        guestParticipantIdHeader: GUEST_PARTICIPANT_ID_HEADER,
        legacyGuestStudentIdHeader: LEGACY_GUEST_STUDENT_ID_HEADER,
        guestSessionTokenHeader: GUEST_SESSION_TOKEN_HEADER,
        maxGuestSessionTokenLength: MAX_GUEST_SESSION_TOKEN_LENGTH
    } = dependencies
    const { getAttemptCompletionText, resolveGuestAttemptAccess, revalidateGuestAttemptAccess, toGuestAttemptState } = support
    const getGuestAssessmentAttempt = async (req: Request, res: Response) => {
        res.setHeader('Cache-Control', 'no-store')
        const { applicationId, attemptId } = req.params
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const config = requirePublicGuestRuntimeConfig(ctx, res)
            if (!config) return
            if (!(await lockPublicApplicationForGuestAssessment(ctx.manager, applicationId))) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            if (!UUID_REGEX.test(attemptId)) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            const participantId = (req.get(GUEST_PARTICIPANT_ID_HEADER) ?? req.get(LEGACY_GUEST_STUDENT_ID_HEADER) ?? '').trim()
            const sessionToken = (req.get(GUEST_SESSION_TOKEN_HEADER) ?? '').trim()
            if (!UUID_REGEX.test(participantId) || !sessionToken || sessionToken.length > MAX_GUEST_SESSION_TOKEN_LENGTH) {
                res.status(400).json({ error: 'Guest session headers must be provided' })
                return
            }
            const localeResult = resolveGuestRuntimeLocale(req.query.locale)
            if (!localeResult.valid) {
                res.status(400).json({ error: 'Invalid locale' })
                return
            }
            const locale = localeResult.locale
            const access = await resolveGuestAttemptAccess(ctx, config, participantId, sessionToken, res)
            if (!access) return
            await lockGuestAccessLinkWorkspace({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                workspacesEnabled: ctx.workspacesEnabled,
                workspaceId: access.link.workspaceId
            })
            const persistence = await resolveGuestAssessmentRuntimeTables(ctx.manager, ctx.schemaName, config, access.link.workspaceId)
            if (!persistence) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            const currentLink = await loadCurrentAccessLinkRecordForUpdate(
                ctx.manager,
                ctx.schemaName,
                config,
                ctx.workspacesEnabled,
                access.link
            )
            if (!currentLink) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            if (!(await revalidateGuestAttemptAccess(ctx.manager, ctx, config, participantId, sessionToken, currentLink))) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            if (!currentLink.isActive && access.link.isActive) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            let attempt: (Record<string, unknown> & { id: string }) | null
            if (currentLink.isActive) {
                attempt = await findGuestAssessmentAttempt(ctx.manager, persistence.attemptTable, attemptId, participantId, false)
            } else {
                const identity = await findGuestAssessmentAttemptIdentity(
                    ctx.manager,
                    persistence.attemptTable,
                    attemptId,
                    participantId,
                    false
                )
                if (!identity || identity.accessLinkId !== currentLink.id) {
                    res.status(404).json({ error: 'Quiz attempt not found' })
                    return
                }
                attempt = await findGuestAssessmentAttempt(ctx.manager, persistence.attemptTable, attemptId, participantId, false)
            }
            if (!attempt || attempt.accessLinkId !== currentLink.id) {
                res.status(404).json({ error: 'Quiz attempt not found' })
                return
            }
            if (!currentLink.isActive && String(attempt.status).toLowerCase() === 'started') {
                attempt =
                    (await finalizeGuestAssessmentAttemptRecord(
                        ctx.manager,
                        persistence.attemptTable,
                        persistence.responseTable,
                        attemptId,
                        participantId,
                        'revoked'
                    )) ?? attempt
            }
            if (
                String(attempt.status).toLowerCase() === 'started' &&
                normalizeAccessLinkDate(attempt.deadlineAt) &&
                Date.parse(normalizeAccessLinkDate(attempt.deadlineAt) as string) <= Date.now()
            ) {
                attempt =
                    (await finalizeGuestAssessmentAttemptRecord(
                        ctx.manager,
                        persistence.attemptTable,
                        persistence.responseTable,
                        attemptId,
                        participantId,
                        'timed_out'
                    )) ?? attempt
            }
            const completionText = await getAttemptCompletionText(
                ctx.manager,
                ctx.schemaName,
                config,
                currentLink,
                String(attempt.quizId),
                locale
            )
            res.json(
                await toGuestAttemptState(ctx.manager, persistence.attemptTable, persistence.responseTable, attempt, locale, completionText)
            )
        })
    }

    return getGuestAssessmentAttempt
}
