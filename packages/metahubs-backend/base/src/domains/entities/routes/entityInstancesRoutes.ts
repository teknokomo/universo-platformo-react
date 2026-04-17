import { Router, type Request, type RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo/utils'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { createEntityInstancesController } from '../controllers/entityInstancesController'

const normalizeRouteKindKey = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '')

const ensureGenericRouteKind = (req: Request): void => {
    const routeKindKey = normalizeRouteKindKey(req.params.kindKey)
    if (!routeKindKey) {
        return
    }

    if (typeof req.query.kind !== 'string') {
        req.query = {
            ...req.query,
            kind: routeKindKey
        }
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return
    }

    if (!('kind' in req.body)) {
        req.body = {
            ...req.body,
            kind: routeKindKey
        }
    }
}

const ensureGenericTrashQuery = (req: Request): void => {
    ensureGenericRouteKind(req)
    if (req.query.onlyDeleted === undefined) {
        req.query = {
            ...req.query,
            onlyDeleted: 'true'
        }
    }
}

export function createEntityInstancesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    const ctrl = createEntityInstancesController(createHandler)

    router.get('/metahub/:metahubId/entities', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/entities', writeLimiter, asyncHandler(ctrl.create))
    router.post('/metahub/:metahubId/entities/reorder', writeLimiter, asyncHandler(ctrl.reorder))
    router.get('/metahub/:metahubId/entity/:entityId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/entity/:entityId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/entity/:entityId', writeLimiter, asyncHandler(ctrl.remove))
    router.post('/metahub/:metahubId/entity/:entityId/restore', writeLimiter, asyncHandler(ctrl.restore))
    router.delete('/metahub/:metahubId/entity/:entityId/permanent', writeLimiter, asyncHandler(ctrl.permanentRemove))
    router.post('/metahub/:metahubId/entity/:entityId/copy', writeLimiter, asyncHandler(ctrl.copy))

    router.get(
        '/metahub/:metahubId/entities/:kindKey/instances',
        readLimiter,
        asyncHandler(async (req, res) => {
            ensureGenericRouteKind(req)
            await ctrl.list(req, res)
        })
    )
    router.post(
        '/metahub/:metahubId/entities/:kindKey/instances',
        writeLimiter,
        asyncHandler(async (req, res) => {
            ensureGenericRouteKind(req)
            await ctrl.create(req, res)
        })
    )
    router.patch(
        '/metahub/:metahubId/entities/:kindKey/instances/reorder',
        writeLimiter,
        asyncHandler(async (req, res) => {
            ensureGenericRouteKind(req)
            await ctrl.reorder(req, res)
        })
    )
    router.get(
        '/metahub/:metahubId/entities/:kindKey/instances/trash',
        readLimiter,
        asyncHandler(async (req, res) => {
            ensureGenericTrashQuery(req)
            await ctrl.list(req, res)
        })
    )

    router.get('/metahub/:metahubId/entities/:kindKey/instance/:entityId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/entities/:kindKey/instance/:entityId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/entities/:kindKey/instance/:entityId', writeLimiter, asyncHandler(ctrl.remove))
    router.post('/metahub/:metahubId/entities/:kindKey/instance/:entityId/copy', writeLimiter, asyncHandler(ctrl.copy))
    router.post('/metahub/:metahubId/entities/:kindKey/instance/:entityId/restore', writeLimiter, asyncHandler(ctrl.restore))
    router.delete('/metahub/:metahubId/entities/:kindKey/instance/:entityId/permanent', writeLimiter, asyncHandler(ctrl.permanentRemove))
    router.get(
        '/metahub/:metahubId/entities/:kindKey/instance/:entityId/blocking-dependencies',
        readLimiter,
        asyncHandler(ctrl.getBlockingDependencies)
    )
    router.get(
        '/metahub/:metahubId/entities/:kindKey/instance/:entityId/blocking-references',
        readLimiter,
        asyncHandler(ctrl.getBlockingReferences)
    )

    router.get(
        '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instances',
        readLimiter,
        asyncHandler(ctrl.listNestedStandardInstances)
    )
    router.post(
        '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instances',
        writeLimiter,
        asyncHandler(ctrl.createNestedStandardInstances)
    )
    router.patch(
        '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instances/reorder',
        writeLimiter,
        asyncHandler(ctrl.reorderNestedStandardInstances)
    )
    router.get(
        '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:entityId',
        readLimiter,
        asyncHandler(ctrl.getNestedStandardInstanceById)
    )
    router.patch(
        '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:entityId',
        writeLimiter,
        asyncHandler(ctrl.updateNestedStandardInstance)
    )
    router.delete(
        '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:entityId',
        writeLimiter,
        asyncHandler(ctrl.deleteNestedStandardInstance)
    )

    router.get(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/values',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/values'
        ],
        readLimiter,
        asyncHandler(ctrl.listOptionValues)
    )
    router.get(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/value/:valueId',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/value/:valueId'
        ],
        readLimiter,
        asyncHandler(ctrl.getOptionValueById)
    )
    router.get(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/value/:valueId/blocking-references',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/value/:valueId/blocking-references'
        ],
        readLimiter,
        asyncHandler(ctrl.getOptionValueBlockingReferences)
    )
    router.post(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/values',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/values'
        ],
        writeLimiter,
        asyncHandler(ctrl.createOptionValue)
    )
    router.patch(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/value/:valueId',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/value/:valueId'
        ],
        writeLimiter,
        asyncHandler(ctrl.updateOptionValue)
    )
    router.patch(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/value/:valueId/move',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/value/:valueId/move'
        ],
        writeLimiter,
        asyncHandler(ctrl.moveOptionValue)
    )
    router.patch(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/values/reorder',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/values/reorder'
        ],
        writeLimiter,
        asyncHandler(ctrl.reorderOptionValue)
    )
    router.post(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/value/:valueId/copy',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/value/:valueId/copy'
        ],
        writeLimiter,
        asyncHandler(ctrl.copyOptionValue)
    )
    router.delete(
        [
            '/metahub/:metahubId/entities/:kindKey/instance/:optionListId/value/:valueId',
            '/metahub/:metahubId/entities/:kindKey/instance/:treeEntityId/instance/:optionListId/value/:valueId'
        ],
        writeLimiter,
        asyncHandler(ctrl.deleteOptionValue)
    )

    return router
}
