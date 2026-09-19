import type { Request, Response } from 'express'
import type { AuthenticatedApplicationRuntimeReference } from '@universo-react/types'
import { getRequestDbExecutor, type DbExecutor } from '@universo-react/utils'
import { ensureApplicationAccess } from '../routes/guards'
import { findApplicationIdByActiveAlias } from '../persistence/applicationAliasesStore'
import { parsePublicApplicationRef, PublicApplicationUnavailableError } from '../services/publicApplicationRuntime'
import { resolveUserId } from '../shared/runtimeHelpers'

const APPLICATION_NOT_FOUND_RESPONSE = { error: 'Application not found' } as const

/**
 * Resolves a short application reference for an authenticated runtime.
 * Public readiness is intentionally not checked here: private applications
 * may use aliases too, while the regular application access guard remains the
 * authority for membership and global permissions.
 */
export function createApplicationRuntimeReferenceController(
    getDbExecutor: () => DbExecutor,
    getRequestScopedDbExecutor: (req: Request) => DbExecutor = (req) => getRequestDbExecutor(req, getDbExecutor())
) {
    const resolve = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        let reference: ReturnType<typeof parsePublicApplicationRef>
        try {
            reference = parsePublicApplicationRef(req.params.applicationRef ?? '')
        } catch (error) {
            if (error instanceof PublicApplicationUnavailableError) {
                return res.status(404).json(APPLICATION_NOT_FOUND_RESPONSE)
            }
            throw error
        }

        const executor = getRequestScopedDbExecutor(req)
        const applicationId = reference.kind === 'uuid' ? reference.value : await findApplicationIdByActiveAlias(executor, reference.value)

        if (!applicationId) return res.status(404).json(APPLICATION_NOT_FOUND_RESPONSE)

        try {
            await ensureApplicationAccess(executor, userId, applicationId)
        } catch (error) {
            const statusCode =
                error && typeof error === 'object' && 'statusCode' in error ? (error as { statusCode?: unknown }).statusCode : null
            const status = error && typeof error === 'object' && 'status' in error ? (error as { status?: unknown }).status : null
            if (statusCode === 403 || status === 403) return res.status(404).json(APPLICATION_NOT_FOUND_RESPONSE)
            throw error
        }

        const response: AuthenticatedApplicationRuntimeReference = { applicationId }
        return res.json(response)
    }

    return { resolve }
}
