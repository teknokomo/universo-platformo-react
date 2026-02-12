import { acquireAdvisoryLock, releaseAdvisoryLock } from '../locking'

type RawResult = { rows?: Array<Record<string, unknown>> }

const createMockKnex = () => {
    const acquireConnection = jest.fn()
    const releaseConnection = jest.fn(async () => undefined)

    const raw = jest.fn((sql: string) => ({
        connection: jest.fn(async () => {
            if (sql.includes('pg_try_advisory_lock')) {
                return { rows: [{ pg_try_advisory_lock: true }] } as RawResult
            }
            if (sql.includes('pg_advisory_unlock')) {
                return { rows: [{ pg_advisory_unlock: true }] } as RawResult
            }
            return { rows: [] } as RawResult
        })
    }))

    return {
        raw,
        client: {
            acquireConnection,
            releaseConnection
        }
    } as unknown as import('knex').Knex
}

describe('locking', () => {
    it('does not leak pending in-process state when connection acquire fails', async () => {
        const knex = createMockKnex()
        const client = (knex as unknown as { client: { acquireConnection: jest.Mock } }).client

        client.acquireConnection.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        await expect(acquireAdvisoryLock(knex, 'test-lock', 200)).rejects.toThrow('timeout exceeded when trying to connect')

        const connection = { id: 'conn-1' }
        client.acquireConnection.mockResolvedValueOnce(connection)

        await expect(acquireAdvisoryLock(knex, 'test-lock', 200)).resolves.toBe(true)
        await expect(releaseAdvisoryLock(knex, 'test-lock')).resolves.toBeUndefined()
    })
})
