import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, type QueryRunner } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { localizedContent, validation, OptimisticLockError } from '@universo/utils'
import { MetahubBranchesService } from '../services/MetahubBranchesService'
import type { VersionedLocalizedContent } from '@universo/types'
import { ensureMetahubAccess } from '../../shared/guards'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCodename, isValidCodename } = validation

interface AuthLikeUser {
    id?: string
    sub?: string
    user_id?: string
    userId?: string
}

interface RequestWithAuthUser extends Request {
    user?: AuthLikeUser
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithAuthUser).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

interface RequestWithDbContext extends Request {
    dbContext?: {
        queryRunner?: QueryRunner
    }
}

const getRequestQueryRunner = (req: Request): QueryRunner | undefined => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
}

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const sourceBranchIdSchema = z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().uuid().optional())

const createBranchSchema = z.object({
    codename: z.string().min(1).max(100),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sourceBranchId: sourceBranchIdSchema
})

const getDbErrorCode = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object') return undefined
    const dbError = error as { code?: string; driverError?: { code?: string } }
    return dbError.code ?? dbError.driverError?.code
}

const getDbErrorConstraint = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object') return undefined
    const dbError = error as { constraint?: string; driverError?: { constraint?: string } }
    return dbError.constraint ?? dbError.driverError?.constraint
}

const isUniqueViolation = (error: unknown): boolean => getDbErrorCode(error) === '23505'

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : ''
}

const updateBranchSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    expectedVersion: z.number().int().positive().optional()
})

