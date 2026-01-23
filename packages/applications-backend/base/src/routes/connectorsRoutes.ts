import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Connector } from '../database/entities/Connector'
import { ConnectorPublication } from '../database/entities/ConnectorPublication'
import { Application } from '../database/entities/Application'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../utils'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'

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
    sortOrder: z.number().int().optional()
})

export function createConnectorsRoutes(
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

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            connectorRepo: manager.getRepository(Connector),
            connectorPublicationRepo: manager.getRepository(ConnectorPublication),
            applicationRepo: manager.getRepository(Application)
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
            const { connectorRepo } = repos(req)

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

            const qb = connectorRepo.createQueryBuilder('s').where('s.applicationId = :applicationId', { applicationId })

            if (search) {
                const escapedSearch = escapeLikeWildcards(search)
                qb.andWhere("(s.name::text ILIKE :search OR COALESCE(s.description::text, '') ILIKE :search)", {
                    search: `%${escapedSearch}%`
                })
            }

            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(s.name->>(s.name->>'_primary'), s.name->>'en', '')"
                    : sortBy === 'created'
                    ? 's.created_at'
                    : 's.updated_at'

            qb.select([
                's.id as id',
                's.applicationId as "applicationId"',
                's.name as name',
                's.description as description',
                's.sortOrder as "sortOrder"',
                's.created_at as "createdAt"',
                's.updated_at as "updatedAt"'
            ])
                .addSelect('COUNT(*) OVER()', 'window_total')
                .orderBy(orderColumn, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                .limit(limit)
                .offset(offset)

            const raw = await qb.getRawMany<{
                id: string
                applicationId: string
                name: Record<string, string> | null
                description: Record<string, string> | null
                sortOrder: number
                createdAt: Date
                updatedAt: Date
                window_total?: string
            }>()

            const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

            const connectors = raw.map((row) => ({
                id: row.id,
                applicationId: row.applicationId,
                name: row.name,
                description: row.description,
                sortOrder: row.sortOrder,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt
            }))

            res.json({ items: connectors, pagination: { total, limit, offset } })
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
            const { connectorRepo } = repos(req)

            const connector = await connectorRepo.findOne({
                where: { id: connectorId, applicationId }
            })

            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            res.json(connector)
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
            const { connectorRepo, applicationRepo } = repos(req)

            // Verify application exists
            const application = await applicationRepo.findOne({ where: { id: applicationId } })
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

            let descriptionVlc = undefined
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                }
            }

            const connector = connectorRepo.create({
                applicationId,
                name: nameVlc,
                description: descriptionVlc,
                sortOrder: sortOrder ?? 0
            })

            // Wrap connector creation and optional publication link in a transaction
            const ds = getDataSource()
            const saved = await ds.transaction(async (manager) => {
                const savedConnector = await manager.save(connector)

                // If publicationId provided, create the link
                if (publicationId) {
                    const link = manager.getRepository(ConnectorPublication).create({
                        connectorId: savedConnector.id,
                        publicationId,
                        sortOrder: 0
                    })
                    await manager.save(link)
                }

                return savedConnector
            })

            res.status(201).json(saved)
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
            const { connectorRepo } = repos(req)

            const connector = await connectorRepo.findOne({ where: { id: connectorId, applicationId } })
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            const parsed = updateConnectorSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale } = parsed.data

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? connector.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    connector.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ?? connector.description?._primary ?? connector.name?._primary ?? namePrimaryLocale ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        connector.description = descriptionVlc
                    }
                } else {
                    connector.description = undefined
                }
            }

            if (sortOrder !== undefined) {
                connector.sortOrder = sortOrder
            }

            const saved = await connectorRepo.save(connector)
            res.json(saved)
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
            const { connectorRepo } = repos(req)

            const connector = await connectorRepo.findOne({ where: { id: connectorId, applicationId } })
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            await connectorRepo.remove(connector)
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
            const { connectorRepo } = repos(req)
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)

            // Verify connector belongs to application
            const connector = await connectorRepo.findOne({ where: { id: connectorId, applicationId } })
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            // Fetch links with publication and metahub details via cross-schema join
            const linksWithPublications = await manager.query(
                `
                SELECT 
                    cp.id,
                    cp.connector_id AS "connectorId",
                    cp.publication_id AS "publicationId",
                    cp.sort_order AS "sortOrder",
                    cp.created_at AS "createdAt",
                    p.id AS "publication_id",
                    p.name AS "publication_name",
                    p.description AS "publication_description",
                    p.metahub_id AS "metahubId",
                    m.codename AS "metahub_codename",
                    m.name AS "metahub_name"
                FROM applications.connectors_publications cp
                LEFT JOIN metahubs.publications p ON p.id = cp.publication_id
                LEFT JOIN metahubs.metahubs m ON m.id = p.metahub_id
                WHERE cp.connector_id = $1
                ORDER BY cp.sort_order ASC
            `,
                [connectorId]
            )

            // Transform to expected format with nested publication object
            const items = linksWithPublications.map((row: Record<string, unknown>) => ({
                id: row.id,
                connectorId: row.connectorId,
                publicationId: row.publicationId,
                sortOrder: row.sortOrder,
                createdAt: row.createdAt,
                publication: row.publication_id
                    ? {
                          id: row.publication_id,
                          name: row.publication_name,
                          description: row.publication_description,
                          metahubId: row.metahubId,
                          metahub: {
                              id: row.metahubId,
                              codename: row.metahub_codename,
                              name: row.metahub_name
                          }
                      }
                    : null
            }))

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
            const { connectorRepo, connectorPublicationRepo } = repos(req)

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

            // Verify connector belongs to application
            const connector = await connectorRepo.findOne({ where: { id: connectorId, applicationId } })
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            // Check isSingleMetahub constraint
            if (connector.isSingleMetahub) {
                const existingLinks = await connectorPublicationRepo.count({ where: { connectorId } })
                if (existingLinks > 0) {
                    return res.status(400).json({
                        error: 'Single publication constraint',
                        message: 'This connector can only have one publication. Remove existing link first.'
                    })
                }
            }

            // Check for duplicate link
            const existingLink = await connectorPublicationRepo.findOne({ where: { connectorId, publicationId } })
            if (existingLink) {
                return res.status(400).json({
                    error: 'Duplicate link',
                    message: 'This publication is already linked to this connector.'
                })
            }

            // Create link
            const link = connectorPublicationRepo.create({
                connectorId,
                publicationId,
                sortOrder
            })
            await connectorPublicationRepo.save(link)

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
            const { connectorRepo, connectorPublicationRepo } = repos(req)

            // Verify connector belongs to application
            const connector = await connectorRepo.findOne({ where: { id: connectorId, applicationId } })
            if (!connector) {
                return res.status(404).json({ error: 'Connector not found' })
            }

            const link = await connectorPublicationRepo.findOne({
                where: { id: linkId, connectorId }
            })
            if (!link) {
                return res.status(404).json({ error: 'Link not found' })
            }

            // Check isRequiredMetahub constraint
            if (connector.isRequiredMetahub) {
                const linksCount = await connectorPublicationRepo.count({ where: { connectorId } })
                if (linksCount <= 1) {
                    return res.status(400).json({
                        error: 'Required publication constraint',
                        message: 'This connector requires at least one publication. Add another before removing.'
                    })
                }
            }

            await connectorPublicationRepo.remove(link)
            return res.status(204).send()
        })
    )

    return router
}
