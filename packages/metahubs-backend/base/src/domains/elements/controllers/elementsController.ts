import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { validation } from '@universo/utils'
import { AttributeDataType } from '@universo/types'

const { normalizeElementCopyOptions } = validation

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createElementSchema = z
    .object({
        data: z.record(z.unknown()),
        sortOrder: z.number().int().optional()
    })
    .strict()

const updateElementSchema = z
    .object({
        data: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

const copyElementSchema = z
    .object({
        copyChildTables: z.boolean().optional()
    })
    .strict()

const moveElementSchema = z
    .object({
        direction: z.enum(['up', 'down'])
    })
    .strict()

const reorderElementSchema = z
    .object({
        elementId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createElementsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const mkServices = (
        exec: import('../../../utils').DbExecutor,
        schemaService: import('../../metahubs/services/MetahubSchemaService').MetahubSchemaService
    ) => {
        const objectsService = new MetahubObjectsService(exec, schemaService)
        const attributesService = new MetahubAttributesService(exec, schemaService)
        const elementsService = new MetahubElementsService(exec, schemaService, objectsService, attributesService)
        return { elementsService, attributesService }
    }

    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { catalogId } = req.params
        const { elementsService } = mkServices(exec, schemaService)

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }

        const { limit, offset, sortBy, sortOrder, search } = validatedQuery

        const { items, total } = await elementsService.findAllAndCount(
            metahubId,
            catalogId,
            { limit, offset, sortBy, sortOrder, search },
            userId
        )

        res.json({
            items,
            pagination: { total, limit, offset }
        })
    })

    const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { catalogId, elementId } = req.params
        const { elementsService } = mkServices(exec, schemaService)

        const element = await elementsService.findById(metahubId, catalogId, elementId, userId)
        if (!element) {
            return res.status(404).json({ error: 'Element not found' })
        }
        res.json(element)
    })

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId } = req.params
            const { elementsService } = mkServices(exec, schemaService)

            const parsed = createElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder } = parsed.data

            const element = await elementsService.create(metahubId, catalogId, { data, sortOrder, createdBy: userId }, userId)
            res.status(201).json(element)
        },
        { permission: 'editContent' }
    )

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId, elementId } = req.params
            const { elementsService } = mkServices(exec, schemaService)

            const parsed = updateElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder, expectedVersion } = parsed.data

            const element = await elementsService.update(
                metahubId,
                catalogId,
                elementId,
                { data, sortOrder, updatedBy: userId, expectedVersion },
                userId
            )
            res.json(element)
        },
        { permission: 'editContent' }
    )

    const move = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId, elementId } = req.params
            const { elementsService } = mkServices(exec, schemaService)

            const parsed = moveElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const updated = await elementsService.moveElement(metahubId, catalogId, elementId, parsed.data.direction, userId)
            return res.json(updated)
        },
        { permission: 'editContent' }
    )

    const reorder = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId } = req.params
            const { elementsService } = mkServices(exec, schemaService)

            const parsed = reorderElementSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { elementId, newSortOrder } = parsed.data

            const updated = await elementsService.reorderElement(metahubId, catalogId, elementId, newSortOrder, userId)
            return res.json(updated)
        },
        { permission: 'editContent' }
    )

    const remove = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId, elementId } = req.params
            const { elementsService } = mkServices(exec, schemaService)

            await elementsService.delete(metahubId, catalogId, elementId, userId)
            res.status(204).send()
        },
        { permission: 'deleteContent' }
    )

    const copy = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId, elementId } = req.params
            const { elementsService, attributesService } = mkServices(exec, schemaService)

            const source = await elementsService.findById(metahubId, catalogId, elementId, userId)
            if (!source) {
                return res.status(404).json({ error: 'Element not found' })
            }

            const parsed = copyElementSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const attrs = await attributesService.findAllFlat(metahubId, catalogId, userId)
            const rootTableAttrs = attrs.filter((attr) => !attr.parentAttributeId && attr.dataType === AttributeDataType.TABLE)
            const hasRequiredChildTables = rootTableAttrs.some((attr) => {
                const minRows = typeof attr.validationRules?.minRows === 'number' ? attr.validationRules.minRows : 0
                return Boolean(attr.isRequired) || minRows > 0
            })

            const requestedOptions = normalizeElementCopyOptions({
                copyChildTables: parsed.data.copyChildTables
            })
            const copyOptions = hasRequiredChildTables ? { ...requestedOptions, copyChildTables: true } : requestedOptions

            const sourceData = source.data && typeof source.data === 'object' ? source.data : {}
            const copiedData: Record<string, unknown> = { ...(sourceData as Record<string, unknown>) }
            if (!copyOptions.copyChildTables) {
                for (const attr of rootTableAttrs) {
                    delete copiedData[attr.codename]
                }
            }

            const copied = await elementsService.create(metahubId, catalogId, { data: copiedData, createdBy: userId }, userId)

            return res.status(201).json({
                ...copied,
                copyOptions,
                hasRequiredChildTables
            })
        },
        { permission: 'editContent' }
    )

    return { list, getById, create, update, move, reorder, remove, copy }
}
