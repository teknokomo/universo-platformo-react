import { z } from 'zod'
import { marketingCollectionVariantSchema, marketingWidgetKeySchema } from '@universo-react/types'
import { uuidV7Schema } from '@universo-react/utils'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { MetahubLayoutsService } from '../services/MetahubLayoutsService'
import { widgetBindingSourceProvisionPayloadSchema } from '../widgetBindingService'
import { updateLayoutZoneWidgetBindingSchema, type WidgetBindingSourcesDto } from '../widgetBindingSchemas'

const parseUuidV7Param = (value: unknown): string | null => {
    const parsed = uuidV7Schema.safeParse(value)
    return parsed.success ? parsed.data : null
}

const widgetBindingLookupQuerySchema = z
    .object({
        widgetId: z.string().optional(),
        variant: marketingCollectionVariantSchema.optional(),
        parentSourceKey: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
            .optional(),
        selectedSourceKey: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
            .optional(),
        locale: z.preprocess((value) => (typeof value === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/u.test(value) ? value : 'en'), z.string()),
        offset: z.preprocess(
            (value) => (value === undefined ? 0 : typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value),
            z.number().int().min(0).max(10000)
        ),
        search: z
            .preprocess(
                (value) => (typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : value),
                z.string().max(128).optional()
            )
            .transform((value) => value || undefined),
        sourceKey: z.string().optional(),
        selectedSemanticKey: z.string().trim().min(1).max(128).optional()
    })
    .strict()

const replaceWidgetBindingsRequestSchema = updateLayoutZoneWidgetBindingSchema

