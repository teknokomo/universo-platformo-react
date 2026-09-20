import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import { isModuleAttachmentKind, type ModuleAttachmentKind } from '@universo-react/types'
import { createQueryHelper, resolveRuntimeSchema } from '../shared/runtimeHelpers'
import { RuntimeModulesService } from '../services/runtimeModulesService'
import { RUNTIME_RECORD_RULE_CODES } from '../services/runtimeRecordRules'

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

    /** Stable rule codes that may be surfaced to callers; SQLSTATE or other
     * database codes must stay behind the generic response body. */
    const FORWARDABLE_MODULE_ERROR_CODES = new Set<string>(Object.values(RUNTIME_RECORD_RULE_CODES))

    /**
     * Record rule failures raised by module writes carry stable codes; forward
     * only that allowlist instead of collapsing everything or leaking raw
     * database errors whose `code` is a SQLSTATE.
     */
    const resolveRuntimeModuleErrorResponse = (error: unknown): { status: number; body: Record<string, unknown> } => {
        const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : null
        const explicitStatus = typeof record?.statusCode === 'number' ? record.statusCode : null
        const code = typeof record?.code === 'string' && FORWARDABLE_MODULE_ERROR_CODES.has(record.code) ? record.code : null
        if (code) {
            const message = error instanceof Error ? error.message : String(error)
            return {
                status: explicitStatus ?? resolveRuntimeModuleErrorStatus(error),
                body: {
                    error: message,
                    code,
                    ...(typeof record?.field === 'string' ? { field: record.field } : {})
                }
            }
        }
        return { status: resolveRuntimeModuleErrorStatus(error), body: { error: 'Runtime module call failed' } }
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
                res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'")
                res.setHeader('X-Content-Type-Options', 'nosniff')
                res.setHeader('Vary', 'Cookie')
                return res.status(304).send()
            }

            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'")
            res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
            res.setHeader('ETag', etag)
            res.setHeader('X-Content-Type-Options', 'nosniff')
            res.setHeader('Vary', 'Cookie')
            return res.status(200).send(bundle.bundle)
        } catch (error) {
            const failure = resolveRuntimeModuleErrorResponse(error)
            if (failure.body.code) return res.status(failure.status).json(failure.body)
            return res.status(failure.status).json({
                error: 'Runtime module bundle is unavailable'
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
            const failure = resolveRuntimeModuleErrorResponse(error)
            return res.status(failure.status).json(failure.body)
        }
    }

    return {
        listModules,
        getClientBundle,
        callMethod
    }
}
