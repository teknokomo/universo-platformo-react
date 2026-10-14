import {
    deleteExpiredGuestSessionIdempotency,
    findGuestSessionIdempotency,
    insertGuestSessionIdempotency,
    purgeExpiredGuestSessionIdempotency,
    revokeGuestSessionIdempotencyForAccessLink,
    revokeGuestSessionIdempotencyForApplication,
    revokeGuestSessionIdempotencyForWorkspace
} from '../../persistence/guestSessionIdempotencyStore'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('guest-session idempotency store', () => {
    it('reads by a parameterized digest from the schema-qualified platform table', async () => {
        const { executor } = createMockDbExecutor()
        const keyHash = 'a'.repeat(64)
        const record = { idempotencyKeyHash: keyHash, participantId: 'participant-id' }
        executor.query.mockResolvedValue([record])

        await expect(findGuestSessionIdempotency(executor, keyHash)).resolves.toEqual(record)
        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('FROM "applications"."obj_guest_session_idempotency"'), [
            keyHash
        ])
        expect(executor.query.mock.calls[0][0]).toContain('WHERE idempotency_key_hash = $1')
        expect(executor.query.mock.calls[0][0]).toContain('AND expires_at > NOW()')
    })

    it('deletes a matching expired key so it can be safely reused', async () => {
        const { executor } = createMockDbExecutor()
        const keyHash = 'a'.repeat(64)

        await deleteExpiredGuestSessionIdempotency(executor, keyHash)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('DELETE FROM "applications"."obj_guest_session_idempotency"')
        expect(sql).toContain('WHERE idempotency_key_hash = $1')
        expect(sql).toContain('AND expires_at <= NOW()')
        expect(parameters).toEqual([keyHash])
    })

    it('removes encrypted replay credentials for an application during public-access withdrawal', async () => {
        const { executor } = createMockDbExecutor()
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334441'
        executor.query.mockResolvedValue([{ id: '018f8a78-7b8f-7c1d-a111-222233334442' }])

        await expect(revokeGuestSessionIdempotencyForApplication(executor, applicationId)).resolves.toBe(1)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('DELETE FROM "applications"."obj_guest_session_idempotency"')
        expect(sql).toContain('WHERE application_id = $1')
        expect(sql).toContain('RETURNING id')
        expect(parameters).toEqual([applicationId])
    })

    it('removes replay credentials only for the requested active application, workspace, and schema', async () => {
        const { executor } = createMockDbExecutor()
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334441'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334442'
        const schemaName = 'app_018f8a787b8f7c1da111222233334441'
        executor.query.mockResolvedValue([{ id: '018f8a78-7b8f-7c1d-a111-222233334443' }])

        await expect(revokeGuestSessionIdempotencyForWorkspace(executor, applicationId, workspaceId, schemaName)).resolves.toBe(1)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('DELETE FROM "applications"."obj_guest_session_idempotency" AS replay')
        expect(sql).toContain('replay."application_id" = $1')
        expect(sql).toContain('replay."workspace_id" = $2')
        expect(sql).toContain('FROM "applications"."obj_applications" AS application')
        expect(sql).toContain('application."schema_name" = $3')
        expect(sql).toContain('application."_upl_deleted" = false')
        expect(sql).toContain('application."_app_deleted" = false')
        expect(sql).toContain('RETURNING replay."id" AS id')
        expect(parameters).toEqual([applicationId, workspaceId, schemaName])
    })

    it('revokes encrypted replay credentials by access link and workspace with UUID v7 identities', async () => {
        const { executor } = createMockDbExecutor()
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334441'
        const accessLinkId = '018f8a78-7b8f-7c1d-a111-222233334442'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334443'
        executor.query.mockResolvedValue([{ id: '018f8a78-7b8f-7c1d-a111-222233334444' }])

        await expect(revokeGuestSessionIdempotencyForAccessLink(executor, applicationId, accessLinkId, workspaceId)).resolves.toBe(1)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('DELETE FROM "applications"."obj_guest_session_idempotency"')
        expect(sql).toContain('WHERE application_id = $1')
        expect(sql).toContain('AND access_link_id = $2')
        expect(sql).toContain('AND workspace_id = $3')
        expect(sql).toContain('RETURNING id')
        expect(parameters).toEqual([applicationId, accessLinkId, workspaceId])
    })

    it('keeps no-workspace replay revocation scoped to rows with a null workspace', async () => {
        const { executor } = createMockDbExecutor()
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334441'
        const accessLinkId = '018f8a78-7b8f-7c1d-a111-222233334442'

        await revokeGuestSessionIdempotencyForAccessLink(executor, applicationId, accessLinkId, null)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('AND workspace_id IS NULL')
        expect(parameters).toEqual([applicationId, accessLinkId])
    })

    it('rejects non-v7 identities before issuing a replay revocation query', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            revokeGuestSessionIdempotencyForAccessLink(executor, 'not-an-id', '018f8a78-7b8f-7c1d-a111-222233334442', null)
        ).rejects.toThrow('applicationId must be a UUID v7')
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('purges expired rows in a bounded, parameterized batch', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ id: '018f8a78-7b8f-7c1d-a111-222233334444' }])

        await expect(purgeExpiredGuestSessionIdempotency(executor, 900)).resolves.toBe(1)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('DELETE FROM "applications"."obj_guest_session_idempotency"')
        expect(sql).toContain('WHERE expires_at <= NOW()')
        expect(sql).toContain('ORDER BY expires_at ASC')
        expect(sql).toContain('LIMIT $1')
        expect(sql).toContain('FOR UPDATE SKIP LOCKED')
        expect(sql).toContain('RETURNING expired."id" AS id')
        expect(parameters).toEqual([500])
    })

    it('inserts only bound values and never interpolates key, scope, or ciphertext into SQL', async () => {
        const { executor } = createMockDbExecutor()
        const record = {
            idempotencyKeyHash: 'a'.repeat(64),
            payloadHash: 'b'.repeat(64),
            applicationId: 'application-id',
            accessLinkId: 'access-link-id',
            workspaceId: null,
            participantId: 'participant-id',
            expiresAt: '2030-01-01T00:00:00.000Z',
            secretNonce: Buffer.alloc(12, 1),
            secretCiphertext: Buffer.from('encrypted-secret'),
            secretAuthTag: Buffer.alloc(16, 2)
        }

        await insertGuestSessionIdempotency(executor, record)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('INSERT INTO "applications"."obj_guest_session_idempotency"')
        expect(sql).toContain('VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)')
        expect(sql).not.toContain(record.idempotencyKeyHash)
        expect(sql).not.toContain('participant-id')
        expect(parameters).toEqual([
            record.idempotencyKeyHash,
            record.payloadHash,
            record.applicationId,
            record.accessLinkId,
            null,
            record.participantId,
            record.expiresAt,
            record.secretNonce,
            record.secretCiphertext,
            record.secretAuthTag
        ])
    })
})
