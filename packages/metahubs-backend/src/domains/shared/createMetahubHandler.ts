import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo/utils'
import { getRequestDbExecutor } from '../../utils'
import { getRequestDbSession } from '@universo/utils/database'
import { ensureMetahubAccess, type RolePermission } from './guards'
import { isMetahubDomainError } from './domainErrors'
import { resolveUserId } from './routeAuth'
import { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'

export interface MetahubHandlerContext {
    req: Request
    res: Response
    userId: string
    metahubId: string
    exec: DbExecutor
    schemaService: MetahubSchemaService
}

type MetahubHandlerFn = (ctx: MetahubHandlerContext) => Promise<Response | void>

export interface CreateMetahubHandlerOptions {
    permission?: RolePermission
    metahubIdParam?: string
}

export function createMetahubHandlerFactory(getDbExecutor: () => DbExecutor) {
    return function createMetahubHandler(handler: MetahubHandlerFn, options?: CreateMetahubHandlerOptions) {
        return async (req: Request, res: Response): Promise<void> => {
            const metahubIdParam = options?.metahubIdParam ?? 'metahubId'
            const metahubId = req.params[metahubIdParam]
            const userId = resolveUserId(req)

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const dbSession = getRequestDbSession(req)
            await ensureMetahubAccess(exec, userId, metahubId, options?.permission, dbSession)

            const schemaService = new MetahubSchemaService(exec)

            try {
                await handler({ req, res, userId, metahubId, exec, schemaService })
            } catch (error) {
                if (isMetahubDomainError(error)) {
                    res.status(error.statusCode).json({
                        error: error.message,
                        code: error.code,
                        ...(error.details ?? {})
                    })
                    return
                }
                throw error
            }
        }
    }
}
