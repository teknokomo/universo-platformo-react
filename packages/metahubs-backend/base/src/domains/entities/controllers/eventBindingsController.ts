import { z } from 'zod'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { EventBindingService } from '../services/EventBindingService'
import { EntityTypeService } from '../services/EntityTypeService'

const createEventBindingSchema = z
    .object({
        eventName: z.string().trim().min(1),
        actionId: z.string().min(1),
        priority: z.number().int().optional(),
        isActive: z.boolean().optional(),
        config: z.record(z.unknown()).optional()
    })
    .strict()

const updateEventBindingSchema = z
    .object({
        eventName: z.string().trim().min(1).optional(),
        actionId: z.string().min(1).optional(),
        priority: z.number().int().optional(),
        isActive: z.boolean().optional(),
        config: z.record(z.unknown()).optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export function createEventBindingsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const list = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new EventBindingService(exec, schemaService, new EntityTypeService(exec, schemaService))
            const items = await service.listByObjectId(metahubId, req.params.objectId, userId)
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const getById = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const service = new EventBindingService(exec, schemaService, new EntityTypeService(exec, schemaService))
            const item = await service.getById(metahubId, req.params.bindingId, userId)
            if (!item) {
                return res.status(404).json({ error: 'Event binding not found' })
            }
            return res.json(item)
        },
        { permission: 'manageMetahub' }
    )

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = createEventBindingSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const service = new EventBindingService(exec, schemaService, new EntityTypeService(exec, schemaService))
            const created = await service.create(
                metahubId,
                {
                    objectId: req.params.objectId,
                    eventName: parsed.data.eventName,
                    actionId: parsed.data.actionId,
                    priority: parsed.data.priority,
                    isActive: parsed.data.isActive,
                    config: parsed.data.config
                },
                userId
            )

            return res.status(201).json(created)
        },
        { permission: 'manageMetahub' }
    )

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = updateEventBindingSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const service = new EventBindingService(exec, schemaService, new EntityTypeService(exec, schemaService))
            const updated = await service.update(
                metahubId,
                req.params.bindingId,
                {
                    eventName: parsed.data.eventName,
                    actionId: parsed.data.actionId,
                    priority: parsed.data.priority,
                    isActive: parsed.data.isActive,
                    config: parsed.data.config,
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
            const service = new EventBindingService(exec, schemaService, new EntityTypeService(exec, schemaService))
            await service.delete(metahubId, req.params.bindingId, userId)
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return { list, getById, create, update, remove }
}
