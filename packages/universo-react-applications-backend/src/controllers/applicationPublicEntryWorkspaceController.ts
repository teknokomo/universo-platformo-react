import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import { database, isUuidV7 } from '@universo-react/utils'
import { ensureApplicationAccess } from '../routes/guards'
import { findApplicationSchemaInfo } from '../persistence/applicationsStore'
import {
    PublicEntryWorkspaceError,
    resolvePublicEntryWorkspace,
    runtimeWorkspaceTablesExist,
    setPublicEntryWorkspace
} from '../services/applicationWorkspaces'
import { getRequestDbExecutor } from '../utils'
import { IDENTIFIER_REGEX, resolveUserId } from '../shared/runtimeHelpers'

const applicationIdSchema = z.string().uuid()
const publicEntryWorkspaceBodySchema = z
    .object({
        workspaceId: z
            .string()
            .uuid()
            .refine((value) => isUuidV7(value), 'Workspace identifiers must be UUID v7.')
            .nullable()
    })
    .strict()

const getPublicEntryWorkspaceErrorResponse = (error: unknown): { status: number; code: string; message: string } | null => {
    if (database.isUniqueViolation(error)) {
        return {
            status: 409,
            code: 'PUBLIC_ENTRY_WORKSPACE_CONFLICT',
            message: 'The public entry workspace changed while this request was being saved'
        }
    }

    if (!(error instanceof PublicEntryWorkspaceError)) {
        return null
    }

    switch (error.code) {
        case 'PUBLIC_ENTRY_WORKSPACE_NOT_FOUND':
            return { status: 404, code: error.code, message: 'Public entry workspace not found' }
        case 'PUBLIC_ENTRY_WORKSPACE_AMBIGUOUS':
            return { status: 409, code: error.code, message: 'The application has more than one public entry workspace' }
        case 'PUBLIC_ENTRY_WORKSPACE_INVALID':
            return { status: 400, code: error.code, message: 'The selected workspace cannot be used as a public entry workspace' }
        default:
            return null
    }
}

export function createApplicationPublicEntryWorkspaceController(getDbExecutor: () => DbExecutor) {
    const resolveApplication = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        const applicationIdResult = applicationIdSchema.safeParse(req.params.applicationId)
        if (!applicationIdResult.success) {
            res.status(400).json({ error: 'Invalid application ID format', code: 'INVALID_APPLICATION_ID' })
            return null
        }

        const applicationId = applicationIdResult.data
        const executor = getRequestDbExecutor(req, getDbExecutor())
        await ensureApplicationAccess(executor, userId, applicationId, ['admin', 'owner'])

        const application = await findApplicationSchemaInfo(executor, applicationId)
        if (!application) {
            res.status(404).json({ error: 'Application not found' })
            return null
        }
        if (!application.schemaName) {
            res.status(400).json({ error: 'Application schema is not configured', code: 'APPLICATION_SCHEMA_NOT_CONFIGURED' })
            return null
        }
        if (!application.workspacesEnabled) {
            res.status(400).json({ error: 'Public entry workspace requires workspace mode', code: 'WORKSPACES_DISABLED' })
            return null
        }
        if (!IDENTIFIER_REGEX.test(application.schemaName)) {
            res.status(400).json({ error: 'Invalid application schema name', code: 'INVALID_APPLICATION_SCHEMA' })
            return null
        }
        if (!(await runtimeWorkspaceTablesExist(executor, application.schemaName))) {
            res.status(400).json({ error: 'Workspace subsystem is not initialized yet', code: 'WORKSPACE_SUBSYSTEM_NOT_READY' })
            return null
        }

        return { application, executor, userId }
    }

    const get = async (req: Request, res: Response) => {
        const context = await resolveApplication(req, res)
        if (!context) return

        try {
            const workspace = await resolvePublicEntryWorkspace(context.executor, context.application.schemaName!)
            return res.json({ workspaceId: workspace?.workspaceId ?? null })
        } catch (error) {
            const response = getPublicEntryWorkspaceErrorResponse(error)
            if (response) {
                return res.status(response.status).json({ error: response.message, code: response.code })
            }
            throw error
        }
    }

    const update = async (req: Request, res: Response) => {
        const parsed = publicEntryWorkspaceBodySchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request body', code: 'INVALID_REQUEST_BODY', details: parsed.error.flatten() })
        }

        const context = await resolveApplication(req, res)
        if (!context) return

        try {
            const workspace = await setPublicEntryWorkspace(context.executor, {
                schemaName: context.application.schemaName!,
                workspaceId: parsed.data.workspaceId,
                actorUserId: context.userId
            })
            return res.json({ workspaceId: workspace?.workspaceId ?? null })
        } catch (error) {
            const response = getPublicEntryWorkspaceErrorResponse(error)
            if (response) {
                return res.status(response.status).json({ error: response.message, code: response.code })
            }
            throw error
        }
    }

    return { get, update }
}
