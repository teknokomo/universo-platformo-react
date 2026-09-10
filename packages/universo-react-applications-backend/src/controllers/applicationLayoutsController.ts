import type { Request, Response } from 'express'
import { z } from 'zod'
import { uuidV7Schema, type DbExecutor } from '@universo-react/utils'
import { ensureApplicationAccess, type ApplicationRole } from '../routes/guards'
import { getRequestDbExecutor } from '../utils'
import { normalizeLocale, resolveUserId } from '../shared/runtimeHelpers'
import {
    strictApplicationLayoutConfigResetMutationSchema,
    strictApplicationLayoutCopyMutationSchema,
    strictApplicationLayoutCreateSchema,
    strictApplicationLayoutUpdateSchema,
    strictApplicationLayoutWidgetConfigBatchMutationSchema,
    strictApplicationLayoutWidgetConfigMutationSchema,
    strictApplicationLayoutWidgetMoveMutationSchema,
    strictApplicationLayoutWidgetMutationSchema,
    strictApplicationLayoutWidgetResetBatchMutationSchema,
    strictApplicationLayoutWidgetToggleMutationSchema
} from '../validation/applicationLayoutMutationSchemas'
import {
    applicationLayoutTablesExist,
    copyApplicationLayout,
    createApplicationLayout,
    deleteApplicationLayout,
    deleteApplicationLayoutWidget,
    getApplicationLayoutDetail,
    getApplicationRuntimeSchemaName,
    listApplicationLayoutScopes,
    listApplicationLayoutWidgetObject,
    listApplicationLayoutWidgets,
    listApplicationLayouts,
    moveApplicationLayoutWidget,
    resetApplicationLayoutConfig,
    resetApplicationLayoutWidgetConfigsBatch,
    toggleApplicationLayoutWidget,
    updateApplicationLayout,
    updateApplicationLayoutWidgetConfig,
    updateApplicationLayoutWidgetConfigsBatch,
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

const applicationLayoutListQuerySchema = z
    .object({
        scopeEntityId: uuidV7Schema.optional(),
        scope: z.enum(['global']).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional()
    })
    .strict()
    .superRefine((value, context) => {
        if (value.scope === 'global' && value.scopeEntityId !== undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['scopeEntityId'],
                message: 'Global scope cannot be combined with scopeEntityId'
            })
        }
    })

const parseExpectedVersion = (value: unknown): number => {
    if (value === undefined) {
        throw new Error('APPLICATION_LAYOUT_EXPECTED_VERSION_INVALID')
    }
    if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) {
        throw new Error('APPLICATION_LAYOUT_EXPECTED_VERSION_INVALID')
    }
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error('APPLICATION_LAYOUT_EXPECTED_VERSION_INVALID')
    }
    return parsed
}

const handleKnownError = (res: Response, error: unknown): boolean => {
    if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'APPLICATION_LAYOUT_INVALID' })
        return true
    }
    const message = error instanceof Error ? error.message : ''
    if (message === 'APPLICATION_LAYOUT_VERSION_CONFLICT') {
        res.status(409).json({ error: 'APPLICATION_LAYOUT_VERSION_CONFLICT' })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_LAST_DEFAULT' || message === 'APPLICATION_LAYOUT_LAST_ACTIVE') {
        res.status(409).json({ error: message })
        return true
    }
    if (
        message === 'APPLICATION_LAYOUT_DEFAULT_CONFLICT' ||
        message === 'APPLICATION_LAYOUT_SCOPE_CONFLICT' ||
        message === 'APPLICATION_LAYOUT_WIDGET_SOURCE_CONFLICT'
    ) {
        res.status(409).json({ error: message })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_WIDGET_INVALID') {
        res.status(400).json({ error: message })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_SCOPE_INVALID') {
        res.status(400).json({ error: message })
        return true
    }
    if (
        message === 'APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE' ||
        message === 'APPLICATION_LAYOUT_WIDGET_SINGLETON_CONFLICT' ||
        message === 'APPLICATION_LAYOUT_WIDGET_INSTANCE_IMMUTABLE'
    ) {
        res.status(409).json({ error: message })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_EXPECTED_VERSION_INVALID') {
        res.status(400).json({ error: message })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_COPY_INVALID') {
        res.status(400).json({ error: message })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT') {
        res.status(409).json({ error: message })
        return true
    }
    if (message === 'APPLICATION_LAYOUT_MARKETING_RESET_NOT_SUPPORTED') {
        res.status(409).json({ error: message })
        return true
    }
    if (
        message === 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST' ||
        message === 'APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING'
    ) {
        res.status(409).json({ error: message, code: message })
        return true
    }
    return false
}

