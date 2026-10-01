import type { Knex } from 'knex'

export function createMockRlsKnex() {
    const connectionFn = jest.fn().mockImplementation(() => Promise.resolve({ rows: [] }))
    const rawFn = jest.fn().mockImplementation(() => ({
        rows: [],
        connection: connectionFn
    }))

    const knex = { raw: rawFn } as unknown as Knex
    const connection = Symbol('pinned-connection')

    return { knex, rawFn, connectionFn, connection }
}
