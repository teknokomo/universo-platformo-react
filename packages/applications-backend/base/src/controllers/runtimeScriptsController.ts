import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { SCRIPT_ATTACHMENT_KINDS } from '@universo/types'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import { RuntimeScriptsService } from '../services/runtimeScriptsService'

const listRuntimeScriptsQuerySchema = z.object({
    attachedToKind: z.enum(SCRIPT_ATTACHMENT_KINDS).optional(),
    attachedToId: z.string().uuid().optional()
})

const runtimeScriptCallSchema = z.object({
    methodName: z.string().min(1),
    args: z.array(z.unknown()).default([])
})

export function createRuntimeScriptsController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)
    const scriptsService = new RuntimeScriptsService()

    const resolveRuntimeScriptErrorStatus = (error: unknown): number => {
        const message = error instanceof Error ? error.message : String(error)

        if (message === 'Runtime script not found') return 404
        if (message.includes('Insufficient permissions')) return 403
        if (message.includes('capability')) return 403
        if (message.includes('public RPC')) return 403
        if (message.includes('circuit breaker')) return 503
        if (message.includes('timed out')) return 504
        return 400
    }

    const listScripts = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsedQuery = listRuntimeScriptsQuerySchema.safeParse(req.query)
        if (!parsedQuery.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const items = await scriptsService.listClientScripts({
            executor: ctx.manager,
            schemaName: ctx.schemaName,
            attachedToKind: parsedQuery.data.attachedToKind,
            attachedToId: parsedQuery.data.attachedToId ?? undefined
        })

        return res.json({ items })
    }

    const getClientBundle = async (req: Request, res: Response) => {
        const { applicationId, scriptId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        try {
            const bundle = await scriptsService.getClientScriptBundle({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                scriptId
            })

            const etag = `"${bundle.checksum}"`
            if (req.headers['if-none-match'] === etag) {
                res.setHeader('ETag', etag)
                res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
                res.setHeader('Vary', 'Cookie')
                return res.status(304).send()
            }

            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
            res.setHeader('ETag', etag)
            res.setHeader('Vary', 'Cookie')
            return res.status(200).send(bundle.bundle)
        } catch (error) {
            return res.status(resolveRuntimeScriptErrorStatus(error)).json({
                error: error instanceof Error ? error.message : String(error)
            })
        }
    }

    const callMethod = async (req: Request, res: Response) => {
        const { applicationId, scriptId } = req.params
        const parsedBody = runtimeScriptCallSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        try {
            const result = await scriptsService.callServerMethod({
                executor: ctx.manager,
                applicationId,
                schemaName: ctx.schemaName,
                scriptId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                request: parsedBody.data
            })

            return res.json({ result })
        } catch (error) {
            return res
                .status(resolveRuntimeScriptErrorStatus(error))
                .json({ error: error instanceof Error ? error.message : String(error) })
        }
    }

    return {
        listScripts,
        getClientBundle,
        callMethod
    }
}
