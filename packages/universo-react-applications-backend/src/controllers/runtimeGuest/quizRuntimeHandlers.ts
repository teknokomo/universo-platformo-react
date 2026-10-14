import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { resolvePublicRuntimeSchema, type PublicRuntimeSchemaContext } from '../../shared/publicRuntimeAccess'
import { resolvePublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'
import { resolveGuestAssessmentRuntimeTables } from '../../services/guestAssessmentRuntimeTables'
import { finalizeGuestAssessmentAttempt as finalizeGuestAssessmentAttemptRecord } from '../../services/guestAssessmentAttemptLifecycleService'
import { lockGuestAccessLinkWorkspace } from '../../services/guestAccessLinkRevocation'
import { findGuestAssessmentAttempt, listGuestAssessmentAttemptIdentities } from '../../persistence/guestAssessmentAttemptStore'
import type { AccessLinkRecord } from './shared'
import { publicRuntimeQuerySchema, readGuestRuntimeSessionRequest, resolveGuestRuntimeLocale } from './shared'
import type { RuntimeGuestServices } from './services'

export const createPublicQuizAccessLinkAvailabilityCheck = (services: RuntimeGuestServices) => {
    const { resolveAccessLinkRecordBy, resolveAllowedRuntimeTarget, buildQuizPayload } = services
    const isPublicQuizAccessLinkAvailable = async (
        executor: DbExecutor,
        applicationId: string,
        accessLinkId: string,
        slug: string,
        workspaceId: string | null
    ): Promise<boolean> => {
        const ctx = await resolvePublicRuntimeSchema(() => executor, applicationId)
        if (!ctx) return false
        if (ctx.workspacesEnabled !== (workspaceId !== null)) return false

        const runtimeConfig = resolvePublicGuestRuntimeConfig(ctx.settings)
        if (!runtimeConfig) return false

        const validateInContext = async (runtimeContext: PublicRuntimeSchemaContext): Promise<boolean> => {
            const link = await resolveAccessLinkRecordBy(
                runtimeContext.manager,
                runtimeContext.schemaName,
                runtimeConfig,
                runtimeContext.workspacesEnabled,
                { type: 'id', value: accessLinkId },
                false,
                workspaceId
            )
            if (!link || link.id !== accessLinkId || link.slug !== slug || !link.isActive) return false
            if (!['quiz', 'assessment'].includes(link.targetType.toLowerCase())) return false

            const target = await resolveAllowedRuntimeTarget(
                runtimeContext.manager,
                runtimeContext.schemaName,
                runtimeConfig,
                link,
                'quiz',
                link.targetId
            )
            if (!target || target.type !== 'quiz') return false

            const quiz = await buildQuizPayload(
                runtimeContext.manager,
                runtimeContext.schemaName,
                runtimeConfig,
                target.id,
                true,
                'en',
                link.workspaceId
            )
            return Boolean(
                quiz &&
                    quiz.questions.length > 0 &&
                    quiz.questions.every(
                        (question) =>
                            question.options.length >= 2 &&
                            question.options.filter((option) => 'isCorrect' in option && option.isCorrect).length === 1
                    )
            )
        }

        if (ctx.workspacesEnabled) {
            return ctx.manager.transaction((tx) => validateInContext({ ...ctx, manager: tx }))
        }
        return validateInContext(ctx)
    }

    return isPublicQuizAccessLinkAvailable
}

export const createPublicQuizAccessLinkLockCheck = (services: RuntimeGuestServices) => {
    const { resolveAccessLinkRecordBy } = services

    return async (
        executor: DbExecutor,
        applicationId: string,
        accessLinkId: string,
        slug: string,
        workspaceId: string | null
    ): Promise<boolean> => {
        const ctx = await resolvePublicRuntimeSchema(() => executor, applicationId)
        if (!ctx || ctx.workspacesEnabled !== (workspaceId !== null)) return false

        const runtimeConfig = resolvePublicGuestRuntimeConfig(ctx.settings)
        if (!runtimeConfig) return false

        const link = await resolveAccessLinkRecordBy(
            ctx.manager,
            ctx.schemaName,
            runtimeConfig,
            ctx.workspacesEnabled,
            { type: 'id', value: accessLinkId },
            true,
            workspaceId
        )

        return Boolean(
            link &&
                link.id === accessLinkId &&
                link.slug === slug &&
                link.isActive &&
                ['quiz', 'assessment'].includes(link.targetType.toLowerCase())
        )
    }
}

export const createGuestRuntimeHandler = (services: RuntimeGuestServices) => {
    const {
        withPublicRuntimeContext,
        requirePublicGuestRuntimeConfig,
        validateGuestSession,
        setPublicWorkspaceContext,
        loadAccessLinkRecord,
        loadAccessLinkRecordBy,
        loadCurrentAccessLinkRecordForUpdate,
        assertAccessLinkAvailable,
        resolveAllowedRuntimeTarget,
        buildQuizPayload,
        buildContentPayload
    } = services
    const getRuntime = async (req: Request, res: Response) => {
        res.setHeader('Cache-Control', 'no-store')
        const { applicationId } = req.params
        let quizIntakeVerified = false
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
            if (!runtimeConfig) return
            const parsed = publicRuntimeQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
                return
            }
            const localeResult = resolveGuestRuntimeLocale(req.query.locale)
            if (!localeResult.valid) {
                res.status(400).json({ error: 'Invalid locale' })
                return
            }
            const locale = localeResult.locale
            const guestSessionRequest = readGuestRuntimeSessionRequest(req)
            if (guestSessionRequest && 'error' in guestSessionRequest) {
                res.status(400).json({ error: guestSessionRequest.error })
                return
            }
            let link: AccessLinkRecord | null = null

            if (guestSessionRequest) {
                const session = await validateGuestSession(
                    ctx.manager,
                    ctx.schemaName,
                    ctx.workspacesEnabled,
                    runtimeConfig,
                    guestSessionRequest.participantId,
                    guestSessionRequest.sessionToken
                )
                if (!session.isValid || !session.accessLinkId) {
                    res.status(403).json({ error: 'Guest session is invalid or expired' })
                    return
                }
                quizIntakeVerified = session.quizIntakeVerified

                if (ctx.workspacesEnabled) {
                    const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, session.workspaceId)
                    if (!hasWorkspace) {
                        res.status(403).json({ error: 'Guest session workspace is not available' })
                        return
                    }
                }

                link = await loadAccessLinkRecordBy(
                    ctx.manager,
                    ctx.schemaName,
                    runtimeConfig,
                    { type: 'id', value: session.accessLinkId },
                    session.workspaceId,
                    true
                )
                if (!link) {
                    res.status(403).json({ error: 'Guest session is invalid or expired' })
                    return
                }
                if (link.slug !== parsed.data.slug) {
                    res.status(403).json({ error: 'Guest session does not match this access link' })
                    return
                }
            } else {
                link = await loadAccessLinkRecord(ctx.manager, ctx.schemaName, runtimeConfig, ctx.workspacesEnabled, parsed.data.slug, true)
            }

            if (!link) {
                res.status(404).json({ error: 'Access link not found' })
                return
            }

            if (ctx.workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, link.workspaceId)
                if (!hasWorkspace) {
                    res.status(404).json({ error: 'Access link not found' })
                    return
                }
            }

            const availability = assertAccessLinkAvailable(link, { enforceQuota: false })
            if (!availability.ok && !guestSessionRequest) {
                res.status(availability.status).json({ error: availability.error })
                return
            }

            const linkTargetsQuiz = link.targetType === 'quiz' || link.targetType === 'assessment'
            const requestTargetsQuiz = parsed.data.targetType === 'quiz' || parsed.data.targetType === 'assessment'
            if (!guestSessionRequest && (linkTargetsQuiz || requestTargetsQuiz)) {
                res.status(403).json({ error: 'Guest session is required to access quiz questions' })
                return
            }

            const resolvedTarget = await resolveAllowedRuntimeTarget(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                link,
                parsed.data.targetType,
                parsed.data.targetId
            )
            if (!resolvedTarget) {
                res.status(403).json({ error: 'Requested runtime target is not available for this access link' })
                return
            }
            if (resolvedTarget.type === 'quiz' && !quizIntakeVerified) {
                res.status(403).json({ error: 'Quiz access requires recorded guest consent', code: 'GUEST_QUIZ_INTAKE_REQUIRED' })
                return
            }
            if (resolvedTarget.type === 'quiz' && !guestSessionRequest) {
                res.status(403).json({ error: 'Guest session is required to access quiz questions' })
                return
            }

            if (!availability.ok) {
                if (!guestSessionRequest || resolvedTarget.type !== 'quiz') {
                    res.status(availability.status).json({ error: availability.error })
                    return
                }

                const persistence = await resolveGuestAssessmentRuntimeTables(ctx.manager, ctx.schemaName, runtimeConfig, link.workspaceId)
                if (!persistence) {
                    res.status(availability.status).json({ error: availability.error })
                    return
                }
                const attempts = await listGuestAssessmentAttemptIdentities(
                    ctx.manager,
                    persistence.attemptTable,
                    guestSessionRequest.participantId,
                    resolvedTarget.id
                )
                const existingAttempt = [...attempts].reverse().find((attempt) => String(attempt.accessLinkId ?? '') === link.id)
                if (!existingAttempt) {
                    res.status(availability.status).json({ error: availability.error })
                    return
                }

                if (!link.isActive && String(existingAttempt.status ?? '').toLowerCase() === 'started') {
                    await lockGuestAccessLinkWorkspace({
                        executor: ctx.manager,
                        schemaName: ctx.schemaName,
                        workspacesEnabled: ctx.workspacesEnabled,
                        workspaceId: link.workspaceId
                    })
                    const currentLink = await loadCurrentAccessLinkRecordForUpdate(
                        ctx.manager,
                        ctx.schemaName,
                        runtimeConfig,
                        ctx.workspacesEnabled,
                        link
                    )
                    if (!currentLink) {
                        res.status(404).json({ error: 'Access link not found' })
                        return
                    }
                    const attempt = await findGuestAssessmentAttempt(
                        ctx.manager,
                        persistence.attemptTable,
                        existingAttempt.id,
                        guestSessionRequest.participantId,
                        false
                    )
                    if (!attempt || attempt.accessLinkId !== currentLink.id) {
                        res.status(404).json({ error: 'Quiz attempt not found' })
                        return
                    }
                    if (String(attempt.status ?? '').toLowerCase() === 'started') {
                        await finalizeGuestAssessmentAttemptRecord(
                            ctx.manager,
                            persistence.attemptTable,
                            persistence.responseTable,
                            attempt.id,
                            guestSessionRequest.participantId,
                            'revoked'
                        )
                    }
                }
            }

            if (!link.isActive) {
                res.status(403).json({ error: 'Access link is inactive' })
                return
            }

            const payload =
                resolvedTarget.type === 'quiz'
                    ? await buildQuizPayload(
                          ctx.manager,
                          ctx.schemaName,
                          runtimeConfig,
                          resolvedTarget.id,
                          false,
                          locale,
                          link.workspaceId,
                          false
                      )
                    : await buildContentPayload(ctx.manager, ctx.schemaName, runtimeConfig, resolvedTarget.id, locale, link.workspaceId)
            if (!payload) {
                res.status(404).json({ error: 'Runtime target not found' })
                return
            }

            res.json(payload)
        })
    }

    return getRuntime
}
