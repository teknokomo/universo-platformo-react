import { Router, Request, Response, RequestHandler } from 'express'
import { activeAppRowCondition, getCodenamePrimary, getRequestDbExecutor, uuid, type DbExecutor } from '@universo/utils'
import { enforceSingleLocaleCodename } from '@universo/utils/vlc'
import { isValidCodenameForStyle } from '@universo/utils/validation/codename'
import { isUniqueViolation } from '@universo/utils/database'
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
import { findSetting } from '../persistence/settingsStore'
import { CreateRoleSchema, RoleCodenameSchema, UpdateRoleSchema, isLegacyRoleCodename } from '../schemas'
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
    includeSystem: z.preprocess((val) => (val === undefined ? true : val === 'true' || val === true), z.boolean())
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

const CopyRoleSchema = z.object({
    codename: RoleCodenameSchema,
    name: z.record(z.any()),
    description: z.record(z.any()).optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .default('#9e9e9e'),
    copyPermissions: z.boolean().default(false)
})

export interface RolesRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    getDbExecutor: () => DbExecutor
}

type RoleCodenameValidationConfig = {
    style: 'pascal-case' | 'kebab-case'
    alphabet: 'en' | 'ru' | 'en-ru'
    allowMixed: boolean
}

export function createRolesRoutes({ globalAccessService, permissionService, getDbExecutor }: RolesRoutesConfig): Router {
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    function extractSettingValue(row: Awaited<ReturnType<typeof findSetting>>): unknown {
        if (!row) {
            return undefined
        }

        const raw = row.value
        return typeof raw === 'object' && raw !== null && '_value' in raw ? (raw as { _value: unknown })._value : raw
    }

    async function getRoleCodenameValidationConfig(exec: DbExecutor): Promise<RoleCodenameValidationConfig> {
        const [styleRow, alphabetRow, allowMixedRow] = await Promise.all([
            findSetting(exec, 'metahubs', 'codenameStyle'),
            findSetting(exec, 'metahubs', 'codenameAlphabet'),
            findSetting(exec, 'metahubs', 'codenameAllowMixedAlphabets')
        ])

        const config: RoleCodenameValidationConfig = {
            style: 'pascal-case',
            alphabet: 'en-ru',
            allowMixed: false
        }

        const styleValue = extractSettingValue(styleRow)
        if (styleValue === 'pascal-case' || styleValue === 'kebab-case') {
            config.style = styleValue
        }

        const alphabetValue = extractSettingValue(alphabetRow)
        if (alphabetValue === 'en' || alphabetValue === 'ru' || alphabetValue === 'en-ru') {
            config.alphabet = alphabetValue
        }

        const allowMixedValue = extractSettingValue(allowMixedRow)
        if (typeof allowMixedValue === 'boolean') {
            config.allowMixed = allowMixedValue
        }

        return config
    }

    function validateRoleCodename(
        codename: { _primary: string },
        codenameText: string,
        config: RoleCodenameValidationConfig
    ): Array<{ code: string; path: string[]; message: string }> | null {
        if (isValidCodenameForStyle(codenameText, config.style, config.alphabet, config.allowMixed) || isLegacyRoleCodename(codenameText)) {
            return null
        }

        return [
            {
                code: 'custom',
                path: ['codename', 'locales', codename._primary, 'content'],
                message: `Codename must match the configured ${config.style} / ${config.alphabet} role settings or the legacy lowercase slug format`
            }
        ]
    }

    /** Read codenameLocalizedEnabled from admin.cfg_settings */
    async function isCodenameLocalizedEnabled(exec: DbExecutor): Promise<boolean> {
        const row = await findSetting(exec, 'metahubs', 'codenameLocalizedEnabled')
        if (!row) return true
        const val = extractSettingValue(row)
        return val !== false
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

            const { codename: rawCodename, description, name, color, isSuperuser, permissions } = parsed.data
            const exec = getRequestDbExecutor(req, getDbExecutor())
            const localizedEnabled = await isCodenameLocalizedEnabled(exec)
            const codename = enforceSingleLocaleCodename(rawCodename, localizedEnabled)
            const codenameText = getCodenamePrimary(codename)
            const codenameValidationDetails = validateRoleCodename(codename, codenameText, await getRoleCodenameValidationConfig(exec))

            if (codenameValidationDetails) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: codenameValidationDetails
                })
                return
            }

            const existing = await findRoleByCodename(exec, codenameText)
            if (existing) {
                res.status(409).json({
                    success: false,
                    error: `Role with codename "${codenameText}" already exists`
                })
                return
            }

            let roleWithPermissions
            try {
                roleWithPermissions = await exec.transaction(async (trx) => {
                    const savedRole = await createRole(trx, {
                        codename,
                        name,
                        description,
                        color,
                        is_superuser: isSuperuser,
                        created_by: (req as RequestWithGlobalRole).user?.id ?? null
                    })

                    if (permissions && permissions.length > 0) {
                        await replacePermissions(
                            trx,
                            savedRole.id,
                            permissions.map((p) => ({
                                subject: p.subject!,
                                action: p.action!,
                                conditions: p.conditions,
                                fields: p.fields
                            })),
                            (req as RequestWithGlobalRole).user?.id
                        )
                    }

                    return findRoleById(trx, savedRole.id)
                })
            } catch (error) {
                if (isUniqueViolation(error)) {
                    res.status(409).json({
                        success: false,
                        error: `Role with codename "${codenameText}" already exists`
                    })
                    return
                }

                throw error
            }

            res.status(201).json({ success: true, data: roleWithPermissions })
        })
    )

    router.post(
        '/:id/copy',
        ensureGlobalAccess('roles', 'create'),
        asyncHandler(async (req, res) => {
            const { id: sourceRoleId } = req.params

            if (!uuid.isValidUuid(sourceRoleId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid role ID format. Must be a valid UUID.'
                })
                return
            }

            const parsed = CopyRoleSchema.safeParse(req.body)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: parsed.error.errors
                })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const localizedEnabled = await isCodenameLocalizedEnabled(exec)
            const enforcedCopyCodename = enforceSingleLocaleCodename(parsed.data.codename, localizedEnabled)
            const requestedCodename = getCodenamePrimary(enforcedCopyCodename)
            const codenameValidationDetails = validateRoleCodename(
                enforcedCopyCodename,
                requestedCodename,
                await getRoleCodenameValidationConfig(exec)
            )

            if (codenameValidationDetails) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: codenameValidationDetails
                })
                return
            }

            const sourceRole = await findRoleById(exec, sourceRoleId)
            if (!sourceRole) {
                res.status(404).json({ success: false, error: 'Source role not found' })
                return
            }

            const existing = await findRoleByCodename(exec, requestedCodename)
            if (existing) {
                res.status(409).json({
                    success: false,
                    error: `Role with codename "${requestedCodename}" already exists`
                })
                return
            }

            let copiedRoleId: string
            try {
                copiedRoleId = await exec.transaction(async (trx) => {
                    const savedRole = await createRole(trx, {
                        codename: enforcedCopyCodename,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        color: parsed.data.color,
                        is_superuser: false,
                        created_by: (req as RequestWithGlobalRole).user?.id ?? null
                    })

                    if (parsed.data.copyPermissions) {
                        await trx.query(
                            `INSERT INTO admin.rel_role_permissions (role_id, subject, action, conditions, fields)
                             SELECT $1, subject, action, conditions, fields
                             FROM admin.rel_role_permissions
                             WHERE role_id = $2 AND ${activeAppRowCondition()}`,
                            [savedRole.id, sourceRoleId]
                        )
                    }

                    return savedRole.id
                })
            } catch (error) {
                if (isUniqueViolation(error)) {
                    res.status(409).json({
                        success: false,
                        error: `Role with codename "${requestedCodename}" already exists`
                    })
                    return
                }

                throw error
            }

            const copiedRole = await findRoleById(exec, copiedRoleId)
            res.status(201).json({ success: true, data: copiedRole })
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
                    errors: parsed.error.errors
                })
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: parsed.error.errors
                })
                return
            }

            const { codename: rawUpdateCodename, description, name, color, isSuperuser, permissions } = parsed.data
            const localizedEnabled = await isCodenameLocalizedEnabled(exec)
            const codename = rawUpdateCodename !== undefined ? enforceSingleLocaleCodename(rawUpdateCodename, localizedEnabled) : undefined
            const nextCodenameText = codename !== undefined ? getCodenamePrimary(codename) : undefined

            if (codename !== undefined && nextCodenameText !== undefined) {
                const codenameValidationDetails = validateRoleCodename(
                    codename,
                    nextCodenameText,
                    await getRoleCodenameValidationConfig(exec)
                )

                if (codenameValidationDetails) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid request body',
                        details: codenameValidationDetails
                    })
                    return
                }
            }

            // Protect system roles from critical changes
            if (role.is_system) {
                const forbiddenFields: string[] = []
                if (nextCodenameText !== undefined && nextCodenameText !== getCodenamePrimary(role.codename))
                    forbiddenFields.push('codename')
                if (isSuperuser !== undefined && isSuperuser !== role.is_superuser) forbiddenFields.push('isSuperuser')
                if (permissions !== undefined) forbiddenFields.push('permissions')

                if (forbiddenFields.length > 0) {
                    res.status(403).json({
                        success: false,
                        error: `Cannot modify ${forbiddenFields.join(', ')} of system role "${getCodenamePrimary(role.codename)}"`
                    })
                    return
                }
            }

            if (nextCodenameText !== undefined && nextCodenameText !== getCodenamePrimary(role.codename)) {
                const existing = await findRoleByCodename(exec, nextCodenameText)
                if (existing) {
                    res.status(409).json({
                        success: false,
                        error: `Role with codename "${nextCodenameText}" already exists`
                    })
                    return
                }
            }

            await exec.transaction(async (trx) => {
                await updateRole(trx, id, { codename, name, description, color, is_superuser: isSuperuser })

                if (permissions !== undefined && !role.is_system) {
                    await replacePermissions(
                        trx,
                        id,
                        permissions.map((p) => ({ subject: p.subject!, action: p.action!, conditions: p.conditions, fields: p.fields })),
                        (req as RequestWithGlobalRole).user?.id
                    )
                }
            })

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
                    error: `Cannot delete system role "${getCodenamePrimary(role.codename)}"`
                })
                return
            }

            const assignedUsers = await countUsersByRoleId(exec, id)
            if (assignedUsers > 0) {
                res.status(409).json({
                    success: false,
                    error: `Cannot delete role "${getCodenamePrimary(
                        role.codename
                    )}" because it is assigned to ${assignedUsers} user(s). Remove assignments first.`
                })
                return
            }

            await deleteRole(exec, id, (req as RequestWithGlobalRole).user?.id)
            res.json({ success: true, message: `Role "${getCodenamePrimary(role.codename)}" deleted successfully` })
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
                assigned_at: ur._upl_created_at,
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
                data: { roleId: id, roleCodename: getCodenamePrimary(role.codename), users }
            })
        })
    )

    return router
}
