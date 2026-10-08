import { resolveRuntimeReadActiveObjectCollection } from '../../controllers/runtimeRowReadHandlers'
import { resolveRuntimeObjectCollection } from '../../controllers/runtimeRowSupport/objects'

const objects = [
    {
        id: 'set-clone-id',
        kind: 'set-clone',
        codename: 'AaaSetClone',
        table_name: null,
        config: null,
        lifecycleContract: null
    },
    {
        id: 'table-object-id',
        kind: 'object',
        codename: 'Orders',
        table_name: 'orders',
        config: null,
        lifecycleContract: null
    }
] as never

const baseParams = {
    requestedSectionId: null,
    requestedObjectCollectionId: null,
    requestedObjectCollectionCodename: null
}

describe('runtime read default section selection', () => {
    it('skips non-tabular collections when no selector is provided', async () => {
        const result = await resolveRuntimeReadActiveObjectCollection({
            ...baseParams,
            runtimeObjects: objects
        })

        expect('failure' in result).toBe(false)
        if ('failure' in result) return
        expect(result.activeObjectCollection.id).toBe('table-object-id')
        expect(result.includeRuntimeRowVersion).toBe(true)
    })

    it('still fails closed when an explicit selector addresses a non-tabular collection', async () => {
        const result = await resolveRuntimeReadActiveObjectCollection({
            ...baseParams,
            requestedObjectCollectionCodename: 'AaaSetClone',
            runtimeObjects: objects
        })

        expect(result).toMatchObject({ failure: { statusCode: 400, body: { error: 'Invalid runtime table name' } } })
    })
})

describe('runtime write default collection selection', () => {
    it('skips non-tabular collections for write defaults while keeping explicit ids fail-closed', async () => {
        const manager = {
            query: jest.fn(async () => [
                { id: 'set-clone-id', kind: 'set-clone', codename: 'AaaSetClone', table_name: null, config: null },
                { id: 'table-object-id', kind: 'object', codename: 'Orders', table_name: 'orders', config: null }
            ])
        }

        const defaulted = await resolveRuntimeObjectCollection(manager as never, 'runtime_schema', undefined)
        expect(defaulted.error).toBeNull()
        expect(defaulted.objectCollection?.id).toBe('table-object-id')

        const explicit = await resolveRuntimeObjectCollection(manager as never, 'runtime_schema', 'set-clone-id')
        expect(explicit.error).toBe('Invalid table name')
    })
})
