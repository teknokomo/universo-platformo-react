import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourcesRouter } from '../resourcesRoutes'
import { ResourceCategory } from '../../database/entities/ResourceCategory'
import { ResourceState } from '../../database/entities/ResourceState'
import { StorageType } from '../../database/entities/StorageType'
import { Resource } from '../../database/entities/Resource'
import { ResourceRevision } from '../../database/entities/ResourceRevision'
import { ResourceComposition } from '../../database/entities/ResourceComposition'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getHandler = (router: any) => {
    const layer = router.stack.find((l: any) => l.route?.path === '/' && l.route?.methods?.post)
    assert.ok(layer, 'POST / route not found')
    return layer.route.stack[0].handle
}

test('creates resource with concurrent lookups', async () => {
    const startTimes: Record<string, number> = {}
    const makeRepo = (key: string) => ({
        findOne: async () => {
            startTimes[key] = Date.now()
            await delay(50)
            return {}
        }
    })

    const categoryRepo = makeRepo('category')
    const stateRepo = makeRepo('state')
    const storageRepo = makeRepo('storage')
    const resourceRepo = { create: () => ({}), save: async () => {} }
    const revisionRepo = {}
    const compositionRepo = {}

    const dataSource: any = {
        isInitialized: true,
        getRepository: (entity: any) => {
            if (entity === ResourceCategory) return categoryRepo
            if (entity === ResourceState) return stateRepo
            if (entity === StorageType) return storageRepo
            if (entity === Resource) return resourceRepo
            if (entity === ResourceRevision) return revisionRepo
            if (entity === ResourceComposition) return compositionRepo
            throw new Error('Unknown entity')
        }
    }

    const router = createResourcesRouter((_req, _res, next) => next(), dataSource)
    const handler = getHandler(router)

    const req: any = { body: { categoryId: '1', stateId: '2', storageTypeId: '3' }, params: {} }
    const res: any = {
        statusCode: 0,
        status(code: number) {
            this.statusCode = code
            return this
        },
        json() {}
    }

    await handler(req, res)

    assert.equal(res.statusCode, 201)
    const times = Object.values(startTimes) as number[]
    const duration = Math.max(...times) - Math.min(...times)
    assert.ok(duration < 50)
})

test('returns 400 when any reference missing', async () => {
    const categoryRepo = { findOne: async () => null }
    const stateRepo = { findOne: async () => ({}) }
    const storageRepo = { findOne: async () => ({}) }
    const resourceRepo = { create: () => ({}), save: async () => {} }
    const revisionRepo = {}
    const compositionRepo = {}

    const dataSource: any = {
        isInitialized: true,
        getRepository: (entity: any) => {
            if (entity === ResourceCategory) return categoryRepo
            if (entity === ResourceState) return stateRepo
            if (entity === StorageType) return storageRepo
            if (entity === Resource) return resourceRepo
            if (entity === ResourceRevision) return revisionRepo
            if (entity === ResourceComposition) return compositionRepo
            throw new Error('Unknown entity')
        }
    }

    const router = createResourcesRouter((_req, _res, next) => next(), dataSource)
    const handler = getHandler(router)

    const req: any = { body: { categoryId: '1', stateId: '2', storageTypeId: '3' }, params: {} }
    const res: any = {
        statusCode: 0,
        status(code: number) {
            this.statusCode = code
            return this
        },
        json() {}
    }

    await handler(req, res)
    assert.equal(res.statusCode, 400)
})
