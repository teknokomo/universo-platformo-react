import type { Knex } from 'knex'
import {
    createSnapshotRestoreDatabase,
    deletePlayCanvasSnapshotRows,
    insertPlayCanvasSnapshotRow,
    withSnapshotRestoreAdvisoryLock,
    type SnapshotRestoreTransaction
} from '../../domains/ddl/snapshotRestoreAdapter'

describe('snapshot restore DDL adapter', () => {
    const createTransaction = () => {
        const builder = {
            del: jest.fn().mockResolvedValue(1),
            from: jest.fn().mockReturnThis(),
            insert: jest.fn().mockResolvedValue(1),
            into: jest.fn().mockReturnThis(),
            raw: jest.fn().mockResolvedValue({ rows: [] }),
            withSchema: jest.fn().mockReturnThis()
        }
        return { builder, transaction: builder as unknown as SnapshotRestoreTransaction }
    }

    it('wraps the shared Knex instance with the executor and transaction boundary', async () => {
        const { transaction } = createTransaction()
        const knex = {
            raw: jest.fn().mockResolvedValue({ rows: [{ value: 1 }] }),
            transaction: jest.fn(async (callback: (value: SnapshotRestoreTransaction) => Promise<unknown>) => callback(transaction))
        } as unknown as Knex
        const database = createSnapshotRestoreDatabase(knex)

        await expect(database.transaction(async (activeTransaction) => activeTransaction)).resolves.toBe(transaction)
        await expect(database.executor.query<{ value: number }>('SELECT 1')).resolves.toEqual([{ value: 1 }])
        expect(knex.transaction).toHaveBeenCalledTimes(1)
        expect(knex.raw).toHaveBeenCalledWith('SELECT 1', [])
    })

    it('restricts PlayCanvas restore writes to the known snapshot tables', async () => {
        const { builder, transaction } = createTransaction()

        await deletePlayCanvasSnapshotRows(transaction, 'mhb_test')
        await insertPlayCanvasSnapshotRow(transaction, 'mhb_test', '_mhb_playcanvas_assets', { id: 'asset-1' })

        expect(builder.withSchema).toHaveBeenCalledTimes(10)
        expect(builder.from).toHaveBeenCalledWith('_mhb_playcanvas_projects')
        expect(builder.into).toHaveBeenCalledWith('_mhb_playcanvas_assets')
        expect(builder.insert).toHaveBeenCalledWith({ id: 'asset-1' })
    })

    it('acquires an advisory lock through the supplied DDL transaction', async () => {
        const { builder, transaction } = createTransaction()
        const work = jest.fn(async (executor) => {
            await executor.query('SELECT 42')
            return 'done'
        })

        await expect(withSnapshotRestoreAdvisoryLock(transaction, 'playcanvas:metahub-lifecycle:10:metahub-1', work)).resolves.toBe('done')

        expect(work).toHaveBeenCalledTimes(1)
        expect(builder.raw).toHaveBeenNthCalledWith(1, 'SELECT pg_advisory_xact_lock(hashtext(?))', [
            'playcanvas:metahub-lifecycle:10:metahub-1'
        ])
        expect(builder.raw).toHaveBeenNthCalledWith(2, 'SELECT 42', [])
    })
})
