import { z } from 'zod'
import { validateListQuery } from '../../../shared/queryParams'
import type { createMetahubHandlerFactory } from '../../../shared/createMetahubHandler'
import { MetahubObjectsService } from '../../../metahubs/services/MetahubObjectsService'
import { MetahubComponentsService } from '../../../metahubs/services/MetahubComponentsService'
import { MetahubRecordsService } from '../../../metahubs/services/MetahubRecordsService'
import { validation } from '@universo/utils'
import { ComponentDefinitionDataType } from '@universo/types'

const { normalizeRecordCopyOptions } = validation

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createRecordSchema = z
    .object({
        data: z.record(z.unknown()),
        sortOrder: z.number().int().optional()
    })
    .strict()

const updateRecordSchema = z
    .object({
        data: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

const copyRecordSchema = z
    .object({
        copyChildTables: z.boolean().optional()
    })
    .strict()

const moveRecordSchema = z
    .object({
        direction: z.enum(['up', 'down'])
    })
    .strict()

const reorderRecordSchema = z
    .object({
        recordId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createRecordsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const mkServices = (
        exec: import('../../../../utils').DbExecutor,
        schemaService: import('../../../metahubs/services/MetahubSchemaService').MetahubSchemaService
    ) => {
        const objectsService = new MetahubObjectsService(exec, schemaService)
        const componentsService = new MetahubComponentsService(exec, schemaService)
        const recordsService = new MetahubRecordsService(exec, schemaService, objectsService, componentsService)
        return { recordsService, componentsService }
    }

    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectCollectionId } = req.params
        const { recordsService } = mkServices(exec, schemaService)

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

        const { items, total } = await recordsService.findAllAndCount(
            metahubId,
            objectCollectionId,
            { limit, offset, sortBy, sortOrder, search },
            userId
        )

        res.json({
            items,
            pagination: { total, limit, offset }
        })
    })

    const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectCollectionId, recordId } = req.params
        const { recordsService } = mkServices(exec, schemaService)

        const record = await recordsService.findById(metahubId, objectCollectionId, recordId, userId)
        if (!record) {
            return res.status(404).json({ error: 'Record not found' })
        }
        res.json(record)
    })

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectCollectionId } = req.params
            const { recordsService } = mkServices(exec, schemaService)

            const parsed = createRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder } = parsed.data

            const record = await recordsService.create(metahubId, objectCollectionId, { data, sortOrder, createdBy: userId }, userId)
            res.status(201).json(record)
        },
        { permission: 'editContent' }
    )

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectCollectionId, recordId } = req.params
            const { recordsService } = mkServices(exec, schemaService)

            const parsed = updateRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder, expectedVersion } = parsed.data

            const record = await recordsService.update(
                metahubId,
                objectCollectionId,
                recordId,
                { data, sortOrder, updatedBy: userId, expectedVersion },
                userId
            )
            res.json(record)
        },
        { permission: 'editContent' }
    )

    const move = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectCollectionId, recordId } = req.params
            const { recordsService } = mkServices(exec, schemaService)

            const parsed = moveRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const updated = await recordsService.moveRecord(metahubId, objectCollectionId, recordId, parsed.data.direction, userId)
            return res.json(updated)
        },
        { permission: 'editContent' }
    )

    const reorder = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectCollectionId } = req.params
            const { recordsService } = mkServices(exec, schemaService)

            const parsed = reorderRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { recordId, newSortOrder } = parsed.data

            const updated = await recordsService.reorderRecord(metahubId, objectCollectionId, recordId, newSortOrder, userId)
            return res.json(updated)
        },
        { permission: 'editContent' }
    )

    const remove = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectCollectionId, recordId } = req.params
            const { recordsService } = mkServices(exec, schemaService)

            await recordsService.delete(metahubId, objectCollectionId, recordId, userId)
            res.status(204).send()
        },
        { permission: 'deleteContent' }
    )

    const copy = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectCollectionId, recordId } = req.params
            const { recordsService, componentsService } = mkServices(exec, schemaService)

            const source = await recordsService.findById(metahubId, objectCollectionId, recordId, userId)
            if (!source) {
                return res.status(404).json({ error: 'Record not found' })
            }

            const parsed = copyRecordSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const attrs = await componentsService.findAllFlat(metahubId, objectCollectionId, userId)
            const rootTableAttrs = attrs.filter((cmp) => !cmp.parentComponentId && cmp.dataType === ComponentDefinitionDataType.TABLE)
            const hasRequiredChildTables = rootTableAttrs.some((cmp) => {
                const minRows = typeof cmp.validationRules?.minRows === 'number' ? cmp.validationRules.minRows : 0
                return Boolean(cmp.isRequired) || minRows > 0
            })

            const requestedOptions = normalizeRecordCopyOptions({
                copyChildTables: parsed.data.copyChildTables
            })
            const copyOptions = hasRequiredChildTables ? { ...requestedOptions, copyChildTables: true } : requestedOptions

            const sourceData = source.data && typeof source.data === 'object' ? source.data : {}
            const copiedData: Record<string, unknown> = { ...(sourceData as Record<string, unknown>) }
            if (!copyOptions.copyChildTables) {
                for (const cmp of rootTableAttrs) {
                    delete copiedData[cmp.codename]
                }
            }

            const copied = await recordsService.create(metahubId, objectCollectionId, { data: copiedData, createdBy: userId }, userId)

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
