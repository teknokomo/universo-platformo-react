import { Router, Request, Response, RequestHandler } from 'express'
import type { DataSource, QueryRunner } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { DASHBOARD_LAYOUT_WIDGETS, type LayoutCopyOptions } from '@universo/types'
import { Metahub } from '../../../database/entities/Metahub'
import { ensureMetahubAccess } from '../../shared/guards'
import { getRequestManager } from '../../../utils'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import {
    MetahubLayoutsService,
    LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY,
    createLayoutSchema,
    updateLayoutSchema,
    assignLayoutZoneWidgetSchema,
    moveLayoutZoneWidgetSchema,
    updateLayoutZoneWidgetConfigSchema,
    toggleLayoutZoneWidgetActiveSchema
} from '../services/MetahubLayoutsService'
import { OptimisticLockError, localizedContent, validation } from '@universo/utils'
import { buildDashboardLayoutConfig } from '../../shared'
import { KnexClient } from '../../ddl'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeLayoutCopyOptions } = validation

type RequestUser = {
    id?: string
    sub?: string
    user_id?: string
    userId?: string
}

type RequestWithUser = Request & { user?: RequestUser }
type RequestWithDbContext = Request & { dbContext?: { queryRunner?: QueryRunner } }

type StoredLocaleEntry = { content?: unknown } | unknown
type StoredLocaleMap = Record<string, StoredLocaleEntry>
type StoredPrimary = { _primary?: unknown }
type SourceWidgetRow = {
    zone?: string
    widget_key?: string
    sort_order?: number
    config?: unknown
    is_active?: boolean
}

const getRequestQueryRunner = (req: Request): QueryRunner | undefined => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithUser).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) {
        return {
            en: 'Copy (copy)'
        }
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = `${content}${suffix}`
    }
    return result
}

const copyLayoutSchema = z.object({
    name: z.union([z.string(), z.record(z.string())]).optional(),
    description: z.union([z.string(), z.record(z.string())]).optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    copyWidgets: z.boolean().optional(),
    deactivateAllWidgets: z.boolean().optional()
})

const toLocalizedInputRecord = (value: unknown): Record<string, string | undefined> => {
    if (typeof value === 'string') {
        return { en: value }
    }
    if (value && typeof value === 'object') {
        return value as Record<string, string | undefined>
    }
    return {}
}

const toStoredLocalizedRecord = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== 'object') return {}

    // VLC format: { _schema, _primary, locales: { en: { content }, ... } }
    if ('locales' in (value as Record<string, unknown>)) {
        const locales = (value as { locales?: StoredLocaleMap }).locales
        const result: Record<string, string> = {}
        if (!locales || typeof locales !== 'object') return result
        for (const [locale, entry] of Object.entries(locales)) {
            const content =
                typeof entry === 'object' && entry !== null && 'content' in entry ? (entry as { content?: unknown }).content : entry
            if (typeof content !== 'string') continue
            const trimmed = content.trim()
            if (!trimmed) continue
            result[locale] = trimmed
        }
        return result
    }

    // Compatibility: plain localized map { en: '...', ru: '...' }
    const result: Record<string, string> = {}
    for (const [locale, content] of Object.entries(value as Record<string, unknown>)) {
        if (typeof content !== 'string') continue
        const trimmed = content.trim()
        if (!trimmed) continue
        result[locale] = trimmed
    }
    return result
}

