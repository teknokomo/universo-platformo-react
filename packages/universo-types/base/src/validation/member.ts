import { z } from 'zod'
import type { VersionedLocalizedContent } from '../common/admin.js'

/**
 * Zod schema for email validation
 * Used in member form validation
 */
export const emailSchema = z.string().min(1, 'Email is required').email('Invalid email address')

/**
 * Built-in entity roles for member forms
 * - Entity roles: admin, editor, member (owner is assigned on creation)
 * - Global roles: loaded dynamically from database
 */
export const ENTITY_MEMBER_ROLES = ['admin', 'editor', 'member'] as const
export type EntityMemberRole = (typeof ENTITY_MEMBER_ROLES)[number]

/**
 * Legacy constant for backward compatibility
 * @deprecated Use ENTITY_MEMBER_ROLES for entity roles, or load global roles dynamically
 */
export const ALL_MEMBER_ROLES = ['admin', 'editor', 'member', 'superadmin', 'supermoderator'] as const

/**
 * MemberRole type - now accepts any string to support dynamic roles from database
 * Entity roles (admin, editor, member) and global roles (superadmin, custom roles, etc.)
 */
export type MemberRole = string

/**
 * Zod schema for role validation
 * Changed from z.enum to z.string to support dynamic roles from database
 */
export const roleSchema = z.string().min(1, 'Please select a role')

/**
 * Assignable global role returned from /api/v1/admin/roles/assignable endpoint
 * Used for populating role dropdowns with dynamic roles that have global access
 *
 * Note: This is different from AssignableRole in common/roles.ts which is a type alias
 * for entity-level roles (BaseRole excluding 'owner')
 */
export interface GlobalAssignableRole {
    id: string
    codename: string
    name: VersionedLocalizedContent<string>
    color: string | null
}

/**
 * Zod schema for member form validation
 * Used in MemberFormDialog component for adding/editing metaverse members
 */
export const memberFormSchema = z.object({
    email: emailSchema,
    role: roleSchema,
    comment: z.string().trim().max(500, 'Comment must be 500 characters or less').optional().or(z.literal(''))
})

/**
 * TypeScript type inferred from memberFormSchema
 * Ensures type safety when handling form data
 */
export type MemberFormData = z.infer<typeof memberFormSchema>
