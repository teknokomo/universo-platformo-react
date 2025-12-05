import { z } from 'zod'

/**
 * Zod schema for email validation
 * Used in member form validation
 */
export const emailSchema = z.string().min(1, 'Email is required').email('Invalid email address')

/**
 * All valid roles for member forms (entity roles + global roles)
 * - Entity roles: admin, editor, member (owner is assigned on creation)
 * - Global roles: superadmin, supermoderator
 */
export const ALL_MEMBER_ROLES = ['admin', 'editor', 'member', 'superadmin', 'supermoderator'] as const
export type MemberRole = (typeof ALL_MEMBER_ROLES)[number]

/**
 * Zod schema for role validation
 * Used in member form validation - supports both entity and global roles
 */
export const roleSchema = z.enum(ALL_MEMBER_ROLES, {
    errorMap: () => ({ message: 'Please select a valid role' })
})

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
