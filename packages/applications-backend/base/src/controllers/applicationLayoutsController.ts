import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { ensureApplicationAccess, type ApplicationRole } from '../routes/guards'
import { getRequestDbExecutor } from '../utils'
import { normalizeLocale, resolveUserId } from '../shared/runtimeHelpers'
import {
    applicationLayoutTablesExist,
    copyApplicationLayout,
    createApplicationLayout,
    deleteApplicationLayout,
    deleteApplicationLayoutWidget,
    getApplicationLayoutDetail,
    getApplicationRuntimeSchemaName,
    listApplicationLayoutScopes,
    listApplicationLayoutWidgetCatalog,
    listApplicationLayoutWidgets,
    listApplicationLayouts,
    moveApplicationLayoutWidget,
    toggleApplicationLayoutWidget,
    updateApplicationLayout,
    updateApplicationLayoutWidgetConfig,
    upsertApplicationLayoutWidget
} from '../persistence/applicationLayoutsStore'

const APPLICATION_ADMIN_ROLES: ApplicationRole[] = ['owner', 'admin']
const APPLICATION_LAYOUT_READ_ROLES = ['owner', 'admin', 'editor', 'member'] as const

const applicationLayoutReadPolicySchema = z
    .object({
        applicationLayouts: z
            .object({
                readRoles: z.array(z.enum(APPLICATION_LAYOUT_READ_ROLES)).min(1).optional()
            })
            .strict()
            .optional()
    })
    .passthrough()

const parseLimit = (value: unknown): number => {
    const parsed = Number(value)
    return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 100) : 50
}

const parseOffset = (value: unknown): number => {
    const parsed = Number(value)
    return Number.isInteger(parsed) ? Math.max(parsed, 0) : 0
}

const handleKnownError = (res: Response, error: unknown): boolean => {
    const message = error instanceof Error ? error.message : ''
    if (message === 'APPLICATION_LAYOUT_VERSION_CONFLICT') {
        res.status(409).json({ error: 'APPLICATION_LAYOUT_VERSION_CONFLICT' })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_LAST_DEFAULT' || message === 'APPLICATION_LAYOUT_LAST_ACTIVE') {
        res.status(409).json({ error: message })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_WIDGET_INVALID') {
        res.status(400).json({ error: message })
        return true
    }
    return false
}

const normalizeLayoutReadRoles = (settings: unknown): ApplicationRole[] => {
    const parsed = applicationLayoutReadPolicySchema.safeParse(settings)
    const configuredRoles = parsed.success ? parsed.data.applicationLayouts?.readRoles : undefined
    if (!configuredRoles || configuredRoles.length === 0) {
        return APPLICATION_ADMIN_ROLES
    }

    const roles = new Set<ApplicationRole>(['owner', 'admin'])
    for (const role of configuredRoles) {
        roles.add(role)
    }
    return APPLICATION_LAYOUT_READ_ROLES.filter((role) => roles.has(role))
}

