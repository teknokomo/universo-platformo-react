import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import { uuid } from '@universo/utils'
import type { RequestWithDbContext, IPermissionService } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { createEnsureGlobalAccess } from '../guards/ensureGlobalAccess'
import { Role } from '../database/entities/Role'
import { RolePermission } from '../database/entities/RolePermission'
import { UserRole } from '../database/entities/UserRole'
import { CreateRoleSchema, UpdateRoleSchema } from '../schemas'
import { z } from 'zod'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

/**
 * Validation schema for list query
 */
const ListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().optional(),
    sortBy: z.enum(['name', 'created', 'has_global_access']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    includeSystem: z.coerce.boolean().default(true)
})

/**
 * Validation schema for role users query
 */
const RoleUsersQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().optional(),
    sortBy: z.enum(['email', 'assigned_at']).default('assigned_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export interface RolesRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    getDataSource: () => DataSource
}

/**
 * Create routes for roles management
 * Requires global access for all operations
 */
export function createRolesRoutes({ globalAccessService, permissionService, getDataSource }: RolesRoutesConfig): Router {
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const getRoleRepo = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return manager.getRepository(Role)
    }

    const getPermissionRepo = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return manager.getRepository(RolePermission)
    }

    const getUserRoleRepo = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return manager.getRepository(UserRole)
    }

    const getAuthUserRepo = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return manager.getRepository(AuthUser)
    }

    /**
     * GET /api/v1/admin/roles/assignable
     * Get roles that can be assigned to global users
     * Returns minimal role data for dropdown population
     */
    router.get(
        '/assignable',
        ensureGlobalAccess('roles', 'read'),
        asyncHandler(async (req, res) => {
            const roleRepo = getRoleRepo(req)

            const roles = await roleRepo.find({
                select: ['id', 'name', 'display_name', 'color'],
                order: { name: 'ASC' }
            })

            const data = roles.map((role) => ({
                id: role.id,
                name: role.name,
                displayName: role.display_name ?? {},
                color: role.color
            }))

            res.json({ success: true, data })
        })
    )

    /**
     * GET /api/v1/admin/roles
     * List all roles with their permissions
     */
    router.get(
        '/',
        ensureGlobalAccess('roles', 'read'),
        asyncHandler(async (req, res) => {
            const roleRepo = getRoleRepo(req)
            const parsed = ListQuerySchema.safeParse(req.query)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid query parameters',
                    details: parsed.error.errors
                })
                return
            }

            const { limit, offset, search, sortBy, sortOrder, includeSystem } = parsed.data

            const qb = roleRepo.createQueryBuilder('r').leftJoinAndSelect('r.permissions', 'p')

            if (!includeSystem) {
                qb.andWhere('r.is_system = false')
            }

            if (search) {
                const searchLower = search.toLowerCase()
                qb.andWhere(
                    `(
                        LOWER(r.name) LIKE :search OR
                        r.display_name::text ILIKE :search OR
                        LOWER(r.description) LIKE :search
                    )`,
                    { search: `%${searchLower}%` }
                )
            }

            // Sorting
            const sortColumn = sortBy === 'created' ? 'r.created_at' : sortBy === 'has_global_access' ? 'r.has_global_access' : 'r.name'
            qb.orderBy(sortColumn, sortOrder.toUpperCase() as 'ASC' | 'DESC')

            const total = await qb.getCount()
            const roles = await qb.skip(offset).take(limit).getMany()

            const hasMore = offset + roles.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', roles.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json({ success: true, data: roles })
        })
    )

    /**
     * GET /api/v1/admin/roles/:id
     * Get role by ID with permissions
     */
    router.get(
        '/:id',
        ensureGlobalAccess('roles', 'read'),
        asyncHandler(async (req, res) => {
            const { id } = req.params

            // Validate UUID format (prevent 'new' or other non-UUID values from reaching DB)
            if (!uuid.isValidUuid(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid role ID format. Must be a valid UUID.'
                })
                return
            }

            const roleRepo = getRoleRepo(req)

            const role = await roleRepo.findOne({
                where: { id },
                relations: ['permissions']
            })

            if (!role) {
                res.status(404).json({
                    success: false,
                    error: 'Role not found'
                })
                return
            }

            res.json({ success: true, data: role })
        })
    )

    /**
     * POST /api/v1/admin/roles
     * Create a new role with permissions
     */
    router.post(
        '/',
        ensureGlobalAccess('roles', 'create'),
        asyncHandler(async (req, res) => {
            const roleRepo = getRoleRepo(req)
            const permissionRepo = getPermissionRepo(req)

            const parsed = CreateRoleSchema.safeParse(req.body)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: parsed.error.errors
                })
                return
            }

            const { name, description, displayName, color, isSuperuser, permissions } = parsed.data

            // Check for duplicate name
            const existing = await roleRepo.findOne({ where: { name } })
            if (existing) {
                res.status(409).json({
                    success: false,
                    error: `Role with name "${name}" already exists`
                })
                return
            }

            // Create role
            const role = roleRepo.create({
                name,
                description,
                display_name: displayName,
                color,
                is_superuser: isSuperuser,
                is_system: false // User-created roles are never system roles
            })

            const savedRole = await roleRepo.save(role)

            // Create permissions
            if (permissions && permissions.length > 0) {
                const permissionEntities = permissions.map((perm) =>
                    permissionRepo.create({
                        role_id: savedRole.id,
                        subject: perm.subject,
                        action: perm.action,
                        conditions: perm.conditions ?? {},
                        fields: perm.fields ?? []
                    })
                )
                await permissionRepo.save(permissionEntities)
            }

            // Reload with permissions
            const roleWithPermissions = await roleRepo.findOne({
                where: { id: savedRole.id },
                relations: ['permissions']
            })

            res.status(201).json({ success: true, data: roleWithPermissions })
        })
    )

    /**
     * PATCH /api/v1/admin/roles/:id
     * Update role and optionally replace permissions
     */
    router.patch(
        '/:id',
        ensureGlobalAccess('roles', 'update'),
        asyncHandler(async (req, res) => {
            const { id } = req.params

            // Validate UUID format
            if (!uuid.isValidUuid(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid role ID format. Must be a valid UUID.'
                })
                return
            }

            const roleRepo = getRoleRepo(req)
            const permissionRepo = getPermissionRepo(req)

            const role = await roleRepo.findOne({
                where: { id },
                relations: ['permissions']
            })

            if (!role) {
                res.status(404).json({
                    success: false,
                    error: 'Role not found'
                })
                return
            }

            const parsed = UpdateRoleSchema.safeParse(req.body)

            if (!parsed.success) {
                console.error('[UpdateRole] Validation failed:', {
                    roleId: id,
                    body: JSON.stringify(req.body, null, 2),
                    errors: parsed.error.errors
                })
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: parsed.error.errors
                })
                return
            }

            const { name, description, displayName, color, isSuperuser, permissions } = parsed.data

            // Protect system roles from critical changes
            if (role.is_system) {
                // System roles: only allow updating description, displayName, color
                const forbiddenFields = []
                if (name !== undefined && name !== role.name) forbiddenFields.push('name')
                if (isSuperuser !== undefined && isSuperuser !== role.is_superuser) {
                    forbiddenFields.push('isSuperuser')
                }
                if (permissions !== undefined) forbiddenFields.push('permissions')

                if (forbiddenFields.length > 0) {
                    res.status(403).json({
                        success: false,
                        error: `Cannot modify ${forbiddenFields.join(', ')} of system role "${role.name}"`
                    })
                    return
                }
            }

            // Check for duplicate name (if changing)
            if (name !== undefined && name !== role.name) {
                const existing = await roleRepo.findOne({ where: { name } })
                if (existing) {
                    res.status(409).json({
                        success: false,
                        error: `Role with name "${name}" already exists`
                    })
                    return
                }
                role.name = name
            }

            // Update allowed fields
            if (description !== undefined) role.description = description
            if (displayName !== undefined) role.display_name = displayName
            if (color !== undefined) role.color = color
            if (isSuperuser !== undefined) role.is_superuser = isSuperuser

            await roleRepo.save(role)

            // Replace permissions if provided (only for non-system roles)
            if (permissions !== undefined && !role.is_system) {
                // Delete existing permissions
                await permissionRepo.delete({ role_id: id })

                // Create new permissions
                if (permissions.length > 0) {
                    const permissionEntities = permissions.map((perm) =>
                        permissionRepo.create({
                            role_id: id,
                            subject: perm.subject,
                            action: perm.action,
                            conditions: perm.conditions ?? {},
                            fields: perm.fields ?? []
                        })
                    )
                    await permissionRepo.save(permissionEntities)
                }
            }

            // Reload with permissions
            const updatedRole = await roleRepo.findOne({
                where: { id },
                relations: ['permissions']
            })

            res.json({ success: true, data: updatedRole })
        })
    )

    /**
     * DELETE /api/v1/admin/roles/:id
     * Delete a role (system roles cannot be deleted)
     */
    router.delete(
        '/:id',
        ensureGlobalAccess('roles', 'delete'),
        asyncHandler(async (req, res) => {
            const { id } = req.params

            // Validate UUID format
            if (!uuid.isValidUuid(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid role ID format. Must be a valid UUID.'
                })
                return
            }

            const roleRepo = getRoleRepo(req)

            const role = await roleRepo.findOne({ where: { id } })

            if (!role) {
                res.status(404).json({
                    success: false,
                    error: 'Role not found'
                })
                return
            }

            // Prevent deletion of system roles
            if (role.is_system) {
                res.status(403).json({
                    success: false,
                    error: `Cannot delete system role "${role.name}"`
                })
                return
            }

            // Check if role is assigned to any users
            const userRoleRepo = getUserRoleRepo(req)
            const assignedUsers = await userRoleRepo.count({ where: { role_id: id } })

            if (assignedUsers > 0) {
                res.status(409).json({
                    success: false,
                    error: `Cannot delete role "${role.name}" because it is assigned to ${assignedUsers} user(s). Remove assignments first.`
                })
                return
            }

            // Delete role (permissions will be cascade deleted)
            await roleRepo.delete({ id })

            res.json({
                success: true,
                message: `Role "${role.name}" deleted successfully`
            })
        })
    )

    /**
     * GET /api/v1/admin/roles/:id/users
     * Get users assigned to a role with pagination
     */
    router.get(
        '/:id/users',
        ensureGlobalAccess('roles', 'read'),
        asyncHandler(async (req, res) => {
            const { id } = req.params
            const roleRepo = getRoleRepo(req)

            const role = await roleRepo.findOne({ where: { id } })

            if (!role) {
                res.status(404).json({
                    success: false,
                    error: 'Role not found'
                })
                return
            }

            // Parse and validate query parameters
            const parsed = RoleUsersQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid query parameters',
                    details: parsed.error.errors
                })
                return
            }

            const { limit, offset, search, sortBy, sortOrder } = parsed.data

            // Get repositories
            const userRoleRepo = getUserRoleRepo(req)
            const authUserRepo = getAuthUserRepo(req)

            // Build query with pagination
            const qb = userRoleRepo.createQueryBuilder('ur').where('ur.role_id = :roleId', { roleId: id })

            // Search filter (email via subquery to avoid cross-schema join issues)
            if (search) {
                const escapedSearch = search.toLowerCase()
                qb.andWhere(`EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id AND LOWER(u.email) LIKE :search)`, {
                    search: `%${escapedSearch}%`
                })
            }

            // Sorting
            const sortColumn = sortBy === 'email' ? '(SELECT u.email FROM auth.users u WHERE u.id = ur.user_id)' : 'ur.created_at'
            qb.orderBy(sortColumn, sortOrder.toUpperCase() as 'ASC' | 'DESC')
                .skip(offset)
                .take(limit)

            // Get data and count in one query
            const [userRoles, total] = await qb.getManyAndCount()

            // Load auth users for the page
            const userIds = userRoles.map((ur) => ur.user_id)
            const authUsers = userIds.length > 0 ? await authUserRepo.find({ where: { id: In(userIds) } }) : []

            // Create lookup map
            const authUserMap = new Map(authUsers.map((u) => [u.id, u]))

            // Map to response format with computed status
            const users = userRoles.map((ur) => {
                const authUser = authUserMap.get(ur.user_id)
                return {
                    id: ur.user_id,
                    email: authUser?.email ?? null,
                    full_name: authUser?.fullName ?? null,
                    assigned_at: ur.created_at,
                    assigned_by: ur.granted_by ?? null,
                    status: authUser?.status ?? 'inactive'
                }
            })

            // Set pagination headers (consistent with MetaverseList pattern)
            const hasMore = offset + users.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', users.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json({
                success: true,
                data: {
                    roleId: id,
                    roleName: role.name,
                    users
                }
            })
        })
    )

    return router
}
