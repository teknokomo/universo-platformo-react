import type { GlobalShortLinkTarget } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { resolvePublicEntryWorkspace, PublicEntryWorkspaceError } from './applicationWorkspaces'
import { EffectiveLayoutError } from './effectiveLayoutContract'
import { resolveEffectiveLayoutForPublicTransaction } from './effectiveLayoutResolver'

type ApplicationResourceTarget = Extract<GlobalShortLinkTarget, { kind: 'application-resource' }>

interface PublicApplicationResourceContext {
    id: string
    schemaName: string
    workspacesEnabled: boolean
}

/** Confirm a short-link resource through the same public resolver used by the application runtime. */
export async function isGlobalShortLinkApplicationResourceAvailable(
    executor: DbExecutor,
    application: PublicApplicationResourceContext,
    target: ApplicationResourceTarget
): Promise<boolean> {
    if (application.id !== target.applicationId) return false

    try {
        const publicWorkspace = application.workspacesEnabled ? await resolvePublicEntryWorkspace(executor, application.schemaName) : null
        const effectiveLayout = await resolveEffectiveLayoutForPublicTransaction(
            executor,
            {
                applicationId: application.id,
                targetKind: target.targetKind,
                entityTypeCodename: target.entityTypeCodename,
                locale: 'en'
            },
            publicWorkspace?.workspaceId ?? null
        )
        return effectiveLayout.status === 'ok'
    } catch (error) {
        if (error instanceof PublicEntryWorkspaceError) return false
        if (error instanceof EffectiveLayoutError && error.httpStatus < 500) return false
        throw error
    }
}
