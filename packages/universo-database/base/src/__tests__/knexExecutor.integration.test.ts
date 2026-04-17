import type { Knex } from 'knex'
import { createKnexExecutor, createRlsExecutor } from '../knexExecutor'
import { withAdvisoryLock } from '@universo/utils/database'

/**
 * Integration tests for Knex executor against a real PostgreSQL database.
 * Requires DATABASE_TEST_URL environment variable.
 *
 * Run: DATABASE_TEST_URL=postgresql://user:pass@localhost:5432/testdb pnpm --filter @universo/database test
 */

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

describeIntegration('Executor Integration (requires PG)', () => {
    let knex: Knex

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({
            client: 'pg',
            connection: DATABASE_TEST_URL
        })
        await knex.raw('CREATE TEMP TABLE _test_exec (id int, name text)')
    })

    afterAll(async () => {
        if (knex) {
            await knex.destroy()
        }
    })

    afterEach(async () => {
        await knex.raw('DELETE FROM _test_exec')
    })

    it('pool executor handles $1-style params via conversion', async () => {
        const exec = createKnexExecutor(knex)
        await exec.query('INSERT INTO _test_exec VALUES ($1, $2)', [1, 'alice'])
        const rows = await exec.query<{ id: number; name: string }>('SELECT * FROM _test_exec WHERE id = $1', [1])
        expect(rows).toEqual([{ id: 1, name: 'alice' }])
    })

    it('pool executor handles ? params natively', async () => {
        const exec = createKnexExecutor(knex)
        const rows = await exec.query<{ val: string }>('SELECT ?::text AS val', ['hello'])
        expect(rows).toEqual([{ val: 'hello' }])
    })

    it('pool executor handles queries without parameters', async () => {
        const exec = createKnexExecutor(knex)
        await exec.query("INSERT INTO _test_exec VALUES (99, 'no-params')")
        const rows = await exec.query<{ name: string }>('SELECT name FROM _test_exec WHERE id = 99')
        expect(rows).toEqual([{ name: 'no-params' }])
    })

    it('RLS executor runs queries on pinned connection', async () => {
        const connection = await knex.client.acquireConnection()
        try {
            const exec = createRlsExecutor(knex, connection)
            await exec.query('INSERT INTO _test_exec VALUES ($1, $2)', [2, 'bob'])
            const rows = await exec.query<{ name: string }>('SELECT name FROM _test_exec WHERE id = $1', [2])
            expect(rows).toEqual([{ name: 'bob' }])
        } finally {
            await knex.client.releaseConnection(connection)
        }
    })

    it('RLS executor reuses the middleware-owned outer transaction without extra savepoints', async () => {
        const connection = await knex.client.acquireConnection()
        try {
            await knex.raw('BEGIN').connection(connection)
            const exec = createRlsExecutor(knex, connection, { inTransaction: true })

            await exec.transaction(async (txExec) => {
                await txExec.query('INSERT INTO _test_exec VALUES ($1, $2)', [3, 'carol'])
            })

            const rows = await exec.query<{ name: string }>('SELECT name FROM _test_exec WHERE id = $1', [3])
            expect(rows).toEqual([{ name: 'carol' }])

            await knex.raw('ROLLBACK').connection(connection)
        } finally {
            await knex.client.releaseConnection(connection)
        }
    })

    it('RLS executor still supports explicit nested savepoints inside a middleware-owned transaction', async () => {
        const connection = await knex.client.acquireConnection()
        try {
            await knex.raw('BEGIN').connection(connection)
            const exec = createRlsExecutor(knex, connection, { inTransaction: true })

            await exec.transaction(async (txExec) => {
                await txExec.transaction(async (innerExec) => {
                    await innerExec.query('INSERT INTO _test_exec VALUES ($1, $2)', [4, 'dave'])
                })
            })

            const rows = await exec.query<{ name: string }>('SELECT name FROM _test_exec WHERE id = $1', [4])
            expect(rows).toEqual([{ name: 'dave' }])

            await knex.raw('ROLLBACK').connection(connection)
        } finally {
            await knex.client.releaseConnection(connection)
        }
    })

    it('RLS executor preserves request.jwt.claims across queries on the pinned connection', async () => {
        const connection = await knex.client.acquireConnection()
        try {
            await knex.raw('BEGIN').connection(connection)
            await knex.raw("SELECT set_config('request.jwt.claims', ?::text, true)", ['{"sub":"user-1"}']).connection(connection)

            const exec = createRlsExecutor(knex, connection, { inTransaction: true })
            const first = await exec.query<{ claims: string | null }>("SELECT current_setting('request.jwt.claims', true) AS claims")
            const second = await exec.query<{ claims: string | null }>("SELECT current_setting('request.jwt.claims', true) AS claims")

            expect(first).toEqual([{ claims: '{"sub":"user-1"}' }])
            expect(second).toEqual([{ claims: '{"sub":"user-1"}' }])

            await knex.raw('ROLLBACK').connection(connection)
        } finally {
            await knex.client.releaseConnection(connection)
        }
    })

    it('pool executor does not inherit request.jwt.claims from request-scoped sessions', async () => {
        const exec = createKnexExecutor(knex)
        const rows = await exec.query<{ claims: string | null }>("SELECT current_setting('request.jwt.claims', true) AS claims")

        expect(rows).toEqual([{ claims: null }])
    })

    it('pool executor transaction rolls back on error', async () => {
        const exec = createKnexExecutor(knex)
        await exec.query('INSERT INTO _test_exec VALUES ($1, $2)', [10, 'pre-tx'])

        await expect(
            exec.transaction(async (txExec) => {
                await txExec.query('INSERT INTO _test_exec VALUES ($1, $2)', [11, 'in-tx'])
                throw new Error('forced rollback')
            })
        ).rejects.toThrow('forced rollback')

        const rows = await exec.query<{ id: number }>('SELECT id FROM _test_exec WHERE id IN ($1, $2)', [10, 11])
        expect(rows).toEqual([{ id: 10 }])
    })

    it('advisory lock blocks concurrent work on the same lock key', async () => {
        const firstExec = createKnexExecutor(knex)
        const secondExec = createKnexExecutor(knex)
        let releaseFirstLock!: () => void
        let markAcquired!: () => void

        const firstLockAcquired = new Promise<void>((resolve) => {
            markAcquired = resolve
        })
        const holdFirstLock = new Promise<void>((resolve) => {
            releaseFirstLock = resolve
        })

        const first = withAdvisoryLock(firstExec, 'db-access-standard-lock', async () => {
            markAcquired()
            await holdFirstLock
            return 'first'
        })

        await firstLockAcquired

        await expect(withAdvisoryLock(secondExec, 'db-access-standard-lock', async () => 'second', { timeoutMs: 250 })).rejects.toThrow(
            /lock timeout|canceling statement due to lock timeout/i
        )

        releaseFirstLock()
        await expect(first).resolves.toBe('first')
    })
})
