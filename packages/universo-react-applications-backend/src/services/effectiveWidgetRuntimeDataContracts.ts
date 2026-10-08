import type { ApplicationRole, RolePermission } from '../routes/guards'
import type { DbExecutor } from '@universo-react/utils'
import type { EffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeData'

type RuntimeRecord = Record<string, unknown>

export interface EffectiveWidgetRuntimeCandidate {
    readonly id: string
    readonly widgetKey: string
    readonly config: RuntimeRecord
    readonly isActive: boolean
    readonly bindings: unknown
}

export interface EffectiveWidgetRuntimeReadScope {
    readonly applicationId?: string
    readonly applicationSettings?: RuntimeRecord | null
    readonly schemaName: string
    readonly workspaceId: string | null
    readonly workspacesEnabled: boolean
    readonly currentUserId?: string | null
    readonly role?: ApplicationRole | null
    readonly permissions?: Record<RolePermission, boolean>
}

export type EffectiveLayoutRuntimeDataResolver = (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widgets: readonly EffectiveWidgetRuntimeCandidate[],
    locale?: string
) => Promise<ReadonlyMap<string, EffectiveWidgetRuntimeData>>
