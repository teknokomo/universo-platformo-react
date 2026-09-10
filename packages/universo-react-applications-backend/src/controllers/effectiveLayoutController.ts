import type { Request, Response } from 'express'
import { getRequestDbContext } from '@universo-react/utils'
import { ensureApplicationAccess, type ApplicationRole } from '../routes/guards'
import { resolveUserId } from '../shared/runtimeHelpers'
import { EffectiveLayoutError, effectiveLayoutErrorBody, parseRuntimeTarget } from '../services/effectiveLayoutContract'
import { resolveEffectiveLayoutForRequest } from '../services/effectiveLayoutResolver'

const statusOf = (error: unknown): number | null => {
    if (!error || typeof error !== 'object') return null
    const candidate = error as { status?: unknown; statusCode?: unknown }
    if (typeof candidate.status === 'number') return candidate.status
    return typeof candidate.statusCode === 'number' ? candidate.statusCode : null
}

const sendError = (res: Response, error: EffectiveLayoutError): Response => {
    return res.status(error.httpStatus).json(effectiveLayoutErrorBody(error))
}

const sendUnexpectedError = (res: Response, error: unknown): Response => {
    const status = statusOf(error)
    if (status === 401) {
        return res.status(401).json({ status: 'failed', error: { code: 'UNAUTHORIZED', httpStatus: 401 } })
    }
    if (status === 403) {
        return res.status(403).json({ status: 'failed', error: { code: 'LAYOUT_TARGET_FORBIDDEN', httpStatus: 403 } })
    }
    return res.status(503).json({ status: 'failed', error: { code: 'LAYOUT_RUNTIME_QUERY_FAILED', httpStatus: 503 } })
}

export function createEffectiveLayoutController() {
    const getEffectiveLayout = async (req: Request, res: Response): Promise<Response> => {
        let target
        try {
            target = parseRuntimeTarget(req.params.applicationId, req.query)
        } catch (error) {
            if (error instanceof EffectiveLayoutError) return sendError(res, error)
            return res.status(400).json({ status: 'failed', error: { code: 'LAYOUT_REQUEST_INVALID', httpStatus: 400 } })
        }

        const requestDbContext = getRequestDbContext(req)
        const userId = resolveUserId(req)
        if (!requestDbContext || requestDbContext.isReleased() || !userId) {
            return res.status(401).json({ status: 'failed', error: { code: 'UNAUTHORIZED', httpStatus: 401 } })
        }

        let access
        try {
            access = await ensureApplicationAccess(requestDbContext.executor, userId, target.applicationId)
        } catch (error) {
            return sendUnexpectedError(res, error)
        }

        try {
            const role = (access.membership.role || 'member') as ApplicationRole
            const result = await resolveEffectiveLayoutForRequest(
                requestDbContext.executor,
                {
                    applicationId: target.applicationId,
                    userId,
                    role
                },
                target
            )
            return res.json(result)
        } catch (error) {
            if (error instanceof EffectiveLayoutError) return sendError(res, error)
            return sendUnexpectedError(res, error)
        }
    }

    return { getEffectiveLayout }
}
