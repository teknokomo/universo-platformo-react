import type { Request, Response } from 'express'
import { z } from 'zod'
import { applicationAliasRoutingModeSchema, readLocalizedTextValue } from '@universo-react/types'
import { getRequestDbExecutor, isUuidV7, type DbExecutor } from '@universo-react/utils'
import { hasSubjectPermission, isSuperuser } from '@universo-react/admin-backend'
import { resolveUserId } from '../shared/runtimeHelpers'
import { listApplicationAliasApplicationOptions } from '../persistence/applicationAliasesStore'
import { ApplicationAliasServiceError, createApplicationAliasesService } from '../services/applicationAliases'

type ApplicationAliasPermissionAction = 'read' | 'create' | 'update' | 'delete'

const aliasListLocaleSchema = z.enum(['en', 'ru'])

const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z.enum(['alias', 'application', 'created']).default('created'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z
        .string()
        .trim()
        .max(255)
        .optional()
        .transform((value) => value || undefined),
    applicationId: z.string().optional(),
    includeReleased: z.preprocess((value) => value === true || value === 'true', z.boolean()).default(false),
    locale: aliasListLocaleSchema.optional()
})

const applicationOptionsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    search: z
        .string()
        .trim()
        .max(255)
        .optional()
        .transform((value) => value || undefined),
    locale: aliasListLocaleSchema.optional()
})

const createAliasBodySchema = z
    .object({
        applicationId: z.string(),
        alias: z.string(),
        makePrimary: z.boolean().optional()
    })
    .strict()

const renameAliasBodySchema = z.object({ alias: z.string() }).strict()
const policyBodySchema = z.object({ routingMode: applicationAliasRoutingModeSchema }).strict()

const handleServiceError = (res: Response, error: unknown): boolean => {
    if (!(error instanceof ApplicationAliasServiceError)) return false
    res.status(error.statusCode).json({ error: error.code, code: error.code })
    return true
}

export function createApplicationAliasesController(
    getDbExecutor: () => DbExecutor,
    getRequestScopedDbExecutor: (req: Request) => DbExecutor = (req) => getRequestDbExecutor(req, getDbExecutor())
) {
    const authorize = async (req: Request, res: Response, action: ApplicationAliasPermissionAction) => {
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        const executor = getRequestScopedDbExecutor(req)
        const superuser = await isSuperuser(executor, userId)
        const allowed = superuser || (await hasSubjectPermission(executor, userId, 'applicationAliases', action))
        if (!allowed) {
            res.status(403).json({ error: 'Access denied' })
            return null
        }

        return { userId, executor, service: createApplicationAliasesService(executor), superuser }
    }

    return {
        async applicationOptions(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'read')
            if (!ctx) return
            const parsed = applicationOptionsQuerySchema.safeParse(req.query)
            if (!parsed.success) return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })

            try {
                const result = await listApplicationAliasApplicationOptions(ctx.executor, parsed.data)
                // Project the persisted selector rows into the frontend option
                // contract: the raw `nameValue` store shape must not leak and a
                // valid UUID v7 identity is mandatory for every option. The
                // localized description is the admin-safe disambiguator when
                // several applications share one display name.
                const locale = parsed.data.locale ?? 'en'
                const items = result.items.map((item) => {
                    if (!isUuidV7(item.id)) throw new Error('Persisted application option identity must use UUID v7')
                    return {
                        id: item.id,
                        name: item.nameValue,
                        context: readLocalizedTextValue(item.contextValue, locale) ?? null
                    }
                })
                return res.json({ items, total: result.total, limit: parsed.data.limit, offset: parsed.data.offset })
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        },

        async list(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'read')
            if (!ctx) return
            const parsed = listQuerySchema.safeParse(req.query)
            if (!parsed.success) return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })

            try {
                const result = await ctx.service.list(parsed.data)
                return res.json({ ...result, limit: parsed.data.limit, offset: parsed.data.offset })
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        },

        async create(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'create')
            if (!ctx) return
            const parsed = createAliasBodySchema.safeParse(req.body)
            if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

            if (
                parsed.data.makePrimary === true &&
                !ctx.superuser &&
                !(await hasSubjectPermission(ctx.executor, ctx.userId, 'applicationAliases', 'update'))
            ) {
                return res.status(403).json({ error: 'Access denied' })
            }

            try {
                return res.status(201).json(await ctx.service.create({ ...parsed.data, userId: ctx.userId }))
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        },

        async rename(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'update')
            if (!ctx) return
            const parsed = renameAliasBodySchema.safeParse(req.body)
            if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

            try {
                return res.json(await ctx.service.rename(req.params.id, parsed.data.alias, ctx.userId))
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        },

        async setPrimary(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'update')
            if (!ctx) return
            try {
                return res.json(await ctx.service.setPrimary(req.params.id, ctx.userId))
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        },

        async release(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'delete')
            if (!ctx) return
            try {
                await ctx.service.release(req.params.id, ctx.userId)
                return res.status(204).send()
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        },

        async listByApplication(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'read')
            if (!ctx) return
            const locale = aliasListLocaleSchema.safeParse(req.query.locale)
            try {
                return res.json({
                    items: await ctx.service.listByApplication(req.params.applicationId, locale.success ? locale.data : undefined)
                })
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        },

        async getPolicy(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'read')
            if (!ctx) return
            try {
                return res.json(await ctx.service.getPolicy(req.params.applicationId))
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        },

        async updatePolicy(req: Request, res: Response) {
            const ctx = await authorize(req, res, 'update')
            if (!ctx) return
            const parsed = policyBodySchema.safeParse(req.body)
            if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

            try {
                return res.json(await ctx.service.updatePolicy(req.params.applicationId, parsed.data.routingMode, ctx.userId))
            } catch (error) {
                if (handleServiceError(res, error)) return
                throw error
            }
        }
    }
}
