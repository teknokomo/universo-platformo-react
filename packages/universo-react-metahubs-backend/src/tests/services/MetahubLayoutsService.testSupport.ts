import { MetahubLayoutsService } from '../../domains/layouts/services/MetahubLayoutsService'

export const createMetahubLayoutsServiceTestHarness = (query: jest.Mock, schemaName: string) => {
    const tx = { query }
    const executor = {
        query,
        transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
        isReleased: () => false
    }
    const schemaService = { ensureSchema: jest.fn(async () => schemaName) }
    const service = new MetahubLayoutsService(executor as never, schemaService as never)

    return { service, executor }
}
