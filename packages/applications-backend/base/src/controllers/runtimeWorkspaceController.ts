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
    const sendInvalidParams = (res: Response, error: z.ZodError) =>
        res.status(400).json({ error: 'Invalid route parameters', details: error.flatten() })

    const sendWorkspaceMutationError = (res: Response, error: unknown): boolean => {
        const code = getRuntimeWorkspaceErrorCode(error)
        if (code === RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound) {
            res.status(404).json({ error: getRuntimeWorkspaceErrorMessage(error) })
            return true
        }
        if (code === RUNTIME_WORKSPACE_ERROR_CODES.personalWorkspaceMutationBlocked) {
            res.status(409).json({ error: getRuntimeWorkspaceErrorMessage(error) })
            return true
        }
        return false
    }

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
            return { error: { status: 403, message: 'You do not have access to this workspace' } }
        }
        if (options.requireOwner && membership.roleCodename !== 'owner') {
            return { error: { status: 403, message: 'Only workspace owners can manage members' } }
        }

        return { membership }
    }

    const listWorkspaces = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
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
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
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
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        const workspace = await getUserWorkspace(ctx.manager, {
            schemaName: ctx.schemaName,
            userId: ctx.userId,
            workspaceId
        })

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' })
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
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return res.status(membershipState.error.status).json({ error: membershipState.error.message })
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
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return res.status(membershipState.error.status).json({ error: membershipState.error.message })
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
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return res.status(membershipState.error.status).json({ error: membershipState.error.message })
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
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
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
                return res.status(403).json({ error: getRuntimeWorkspaceErrorMessage(error) })
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
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return res.status(membershipState.error.status).json({ error: membershipState.error.message })
        }

        const executor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
        }
        const targetUserId = parsed.data.email
            ? (await findAuthUserByEmail(executor, parsed.data.email.toLowerCase()))?.id ?? null
            : parsed.data.userId ?? null

        if (!targetUserId) {
            return res.status(404).json({ error: 'User not found' })
        }

        const applicationMember = await findApplicationMemberByUserId(executor, {
            applicationId,
            userId: targetUserId
        })
        if (!applicationMember) {
            return res.status(403).json({ error: 'User must be an active application member before being added to a workspace' })
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
                return res.status(404).json({ error: getRuntimeWorkspaceErrorMessage(error) })
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
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })
        if (membershipState?.error) {
            return res.status(membershipState.error.status).json({ error: membershipState.error.message })
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
                return res.status(404).json({ error: getRuntimeWorkspaceErrorMessage(error) })
            }
            if (code === RUNTIME_WORKSPACE_ERROR_CODES.lastOwnerRemovalBlocked) {
                return res.status(409).json({ error: getRuntimeWorkspaceErrorMessage(error) })
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
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId)
        if (membershipState?.error) {
            return res.status(membershipState.error.status).json({ error: membershipState.error.message })
        }

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
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
