import { z } from 'zod'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { ActionService } from '../services/ActionService'
import { EntityTypeService } from '../services/EntityTypeService'

const codenameInputSchema = z.union([z.string().min(1), z.record(z.unknown())])

const createActionSchema = z
    .object({
        codename: codenameInputSchema,
        presentation: z.record(z.unknown()).optional(),
        actionType: z.enum(['script', 'builtin']),
        scriptId: z.string().min(1).nullable().optional(),
        config: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().min(0).optional()
    })
    .strict()

const updateActionSchema = z
    .object({
        codename: codenameInputSchema.optional(),
        presentation: z.record(z.unknown()).optional(),
        actionType: z.enum(['script', 'builtin']).optional(),
        scriptId: z.string().min(1).nullable().optional(),
        config: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().min(0).optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export function createActionsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const list = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new ActionService(exec, schemaService, new EntityTypeService(exec, schemaService))
            const items = await service.listByObjectId(metahubId, req.params.objectId, userId)
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const getById = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new ActionService(exec, schemaService, new EntityTypeService(exec, schemaService))
            const item = await service.getById(metahubId, req.params.actionId, userId)
            if (!item) {
                return res.status(404).json({ error: 'Entity action not found' })
            }
            return res.json(item)
        },
        { permission: 'manageMetahub' }
    )

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = createActionSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const service = new ActionService(exec, schemaService, new EntityTypeService(exec, schemaService))
            const created = await service.create(
                metahubId,
                {
                    objectId: req.params.objectId,
                    codename: parsed.data.codename,
                    presentation: parsed.data.presentation,
                    actionType: parsed.data.actionType,
                    scriptId: parsed.data.scriptId,
                    config: parsed.data.config,
                    sortOrder: parsed.data.sortOrder
                },
                userId
            )

            return res.status(201).json(created)
        },
        { permission: 'manageMetahub' }
    )

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = updateActionSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const service = new ActionService(exec, schemaService, new EntityTypeService(exec, schemaService))
            const updated = await service.update(
                metahubId,
                req.params.actionId,
                {
                    codename: parsed.data.codename,
                    presentation: parsed.data.presentation,
                    actionType: parsed.data.actionType,
                    scriptId: parsed.data.scriptId,
                    config: parsed.data.config,
                    sortOrder: parsed.data.sortOrder,
                    expectedVersion: parsed.data.expectedVersion
                },
                userId
            )

            return res.json(updated)
        },
        { permission: 'manageMetahub' }
    )

    const remove = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new ActionService(exec, schemaService, new EntityTypeService(exec, schemaService))
            await service.delete(metahubId, req.params.actionId, userId)
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return { list, getById, create, update, remove }
}