export function createLayoutsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const listQuerySchema = z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        sortBy: z.enum(['name', 'created', 'updated']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        search: z.string().optional()
    })

    router.get(
        '/metahub/:metahubId/layouts',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            const parsed = listQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const result = await layoutsService.listLayouts(
                metahubId,
                {
                    limit: parsed.data.limit,
                    offset: parsed.data.offset,
                    sortBy: parsed.data.sortBy,
                    sortOrder: parsed.data.sortOrder,
                    search: parsed.data.search
                },
                userId
            )

            return res.json(result)
        })
    )

    router.post(
        '/metahub/:metahubId/layouts',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const parsed = createLayoutSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const sanitizedName = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.name))
            const nameVlc = buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            let descriptionVlc: ReturnType<typeof buildLocalizedContent> | null | undefined = undefined
            if (parsed.data.description === null) {
                descriptionVlc = null
            } else if (parsed.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.description))
                descriptionVlc =
                    Object.keys(sanitizedDescription).length > 0
                        ? buildLocalizedContent(
                              sanitizedDescription,
                              parsed.data.descriptionPrimaryLocale,
                              parsed.data.namePrimaryLocale ?? 'en'
                          )
                        : null
            }

            const createInput = {
                ...parsed.data,
                name: nameVlc,
                description: descriptionVlc
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const created = await layoutsService.createLayout(metahubId, createInput, userId)
            return res.status(201).json(created)
        })
    )

    router.get(
        '/metahub/:metahubId/layout/:layoutId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const layout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
            if (!layout) return res.status(404).json({ error: 'Layout not found' })
            return res.json(layout)
        })
    )

    router.post(
        '/metahub/:metahubId/layout/:layoutId/copy',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const parsed = copyLayoutSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const sourceLayout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
            if (!sourceLayout) {
                return res.status(404).json({ error: 'Layout not found' })
            }

            const requestedName = parsed.data.name
                ? sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.name))
                : buildDefaultCopyNameInput(sourceLayout.name)
            if (Object.keys(requestedName).length === 0) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            const sourceNamePrimary = sourceLayout.name?._primary ?? 'en'
            const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceNamePrimary)
            if (!nameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            let descriptionVlc: unknown = sourceLayout.description ?? null
            if (parsed.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.description))
                descriptionVlc =
                    Object.keys(sanitizedDescription).length > 0
                        ? buildLocalizedContent(
                              sanitizedDescription,
                              parsed.data.descriptionPrimaryLocale,
                              parsed.data.namePrimaryLocale ?? sourceNamePrimary
                          )
                        : null
            }

            const copyOptions: LayoutCopyOptions = normalizeLayoutCopyOptions({
                copyWidgets: parsed.data.copyWidgets,
                deactivateAllWidgets: parsed.data.deactivateAllWidgets
            })
            const shouldDeactivateWidgets =
                copyOptions.copyWidgets && (parsed.data.deactivateAllWidgets ?? copyOptions.deactivateAllWidgets)

            const schemaName = await schemaService.ensureSchema(metahubId, userId)
            const knex = KnexClient.getInstance()

            const created = await knex.transaction(async (trx) => {
                const now = new Date()

                const [createdLayout] = await trx
                    .withSchema(schemaName)
                    .into('_mhb_layouts')
                    .insert({
                        template_key: sourceLayout.templateKey ?? 'dashboard',
                        name: nameVlc,
                        description: descriptionVlc ?? null,
                        config: copyOptions.copyWidgets
                            ? shouldDeactivateWidgets
                                ? buildDashboardLayoutConfig([])
                                : sourceLayout.config ?? {}
                            : {
                                  ...buildDashboardLayoutConfig([]),
                                  [LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY]: true
                              },
                        is_active: sourceLayout.isActive ?? true,
                        is_default: false,
                        sort_order: sourceLayout.sortOrder ?? 0,
                        owner_id: null,
                        _upl_created_at: now,
                        _upl_created_by: userId ?? null,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: true,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
                    .returning('*')

                if (copyOptions.copyWidgets) {
                    const sourceWidgets = (await trx
                        .withSchema(schemaName)
                        .from('_mhb_widgets')
                        .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                        .orderBy([
                            { column: 'zone', order: 'asc' },
                            { column: 'sort_order', order: 'asc' },
                            { column: '_upl_created_at', order: 'asc' }
                        ])
                        .select(['zone', 'widget_key', 'sort_order', 'config', 'is_active'])) as SourceWidgetRow[]

                    if (sourceWidgets.length > 0) {
                        await trx
                            .withSchema(schemaName)
                            .into('_mhb_widgets')
                            .insert(
                                sourceWidgets.map((widget) => ({
                                    layout_id: createdLayout.id,
                                    zone: widget.zone,
                                    widget_key: widget.widget_key,
                                    sort_order: widget.sort_order ?? 1,
                                    config: widget.config ?? {},
                                    is_active: shouldDeactivateWidgets ? false : widget.is_active !== false,
                                    _upl_created_at: now,
                                    _upl_created_by: userId ?? null,
                                    _upl_updated_at: now,
                                    _upl_updated_by: userId ?? null,
                                    _upl_version: 1,
                                    _upl_archived: false,
                                    _upl_deleted: false,
                                    _upl_locked: false,
                                    _mhb_published: true,
                                    _mhb_archived: false,
                                    _mhb_deleted: false
                                }))
                            )
                    }
                }

                return createdLayout
            })

            return res.status(201).json({
                id: created.id,
                templateKey: created.template_key ?? 'dashboard',
                name: created.name ?? {},
                description: created.description ?? null,
                config: created.config ?? {},
                isActive: created.is_active !== false,
                isDefault: created.is_default === true,
                sortOrder: typeof created.sort_order === 'number' ? created.sort_order : 0,
                version: typeof created._upl_version === 'number' ? created._upl_version : 1,
                createdAt: created._upl_created_at,
                updatedAt: created._upl_updated_at
            })
        })
    )

    router.patch(
        '/metahub/:metahubId/layout/:layoutId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const parsed = updateLayoutSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const existingLayout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
            if (!existingLayout) {
                return res.status(404).json({ error: 'Layout not found' })
            }

            const updateInput = { ...parsed.data }
            const existingNamePrimary =
                existingLayout.name && typeof existingLayout.name === 'object' && '_primary' in existingLayout.name
                    ? String((existingLayout.name as StoredPrimary)._primary)
                    : undefined
            const existingDescriptionPrimary =
                existingLayout.description && typeof existingLayout.description === 'object' && '_primary' in existingLayout.description
                    ? String((existingLayout.description as StoredPrimary)._primary)
                    : undefined

            if (parsed.data.name !== undefined) {
                const existingName = toStoredLocalizedRecord(existingLayout.name)
                const incomingName = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.name))
                const mergedName = { ...existingName, ...incomingName }
                const namePrimaryLocale = parsed.data.namePrimaryLocale ?? existingNamePrimary
                const nameVlc = buildLocalizedContent(mergedName, namePrimaryLocale, 'en')
                if (!nameVlc) {
                    return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
                }
                updateInput.name = nameVlc
            }

            if (parsed.data.description !== undefined) {
                if (parsed.data.description === null) {
                    updateInput.description = null
                } else {
                    const existingDescription = toStoredLocalizedRecord(existingLayout.description)
                    const incomingDescription = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.description))
                    const mergedDescription = { ...existingDescription, ...incomingDescription }
                    const descriptionPrimaryLocale =
                        parsed.data.descriptionPrimaryLocale ??
                        existingDescriptionPrimary ??
                        parsed.data.namePrimaryLocale ??
                        existingNamePrimary
                    updateInput.description =
                        Object.keys(mergedDescription).length > 0
                            ? buildLocalizedContent(mergedDescription, descriptionPrimaryLocale, descriptionPrimaryLocale ?? 'en')
                            : null
                }
            }
            try {
                const updated = await layoutsService.updateLayout(metahubId, layoutId, updateInput, userId)
                return res.json(updated)
            } catch (error: unknown) {
                if (error instanceof OptimisticLockError) {
                    return res.status(409).json({ error: error.message, code: error.code, conflict: error.conflict })
                }
                throw error
            }
        })
    )

    router.delete(
        '/metahub/:metahubId/layout/:layoutId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            await layoutsService.deleteLayout(metahubId, layoutId, userId)
            return res.status(204).send()
        })
    )

    router.get(
        '/metahub/:metahubId/layout/:layoutId/zone-widgets/catalog',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            return res.json({
                items: DASHBOARD_LAYOUT_WIDGETS.map((widget) => ({
                    key: widget.key,
                    allowedZones: widget.allowedZones,
                    multiInstance: widget.multiInstance
                }))
            })
        })
    )

    router.get(
        '/metahub/:metahubId/layout/:layoutId/zone-widgets',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const items = await layoutsService.listLayoutZoneWidgets(metahubId, layoutId, userId)
            return res.json({ items })
        })
    )

    router.put(
        '/metahub/:metahubId/layout/:layoutId/zone-widget',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const parsed = assignLayoutZoneWidgetSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const item = await layoutsService.assignLayoutZoneWidget(metahubId, layoutId, parsed.data, userId)
            return res.json(item)
        })
    )

    router.patch(
        '/metahub/:metahubId/layout/:layoutId/zone-widgets/move',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const parsed = moveLayoutZoneWidgetSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            const items = await layoutsService.moveLayoutZoneWidget(metahubId, layoutId, parsed.data, userId)
            return res.json({ items })
        })
    )

    router.delete(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId, widgetId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const uuidSchema = z.string().uuid()
            const parseResult = uuidSchema.safeParse(widgetId)
            if (!parseResult.success) {
                return res.status(400).json({ error: 'Invalid widget ID' })
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            await layoutsService.removeLayoutZoneWidget(metahubId, layoutId, parseResult.data, userId)
            return res.status(204).send()
        })
    )

    // ── Update zone widget config ──────────────────────────────────────────
    router.patch(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/config',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId, widgetId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const uuidSchema = z.string().uuid()
            const widgetIdResult = uuidSchema.safeParse(widgetId)
            if (!widgetIdResult.success) {
                return res.status(400).json({ error: 'Invalid widget ID' })
            }

            const parsed = updateLayoutZoneWidgetConfigSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            try {
                const widget = await layoutsService.updateLayoutZoneWidgetConfig(
                    metahubId,
                    layoutId,
                    widgetIdResult.data,
                    parsed.data.config,
                    userId
                )
                return res.json({ item: widget })
            } catch (err: unknown) {
                if (err instanceof Error && err.message === 'Zone widget not found') {
                    return res.status(404).json({ error: 'Zone widget not found' })
                }
                throw err
            }
        })
    )

    // ── Toggle zone widget active state ────────────────────────────────────
    router.patch(
        '/metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/toggle-active',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, layoutId, widgetId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const metahubRepo = manager.getRepository(Metahub)
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const rlsRunner = getRequestQueryRunner(req)
            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

            const uuidSchema = z.string().uuid()
            const widgetIdResult = uuidSchema.safeParse(widgetId)
            if (!widgetIdResult.success) {
                return res.status(400).json({ error: 'Invalid widget ID' })
            }

            const parsed = toggleLayoutZoneWidgetActiveSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaService = new MetahubSchemaService(ds, undefined, manager)
            const layoutsService = new MetahubLayoutsService(schemaService)
            try {
                const widget = await layoutsService.toggleLayoutZoneWidgetActive(
                    metahubId,
                    layoutId,
                    widgetIdResult.data,
                    parsed.data.isActive,
                    userId
                )
                return res.json({ item: widget })
            } catch (err: unknown) {
                if (err instanceof Error && err.message === 'Zone widget not found') {
                    return res.status(404).json({ error: 'Zone widget not found' })
                }
                throw err
            }
        })
    )

    return router
}
