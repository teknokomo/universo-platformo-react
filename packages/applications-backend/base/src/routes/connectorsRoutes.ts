import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import type { VersionedLocalizedContent } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards, getRequestDbExecutor, getRequestDbSession } from '../utils'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { OptimisticLockError } from '@universo/utils'
import { ensureApplicationAccess, type ApplicationRole } from './guards'
import {
    countConnectorPublicationLinks,
    deleteConnector,
    deleteConnectorPublicationLink,
    findApplicationStatus,
    findConnector,
    findConnectorPublicationLink,
    findConnectorPublicationLinkById,
    insertConnector,
    insertConnectorPublicationLink,
    listConnectorPublicationLinks,
    listConnectors,
    touchApplicationSchemaSyncedIfUpdateAvailable,
    updateConnector
} from '../persistence/connectorsStore'

// User ID resolution helper
interface RequestUser {
    id?: string
    sub?: string
    user_id?: string
    userId?: string
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as Request & { user?: RequestUser }).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Validation schemas
const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createConnectorSchema = z.object({
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    publicationId: z.string().uuid().optional() // Optional publication to link on creation
})

const updateConnectorSchema = z.object({
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const resolveConnectorSortBy = (sortBy: string): 'name' | 'created' | 'updated' => {
    if (sortBy === 'name' || sortBy === 'created' || sortBy === 'updated') {
        return sortBy
    }

    return 'updated'
}

export function createConnectorsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
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

    const query = <TRow = unknown>(req: Request, sql: string, parameters: unknown[] = []): Promise<TRow[]> => {
        const session = getRequestDbSession(req)
        if (session && !session.isReleased()) {
            return session.query<TRow>(sql, parameters)
        }

        return getDbExecutor().query<TRow>(sql, parameters)
    }

    const transaction = async <TResult>(
        req: Request,
        handler: (executor: { query<TRow = unknown>(sql: string, parameters?: unknown[]): Promise<TRow[]> }) => Promise<TResult>
    ): Promise<TResult> => {
        const executor = getRequestDbExecutor(req, getDbExecutor())
        return executor.transaction(async (trx) =>
            handler({
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => trx.query<TRow>(sql, parameters ?? [])
            })
        )
    }

    const ensureAccess = async (
        req: Request,
        res: Response,
        applicationId: string,
        requiredRoles?: ApplicationRole[]
    ): Promise<string | null> => {
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        try {
            await ensureApplicationAccess(getRequestDbExecutor(req, getDbExecutor()), userId, applicationId, requiredRoles)
            return userId
        } catch (error) {
            const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
            if (status === 403) {
                res.status(403).json({ error: 'Access denied' })
                return null
            }
            throw error
        }
    }

    /**
     * GET /applications/:applicationId/connectors
     * List all connectors in an application
     */
    router.get(
        '/applications/:applicationId/connectors',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId } = req.params
            const userId = await ensureAccess(req, res, applicationId)
            if (!userId) return

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
            const escapedSearch = search ? escapeLikeWildcards(search) : undefined
            const result = await listConnectors(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                {
                    applicationId,
                    limit,
                    offset,
                    sortBy: resolveConnectorSortBy(sortBy),
                    sortOrder,
                    search: escapedSearch
                }
            )

            res.json({ items: result.items, pagination: { total: result.total, limit, offset } })
        })
    )

    /**
     * GET /applications/:applicationId/connectors/:connectorId
     * Get a single connector
     */
    router.get(
        '/applications/:applicationId/connectors/:connectorId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, connectorId } = req.params
            const userId = await ensureAccess(req, res, applicationId)
            if (!userId) return
            const connector = await findConnector(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId,
                connectorId
            )

            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            res.json({
                id: connector.id,
                applicationId: connector.applicationId,
                name: connector.name,
                description: connector.description,
                sortOrder: connector.sortOrder,
                version: connector.version || 1,
                createdAt: connector.createdAt,
                updatedAt: connector.updatedAt
            })
        })
    )

    /**
     * POST /applications/:applicationId/connectors
     * Create a new connector
     */
    router.post(
        '/applications/:applicationId/connectors',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId } = req.params
            const userId = await ensureAccess(req, res, applicationId, ['owner', 'admin', 'editor'])
            if (!userId) return
            const application = await findApplicationStatus(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            const parsed = createConnectorSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, publicationId } = parsed.data

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc: VersionedLocalizedContent<string> | null = null
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc =
                        buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en') ?? null
                }
            }

            const saved = await getRequestDbExecutor(req, getDbExecutor()).transaction(async (trx) => {
                const savedConnector = await insertConnector(trx, {
                    applicationId,
                    name: nameVlc,
                    description: descriptionVlc,
                    sortOrder: sortOrder ?? 0,
                    userId
                })

                // If publicationId provided, create the link
                if (publicationId) {
                    await insertConnectorPublicationLink(trx, {
                        connectorId: savedConnector.id,
                        publicationId,
                        sortOrder: 0,
                        userId
                    })
                }

                return savedConnector
            })

            res.status(201).json({
                id: saved.id,
                applicationId: saved.applicationId,
                name: saved.name,
                description: saved.description,
                sortOrder: saved.sortOrder,
                version: saved.version || 1,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt
            })
        })
    )

    /**
     * PATCH /applications/:applicationId/connectors/:connectorId
     * Update a connector
     */
    router.patch(
        '/applications/:applicationId/connectors/:connectorId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, connectorId } = req.params
            const userId = await ensureAccess(req, res, applicationId, ['owner', 'admin', 'editor'])
            if (!userId) return
            const connector = await findConnector(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId,
                connectorId
            )
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            const parsed = updateConnectorSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } = parsed.data

            // Optimistic locking check
            if (expectedVersion !== undefined) {
                const currentVersion = connector.version || 1
                if (currentVersion !== expectedVersion) {
                    throw new OptimisticLockError({
                        entityId: connectorId,
                        entityType: 'connector',
                        expectedVersion,
                        actualVersion: currentVersion,
                        updatedAt: connector.updatedAt,
                        updatedBy: connector.updatedBy ?? null
                    })
                }
            }

            let nextName = connector.name
            let nextDescription: VersionedLocalizedContent<string> | null = connector.description ?? null

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? connector.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    nextName = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const currentName = nextName
                    const primary =
                        descriptionPrimaryLocale ?? connector.description?._primary ?? currentName?._primary ?? namePrimaryLocale ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        nextDescription = descriptionVlc
                    }
                } else {
                    nextDescription = null
                }
            }

            const saved = await updateConnector(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                {
                    connectorId,
                    applicationId,
                    name: nextName,
                    description: nextDescription,
                    sortOrder,
                    userId
                }
            )

            if (!saved) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            res.json({
                id: saved.id,
                applicationId: saved.applicationId,
                name: saved.name,
                description: saved.description,
                sortOrder: saved.sortOrder,
                version: saved.version || 1,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt
            })
        })
    )

    /**
     * DELETE /applications/:applicationId/connectors/:connectorId
     * Delete a connector
     */
    router.delete(
        '/applications/:applicationId/connectors/:connectorId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, connectorId } = req.params
            const userId = await ensureAccess(req, res, applicationId, ['owner', 'admin'])
            if (!userId) return
            const connector = await findConnector(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId,
                connectorId
            )
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            await transaction(req, async (executor) => {
                await deleteConnector(executor, applicationId, connectorId, userId)
                await touchApplicationSchemaSyncedIfUpdateAvailable(executor, applicationId, userId)
            })

            res.status(204).send()
        })
    )

    // ═══════════════════════════════════════════════════════════════════════
    // Connector ↔ Publication link management
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * GET /applications/:applicationId/connectors/:connectorId/publications
     * List all publications linked to a connector (with publication and metahub details)
     */
    router.get(
        '/applications/:applicationId/connectors/:connectorId/publications',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, connectorId } = req.params
            const userId = await ensureAccess(req, res, applicationId)
            if (!userId) return
            const connector = await findConnector(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId,
                connectorId
            )
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            const items = await listConnectorPublicationLinks(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                connectorId
            )

            return res.json({
                items,
                total: items.length,
                isSinglePublication: connector.isSingleMetahub,
                isRequiredPublication: connector.isRequiredMetahub
            })
        })
    )

    /**
     * POST /applications/:applicationId/connectors/:connectorId/publications
     * Link a publication to a connector
     */
    router.post(
        '/applications/:applicationId/connectors/:connectorId/publications',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, connectorId } = req.params
            const userId = await ensureAccess(req, res, applicationId, ['owner', 'admin', 'editor'])
            if (!userId) return
            const bodySchema = z.object({
                publicationId: z.string().uuid(),
                sortOrder: z.number().int().optional().default(0)
            })

            const parsed = bodySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: parsed.error.flatten()
                })
            }

            const { publicationId, sortOrder } = parsed.data

            const connector = await findConnector(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId,
                connectorId
            )
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            // Check isSingleMetahub constraint
            if (connector.isSingleMetahub) {
                const existingLinks = await countConnectorPublicationLinks(
                    {
                        query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                    },
                    connectorId
                )
                if (existingLinks > 0) {
                    return res.status(400).json({
                        error: 'Single publication constraint',
                        message: 'This connector can only have one publication. Remove existing link first.'
                    })
                }
            }

            // Check for duplicate link
            const existingLink = await findConnectorPublicationLink(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                connectorId,
                publicationId
            )
            if (existingLink) {
                return res.status(400).json({
                    error: 'Duplicate link',
                    message: 'This publication is already linked to this connector.'
                })
            }

            // Create link
            const link = await insertConnectorPublicationLink(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                {
                    connectorId,
                    publicationId,
                    sortOrder,
                    userId
                }
            )

            return res.status(201).json(link)
        })
    )

    /**
     * DELETE /applications/:applicationId/connectors/:connectorId/publications/:linkId
     * Remove a publication link from a connector
     */
    router.delete(
        '/applications/:applicationId/connectors/:connectorId/publications/:linkId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { applicationId, connectorId, linkId } = req.params
            const userId = await ensureAccess(req, res, applicationId, ['owner', 'admin', 'editor'])
            if (!userId) return
            const connector = await findConnector(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId,
                connectorId
            )
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            const link = await findConnectorPublicationLinkById(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                connectorId,
                linkId
            )
            if (!link) {
                return res.status(404).json({ error: 'Link not found' })
            }

            // Check isRequiredMetahub constraint
            if (connector.isRequiredMetahub) {
                const linksCount = await countConnectorPublicationLinks(
                    {
                        query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                    },
                    connectorId
                )
                if (linksCount <= 1) {
                    return res.status(400).json({
                        error: 'Required publication constraint',
                        message: 'This connector requires at least one publication. Add another before removing.'
                    })
                }
            }

            await transaction(req, async (executor) => {
                await deleteConnectorPublicationLink(executor, connectorId, linkId, userId)
                await touchApplicationSchemaSyncedIfUpdateAvailable(executor, applicationId, userId)
            })

            return res.status(204).send()
        })
    )

    return router
}
