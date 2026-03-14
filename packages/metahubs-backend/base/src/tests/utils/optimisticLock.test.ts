import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { incrementVersion, updateWithVersionCheck } from '../../utils/optimisticLock'

describe('optimisticLock identifier safety', () => {
    const createExecutor = () => {
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) {
                return [
                    {
                        id: 'entity-1',
                        _upl_version: 3,
                        _upl_updated_at: '2026-03-14T00:00:00.000Z',
                        _upl_updated_by: 'user-1'
                    }
                ]
            }

            return [
                {
                    id: 'entity-1',
                    _upl_version: 4,
                    _upl_updated_at: '2026-03-14T00:01:00.000Z',
                    _upl_updated_by: 'user-2',
                    title: 'Renamed'
                }
            ]
        })

        const executor = {
            query,
            transaction: jest.fn(async (callback: (tx: DbExecutor) => Promise<unknown>) => callback(executor as DbExecutor)),
            isReleased: () => false
        }

        return {
            executor: executor as unknown as DbExecutor,
            query
        }
    }

    it('quotes validated update columns before generating SQL', async () => {
        const { executor, query } = createExecutor()

        await updateWithVersionCheck({
            executor,
            schemaName: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
            tableName: '_mhb_objects',
            entityId: 'entity-1',
            entityType: 'hub',
            expectedVersion: 3,
            updateData: {
                title: 'Renamed',
                _upl_updated_by: 'user-2'
            }
        })

        expect(query).toHaveBeenCalledTimes(2)
        expect(query.mock.calls[1][0]).toContain('"title" = $1')
        expect(query.mock.calls[1][0]).toContain('"_upl_updated_by" = $2')
    })

    it('rejects malformed update identifiers before incrementVersion executes SQL', async () => {
        const query = jest.fn()
        const db = { query } as unknown as SqlQueryable

        await expect(
            incrementVersion(db, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', '_mhb_objects', 'entity-1', {
                'title" = NOW() --': 'broken'
            })
        ).rejects.toThrow('Invalid SQL identifier')

        expect(query).not.toHaveBeenCalled()
    })
})
