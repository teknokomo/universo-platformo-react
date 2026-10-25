import {
    createInterpretationNetworkMatrixCell,
    moveInterpretationNetworkMatrixCells,
    updateInterpretationNetworkMatrixCell
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands'
import { interpretationNetworkMatrixMembershipLockKey } from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixMembership'
import { cellId, interpretationId, makeContext, matrixRowId, surface } from './runtimeInterpretationNetworkMatrixTestUtils'

describe('Interpretation Network Matrix membership locks', () => {
    it.each(['create', 'move', 'update'] as const)('waits for the shared membership lock before the %s snapshot', async (command) => {
        const { ctx, txExecutor } = makeContext()
        let release!: () => void
        let entered!: () => void
        const blocked = new Promise<void>((resolve) => {
            release = resolve
        })
        const reachedLock = new Promise<void>((resolve) => {
            entered = resolve
        })
        const key = interpretationNetworkMatrixMembershipLockKey(surface, interpretationId)
        let snapshotRead = false
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('pg_advisory_xact_lock')) {
                if (params.includes(key)) {
                    entered()
                    await blocked
                }
                return []
            }
            if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('FROM') && sql.includes('"interpretation_matrix_rows"')) {
                snapshotRead = true
                return []
            }
            if (sql.includes('INSERT INTO')) return [{ id: matrixRowId }]
            return []
        })
        const saving =
            command === 'create'
                ? createInterpretationNetworkMatrixCell(ctx, surface, { interpretationId, data: {}, placement: {} })
                : command === 'move'
                ? moveInterpretationNetworkMatrixCells(ctx, surface, {
                      interpretationId,
                      updates: [{ cellId, expectedVersion: 1, placement: {} }]
                  })
                : updateInterpretationNetworkMatrixCell(ctx, surface, {
                      interpretationId,
                      cellId,
                      expectedCellVersion: 1,
                      data: { CellValue: 'Updated cell' }
                  })
        await reachedLock
        expect(snapshotRead).toBe(false)
        release()
        if (command !== 'create') {
            await expect(saving).rejects.toMatchObject({ statusCode: 404 })
        } else {
            await saving
        }
        expect(snapshotRead).toBe(true)
        const calls = txExecutor.query.mock.calls
        const parent = calls.findIndex(([sql]) => sql.includes('FROM') && sql.includes('"interpretation"'))
        const membership = calls.findIndex(([sql, params]) => sql.includes('pg_advisory_xact_lock') && params.includes(key))
        expect(parent).toBeLessThan(membership)
    })
})
