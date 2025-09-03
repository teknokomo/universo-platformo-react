import test from 'node:test'
import assert from 'node:assert/strict'
import { Router, Request, Response } from 'express'
import { DataSource } from 'typeorm'
import { createResourcesRouter } from '../resourcesRoutes'
import { Resource } from '../../database/entities/Resource'
import { ResourceComposition } from '../../database/entities/ResourceComposition'

type RouteHandler = (req: Request, res: Response) => unknown

interface StackLayer {
    route?: {
        path?: string
        methods?: Record<string, boolean>
        stack: Array<{ handle: RouteHandler }>
    }
}

const getHandler = (router: Router, method: string, path: string): RouteHandler => {
    const layer = (router as unknown as { stack: StackLayer[] }).stack.find((l) => l.route?.path === path && l.route?.methods?.[method])
    assert.ok(layer, `${method.toUpperCase()} ${path} route not found`)
    return layer!.route!.stack[0].handle
}

test('builds nested tree from single query', async () => {
    let calls = 0
    const dataSource: Partial<DataSource> = {
        isInitialized: true,
        query: async () => {
            calls++
            return [
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
    const router = createResourcesRouter((_req, _res, next) => next(), dataSource as DataSource)
    const handler = getHandler(router, 'get', '/:id/tree')
    const req: Partial<Request> = { params: { id: '1' } }
    let body: unknown
    const res: Partial<Response> = {
        json: (b: unknown) => {
            body = b
            return res as Response
        },
        status: () => res as Response
    }
    await handler(req as Request, res as Response)
    assert.equal(calls, 1)
    interface TestNode {
        resource: { id: string }
        children: { child: TestNode }[]
    }
    const root = body as TestNode
    assert.equal(root.resource.id, '1')
    assert.equal(root.children[0].child.resource.id, '2')
    assert.equal(root.children[0].child.children[0].child.resource.id, '3')
})

test('prevents cycles when adding child', async () => {
    const resourceRepo = { findOne: async ({ where: { id } }: { where: { id: string } }) => ({ id }) }
    let saved = false
    const compositionRepo = {
        create: () => ({}),
        save: async () => {
            saved = true
        }
    }
    const dataSource: Partial<DataSource> = {
        isInitialized: true,
        getRepository: ((entity: unknown) => {
            if (entity === Resource) return resourceRepo
            if (entity === ResourceComposition) return compositionRepo
            return {}
        }) as DataSource['getRepository'],
        query: async () => [{ found: true }]
    }
    const router = createResourcesRouter((_req, _res, next) => next(), dataSource as DataSource)
    const handler = getHandler(router, 'post', '/:id/children')
    const req: Partial<Request> = { params: { id: '1' }, body: { childId: '2' } }
    const res: Partial<Response> & { statusCode?: number; body?: unknown } = {
        status(code: number) {
            this.statusCode = code
            return this as Response
        },
        json(b: unknown) {
            this.body = b
            return this as Response
        }
    }
    await handler(req as Request, res as Response)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body, { error: 'Cycle detected' })
    assert.equal(saved, false)
})
