import { z } from 'zod'
import { SHARED_ENTITY_KINDS, SHARED_OBJECT_KINDS, type SharedObjectKind } from '@universo/types'
import type { createMetahubHandlerFactory } from '../createMetahubHandler'
import { SharedContainerService } from '../services/SharedContainerService'
import { SharedEntityOverridesService } from '../services/SharedEntityOverridesService'

const sharedEntityKindSchema = z.enum(SHARED_ENTITY_KINDS)

const listSharedEntityOverridesQuerySchema = z
    .object({
        entityKind: sharedEntityKindSchema,
        sharedEntityId: z.string().uuid().optional(),
        targetObjectId: z.string().uuid().optional()
    })
    .superRefine((value, ctx) => {
        const filters = [value.sharedEntityId, value.targetObjectId].filter((entry) => entry !== undefined)
        if (filters.length !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Exactly one of sharedEntityId or targetObjectId must be provided',
                path: ['sharedEntityId']
            })
        }
    })

const upsertSharedEntityOverrideSchema = z
    .object({
        entityKind: sharedEntityKindSchema,
        sharedEntityId: z.string().uuid(),
        targetObjectId: z.string().uuid(),
        isExcluded: z.boolean().optional(),
        isActive: z.boolean().nullable().optional(),
        sortOrder: z.number().int().nullable().optional()
    })
    .superRefine((value, ctx) => {
        const hasAnyChange = value.isExcluded !== undefined || value.isActive !== undefined || value.sortOrder !== undefined
        if (!hasAnyChange) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'At least one override field must be provided'
            })
        }
    })

const clearSharedEntityOverrideQuerySchema = z.object({
    entityKind: sharedEntityKindSchema,
    sharedEntityId: z.string().uuid(),
    targetObjectId: z.string().uuid()
})

export function createSharedEntityOverridesController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const mapContainerItems = (objectIds: Partial<Record<SharedObjectKind, string>>) =>
        Object.values(SHARED_OBJECT_KINDS).flatMap((kind) => {
            const objectId = objectIds[kind]
            return objectId ? [{ kind, objectId }] : []
        })

    const listContainers = createHandler(
        async ({ res, metahubId, userId, exec, schemaService }) => {
            const service = new SharedContainerService(exec, schemaService)
            const objectIds = await service.findAllContainerObjectIds(metahubId, userId)
            const items = mapContainerItems(objectIds)
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const ensureContainers = createHandler(
        async ({ res, metahubId, userId, exec, schemaService }) => {
            const service = new SharedContainerService(exec, schemaService)
            const objectIds = await service.resolveAllContainerObjectIds(metahubId, userId)
            const items = mapContainerItems(objectIds)
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const list = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = listSharedEntityOverridesQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }

            const service = new SharedEntityOverridesService(exec, schemaService)
            const items = parsed.data.sharedEntityId
                ? await service.findBySharedEntity(metahubId, parsed.data.entityKind, parsed.data.sharedEntityId, userId)
                : await service.findByTargetObject(metahubId, parsed.data.entityKind, parsed.data.targetObjectId!, userId)

            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const patch = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = upsertSharedEntityOverrideSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const service = new SharedEntityOverridesService(exec, schemaService)
            const item = await service.upsertOverride({
                metahubId,
                entityKind: parsed.data.entityKind,
                sharedEntityId: parsed.data.sharedEntityId,
                targetObjectId: parsed.data.targetObjectId,
                isExcluded: parsed.data.isExcluded,
                isActive: parsed.data.isActive,
                sortOrder: parsed.data.sortOrder,
                userId,
                db: exec
            })

            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    const remove = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = clearSharedEntityOverrideQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }

            const service = new SharedEntityOverridesService(exec, schemaService)
            await service.clearOverride(metahubId, parsed.data.entityKind, parsed.data.sharedEntityId, parsed.data.targetObjectId, userId)

            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return { listContainers, ensureContainers, list, patch, remove }
}
