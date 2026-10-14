import { runGuestSessionIdempotencyCleanup } from '../../services/guestSessionIdempotencyMaintenance'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('guest-session idempotency maintenance', () => {
    it('continues with bounded ordered batches until no expired replay records remain', async () => {
        const { executor } = createMockDbExecutor()
        executor.query
            .mockResolvedValueOnce(Array.from({ length: 500 }, (_, index) => ({ id: `batch-one-${index}` })))
            .mockResolvedValueOnce([{ id: 'batch-two-1' }, { id: 'batch-two-2' }])

        await expect(runGuestSessionIdempotencyCleanup(executor)).resolves.toBe(502)

        expect(executor.query).toHaveBeenCalledTimes(2)
        for (const [sql, parameters] of executor.query.mock.calls as [string, unknown[]][]) {
            expect(sql).toContain('ORDER BY expires_at ASC')
            expect(sql).toContain('LIMIT $1')
            expect(sql).toContain('FOR UPDATE SKIP LOCKED')
            expect(parameters).toEqual([500])
        }
    })

    it('does not issue extra batch queries after one partial batch', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ id: 'expired-record' }])

        await expect(runGuestSessionIdempotencyCleanup(executor)).resolves.toBe(1)
        expect(executor.query).toHaveBeenCalledTimes(1)
    })
})