export function createBranchesRoutes(
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

    const getService = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return new MetahubBranchesService(ds, manager)
    }

    const ensureMetahubRouteAccess = async (
        req: Request,
        res: Response,
        metahubId: string,
        permission?: 'manageMembers' | 'manageMetahub' | 'createContent' | 'editContent' | 'deleteContent'
    ): Promise<string | null> => {
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        await ensureMetahubAccess(getDataSource(), userId, metahubId, permission, getRequestQueryRunner(req))
        return userId
    }

    /**
     * GET /metahub/:metahubId/branches
     * List branches for a metahub
     */
    router.get(
        '/metahub/:metahubId/branches/options',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const branchesService = getService(req)

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { sortBy, sortOrder, search } = validatedQuery
            const { branches } = await branchesService.listAllBranches(metahubId, { sortBy, sortOrder, search })

            const defaultBranchId = await branchesService.getDefaultBranchId(metahubId)
            const activeBranchId = userId ? await branchesService.getUserActiveBranchId(metahubId, userId) : null
            const effectiveActiveId = activeBranchId ?? defaultBranchId

            const items = branches.map((branch) => ({
                id: branch.id,
                metahubId,
                codename: branch.codename,
                name: branch.name,
                description: branch.description,
                sourceBranchId: branch.sourceBranchId ?? null,
                branchNumber: branch.branchNumber,
                version: branch._uplVersion || 1,
                createdAt: branch._uplCreatedAt,
                updatedAt: branch._uplUpdatedAt,
                isDefault: branch.id === defaultBranchId,
                isActive: branch.id === effectiveActiveId
            }))

            res.json({
                items,
                total: items.length,
                meta: {
                    defaultBranchId,
                    activeBranchId: effectiveActiveId
                }
            })
        })
    )

    /**
     * GET /metahub/:metahubId/branches
     * List branches for a metahub
     */
    router.get(
        '/metahub/:metahubId/branches',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const branchesService = getService(req)

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
            const { branches, total } = await branchesService.listBranches(metahubId, {
                limit,
                offset,
                sortBy,
                sortOrder,
                search
            })

            const defaultBranchId = await branchesService.getDefaultBranchId(metahubId)
            const activeBranchId = userId ? await branchesService.getUserActiveBranchId(metahubId, userId) : null
            const effectiveActiveId = activeBranchId ?? defaultBranchId

            const items = branches.map((branch) => ({
                id: branch.id,
                metahubId,
                codename: branch.codename,
                name: branch.name,
                description: branch.description,
                sourceBranchId: branch.sourceBranchId ?? null,
                branchNumber: branch.branchNumber,
                version: branch._uplVersion || 1,
                createdAt: branch._uplCreatedAt,
                updatedAt: branch._uplUpdatedAt,
                isDefault: branch.id === defaultBranchId,
                isActive: branch.id === effectiveActiveId
            }))

            res.json({
                items,
                pagination: { total, limit, offset },
                meta: {
                    defaultBranchId,
                    activeBranchId: effectiveActiveId
                }
            })
        })
    )

    /**
     * GET /metahub/:metahubId/branch/:branchId
     * Get branch details
     */
    router.get(
        '/metahub/:metahubId/branch/:branchId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, branchId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return
            const branchesService = getService(req)

            const branch = await branchesService.getBranchById(metahubId, branchId)
            if (!branch) {
                return res.json({
                    branchId,
                    blockingUsers: [],
                    canDelete: false,
                    isDefault: false
                })
            }

            const defaultBranchId = await branchesService.getDefaultBranchId(metahubId)
            const activeBranchId = userId ? await branchesService.getUserActiveBranchId(metahubId, userId) : null
            const effectiveActiveId = activeBranchId ?? defaultBranchId

            res.json({
                id: branch.id,
                metahubId,
                codename: branch.codename,
                name: branch.name,
                description: branch.description,
                branchNumber: branch.branchNumber,
                version: branch._uplVersion || 1,
                createdAt: branch._uplCreatedAt,
                updatedAt: branch._uplUpdatedAt,
                isDefault: branch.id === defaultBranchId,
                isActive: branch.id === effectiveActiveId,
                ...(await branchesService.getBranchLineage(metahubId, branchId))
            })
        })
    )

    /**
     * POST /metahub/:metahubId/branches
     * Create a new branch (clone from source branch)
     */
    router.post(
        '/metahub/:metahubId/branches',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return

            const branchesService = getService(req)

            const parsed = createBranchSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, namePrimaryLocale, descriptionPrimaryLocale, sourceBranchId } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existing = await branchesService.findByCodename(metahubId, normalizedCodename)
            if (existing) {
                return res.status(409).json({
                    code: 'BRANCH_CODENAME_EXISTS',
                    error: 'Branch with this codename already exists'
                })
            }

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

            try {
                const branch = await branchesService.createBranch({
                    metahubId,
                    sourceBranchId: sourceBranchId ?? null,
                    codename: normalizedCodename,
                    name: nameVlc,
                    description: descriptionVlc ?? null,
                    createdBy: userId
                })

                res.status(201).json({
                    id: branch.id,
                    metahubId,
                    codename: branch.codename,
                    name: branch.name,
                    description: branch.description,
                    sourceBranchId: branch.sourceBranchId ?? null,
                    branchNumber: branch.branchNumber,
                    version: branch._uplVersion || 1,
                    createdAt: branch._uplCreatedAt,
                    updatedAt: branch._uplUpdatedAt
                })
            } catch (error: unknown) {
                const errorMessage = getErrorMessage(error)
                if (errorMessage.includes('Branch creation in progress')) {
                    return res.status(409).json({
                        code: 'BRANCH_CREATION_IN_PROGRESS',
                        error: 'Branch creation in progress'
                    })
                }
                if (errorMessage.includes('Source branch not found')) {
                    return res.status(404).json({ error: 'Source branch not found' })
                }
                if (isUniqueViolation(error)) {
                    const constraint = getDbErrorConstraint(error)
                    if (constraint === 'idx_branches_metahub_codename_active') {
                        return res.status(409).json({
                            code: 'BRANCH_CODENAME_EXISTS',
                            error: 'Branch with this codename already exists'
                        })
                    }
                    if (constraint === 'idx_branches_metahub_number_active' || constraint === 'metahubs_branches_schema_name_key') {
                        return res.status(409).json({
                            code: 'BRANCH_NUMBER_CONFLICT',
                            error: 'Branch numbering conflict. Please retry.'
                        })
                    }
                    return res.status(409).json({
                        code: 'BRANCH_UNIQUE_CONFLICT',
                        error: 'Branch creation failed due to unique constraint conflict'
                    })
                }
                throw error
            }
        })
    )

    /**
     * PATCH /metahub/:metahubId/branch/:branchId
     * Update branch metadata
     */
    router.patch(
        '/metahub/:metahubId/branch/:branchId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, branchId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const branchesService = getService(req)

            const parsed = updateBranchSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } = parsed.data
            const updateData: {
                codename?: string
                name?: VersionedLocalizedContent<string>
                description?: VersionedLocalizedContent<string> | null
                expectedVersion?: number
                updatedBy?: string | null
            } = {}

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }

                const existing = await branchesService.findByCodename(metahubId, normalizedCodename)
                if (existing && existing.id !== branchId) {
                    return res.status(409).json({
                        code: 'BRANCH_CODENAME_EXISTS',
                        error: 'Branch with this codename already exists'
                    })
                }
                updateData.codename = normalizedCodename
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
                if (nameVlc) {
                    updateData.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                updateData.description =
                    Object.keys(sanitizedDescription).length > 0
                        ? buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                        : null
            }

            if (expectedVersion !== undefined) {
                updateData.expectedVersion = expectedVersion
            }

            updateData.updatedBy = userId

            try {
                const updated = await branchesService.updateBranch(metahubId, branchId, updateData)
                res.json({
                    id: updated.id,
                    metahubId,
                    codename: updated.codename,
                    name: updated.name,
                    description: updated.description,
                    sourceBranchId: updated.sourceBranchId ?? null,
                    branchNumber: updated.branchNumber,
                    version: updated._uplVersion || 1,
                    createdAt: updated._uplCreatedAt,
                    updatedAt: updated._uplUpdatedAt
                })
            } catch (error: unknown) {
                const errorMessage = getErrorMessage(error)
                if (errorMessage.includes('Branch not found')) {
                    return res.status(404).json({ error: 'Branch not found' })
                }
                if (error instanceof OptimisticLockError) {
                    throw error // Let middleware handle it
                }
                throw error
            }
        })
    )

    /**
     * POST /metahub/:metahubId/branch/:branchId/activate
     * Set active branch for current user
     */
    router.post(
        '/metahub/:metahubId/branch/:branchId/activate',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, branchId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId)
            if (!userId) return

            const branchesService = getService(req)

            try {
                const branch = await branchesService.activateBranch(metahubId, branchId, userId)
                res.json({
                    metahubId,
                    branchId: branch.id
                })
            } catch (error: unknown) {
                const errorMessage = getErrorMessage(error)
                if (errorMessage.includes('Branch not found')) {
                    return res.status(404).json({ error: 'Branch not found' })
                }
                if (errorMessage.includes('Membership not found')) {
                    return res.status(403).json({ error: 'Membership not found' })
                }
                throw error
            }
        })
    )

    /**
     * POST /metahub/:metahubId/branch/:branchId/default
     * Set default branch for metahub
     */
    router.post(
        '/metahub/:metahubId/branch/:branchId/default',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, branchId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const branchesService = getService(req)

            try {
                const branch = await branchesService.setDefaultBranch(metahubId, branchId)
                res.json({
                    metahubId,
                    branchId: branch.id
                })
            } catch (error: unknown) {
                if (getErrorMessage(error).includes('Branch not found')) {
                    return res.status(404).json({ error: 'Branch not found' })
                }
                throw error
            }
        })
    )

    /**
     * GET /metahub/:metahubId/branch/:branchId/blocking-users
     * Users who have this branch active (excluding requester)
     */
    router.get(
        '/metahub/:metahubId/branch/:branchId/blocking-users',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, branchId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return
            const branchesService = getService(req)

            const branch = await branchesService.getBranchById(metahubId, branchId)
            if (!branch) {
                return res.status(404).json({ error: 'Branch not found' })
            }

            const defaultBranchId = await branchesService.getDefaultBranchId(metahubId)
            const blockingUsers = await branchesService.getBlockingUsers(metahubId, branchId, userId ?? undefined)

            res.json({
                branchId,
                blockingUsers,
                canDelete: blockingUsers.length === 0 && branch.id !== defaultBranchId,
                isDefault: branch.id === defaultBranchId
            })
        })
    )

    /**
     * DELETE /metahub/:metahubId/branch/:branchId
     * Delete a branch (blocked if default or active for other users)
     */
    router.delete(
        '/metahub/:metahubId/branch/:branchId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, branchId } = req.params
            const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
            if (!userId) return

            const branchesService = getService(req)

            const blockingUsers = await branchesService.getBlockingUsers(metahubId, branchId, userId)
            if (blockingUsers.length > 0) {
                return res.status(409).json({
                    error: 'Branch is active for other users',
                    blockingUsers
                })
            }

            try {
                await branchesService.deleteBranch({ metahubId, branchId, requesterId: userId })
                res.status(204).send()
            } catch (error: unknown) {
                const errorMessage = getErrorMessage(error)
                if (errorMessage.includes('Branch not found')) {
                    return res.status(404).json({ error: 'Branch not found' })
                }
                if (errorMessage.includes('Default branch cannot be deleted')) {
                    return res.status(409).json({ error: 'Default branch cannot be deleted' })
                }
                if (errorMessage.includes('Branch deletion in progress')) {
                    return res.status(409).json({
                        code: 'BRANCH_DELETION_IN_PROGRESS',
                        error: 'Branch deletion in progress'
                    })
                }
                throw error
            }
        })
    )

    return router
}
