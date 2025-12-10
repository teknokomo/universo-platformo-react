import type { BaseRole } from '../common/roles'

/**
 * Base interface for member entities with static roles (owner, admin, editor, member)
 * Used by createMemberActions factory for entity-level member management
 *
 * @example
 * ```typescript
 * interface MetaverseMember extends BaseMemberEntity {
 *   userId: string
 *   // module-specific fields
 * }
 * ```
 */
export interface BaseMemberEntity {
    /** Unique identifier for the member record */
    id: string
    /** Email address of the member */
    email: string | null
    /** Role assigned to the member (owner, admin, editor, member) */
    role: BaseRole
    /** Optional comment about the member */
    comment?: string
}

/**
 * Base interface for member entities with dynamic roles (loaded from database)
 * Used by createMemberActions factory for admin-level member management
 * where roles are defined dynamically (e.g., superadmin, supermoderator, custom roles)
 *
 * @example
 * ```typescript
 * interface GlobalUserMember extends DynamicMemberEntity {
 *   userId: string
 *   roleMetadata: RoleMetadata
 * }
 * ```
 */
export interface DynamicMemberEntity {
    /** Unique identifier for the member record */
    id: string
    /** Email address of the member */
    email: string | null
    /** Role name (dynamic, loaded from database) */
    roleName: string
    /** Optional comment about the member */
    comment?: string
}

/**
 * Union type for any member entity (static or dynamic roles)
 * Use this when a function needs to work with both types
 */
export type AnyMemberEntity = BaseMemberEntity | DynamicMemberEntity
