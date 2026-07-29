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
})