export function createWidgetBindingsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const getZoneWidgetBinding = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            const widgetId = parseUuidV7Param(req.params.widgetId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            if (!widgetId) return res.status(400).json({ error: 'Invalid widget ID' })

            const requestedLocale = typeof req.query.locale === 'string' ? req.query.locale : 'en'
            const locale = /^[a-z]{2}(?:-[A-Z]{2})?$/u.test(requestedLocale) ? requestedLocale : 'en'
            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            return res.json(await layoutsService.widgetBindings.readWidgetBindings(metahubId, layoutId, widgetId, locale, userId))
        },
        { permission: 'editContent' }
    )

    const getWidgetBindingSources = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            const parsedQuery = widgetBindingLookupQuerySchema.safeParse(req.query)
            if (!parsedQuery.success) return res.status(400).json({ error: 'Invalid query' })
            const query = parsedQuery.data
            const widgetKey = marketingWidgetKeySchema.safeParse(req.params.widgetKey)
            if (!widgetKey.success) return res.status(400).json({ error: 'Invalid widget key' })
            const widgetId = query.widgetId === undefined ? null : parseUuidV7Param(query.widgetId)
            if (query.widgetId !== undefined && !widgetId) return res.status(400).json({ error: 'Invalid widget ID' })

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            let result: WidgetBindingSourcesDto
            if (widgetId) {
                result = await layoutsService.widgetBindings.listWidgetBindingSources(
                    metahubId,
                    layoutId,
                    widgetId,
                    {
                        widgetKey: widgetKey.data,
                        slot: req.params.slotKey,
                        variant: query.variant,
                        locale: query.locale,
                        offset: query.offset,
                        search: query.search,
                        parentSourceKey: query.parentSourceKey,
                        selectedSourceKey: query.selectedSourceKey
                    },
                    userId
                )
            } else {
                const layout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
                if (!layout || layout.templateKey !== 'marketing-page') {
                    return res.status(404).json({ error: 'Binding source slot not found' })
                }
                result = await layoutsService.widgetBindings.discoverWidgetBindingSources(
                    metahubId,
                    layoutId,
                    {
                        widgetKey: widgetKey.data,
                        slot: req.params.slotKey,
                        variant: query.variant,
                        locale: query.locale,
                        offset: query.offset,
                        search: query.search,
                        parentSourceKey: query.parentSourceKey,
                        selectedSourceKey: query.selectedSourceKey
                    },
                    userId
                )
            }
            if (result.widgetKey !== req.params.widgetKey) return res.status(404).json({ error: 'Binding source slot not found' })
            return res.json(result)
        },
        { permission: 'manageMetahub' }
    )

    const getWidgetBindingRecords = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            const parsedQuery = widgetBindingLookupQuerySchema.safeParse(req.query)
            if (!parsedQuery.success) return res.status(400).json({ error: 'Invalid query' })
            const query = parsedQuery.data
            if (typeof query.sourceKey !== 'string' || query.sourceKey.length === 0) return res.status(400).json({ error: 'Invalid query' })
            const sourceKey = query.sourceKey
            const widgetId = req.params.widgetId === undefined ? null : parseUuidV7Param(req.params.widgetId)
            if (req.params.widgetId !== undefined && !widgetId) return res.status(400).json({ error: 'Invalid widget ID' })

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            if (widgetId) {
                const records = await layoutsService.widgetBindings.listWidgetBindingRecords(
                    metahubId,
                    layoutId,
                    widgetId,
                    {
                        slot: req.params.slotKey,
                        sourceKey,
                        variant: query.variant,
                        locale: query.locale,
                        offset: query.offset,
                        search: query.search,
                        selectedSemanticKey: query.selectedSemanticKey
                    },
                    userId
                )
                return res.json(records)
            }

            const widgetKey = marketingWidgetKeySchema.safeParse(req.params.widgetKey)
            if (!widgetKey.success) return res.status(400).json({ error: 'Invalid widget key' })
            const layout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
            if (!layout || layout.templateKey !== 'marketing-page') return res.status(404).json({ error: 'Binding source slot not found' })
            const records = await layoutsService.widgetBindings.discoverWidgetBindingRecords(
                metahubId,
                layoutId,
                {
                    widgetKey: widgetKey.data,
                    slot: req.params.slotKey,
                    variant: query.variant,
                    sourceKey,
                    locale: query.locale,
                    offset: query.offset,
                    search: query.search,
                    selectedSemanticKey: query.selectedSemanticKey
                },
                userId
            )
            return res.json(records)
        },
        { permission: 'manageMetahub' }
    )

    const provisionWidgetBindingSource = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            const widgetKey = marketingWidgetKeySchema.safeParse(req.params.widgetKey)
            if (!widgetKey.success) return res.status(400).json({ error: 'Invalid widget key' })
            const parsed = widgetBindingSourceProvisionPayloadSchema.safeParse(req.body)
            if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const source = await layoutsService.widgetBindings.provisionWidgetBindingSource(
                metahubId,
                layoutId,
                { ...parsed.data, widgetKey: widgetKey.data, slot: req.params.slotKey },
                userId
            )
            return res.status(201).json(source)
        },
        { permission: 'manageMetahub' }
    )

    const getWidgetBindingUsage = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            const widgetId = typeof req.query.widgetId === 'string' ? parseUuidV7Param(req.query.widgetId) : null
            const slot = typeof req.query.slot === 'string' ? req.query.slot : ''
            const sourceKey = typeof req.query.sourceKey === 'string' ? req.query.sourceKey : ''
            if (req.query.semanticKey !== undefined && typeof req.query.semanticKey !== 'string') {
                return res.status(400).json({ error: 'Invalid binding target' })
            }
            const semanticKey = typeof req.query.semanticKey === 'string' ? req.query.semanticKey : undefined
            if (!widgetId || !slot || !sourceKey) return res.status(400).json({ error: 'Invalid binding target' })
            const service = new MetahubLayoutsService(exec, schemaService)
            return res.json(
                await service.widgetBindings.getWidgetBindingUsage(metahubId, layoutId, { widgetId, slot, sourceKey, semanticKey }, userId)
            )
        },
        { permission: 'editContent' }
    )

    const updateZoneWidgetBinding = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            const widgetId = parseUuidV7Param(req.params.widgetId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            if (!widgetId) return res.status(400).json({ error: 'Invalid widget ID' })

            const parsed = replaceWidgetBindingsRequestSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            return res.json(await layoutsService.widgetBindings.updateWidgetBinding(metahubId, layoutId, widgetId, parsed.data, userId))
        },
        { permission: 'manageMetahub' }
    )

    return {
        getZoneWidgetBinding,
        getWidgetBindingSources,
        getWidgetBindingRecords,
        provisionWidgetBindingSource,
        getWidgetBindingUsage,
        updateZoneWidgetBinding
    }
}