const parseLayoutParam = (res: Response, value: unknown, errorCode: string): string | null => {
    const parsed = uuidV7Schema.safeParse(value)
    if (!parsed.success) {
        res.status(400).json({ error: errorCode })
        return null
    }
    return parsed.data
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

export function createApplicationLayoutsController(
    getDbExecutor: () => DbExecutor,
    getRequestScopedDbExecutor: (req: Request) => DbExecutor = (req) => getRequestDbExecutor(req, getDbExecutor())
) {
    const resolveReadRoles = async (executor: DbExecutor, applicationId: string): Promise<ApplicationRole[]> => {
        const rows = await executor.query<{ settings: unknown }>(
            `
            SELECT settings
            FROM applications.obj_applications
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

        const executor = getRequestScopedDbExecutor(req)
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
            const executor = getRequestScopedDbExecutor(req)
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            const locale = normalizeLocale(typeof req.query.locale === 'string' ? req.query.locale : undefined)
            res.json({ items: await listApplicationLayoutScopes(ctx.executor, ctx.schemaName, locale) })
        },

        async list(req: Request, res: Response) {
            const executor = getRequestScopedDbExecutor(req)
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            const parsedQuery = applicationLayoutListQuerySchema.safeParse(req.query)
            if (!parsedQuery.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_SCOPE_INVALID' })
                return
            }
            const scopeEntityId = parsedQuery.data.scopeEntityId ?? (parsedQuery.data.scope === 'global' ? null : undefined)
            const result = await listApplicationLayouts(ctx.executor, ctx.schemaName, {
                limit: parsedQuery.data.limit ?? 50,
                offset: parsedQuery.data.offset ?? 0,
                scopeEntityId
            })
            res.json(result)
        },

        async create(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const parsedBody = strictApplicationLayoutCreateSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_INVALID' })
                return
            }
            try {
                res.status(201).json({ item: await createApplicationLayout(ctx.executor, ctx.schemaName, parsedBody.data, ctx.userId) })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async detail(req: Request, res: Response) {
            const executor = getRequestScopedDbExecutor(req)
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            if (!layoutId) return
            const detail = await getApplicationLayoutDetail(ctx.executor, ctx.schemaName, layoutId)
            if (!detail) {
                res.status(404).json({ error: 'Layout not found' })
                return
            }
            res.json(detail)
        },

        async update(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            if (!layoutId) return
            const parsedBody = strictApplicationLayoutUpdateSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_INVALID' })
                return
            }
            try {
                const item = await updateApplicationLayout(ctx.executor, ctx.schemaName, layoutId, parsedBody.data, ctx.userId)
                if (!item) {
                    res.status(404).json({ error: 'Layout not found' })
                    return
                }
                res.json({ item })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async resetConfig(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            if (!layoutId) return
            const parsedBody = strictApplicationLayoutConfigResetMutationSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_CONFIG_RESET_INVALID' })
                return
            }
            try {
                const item = await resetApplicationLayoutConfig(ctx.executor, ctx.schemaName, layoutId, parsedBody.data, ctx.userId)
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
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            if (!layoutId) return
            try {
                const expectedVersion = parseExpectedVersion(req.query.expectedVersion)
                const deleted = await deleteApplicationLayout(ctx.executor, ctx.schemaName, layoutId, ctx.userId, expectedVersion)
                res.status(deleted ? 204 : 404).send()
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async copy(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            if (!layoutId) return
            const parsedBody = strictApplicationLayoutCopyMutationSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_COPY_INVALID' })
                return
            }
            try {
                const item = await copyApplicationLayout(ctx.executor, ctx.schemaName, layoutId, parsedBody.data, ctx.userId)
                if (!item) {
                    res.status(404).json({ error: 'Layout not found' })
                    return
                }
                res.status(201).json({ item })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async listWidgets(req: Request, res: Response) {
            const executor = getRequestScopedDbExecutor(req)
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            if (!layoutId) return
            res.json({ items: await listApplicationLayoutWidgets(ctx.executor, ctx.schemaName, layoutId) })
        },

        async listWidgetObject(req: Request, res: Response) {
            const executor = getRequestScopedDbExecutor(req)
            const ctx = await ensureSchema(req, res, await resolveReadRoles(executor, req.params.applicationId))
            if (!ctx) return
            if (!parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')) return
            res.json({ items: listApplicationLayoutWidgetObject() })
        },

        async upsertWidget(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            if (!layoutId) return
            const parsedBody = strictApplicationLayoutWidgetMutationSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_INVALID' })
                return
            }
            try {
                const item = await upsertApplicationLayoutWidget(ctx.executor, ctx.schemaName, layoutId, parsedBody.data, ctx.userId)
                res.status(201).json({ item })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async updateWidgetConfig(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            const widgetId = parseLayoutParam(res, req.params.widgetId, 'APPLICATION_LAYOUT_WIDGET_ID_INVALID')
            if (!layoutId || !widgetId) return
            const parsedBody = strictApplicationLayoutWidgetConfigMutationSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_INVALID' })
                return
            }
            try {
                const item = await updateApplicationLayoutWidgetConfig(
                    ctx.executor,
                    ctx.schemaName,
                    layoutId,
                    widgetId,
                    parsedBody.data,
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

        async updateWidgetConfigsBatch(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const parsedBody = strictApplicationLayoutWidgetConfigBatchMutationSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_WIDGET_BATCH_INVALID' })
                return
            }
            try {
                const items = await updateApplicationLayoutWidgetConfigsBatch(ctx.executor, ctx.schemaName, parsedBody.data, ctx.userId)
                res.json({ items })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async resetWidgetConfigsBatch(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const parsedBody = strictApplicationLayoutWidgetResetBatchMutationSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_WIDGET_RESET_BATCH_INVALID' })
                return
            }
            try {
                const items = await resetApplicationLayoutWidgetConfigsBatch(ctx.executor, ctx.schemaName, parsedBody.data, ctx.userId)
                res.json({ items })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async moveWidget(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            if (!layoutId) return
            const parsedBody = strictApplicationLayoutWidgetMoveMutationSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_INVALID' })
                return
            }
            try {
                const item = await moveApplicationLayoutWidget(ctx.executor, ctx.schemaName, layoutId, parsedBody.data, ctx.userId)
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
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            const widgetId = parseLayoutParam(res, req.params.widgetId, 'APPLICATION_LAYOUT_WIDGET_ID_INVALID')
            if (!layoutId || !widgetId) return
            const parsedBody = strictApplicationLayoutWidgetToggleMutationSchema.safeParse(req.body)
            if (!parsedBody.success) {
                res.status(400).json({ error: 'APPLICATION_LAYOUT_INVALID' })
                return
            }
            try {
                const item = await toggleApplicationLayoutWidget(
                    ctx.executor,
                    ctx.schemaName,
                    layoutId,
                    widgetId,
                    parsedBody.data,
                    ctx.userId
                )
                if (!item) {
                    res.status(404).json({ error: 'Widget not found' })
                    return
                }
                res.json({ item })
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        },

        async removeWidget(req: Request, res: Response) {
            const ctx = await ensureSchema(req, res)
            if (!ctx) return
            const layoutId = parseLayoutParam(res, req.params.layoutId, 'APPLICATION_LAYOUT_ID_INVALID')
            const widgetId = parseLayoutParam(res, req.params.widgetId, 'APPLICATION_LAYOUT_WIDGET_ID_INVALID')
            if (!layoutId || !widgetId) return
            try {
                const expectedVersion = parseExpectedVersion(req.query.expectedVersion)
                const deleted = await deleteApplicationLayoutWidget(
                    ctx.executor,
                    ctx.schemaName,
                    layoutId,
                    widgetId,
                    ctx.userId,
                    expectedVersion
                )
                res.status(deleted ? 204 : 404).send()
            } catch (error) {
                if (!handleKnownError(res, error)) throw error
            }
        }
    }
}
