import crypto from 'node:crypto'
import type { Request, Response } from 'express'
import { getLegalConsentDocumentVersions } from '@universo-react/auth-backend'
import { insertGuestAssessmentRecord } from '../../persistence/guestAssessmentAttemptStore'
import { encryptGuestSessionSecret, fingerprintGuestIntakePayload } from '../../services/guestSessionIdempotency'
import {
    deleteExpiredGuestSessionIdempotency,
    insertGuestSessionIdempotency,
    purgeExpiredGuestSessionIdempotency
} from '../../persistence/guestSessionIdempotencyStore'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import { lockGuestAccessLinkWorkspace } from '../../services/guestAccessLinkRevocation'
import { coerceRuntimeValue, IDENTIFIER_REGEX } from '../../shared/runtimeHelpers'
import { resolveTopLevelComponents } from '../../shared/publicRuntimeAccess'
import { createGuestSessionSchema } from './guestSessionSchemas'
import { indexByCodename, lockPublicGuestRuntimeKey } from './guestRuntimeData'
import { encodeGuestSessionToken, encodeStoredGuestSessionState, GUEST_SESSION_TTL_MS, hashGuestSessionSecret } from './guestSessionTokens'
import {
    createGuestSessionIntakeState,
    getGuestSessionConsentError,
    isQuizGuestAccessLink,
    prepareGuestSessionBeforeTransaction,
    selectVisibleGuestIdentityFields
} from './guestSessionIntake'
import { resolveGuestSessionReplay } from './guestSessionReplay'
import type { RuntimeGuestServices } from './services'

