import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { validateRequiredGuestCaptcha } from '@universo-react/auth-backend'
import { findGuestSessionIdempotency } from '../../persistence/guestSessionIdempotencyStore'
import { parseGuestIdempotencyKey, hashGuestIdempotencyKey } from '../../services/guestSessionIdempotency'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import { UUID_REGEX } from '../../shared/runtimeHelpers'
import type { PublicRuntimeSchemaContext } from '../../shared/publicRuntimeAccess'
import type { PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'
import type { GuestIntakePolicy } from '@universo-react/types'
import { createGuestSessionSchema } from './guestSessionSchemas'
import type { AccessLinkRecord } from './guestRuntimeData'
import type { RuntimeGuestServices } from './services'

export type GuestSessionIntakeState = {
    captchaVerifiedLinkId: string | null
    idempotencyKey: Buffer | null
    idempotencyKeyHash: string | null
    clientProvidedIdempotencyKey: boolean
}

export const createGuestSessionIntakeState = (): GuestSessionIntakeState => ({
    captchaVerifiedLinkId: null,
    idempotencyKey: null,
    idempotencyKeyHash: null,
    clientProvidedIdempotencyKey: false
})

export const selectVisibleGuestIdentityFields = (
    input: { firstName?: string; lastName?: string; email?: string; phone?: string },
    policy: GuestIntakePolicy
) => ({
    firstName: policy.showFirstName ? input.firstName || undefined : undefined,
    lastName: policy.showLastName ? input.lastName || undefined : undefined,
    email: policy.showEmail ? input.email || undefined : undefined,
    phone: policy.showPhone ? input.phone || undefined : undefined
})

export const isQuizGuestAccessLink = async (
    executor: DbExecutor,
    schemaName: string,
    workspacesEnabled: boolean,
    runtimeConfig: PublicGuestRuntimeConfig,
    link: AccessLinkRecord,
    services: Pick<RuntimeGuestServices, 'setPublicWorkspaceContext' | 'buildContentPayload'>
): Promise<boolean> => {
    const targetType = link.targetType.toLowerCase()
    if (targetType === 'quiz' || targetType === 'assessment') return true
    if (targetType !== 'content') return false

    const contentNodeId = link.contentNodeIdRef ?? link.targetId
    if (!UUID_REGEX.test(contentNodeId)) return false
    if (workspacesEnabled && !(await services.setPublicWorkspaceContext(executor, schemaName, link.workspaceId))) return false

    const content = await services.buildContentPayload(executor, schemaName, runtimeConfig, contentNodeId, 'en', link.workspaceId)
    return content?.type === 'content' && content.contentItems.some((item) => UUID_REGEX.test(item.quizId))
}

type GuestSessionConsentInput = {
    termsAccepted?: boolean
    privacyAccepted?: boolean
}

export const getGuestSessionConsentError = (
    input: GuestSessionConsentInput,
    isQuizAccessLink: boolean,
    clientProvidedIdempotencyKey: boolean
): string | null => {
    const termsAccepted = input.termsAccepted === true
    const privacyAccepted = input.privacyAccepted === true
    if (isQuizAccessLink && !clientProvidedIdempotencyKey) return 'A valid Idempotency-Key header is required'
    if (isQuizAccessLink && (!termsAccepted || !privacyAccepted)) return 'Terms and privacy consent are required for quiz access'

    const anyConsentProvided = input.termsAccepted !== undefined || input.privacyAccepted !== undefined
    if (!isQuizAccessLink && anyConsentProvided && termsAccepted !== privacyAccepted) {
        return 'Terms and privacy consent must be provided together'
    }
    return null
}

type GuestSessionPreflightResult = {
    linkId: string
    captchaEnabled: boolean
    isReplay: boolean
}

export const prepareGuestSessionBeforeTransaction = async (args: {
    req: Request
    res: Response
    ctx: PublicRuntimeSchemaContext
    services: RuntimeGuestServices
    state: GuestSessionIntakeState
}): Promise<void> => {
    const { req, res, ctx, services, state } = args
    const runtimeConfig = services.requirePublicGuestRuntimeConfig(ctx, res)
    if (!runtimeConfig) return

    const parsed = createGuestSessionSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        return
    }

    const rawIdempotencyKey = req.get('Idempotency-Key') ?? undefined
    const clientIdempotencyKey = parseGuestIdempotencyKey(rawIdempotencyKey)
    if (rawIdempotencyKey !== undefined && !clientIdempotencyKey) {
        res.status(400).json({ error: 'A valid Idempotency-Key header is required' })
        return
    }

    const preflight = await ctx.manager.transaction(async (tx): Promise<GuestSessionPreflightResult | null> => {
        const link = await services.loadAccessLinkRecordById(
            tx,
            ctx.schemaName,
            runtimeConfig,
            ctx.workspacesEnabled,
            parsed.data.accessLinkId,
            false,
            parsed.data.workspaceId
        )
        if (!link) {
            res.status(404).json({ error: 'Access link not found' })
            return null
        }
        if (denyRuntimeEntityMutation(res, link.binding.config)) return null

        const isQuizAccessLink = await isQuizGuestAccessLink(tx, ctx.schemaName, ctx.workspacesEnabled, runtimeConfig, link, services)
        const consentError = getGuestSessionConsentError(parsed.data, isQuizAccessLink, Boolean(clientIdempotencyKey))
        if (consentError) {
            res.status(400).json({ error: consentError })
            return null
        }

        const idempotencyKey = clientIdempotencyKey ?? crypto.randomBytes(32)
        const idempotencyKeyHash = hashGuestIdempotencyKey(idempotencyKey)
        state.idempotencyKey = idempotencyKey
        state.idempotencyKeyHash = idempotencyKeyHash
        state.clientProvidedIdempotencyKey = Boolean(clientIdempotencyKey)

        const existing = await findGuestSessionIdempotency(tx, idempotencyKeyHash)
        return { linkId: link.id, captchaEnabled: link.intake.captchaEnabled, isReplay: Boolean(existing) }
    })

    // The preflight transaction must finish before CAPTCHA validation.
    if (!preflight || res.headersSent || preflight.isReplay || !preflight.captchaEnabled) return

    const captchaResult = await validateRequiredGuestCaptcha(parsed.data.captchaToken ?? '', req.ip || req.socket.remoteAddress || '')
    if (!captchaResult.success) {
        res.status(400).json({ error: 'CAPTCHA verification failed' })
        return
    }
    state.captchaVerifiedLinkId = preflight.linkId
}
