import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { generateSchemaName } from '@universo/schema-ddl'
import { Application } from '../database/entities/Application'
import { ApplicationUser } from '../database/entities/ApplicationUser'
import { Connector } from '../database/entities/Connector'
import { Profile } from '@universo/profile-backend'
import { ensureApplicationAccess, ROLE_PERMISSIONS, assertNotOwner } from './guards'
import type { ApplicationRole } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { escapeLikeWildcards, getRequestManager } from '../utils'

const getRequestQueryRunner = (req: Request) => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
}

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

export function createApplicationsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            applicationRepo: manager.getRepository(Application),
            applicationUserRepo: manager.getRepository(ApplicationUser),
            connectorRepo: manager.getRepository(Connector),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    const mapMember = (member: ApplicationUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.user_id,
        email,
        nickname,
        role: (member.role || 'member') as ApplicationRole,
        comment: member.comment,
        createdAt: member.created_at
    })

    const loadMembers = async (
        req: Request,
        applicationId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { applicationUserRepo } = repos(req)
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)

        try {
            const qb = applicationUserRepo.createQueryBuilder('au').where('au.application_id = :applicationId', { applicationId })

            if (params) {
                const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = params

                if (search) {
                    const escapedSearch = escapeLikeWildcards(search.toLowerCase())
                    qb.andWhere(
                        `(
                            EXISTS (SELECT 1 FROM auth.users u WHERE u.id = au.user_id AND LOWER(u.email) LIKE :search)
                         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = au.user_id AND LOWER(p.nickname) LIKE :search)
                        )`,
                        { search: `%${escapedSearch}%` }
                    )
                }

                const orderColumn =
                    sortBy === 'email'
                        ? '(SELECT u.email FROM auth.users u WHERE u.id = au.user_id)'
                        : sortBy === 'role'
                        ? 'au.role'
                        : 'au.created_at'
                qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                qb.skip(offset).take(limit)
            }

            const [rawMembers, total] = await qb.getManyAndCount()
            const userIds = rawMembers.map((m) => m.user_id)

            if (userIds.length === 0) {
                return { members: [], total }
            }

            const users = userIds.length ? await manager.find(AuthUser, { where: { id: In(userIds) } }) : []
            const profiles = userIds.length ? await manager.find(Profile, { where: { user_id: In(userIds) } }) : []

            const usersMap = new Map(users.map((user) => [user.id, user.email ?? null]))
            const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile.nickname]))

            const members = rawMembers.map((m) => mapMember(m, usersMap.get(m.user_id) ?? null, profilesMap.get(m.user_id) ?? null))

            return { members, total }
        } catch (error) {
            console.error('[loadMembers] Error loading application members:', error)
            throw error
        }
    }

    // ============ LIST APPLICATIONS ============
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationRepo, applicationUserRepo } = repos(req)
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }
            const { limit, offset, sortBy, sortOrder, search, showAll } = validatedQuery

            const isSuperuser = await isSuperuserByDataSource(ds, userId, rlsRunner)
            const hasGlobalApplicationsAccess = await hasSubjectPermissionByDataSource(ds, userId, 'applications', 'read', rlsRunner)

            let qb = applicationRepo.createQueryBuilder('a')

            if (showAll && (isSuperuser || hasGlobalApplicationsAccess)) {
                // Show all applications for superusers/global admins
            } else {
                qb = qb.where(`a.id IN (SELECT au.application_id FROM applications.applications_users au WHERE au.user_id = :userId)`, {
                    userId
                })
            }

            if (search) {
                qb = qb.andWhere(
                    "(a.name::text ILIKE :search OR COALESCE(a.description::text, '') ILIKE :search OR COALESCE(a.slug, '') ILIKE :search)",
                    { search: `%${search}%` }
                )
            }

            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(a.name->>(a.name->>'_primary'), a.name->>'en', '')"
                    : sortBy === 'created'
                    ? 'a.created_at'
                    : 'a.updated_at'
            qb = qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
            qb = qb.skip(offset).take(limit)

            const [applications, total] = await qb.getManyAndCount()
            const applicationIds = applications.map((a) => a.id)

            const memberships =
                applicationIds.length > 0
                    ? await applicationUserRepo.find({
                          where: { application_id: In(applicationIds), user_id: userId }
                      })
                    : []
            const membershipMap = new Map(memberships.map((m) => [m.application_id, m]))

            const { connectorRepo } = repos(req)
            const connectorCounts =
                applicationIds.length > 0
                    ? await connectorRepo
                          .createQueryBuilder('s')
                          .select('s.application_id', 'applicationId')
                          .addSelect('COUNT(*)', 'count')
                          .where('s.application_id IN (:...ids)', { ids: applicationIds })
                          .groupBy('s.application_id')
                          .getRawMany<{ applicationId: string; count: string }>()
                    : []
            const connectorCountMap = new Map(connectorCounts.map((c) => [c.applicationId, parseInt(c.count, 10)]))

            const memberCounts =
                applicationIds.length > 0
                    ? await applicationUserRepo
                          .createQueryBuilder('au')
                          .select('au.application_id', 'applicationId')
                          .addSelect('COUNT(*)', 'count')
                          .where('au.application_id IN (:...ids)', { ids: applicationIds })
                          .groupBy('au.application_id')
                          .getRawMany<{ applicationId: string; count: string }>()
                    : []
            const memberCountMap = new Map(memberCounts.map((c) => [c.applicationId, parseInt(c.count, 10)]))

            const globalRoleName =
                isSuperuser || hasGlobalApplicationsAccess ? await getGlobalRoleCodenameByDataSource(ds, userId, rlsRunner) : null

            const result = applications.map((a) => {
                const membership = membershipMap.get(a.id)
                const role = membership ? (membership.role as ApplicationRole) : globalRoleName ? 'owner' : 'member'
                const accessType = membership ? 'member' : globalRoleName ?? 'member'
                const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

                return {
                    id: a.id,
                    name: a.name,
                    description: a.description,
                    slug: a.slug,
                    isPublic: a.isPublic,
                    createdAt: a.createdAt,
                    updatedAt: a.updatedAt,
                    connectorsCount: connectorCountMap.get(a.id) ?? 0,
                    membersCount: memberCountMap.get(a.id) ?? 0,
                    role,
                    accessType,
                    permissions
                }
            })

            return res.json({ items: result, total, limit, offset })
        })
    )

    // ============ GET SINGLE APPLICATION ============
    router.get(
        '/:applicationId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const { applicationRepo } = repos(req)
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureApplicationAccess(ds, userId, applicationId, undefined, rlsRunner)

            const application = await applicationRepo.findOne({ where: { id: applicationId } })
            if (!application) return res.status(404).json({ error: 'Application not found' })

            const { connectorRepo } = repos(req)
            const connectorsCount = await connectorRepo.count({ where: { applicationId } })
            const { total: membersCount } = await loadMembers(req, applicationId, { limit: 1 })

            const role = ctx.membership.role as ApplicationRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: application.id,
                name: application.name,
                description: application.description,
                slug: application.slug,
                isPublic: application.isPublic,
                createdAt: application.createdAt,
                updatedAt: application.updatedAt,
                schemaName: application.schemaName,
                schemaStatus: application.schemaStatus,
                schemaSyncedAt: application.schemaSyncedAt,
                schemaError: application.schemaError,
                connectorsCount,
                membersCount,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions
            })
        })
    )

    // ============ CREATE APPLICATION ============
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const localizedInputSchema = z
                .union([z.string().min(1).max(255), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const optionalLocalizedInputSchema = z
                .union([z.string(), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const schema = z.object({
                name: localizedInputSchema,
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .optional(),
                isPublic: z.boolean().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { applicationRepo, applicationUserRepo } = repos(req)
            const { name, description, slug, isPublic, namePrimaryLocale, descriptionPrimaryLocale } = result.data

            const sanitizedName = sanitizeLocalizedInput(name)
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

            if (slug) {
                const existing = await applicationRepo.findOne({ where: { slug } })
                if (existing) {
                    return res.status(409).json({ error: 'Application with this slug already exists' })
                }
            }

            const application = applicationRepo.create({
                name: nameVlc,
                description: descriptionVlc,
                slug: slug || undefined,
                isPublic: isPublic ?? false
            })

            const saved = await applicationRepo.save(application)

            // Generate schemaName based on Application UUID
            saved.schemaName = generateSchemaName(saved.id)
            await applicationRepo.save(saved)

            // Add creator as owner
            const member = applicationUserRepo.create({
                application_id: saved.id,
                user_id: userId,
                role: 'owner'
            })
            await applicationUserRepo.save(member)

            return res.status(201).json({
                id: saved.id,
                name: saved.name,
                description: saved.description,
                slug: saved.slug,
                isPublic: saved.isPublic,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt,
                connectorsCount: 0,
                membersCount: 1,
                role: 'owner',
                accessType: 'member',
                permissions: ROLE_PERMISSIONS.owner
            })
        })
    )

    // ============ UPDATE APPLICATION ============
    router.patch(
        '/:applicationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'], rlsRunner)

            const { applicationRepo } = repos(req)
            const application = await applicationRepo.findOne({ where: { id: applicationId } })
            if (!application) return res.status(404).json({ error: 'Application not found' })

            const localizedInputSchema = z
                .union([z.string().min(1).max(255), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const optionalLocalizedInputSchema = z
                .union([z.string(), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const schema = z.object({
                name: localizedInputSchema.optional(),
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .nullable()
                    .optional(),
                isPublic: z.boolean().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { name, description, slug, isPublic, namePrimaryLocale, descriptionPrimaryLocale } = result.data

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? application.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    application.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ??
                        application.description?._primary ??
                        application.name?._primary ??
                        namePrimaryLocale ??
                        'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        application.description = descriptionVlc
                    }
                } else {
                    application.description = undefined
                }
            }

            if (slug !== undefined) {
                if (slug !== null && slug !== application.slug) {
                    const existing = await applicationRepo.findOne({ where: { slug } })
                    if (existing && existing.id !== applicationId) {
                        return res.status(409).json({ error: 'Application with this slug already exists' })
                    }
                }
                application.slug = slug ?? undefined
            }

            if (isPublic !== undefined) {
                application.isPublic = isPublic
            }

            const saved = await applicationRepo.save(application)
            const role = ctx.membership.role as ApplicationRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: saved.id,
                name: saved.name,
                description: saved.description,
                slug: saved.slug,
                isPublic: saved.isPublic,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions
            })
        })
    )

    // ============ DELETE APPLICATION ============
    router.delete(
        '/:applicationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, ['owner'], rlsRunner)

            const { applicationRepo } = repos(req)
            const application = await applicationRepo.findOne({ where: { id: applicationId } })
            if (!application) return res.status(404).json({ error: 'Application not found' })

            await applicationRepo.remove(application)
            return res.status(204).send()
        })
    )

    // ============ LIST MEMBERS ============
    router.get(
        '/:applicationId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, undefined, rlsRunner)

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { members, total } = await loadMembers(req, applicationId, validatedQuery)
            return res.json({ items: members, total, limit: validatedQuery.limit, offset: validatedQuery.offset })
        })
    )

    // ============ ADD MEMBER ============
    router.post(
        '/:applicationId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'], rlsRunner)

            const schema = z.object({
                email: z.string().email(),
                role: z.enum(['member', 'editor', 'admin', 'owner']).default('member'),
                comment: z.string().max(500).optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { email, role, comment } = result.data
            const { applicationUserRepo, authUserRepo } = repos(req)

            const user = await authUserRepo.findOne({ where: { email: email.toLowerCase() } })
            if (!user) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await applicationUserRepo.findOne({
                where: { application_id: applicationId, user_id: user.id }
            })
            if (existing) {
                return res.status(409).json({ error: 'User is already a member' })
            }

            const member = applicationUserRepo.create({
                application_id: applicationId,
                user_id: user.id,
                role,
                comment
            })
            await applicationUserRepo.save(member)

            const manager = getRequestManager(req, ds)
            const profiles = await manager.find(Profile, { where: { user_id: user.id } })
            const nickname = profiles.length > 0 ? profiles[0].nickname : null

            return res.status(201).json(mapMember(member, user.email, nickname))
        })
    )

    // ============ UPDATE MEMBER ============
    router.patch(
        '/:applicationId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId, memberId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'], rlsRunner)

            const { applicationUserRepo, authUserRepo } = repos(req)
            const member = await applicationUserRepo.findOne({
                where: { id: memberId, application_id: applicationId }
            })
            if (!member) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(member, 'Cannot modify owner role')

            const schema = z.object({
                role: z.enum(['member', 'editor', 'admin', 'owner']).optional(),
                comment: z.string().max(500).nullable().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { role, comment } = result.data

            if (role !== undefined) {
                if (role === 'owner' && ctx.membership.role !== 'owner') {
                    return res.status(403).json({ error: 'Only owner can transfer ownership' })
                }
                member.role = role
            }

            if (comment !== undefined) {
                member.comment = comment ?? undefined
            }

            await applicationUserRepo.save(member)

            const user = await authUserRepo.findOne({ where: { id: member.user_id } })
            const manager = getRequestManager(req, ds)
            const profiles = await manager.find(Profile, { where: { user_id: member.user_id } })
            const nickname = profiles.length > 0 ? profiles[0].nickname : null

            return res.json(mapMember(member, user?.email ?? null, nickname))
        })
    )

    // ============ REMOVE MEMBER ============
    router.delete(
        '/:applicationId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId, memberId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'], rlsRunner)

            const { applicationUserRepo } = repos(req)
            const member = await applicationUserRepo.findOne({
                where: { id: memberId, application_id: applicationId }
            })
            if (!member) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(member, 'Cannot remove owner')

            await applicationUserRepo.remove(member)
            return res.status(204).send()
        })
    )

    return router
}
