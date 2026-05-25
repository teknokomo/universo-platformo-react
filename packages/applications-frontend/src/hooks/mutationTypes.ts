/**
 * Type definitions for application mutation hooks.
 * Extracted from mutations.ts for maintainability.
 */
import type { AssignableRole } from '@universo/template-mui'
import type { ApplicationLayoutSyncPolicy } from '@universo/types'
import type { ConnectorLocalizedPayload, SimpleLocalizedInput } from '../types'
import type * as applicationsApi from '../api/applications'

// ============================================================================
// Application Types
// ============================================================================

export interface UpdateApplicationParams {
    id: string
    data: applicationsApi.ApplicationInput
}

export interface CopyApplicationParams {
    id: string
    data?: applicationsApi.ApplicationCopyInput
}

export interface JoinApplicationParams {
    id: string
}

export interface LeaveApplicationParams {
    id: string
}

export class CopySyncStepError extends Error {
    constructor(readonly copiedApplicationId: string, readonly originalError: unknown) {
        const message = originalError instanceof Error ? originalError.message : 'Unknown sync error'
        super(message)
        this.name = 'CopySyncStepError'
    }
}

// ============================================================================
// Member Types
// ============================================================================

export interface UpdateMemberRoleParams {
    applicationId: string
    memberId: string
    data: { role: AssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
}

export interface RemoveMemberParams {
    applicationId: string
    memberId: string
}

export interface InviteMemberParams {
    applicationId: string
    data: { email: string; role: AssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
}

// ============================================================================
// Connector Types
// ============================================================================

export interface CreateConnectorParams {
    applicationId: string
    data: ConnectorLocalizedPayload & { sortOrder?: number }
}

export interface UpdateConnectorParams {
    applicationId: string
    connectorId: string
    data: ConnectorLocalizedPayload & { sortOrder?: number }
}

export interface DeleteConnectorParams {
    applicationId: string
    connectorId: string
}

export interface SyncConnectorParams {
    applicationId: string
    confirmDestructive?: boolean
    layoutResolutionPolicy?: ApplicationLayoutSyncPolicy
    schemaOptions?: {
        workspaceModeRequested?: 'enabled' | 'not_requested' | null
        acknowledgeIrreversibleWorkspaceEnablement?: boolean
    }
}
