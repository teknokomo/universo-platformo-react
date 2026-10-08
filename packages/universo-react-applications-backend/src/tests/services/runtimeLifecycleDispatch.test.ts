import { createRlsExecutor } from '@universo-react/database'
import type { Knex } from 'knex'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { dispatchRuntimeLifecycleAfterCommit, type RuntimeLifecycleDispatchRequest } from '../../services/runtimeLifecycleDispatch'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('runtimeLifecycleDispatch', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('logs only a bounded lifecycle context when an after-commit hook fails', async () => {
        const { executor } = createMockDbExecutor()
        const sensitiveError = new Error('private user data and database details')
        jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockRejectedValue(sensitiveError)
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const request: RuntimeLifecycleDispatchRequest = {
            applicationId: '019f2000-0000-7000-8000-000000000001',
            schemaName: 'app_019f2000000070008000000000000001',
            objectCollection: {
                id: '019f2000-0000-7000-8000-000000000002',
                codename: 'Material'
            },
            payload: {
                eventName: 'afterCreate',
                row: { secret: 'must not be logged' }
            }
        }

        dispatchRuntimeLifecycleAfterCommit(executor, request)
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(errorSpy).toHaveBeenCalledWith('[runtimeLifecycleDispatch] lifecycle hook failed', {
            eventName: 'afterCreate',
            applicationId: request.applicationId,
            objectId: request.objectCollection.id
        })
        expect(errorSpy).not.toHaveBeenCalledWith(expect.anything(), sensitiveError)
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('private user data')
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('must not be logged')
    })

    it('drains the full lifecycle dispatch before request cleanup releases the RLS connection', async () => {
        const sql: string[] = []
        const connectionFn = jest.fn().mockResolvedValue({ rows: [] })
        const rawFn = jest.fn().mockImplementation((statement: string) => {
            sql.push(statement)
            return { connection: connectionFn }
        })
        const connection = Symbol('request-connection')
        let requestScope!: { closeAdmission: () => void; closeAndDrain: () => Promise<unknown[]> }
        let acceptingLease = true
        let activeLeases = 0
        let resolveLeasesDrained: (() => void) | undefined
        let markFirstQueryCompleted!: () => void
        let releaseSecondQuery!: () => void
        const firstQueryCompleted = new Promise<void>((resolve) => {
            markFirstQueryCompleted = resolve
        })
        const secondQueryBarrier = new Promise<void>((resolve) => {
            releaseSecondQuery = resolve
        })
        let lifecycleTask: Promise<unknown[]> | undefined

        const executor = createRlsExecutor(knexFromRaw(rawFn), connection, {
            inTransaction: true,
            isConnectionUnavailable: () => !acceptingLease,
            runWithConnectionLease: async (operation) => {
                if (!acceptingLease) throw new Error('RLS connection lease is closed')
                activeLeases += 1
                try {
                    return await operation()
                } finally {
                    activeLeases -= 1
                    if (activeLeases === 0) resolveLeasesDrained?.()
                }
            },
            onRequestScopeCreated: (scope) => {
                requestScope = scope
            }
        })
        const request: RuntimeLifecycleDispatchRequest = {
            applicationId: '019f2000-0000-7000-8000-000000000001',
            schemaName: 'app_019f2000000070008000000000000001',
            objectCollection: {
                id: '019f2000-0000-7000-8000-000000000002',
                codename: 'Material'
            },
            payload: {
                eventName: 'afterCreate',
                row: { id: '019f2000-0000-7000-8000-000000000003' }
            }
        }
        jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockImplementation(({ executor: tx }) => {
            lifecycleTask = (async () => {
                await tx.query('SELECT lifecycle first')
                markFirstQueryCompleted()
                await secondQueryBarrier
                await tx.query('SELECT lifecycle second')
                return []
            })()
            return lifecycleTask
        })

        dispatchRuntimeLifecycleAfterCommit(executor, request)
        await firstQueryCompleted

        requestScope.closeAdmission()
        const leaseClose = new Promise<void>((resolve) => {
            if (activeLeases === 0) {
                acceptingLease = false
                resolve()
                return
            }
            resolveLeasesDrained = () => {
                acceptingLease = false
                resolve()
            }
        })
        let scopeDrained = false
        const scopeClose = requestScope.closeAndDrain().then(() => {
            scopeDrained = true
        })

        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(scopeDrained).toBe(false)
        expect(acceptingLease).toBe(true)

        releaseSecondQuery()
        await Promise.all([leaseClose, scopeClose])
        await expect(lifecycleTask).resolves.toEqual([])
        expect(sql).toEqual(['SELECT lifecycle first', 'SELECT lifecycle second'])
    })
})

const knexFromRaw = (raw: jest.Mock): Knex => ({ raw } as unknown as Knex)
