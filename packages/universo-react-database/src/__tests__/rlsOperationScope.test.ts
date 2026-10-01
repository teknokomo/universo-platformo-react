import { createRlsOperationScope } from '../rlsOperationScope'

describe('createRlsOperationScope', () => {
    it('does not register transactions after admission closes', async () => {
        const scope = createRlsOperationScope()
        const operation = jest.fn(async () => undefined)

        scope.closeAdmission()
        const transaction = scope.runSerializedTransaction(operation)

        await expect(transaction.promise).rejects.toThrow('RLS transaction scope is closed')
        await expect(scope.closeAndDrain()).resolves.toEqual([])
        expect(operation).not.toHaveBeenCalled()
    })
})
