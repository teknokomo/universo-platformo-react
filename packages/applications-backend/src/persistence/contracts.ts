import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Re-exported from @universo/types for backward compatibility.
 * New code should import directly from '@universo/types'.
 */
export { ApplicationSchemaStatus } from '@universo/types'

/**
 * Minimal membership contract used by guards and route access checks.
 * This is the SQL-first replacement for entity-shaped membership typing.
 */
export interface ApplicationMembershipRecord {
    id?: string
    applicationId: string
    userId: string
    role: string
    comment?: VersionedLocalizedContent<string> | null
    _uplCreatedAt?: Date
}

/**
 * Minimal connector contract required by access guards.
 */
export interface ConnectorAccessRecord {
    id: string
    applicationId: string
}
