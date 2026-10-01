import type { Knex } from 'knex'
import { releaseKnexConnection } from '../KnexClient'

describe('releaseKnexConnection', () => {
    it('marks an unsafe connection before returning it to the Knex pool', async () => {
        const connection = { id: 'unsafe-connection' }
        const releaseConnection = jest.fn(async (releasedConnection: unknown) => {
            expect(releasedConnection).toBe(connection)
            expect((releasedConnection as { __knex__disposed?: string }).__knex__disposed).toBe('Connection transaction state is unknown')
        })
        const knex = { client: { releaseConnection } } as unknown as Knex

        await releaseKnexConnection(knex, connection, { discard: true })

        expect(releaseConnection).toHaveBeenCalledTimes(1)
    })

    it('releases a clean connection without invalidating it', async () => {
        const connection = { id: 'clean-connection' }
        const releaseConnection = jest.fn().mockResolvedValue(undefined)
        const knex = { client: { releaseConnection } } as unknown as Knex

        await releaseKnexConnection(knex, connection)

        expect(releaseConnection).toHaveBeenCalledWith(connection)
        expect(connection).not.toHaveProperty('__knex__disposed')
    })
})
