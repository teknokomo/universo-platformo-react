import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import {
    listUserWorkspaces,
    createSharedWorkspace,
    setDefaultWorkspace,
    addWorkspaceMember,
    removeWorkspaceMember,
    listWorkspaceMembers,
    getWorkspaceMembership
} from '../services/runtimeWorkspaceService'

const createWorkspaceSchema = z.object({
    codename: z.string().trim().min(1).max(100),
    name: z.union([z.string().min(1), z.record(z.unknown())])
})

const addMemberSchema = z.object({
    userId: z.string().uuid(),
    roleCodename: z.enum(['member', 'owner']).default('member')
})

export function createRuntimeWorkspaceController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

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
        if (options.requireOwner && membership.workspaceType === 'personal') {
            return { error: { status: 403, message: 'Personal workspaces do not support member management' } }
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

        const userId = ctx.userId
        const workspaces = await listUserWorkspaces(ctx.manager, {
            schemaName: ctx.schemaName,
            userId
        })

        return res.json({ items: workspaces, currentWorkspaceId: ctx.currentWorkspaceId })
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
            codename: parsed.data.codename,
            name: parsed.data.name,
            userId: ctx.userId,
            actorUserId: ctx.userId
        })

        return res.status(201).json({ id: workspace.id })
    }

    const updateDefaultWorkspace = async (req: Request, res: Response) => {
        const { applicationId, workspaceId } = req.params
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
            const message = error instanceof Error ? error.message : String(error)
            if (message.includes('not a member')) {
                return res.status(403).json({ error: message })
            }
            throw error
        }

        return res.json({ ok: true })
    }

    const inviteMember = async (req: Request, res: Response) => {
        const { applicationId, workspaceId } = req.params
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

        try {
            await addWorkspaceMember(ctx.manager, {
                schemaName: ctx.schemaName,
                workspaceId,
                userId: parsed.data.userId,
                roleCodename: parsed.data.roleCodename,
                actorUserId: ctx.userId
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (message.includes('not found')) {
                return res.status(404).json({ error: message })
            }
            if (message.includes('do not support member management')) {
                return res.status(403).json({ error: message })
            }
            throw error
        }

        return res.status(201).json({ ok: true })
    }

    const deleteMember = async (req: Request, res: Response) => {
        const { applicationId, workspaceId, userId: targetUserId } = req.params
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
            const message = error instanceof Error ? error.message : String(error)
            if (message.includes('not found')) {
                return res.status(404).json({ error: message })
            }
            if (message.includes('do not support member management')) {
                return res.status(403).json({ error: message })
            }
            if (message.includes('last workspace owner')) {
                return res.status(409).json({ error: message })
            }
            throw error
        }

        return res.json({ ok: true })
    }

    const getMembers = async (req: Request, res: Response) => {
        const { applicationId, workspaceId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        if (!ctx.workspacesEnabled) {
            return res.status(400).json({ error: 'Workspaces are not enabled for this application' })
        }

        const membershipState = await requireWorkspaceMembership(ctx, workspaceId)
        if (membershipState?.error) {
            return res.status(membershipState.error.status).json({ error: membershipState.error.message })
        }

        const members = await listWorkspaceMembers(ctx.manager, {
            schemaName: ctx.schemaName,
            workspaceId
        })

        return res.json({ items: members })
    }

    return {
        listWorkspaces,
        createWorkspace,
        updateDefaultWorkspace,
        inviteMember,
        deleteMember,
        getMembers
    }
}
