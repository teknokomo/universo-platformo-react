import { Router, Request, Response, RequestHandler } from 'express'
import { getRequestDbExecutor, uuid, type DbExecutor } from '@universo/utils'
import type { IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { escapeLikeWildcards } from '../utils'
import { createEnsureGlobalAccess, type RequestWithGlobalRole } from '../guards/ensureGlobalAccess'
import {
    listRoles,
    listAssignableRoles,
    findRoleById,
    findRoleByCodename,
    createRole,
    updateRole,
    deleteRole,
    replacePermissions,
    countUsersByRoleId,
    listRoleUsers
} from '../persistence/rolesStore'
import { CreateRoleSchema, UpdateRoleSchema } from '../schemas'
import { z } from 'zod'

/**
 * Validation schema for list query
 */
const ListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().optional(),
    sortBy: z.enum(['codename', 'created', 'has_global_access']).default('codename'),
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
    getDbExecutor: () => DbExecutor
}

export function createRolesRoutes({ globalAccessService, permissionService, getDbExecutor }: RolesRoutesConfig): Router {
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    router.get(
        '/assignable',
        ensureGlobalAccess('roles', 'read'),
        asyncHandler(async (req, res) => {
            const exec = getRequestDbExecutor(req, getDbExecutor())
            const roles = await listAssignableRoles(exec)

            const data = roles.map((role) => ({
                id: role.id,
                codename: role.codename,
                name: role.name ?? {},
                color: role.color
            }))

            res.json({ success: true, data })
        })
    )

    router.get(
        '/',
        ensureGlobalAccess('roles', 'read'),
        asyncHandler(async (req, res) => {
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
            const exec = getRequestDbExecutor(req, getDbExecutor())

            const { items, total } = await listRoles(exec, {
                limit,
                offset,
                search: search ? escapeLikeWildcards(search.toLowerCase()) : undefined,
                sortBy,
                sortOrder,
                includeSystem
            })

            const hasMore = offset + items.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', items.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json({ success: true, data: items })
        })
    )

    router.get(
        '/:id',
        ensureGlobalAccess('roles', 'read'),
        asyncHandler(async (req, res) => {
            const { id } = req.params

            if (!uuid.isValidUuid(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid role ID format. Must be a valid UUID.'
                })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const role = await findRoleById(exec, id)

            if (!role) {
                res.status(404).json({ success: false, error: 'Role not found' })
                return
            }

            res.json({ success: true, data: role })
        })
    )

    router.post(
        '/',
        ensureGlobalAccess('roles', 'create'),
        asyncHandler(async (req, res) => {
            const parsed = CreateRoleSchema.safeParse(req.body)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: parsed.error.errors
                })
                return
            }

            const { codename, description, name, color, isSuperuser, permissions } = parsed.data
            const exec = getRequestDbExecutor(req, getDbExecutor())

            const existing = await findRoleByCodename(exec, codename)
            if (existing) {
                res.status(409).json({
                    success: false,
                    error: `Role with codename "${codename}" already exists`
                })
                return
            }

            const savedRole = await createRole(exec, {
                codename,
                name,
                description,
                color,
                is_superuser: isSuperuser
            })

            if (permissions && permissions.length > 0) {
                await replacePermissions(
                    exec,
                    savedRole.id,
                    permissions.map((p) => ({ subject: p.subject!, action: p.action!, conditions: p.conditions, fields: p.fields })),
                    (req as RequestWithGlobalRole).user?.id
                )
            }

            const roleWithPermissions = await findRoleById(exec, savedRole.id)
            res.status(201).json({ success: true, data: roleWithPermissions })
        })
    )

    router.patch(
        '/:id',
        ensureGlobalAccess('roles', 'update'),
        asyncHandler(async (req, res) => {
            const { id } = req.params

            if (!uuid.isValidUuid(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid role ID format. Must be a valid UUID.'
                })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const role = await findRoleById(exec, id)

            if (!role) {
                res.status(404).json({ success: false, error: 'Role not found' })
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

            const { codename, description, name, color, isSuperuser, permissions } = parsed.data

            // Protect system roles from critical changes
            if (role.is_system) {
                const forbiddenFields: string[] = []
                if (codename !== undefined && codename !== role.codename) forbiddenFields.push('codename')
                if (isSuperuser !== undefined && isSuperuser !== role.is_superuser) forbiddenFields.push('isSuperuser')
                if (permissions !== undefined) forbiddenFields.push('permissions')

                if (forbiddenFields.length > 0) {
                    res.status(403).json({
                        success: false,
                        error: `Cannot modify ${forbiddenFields.join(', ')} of system role "${role.codename}"`
                    })
                    return
                }
            }

            if (codename !== undefined && codename !== role.codename) {
                const existing = await findRoleByCodename(exec, codename)
                if (existing) {
                    res.status(409).json({
                        success: false,
                        error: `Role with codename "${codename}" already exists`
                    })
                    return
                }
            }

            await updateRole(exec, id, { codename, name, description, color, is_superuser: isSuperuser })

            if (permissions !== undefined && !role.is_system) {
                await replacePermissions(
                    exec,
                    id,
                    permissions.map((p) => ({ subject: p.subject!, action: p.action!, conditions: p.conditions, fields: p.fields })),
                    (req as RequestWithGlobalRole).user?.id
                )
            }

            const updatedRole = await findRoleById(exec, id)
            res.json({ success: true, data: updatedRole })
        })
    )

    router.delete(
        '/:id',
        ensureGlobalAccess('roles', 'delete'),
        asyncHandler(async (req, res) => {
            const { id } = req.params

            if (!uuid.isValidUuid(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid role ID format. Must be a valid UUID.'
                })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const role = await findRoleById(exec, id)

            if (!role) {
                res.status(404).json({ success: false, error: 'Role not found' })
                return
            }

            if (role.is_system) {
                res.status(403).json({
                    success: false,
                    error: `Cannot delete system role "${role.codename}"`
                })
                return
            }

            const assignedUsers = await countUsersByRoleId(exec, id)
            if (assignedUsers > 0) {
                res.status(409).json({
                    success: false,
                    error: `Cannot delete role "${role.codename}" because it is assigned to ${assignedUsers} user(s). Remove assignments first.`
                })
                return
            }

            await deleteRole(exec, id, (req as RequestWithGlobalRole).user?.id)
            res.json({ success: true, message: `Role "${role.codename}" deleted successfully` })
        })
    )

    router.get(
        '/:id/users',
        ensureGlobalAccess('roles', 'read'),
        asyncHandler(async (req, res) => {
            const { id } = req.params
            const exec = getRequestDbExecutor(req, getDbExecutor())

            const role = await findRoleById(exec, id)
            if (!role) {
                res.status(404).json({ success: false, error: 'Role not found' })
                return
            }

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

            const { items, total } = await listRoleUsers(exec, id, {
                limit,
                offset,
                search: search ? escapeLikeWildcards(search.toLowerCase()) : undefined,
                sortBy,
                sortOrder
            })

            const users = items.map((ur) => ({
                id: ur.user_id,
                email: ur.email,
                full_name: ur.full_name,
                assigned_at: ur.created_at,
                assigned_by: ur.granted_by ?? null,
                status: ur.status
            }))

            const hasMore = offset + users.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', users.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json({
                success: true,
                data: { roleId: id, roleCodename: role.codename, users }
            })
        })
    )

    return router
}
