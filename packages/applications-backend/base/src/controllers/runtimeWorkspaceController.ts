import type { Request, Response } from 'express'
import { z } from 'zod'
import { LocalizedStringAllowEmptySchema, LocalizedStringSchema } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import { findApplicationMemberByUserId, findAuthUserByEmail } from '../persistence/applicationsStore'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards } from '../utils'
import {
    listUserWorkspaces,
    getUserWorkspace,
    createSharedWorkspace,
    updateWorkspace,
    copyWorkspace,
    deleteSharedWorkspace,
    setDefaultWorkspace,
    addWorkspaceMember,
    removeWorkspaceMember,
    listWorkspaceMembers,
    getWorkspaceMembership,
    RuntimeWorkspaceError,
    RUNTIME_WORKSPACE_ERROR_CODES
} from '../services/runtimeWorkspaceService'

const RUNTIME_WORKSPACE_API_ERROR_CODES = {
    invalidRouteParameters: 'INVALID_ROUTE_PARAMETERS',
    invalidQuery: 'INVALID_QUERY',
    invalidRequestBody: 'INVALID_REQUEST_BODY',
    workspacesDisabled: 'WORKSPACES_DISABLED',
    workspaceAccessDenied: 'WORKSPACE_ACCESS_DENIED',
    workspaceOwnerRequired: 'WORKSPACE_OWNER_REQUIRED',
    userNotFound: 'USER_NOT_FOUND',
    applicationMemberRequired: 'APPLICATION_MEMBER_REQUIRED'
} as const

const workspaceParamSchema = z.object({
    workspaceId: z.string().uuid()
})

const workspaceMemberParamSchema = workspaceParamSchema.extend({
    userId: z.string().uuid()
})

const defaultWorkspaceDescription = {
    _schema: '1' as const,
    _primary: 'en',
    locales: {
        en: {
            content: '',
            version: 1,
            isActive: true,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString()
        }
    }
}

const createWorkspaceSchema = z.object({
    name: LocalizedStringSchema,
    description: LocalizedStringAllowEmptySchema.default(defaultWorkspaceDescription)
})

const updateWorkspaceSchema = z
    .object({
        name: LocalizedStringSchema.optional(),
        description: LocalizedStringAllowEmptySchema
    })
    .refine((value) => value.name !== undefined || value.description !== undefined, {
        message: 'At least one workspace field is required',
        path: ['name']
    })

const copyWorkspaceSchema = z.object({
    name: LocalizedStringSchema,
    description: LocalizedStringAllowEmptySchema.default(defaultWorkspaceDescription)
})

const addMemberSchema = z
    .object({
        userId: z.string().uuid().optional(),
        email: z.string().email().optional(),
        roleCodename: z.enum(['member', 'owner']).default('member')
    })
    .refine((value) => Boolean(value.userId || value.email), {
        message: 'Either email or userId is required',
        path: ['email']
    })