export function createApplicationLayoutsController(getDbExecutor: () => DbExecutor) {
    const resolveReadRoles = async (executor: DbExecutor, applicationId: string): Promise<ApplicationRole[]> => {
        const rows = await executor.query<{ settings: unknown }>(
            `
            SELECT settings
            FROM applications.cat_applications
            WHERE id = $1
              AND _upl_deleted = false
              AND _app_deleted = false
            LIMIT 1
            `,
            [applicationId]
        )

        return normalizeLayoutReadRoles(rows[0]?.settings)
    }

    const ensureSchema = async (req: Request, res: Response, roles: ApplicationRole[] = APPLICATION_ADMIN_ROLES) => {
        const { applicationId } = req.params
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        const executor = getRequestDbExecutor(req, getDbExecutor())
        await ensureApplicationAccess(executor, userId, applicationId, roles)
        const schemaName = await getApplicationRuntimeSchemaName(executor, applicationId)
        if (!schemaName || !(await applicationLayoutTablesExist(executor, schemaName))) {
            res.status(409).json({ error: 'APPLICATION_SCHEMA_NOT_READY' })
            return null
        }
        return { executor, schemaName, userId }
    }

    return {
        async listScopes(req: Request, res: Response) {
            const executor = getRequestDbExecutor(req, getDbExecutor())
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            const locale = normalizeLocale(typeof req.query.locale === 'string' ? req.query.locale : undefined)
            res.json({ items: await listApplicationLayoutScopes(ctx.executor, ctx.schemaName, locale) })
        },

        async list(req: Request, res: Response) {
            const executor = getRequestDbExecutor(req, getDbExecutor())
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            const scopeEntityId =
                typeof req.query.scopeEntityId === 'string'
                    ? req.query.scopeEntityId || null
                    : req.query.scope === 'global'
                    ? null
                    : undefined
            const result = await listApplicationLayouts(ctx.executor, ctx.schemaName, {
                limit: parseLimit(req.query.limit),
                offset: parseOffset(req.query.offset),
                scopeEntityId
            })
            res.json(result)
        },

        async create(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            try {
                res.status(201).json({ item: await createApplicationLayout(ctx.executor, ctx.schemaName, req.body, ctx.userId) })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async detail(req: Request, res: Response) {
            const executor = getRequestDbExecutor(req, getDbExecutor())
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            const detail = await getApplicationLayoutDetail(ctx.executor, ctx.schemaName, req.params.layoutId)
            if (!detail) {
                res.status(404).json({ error: 'Layout not found' })
                return
            }
            res.json(detail)
        },

        async update(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            try {
                const item = await updateApplicationLayout(ctx.executor, ctx.schemaName, req.params.layoutId, req.body, ctx.userId)
                if (!item) {
                    res.status(404).json({ error: 'Layout not found' })
                    return
                }
                res.json({ item })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async remove(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            try {
                const expectedVersion = typeof req.query.expectedVersion === 'string' ? Number(req.query.expectedVersion) : undefined
                const deleted = await deleteApplicationLayout(
                    ctx.executor,
                    ctx.schemaName,
                    req.params.layoutId,
                    ctx.userId,
                    expectedVersion
                )
                res.status(deleted ? 204 : 404).send()
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async copy(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const item = await copyApplicationLayout(ctx.executor, ctx.schemaName, req.params.layoutId, ctx.userId)
            if (!item) {
                res.status(404).json({ error: 'Layout not found' })
                return
            }
            res.status(201).json({ item })
        },

        async listWidgets(req: Request, res: Response) {
            const executor = getRequestDbExecutor(req, getDbExecutor())
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            res.json({ items: await listApplicationLayoutWidgets(ctx.executor, ctx.schemaName, req.params.layoutId) })
        },

        async listWidgetCatalog(_req: Request, res: Response) {
            const executor = getRequestDbExecutor(_req, getDbExecutor())
            const ctx = await ensureSchema(_req, res, await resolveReadRoles(executor, _req.params.applicationId))
            if (!ctx) return
            res.json({ items: listApplicationLayoutWidgetCatalog() })
        },

        async upsertWidget(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            try {
                const item = await upsertApplicationLayoutWidget(ctx.executor, ctx.schemaName, req.params.layoutId, req.body, ctx.userId)
                res.status(201).json({ item })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async updateWidgetConfig(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            try {
                const item = await updateApplicationLayoutWidgetConfig(
                    ctx.executor,
                    ctx.schemaName,
                    req.params.widgetId,
                    req.body,
                    ctx.userId
                )
                if (!item) {
                    res.status(404).json({ error: 'Widget not found or stale version' })
                    return
                }
                res.json({ item })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async moveWidget(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            try {
                const item = await moveApplicationLayoutWidget(ctx.executor, ctx.schemaName, req.params.layoutId, req.body, ctx.userId)
                if (!item) {
                    res.status(404).json({ error: 'Widget not found or stale version' })
                    return
                }
                res.json({ item })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async toggleWidget(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const item = await toggleApplicationLayoutWidget(ctx.executor, ctx.schemaName, req.params.widgetId, req.body, ctx.userId)
            if (!item) {
                res.status(404).json({ error: 'Widget not found or stale version' })
                return
            }
            res.json({ item })
        },

        async removeWidget(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const deleted = await deleteApplicationLayoutWidget(ctx.executor, ctx.schemaName, req.params.widgetId, ctx.userId)
            res.status(deleted ? 204 : 404).send()
        }
    }
}