export const createGuestSessionHandler = (services: RuntimeGuestServices) => {
    const {
        withPublicRuntimeContext,
        requirePublicGuestRuntimeConfig,
        loadAccessLinkRecordById,
        loadCurrentAccessLinkRecordForUpdate,
        assertAccessLinkAvailable,
        consumeAccessLinkUse,
        resolveStudentsBinding,
        createUuidV7
    } = services
    const createGuestSession = async (req: Request, res: Response) => {
        res.setHeader('Cache-Control', 'no-store')
        const { applicationId } = req.params
        let sessionPayload: { participantId: string; studentId: string; sessionToken: string } | null = null
        let responseStatus = 201
        const intakeState = createGuestSessionIntakeState()

        await withPublicRuntimeContext(
            applicationId,
            res,
            async (ctx) => {
                const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
                if (!runtimeConfig) return
                const parsed = createGuestSessionSchema.safeParse(req.body)
                if (!parsed.success) {
                    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
                    return
                }
                const idempotencyKey = intakeState.idempotencyKey
                const idempotencyKeyHash = intakeState.idempotencyKeyHash
                if (!idempotencyKey || !idempotencyKeyHash) {
                    res.status(500).json({ error: 'Guest session intake was not initialized' })
                    return
                }
                const link = await loadAccessLinkRecordById(
                    ctx.manager,
                    ctx.schemaName,
                    runtimeConfig,
                    ctx.workspacesEnabled,
                    parsed.data.accessLinkId,
                    false,
                    parsed.data.workspaceId
                )
                if (!link) {
                    res.status(404).json({ error: 'Access link not found' })
                    return
                }
                if (denyRuntimeEntityMutation(res, link.binding.config)) return

                if (ctx.workspacesEnabled) {
                    const hasWorkspace = await services.setPublicWorkspaceContext(ctx.manager, ctx.schemaName, link.workspaceId)
                    if (!hasWorkspace) {
                        res.status(404).json({ error: 'Access link not found' })
                        return
                    }
                }

                await lockGuestAccessLinkWorkspace({
                    executor: ctx.manager,
                    schemaName: ctx.schemaName,
                    workspacesEnabled: ctx.workspacesEnabled,
                    workspaceId: link.workspaceId
                })

                await lockPublicGuestRuntimeKey(ctx.manager, `guest-intake:${idempotencyKeyHash}`)
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
                const isQuizAccessLink = await isQuizGuestAccessLink(
                    ctx.manager,
                    ctx.schemaName,
                    ctx.workspacesEnabled,
                    runtimeConfig,
                    currentLink,
                    services
                )
                const intakeData = {
                    ...parsed.data,
                    displayName: isQuizAccessLink ? undefined : parsed.data.displayName,
                    ...selectVisibleGuestIdentityFields(parsed.data, currentLink.intake)
                }
                const termsAccepted = parsed.data.termsAccepted === true
                const privacyAccepted = parsed.data.privacyAccepted === true
                const consentError = getGuestSessionConsentError(parsed.data, isQuizAccessLink, intakeState.clientProvidedIdempotencyKey)
                if (consentError) {
                    res.status(400).json({ error: consentError })
                    return
                }
                if (!currentLink.isActive) {
                    res.status(403).json({ error: 'Access link is inactive' })
                    return
                }

                await purgeExpiredGuestSessionIdempotency(ctx.manager)
                const intakePayloadHash = fingerprintGuestIntakePayload(idempotencyKey, intakeData)
                const scope = {
                    applicationId,
                    accessLinkId: currentLink.id,
                    workspaceId: currentLink.workspaceId
                }
                const replay = await resolveGuestSessionReplay({
                    executor: ctx.manager,
                    idempotencyKey,
                    idempotencyKeyHash,
                    payloadHash: intakePayloadHash,
                    scope,
                    currentLink,
                    schemaName: ctx.schemaName,
                    workspacesEnabled: ctx.workspacesEnabled,
                    runtimeConfig,
                    validateGuestSession: services.validateGuestSession
                })
                if (replay.kind === 'conflict') {
                    res.status(409).json({ error: replay.error })
                    return
                }
                if (replay.kind === 'replay') {
                    sessionPayload = replay.sessionPayload
                    responseStatus = 200
                    return
                }
                await deleteExpiredGuestSessionIdempotency(ctx.manager, idempotencyKeyHash)

                const availability = assertAccessLinkAvailable(currentLink, { enforceQuota: true })
                if (!availability.ok) {
                    res.status(availability.status).json({ error: availability.error })
                    return
                }

                if (
                    (currentLink.intake.requireFirstName && !intakeData.firstName) ||
                    (currentLink.intake.requireLastName && !intakeData.lastName)
                ) {
                    res.status(400).json({ error: 'Required name fields are missing' })
                    return
                }
                if (currentLink.intake.requireEmail && !intakeData.email) {
                    res.status(400).json({ error: 'Email is required for this access link' })
                    return
                }
                if (currentLink.intake.requirePhone && !intakeData.phone) {
                    res.status(400).json({ error: 'Phone is required for this access link' })
                    return
                }
                if (currentLink.intake.captchaEnabled && intakeState.captchaVerifiedLinkId !== currentLink.id) {
                    res.status(409).json({ error: 'Access link CAPTCHA settings changed; restart intake' })
                    return
                }

                const recordsConsent = termsAccepted && privacyAccepted
                let legalVersions: ReturnType<typeof getLegalConsentDocumentVersions> | null = null
                if (recordsConsent) {
                    try {
                        legalVersions = getLegalConsentDocumentVersions()
                    } catch {
                        res.status(503).json({ error: 'Legal consent policy is temporarily unavailable' })
                        return
                    }
                }

                const studentsBinding = await resolveStudentsBinding(ctx.manager, ctx.schemaName, runtimeConfig)
                if (!studentsBinding) {
                    res.status(400).json({ error: 'Participant object is not available in this application' })
                    return
                }
                if (denyRuntimeEntityMutation(res, studentsBinding.config)) return

                const attrs = resolveTopLevelComponents(studentsBinding)
                const attrByCodename = indexByCodename(attrs)
                const studentFields = runtimeConfig.fields.participant
                const displayNameAttr = attrByCodename[studentFields.displayName]
                const displayNameColumn = displayNameAttr?.column_name
                const isGuestColumn = attrByCodename[studentFields.isGuest]?.column_name
                const tokenColumn = attrByCodename[studentFields.guestSessionToken]?.column_name
                const firstNameAttr = attrByCodename[studentFields.firstName]
                const lastNameAttr = attrByCodename[studentFields.lastName]
                const emailAttr = attrByCodename[studentFields.email]
                const phoneAttr = attrByCodename[studentFields.phone]
                const termsVersionAttr = attrByCodename[studentFields.termsVersion]
                const termsAcceptedAtAttr = attrByCodename[studentFields.termsAcceptedAt]
                const privacyVersionAttr = attrByCodename[studentFields.privacyVersion]
                const privacyAcceptedAtAttr = attrByCodename[studentFields.privacyAcceptedAt]
                if (!displayNameAttr || !displayNameColumn || !isGuestColumn || !tokenColumn) {
                    res.status(400).json({ error: 'Students object is missing guest session fields' })
                    return
                }
                const displayName =
                    intakeData.displayName || [intakeData.firstName, intakeData.lastName].filter(Boolean).join(' ') || 'Guest'
                const consentAcceptedAt = recordsConsent ? new Date().toISOString() : null
                const quizIntakeIdempotencyKeyHash =
                    isQuizAccessLink && intakeState.clientProvidedIdempotencyKey && legalVersions && consentAcceptedAt
                        ? idempotencyKeyHash
                        : undefined
                const fieldSpecs = [
                    { attr: displayNameAttr, value: displayName, isRequired: true },
                    { attr: firstNameAttr, value: intakeData.firstName ?? null, isRequired: currentLink.intake.requireFirstName },
                    { attr: lastNameAttr, value: intakeData.lastName ?? null, isRequired: currentLink.intake.requireLastName },
                    { attr: emailAttr, value: intakeData.email ?? null, isRequired: currentLink.intake.requireEmail },
                    { attr: phoneAttr, value: intakeData.phone ?? null, isRequired: currentLink.intake.requirePhone },
                    ...(legalVersions
                        ? [
                              { attr: termsVersionAttr, value: legalVersions.termsVersion, isRequired: true },
                              { attr: termsAcceptedAtAttr, value: consentAcceptedAt, isRequired: true },
                              { attr: privacyVersionAttr, value: legalVersions.privacyVersion, isRequired: true },
                              { attr: privacyAcceptedAtAttr, value: consentAcceptedAt, isRequired: true }
                          ]
                        : [])
                ]
                const invalidField = fieldSpecs.find(({ attr, value, isRequired }) => {
                    if (isRequired && (!attr || !value)) return true
                    if ((isRequired || value) && (!attr?.column_name || !IDENTIFIER_REGEX.test(attr.column_name))) return true
                    return false
                })
                if (invalidField || !IDENTIFIER_REGEX.test(isGuestColumn) || !IDENTIFIER_REGEX.test(tokenColumn)) {
                    res.status(400).json({ error: 'Participant object has invalid guest session fields' })
                    return
                }
                const fieldValues: Array<{ attr: NonNullable<(typeof attrs)[number]>; value: string | null; isRequired: boolean }> =
                    fieldSpecs.flatMap(({ attr, value, isRequired }) =>
                        attr && (isRequired || Boolean(value)) ? [{ attr, value, isRequired }] : []
                    )

                try {
                    const tx = ctx.manager
                    const consumed = await consumeAccessLinkUse(tx, ctx.schemaName, currentLink)
                    if (!consumed) {
                        const error = new Error('Access link is no longer available')
                        ;(error as Error & { statusCode?: number }).statusCode = 409
                        throw error
                    }

                    const participantId = await createUuidV7(tx)
                    const sessionSecret = crypto.randomBytes(32).toString('hex')
                    const expiresAt = new Date(Date.now() + GUEST_SESSION_TTL_MS).toISOString()
                    const participantFields: Record<string, unknown> = {}
                    for (const { attr, value, isRequired } of fieldValues) {
                        const column = attr.column_name
                        if (!column || !value) {
                            if (isRequired) throw new Error('Required guest intake field is unavailable')
                            continue
                        }
                        if (!IDENTIFIER_REGEX.test(column)) throw new Error('Invalid guest intake column')
                        participantFields[column] = coerceRuntimeValue(value, attr.data_type, attr.validation_rules ?? undefined)
                    }
                    participantFields[isGuestColumn] = true
                    participantFields[tokenColumn] = encodeStoredGuestSessionState({
                        participantId,
                        linkId: currentLink.id,
                        secretHash: hashGuestSessionSecret(sessionSecret),
                        expiresAt,
                        workspaceId: currentLink.workspaceId,
                        ...(quizIntakeIdempotencyKeyHash ? { quizIntakeIdempotencyKeyHash } : {})
                    })
                    await insertGuestAssessmentRecord(
                        tx,
                        {
                            schemaName: ctx.schemaName,
                            tableName: studentsBinding.tableName,
                            workspaceId: ctx.workspacesEnabled ? currentLink.workspaceId : null
                        },
                        participantFields,
                        participantId,
                        participantId
                    )

                    const sessionToken = encodeGuestSessionToken({
                        participantId,
                        linkId: currentLink.id,
                        secret: sessionSecret,
                        workspaceId: currentLink.workspaceId
                    })
                    const encryptedSecret = encryptGuestSessionSecret(sessionSecret, idempotencyKey, scope, participantId)
                    await insertGuestSessionIdempotency(tx, {
                        idempotencyKeyHash,
                        payloadHash: intakePayloadHash,
                        applicationId,
                        accessLinkId: currentLink.id,
                        workspaceId: currentLink.workspaceId,
                        participantId,
                        expiresAt,
                        ...encryptedSecret
                    })

                    sessionPayload = {
                        participantId,
                        studentId: participantId,
                        sessionToken
                    }
                } catch (error) {
                    if ((error as Error & { statusCode?: number }).statusCode === 409) {
                        res.status(409).json({ error: 'Access link is no longer available' })
                        return
                    }
                    throw error
                }
            },
            {
                beforeTransaction: async (ctx) => prepareGuestSessionBeforeTransaction({ req, res, ctx, services, state: intakeState })
            }
        )

        // Commit the quota use, participant, and replay record before exposing the session.
        if (sessionPayload && !res.headersSent) {
            res.status(responseStatus).json(sessionPayload)
        }
    }

    return createGuestSession
}