export function createRuntimeWorkspaceController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const getRuntimeWorkspaceErrorCode = (error: unknown) => (error instanceof RuntimeWorkspaceError ? error.code : null)
    const getRuntimeWorkspaceErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))
    const sendError = (res: Response, status: number, message: string, code: string, details?: unknown) =>
        res.status(status).json({
            error: message,
            code,
            ...(details === undefined ? {} : { details })
        })
    const sendRuntimeWorkspaceError = (res: Response, status: number, error: unknown, code: string) =>
        sendError(res, status, getRuntimeWorkspaceErrorMessage(error), code)
    const sendInvalidParams = (res: Response, error: z.ZodError) =>
        sendError(res, 400, 'Invalid route parameters', RUNTIME_WORKSPACE_API_ERROR_CODES.invalidRouteParameters, error.flatten())
    const sendWorkspacesDisabled = (res: Response) =>
        sendError(res, 400, 'Workspaces are not enabled for this application', RUNTIME_WORKSPACE_API_ERROR_CODES.workspacesDisabled)

    const sendWorkspaceMutationError = (res: Response, error: unknown): boolean => {
        const code = getRuntimeWorkspaceErrorCode(error)
        if (code === RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound) {
            sendRuntimeWorkspaceError(res, 404, error, code)
            return true
        }
        if (code === RUNTIME_WORKSPACE_ERROR_CODES.personalWorkspaceMutationBlocked) {
            sendRuntimeWorkspaceError(res, 409, error, code)
            return true
        }
        return false
    }

    const sendMembershipStateError = (res: Response, error: { status: number; message: string; code: string }) =>
        sendError(res, error.status, error.message, error.code)

    const requireWorkspaceMembership = async (
        ctx: Awaited<ReturnType<typeof resolveRuntimeSchema>>,
        workspaceId: string,
        options: { requireOwner?: boolean } = {}
    ) => {
        if (!ctx) return null

        const membership = await getWorkspaceMembership(ctx.manager, {
            schemaName: ctx.schemaName,
            workspaceId,
            userId: ctx.userId
        })

        if (!membership) {
            return {
                error: {
                    status: 403,
                    message: 'You do not have access to this workspace',
                    code: RUNTIME_WORKSPACE_API_ERROR_CODES.workspaceAccessDenied
                }
            }
        }
        if (options.requireOwner && membership.roleCodename !== 'owner') {
            return {
                error: {
                    status: 403,
                    message: 'Only workspace owners can manage members',
                    code: RUNTIME_WORKSPACE_API_ERROR_CODES.workspaceOwnerRequired
                }
            }
        }

        return { membership }
    }

    const listWorkspaces = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return sendError(res, 400, 'Invalid query', RUNTIME_WORKSPACE_API_ERROR_CODES.invalidQuery, error.flatten())
            }
            throw error
        }

        const userId = ctx.userId
        const { items, total } = await listUserWorkspaces(ctx.manager, {
            schemaName: ctx.schemaName,
            userId,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset,
            search: validatedQuery.search ? escapeLikeWildcards(validatedQuery.search) : undefined
        })

        return res.json({
            items,
            total,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset,
            currentWorkspaceId: ctx.currentWorkspaceId
        })
    }

    const createWorkspace = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsed = createWorkspaceSchema.safeParse(req.body)
        if (!parsed.success) {
            return sendError(res, 400, 'Invalid request body', RUNTIME_WORKSPACE_API_ERROR_CODES.invalidRequestBody, parsed.error.flatten())
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        const workspace = await createSharedWorkspace(ctx.manager, {
            schemaName: ctx.schemaName,
            name: parsed.data.name,
            description: parsed.data.description,
            userId: ctx.userId,
            actorUserId: ctx.userId
        })

        return res.status(201).json({ id: workspace.id })
    }

    const getWorkspace = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const params = workspaceParamSchema.safeParse(req.params)
        if (!params.success) {
            return sendInvalidParams(res, params.error)
        }
        const { workspaceId } = params.data
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        const workspace = await getUserWorkspace(ctx.manager, {
            schemaName: ctx.schemaName,
            userId: ctx.userId,
            workspaceId
        })

        if (!workspace) {
            return sendError(res, 404, 'Workspace not found', RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound)
        }

        return res.json(workspace)
    }

    const updateWorkspaceDetails = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const params = workspaceParamSchema.safeParse(req.params)
        if (!params.success) {
            return sendInvalidParams(res, params.error)
        }
        const { workspaceId } = params.data
        const parsed = updateWorkspaceSchema.safeParse(req.body)
        if (!parsed.success) {
            return sendError(res, 400, 'Invalid request body', RUNTIME_WORKSPACE_API_ERROR_CODES.invalidRequestBody, parsed.error.flatten())
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return sendMembershipStateError(res, membershipState.error)
        }

        try {
            await updateWorkspace(ctx.manager, {
                schemaName: ctx.schemaName,
                workspaceId,
                name: parsed.data.name,
                description: parsed.data.description,
                actorUserId: ctx.userId
            })
        } catch (error) {
            if (sendWorkspaceMutationError(res, error)) return
            throw error
        }

        return res.json({ ok: true })
    }

    const copyWorkspaceDetails = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const params = workspaceParamSchema.safeParse(req.params)
        if (!params.success) {
            return sendInvalidParams(res, params.error)
        }
        const { workspaceId } = params.data
        const parsed = copyWorkspaceSchema.safeParse(req.body)
        if (!parsed.success) {
            return sendError(res, 400, 'Invalid request body', RUNTIME_WORKSPACE_API_ERROR_CODES.invalidRequestBody, parsed.error.flatten())
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return sendMembershipStateError(res, membershipState.error)
        }

        let workspace
        try {
            workspace = await copyWorkspace(ctx.manager, {
                schemaName: ctx.schemaName,
                sourceWorkspaceId: workspaceId,
                name: parsed.data.name,
                description: parsed.data.description,
                userId: ctx.userId,
                actorUserId: ctx.userId
            })
        } catch (error) {
            if (sendWorkspaceMutationError(res, error)) return
            throw error
        }

        return res.status(201).json({ id: workspace.id })
    }

    const deleteWorkspaceDetails = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const params = workspaceParamSchema.safeParse(req.params)
        if (!params.success) {
            return sendInvalidParams(res, params.error)
        }
        const { workspaceId } = params.data
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return sendMembershipStateError(res, membershipState.error)
        }

        try {
            await deleteSharedWorkspace(ctx.manager, {
                schemaName: ctx.schemaName,
                workspaceId,
                actorUserId: ctx.userId
            })
        } catch (error) {
            if (sendWorkspaceMutationError(res, error)) return
            throw error
        }

        return res.json({ ok: true })
    }

    const updateDefaultWorkspace = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const params = workspaceParamSchema.safeParse(req.params)
        if (!params.success) {
            return sendInvalidParams(res, params.error)
        }
        const { workspaceId } = params.data
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        try {
            await setDefaultWorkspace(ctx.manager, {
                schemaName: ctx.schemaName,
                userId: ctx.userId,
                workspaceId,
                actorUserId: ctx.userId
            })
        } catch (error) {
            if (getRuntimeWorkspaceErrorCode(error) === RUNTIME_WORKSPACE_ERROR_CODES.userNotMember) {
                return sendRuntimeWorkspaceError(res, 403, error, RUNTIME_WORKSPACE_ERROR_CODES.userNotMember)
            }
            throw error
        }

        return res.json({ ok: true })
    }

    const inviteMember = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const params = workspaceParamSchema.safeParse(req.params)
        if (!params.success) {
            return sendInvalidParams(res, params.error)
        }
        const { workspaceId } = params.data
        const parsed = addMemberSchema.safeParse(req.body)
        if (!parsed.success) {
            return sendError(res, 400, 'Invalid request body', RUNTIME_WORKSPACE_API_ERROR_CODES.invalidRequestBody, parsed.error.flatten())
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return sendMembershipStateError(res, membershipState.error)
        }

        const executor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
        }
        const targetUserId = parsed.data.email
            ? (await findAuthUserByEmail(executor, parsed.data.email.toLowerCase()))?.id ?? null
            : parsed.data.userId ?? null

        if (!targetUserId) {
            return sendError(res, 404, 'User not found', RUNTIME_WORKSPACE_API_ERROR_CODES.userNotFound)
        }

        const applicationMember = await findApplicationMemberByUserId(executor, {
            applicationId,
            userId: targetUserId
        })
        if (!applicationMember) {
            return sendError(
                res,
                403,
                'User must be an active application member before being added to a workspace',
                RUNTIME_WORKSPACE_API_ERROR_CODES.applicationMemberRequired
            )
        }

        try {
            await addWorkspaceMember(ctx.manager, {
                schemaName: ctx.schemaName,
                workspaceId,
                userId: targetUserId,
                roleCodename: parsed.data.roleCodename,
                actorUserId: ctx.userId
            })
        } catch (error) {
            const code = getRuntimeWorkspaceErrorCode(error)
            if (code === RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound || code === RUNTIME_WORKSPACE_ERROR_CODES.roleNotFound) {
                return sendRuntimeWorkspaceError(res, 404, error, code)
            }
            throw error
        }

        return res.status(201).json({ ok: true })
    }

    const deleteMember = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const params = workspaceMemberParamSchema.safeParse(req.params)
        if (!params.success) {
            return sendInvalidParams(res, params.error)
        }
        const { workspaceId, userId: targetUserId } = params.data
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return sendMembershipStateError(res, membershipState.error)
        }

        try {
            await removeWorkspaceMember(ctx.manager, {
                schemaName: ctx.schemaName,
                workspaceId,
                userId: targetUserId,
                actorUserId: ctx.userId
            })
        } catch (error) {
            const code = getRuntimeWorkspaceErrorCode(error)
            if (code === RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound || code === RUNTIME_WORKSPACE_ERROR_CODES.memberNotFound) {
                return sendRuntimeWorkspaceError(res, 404, error, code)
            }
            if (code === RUNTIME_WORKSPACE_ERROR_CODES.lastOwnerRemovalBlocked) {
                return sendRuntimeWorkspaceError(res, 409, error, code)
            }
            throw error
        }

        return res.json({ ok: true })
    }

    const getMembers = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const params = workspaceParamSchema.safeParse(req.params)
        if (!params.success) {
            return sendInvalidParams(res, params.error)
        }
        const { workspaceId } = params.data
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return sendWorkspacesDisabled(res)
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId)
        if (membershipState?.error) {
            return sendMembershipStateError(res, membershipState.error)
        }

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return sendError(res, 400, 'Invalid query', RUNTIME_WORKSPACE_API_ERROR_CODES.invalidQuery, error.flatten())
            }
            throw error
        }

        const { items, total } = await listWorkspaceMembers(ctx.manager, {
            schemaName: ctx.schemaName,
            workspaceId,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset,
            search: validatedQuery.search ? escapeLikeWildcards(validatedQuery.search) : undefined
        })

        return res.json({
            items,
            total,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset
        })
    }

    return {
        listWorkspaces,
        getWorkspace,
        createWorkspace,
        updateWorkspaceDetails,
        copyWorkspaceDetails,
        deleteWorkspaceDetails,
        updateDefaultWorkspace,
        inviteMember,
        deleteMember,
        getMembers
    }
}
