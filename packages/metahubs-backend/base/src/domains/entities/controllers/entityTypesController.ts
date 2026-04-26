import { z } from 'zod'
import type { VersionedLocalizedContent } from '@universo/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { ListQuerySchema, paginateItems } from '../../shared/queryParams'
import { getCodenameText } from '../../shared/codename'
import { EntityTypeService } from '../services/EntityTypeService'

const entityTypeListQuerySchema = ListQuerySchema

const codenameInputSchema = z.union([z.string().min(1), z.record(z.unknown())])
const localizedContentEntrySchema = z
    .object({
        content: z.string(),
        version: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough()

const localizedTitleSchema: z.ZodType<VersionedLocalizedContent<string>> = z
    .object({
        _schema: z.string().optional(),
        _primary: z.string().trim().min(1),
        locales: z.record(localizedContentEntrySchema).refine((locales) => Object.keys(locales).length > 0, {
            message: 'At least one locale is required'
        })
    })
    .passthrough()
    .superRefine((value, ctx) => {
        if (!value.locales[value._primary]) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['locales', value._primary],
                message: 'Primary locale entry is required'
            })
        }
    }) as z.ZodType<VersionedLocalizedContent<string>>

const entityTypeUiSchema = z
    .object({
        iconName: z.string().trim().min(1),
        tabs: z.array(z.string().trim().min(1)).min(1),
        sidebarSection: z.enum(['objects', 'admin']).default('objects'),
        sidebarOrder: z.number().int().min(0).optional(),
        nameKey: z.string().trim().min(1),
        descriptionKey: z.string().trim().min(1).optional(),
        resourceSurfaces: z
            .array(
                z
                    .object({
                        key: z.string().trim().min(1).max(64),
                        capability: z.enum(['dataSchema', 'fixedValues', 'optionValues']),
                        routeSegment: z.string().trim().min(1).max(64),
                        title: localizedTitleSchema.optional(),
                        titleKey: z.string().trim().min(1).optional(),
                        fallbackTitle: z.string().trim().min(1).optional()
                    })
                    .strict()
            )
            .optional()
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
        const allItems = await service.listTypes(metahubId, userId)

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
        const item = await service.getTypeById(metahubId, req.params.entityTypeId, userId)
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
            const created = await service.createType(
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
            const updated = await service.updateType(
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
            await service.deleteType(metahubId, req.params.entityTypeId, userId)
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return { list, getById, create, update, remove }
}
