import type { Request, Response, RequestHandler } from 'express'
import { isBuiltinEntityKind } from '@universo/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import {
    type BuiltinEntityRouteKind,
    normalizeRouteKindKey,
    isBuiltinEntityRouteKind,
    ensureStandardRouteKindQuery,
    ensureStandardCreateRouteKindBody,
    assignBuiltinEntityIdParam,
    invokeHandler,
    respondUnsupportedEntityRouteKind
} from './entityControllerShared'
import { createEntityCrudHandlers } from './entityCrudHandlers'
import { createNestedChildHandlers } from './nestedChildHandlers'
import { createOptionValueHandlers } from './optionValueHandlers'

export function createEntityInstancesController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const crud = createEntityCrudHandlers(createHandler)
    const nested = createNestedChildHandlers(createHandler)
    const optionValue = createOptionValueHandlers(createHandler)

    const resolveBuiltinEntityRouteKind = async (req: Request): Promise<BuiltinEntityRouteKind | null> => {
        const routeKindKey = normalizeRouteKindKey(req.params.kindKey)
        return routeKindKey && isBuiltinEntityKind(routeKindKey) && isBuiltinEntityRouteKind(routeKindKey) ? routeKindKey : null
    }

    const dispatchStandardRouteKind = ({
        handlers,
        prepare
    }: {
        handlers: Partial<Record<BuiltinEntityRouteKind, RequestHandler>>
        prepare?: (req: Request, routeKind: BuiltinEntityRouteKind) => void
    }) => {
        return async (req: Request, res: Response): Promise<void> => {
            const routeKind = await resolveBuiltinEntityRouteKind(req)
            if (!routeKind) {
                respondUnsupportedEntityRouteKind(res)
                return
            }

            const handler = handlers[routeKind]
            if (!handler) {
                respondUnsupportedEntityRouteKind(res)
                return
            }

            ensureStandardRouteKindQuery(req)
            prepare?.(req, routeKind)
            await invokeHandler(handler, req, res)
        }
    }

    const requireBuiltinEntityRouteKind = ({
        expectedKind,
        handler,
        prepare
    }: {
        expectedKind: BuiltinEntityRouteKind
        handler: RequestHandler
        prepare?: (req: Request, routeKind: BuiltinEntityRouteKind) => void
    }) => {
        return async (req: Request, res: Response): Promise<void> => {
            const routeKind = await resolveBuiltinEntityRouteKind(req)
            if (routeKind !== expectedKind) {
                respondUnsupportedEntityRouteKind(res)
                return
            }

            ensureStandardRouteKindQuery(req)
            prepare?.(req, routeKind)
            await invokeHandler(handler, req, res)
        }
    }

    return {
        list: crud.list,
        getById: crud.getById,
        create: crud.create,
        update: crud.update,
        getBlockingReferences: crud.getBlockingReferences,
        getBlockingDependencies: crud.getBlockingDependencies,
        remove: crud.remove,
        restore: crud.restore,
        permanentRemove: crud.permanentRemove,
        copy: crud.copy,
        reorder: crud.reorder,
        listNestedStandardInstances: dispatchStandardRouteKind({
            handlers: {
                hub: nested.listNestedTreeEntities,
                object: nested.listNestedObjectCollections,
                set: nested.listNestedSets,
                enumeration: nested.listNestedOptionLists
            }
        }),
        createNestedStandardInstances: dispatchStandardRouteKind({
            handlers: {
                object: nested.createNestedObjectCollection,
                set: nested.createNestedSet,
                enumeration: nested.createNestedOptionList
            },
            prepare: (req) => ensureStandardCreateRouteKindBody(req)
        }),
        reorderNestedStandardInstances: dispatchStandardRouteKind({
            handlers: {
                object: nested.reorderNestedObjectCollections,
                set: nested.reorderNestedSets,
                enumeration: nested.reorderNestedOptionLists
            }
        }),
        getNestedStandardInstanceById: dispatchStandardRouteKind({
            handlers: {
                object: nested.getNestedObjectCollectionById,
                set: nested.getNestedSetById,
                enumeration: nested.getNestedOptionListById
            },
            prepare: assignBuiltinEntityIdParam
        }),
        updateNestedStandardInstance: dispatchStandardRouteKind({
            handlers: {
                object: nested.updateNestedObjectCollection,
                set: nested.updateNestedSet,
                enumeration: nested.updateNestedOptionList
            },
            prepare: assignBuiltinEntityIdParam
        }),
        deleteNestedStandardInstance: dispatchStandardRouteKind({
            handlers: {
                object: nested.deleteNestedObjectCollection,
                set: nested.deleteNestedSet,
                enumeration: nested.deleteNestedOptionList
            },
            prepare: assignBuiltinEntityIdParam
        }),
        listOptionValues: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.listOptionValues
        }),
        getOptionValueById: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.getOptionValueById
        }),
        getOptionValueBlockingReferences: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.getOptionValueBlockingReferences
        }),
        createOptionValue: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.createOptionValue
        }),
        updateOptionValue: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.updateOptionValue
        }),
        moveOptionValue: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.moveOptionValue
        }),
        reorderOptionValue: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.reorderOptionValue
        }),
        copyOptionValue: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.copyOptionValue
        }),
        deleteOptionValue: requireBuiltinEntityRouteKind({
            expectedKind: 'enumeration',
            handler: optionValue.deleteOptionValue
        })
    }
}
