import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { isModuleAttachmentKind, type ModuleAttachmentKind } from '@universo/types'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import { RuntimeModulesService } from '../services/runtimeModulesService'

const moduleAttachmentKindSchema = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((value) => isModuleAttachmentKind(value), { message: 'Invalid module attachment kind' })
    .transform((value): ModuleAttachmentKind => value)

const listRuntimeModulesQuerySchema = z.object({
    attachedToKind: moduleAttachmentKindSchema.optional(),
    attachedToId: z.string().uuid().optional()
})

const runtimeModuleCallSchema = z.object({
    methodName: z.string().min(1),
    args: z.array(z.unknown()).default([])
})

export function createRuntimeModulesController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)
    const modulesService = new RuntimeModulesService()

    const resolveRuntimeModuleErrorStatus = (error: unknown): number => {
        const message = error instanceof Error ? error.message : String(error)

        if (message === 'Runtime module not found') return 404
        if (message.includes('Insufficient permissions')) return 403
        if (message.includes('capability')) return 403
        if (message.includes('public RPC')) return 403
        if (message.includes('circuit breaker')) return 503
        if (message.includes('timed out')) return 504
        return 400
    }

    const listModules = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsedQuery = listRuntimeModulesQuerySchema.safeParse(req.query)
        if (!parsedQuery.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const items = await modulesService.listClientModules({
            executor: ctx.manager,
            schemaName: ctx.schemaName,
            attachedToKind: parsedQuery.data.attachedToKind ?? undefined,
            attachedToId: parsedQuery.data.attachedToId ?? undefined
        })

        return res.json({ items })
    }

    const getClientBundle = async (req: Request, res: Response) => {
        const { applicationId, moduleId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        try {
            const bundle = await modulesService.getClientModuleBundle({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                moduleId
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
            return res.status(resolveRuntimeModuleErrorStatus(error)).json({
                error: error instanceof Error ? error.message : String(error)
            })
        }
    }

    const callMethod = async (req: Request, res: Response) => {
        const { applicationId, moduleId } = req.params
        const parsedBody = runtimeModuleCallSchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        try {
            const result = await modulesService.callServerMethod({
                executor: ctx.manager,
                applicationId,
                schemaName: ctx.schemaName,
                moduleId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                request: parsedBody.data
            })

            return res.json({ result })
        } catch (error) {
            return res
                .status(resolveRuntimeModuleErrorStatus(error))
                .json({ error: error instanceof Error ? error.message : String(error) })
        }
    }

    return {
        listModules,
        getClientBundle,
        callMethod
    }
}
