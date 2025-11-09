/**
 * Base interface for member entities across different modules
 * Used by createMemberActions factory to enable type-safe member management
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
  /** Role assigned to the member */
  role: string
  /** Optional comment about the member */
  comment?: string
}
