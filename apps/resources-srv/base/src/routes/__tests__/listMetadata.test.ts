import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourcesRouter } from '../resourcesRoutes'
import { ResourceCategory } from '../../database/entities/ResourceCategory'
import { Resource } from '../../database/entities/Resource'
import { ResourceRevision } from '../../database/entities/ResourceRevision'
import { ResourceComposition } from '../../database/entities/ResourceComposition'
import { ResourceState } from '../../database/entities/ResourceState'
import { StorageType } from '../../database/entities/StorageType'

const getHandler = (router: any, path: string) => {
    const layer = router.stack.find((l: any) => l.route?.path === path && l.route?.methods?.get)
    assert.ok(layer, `GET ${path} route not found`)
    return layer.route.stack[0].handle
}

test('lists states', async () => {
    const categoryRepo = {}
    const resourceRepo = {}
    const revisionRepo = {}
    const compositionRepo = {}
    const stateRepo = { find: async () => [{ id: 's1' }] }
    const storageRepo = {}

    const dataSource: any = {
        isInitialized: true,
        getRepository: (entity: any) => {
            if (entity === ResourceCategory) return categoryRepo
            if (entity === Resource) return resourceRepo
            if (entity === ResourceRevision) return revisionRepo
            if (entity === ResourceComposition) return compositionRepo
            if (entity === ResourceState) return stateRepo
            if (entity === StorageType) return storageRepo
            throw new Error('Unknown entity')
        }
    }

    const router = createResourcesRouter((_req, _res, next) => next(), dataSource)
    const handler = getHandler(router, '/states')
    const res: any = {
        json(data: any) {
            this.data = data
        }
    }
    await handler({}, res)
    assert.deepEqual(res.data, [{ id: 's1' }])
})

test('lists storage types', async () => {
    const categoryRepo = {}
    const resourceRepo = {}
    const revisionRepo = {}
    const compositionRepo = {}
    const stateRepo = {}
    const storageRepo = { find: async () => [{ id: 't1' }] }

    const dataSource: any = {
        isInitialized: true,
        getRepository: (entity: any) => {
            if (entity === ResourceCategory) return categoryRepo
            if (entity === Resource) return resourceRepo
            if (entity === ResourceRevision) return revisionRepo
            if (entity === ResourceComposition) return compositionRepo
            if (entity === ResourceState) return stateRepo
            if (entity === StorageType) return storageRepo
            throw new Error('Unknown entity')
        }
    }

    const router = createResourcesRouter((_req, _res, next) => next(), dataSource)
    const handler = getHandler(router, '/storage-types')
    const res: any = {
        json(data: any) {
            this.data = data
        }
    }
    await handler({}, res)
    assert.deepEqual(res.data, [{ id: 't1' }])
})
