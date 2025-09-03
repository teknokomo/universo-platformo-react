import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourcesRouter } from '../resourcesRoutes'
import { Resource } from '../../database/entities/Resource'
import { ResourceComposition } from '../../database/entities/ResourceComposition'

const getHandler = (router: any, method: string, path: string) => {
    const layer = router.stack.find((l: any) => l.route?.path === path && l.route?.methods?.[method])
    assert.ok(layer, `${method.toUpperCase()} ${path} route not found`)
    return layer.route.stack[0].handle
}

test('builds nested tree from single query', async () => {
    let calls = 0
    const dataSource: any = {
        isInitialized: true,
        query: async () => {
            calls++
            return [
                {
                    resource_id: '1',
                    resource: { id: '1' },
                    comp_id: null,
                    parent_resource_id: null,
                    quantity: null,
                    sort_order: null,
                    is_required: null,
                    config: null
                },
                {
                    resource_id: '2',
                    resource: { id: '2' },
                    comp_id: 'c1',
                    parent_resource_id: '1',
                    quantity: 1,
                    sort_order: 0,
                    is_required: false,
                    config: {}
                },
                {
                    resource_id: '3',
                    resource: { id: '3' },
                    comp_id: 'c2',
                    parent_resource_id: '2',
                    quantity: 1,
                    sort_order: 0,
                    is_required: false,
                    config: {}
                }
            ]
        }
    }
    const router = createResourcesRouter((_req, _res, next) => next(), dataSource)
    const handler = getHandler(router, 'get', '/:id/tree')
    const req: any = { params: { id: '1' } }
    let body: any
    const res: any = {
        json: (b: any) => {
            body = b
        },
        status: () => res
    }
    await handler(req, res)
    assert.equal(calls, 1)
    assert.equal(body.resource.id, '1')
    assert.equal(body.children[0].child.resource.id, '2')
    assert.equal(body.children[0].child.children[0].child.resource.id, '3')
})

test('prevents cycles when adding child', async () => {
    const resourceRepo = { findOne: async ({ where: { id } }: any) => ({ id }) }
    let saved = false
    const compositionRepo = {
        create: () => ({}),
        save: async () => {
            saved = true
        }
    }
    const dataSource: any = {
        isInitialized: true,
        getRepository: (entity: any) => {
            if (entity === Resource) return resourceRepo
            if (entity === ResourceComposition) return compositionRepo
            return {}
        },
        query: async () => [{ found: true }]
    }
    const router = createResourcesRouter((_req, _res, next) => next(), dataSource)
    const handler = getHandler(router, 'post', '/:id/children')
    const req: any = { params: { id: '1' }, body: { childId: '2' } }
    const res: any = {
        statusCode: 0,
        body: null,
        status(code: number) {
            this.statusCode = code
            return this
        },
        json(b: any) {
            this.body = b
        }
    }
    await handler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body, { error: 'Cycle detected' })
    assert.equal(saved, false)
})
