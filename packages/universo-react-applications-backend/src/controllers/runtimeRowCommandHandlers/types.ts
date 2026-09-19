import type { DbExecutor } from '@universo-react/utils'

import type { RuntimePostingMovementService } from '../../services/runtimePostingMovements'
import type { RuntimeRecordCommandService } from '../../services/runtimeRecordBehavior'
import type { createQueryHelper } from '../../shared/runtimeHelpers'
import type { resolveRuntimeObjectByCodename, resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'

export type RuntimeCommandGuardFailure = { statusCode: number; body: Record<string, unknown> }

export type RuntimeProgressTarget = NonNullable<Awaited<ReturnType<typeof resolveRuntimeObjectByCodename>>>

export type RuntimeResolvedObjectCollection = NonNullable<Awaited<ReturnType<typeof resolveRuntimeObjectCollection>>['objectCollection']>

export type RuntimeProgressQuotedColumns = {
    targetObjectCodename: string
    targetRecordId: string
    userId: string
    status: string
    progressPercent: string
    startedAt: string
    completedAt: string
    lastViewedAt: string
}

export type RuntimeLibraryRelationColumns = {
    targetObjectColumn: string
    targetRecordColumn: string
    actorColumn: string | null
    principalTypeColumn: string | null
    principalIdColumn: string | null
    accessLevelColumn: string | null
    timestampColumn: string | null
}

export type RuntimeRowCommandHandlerDeps = {
    getDbExecutor: () => DbExecutor
    query: ReturnType<typeof createQueryHelper>
    recordCommandService: RuntimeRecordCommandService
    postingMovementService: RuntimePostingMovementService
}
