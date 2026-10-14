import { randomBytes } from 'node:crypto'
import {
    decryptGuestSessionSecret,
    encryptGuestSessionSecret,
    fingerprintGuestIntakePayload,
    hashGuestIdempotencyKey,
    matchesGuestSessionIdempotency,
    parseGuestIdempotencyKey
} from '../../services/guestSessionIdempotency'

const validPayload = {
    firstName: 'Guest',
    lastName: 'Learner',
    termsAccepted: true as const,
    privacyAccepted: true as const
}

const validScope = {
    applicationId: '018f8a78-7b8f-7c1d-a111-222233334403',
    accessLinkId: '3ea1c528-0868-44b6-a30b-7e63a9f963da',
    workspaceId: '018f8a78-7b8f-7c1d-a111-222233334441'
}

describe('guest-session idempotency helpers', () => {
    it('accepts canonical 256-bit base64url keys and rejects noncanonical or short encodings', () => {
        const key = randomBytes(32)
        const encoded = key.toString('base64url')

        expect(encoded).toMatch(/^[A-Za-z0-9_-]{43}$/u)
        expect(parseGuestIdempotencyKey(encoded)).toEqual(key)
        expect(hashGuestIdempotencyKey(key)).toMatch(/^[a-f0-9]{64}$/u)
        expect(parseGuestIdempotencyKey(`${encoded}=`)).toBeNull()
        expect(parseGuestIdempotencyKey('too-short')).toBeNull()
    })

    it('binds the payload fingerprint to both the high-entropy key and canonical intake fields', () => {
        const key = randomBytes(32)
        const samePayload = { ...validPayload, firstName: ' Guest ' }
        const fingerprint = fingerprintGuestIntakePayload(key, validPayload)

        expect(fingerprintGuestIntakePayload(key, samePayload)).toBe(fingerprint)
        expect(fingerprintGuestIntakePayload(randomBytes(32), validPayload)).not.toBe(fingerprint)
        expect(fingerprintGuestIntakePayload(key, { ...validPayload, firstName: 'Another guest' })).not.toBe(fingerprint)
    })

    it('rejects a matching payload fingerprint when application, access link, or workspace scope differs', () => {
        const key = randomBytes(32)
        const payloadHash = fingerprintGuestIntakePayload(key, validPayload)
        const record = {
            payloadHash,
            applicationId: validScope.applicationId,
            accessLinkId: validScope.accessLinkId,
            workspaceId: validScope.workspaceId
        }

        expect(matchesGuestSessionIdempotency(record, validScope, payloadHash)).toBe(true)
        expect(
            matchesGuestSessionIdempotency(record, { ...validScope, applicationId: '018f8a78-7b8f-7c1d-a111-222233334499' }, payloadHash)
        ).toBe(false)
        expect(
            matchesGuestSessionIdempotency(record, { ...validScope, accessLinkId: '4ea1c528-0868-44b6-a30b-7e63a9f963da' }, payloadHash)
        ).toBe(false)
        expect(matchesGuestSessionIdempotency(record, { ...validScope, workspaceId: null }, payloadHash)).toBe(false)
        expect(matchesGuestSessionIdempotency(record, validScope, 'f'.repeat(64))).toBe(false)
    })

    it('round-trips the session secret with AES-GCM and rejects tampering or a different scope', () => {
        const key = randomBytes(32)
        const participantId = '018f8a78-7b8f-7c1d-a111-222233334410'
        const secret = randomBytes(32).toString('hex')
        const encrypted = encryptGuestSessionSecret(secret, key, validScope, participantId)
        const tamperedCiphertext = Buffer.from(encrypted.secretCiphertext)
        tamperedCiphertext[0] ^= 1

        expect(decryptGuestSessionSecret(encrypted, key, validScope, participantId)).toBe(secret)
        expect(decryptGuestSessionSecret(encrypted, key, { ...validScope, workspaceId: null }, participantId)).toBeNull()
        expect(decryptGuestSessionSecret({ ...encrypted, secretCiphertext: tamperedCiphertext }, key, validScope, participantId)).toBeNull()
    })
})
