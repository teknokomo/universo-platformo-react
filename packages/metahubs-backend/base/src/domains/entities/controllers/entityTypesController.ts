import { z } from 'zod'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { ListQuerySchema, paginateItems } from '../../shared/queryParams'
import { getCodenameText } from '../../shared/codename'
import { EntityTypeService } from '../services/EntityTypeService'

const optionalBooleanFromQuery = z.preprocess((value) => {
    if (value === undefined) return undefined
    return value === 'true' || value === true
}, z.boolean().optional())

const entityTypeListQuerySchema = ListQuerySchema.extend({
    includeBuiltins: optionalBooleanFromQuery.default(true)
})

const codenameInputSchema = z.union([z.string().min(1), z.record(z.unknown())])

const entityTypeUiSchema = z
    .object({
        iconName: z.string().trim().min(1),
        tabs: z.array(z.string().trim().min(1)).min(1),
        sidebarSection: z.enum(['objects', 'admin']).default('objects'),
        sidebarOrder: z.number().int().min(0).optional(),
        nameKey: z.string().trim().min(1),
        descriptionKey: z.string().trim().min(1).optional()
    })
    .strict()

const createEntityTypeSchema = z
    .object({
        kindKey: z.string().trim().min(1).max(64),
        codename: codenameInputSchema,
        presentation: z.record(z.unknown()).optional(),
        components: z.record(z.unknown()),
        ui: entityTypeUiSchema,
        config: z.record(z.unknown()).optional(),
        published: z.boolean().optional()
    })
    .strict()

const updateEntityTypeSchema = z
    .object({
        kindKey: z.string().trim().min(1).max(64).optional(),
        codename: codenameInputSchema.optional(),
        presentation: z.record(z.unknown()).optional(),
        components: z.record(z.unknown()).optional(),
        ui: entityTypeUiSchema.optional(),
        config: z.record(z.unknown()).optional(),
        published: z.boolean().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export function createEntityTypesController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = entityTypeListQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }

        const service = new EntityTypeService(exec, schemaService)
        const allItems = parsed.data.includeBuiltins
            ? await service.listResolvedTypes(metahubId, userId)
            : await service.listCustomTypes(metahubId, userId)

        const search = parsed.data.search?.toLowerCase()
        const filteredItems =
            search && search.length > 0
                ? allItems.filter((item) => {
                      const codename = item.codename ? getCodenameText(item.codename).toLowerCase() : ''
                      return (
                          item.kindKey.toLowerCase().includes(search) ||
                          codename.includes(search) ||
                          item.ui.nameKey.toLowerCase().includes(search)
                      )
                  })
                : allItems

        const paged = paginateItems(filteredItems, parsed.data)
        return res.json(paged)
    })

    const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const service = new EntityTypeService(exec, schemaService)
        const item = await service.getCustomTypeById(metahubId, req.params.entityTypeId, userId)
        if (!item) {
            return res.status(404).json({ error: 'Entity type not found' })
        }
        return res.json(item)
    })

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = createEntityTypeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const service = new EntityTypeService(exec, schemaService)
            const created = await service.createCustomType(
                metahubId,
                {
                    kindKey: parsed.data.kindKey,
                    codename: parsed.data.codename,
                    presentation: parsed.data.presentation,
                    components: parsed.data.components as never,
                    ui: parsed.data.ui,
                    config: parsed.data.config,
                    published: parsed.data.published
                },
                userId
            )

            return res.status(201).json(created)
        },
        { permission: 'manageMetahub' }
    )

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = updateEntityTypeSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const service = new EntityTypeService(exec, schemaService)
            const updated = await service.updateCustomType(
                metahubId,
                req.params.entityTypeId,
                {
                    kindKey: parsed.data.kindKey,
                    codename: parsed.data.codename,
                    presentation: parsed.data.presentation,
                    components: parsed.data.components as never,
                    ui: parsed.data.ui,
                    config: parsed.data.config,
                    published: parsed.data.published,
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
            const service = new EntityTypeService(exec, schemaService)
            await service.deleteCustomType(metahubId, req.params.entityTypeId, userId)
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return { list, getById, create, update, remove }
}
