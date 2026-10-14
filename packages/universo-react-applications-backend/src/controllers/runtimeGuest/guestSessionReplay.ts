import { Buffer } from 'node:buffer'
import type { DbExecutor } from '@universo-react/utils'
import {
    decryptGuestSessionSecret,
    matchesGuestSessionIdempotency,
    type GuestSessionIdempotencyScope
} from '../../services/guestSessionIdempotency'
import { findGuestSessionIdempotency } from '../../persistence/guestSessionIdempotencyStore'
import type { PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'
import type { AccessLinkRecord } from './guestRuntimeData'
import { encodeGuestSessionToken } from './guestSessionTokens'
import type { RuntimeGuestServices } from './services'

export type GuestSessionReplayResult =
    | { kind: 'none' }
    | { kind: 'conflict'; error: 'Idempotency key cannot be reused for this intake' | 'Guest session replay is no longer available' }
    | { kind: 'replay'; sessionPayload: { participantId: string; studentId: string; sessionToken: string } }

export const resolveGuestSessionReplay = async (args: {
    executor: DbExecutor
    idempotencyKey: Buffer
    idempotencyKeyHash: string
    payloadHash: string
    scope: GuestSessionIdempotencyScope
    currentLink: AccessLinkRecord
    schemaName: string
    workspacesEnabled: boolean
    runtimeConfig: PublicGuestRuntimeConfig
    validateGuestSession: RuntimeGuestServices['validateGuestSession']
}): Promise<GuestSessionReplayResult> => {
    const {
        executor,
        idempotencyKey,
        idempotencyKeyHash,
        payloadHash,
        scope,
        currentLink,
        schemaName,
        workspacesEnabled,
        runtimeConfig,
        validateGuestSession
    } = args
    const existingIntake = await findGuestSessionIdempotency(executor, idempotencyKeyHash)
    if (!existingIntake) return { kind: 'none' }

    if (!matchesGuestSessionIdempotency(existingIntake, scope, payloadHash)) {
        return { kind: 'conflict', error: 'Idempotency key cannot be reused for this intake' }
    }

    const sessionSecret = decryptGuestSessionSecret(existingIntake, idempotencyKey, scope, existingIntake.participantId)
    if (!sessionSecret) {
        return { kind: 'conflict', error: 'Guest session replay is no longer available' }
    }

    const replayToken = encodeGuestSessionToken({
        participantId: existingIntake.participantId,
        linkId: currentLink.id,
        secret: sessionSecret,
        workspaceId: currentLink.workspaceId
    })
    const validation = await validateGuestSession(
        executor,
        schemaName,
        workspacesEnabled,
        runtimeConfig,
        existingIntake.participantId,
        replayToken
    )
    if (
        !validation.isValid ||
        validation.accessLinkId?.toLowerCase() !== currentLink.id.toLowerCase() ||
        (validation.workspaceId?.toLowerCase() ?? null) !== (currentLink.workspaceId?.toLowerCase() ?? null)
    ) {
        return { kind: 'conflict', error: 'Guest session replay is no longer available' }
    }

    return {
        kind: 'replay',
        sessionPayload: {
            participantId: existingIntake.participantId,
            studentId: existingIntake.participantId,
            sessionToken: replayToken
        }
    }
}
