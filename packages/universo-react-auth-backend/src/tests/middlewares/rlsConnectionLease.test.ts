import { createRlsConnectionLease } from '../../middlewares/rlsConnectionLease'

describe('createRlsConnectionLease', () => {
    it('drains started operations and rejects new work as soon as close begins', async () => {
        const lease = createRlsConnectionLease()
        let resolveFirstOperation!: () => void
        let resolveSecondOperation!: () => void
        let markFirstStarted!: () => void
        let markSecondStarted!: () => void
        let closeSettled = false
        const firstOperationBarrier = new Promise<void>((resolve) => {
            resolveFirstOperation = resolve
        })
        const secondOperationBarrier = new Promise<void>((resolve) => {
            resolveSecondOperation = resolve
        })
        const firstStarted = new Promise<void>((resolve) => {
            markFirstStarted = resolve
        })
        const secondStarted = new Promise<void>((resolve) => {
            markSecondStarted = resolve
        })
        const firstOperation = lease.run(async () => {
            markFirstStarted()
            await firstOperationBarrier
        })
        await firstStarted
        const secondOperation = lease.run(async () => {
            markSecondStarted()
            await secondOperationBarrier
        })
        await secondStarted

        const close = lease.close().then(() => {
            closeSettled = true
        })
        expect(lease.isClosed()).toBe(true)
        expect(lease.isReleased()).toBe(false)
        await expect(lease.run(async () => undefined)).rejects.toThrow('RLS connection lease is closed')

        resolveFirstOperation()
        await firstOperation
        await Promise.resolve()
        expect(closeSettled).toBe(false)

        resolveSecondOperation()
        await secondOperation
        await close
        expect(closeSettled).toBe(true)
        expect(lease.isReleased()).toBe(false)

        lease.release()
        expect(lease.isReleased()).toBe(true)
        await expect(lease.run(async () => undefined)).rejects.toThrow('RLS connection lease is closed')
    })

    it('makes repeated close calls await the same drain', async () => {
        const lease = createRlsConnectionLease()
        let resolveOperation!: () => void
        const operationBarrier = new Promise<void>((resolve) => {
            resolveOperation = resolve
        })
        const operation = lease.run(() => operationBarrier)

        const firstClose = lease.close()
        const secondClose = lease.close()
        expect(firstClose).toBe(secondClose)

        resolveOperation()
        await Promise.all([operation, firstClose, secondClose])
    })
})
