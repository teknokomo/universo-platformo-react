import type { Request, Response } from 'express'
import { z } from 'zod'
import { isModuleAttachmentKind, type ModuleAttachmentKind } from '@universo-react/types'
import type { PublicRuntimeSchemaContext } from '../../shared/publicRuntimeAccess'
import { UUID_REGEX } from '../../shared/runtimeHelpers'
import type { RuntimeModulesService } from '../../services/runtimeModulesService'

const publicRuntimeModulesQuerySchema = z
    .object({
        attachedToKind: z.string().trim().pipe(z.custom<ModuleAttachmentKind>(isModuleAttachmentKind)).optional(),
        attachedToId: z.string().uuid().optional()
    })
    .strict()

type PublicRuntimeContextRunner = (
    applicationId: string,
    res: Response,
    work: (ctx: PublicRuntimeSchemaContext) => Promise<void>
) => Promise<void>

interface PublicRuntimeModuleHandlersDependencies {
    withPublicRuntimeContext: PublicRuntimeContextRunner
    modulesService: Pick<RuntimeModulesService, 'listClientModules' | 'getClientModuleBundle'>
}

export const createPublicRuntimeModuleHandlers = ({
    withPublicRuntimeContext,
    modulesService
}: PublicRuntimeModuleHandlersDependencies) => {
    const listPublicModules = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const query = publicRuntimeModulesQuerySchema.safeParse(req.query)
        if (!query.success) {
            res.status(400).json({ error: 'Invalid runtime module query', details: query.error.flatten() })
            return
        }
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const items = await modulesService.listClientModules({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                attachedToKind: query.data.attachedToKind,
                attachedToId: query.data.attachedToId
            })
            res.json({ items })
        })
    }

    const getPublicClientBundle = async (req: Request, res: Response) => {
        const { applicationId, moduleId } = req.params
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            // Anonymous callers must never be able to reach PostgreSQL with an
            // identifier the database cannot parse: malformed ids and missing
            // modules share one generic not-found body so nothing internal leaks.
            if (!UUID_REGEX.test(moduleId)) {
                res.status(404).json({ error: 'Runtime module not found' })
                return
            }
            try {
                const bundle = await modulesService.getClientModuleBundle({
                    executor: ctx.manager,
                    schemaName: ctx.schemaName,
                    moduleId
                })

                res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
                res.setHeader('X-Content-Type-Options', 'nosniff')
                res.setHeader(
                    'Content-Security-Policy',
                    "default-src 'none'; script-src 'self'; connect-src 'self'; img-src data: https: http:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
                )
                res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
                res.status(200).send(bundle.bundle)
            } catch (error) {
                console.error(
                    `[runtimeGuestController] Failed to serve public client bundle for module ${moduleId} in application ${applicationId}`,
                    error
                )
                res.status(404).json({ error: 'Runtime module not found' })
            }
        })
    }

    return { listPublicModules, getPublicClientBundle }
}
